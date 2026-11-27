"""Essential Gmail MCP boundary checks using fictional labels and credentials."""

import json
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from mcp.types import CallToolResult, TextContent

from noemi_mailsort import gmail_mcp


LABEL_TEXT = (
    "Found 2 labels (1 system, 1 user):\n\nSystem Labels:\n"
    "ID: INBOX\nName: INBOX\n\nUser Labels:\nID: Label_fictional\nName: Példa & Notes\n"
)


def tool_result(text: str = LABEL_TEXT, error: bool = False) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=text)], isError=error)


class GmailTests(unittest.TestCase):
    def test_configuration_validation(self) -> None:
        valid = gmail_mcp.load_gmail_config(Path(__file__).resolve().parents[1] / "config/gmail.example.json")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "gmail.json"
            for field, value in (("timeout_seconds", True), ("timeout_seconds", 0),
                                 ("timeout_seconds", float("nan")), ("timeout_seconds", float("inf")),
                                 ("oauth_path", "relative.json"), ("credentials_path", None),
                                 ("unexpected", "value")):
                with self.subTest(field=field, value=value):
                    path.write_text(json.dumps({**valid, field: value}), encoding="utf-8")
                    with self.assertRaises(gmail_mcp.GmailMCPError):
                        gmail_mcp.load_gmail_config(path)

    def test_credentials_formats_and_missing_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            oauth, token = Path(directory) / "client.json", Path(directory) / "credentials.json"
            settings = {"oauth_path": str(oauth), "credentials_path": str(token)}
            with self.assertRaises(gmail_mcp.GmailMCPError):
                gmail_mcp.check_credentials(settings)
            oauth.write_text(json.dumps({"installed": {"client_id": "fictional", "client_secret": "fictional"}}))
            for credentials in ({"refresh_token": "fictional"},
                                {"tokens": {"refresh_token": "fictional"}, "scopes": ["gmail.readonly"]}):
                token.write_text(json.dumps(credentials))
                gmail_mcp.check_credentials(settings)
            for invalid in ({"token": "fictional", "refresh_token": "fictional", "token_uri": "https://oauth2.googleapis.com/token"},
                            {"tokens": {}}, {"refresh_token": "fictional", "scopes": "gmail.readonly"}):
                token.write_text(json.dumps(invalid))
                with self.assertRaises(gmail_mcp.GmailMCPError):
                    gmail_mcp.check_credentials(settings)

    def test_only_user_label_ids_are_returned_with_unicode(self) -> None:
        expected = [{"id": "Label_fictional", "name": "Példa & Notes", "type": "user"}]
        for text in (LABEL_TEXT, "<untrusted-tool-output>\n" + LABEL_TEXT + "\n</untrusted-tool-output>"):
            self.assertEqual(gmail_mcp.parse_label_result(tool_result(text)), expected)

    def test_system_labels_never_count_as_user_labels(self) -> None:
        text = (
            "Found 3 labels (3 system, 0 user):\n\nSystem Labels:\n"
            "ID: INBOX\nName: INBOX\n\nID: UNREAD\nName: UNREAD\n\n"
            "ID: CATEGORY_PROMOTIONS\nName: Promotions\n\nUser Labels:\n"
        )
        self.assertEqual(gmail_mcp.parse_label_result(tool_result(text)), [])

    def test_empty_account_is_a_valid_result(self) -> None:
        text = "Found 0 labels (0 system, 0 user):\n\nSystem Labels:\n\nUser Labels:\n"
        self.assertEqual(gmail_mcp.parse_label_result(tool_result(text)), [])

    def test_failed_malformed_or_incomplete_results_are_not_empty_success(self) -> None:
        for text in ("", "private server error", LABEL_TEXT.replace("Found 2", "Found 3"),
                     LABEL_TEXT.replace("Name: INBOX\n", ""),
                     LABEL_TEXT.replace("Label_fictional", "INBOX"), LABEL_TEXT + "unexpected\n"):
            with self.subTest(text=text), self.assertRaises(gmail_mcp.GmailMCPError):
                gmail_mcp.parse_label_result(tool_result(text))
        with self.assertRaises(gmail_mcp.GmailMCPError) as caught:
            gmail_mcp.parse_label_result(tool_result("private response", error=True))
        self.assertNotIn("private response", str(caught.exception))

    def test_diagnostics_do_not_echo_untrusted_exception_text(self) -> None:
        for error in (ValueError("private token"), ExceptionGroup("private", [ValueError("private token")])):
            self.assertNotIn("private", gmail_mcp.safe_diagnostic(error))
        error = ExceptionGroup("private", [gmail_mcp.GmailMCPError("Safe diagnostic")])
        self.assertEqual(gmail_mcp.safe_diagnostic(error), "Safe diagnostic")

    def test_rejected_tokens_report_a_safe_actionable_oauth_reason(self) -> None:
        for code in ("invalid_grant", "invalid_client"):
            with self.subTest(code=code), self.assertRaises(gmail_mcp.GmailMCPError) as caught:
                gmail_mcp.parse_label_result(tool_result(f"{code}: private response", error=True))
            self.assertIn(code, str(caught.exception))
            self.assertNotIn("private response", str(caught.exception))


