# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Classify a local JSON email batch with Ollama, without Gmail access."""

import argparse
import json
import logging
import sys
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from noemi_mailsort import ollama
from noemi_mailsort.predictions import parse_prediction, select_labels
from noemi_mailsort.prompts import DEFAULT_PROMPT_DIR, load_catalog, render_prompt


def prepare_email(email: dict[str, str], body_max_characters: int) -> dict[str, str]:
    """Preserve sender/subject and keep the exact Unicode body prefix, without a marker."""
    fields = {"sender", "subject", "body"}
    if not isinstance(email, dict) or set(email) != fields or any(not isinstance(email[key], str) for key in fields):
        raise ValueError("Each email must contain exactly sender, subject, and body strings")
    return {"sender": email["sender"], "subject": email["subject"], "body": email["body"][:body_max_characters]}


@contextmanager
def classification_run(
    settings: dict[str, Any], catalog: dict[str, Any],
    mode: str, prompt_dir: Path = DEFAULT_PROMPT_DIR,
) -> Iterator[Callable[[list[dict[str, str]]], list[dict[str, Any]]]]:
    """Share one context allocation and model lifetime across all input groups."""
    attempted = False
    verified = False
    prompt = render_prompt(catalog, mode, prompt_dir)
    names = [label["name"] for label in catalog["labels"] if label["enabled"]]
    schema = ollama.response_schema(names, mode)
    # Copy options so the configured ceiling remains available for the next run.
    options = {**settings["options"], "num_ctx": ollama.context_size(settings, prompt, schema)}
    run_settings = {**settings, "options": options}

    def classify(emails: list[dict[str, str]]) -> list[dict[str, Any]]:
        nonlocal attempted, verified
        if not isinstance(emails, list):
            raise ValueError("Email input must be a JSON array")
        if not emails:
            return []
        prepared = [prepare_email(email, settings["body_max_characters"]) for email in emails]
        # Reference workflow's conservative UTF-8 byte budget, with wrapper allowance.
        for email in prepared:
            bound = (len(prompt.encode("utf-8"))
                     + len(json.dumps(email, ensure_ascii=False, sort_keys=True).encode("utf-8"))
                     + len(json.dumps(schema, ensure_ascii=False).encode("utf-8")) + 1024)
            if bound + settings["options"]["num_predict"] + settings["context_safety_tokens"] >= run_settings["options"]["num_ctx"]:
                raise ValueError("Prepared email exceeds the run's context budget; check unusually long headers or JSON-escaped content")
        if not verified:
            ollama.verify_model(run_settings)
            verified = True
            logging.getLogger(__name__).info("model_context_tokens=%s body_max_characters=%s",
                                            run_settings["options"]["num_ctx"], settings["body_max_characters"])
        results = []
        for index, (original, email) in enumerate(zip(emails, prepared), start=1):
            attempted = True
            started = time.perf_counter()
            content = ollama.chat(run_settings, prompt, email, schema)
            prediction = parse_prediction(content, mode, names)
            selected = select_labels(content, mode, catalog)
            results.append({
                "index": index, "model": ollama.model_name(settings), "mode": mode,
                "prediction": prediction, "eligible_labels": selected,
                "original_body_characters": len(original["body"]),
                "retained_body_characters": len(email["body"]),
                "body_truncated": len(email["body"]) < len(original["body"]),
                "duration_seconds": round(time.perf_counter() - started, 3),
            })
        return results

    try:
        yield classify
    finally:
        if attempted and settings["unload_after_batch"]:
            failing = sys.exc_info()[0] is not None
            try:
                ollama.unload_model(settings)
            except (OSError, ValueError):
                if not failing:
                    raise
                logging.getLogger(__name__).warning("Model cleanup failed; the configured keep-alive is the fallback")


def classify_batch(
    emails: list[dict[str, str]], settings: dict[str, Any], catalog: dict[str, Any],
    mode: str, prompt_dir: Path = DEFAULT_PROMPT_DIR,
) -> list[dict[str, Any]]:
    """Classify one supplied batch, retaining the existing single-batch interface."""
    with classification_run(settings, catalog, mode, prompt_dir) as classify:
        return classify(emails)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-config", required=True, type=Path, help="Ollama settings JSON")
    parser.add_argument("--labels", required=True, type=Path, help="Label catalog JSON")
    parser.add_argument("--mode", required=True, choices=("labels", "confidence"))
    parser.add_argument("--emails", required=True, type=Path, help="JSON array of sender/subject/body objects")
    parser.add_argument("--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR)
    args = parser.parse_args()
    try:
        settings = ollama.load_model_config(args.model_config)
        catalog = load_catalog(args.labels)
        emails = json.loads(args.emails.read_text(encoding="utf-8"))
        results = classify_batch(emails, settings, catalog, args.mode, args.prompt_dir)
    except (OSError, ValueError) as error:
        parser.exit(2, f"Classification failed: {error}\n")
    except KeyboardInterrupt:
        parser.exit(130, "Classification interrupted; model cleanup was attempted.\n")
    print(json.dumps(results, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
