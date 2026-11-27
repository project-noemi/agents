"""Persistent CSV checks using fictional messages and no network access."""

import asyncio
import csv
import io
import json
import tempfile
import unittest
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from unittest.mock import AsyncMock, patch

from noemi_mailsort import automatic, gmail_mcp, label_messages, processing_state
from noemi_mailsort.prompts import DEFAULT_PROMPT_DIR
from noemi_mailsort.results_csv import FIELDS, ResultLog
from test_label_messages import CATALOG, client, listing, plan, result, row


ROOT = Path(__file__).resolve().parents[1]


def read_rows(path):
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


class CsvTests(unittest.TestCase):
    def test_appends_across_logger_recreation_with_one_header_and_private_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            for source in ("manual", "automatic"):
                log = ResultLog(path, source, model="fictional", mode="confidence", apply=True)
                log.predictions = {"abc123": {"Promotions": 0.9}}
                log.record({"message_id": "abc123", "selected_labels": ["Promotions"], "status": "applied"})
            rows = read_rows(path)
            self.assertEqual([r["source"] for r in rows], ["manual", "automatic"])
            self.assertEqual(json.loads(rows[-1]["prediction"]), {"Promotions": 0.9})
            self.assertEqual(json.loads(rows[-1]["applied_labels"]), ["Promotions"])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(path.read_text().count(",".join(FIELDS)), 1)

    def test_unicode_quotes_newlines_and_preview_do_not_claim_applied_labels(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            log = ResultLog(path, "manual")
            log.predictions = {"a": ['Ár, "akció"']}
            log.record({"message_id": "a", "selected_labels": ['Ár, "akció"'],
                        "status": "would_apply", "error": "first line\nsecond line"})
            saved = read_rows(path)[0]
            self.assertEqual(json.loads(saved["prediction"]), ['Ár, "akció"'])
            self.assertEqual(saved["error"], "first line\nsecond line")
            self.assertEqual(saved["dry_run"], "true")
            self.assertEqual(saved["applied_labels"], "[]")

    def test_incompatible_header_is_rejected_and_unexpected_errors_are_sanitized(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            log = ResultLog(path, "automatic")
            log.error(RuntimeError("PRIVATE_SERVER_RESPONSE"))
            self.assertNotIn("PRIVATE_SERVER_RESPONSE", path.read_text())
            self.assertEqual(read_rows(path)[0]["message_id"], "")
            path.write_text("wrong,header\n")
            with self.assertRaisesRegex(ValueError, "header"):
                ResultLog(path, "manual")


class AuditLogTests(unittest.TestCase):
    def test_each_csv_row_has_a_matching_json_audit_record_on_stderr(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            with patch("sys.stderr", io.StringIO()) as stderr:
                log = ResultLog(path, "automatic", model="fictional", mode="confidence", apply=True)
                log.predictions = {"abc123": {"Promotions": 0.9}}
                log.record({"message_id": "abc123", "selected_labels": ["Promotions"], "status": "applied",
                            "sender": "shop@example.com", "subject": "PRIVATE_SUBJECT"})
                log.record({"message_id": "def456", "selected_labels": ["Promotions"], "status": "blocked",
                            "mapping_problems": [{"name": "Promotions", "reason": "missing"}]})
            records = [json.loads(line) for line in stderr.getvalue().splitlines()]
            self.assertEqual(len(records), len(read_rows(path)))
            for record in records:
                self.assertLessEqual({"task", "inputs", "actions", "risks", "result"}, set(record))
                self.assertEqual(record["source"], "automatic")
            applied, blocked = records
            self.assertEqual(applied["result"], "applied")
            self.assertEqual(applied["inputs"][0]["message_id"], "abc123")
            self.assertEqual(applied["inputs"][0]["prediction"], {"Promotions": 0.9})
            self.assertFalse(applied["inputs"][0]["dry_run"])
            self.assertEqual(applied["actions"], [{"selected_labels": ["Promotions"], "applied_labels": ["Promotions"]}])
            self.assertEqual(applied["risks"], [])
            self.assertEqual(blocked["actions"][0]["applied_labels"], [])
            self.assertEqual(blocked["risks"], ["Selected Gmail labels are missing or ambiguous"])
            self.assertNotIn("PRIVATE_SUBJECT", stderr.getvalue())
            self.assertNotIn("shop@example.com", stderr.getvalue())

    def test_run_errors_are_audited_with_the_sanitized_message_only(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("sys.stderr", io.StringIO()) as stderr:
                ResultLog(Path(directory) / "results.csv", "manual").error(RuntimeError("PRIVATE_SERVER_RESPONSE"))
            record = json.loads(stderr.getvalue())
            self.assertEqual(record["result"], "error")
            self.assertEqual(record["risks"], ["Processing failed; inspect the worker logs"])
            self.assertNotIn("PRIVATE_SERVER_RESPONSE", stderr.getvalue())


class WorkflowCsvTests(unittest.IsolatedAsyncioTestCase):
    async def test_manual_partial_failure_records_success_unknown_and_unattempted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            log = ResultLog(path, "manual", apply=True)
            log.predictions = {"abc123": {"Promotions": 0.8}}
            session = client(listing("Promotions"), result("Email abc123 labels updated successfully"),
                             result("PRIVATE_API_RESPONSE", error=True))

            @asynccontextmanager
            async def opened(*args, **kwargs):
                yield session

            with patch.object(gmail_mcp, "open_session", opened):
                outcome = await label_messages.apply_decisions({}, plan(
                    row(), row("second"), row("third")), CATALOG, apply=True, result_log=log)
            self.assertTrue(outcome["failed"])
            saved = read_rows(path)
            self.assertEqual([r["status"] for r in saved], ["applied", "outcome_unknown", "not_attempted"])
            self.assertEqual([json.loads(r["applied_labels"]) for r in saved], [["Promotions"], [], []])
            self.assertNotIn("PRIVATE_API_RESPONSE", path.read_text())
            self.assertTrue(saved[1]["error"])

    async def test_blocked_preview_and_live_no_match_are_recorded_without_false_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            preview = ResultLog(path, "manual")
            await label_messages.apply_session(client(listing()),
                [{"message_id": "blocked", "decision": "approve", "selected_labels": ["Promotions"]}],
                on_result=preview.record)
            completed = []
            live = ResultLog(path, "manual", apply=True)
            await label_messages.apply_session(client(listing()),
                [{"message_id": "none", "decision": "approve", "selected_labels": []}], apply=True,
                on_result=live.record, on_completed=completed.append)
            self.assertEqual(completed, ["none"])
            self.assertEqual([r["status"] for r in read_rows(path)], ["blocked", "no_labels"])
            self.assertTrue(all(r["applied_labels"] == "[]" for r in read_rows(path)))

    async def test_cancelled_write_preserves_earlier_acknowledgement_and_unknown_current_message(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "results.csv"
            log = ResultLog(path, "manual", apply=True)
            session = client(listing("Promotions"), result("Email abc123 labels updated successfully"),
                             asyncio.CancelledError())
            with self.assertRaises(asyncio.CancelledError):
                await label_messages.apply_session(session, label_messages.validate_decisions(
                    plan(row(), row("second"), row("third")), CATALOG), apply=True, on_result=log.record)
            self.assertEqual([r["status"] for r in read_rows(path)],
                             ["applied", "outcome_unknown", "not_attempted"])

    async def test_csv_write_failure_stops_before_next_gmail_write(self):
        session = client(listing("Promotions"), result("Email abc123 labels updated successfully"))
        def broken_log(outcome):
            raise OSError("Disk unavailable")
        with self.assertRaises(OSError):
            await label_messages.apply_session(session, label_messages.validate_decisions(
                plan(row(), row("second")), CATALOG), apply=True, on_result=broken_log)
        self.assertEqual(session.call_tool.await_count, 2)


class AutomaticCsvTests(unittest.TestCase):
    def test_automatic_cycle_records_acknowledged_labels_and_completion_using_shared_writer(self):
        settings = automatic.load_automatic_config(ROOT / "config/automatic.example.json")
        session = client(listing("Promotions"), result("Email abc123 labels updated successfully"))

        @asynccontextmanager
        async def opened(*args, **kwargs):
            yield session

        @contextmanager
        def classifier(*args):
            yield lambda emails: [{"prediction": {"Promotions": 0.9}, "eligible_labels": ["Promotions"]}]

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = processing_state.load_state(root)
            with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["abc123"])), \
                    patch.object(gmail_mcp, "fetch_message_ids", AsyncMock(return_value=[{
                        "id": "abc123", "email": {"body": "PRIVATE_BODY"}}])), \
                    patch.object(gmail_mcp, "open_session", opened), \
                    patch.object(automatic, "classification_run", classifier):
                summary = automatic.run_cycle(settings, {}, {"model": "fictional", "body_max_characters": 1000},
                    CATALOG, "confidence", DEFAULT_PROMPT_DIR, state, root, apply=True)
            self.assertEqual(summary["applied_count"], 1)
            saved = read_rows(root / "results.csv")[0]
            self.assertEqual((saved["source"], saved["status"], saved["dry_run"]), ("automatic", "applied", "false"))
            self.assertIn("abc123", processing_state.load_state(root)["completed"])
            self.assertNotIn("PRIVATE_BODY", (root / "results.csv").read_text())

    def test_retrieval_failure_is_recorded_as_run_error_without_completion(self):
        settings = automatic.load_automatic_config(ROOT / "config/automatic.example.json")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = processing_state.load_state(root)
            with patch.object(gmail_mcp, "search_time_window", AsyncMock(side_effect=RuntimeError("PRIVATE_RESPONSE"))):
                with self.assertRaises(RuntimeError):
                    automatic.run_cycle(settings, {}, {}, CATALOG, "labels", DEFAULT_PROMPT_DIR, state, root, apply=True)
            saved = read_rows(root / "results.csv")[0]
            self.assertEqual((saved["status"], saved["message_id"]), ("error", ""))
            self.assertNotIn("PRIVATE_RESPONSE", (root / "results.csv").read_text())
            self.assertEqual(state["completed"], {})
