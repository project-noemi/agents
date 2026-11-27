# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Configurable automatic Gmail labeling, with persistent completion records."""

import argparse
import asyncio
import json
import logging
import signal
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from noemi_mailsort import gmail_mcp, ollama
from noemi_mailsort.classify import classification_run
from noemi_mailsort.label_messages import apply_session
from noemi_mailsort.processing_state import load_state, processing_lock, save_state
from noemi_mailsort.results_csv import ResultLog
from noemi_mailsort.prompts import DEFAULT_PROMPT_DIR, load_catalog, render_prompt


def load_automatic_config(path: Path) -> dict[str, Any]:
    try:
        settings = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise ValueError("Cannot read automatic configuration; check its mount and JSON syntax") from None
    fields = {"timezone", "schedule", "query", "lookback_hours", "initial_since", "max_messages_per_run", "batch_size"}
    if not isinstance(settings, dict) or set(settings) != fields:
        raise ValueError("Automatic settings require timezone, schedule, query, lookback_hours, initial_since, max_messages_per_run, batch_size")
    try:
        ZoneInfo(settings["timezone"])
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        raise ValueError("timezone must be an installed IANA timezone, such as Europe/Budapest") from None
    schedule = settings["schedule"]
    if not isinstance(schedule, dict):
        raise ValueError("schedule must be an object")
    if schedule.get("type") == "interval" and set(schedule) == {"type", "minutes"}:
        if type(schedule["minutes"]) is not int or schedule["minutes"] < 1:
            raise ValueError("Interval minutes must be a positive integer")
    elif schedule.get("type") == "daily" and set(schedule) == {"type", "time"}:
        try:
            value = datetime.strptime(schedule["time"], "%H:%M")
            if value.strftime("%H:%M") != schedule["time"]:
                raise ValueError
        except (ValueError, TypeError):
            raise ValueError("Daily time must be HH:MM in 24-hour format") from None
    else:
        raise ValueError("Use schedule type interval with minutes, or daily with time")
    if not isinstance(settings["query"], str) or not settings["query"].strip():
        raise ValueError("query must be non-empty Gmail search text")
    for field in ("lookback_hours", "batch_size"):
        if type(settings[field]) is not int or settings[field] < 1:
            raise ValueError(f"{field} must be a positive integer")
    if settings["batch_size"] > 500:
        raise ValueError("batch_size must not exceed 500")
    maximum = settings["max_messages_per_run"]
    if maximum is not None and (type(maximum) is not int or maximum < 1):
        raise ValueError("max_messages_per_run must be null (all) or a positive integer")
    if settings["initial_since"] is not None:
        try:
            parsed = date.fromisoformat(settings["initial_since"])
            if parsed.isoformat() != settings["initial_since"]:
                raise ValueError
        except (TypeError, ValueError):
            raise ValueError("initial_since must be null or a YYYY-MM-DD date") from None
    return settings


def due(settings: dict[str, Any], state: dict[str, Any], now: datetime) -> bool:
    schedule = settings["schedule"]
    if schedule["type"] == "interval":
        previous = state["last_interval_at"]
        return previous is None or now >= datetime.fromisoformat(previous) + timedelta(minutes=schedule["minutes"])
    local = now.astimezone(ZoneInfo(settings["timezone"]))
    return local.strftime("%H:%M") >= schedule["time"] and state["last_daily_date"] != local.date().isoformat()


def initial_pending(settings: dict[str, Any], state: dict[str, Any]) -> bool:
    return settings["initial_since"] is not None and state["initial_completed_for"] != settings["initial_since"]


def window(settings: dict[str, Any], state: dict[str, Any], now: datetime) -> tuple[int, int]:
    if initial_pending(settings, state):
        start = datetime.combine(date.fromisoformat(settings["initial_since"]), datetime.min.time(),
                                 tzinfo=ZoneInfo(settings["timezone"]))
    else:
        start = now - timedelta(hours=settings["lookback_hours"])
    if start > now:
        raise ValueError("Initial date is in the future")
    return int(start.timestamp()), int(now.timestamp())


