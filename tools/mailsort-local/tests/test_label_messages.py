"""Focused reviewed/automatic labeling checks; fictional messages, no network."""

import copy
import io
import json
import stat
import tempfile
import unittest
from contextlib import asynccontextmanager, redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from mcp.types import CallToolResult, TextContent

from noemi_mailsort import gmail_mcp, label_messages, ollama
from noemi_mailsort.prompts import load_catalog


ROOT = Path(__file__).resolve().parents[1]
CATALOG = load_catalog(ROOT / "config/labels.example.json")


def result(text: str, error: bool = False) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=text)], isError=error)


def row(message_id: str = "abc123", names: list[str] | None = None, decision: str = "approve") -> dict:
    return {
        "message_id": message_id, "sender": "sender@example.test", "subject": "Fictional subject",
        "prediction": {"Promotions": 0.1}, "eligible_labels": [],
        "selected_labels": ["Promotions"] if names is None else names, "decision": decision,
        # Stale IDs in a saved file must never authorize Gmail operations.
        "resolved_labels": [{"name": "Promotions", "id": "INBOX"}], "mapping_problems": [],
    }


def plan(*rows: dict) -> dict:
    return {"version": 1, "created_at": "2026-10-30T12:00:00+00:00", "query": "has:nouserlabels",
            "mode": "confidence", "model": "fictional", "messages": list(rows)}


def client(*responses: CallToolResult, tools: tuple = ("list_email_labels", "modify_email")) -> AsyncMock:
    session = AsyncMock()
    session.initialize.return_value = SimpleNamespace(serverInfo=SimpleNamespace(name="gmail", version="3.0.0"))
    session.list_tools.return_value = SimpleNamespace(tools=[SimpleNamespace(name=name) for name in tools], nextCursor=None)
    session.call_tool.side_effect = list(responses)
    return session


def listing(*names: str) -> CallToolResult:
    users = "\n".join(f"ID: Label_{index}\nName: {name}\n" for index, name in enumerate(names))
    return result(f"Found {len(names) + 1} labels (1 system, {len(names)} user):\n\nSystem Labels:\nID: CATEGORY_PROMOTIONS\nName: Promotions\n\nUser Labels:\n" + users)


