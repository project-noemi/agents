# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Classify a bounded Gmail search without applying labels or saving email bodies."""

import argparse
import asyncio
import json
import time
from pathlib import Path
from typing import Any

from noemi_mailsort import gmail_mcp, ollama
from noemi_mailsort.classify import classify_batch
from noemi_mailsort.prompts import DEFAULT_PROMPT_DIR, load_catalog


def load_processing_config(path: Path) -> dict[str, Any]:
    try:
        settings = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise ValueError("Cannot read processing configuration; check its mount and JSON syntax") from None
    if not isinstance(settings, dict) or set(settings) != {"query", "max_messages"}:
        raise ValueError("Processing settings require query and max_messages")
    if not isinstance(settings["query"], str) or not settings["query"].strip():
        raise ValueError("query must be a non-empty Gmail search query")
    if type(settings["max_messages"]) is not int or not 1 <= settings["max_messages"] <= 500:
        raise ValueError("max_messages must be an integer from 1 to 500")
    return settings


def run_dry_run(
    gmail_settings: dict[str, Any], processing: dict[str, Any], model_settings: dict[str, Any],
    catalog: dict[str, Any], mode: str, prompt_dir: Path = DEFAULT_PROMPT_DIR,
) -> dict[str, Any]:
    """Retrieve first, then reuse the existing classification and cleanup policy."""
    started = time.perf_counter()
    batch = asyncio.run(gmail_mcp.fetch_messages(
        gmail_settings, processing["query"], processing["max_messages"],
        model_settings["body_max_characters"],
    ))
    messages = batch["messages"]
    predictions = classify_batch(
        [message["email"] for message in messages], model_settings, catalog, mode, prompt_dir,
    ) if messages else []
    results = []
    for message, prediction in zip(messages, predictions):
        results.append({
            "message_id": message["id"], "model": prediction["model"], "mode": mode,
            "prediction": prediction["prediction"], "eligible_labels": prediction["eligible_labels"],
            **gmail_mcp.resolve_label_names(prediction["eligible_labels"], batch["user_labels"]),
            "retained_body_characters": len(message["email"]["body"]),
            "duration_seconds": prediction["duration_seconds"],
        })
    return {
        "dry_run": True, "query": processing["query"], "max_messages": processing["max_messages"],
        "user_label_count": len(batch["user_labels"]), "processed_count": len(results),
        "results": results, "duration_seconds": round(time.perf_counter() - started, 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gmail-config", type=Path, default=Path("config/gmail.example.json"))
    parser.add_argument("--processing-config", type=Path, default=Path("config/processing.example.json"))
    parser.add_argument("--model-config", type=Path, default=Path("config/model.example.json"))
    parser.add_argument("--labels", type=Path, default=Path("config/labels.example.json"))
    parser.add_argument("--mode", choices=("labels", "confidence"), default="labels")
    parser.add_argument("--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR)
    args = parser.parse_args()
    try:
        gmail_settings = gmail_mcp.load_gmail_config(args.gmail_config)
        processing = load_processing_config(args.processing_config)
        model_settings = ollama.load_model_config(args.model_config)
        catalog = load_catalog(args.labels)
        result = run_dry_run(gmail_settings, processing, model_settings, catalog, args.mode, args.prompt_dir)
    except Exception as error:
        # MCP task groups may wrap the safe diagnostic; never print raw Gmail errors.
        message = str(error) if isinstance(error, (OSError, ValueError)) else gmail_mcp.safe_diagnostic(error)
        parser.exit(2, f"Gmail dry-run failed: {message}\n")
    except KeyboardInterrupt:
        parser.exit(130, "Gmail dry-run interrupted; model cleanup was attempted.\n")
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
