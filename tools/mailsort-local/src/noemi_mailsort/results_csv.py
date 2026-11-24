# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Append private classification outcomes to a persistent CSV, one event at a time,
and emit a matching structured JSON audit record to stderr for each event."""

import csv
import fcntl
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from noemi_mailsort import audit_log


FIELDS = ["timestamp", "source", "model", "mode", "dry_run", "message_id",
          "prediction", "selected_labels", "applied_labels", "status", "error"]


class ResultLog:
    """Share one CSV format between manual labeling and the automatic worker."""

    def __init__(self, path: Path, source: str, *, model: str = "", mode: str = "",
                 apply: bool = False) -> None:
        self.path = path
        self.source = source
        self.model = model
        self.mode = mode
        self.apply = apply
        self.predictions: dict[str, Any] = {}
        self._last_error: BaseException | None = None
        # Check access and the existing header before any Gmail changes.
        self._append(None)

    def _append(self, row: dict[str, Any] | None) -> None:
        descriptor = os.open(self.path, os.O_RDWR | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(descriptor, "a+", encoding="utf-8", newline="") as stream:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
            stream.seek(0)
            header = next(csv.reader(stream), None)
            if header is not None and header != FIELDS:
                raise ValueError("CSV results header is incompatible; select a new --results-file")
            stream.seek(0, os.SEEK_END)
            writer = csv.DictWriter(stream, fieldnames=FIELDS)
            if header is None:
                writer.writeheader()
            if row is not None:
                writer.writerow(row)
            stream.flush()
            os.fsync(stream.fileno())

    def record(self, outcome: dict[str, Any]) -> None:
        message_id = outcome.get("message_id", "")
        selected = outcome.get("selected_labels", [])
        status = outcome["status"]
        error = outcome.get("error", "")
        if not error and outcome.get("mapping_problems"):
            error = "Selected Gmail labels are missing or ambiguous"
        # The audit line goes to stderr first, so it survives a failed CSV write.
        audit_log.emit(
            self.source, "Classify and label Gmail messages",
            inputs=[{"message_id": message_id, "model": self.model, "mode": self.mode,
                     "dry_run": not self.apply, "prediction": self.predictions.get(message_id)}],
            actions=[{"selected_labels": selected,
                      "applied_labels": selected if status == "applied" else []}],
            risks=[error] if error else [],
            result=status,
        )
        self._append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": self.source, "model": self.model, "mode": self.mode,
            "dry_run": str(not self.apply).lower(), "message_id": message_id,
            "prediction": json.dumps(self.predictions.get(message_id), ensure_ascii=False, allow_nan=False),
            "selected_labels": json.dumps(selected, ensure_ascii=False, allow_nan=False),
            "applied_labels": json.dumps(selected if status == "applied" else [], ensure_ascii=False),
            "status": status, "error": error,
        })

    def error(self, error: BaseException) -> None:
        """Record run-level errors without bodies, credentials, or raw server replies."""
        if error is self._last_error:
            return
        self._last_error = error
        if isinstance(error, KeyboardInterrupt):
            message = "Processing interrupted"
        elif isinstance(error, json.JSONDecodeError):
            message = "Configuration or review plan is not valid JSON"
        elif isinstance(error, ValueError):
            message = str(error)
        elif isinstance(error, TimeoutError):
            message = "Operation timed out; inspect Gmail if writes were enabled"
        elif isinstance(error, OSError):
            message = "Local file operation failed; check configuration and data folder access"
        else:
            message = "Processing failed; inspect the worker logs"
        try:
            self.record({"status": "interrupted" if isinstance(error, KeyboardInterrupt) else "error",
                         "error": message})
        except (OSError, ValueError):
            logging.getLogger(__name__).error("Could not persist the CSV error record; inspect the data folder")
