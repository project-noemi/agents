# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Small private completion records and a shared Linux processing lock."""

import fcntl
import json
import os
import re
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


@contextmanager
def processing_lock(directory: Path) -> Iterator[None]:
    if not directory.is_dir():
        raise ValueError("State directory is missing; create and mount a private data directory")
    descriptor = os.open(directory / "processing.lock", os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Another processing job is running; stop it before starting this job") from None
        yield
    finally:
        os.close(descriptor)


def load_state(directory: Path) -> dict[str, Any]:
    path = directory / "processing.json"
    if not path.exists():
        return {"version": 1, "completed": {}, "initial_completed_for": None,
                "last_daily_date": None, "last_interval_at": None}
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        if (not isinstance(state, dict) or set(state) != {
                "version", "completed", "initial_completed_for", "last_daily_date", "last_interval_at"}
                or type(state["version"]) is not int or state["version"] != 1
                or not isinstance(state["completed"], dict)):
            raise ValueError
        for message_id, timestamp in state["completed"].items():
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", message_id) or not isinstance(timestamp, str):
                raise ValueError
        for key in ("initial_completed_for", "last_daily_date", "last_interval_at"):
            if state[key] is not None and not isinstance(state[key], str):
                raise ValueError
        return state
    except (OSError, ValueError, TypeError):
        raise ValueError("Cannot load processing state; inspect the private data file before retrying") from None


def save_state(directory: Path, state: dict[str, Any]) -> None:
    """Replace atomically so a stopped process cannot leave half-written JSON."""
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory, delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(state, stream, ensure_ascii=False, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, directory / "processing.json")
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