class PlanTests(unittest.TestCase):
    def test_preparation_reuses_classifier_and_custom_templates_without_retaining_bodies(self) -> None:
        settings = ollama.load_model_config(ROOT / "config/model.example.json")
        email = {"sender": "sender@example.test", "subject": "Fictional subject", "body": "PRIVATE_BODY_SENTINEL"}
        batch = {"messages": [{"id": "abc123", "email": email}],
                 "user_labels": [{"id": "Label_current", "name": "Promotions", "type": "user"}]}
        templates = Path("/fictional/custom-templates")
        for mode in ("labels", "confidence"):
            prediction = ["Promotions"] if mode == "labels" else {"Promotions": 0.8}
            with self.subTest(mode=mode), patch.object(gmail_mcp, "fetch_messages", AsyncMock(return_value=batch)), \
                    patch.object(label_messages, "classify_batch", return_value=[{"prediction": prediction, "eligible_labels": ["Promotions"]}]) as classify:
                prepared = label_messages.prepare_plan({}, {"query": "has:nouserlabels", "max_messages": 5}, settings, CATALOG, mode, templates)
            classify.assert_called_once_with([email], settings, CATALOG, mode, templates)
            self.assertNotIn("PRIVATE_BODY_SENTINEL", json.dumps(prepared))
            self.assertEqual(prepared["messages"][0]["decision"], "pending")
            self.assertEqual(prepared["messages"][0]["resolved_labels"][0]["id"], "Label_current")

    def test_empty_search_skips_model(self) -> None:
        with patch.object(gmail_mcp, "fetch_messages", AsyncMock(return_value={"messages": [], "user_labels": []})), \
                patch.object(label_messages, "classify_batch") as classify:
            prepared = label_messages.prepare_plan({}, {"query": "example", "max_messages": 5},
                                                   {"body_max_characters": 1000, "model": "fictional"}, CATALOG, "labels")
        self.assertEqual(prepared["messages"], [])
        classify.assert_not_called()

    def test_private_plan_file_permissions_roundtrip_and_overwrite_protection(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.json"
            original = plan(row())
            label_messages.write_plan(path, original)
            self.assertEqual(label_messages.load_plan(path), original)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            with self.assertRaises(ValueError):
                label_messages.write_plan(path, plan())
            self.assertEqual(label_messages.load_plan(path), original)
            with self.assertRaises(ValueError):
                label_messages.write_plan(Path(directory) / "shared.example.json", original)
            with self.assertRaises(FileExistsError), patch.object(label_messages, "check_output_path"):
                label_messages.write_plan(path, plan())

    def test_malformed_duplicate_key_and_oversized_plans_fail_without_content_in_errors(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.json"
            for text in ('{"version":1,"version":2}', 'PRIVATE_TEXT', 'x' * (2 * 1024 * 1024 + 1)):
                path.write_text(text)
                with self.assertRaises(ValueError) as caught:
                    label_messages.load_plan(path)
                self.assertNotIn("PRIVATE_TEXT", str(caught.exception))

    def test_manual_selection_overrides_scores_and_ignores_saved_ids(self) -> None:
        decisions = label_messages.validate_decisions(plan(row()), CATALOG)
        self.assertEqual(decisions, [{"message_id": "abc123", "decision": "approve", "selected_labels": ["Promotions"]}])

    def test_invalid_selected_names_limits_decisions_ids_and_schema_are_rejected(self) -> None:
        invalid = [plan(row(names=["Unknown"])), plan(row(names=["Promotions", "Promotions"])),
                   plan(row(names=[1])), plan(row(decision="yes")), plan(row(message_id="bad id")),
                   plan(row(), row()), {**plan(), "version": True}, {**plan(), "messages": [row()] * 501},
                   {**plan(), "body": "unexpected"}, plan({**row(), "remove_labels": ["UNREAD"]})]
        catalog = copy.deepcopy(CATALOG)
        catalog["labels"][0]["enabled"] = False
        invalid.append(plan(row()))
        for invalid_plan in invalid[:-1]:
            with self.subTest(plan=invalid_plan.get("version")), self.assertRaises(ValueError):
                label_messages.validate_decisions(invalid_plan, CATALOG)
        with self.assertRaises(ValueError):
            label_messages.validate_decisions(invalid[-1], catalog)
        with self.assertRaises(ValueError):
            label_messages.validate_decisions(plan(row(names=["Promotions", "Newsletters"])), {**CATALOG, "max_labels_per_email": 1})


class WriteTests(unittest.IsolatedAsyncioTestCase):
    async def test_preview_uses_fresh_user_ids_and_never_calls_write_tools(self) -> None:
        session = client(listing("Promotions"), tools=("list_email_labels",))
        outcome = await label_messages.apply_session(session, label_messages.validate_decisions(plan(row()), CATALOG))
        session.call_tool.assert_awaited_once_with("list_email_labels", {})
        self.assertTrue(outcome["dry_run"])
        self.assertEqual(outcome["results"][0]["resolved_labels"], [{"name": "Promotions", "id": "Label_0"}])

    async def test_apply_adds_only_user_ids_to_exact_messages_and_preserves_existing_labels(self) -> None:
        session = client(listing("Promotions"), result("Email abc123 labels updated successfully"))
        outcome = await label_messages.apply_session(session, label_messages.validate_decisions(
            plan(row(), row("def456", decision="skip"), row("ghi789", names=[])), CATALOG), apply=True)
        self.assertEqual(outcome["applied_count"], 1)
        self.assertEqual([r["status"] for r in outcome["results"]], ["applied", "skipped", "no_labels"])
        self.assertEqual(session.call_tool.await_args_list[1].args, ("modify_email", {"messageId": "abc123", "addLabelIds": ["Label_0"]}))
        self.assertEqual(session.call_tool.await_count, 2)

    async def test_any_pending_or_missing_or_conflicting_mapping_blocks_entire_batch(self) -> None:
        for extra, names in ((row("def456", decision="pending"), ("Promotions",)),
                             (row("def456", names=["Newsletters"]), ("Promotions",)),
                             (row("def456"), ("Promotions", "Promotions"))):
            session = client(listing(*names))
            with self.subTest(names=names), self.assertRaises(gmail_mcp.GmailMCPError):
                await label_messages.apply_session(session, label_messages.validate_decisions(plan(row(), extra), CATALOG), apply=True)
            session.call_tool.assert_awaited_once_with("list_email_labels", {})

    async def test_missing_write_capability_prevents_mutation(self) -> None:
        session = client(listing("Promotions"), tools=("list_email_labels",))
        with self.assertRaises(gmail_mcp.GmailMCPError):
            await label_messages.apply_session(session, label_messages.validate_decisions(plan(row()), CATALOG), apply=True)
        self.assertEqual(session.call_tool.await_count, 1)

    async def test_partial_failures_and_wrong_acknowledgements_stop_without_retry_or_false_success(self) -> None:
        for response in (result("PRIVATE_API_ERROR", error=True), result("Email wrong123 labels updated successfully"), ValueError("PRIVATE_API_ERROR")):
            session = client(listing("Promotions"), result("Email abc123 labels updated successfully"), response)
            outcome = await label_messages.apply_session(session, label_messages.validate_decisions(
                plan(row(), row("def456"), row("ghi789")), CATALOG), apply=True)
            self.assertTrue(outcome["failed"])
            self.assertEqual(outcome["applied_count"], 1)
            self.assertEqual([r["status"] for r in outcome["results"]], ["applied", "outcome_unknown", "not_attempted"])
            self.assertNotIn("PRIVATE_API_ERROR", json.dumps(outcome))
            self.assertEqual(session.call_tool.await_count, 3)

    async def test_only_explicit_apply_with_targets_opens_message_write_session(self) -> None:
        observed = []

        @asynccontextmanager
        async def context(settings, *, allow_message_labeling=False):
            observed.append(allow_message_labeling)
            yield client(listing("Promotions"), result("Email abc123 labels updated successfully"))

        with patch.object(gmail_mcp, "open_session", context), patch.object(label_messages, "prepare_plan") as prepare:
            await label_messages.apply_decisions({}, plan(row()), CATALOG)
            await label_messages.apply_decisions({}, plan(row()), CATALOG, apply=True)
            await label_messages.apply_decisions({}, plan(row(decision="skip")), CATALOG, apply=True)
            await label_messages.apply_decisions({}, plan(row(names=[])), CATALOG, apply=True)
            await label_messages.apply_decisions({}, plan(), CATALOG, apply=True)
            with self.assertRaises(ValueError):
                await label_messages.apply_decisions({}, plan(row(decision="pending")), CATALOG, apply=True)
        self.assertEqual(observed, [False, True, False, False, False])
        prepare.assert_not_called()


class CliAndScopeTests(unittest.TestCase):
    def test_modify_scope_required_only_for_message_writes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            oauth = Path(directory) / "client.json"
            credentials = Path(directory) / "credentials.json"
            oauth.write_text(json.dumps({"installed": {"client_id": "fictional", "client_secret": "fictional"}}))
            settings = {"oauth_path": str(oauth), "credentials_path": str(credentials)}
            for scopes, allowed in ((["gmail.readonly"], False), (["gmail.labels"], False),
                                    (["https://www.googleapis.com/auth/gmail.modify"], True),
                                    (["gmail.modify"], True), (["https://mail.google.com/"], True), (None, False)):
                data = {"tokens": {"refresh_token": "fictional"}}
                if scopes is not None:
                    data["scopes"] = scopes
                credentials.write_text(json.dumps(data))
                gmail_mcp.check_credentials(settings)
                if allowed:
                    gmail_mcp.check_credentials(settings, require_message_labeling=True)
                else:
                    with self.assertRaisesRegex(gmail_mcp.GmailMCPError, "gmail.modify"):
                        gmail_mcp.check_credentials(settings, require_message_labeling=True)

    @patch("noemi_mailsort.label_messages.ResultLog")
    def test_review_apply_reads_plan_without_model_or_processing_configuration(self, _log) -> None:
        with patch("sys.argv", ["label_messages", "--review-plan", "/fictional/review.json", "--apply"]), \
                patch.object(label_messages, "load_plan", return_value=plan(row())), \
                patch.object(label_messages, "load_catalog", return_value=CATALOG), \
                patch.object(gmail_mcp, "load_gmail_config", return_value={}), \
                patch.object(label_messages, "apply_decisions", AsyncMock(return_value={"applied_count": 1})) as apply, \
                patch.object(label_messages, "prepare_plan") as prepare, \
                patch.object(ollama, "load_model_config") as model, redirect_stdout(io.StringIO()):
            label_messages.main()
        self.assertTrue(apply.call_args.kwargs["apply"])
        prepare.assert_not_called()
        model.assert_not_called()

    @patch("noemi_mailsort.label_messages.ResultLog")
    def test_no_review_is_preview_unless_apply_is_explicit_and_uses_existing_pipeline(self, _log) -> None:
        for apply in (False, True):
            args = ["label_messages", "--no-review", "--mode", "confidence"] + (["--apply"] if apply else [])
            with patch("sys.argv", args), patch.object(label_messages, "load_catalog", return_value=CATALOG), \
                    patch.object(gmail_mcp, "load_gmail_config", return_value={}), \
                    patch.object(gmail_mcp, "check_credentials") as credentials, \
                    patch.object(label_messages, "load_processing_config", return_value={}), \
                    patch.object(ollama, "load_model_config", return_value={}), \
                    patch.object(label_messages, "prepare_plan", return_value=plan(row(decision="pending"))) as prepare, \
                    patch.object(label_messages, "apply_decisions", AsyncMock(return_value={"results": [{"message_id": "abc123"}]})) as writer, \
                    redirect_stdout(io.StringIO()):
                label_messages.main()
            self.assertEqual(prepare.call_args.args[4], "confidence")
            self.assertEqual(writer.call_args.kwargs["apply"], apply)
            self.assertEqual(writer.call_args.args[1]["messages"][0]["decision"], "approve")
            self.assertEqual(credentials.call_count, int(apply))

    def test_plan_generation_cannot_enable_apply(self) -> None:
        with patch("sys.argv", ["label_messages", "--plan-output", "/fictional/review.json", "--apply"]), \
                patch.object(label_messages, "prepare_plan") as prepare, patch("sys.stderr", io.StringIO()), \
                self.assertRaises(SystemExit) as caught:
            label_messages.main()
        self.assertEqual(caught.exception.code, 2)
        prepare.assert_not_called()
