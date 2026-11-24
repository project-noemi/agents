# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Prepare an editable review plan or add existing Gmail user labels explicitly."""

import argparse
import asyncio
import json
import logging
import os
import re
import time
from collections.abc import Callable
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from noemi_mailsort import gmail_mcp, ollama
from noemi_mailsort.classify import classify_batch
from noemi_mailsort.dry_run import load_processing_config
from noemi_mailsort.prompts import DEFAULT_PROMPT_DIR, load_catalog
from noemi_mailsort.processing_state import processing_lock
from noemi_mailsort.results_csv import ResultLog


def prepare_plan(
    gmail_settings: dict[str, Any], processing: dict[str, Any], model_settings: dict[str, Any],
    catalog: dict[str, Any], mode: str, prompt_dir: Path = DEFAULT_PROMPT_DIR,
) -> dict[str, Any]:
    """Classify in memory; keep headers and predictions for review, never bodies."""
    batch = asyncio.run(gmail_mcp.fetch_messages(
        gmail_settings, processing["query"], processing["max_messages"],
        model_settings["body_max_characters"],
    ))
    messages = batch["messages"]
    predictions = classify_batch(
        [message["email"] for message in messages], model_settings, catalog, mode, prompt_dir,
    ) if messages else []
    return {
        "version": 1, "created_at": datetime.now(timezone.utc).isoformat(),
        "query": processing["query"], "model": ollama.model_name(model_settings), "mode": mode,
        "messages": [{
            "message_id": message["id"], "sender": message["email"]["sender"],
            "subject": message["email"]["subject"], "prediction": prediction["prediction"],
            "eligible_labels": prediction["eligible_labels"],
            "selected_labels": list(prediction["eligible_labels"]), "decision": "pending",
            **gmail_mcp.resolve_label_names(prediction["eligible_labels"], batch["user_labels"]),
        } for message, prediction in zip(messages, predictions)],
    }


def check_output_path(path: Path) -> None:
    if path.name.endswith(".example.json") or path.exists():
        raise ValueError("Choose a new private plan path; existing files and shared examples are never overwritten")
    if not path.parent.is_dir():
        raise ValueError("Plan directory does not exist; create and mount a private review directory first")


