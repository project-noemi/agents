# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Load a JSON label catalog and preview a classification prompt without inference."""

import argparse
import json
import sys
from pathlib import Path
from typing import Any


DEFAULT_PROMPT_DIR = Path(__file__).resolve().parents[2] / "prompts"
OUTPUT_PROMPT_FILES = {
    "labels": "label_prediction.txt",
    "confidence": "confidence_scoring.txt",
}


def _require_text(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")


def load_catalog(path: Path) -> dict[str, Any]:
    """Read and validate labels and optional guidance from a JSON file."""
    return validate_catalog(json.loads(path.read_text(encoding="utf-8")))


def validate_catalog(catalog: Any) -> dict[str, Any]:
    """Validate a catalog; disabled labels may have unfinished descriptions."""
    if not isinstance(catalog, dict):
        raise ValueError("The label catalog must be a JSON object")
    maximum = catalog.get("max_labels_per_email")
    if type(maximum) is not int or maximum < 1:
        raise ValueError("max_labels_per_email must be a positive integer")
    labels = catalog.get("labels")
    if not isinstance(labels, list) or not labels:
        raise ValueError("labels must be a non-empty list")

    ids: set[str] = set()
    names: set[str] = set()
    for index, label in enumerate(labels):
        context = f"labels[{index}]"
        if not isinstance(label, dict):
            raise ValueError(f"{context} must be an object")
        for field in ("id", "name"):
            _require_text(label.get(field), f"{context}.{field}")
        if "\n" in label["name"] or "\r" in label["name"]:
            raise ValueError(f"{context}.name must be a single line")
        if label["id"] in ids or label["name"] in names:
            raise ValueError("Label IDs and names must be unique")
        ids.add(label["id"])
        names.add(label["name"])
        if not isinstance(label.get("enabled"), bool):
            raise ValueError(f"{context}.enabled must be true or false")
        if not isinstance(label.get("description"), str):
            raise ValueError(f"{context}.description must be a string")
        if label["enabled"]:
            _require_text(label["description"], f"{context}.description for an enabled label")
        threshold = label.get("threshold")
        if type(threshold) not in (int, float) or not 0 <= threshold <= 1:
            raise ValueError(f"{context}.threshold must be a number between 0 and 1")

    guidance = catalog.get("guidance", [])
    if not isinstance(guidance, list):
        raise ValueError("guidance must be a list")
    for index, group in enumerate(guidance):
        context = f"guidance[{index}]"
        if not isinstance(group, dict):
            raise ValueError(f"{context} must be an object")
        _require_text(group.get("heading"), f"{context}.heading")
        for field in ("intro", "footer"):
            if not isinstance(group.get(field, ""), str):
                raise ValueError(f"{context}.{field} must be a string")
        if not isinstance(group.get("rules"), list):
            raise ValueError(f"{context}.rules must be a list")
        for rule in group["rules"]:
            if not isinstance(rule, dict):
                raise ValueError(f"{context} rules must be objects")
            _require_text(rule.get("text"), f"{context} rule text")
            required = rule.get("requires")
            if not isinstance(required, list) or any(
                not isinstance(label_id, str) or label_id not in ids
                for label_id in required
            ):
                raise ValueError(f"{context} rule requires must list existing label IDs")
    return catalog


def _render_catalog(catalog: dict[str, Any]) -> str:
    labels = [label for label in catalog["labels"] if label["enabled"]]
    if not labels:
        raise ValueError("Enable at least one label before building a prompt")
    enabled_ids = {label["id"] for label in labels}
    definitions = [f"**{label['name']}** — {label['description']}" for label in labels]
    sections = ["## Available categories\n\n" + "\n\n".join(definitions)]

    for group in catalog.get("guidance", []):
        rules = [
            rule["text"] for rule in group["rules"]
            if enabled_ids.issuperset(rule["requires"])
        ]
        if not rules:
            continue
        parts = [f"## {group['heading']}"]
        if group.get("intro"):
            parts.append(group["intro"])
        parts.append("\n".join(rules))
        if group.get("footer"):
            parts.append(group["footer"])
        sections.append("\n\n".join(parts))
    return "\n\n".join(sections)


def render_prompt(
    catalog: dict[str, Any],
    mode: str,
    prompt_dir: Path = DEFAULT_PROMPT_DIR,
) -> str:
    """Assemble instructions from an already validated catalog."""
    if mode not in OUTPUT_PROMPT_FILES:
        raise ValueError("Prompt mode must be labels or confidence")
    catalog_text = _render_catalog(catalog)
    instructions = (prompt_dir / "classification_instructions.txt").read_text(encoding="utf-8")
    output = (prompt_dir / OUTPUT_PROMPT_FILES[mode]).read_text(encoding="utf-8")
    if instructions.count("{{label_catalog}}") != 1:
        raise ValueError("Classification instructions must contain exactly one {{label_catalog}} placeholder")
    return instructions.replace("{{label_catalog}}", catalog_text) + "\n" + output


def build_prompt(
    catalog_path: Path,
    mode: str,
    prompt_dir: Path = DEFAULT_PROMPT_DIR,
) -> str:
    """Load a catalog and render its enabled definitions and output instructions."""
    return render_prompt(load_catalog(catalog_path), mode, prompt_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", type=Path, required=True, help="JSON label catalog path")
    parser.add_argument("--mode", choices=tuple(OUTPUT_PROMPT_FILES), required=True, help="Output format")
    parser.add_argument(
        "--prompt-dir", type=Path, default=DEFAULT_PROMPT_DIR,
        help="Directory containing classification_instructions.txt, label_prediction.txt, and confidence_scoring.txt",
    )
    args = parser.parse_args()
    try:
        prompt = build_prompt(args.labels, args.mode, args.prompt_dir)
    except (OSError, ValueError) as error:
        parser.exit(2, f"error: {error}\n")
    sys.stdout.write(prompt)


if __name__ == "__main__":
    main()