def run_cycle(
    settings: dict[str, Any], gmail_settings: dict[str, Any], model_settings: dict[str, Any],
    catalog: dict[str, Any], mode: str, prompt_dir: Path, state: dict[str, Any],
    state_dir: Path, *, apply: bool = False, now: datetime | None = None,
    results_file: Path | None = None,
) -> dict[str, Any]:
    """Classify and label each batch, sharing one model session for the run."""
    result_log = ResultLog(results_file or state_dir / "results.csv", "automatic",
                           model=model_settings.get("model", ""), mode=mode, apply=apply)
    try:
        started = time.perf_counter()
        now = now or datetime.now(timezone.utc)
        start, end = window(settings, state, now)
        ids = asyncio.run(gmail_mcp.search_time_window(gmail_settings, settings["query"], start, end))
        pending = [message_id for message_id in ids if message_id not in state["completed"]]
        limit = settings["max_messages_per_run"]
        selected = pending if limit is None else pending[:limit]
        summary: dict[str, Any] = {"dry_run": not apply, "matched_count": len(ids), "already_completed_count": len(ids) - len(pending),
                                   "selected_count": len(selected), "completed_count": 0, "applied_count": 0}

        def completed(message_id: str) -> None:
            state["completed"][message_id] = datetime.now(timezone.utc).isoformat()
            save_state(state_dir, state)
            summary["completed_count"] += 1

        size = settings["batch_size"]
        processed = 0
        if selected:
            with classification_run(model_settings, catalog, mode, prompt_dir) as classify:
                for offset in range(0, len(selected), size):
                    messages = asyncio.run(gmail_mcp.fetch_message_ids(gmail_settings, selected[offset:offset + size], model_settings["body_max_characters"]))
                    predictions = classify([message["email"] for message in messages])
                    decisions = [{"message_id": message["id"], "decision": "approve", "selected_labels": prediction["eligible_labels"]}
                                 for message, prediction in zip(messages, predictions)]
                    del messages
                    processed += len(predictions)
                    logging.info("classification_progress=%s/%s", processed, len(selected))

                    async def apply_predictions() -> dict[str, Any]:
                        writes = apply and any(row["selected_labels"] for row in decisions)
                        async with gmail_mcp.open_session(gmail_settings, allow_message_labeling=writes) as session:
                            return await apply_session(session, decisions, apply=apply, on_completed=completed if apply else None,
                                                       on_result=result_log.record)

                    result_log.predictions = {row["message_id"]: prediction["prediction"]
                                              for row, prediction in zip(decisions, predictions)}
                    result = asyncio.run(apply_predictions())
                    summary["applied_count"] += result["applied_count"]
                    for row, prediction in zip(result["results"], predictions):
                        logging.info("message_id=%s status=%s prediction=%s selected_labels=%s mapping_problems=%s",
                                     row["message_id"], row["status"], prediction["prediction"], row["selected_labels"], row["mapping_problems"])
                    if result.get("failed") or not result["ready"]:
                        raise ValueError("Automatic labeling stopped; inspect logs and Gmail before retrying. Earlier writes may have succeeded")
                    logging.info("batch_progress=%s/%s completed_count=%s applied_count=%s",
                                 processed, len(selected), summary["completed_count"], summary["applied_count"])
        if apply and len(selected) == len(pending) and initial_pending(settings, state):
            state["initial_completed_for"] = settings["initial_since"]
            save_state(state_dir, state)
        summary["duration_seconds"] = round(time.perf_counter() - started, 3)
        logging.info("cycle_summary=%s", json.dumps(summary))
        return summary
    except (Exception, KeyboardInterrupt) as error:
        result_log.error(error)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--automatic-config", type=Path, default=Path("config/automatic.example.json"))
    parser.add_argument("--gmail-config", type=Path, default=Path("config/gmail.example.json"))
    parser.add_argument("--model-config", type=Path, default=Path("config/model.example.json"))
    parser.add_argument("--labels", type=Path, default=Path("config/labels.example.json"))
    parser.add_argument("--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR)
    parser.add_argument("--mode", choices=("labels", "confidence"), default="labels")
    parser.add_argument("--state-dir", type=Path, default=Path("/app/state"))
    parser.add_argument("--results-file", type=Path, help="CSV output path; defaults to state-dir/results.csv")
    operation = parser.add_mutually_exclusive_group()
    operation.add_argument("--once", action="store_true", help="Run one cycle now instead of waiting for the schedule")
    operation.add_argument("--check-config", action="store_true", help="Validate settings and prompts only; no Gmail or model requests")
    operation.add_argument("--count-only", action="store_true", help="Count matching pending IDs without bodies, inference, writes, or completion records")
    parser.add_argument("--apply", action="store_true", help="Enable Gmail label additions and completion records; default is dry-run")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    stop = threading.Event()

    def shutdown(signum: int, frame: Any) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, shutdown)
    try:
        settings = load_automatic_config(args.automatic_config)
        gmail_settings = gmail_mcp.load_gmail_config(args.gmail_config)
        model_settings = ollama.load_model_config(args.model_config)
        catalog = load_catalog(args.labels)
        prompt = render_prompt(catalog, args.mode, args.prompt_dir)
        if args.check_config:
            names = [label["name"] for label in catalog["labels"] if label["enabled"]]
            num_ctx = ollama.context_size(model_settings, prompt, ollama.response_schema(names, args.mode))
            print(json.dumps({"configuration_valid": True, "automatic": settings, "mode": args.mode,
                              "model": ollama.model_name(model_settings), "num_ctx": num_ctx,
                              "writes_started": False}, indent=2))
            return
        if args.apply:
            gmail_mcp.check_credentials(gmail_settings, require_message_labeling=True)
        with processing_lock(args.state_dir):
            state = load_state(args.state_dir)
            if args.count_only:
                start, end = window(settings, state, datetime.now(timezone.utc))
                ids = asyncio.run(gmail_mcp.search_time_window(gmail_settings, settings["query"], start, end))
                print(json.dumps({"matched_count": len(ids), "pending_count": sum(message_id not in state["completed"] for message_id in ids),
                                  "initial_pass": initial_pending(settings, state), "writes_started": False}, indent=2))
                return
            first_cycle = True
            # Preview schedules are kept only in memory; dry-runs never mark mail completed.
            while not stop.is_set():
                now = datetime.now(timezone.utc)
                if args.once or (first_cycle and initial_pending(settings, state)) or due(settings, state, now):
                    first_cycle = False
                    state["last_daily_date"] = now.astimezone(ZoneInfo(settings["timezone"])).date().isoformat()
                    state["last_interval_at"] = now.isoformat()
                    if args.apply:
                        save_state(args.state_dir, state)
                    try:
                        result = run_cycle(settings, gmail_settings, model_settings, catalog, args.mode,
                                           args.prompt_dir, state, args.state_dir, apply=args.apply, now=now, results_file=args.results_file)
                        if args.once:
                            print(json.dumps(result, indent=2))
                            return
                    except OSError:
                        # A failed durable write must stop the worker, not continue
                        # with completion records that exist only in memory.
                        raise
                    except Exception as error:
                        if args.once:
                            raise
                        message = str(error) if isinstance(error, ValueError) else gmail_mcp.safe_diagnostic(error)
                        logging.error("Cycle failed: %s. Inspect Gmail after uncertain writes; next attempt follows the schedule", message)
                    finally:
                        state["last_interval_at"] = datetime.now(timezone.utc).isoformat()
                        if args.apply:
                            save_state(args.state_dir, state)
                    # Continue a capped initial backlog only at the next scheduled check.
                    if not args.apply:
                        state["initial_completed_for"] = settings["initial_since"]
                stop.wait(30)
    except KeyboardInterrupt:
        logging.info("Automatic worker stopped; acknowledged progress is saved. Inspect Gmail after an interrupted write")
    except Exception as error:
        message = str(error) if isinstance(error, (OSError, ValueError)) else gmail_mcp.safe_diagnostic(error)
        parser.exit(2, f"Automatic worker stopped: {message}. Inspect Gmail before retrying if writes were enabled.\n")


if __name__ == "__main__":
    main()
