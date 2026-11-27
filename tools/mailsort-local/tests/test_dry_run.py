"""Small synthetic Gmail retrieval and dry-run checks; no real mail or model calls."""

import json
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from mcp.types import CallToolResult, TextContent

from noemi_mailsort import dry_run, gmail_mcp, ollama
from noemi_mailsort.prompts import load_catalog


ROOT = Path(__file__).resolve().parents[1]
LABEL_TEXT = "Found 2 labels (1 system, 1 user):\n\nSystem Labels:\nID: INBOX\nName: INBOX\n\nUser Labels:\nID: Label_example\nName: Example\n"
SEARCH_TEXT = "ID: abc123\nSubject: Fictional subject\nFrom: sender@example.test\nDate: Fri, 30 Oct 2026 11:00:00 +0000\n"
HEADER_TEXT = "Thread ID: thread1\nMessage-ID: <example@example.test>\nSubject: Fictional subject\nFrom: sender@example.test\nTo: reader@example.test\nDate: Fri, 30 Oct 2026 11:00:00 +0000"


def tool_result(text: str, error: bool = False) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text="<untrusted-tool-output>\n" + text + "\n</untrusted-tool-output>")], isError=error)


class ParsingTests(unittest.TestCase):
    def test_processing_config_requires_a_query_and_bounded_integer_limit(self) -> None:
        settings = dry_run.load_processing_config(ROOT / "config/processing.example.json")
        self.assertEqual(settings["max_messages"], 5)
        self.assertIn("has:nouserlabels", settings["query"])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "processing.json"
            for change in ({"query": ""}, {"max_messages": True}, {"max_messages": 0},
                           {"max_messages": 501}, {"max_messages": 1.5}, {"unknown": 1}):
                with self.subTest(change=change):
                    path.write_text(json.dumps({**settings, **change}))
                    with self.assertRaises(ValueError):
                        dry_run.load_processing_config(path)

    def test_search_parses_empty_and_nonempty_pages(self) -> None:
        self.assertEqual(gmail_mcp.parse_search_result(tool_result(""), 5), [])
        self.assertEqual(gmail_mcp.parse_search_result(tool_result(SEARCH_TEXT), 5), ["abc123"])

    def test_search_rejects_duplicates_excess_and_malformed_data_before_reads(self) -> None:
        for text, maximum in ((SEARCH_TEXT * 2, 5), (SEARCH_TEXT + SEARCH_TEXT.replace("abc123", "def456"), 1),
                              ("ID: abc123\n", 5), (SEARCH_TEXT.replace("abc123", "bad id"), 5)):
            with self.subTest(text=text), self.assertRaises(gmail_mcp.GmailMCPError):
                gmail_mcp.parse_search_result(tool_result(text), maximum)
        with self.assertRaises(gmail_mcp.GmailMCPError):
            gmail_mcp.parse_search_result(tool_result("private failed response", error=True), 5)

    def test_message_prefix_preserves_unicode_whitespace_and_header_like_body_text(self) -> None:
        body = " é🌍\nFrom: body text\n"
        result = gmail_mcp.parse_email_result(tool_result(HEADER_TEXT + "\n\n" + body), 4)
        self.assertEqual(result, {"sender": "sender@example.test", "subject": "Fictional subject", "body": " é🌍\n"})
        self.assertEqual(gmail_mcp.parse_email_result(tool_result(HEADER_TEXT + "\n\n"), 4)["body"], "")

    def test_html_annotation_is_removed_without_rendering_or_fetching_html(self) -> None:
        note = "[Note: This email is HTML-formatted. Rendering the HTML body because the plain-text part was empty or a placeholder stub.]\n\n"
        result = gmail_mcp.parse_email_result(tool_result(HEADER_TEXT + "\n\n" + note + "<p>Example</p>"), 100)
        self.assertEqual(result["body"], "<p>Example</p>")

    def test_malformed_or_failed_message_is_not_classified_as_empty(self) -> None:
        for text in ("", "From: incomplete\n\nbody", HEADER_TEXT, HEADER_TEXT + "\nFrom: duplicate\n\nbody"):
            with self.subTest(text=text), self.assertRaises(gmail_mcp.GmailMCPError):
                gmail_mcp.parse_email_result(tool_result(text), 100)


class RetrievalTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_discovered_read_tools_are_called_with_the_exact_search_limit(self) -> None:
        session = AsyncMock()
        session.initialize.return_value = SimpleNamespace(serverInfo=SimpleNamespace(name="gmail", version="3.0.0"))
        session.list_tools.return_value = SimpleNamespace(
            tools=[SimpleNamespace(name=name) for name in ("list_email_labels", "search_emails", "read_email", "modify_email", "create_label")],
            nextCursor=None,
        )
        session.call_tool.side_effect = [tool_result(LABEL_TEXT), tool_result(SEARCH_TEXT), tool_result(HEADER_TEXT + "\n\nfictional")]

        @asynccontextmanager
        async def context(settings):
            yield session

        with patch.object(gmail_mcp, "open_session", context):
            result = await gmail_mcp.fetch_messages({}, "newer_than:7d has:nouserlabels", 5, 4)
        self.assertEqual(len(result["user_labels"]), 1)
        self.assertEqual(result["messages"], [{"id": "abc123", "email": {"sender": "sender@example.test", "subject": "Fictional subject", "body": "fict"}}])
        calls = session.call_tool.await_args_list
        self.assertEqual([call.args[0] for call in calls], ["list_email_labels", "search_emails", "read_email"])
        self.assertEqual(calls[1].args[1], {"query": "newer_than:7d has:nouserlabels", "maxResults": 5})
        self.assertEqual(calls[2].args[1], {"messageId": "abc123", "format": "full", "maxBodyLength": 0, "includeAttachments": False})

    async def test_write_allowlist_rejects_mutations_before_mcp(self) -> None:
        session = AsyncMock()
        for name in ("modify_email", "create_label", "send_email", "delete_email"):
            with self.subTest(name=name), self.assertRaises(gmail_mcp.GmailMCPError):
                await gmail_mcp.read_tool(session, name, {})
        session.call_tool.assert_not_awaited()

    async def test_empty_search_never_reads_a_body(self) -> None:
        session = AsyncMock()
        session.call_tool.side_effect = [tool_result(LABEL_TEXT), tool_result("")]

        @asynccontextmanager
        async def context(settings):
            yield session

        with patch.object(gmail_mcp, "open_session", context), patch.object(gmail_mcp, "discover_tools", return_value={"available_tools": ["list_email_labels", "search_emails", "read_email"]}):
            result = await gmail_mcp.fetch_messages({}, "has:nouserlabels", 5, 1000)
        self.assertEqual(result["messages"], [])
        self.assertEqual(session.call_tool.await_count, 2)


class LabelResolutionTests(unittest.TestCase):
    def test_exact_unicode_names_preserve_eligible_order_and_account_ids(self) -> None:
        labels = [{"name": name, "id": label_id, "type": "user"}
                  for name, label_id in (("Példa & Notes", "Label_new"), ("Other", "Label_other"))]
        self.assertEqual(gmail_mcp.resolve_label_names(["Other", "Példa & Notes"], labels), {
            "resolved_labels": [{"name": "Other", "id": "Label_other"}, {"name": "Példa & Notes", "id": "Label_new"}],
            "mapping_problems": [],
        })

    def test_missing_and_near_matches_are_not_repaired(self) -> None:
        labels = [{"name": "Example", "id": "Label_example", "type": "user"}]
        names = ["example", "Example ", "Missing"]
        result = gmail_mcp.resolve_label_names(names, labels)
        self.assertEqual(result["resolved_labels"], [])
        self.assertEqual(result["mapping_problems"], [
            {"name": name, "reason": "missing", "gmail_ids": []} for name in names
        ])

    def test_system_names_never_resolve_or_conflict_with_user_labels(self) -> None:
        labels = [{"name": "Example", "id": "CATEGORY_EXAMPLE", "type": "system"},
                  {"name": "INBOX", "id": "INBOX", "type": "system"},
                  {"name": "Example", "id": "Label_example", "type": "user"}]
        self.assertEqual(gmail_mcp.resolve_label_names(["Example", "INBOX"], labels), {
            "resolved_labels": [{"name": "Example", "id": "Label_example"}],
            "mapping_problems": [{"name": "INBOX", "reason": "missing", "gmail_ids": []}],
        })

    def test_duplicate_user_names_report_conflicting_ids_without_choosing_one(self) -> None:
        text = "Found 2 labels (0 system, 2 user):\n\nSystem Labels:\n\nUser Labels:\nID: Label_one\nName: Example\n\nID: Label_two\nName: Example\n"
        labels = gmail_mcp.parse_label_result(tool_result(text))
        self.assertEqual(gmail_mcp.resolve_label_names(["Example"], labels), {
            "resolved_labels": [],
            "mapping_problems": [{"name": "Example", "reason": "conflicting", "gmail_ids": ["Label_one", "Label_two"]}],
        })

    def test_empty_eligibility_and_empty_account_are_valid(self) -> None:
        self.assertEqual(gmail_mcp.resolve_label_names([], []), {"resolved_labels": [], "mapping_problems": []})
        self.assertEqual(gmail_mcp.resolve_label_names(["Missing"], []), {
            "resolved_labels": [],
            "mapping_problems": [{"name": "Missing", "reason": "missing", "gmail_ids": []}],
        })


class PipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = ollama.load_model_config(ROOT / "config/model.example.json")
        self.processing = dry_run.load_processing_config(ROOT / "config/processing.example.json")
        self.catalog = load_catalog(ROOT / "config/labels.example.json")
        self.batch = {"user_labels": [{"name": "Example", "id": "Label_example", "type": "user"}],
                      "messages": [{"id": "abc123", "email": {"sender": "private sender", "subject": "private subject", "body": "private body"}}]}

    def test_empty_search_skips_ollama_entirely(self) -> None:
        with patch.object(gmail_mcp, "fetch_messages", AsyncMock(return_value={**self.batch, "messages": []})), \
                patch.object(dry_run, "classify_batch") as classify:
            result = dry_run.run_dry_run({}, self.processing, self.model, self.catalog, "labels")
        classify.assert_not_called()
        self.assertEqual(result["processed_count"], 0)
        self.assertEqual(result["results"], [])

    def test_both_modes_reuse_validation_and_omit_private_email_text(self) -> None:
        for mode in ("labels", "confidence"):
            response = '{"predicted_labels":["Promotions"]}' if mode == "labels" else json.dumps({"scores": {label["name"]: 0.5 for label in self.catalog["labels"]}})
            with self.subTest(mode=mode), patch.object(gmail_mcp, "fetch_messages", AsyncMock(return_value=self.batch)), \
                    patch.object(ollama, "verify_model"), patch.object(ollama, "chat", return_value=response), \
                    patch.object(ollama, "unload_model") as unload:
                result = dry_run.run_dry_run({}, self.processing, self.model, self.catalog, mode)
            self.assertTrue(result["dry_run"])
            self.assertEqual(result["processed_count"], 1)
            self.assertEqual(result["user_label_count"], 1)
            self.assertEqual(result["results"][0]["message_id"], "abc123")
            self.assertTrue(result["results"][0]["eligible_labels"])
            self.assertNotIn("private", json.dumps(result))
            unload.assert_called_once()

    def test_selected_catalog_and_prompt_directory_reach_classifier(self) -> None:
        prompt_dir = Path("/fictional/private-prompts")
        prediction = {"model": "fictional", "prediction": {"Example": 0.8},
                      "eligible_labels": ["Example"], "duration_seconds": 1.0}
        with patch.object(gmail_mcp, "fetch_messages", AsyncMock(return_value=self.batch)), \
                patch.object(dry_run, "classify_batch", return_value=[prediction]) as classify:
            result = dry_run.run_dry_run({}, self.processing, self.model, self.catalog, "confidence", prompt_dir)
        classify.assert_called_once_with(
            [self.batch["messages"][0]["email"]], self.model, self.catalog, "confidence", prompt_dir,
        )
        self.assertEqual(result["results"][0]["resolved_labels"], [{"name": "Example", "id": "Label_example"}])
        self.assertEqual(result["results"][0]["mapping_problems"], [])

    def test_only_threshold_eligible_names_are_resolved_against_fresh_account_ids(self) -> None:
        self.batch["user_labels"] = [{"name": "Promotions", "id": "Label_current", "type": "user"}]
        response = json.dumps({"scores": {
            label["name"]: 0.5 if label["name"] in {"Promotions", "Newsletters"} else 0.49
            for label in self.catalog["labels"]
        }})
        with patch.object(gmail_mcp, "fetch_messages", AsyncMock(return_value=self.batch)), \
                patch.object(ollama, "verify_model"), patch.object(ollama, "chat", return_value=response), \
                patch.object(ollama, "unload_model"):
            result = dry_run.run_dry_run({}, self.processing, self.model, self.catalog, "confidence")
        message = result["results"][0]
        self.assertEqual(message["eligible_labels"], ["Promotions", "Newsletters"])
        self.assertEqual(message["resolved_labels"], [{"name": "Promotions", "id": "Label_current"}])
        self.assertEqual(message["mapping_problems"], [{"name": "Newsletters", "reason": "missing", "gmail_ids": []}])

    def test_retrieval_failure_stops_before_model_calls(self) -> None:
        with patch.object(gmail_mcp, "fetch_messages", AsyncMock(side_effect=gmail_mcp.GmailMCPError("Failed retrieval"))), \
                patch.object(dry_run, "classify_batch") as classify:
            with self.assertRaises(gmail_mcp.GmailMCPError):
                dry_run.run_dry_run({}, self.processing, self.model, self.catalog, "labels")
        classify.assert_not_called()
