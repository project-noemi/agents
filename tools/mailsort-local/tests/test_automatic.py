"""Essential automatic processing checks with fake time, Gmail, and model calls."""

import asyncio
import csv
import json
import stat
import tempfile
import unittest
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from noemi_mailsort import automatic, gmail_mcp, label_messages, ollama, processing_state
from noemi_mailsort.prompts import DEFAULT_PROMPT_DIR, load_catalog


ROOT = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 10, 30, 12, tzinfo=timezone.utc)


@contextmanager
def fake_classification_run(*args):
    yield lambda emails: [{"prediction": {}, "eligible_labels": []} for email in emails]


class SettingsAndStateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = automatic.load_automatic_config(ROOT / "config/automatic.example.json")

    def test_settings_validate_daily_interval_limits_and_dates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "automatic.json"
            good = {**self.settings, "timezone": "Europe/Budapest", "schedule": {"type": "daily", "time": "02:00"},
                    "initial_since": "2026-10-15", "max_messages_per_run": None}
            path.write_text(json.dumps(good))
            self.assertEqual(automatic.load_automatic_config(path), good)
            for change in ({"schedule": {"type": "daily", "time": "2:00"}}, {"schedule": {"type": "daily", "time": "24:00"}},
                           {"schedule": {"type": "interval", "minutes": True}}, {"schedule": {"type": "interval", "minutes": 0}},
                           {"timezone": "Unknown/Zone"}, {"batch_size": 501}, {"max_messages_per_run": 0},
                           {"lookback_hours": False}, {"initial_since": "2026-02-30"}, {"initial_since": "20261015"}, {"query": ""}):
                path.write_text(json.dumps({**good, **change}))
                with self.subTest(change=change), self.assertRaises(ValueError):
                    automatic.load_automatic_config(path)

    def test_private_state_is_atomic_and_corruption_is_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = processing_state.load_state(root)
            state["completed"]["abc123"] = NOW.isoformat()
            processing_state.save_state(root, state)
            self.assertEqual(processing_state.load_state(root), state)
            self.assertEqual(stat.S_IMODE((root / "processing.json").stat().st_mode), 0o600)
            self.assertEqual(len(list(root.iterdir())), 1)
            (root / "processing.json").write_text("broken private data")
            with self.assertRaisesRegex(ValueError, "Cannot load processing state"):
                processing_state.load_state(root)

    def test_lock_blocks_overlapping_jobs_and_is_released_after_errors(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with processing_state.processing_lock(root):
                with self.assertRaisesRegex(ValueError, "Another processing job"):
                    with processing_state.processing_lock(root):
                        self.fail("Overlapping lock was acquired")
            with self.assertRaises(RuntimeError):
                with processing_state.processing_lock(root):
                    raise RuntimeError("test")
            with processing_state.processing_lock(root):
                pass

    def test_daily_schedule_handles_restart_and_both_daylight_saving_changes(self) -> None:
        settings = {**self.settings, "timezone": "Europe/Budapest", "schedule": {"type": "daily", "time": "02:00"}}
        state = {"last_daily_date": None}
        self.assertFalse(automatic.due(settings, state, datetime(2026, 10, 30, 0, 59, tzinfo=timezone.utc)))
        self.assertTrue(automatic.due(settings, state, datetime(2026, 10, 30, 1, 0, tzinfo=timezone.utc)))
        state["last_daily_date"] = "2026-10-30"
        self.assertFalse(automatic.due(settings, state, NOW))
        state["last_daily_date"] = None
        self.assertTrue(automatic.due(settings, state, datetime(2027, 3, 28, 1, 0, tzinfo=timezone.utc)))
        self.assertTrue(automatic.due(settings, state, datetime(2027, 10, 31, 0, 0, tzinfo=timezone.utc)))
        state["last_daily_date"] = "2027-10-31"
        self.assertFalse(automatic.due(settings, state, datetime(2027, 10, 31, 1, 0, tzinfo=timezone.utc)))

    def test_interval_and_initial_local_midnight_and_rolling_24_hour_window(self) -> None:
        state = {"last_interval_at": NOW.isoformat(), "initial_completed_for": None}
        self.assertFalse(automatic.due(self.settings, state, NOW + timedelta(minutes=59)))
        self.assertTrue(automatic.due(self.settings, state, NOW + timedelta(minutes=60)))
        settings = {**self.settings, "timezone": "Europe/Budapest", "initial_since": "2026-10-15"}
        start, end = automatic.window(settings, state, NOW)
        self.assertEqual(datetime.fromtimestamp(start, timezone.utc), datetime(2026, 10, 14, 22, tzinfo=timezone.utc))
        self.assertEqual(end, int(NOW.timestamp()))
        state["initial_completed_for"] = "2026-10-15"
        self.assertEqual(automatic.window(settings, state, NOW), (int((NOW - timedelta(hours=24)).timestamp()), end))

    def test_capped_initial_pass_waits_for_next_schedule_instead_of_immediately_looping(self) -> None:
        settings = {**self.settings, "timezone": "Europe/Budapest", "schedule": {"type": "daily", "time": "02:00"},
                    "initial_since": "2026-10-15"}
        event = Mock()
        event.is_set.side_effect = [False, False, True]
        with tempfile.TemporaryDirectory() as directory, \
                patch("sys.argv", ["automatic", "--state-dir", directory, "--apply"]), \
                patch.object(automatic, "load_automatic_config", return_value=settings), \
                patch.object(gmail_mcp, "load_gmail_config", return_value={}), \
                patch.object(gmail_mcp, "check_credentials"), patch.object(automatic, "load_catalog", return_value={}), \
                patch.object(automatic, "render_prompt"), patch.object(automatic.ollama, "load_model_config", return_value={}), \
                patch.object(automatic.threading, "Event", return_value=event), \
                patch.object(automatic, "datetime", wraps=datetime) as clock, \
                patch.object(automatic, "run_cycle", return_value={}) as cycle, patch.object(automatic.signal, "signal"):
            clock.now.return_value = NOW
            automatic.main()
            self.assertEqual(cycle.call_count, 1)
            self.assertIsNone(processing_state.load_state(Path(directory))["initial_completed_for"])

    def test_manual_apply_obeys_the_same_lock_before_reading_mail(self) -> None:
        with tempfile.TemporaryDirectory() as directory, processing_state.processing_lock(Path(directory)), \
                patch.dict("os.environ", {"MAILSORT_STATE_DIR": directory}), \
                patch("sys.argv", ["label_messages", "--no-review", "--apply"]), \
                patch.object(label_messages, "prepare_plan") as prepare, patch("sys.stderr", Mock()), \
                self.assertRaises(SystemExit) as caught:
            label_messages.main()
        self.assertEqual(caught.exception.code, 2)
        prepare.assert_not_called()


class SearchTests(unittest.IsolatedAsyncioTestCase):
    async def test_saturated_search_is_split_and_boundary_ids_are_deduplicated(self) -> None:
        session = AsyncMock()

        @asynccontextmanager
        async def context(settings):
            yield session

        with patch.object(gmail_mcp, "open_session", context), \
                patch.object(gmail_mcp, "discover_tools", AsyncMock(return_value={"available_tools": ["search_emails"]})), \
                patch.object(gmail_mcp, "parse_search_result", side_effect=[[str(n) for n in range(500)], ["new", "boundary"], ["boundary", "old"]]):
            ids = await gmail_mcp.search_time_window({}, "has:nouserlabels", 100, 200)
        self.assertEqual(ids, ["new", "boundary", "old"])
        queries = [call.args[1]["query"] for call in session.call_tool.await_args_list]
        self.assertEqual(queries, ["(has:nouserlabels) after:99 before:200", "(has:nouserlabels) after:149 before:200", "(has:nouserlabels) after:99 before:150"])
        self.assertTrue(all(call.args[0] == "search_emails" for call in session.call_tool.await_args_list))

    async def test_unsplittable_saturation_is_an_error_not_false_completion(self) -> None:
        @asynccontextmanager
        async def context(settings):
            yield AsyncMock()

        with patch.object(gmail_mcp, "open_session", context), \
                patch.object(gmail_mcp, "discover_tools", AsyncMock(return_value={"available_tools": ["search_emails"]})), \
                patch.object(gmail_mcp, "parse_search_result", return_value=[str(n) for n in range(500)]):
            with self.assertRaisesRegex(gmail_mcp.GmailMCPError, "saturated within one second"):
                await gmail_mcp.search_time_window({}, "has:nouserlabels", 100, 101)


class CycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = automatic.load_automatic_config(ROOT / "config/automatic.example.json")
        self.catalog = load_catalog(ROOT / "config/labels.example.json")
        self.model = {"body_max_characters": 1000}
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.state = processing_state.load_state(self.root)

    def cycle(self, **kwargs):
        return automatic.run_cycle(self.settings, {}, self.model, self.catalog, "confidence", DEFAULT_PROMPT_DIR,
                                   self.state, self.root, now=NOW, **kwargs)

    def test_completed_and_empty_searches_skip_body_reads_and_model_calls(self) -> None:
        self.state["completed"]["done"] = NOW.isoformat()
        for ids in ([], ["done"]):
            with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=ids)), \
                    patch.object(gmail_mcp, "fetch_message_ids") as fetch, patch.object(automatic, "classification_run") as classify:
                result = self.cycle()
            self.assertEqual(result["selected_count"], 0)
            fetch.assert_not_called()
            classify.assert_not_called()

    def test_batches_limit_the_total_and_only_live_successes_record_no_match_completion(self) -> None:
        self.settings.update({"batch_size": 2, "max_messages_per_run": 3, "initial_since": "2026-10-15"})
        fetches = []

        async def fetch(settings, ids, maximum):
            fetches.append(ids)
            return [{"id": message_id, "email": {"sender": "private", "subject": "private", "body": "PRIVATE_BODY"}} for message_id in ids]

        @asynccontextmanager
        async def context(settings, **kwargs):
            yield object()

        async def apply_batch(session, decisions, *, apply=False, on_completed=None, on_result=None):
            if on_completed:
                for decision in decisions:
                    on_completed(decision["message_id"])
            return {"ready": True, "applied_count": 0, "results": [{**d, "status": "no_labels", "mapping_problems": []} for d in decisions]}

        with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["a", "b", "c", "d"])), \
                patch.object(gmail_mcp, "fetch_message_ids", side_effect=fetch), patch.object(gmail_mcp, "open_session", context), \
                patch.object(automatic, "classification_run", side_effect=fake_classification_run), \
                patch.object(automatic, "apply_session", side_effect=apply_batch):
            preview = self.cycle()
            self.assertEqual(self.state["completed"], {})
            self.assertFalse((self.root / "processing.json").exists())
            self.assertEqual(preview["selected_count"], 3)
            result = self.cycle(apply=True)
        self.assertEqual(fetches, [["a", "b"], ["c"], ["a", "b"], ["c"]])
        self.assertEqual(result["completed_count"], 3)
        self.assertEqual(set(processing_state.load_state(self.root)["completed"]), {"a", "b", "c"})
        self.assertIsNone(self.state["initial_completed_for"])
        self.assertNotIn("PRIVATE_BODY", (self.root / "processing.json").read_text())

    def test_complete_empty_initial_run_finishes_but_preview_does_not(self) -> None:
        self.settings["initial_since"] = "2026-10-15"
        with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=[])):
            self.cycle()
            self.assertIsNone(self.state["initial_completed_for"])
            self.cycle(apply=True)
        self.assertEqual(self.state["initial_completed_for"], "2026-10-15")

    def test_invalid_prediction_stops_before_any_message_completion(self) -> None:
        @contextmanager
        def invalid_run(*args):
            yield Mock(side_effect=ValueError("Invalid prediction"))

        with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["a"])), \
                patch.object(gmail_mcp, "fetch_message_ids", AsyncMock(return_value=[{"id": "a", "email": {}}])), \
                patch.object(automatic, "classification_run", side_effect=invalid_run), \
                patch.object(automatic, "apply_session") as apply:
            with self.assertRaisesRegex(ValueError, "Invalid prediction"):
                self.cycle(apply=True)
        apply.assert_not_called()
        self.assertEqual(self.state["completed"], {})

    def test_each_batch_is_labeled_before_next_fetch_with_one_unload_at_end(self) -> None:
        self.settings.update({"batch_size": 2, "max_messages_per_run": None})
        self.model = ollama.load_model_config(ROOT / "config/model.example.json")
        events = []

        async def fetch(settings, ids, maximum):
            events.append("fetch:" + ",".join(ids))
            return [{"id": message_id, "email": {"sender": "example", "subject": "example", "body": "private body"}} for message_id in ids]

        def chat(*args):
            events.append("chat")
            return json.dumps({"scores": {label["name"]: 0.9 if label["name"] == "Promotions" else 0.1 for label in self.catalog["labels"]}})

        @asynccontextmanager
        async def context(settings, **kwargs):
            yield object()

        async def apply_predictions(session, decisions, *, apply=False, on_completed=None, on_result=None):
            events.append("apply:" + ",".join(d["message_id"] for d in decisions))
            for decision in decisions:
                on_result({**decision, "status": "applied"})
                on_completed(decision["message_id"])
            return {"ready": True, "applied_count": len(decisions), "results": [{**d, "status": "applied", "mapping_problems": []} for d in decisions]}

        with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["a", "b", "c"])), \
                patch.object(gmail_mcp, "fetch_message_ids", side_effect=fetch), patch.object(gmail_mcp, "open_session", context), \
                patch.object(ollama, "verify_model", side_effect=lambda *args: events.append("verify")), \
                patch.object(ollama, "chat", side_effect=chat), \
                patch.object(ollama, "unload_model", side_effect=lambda *args: events.append("unload")), \
                patch.object(automatic, "apply_session", side_effect=apply_predictions):
            summary = self.cycle(apply=True)
        self.assertEqual(events, ["fetch:a,b", "verify", "chat", "chat", "apply:a,b", "fetch:c", "chat", "apply:c", "unload"])
        self.assertEqual(summary["applied_count"], 3)
        self.assertEqual(set(processing_state.load_state(self.root)["completed"]), {"a", "b", "c"})
        with (self.root / "results.csv").open() as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual([row["message_id"] for row in rows], ["a", "b", "c"])
        self.assertTrue(all(json.loads(row["prediction"])["Promotions"] == 0.9 for row in rows))

    def test_late_classification_retrieval_and_interrupt_failures_preserve_progress_and_retry_only_pending(self) -> None:
        self.settings.update({"batch_size": 1, "max_messages_per_run": None, "initial_since": "2026-10-15"})
        self.model = ollama.load_model_config(ROOT / "config/model.example.json")
        response = json.dumps({"scores": {label["name"]: 0.1 for label in self.catalog["labels"]}})
        def messages(message_id):
            return [{"id": message_id, "email": {"sender": "example", "subject": "example", "body": "private body"}}]

        @asynccontextmanager
        async def context(settings, **kwargs):
            yield object()

        async def apply_batch(session, decisions, *, apply=False, on_completed=None, on_result=None):
            for decision in decisions:
                on_result({**decision, "status": "no_labels"})
                on_completed(decision["message_id"])
            return {"ready": True, "applied_count": 0, "results": [{**d, "status": "no_labels", "mapping_problems": []} for d in decisions]}

        root = self.root
        for failure in ("prediction", "retrieval", "interrupt"):
            self.root = root / failure
            self.root.mkdir()
            self.state = processing_state.load_state(self.root)
            answers = [response, "invalid JSON"] if failure == "prediction" else [response, KeyboardInterrupt()]
            fetches = [messages("a"), ValueError("Retrieval failed")] if failure == "retrieval" else [messages("a"), messages("b")]
            with self.subTest(failure=failure), \
                    patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["a", "b"])), \
                    patch.object(gmail_mcp, "fetch_message_ids", AsyncMock(side_effect=fetches)), \
                    patch.object(gmail_mcp, "open_session", context), \
                    patch.object(ollama, "verify_model"), patch.object(ollama, "chat", side_effect=answers), \
                    patch.object(ollama, "unload_model") as unload, \
                    patch.object(automatic, "apply_session", side_effect=apply_batch) as apply:
                with self.assertRaises(KeyboardInterrupt if failure == "interrupt" else ValueError):
                    self.cycle(apply=True)
                unload.assert_called_once()
                apply.assert_called_once()
                self.state = processing_state.load_state(self.root)
                self.assertEqual(set(self.state["completed"]), {"a"})
                self.assertIsNone(self.state["initial_completed_for"])
            with patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["a", "b"])), \
                    patch.object(gmail_mcp, "fetch_message_ids", AsyncMock(return_value=messages("b"))) as fetch, \
                    patch.object(gmail_mcp, "open_session", context), \
                    patch.object(ollama, "verify_model"), patch.object(ollama, "chat", return_value=response), \
                    patch.object(ollama, "unload_model"), patch.object(automatic, "apply_session", side_effect=apply_batch):
                summary = self.cycle(apply=True)
                self.assertEqual(fetch.call_args.args[1], ["b"])
                self.assertEqual(summary["selected_count"], 1)
                self.assertEqual(set(processing_state.load_state(self.root)["completed"]), {"a", "b"})
                self.assertEqual(self.state["initial_completed_for"], "2026-10-15")

    def test_labeling_failure_stops_before_next_batch_and_unloads(self) -> None:
        self.settings.update({"batch_size": 1, "max_messages_per_run": None})
        self.model = ollama.load_model_config(ROOT / "config/model.example.json")
        response = json.dumps({"scores": {label["name"]: 0.9 for label in self.catalog["labels"]}})

        @asynccontextmanager
        async def context(settings, **kwargs):
            yield object()

        failures = [{"failed": True, "ready": True, "applied_count": 0, "results": []},
                    {"ready": False, "applied_count": 0, "results": []},
                    ValueError("Label mapping failed"), OSError("State write failed"), KeyboardInterrupt()]
        for failure in failures:
            with self.subTest(failure=failure), \
                    patch.object(gmail_mcp, "search_time_window", AsyncMock(return_value=["a", "b"])), \
                    patch.object(gmail_mcp, "fetch_message_ids", AsyncMock(return_value=[{
                        "id": "a", "email": {"sender": "example", "subject": "example", "body": "private body"}}])) as fetch, \
                    patch.object(gmail_mcp, "open_session", context), \
                    patch.object(ollama, "verify_model"), patch.object(ollama, "chat", return_value=response), \
                    patch.object(ollama, "unload_model") as unload, \
                    patch.object(automatic, "apply_session", AsyncMock(side_effect=[failure])):
                with self.assertRaises(type(failure) if isinstance(failure, BaseException) else ValueError):
                    self.cycle(apply=True)
                fetch.assert_called_once()
                unload.assert_called_once()
                self.assertEqual(self.state["completed"], {})

    def test_progress_callback_records_only_acknowledged_writes_and_successful_no_matches(self) -> None:
        # Exercise the shared writer callback at a real partial-failure boundary.
        from test_label_messages import client, listing, result, row, plan, CATALOG
        session = client(listing("Promotions"), result("Email abc123 labels updated successfully"), result("private", error=True))
        completed = []
        decisions = label_messages.validate_decisions(plan(row(), row("none", names=[]), row("failed"), row("later")), CATALOG)
        outcome = asyncio.run(label_messages.apply_session(session, decisions, apply=True, on_completed=completed.append))
        self.assertEqual(completed, ["abc123", "none"])
        self.assertTrue(outcome["failed"])


if __name__ == "__main__":
    unittest.main()
