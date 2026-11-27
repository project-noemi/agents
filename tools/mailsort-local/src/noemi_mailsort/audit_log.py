# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Emit one structured JSON audit record per operational event to stderr."""

import json
import sys
from datetime import datetime, timezone
from typing import Any


def emit(source: str, task: str, inputs: list[Any], actions: list[Any], risks: list[Any], result: str) -> None:
    """Write the persona Audit Log shape as a single JSON line.

    Callers pass message IDs, label names, statuses and sanitized errors only:
    never email bodies, senders, subjects, credentials or raw server replies.
    Audit output must not interrupt processing, so write failures are ignored.
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "task": task,
        "inputs": inputs,
        "actions": actions,
        "risks": risks,
        "result": result,
    }
    try:
        sys.stderr.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")
        sys.stderr.flush()
    except (OSError, ValueError):
        pass
