# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Import Gmail user labels into a new private catalog, disabled until configured."""

import argparse
import asyncio
import json
import os
from pathlib import Path
from typing import Any

from noemi_mailsort import gmail_mcp
from noemi_mailsort.prompts import validate_catalog


def imported_catalog(labels: list[dict[str, str]]) -> dict[str, Any]:
    """Build configuration data; never infer descriptions or enable categories."""
    entries = [
        {"id": label["id"], "name": label["name"], "description": "",
         "enabled": False, "threshold": 0.5}
        for label in labels if label["type"] == "user"
    ]
    return validate_catalog({"max_labels_per_email": len(entries), "labels": entries})


def write_catalog(path: Path, catalog: dict[str, Any]) -> None:
    """Create a private file exclusively; preserve existing catalogs and templates."""
    if path.name.endswith(".example.json"):
        raise ValueError("Import into a private catalog, not a shared .example.json file")
    validate_catalog(catalog)
    serialized = json.dumps(catalog, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(serialized)


def import_user_labels(settings: dict[str, Any], output: Path) -> dict[str, Any]:
    """List account labels only, then initialize a new local catalog if needed."""
    if output.name.endswith(".example.json"):
        raise ValueError("Import into a private catalog, not a shared .example.json file")
    if output.exists():
        raise ValueError("Output already exists; choose a new private --output path to preserve your settings")
    if not output.parent.is_dir():
        raise ValueError("Output directory does not exist; mount an existing private configuration directory")
    result = asyncio.run(gmail_mcp.connection_check(settings))
    labels = [label for label in result["labels"] if label["type"] == "user"]
    if not labels:
        return {"imported_count": 0, "file_created": False}
    write_catalog(output, imported_catalog(labels))
    return {"imported_count": len(labels), "file_created": True, "output": str(output)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gmail-config", type=Path, default=Path("config/gmail.example.json"))
    parser.add_argument("--output", type=Path, default=Path("user-config/labels.json"), help="New private catalog file; existing files are never overwritten")
    args = parser.parse_args()
    try:
        settings = gmail_mcp.load_gmail_config(args.gmail_config)
        result = import_user_labels(settings, args.output)
    except Exception as error:
        message = str(error) if isinstance(error, (OSError, ValueError)) else gmail_mcp.safe_diagnostic(error)
        parser.exit(2, f"Label import failed: {message}\n")
    except KeyboardInterrupt:
        parser.exit(130, "Label import interrupted.\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
