# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Vault mode: turn Gmail OAuth JSON from process memory into owner-only tmpfs files.

A SecretOps CLI (`infisical run`, `op run` or `scripts/secret-inject.js`) puts
both JSON documents into the environment. The pinned Gmail MCP server reads only
file paths, so this module writes them once per process to a private folder on
the container's `/tmp` tmpfs, removes the variables from the environment and
points the Gmail settings at those files. When both variables are present they
win over any mounted credential folder. When neither is present, the mounted
files remain the documented fallback.
"""

import atexit
import json
import os
import shutil
import tempfile
from collections.abc import MutableMapping
from pathlib import Path
from typing import Any

OAUTH_ENV = "GMAIL_OAUTH_KEYS_JSON"
CREDENTIALS_ENV = "GMAIL_CREDENTIALS_JSON"
# Set by compose.credentials-vault.yaml so a missing vault launch fails clearly
# instead of falling back to a credential folder that is not mounted.
SOURCE_ENV = "MAILSORT_GMAIL_CREDENTIALS"
MAX_BYTES = 65536
# compose.yaml mounts a tmpfs here; files written below it never reach the host disk.
TMPFS = Path("/tmp")

_materialized: dict[str, str] | None = None


class VaultCredentialError(ValueError):
    """A safe diagnostic that never contains a credential value."""


def _decode(name: str, value: str) -> bytes:
    raw = value.encode("utf-8")
    if len(raw) > MAX_BYTES:
        raise VaultCredentialError(f"{name} is larger than {MAX_BYTES} bytes; store the JSON file contents only")
    try:
        document = json.loads(raw)
    except ValueError:
        raise VaultCredentialError(f"{name} is not valid JSON; store the complete JSON file contents in the vault") from None
    if not isinstance(document, dict):
        raise VaultCredentialError(f"{name} must contain a JSON object")
    return raw


def _write_private(path: Path, raw: bytes) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            descriptor = -1
            stream.write(raw)
    finally:
        if descriptor != -1:
            os.close(descriptor)


def apply(
    settings: dict[str, Any], *, environ: MutableMapping[str, str] | None = None,
    parent: Path | None = None,
) -> dict[str, Any]:
    """Return settings that point at vault-provided files, or the settings unchanged."""
    global _materialized
    environ = os.environ if environ is None else environ
    parent = TMPFS if parent is None else parent
    oauth = environ.pop(OAUTH_ENV, None)
    credentials = environ.pop(CREDENTIALS_ENV, None)
    if oauth is None and credentials is None:
        if _materialized is not None:
            return {**settings, **_materialized}
        if environ.get(SOURCE_ENV) == "vault":
            raise VaultCredentialError(
                f"Vault credentials were selected but {OAUTH_ENV} and {CREDENTIALS_ENV} are not set; "
                "start Docker Compose through infisical run, op run or scripts/secret-inject.js"
            )
        return settings
    if not oauth or not credentials:
        raise VaultCredentialError(
            f"Vault mode needs both {OAUTH_ENV} and {CREDENTIALS_ENV}; set both in the vault or neither"
        )
    payloads = {"oauth_path": _decode(OAUTH_ENV, oauth), "credentials_path": _decode(CREDENTIALS_ENV, credentials)}
    directory = None
    try:
        # mkdtemp creates a unique folder with mode 0700 owned by this process's user.
        directory = Path(tempfile.mkdtemp(prefix="noemi-gmail-vault-", dir=parent))
        paths = {"oauth_path": directory / "gcp-oauth.keys.json", "credentials_path": directory / "credentials.json"}
        for field, path in paths.items():
            _write_private(path, payloads[field])
    except OSError:
        if directory is not None:
            shutil.rmtree(directory, ignore_errors=True)
        raise VaultCredentialError("Cannot write vault credentials to the container's private /tmp tmpfs") from None
    atexit.register(shutil.rmtree, directory, True)
    _materialized = {field: str(path) for field, path in paths.items()}
    return {**settings, **_materialized}
