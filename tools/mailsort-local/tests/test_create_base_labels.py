"""Essential opt-in label creation checks with fictional Gmail responses only."""

import io
import json
import unittest
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from mcp.types import CallToolResult, TextContent

from noemi_mailsort import create_base_labels, gmail_mcp
from noemi_mailsort.prompts import load_catalog


NAMES = [label["name"] for label in load_catalog(create_base_labels.BASE_CATALOG)["labels"]]


def result(text: str, error: bool = False) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text="<untrusted-tool-output>\n" + text + "\n</untrusted-tool-output>")], isError=error)


def listing(names: list[str]) -> CallToolResult:
    users = "\n".join(f"ID: Label_{NAMES.index(name)}\nName: {name}\n" for name in names)
    text = f"Found {len(names) + 1} labels (1 system, {len(names)} user):\n\nSystem Labels:\nID: CATEGORY_PROMOTIONS\nName: Promotions\n\nUser Labels:\n" + users
    return result(text)


def session(responses: list[CallToolResult], *, writable: bool = True) -> AsyncMock:
    client = AsyncMock()
    client.initialize.return_value = SimpleNamespace(serverInfo=SimpleNamespace(name="gmail", version="3.0.0"))
    tools = ["list_email_labels", "create_label", "modify_email"] if writable else ["list_email_labels"]
    client.list_tools.return_value = SimpleNamespace(tools=[SimpleNamespace(name=name) for name in tools], nextCursor=None)
    client.call_tool.side_effect = responses
    return client


class SetupTests(unittest.IsolatedAsyncioTestCase):
    async def test_preview_never_creates_and_system_category_does_not_satisfy_user_label(self) -> None:
        client = session([listing([])], writable=False)
        plan = await create_base_labels.setup_session(client)
        self.assertTrue(plan["dry_run"])
        self.assertFalse(plan["can_create"])
        self.assertEqual(plan["missing_count"], 5)
        self.assertTrue(all(row["action"] == "would_create" and row["id"] is None for row in plan["labels"]))
        client.call_tool.assert_awaited_once_with("list_email_labels", {})

    async def test_apply_creates_only_missing_base_names_then_verifies_ids(self) -> None:
        existing = NAMES[:-1]
        missing = NAMES[-1]
        client = session([listing(existing), result(f"Label created successfully:\nID: Label_4\nName: {missing}\nType: user"), listing(NAMES)])
        outcome = await create_base_labels.setup_session(client, apply=True)
        self.assertEqual(outcome["created_count"], 1)
        self.assertEqual(outcome["existing_count"], 4)
        calls = client.call_tool.await_args_list
        self.assertEqual([call.args[0] for call in calls], ["list_email_labels", "create_label", "list_email_labels"])
        self.assertEqual(calls[1].args[1], {"name": missing})
        self.assertEqual(outcome["labels"][-1]["id"], "Label_4")

    async def test_verified_creation_emits_one_json_audit_record_per_label(self) -> None:
        missing = NAMES[-1]
        client = session([listing(NAMES[:-1]), result(f"Label created successfully:\nID: Label_4\nName: {missing}\nType: user"), listing(NAMES)])
        with patch("sys.stderr", io.StringIO()) as stderr:
            await create_base_labels.setup_session(client, apply=True)
        records = [json.loads(line) for line in stderr.getvalue().splitlines()]
        self.assertEqual(len(records), 1)
        self.assertLessEqual({"task", "inputs", "actions", "risks", "result"}, set(records[0]))
        self.assertEqual(records[0]["inputs"], [{"label_name": missing}])
        self.assertEqual(records[0]["actions"], [{"created_label_id": "Label_4"}])
        self.assertEqual(records[0]["result"], "created")

    async def test_preview_and_unverified_creation_emit_no_created_records(self) -> None:
        with patch("sys.stderr", io.StringIO()) as stderr:
            await create_base_labels.setup_session(session([listing([])], writable=False))
            client = session([listing(NAMES[:-1]), result(f"Label created successfully:\nID: Label_4\nName: {NAMES[-1]}\nType: user"), listing(NAMES[:-1])])
            with self.assertRaises(gmail_mcp.GmailMCPError):
                await create_base_labels.setup_session(client, apply=True)
        self.assertEqual(stderr.getvalue(), "")

    async def test_rerunning_with_existing_labels_performs_no_writes(self) -> None:
        client = session([listing(NAMES)], writable=False)
        outcome = await create_base_labels.setup_session(client, apply=True)
        self.assertEqual(outcome["created_count"], 0)
        self.assertEqual(outcome["existing_count"], 5)
        client.call_tool.assert_awaited_once_with("list_email_labels", {})

    async def test_missing_write_tool_stops_before_creation(self) -> None:
        client = session([listing([])], writable=False)
        with self.assertRaisesRegex(gmail_mcp.GmailMCPError, "create_label is unavailable"):
            await create_base_labels.setup_session(client, apply=True)
        self.assertEqual(client.call_tool.await_count, 1)

    async def test_failed_or_wrong_creation_response_stops_without_message_operations(self) -> None:
        for response in (result("private server response", error=True), result("Label created successfully:\nID: Label_4\nName: Wrong\nType: user")):
            client = session([listing(NAMES[:-1]), response])
            with self.assertRaises(gmail_mcp.GmailMCPError):
                await create_base_labels.setup_session(client, apply=True)
            self.assertEqual([call.args[0] for call in client.call_tool.await_args_list], ["list_email_labels", "create_label"])

    async def test_success_requires_created_ids_in_the_final_account_listing(self) -> None:
        client = session([listing(NAMES[:-1]), result(f"Label created successfully:\nID: Label_4\nName: {NAMES[-1]}\nType: user"), listing(NAMES[:-1])])
        with self.assertRaisesRegex(gmail_mcp.GmailMCPError, "could not be verified"):
            await create_base_labels.setup_session(client, apply=True)

    async def test_missing_create_response_type_requires_user_type_from_fresh_listing(self) -> None:
        for label_type in ("undefined", "null"):
            with self.subTest(label_type=label_type):
                client = session([listing(NAMES[:-1]), result(f"Label created successfully:\nID: Label_4\nName: {NAMES[-1]}\nType: {label_type}"), listing(NAMES)])
                outcome = await create_base_labels.setup_session(client, apply=True)
                self.assertEqual(outcome["created_count"], 1)
                self.assertEqual(client.call_tool.await_args_list[-1].args[0], "list_email_labels")

    async def test_only_apply_opens_a_creation_enabled_session(self) -> None:
        observed = []

        @asynccontextmanager
        async def context(settings, *, allow_label_creation=False):
            observed.append(allow_label_creation)
            yield session([listing(NAMES)])

        with patch.object(gmail_mcp, "open_session", context):
            await create_base_labels.setup_base_labels({})
            await create_base_labels.setup_base_labels({}, apply=True)
        self.assertEqual(observed, [False, True])