def write_plan(path: Path, plan: dict[str, Any]) -> None:
    """Exclusive creation with owner-only access, including if a file races us."""
    check_output_path(path)
    serialized = json.dumps(plan, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(serialized)


def _unique_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate keys are not allowed in a review plan")
        result[key] = value
    return result


def load_plan(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as stream:
            raw = stream.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError
        return json.loads(raw, object_pairs_hook=_unique_keys)
    except (OSError, ValueError):
        raise ValueError("Cannot read review plan; check its mount, size, and JSON syntax (including duplicate keys)") from None


def validate_decisions(plan: dict[str, Any], catalog: dict[str, Any]) -> list[dict[str, Any]]:
    """Trust only explicit decisions, message IDs, and validated selected names.

    Original predictions, scores, headers, and saved Gmail IDs are informational.
    Human selections override scores, but never the configured category set/limit.
    """
    fields = {"version", "created_at", "query", "model", "mode", "messages"}
    if not isinstance(plan, dict) or set(plan) != fields or type(plan["version"]) is not int or plan["version"] != 1:
        raise ValueError("Unsupported review plan format or version")
    if plan["mode"] not in ("labels", "confidence") or any(
        not isinstance(plan[field], str) for field in ("created_at", "query", "model")
    ):
        raise ValueError("Invalid review plan metadata")
    rows = plan["messages"]
    if not isinstance(rows, list) or len(rows) > 500:
        raise ValueError("A review plan must contain at most 500 messages")
    enabled = {label["name"] for label in catalog["labels"] if label["enabled"]}
    seen = set()
    decisions = []
    row_fields = {"message_id", "sender", "subject", "prediction", "eligible_labels",
                  "selected_labels", "decision", "resolved_labels", "mapping_problems"}
    for row in rows:
        if not isinstance(row, dict) or set(row) != row_fields:
            raise ValueError("Unexpected review row fields; edit only selected_labels and decision")
        message_id = row["message_id"]
        if not isinstance(message_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", message_id) or message_id in seen:
            raise ValueError("Review plan contains an invalid or repeated message ID")
        seen.add(message_id)
        decision, names = row["decision"], row["selected_labels"]
        if decision not in ("pending", "approve", "skip"):
            raise ValueError("Each decision must be pending, approve, or skip")
        if not isinstance(names, list) or any(not isinstance(name, str) for name in names) or len(set(names)) != len(names):
            raise ValueError("selected_labels must contain unique category names")
        if decision == "approve" and (not set(names).issubset(enabled) or len(names) > catalog["max_labels_per_email"]):
            raise ValueError("Approved labels must be enabled categories within max_labels_per_email")
        decisions.append({"message_id": message_id, "decision": decision, "selected_labels": list(names)})
    return decisions


async def apply_session(
    session: Any, decisions: list[dict[str, Any]], *, apply: bool = False,
    on_completed: Callable[[str], None] | None = None,
    on_result: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """Preflight all mappings, then add IDs to individual messages sequentially."""
    discovered = await gmail_mcp.discover_tools(session)
    gmail_mcp.require_tools(discovered, {"list_email_labels"})
    labels = gmail_mcp.parse_label_result(await gmail_mcp.read_tool(session, "list_email_labels", {}))
    rows = []
    for decision in decisions:
        names = decision["selected_labels"] if decision["decision"] == "approve" else []
        mapping = gmail_mcp.resolve_label_names(names, labels)
        status = {"pending": "pending", "skip": "skipped"}.get(decision["decision"], "would_apply" if names else "no_labels")
        if mapping["mapping_problems"]:
            status = "blocked"
        rows.append({**decision, **mapping, "status": status})
    ready = all(row["status"] not in ("pending", "blocked") for row in rows)
    result = {"dry_run": not apply, "ready": ready, "applied_count": 0, "results": rows}
    if not apply:
        if on_result:
            for row in rows:
                on_result(row)
        return result
    if not ready:
        if on_result:
            for row in rows:
                if row["status"] == "would_apply":
                    row["status"] = "not_attempted"
                on_result(row)
        raise gmail_mcp.GmailMCPError("No writes made: resolve all pending decisions and missing/conflicting mappings; preview the plan first")
    if any(row["status"] == "would_apply" for row in rows):
        gmail_mcp.require_tools(discovered, {"modify_email"})
    for index, row in enumerate(rows):
        if row["status"] != "would_apply" and on_result:
            on_result(row)
        if row["status"] == "no_labels" and on_completed is not None:
            on_completed(row["message_id"])
        if row["status"] != "would_apply":
            continue
        try:
            # The only mutation in this workflow: add freshly resolved user IDs.
            response = await session.call_tool("modify_email", {
                "messageId": row["message_id"],
                "addLabelIds": [label["id"] for label in row["resolved_labels"]],
            })
            text = gmail_mcp.tool_text(response, "message labeling")
            if text != f"Email {row['message_id']} labels updated successfully":
                raise gmail_mcp.GmailMCPError("Unexpected labeling acknowledgement; inspect this message in Gmail")
        except (Exception, KeyboardInterrupt, asyncio.CancelledError) as error:
            row["status"] = "outcome_unknown"
            row["error"] = ("Label request interrupted; inspect Gmail" if isinstance(error, (KeyboardInterrupt, asyncio.CancelledError))
                            else gmail_mcp.safe_diagnostic(error))
            for remaining in rows[index + 1:]:
                if remaining["status"] == "would_apply":
                    remaining["status"] = "not_attempted"
            if on_result:
                for unfinished in rows[index:]:
                    on_result(unfinished)
            if isinstance(error, (KeyboardInterrupt, asyncio.CancelledError)):
                raise
            result["failed"] = True
            break
        row["status"] = "applied"
        result["applied_count"] += 1
        if on_result:
            on_result(row)
        logging.getLogger(__name__).info("message_id=%s status=applied labels=%s", row["message_id"], row["selected_labels"])
        if on_completed is not None:
            on_completed(row["message_id"])
    return result


async def apply_decisions(
    settings: dict[str, Any], plan: dict[str, Any], catalog: dict[str, Any], *, apply: bool = False,
    result_log: ResultLog | None = None,
) -> dict[str, Any]:
    decisions = validate_decisions(plan, catalog)
    if apply and any(row["decision"] == "pending" for row in decisions):
        raise ValueError("No writes made: change every pending decision to approve or skip")
    # Empty/no-match/skip-only plans do not need write permissions or a write session.
    writes = apply and any(row["decision"] == "approve" and row["selected_labels"] for row in decisions)
    async with gmail_mcp.open_session(settings, allow_message_labeling=writes) as session:
        return await apply_session(session, decisions, apply=apply,
                                   on_result=result_log.record if result_log else None)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    workflow = parser.add_mutually_exclusive_group(required=True)
    workflow.add_argument("--plan-output", type=Path, help="Create a new private JSON plan; no Gmail writes")
    workflow.add_argument("--review-plan", type=Path, help="Preview or apply an edited JSON plan; no model calls")
    workflow.add_argument("--no-review", action="store_true", help="Classify and preview, or apply predictions with --apply")
    parser.add_argument("--results-file", type=Path,
                        default=Path(os.environ.get("MAILSORT_STATE_DIR", "/app/state")) / "results.csv",
                        help="Persistent CSV for previews, applied labels, and errors")
    parser.add_argument("--apply", action="store_true", help="Explicitly enable adding labels; default is read-only")
    parser.add_argument("--gmail-config", type=Path, default=Path("config/gmail.example.json"))
    parser.add_argument("--processing-config", type=Path, default=Path("config/processing.example.json"))
    parser.add_argument("--model-config", type=Path, default=Path("config/model.example.json"))
    parser.add_argument("--labels", type=Path, default=Path("config/labels.example.json"))
    parser.add_argument("--mode", choices=("labels", "confidence"), default="labels")
    parser.add_argument("--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR)
    args = parser.parse_args()
    if args.apply and args.plan_output:
        parser.error("--plan-output cannot be combined with --apply")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    started = time.perf_counter()
    locks = ExitStack()
    result_log = None
    try:
        if args.apply and os.environ.get("MAILSORT_STATE_DIR"):
            locks.enter_context(processing_lock(Path(os.environ["MAILSORT_STATE_DIR"])))
        result_log = ResultLog(args.results_file, "manual", mode=args.mode, apply=args.apply)
        catalog = load_catalog(args.labels)
        gmail_settings = gmail_mcp.load_gmail_config(args.gmail_config)
        if args.review_plan:
            plan = load_plan(args.review_plan)
        else:
            if args.plan_output:
                check_output_path(args.plan_output)
            processing = load_processing_config(args.processing_config)
            model_settings = ollama.load_model_config(args.model_config)
            # Fail early on missing local write grants, before expensive inference.
            if args.apply:
                gmail_mcp.check_credentials(gmail_settings, require_message_labeling=True)
            plan = prepare_plan(gmail_settings, processing, model_settings, catalog, args.mode, args.prompt_dir)
        result_log.model = plan["model"]
        result_log.mode = plan["mode"]
        result_log.predictions = {row["message_id"]: row["prediction"] for row in plan["messages"]}
        if args.plan_output:
            write_plan(args.plan_output, plan)
            result = {"dry_run": True, "plan_output": str(args.plan_output), "message_count": len(plan["messages"])}
            for row in plan["messages"]:
                result_log.record({**row, "status": "plan_created"})
        else:
            if args.no_review:
                for row in plan["messages"]:
                    row["decision"] = "approve"
            result = asyncio.run(apply_decisions(gmail_settings, plan, catalog, apply=args.apply, result_log=result_log))
            result["decision_source"] = "model" if args.no_review else "review_plan"
            if args.no_review:
                result["model"], result["mode"] = plan["model"], plan["mode"]
                for row, source in zip(result["results"], plan["messages"]):
                    row["prediction"] = source["prediction"]
                    row["eligible_labels"] = source["eligible_labels"]
        result["duration_seconds"] = round(time.perf_counter() - started, 3)
    except Exception as error:
        if result_log:
            result_log.error(error)
        message = str(error) if isinstance(error, (OSError, ValueError)) else gmail_mcp.safe_diagnostic(error)
        suffix = " Earlier writes may have succeeded; inspect Gmail before retrying." if args.apply else ""
        parser.exit(2, f"Label workflow failed: {message}{suffix}\n")
    except KeyboardInterrupt as error:
        if result_log:
            result_log.error(error)
        parser.exit(130, "Label workflow interrupted; earlier writes may have succeeded. Inspect Gmail before retrying.\n")
    finally:
        locks.close()
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    if result.get("failed"):
        parser.exit(2, "Labeling stopped after an uncertain result; inspect Gmail before retrying.\n")


if __name__ == "__main__":
    main()