class SessionTests(unittest.IsolatedAsyncioTestCase):
    def session(self, names: list[str]) -> AsyncMock:
        session = AsyncMock()
        session.initialize.return_value = SimpleNamespace(serverInfo=SimpleNamespace(name="fictional", version="1"))
        session.list_tools.return_value = SimpleNamespace(tools=[SimpleNamespace(name=name) for name in names], nextCursor=None)
        session.call_tool.return_value = tool_result()
        return session

    async def test_discovery_calls_only_label_listing_even_if_writes_are_available(self) -> None:
        session = self.session(["list_email_labels", "modify_email", "read_email", "create_label"])
        result = await gmail_mcp.inspect_session(session)
        self.assertEqual(result["user_label_count"], 1)
        self.assertEqual(result["labels"], [{"id": "Label_fictional", "name": "Példa & Notes", "type": "user"}])
        session.call_tool.assert_awaited_once_with("list_email_labels", {})
        session.initialize.assert_awaited_once()

    async def test_missing_label_tool_stops_before_any_tool_call(self) -> None:
        session = self.session(["read_email"])
        with self.assertRaisesRegex(gmail_mcp.GmailMCPError, "unavailable"):
            await gmail_mcp.inspect_session(session)
        session.call_tool.assert_not_awaited()

    async def test_discovery_handles_pagination(self) -> None:
        session = self.session([])
        session.list_tools.side_effect = [
            SimpleNamespace(tools=[SimpleNamespace(name="read_email")], nextCursor="second"),
            SimpleNamespace(tools=[SimpleNamespace(name="list_email_labels")], nextCursor=None),
        ]
        result = await gmail_mcp.inspect_session(session)
        self.assertEqual(result["available_tools"], ["list_email_labels", "read_email"])
        self.assertEqual(session.list_tools.await_args_list[1].kwargs, {"cursor": "second"})

    async def test_connection_timeout_covers_server_startup(self) -> None:
        @asynccontextmanager
        async def stalled_transport(*args, **kwargs):
            import asyncio
            await asyncio.sleep(10)
            yield None

        with patch.object(gmail_mcp, "check_credentials"), patch.object(gmail_mcp, "stdio_client", stalled_transport):
            with self.assertRaises(TimeoutError):
                await gmail_mcp.connection_check({"oauth_path": "/fictional/client", "credentials_path": "/fictional/token", "timeout_seconds": 0.01})

    async def test_server_write_guard_stays_on_unless_label_creation_is_explicit(self) -> None:
        settings = {"oauth_path": "/fictional/client", "credentials_path": "/fictional/token", "timeout_seconds": 1}
        for options, expected in (({}, "true"), ({"allow_label_creation": True}, "false"),
                                  ({"allow_message_labeling": True}, "false")):
            with self.subTest(options=options), patch.object(gmail_mcp, "check_credentials"), \
                    patch.object(gmail_mcp, "stdio_client") as transport, patch.object(gmail_mcp, "ClientSession"):
                transport.return_value.__aenter__.return_value = (object(), object())
                async with gmail_mcp.open_session(settings, **options):
                    pass
                self.assertEqual(transport.call_args.args[0].env["GMAIL_MCP_DRY_RUN"], expected)
