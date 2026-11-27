# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Shared Gmail MCP transport; ordinary commands permit only read tools."""

import argparse
import asyncio
import json
import math
import os
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from noemi_mailsort import vault_credentials


class GmailMCPError(ValueError):
    """A safe diagnostic that contains no server response or credential values."""


def load_gmail_config(path: Path) -> dict[str, Any]:
    try:
        settings = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise GmailMCPError("Cannot read Gmail configuration; check its mount and JSON syntax") from None
    if not isinstance(settings, dict) or set(settings) != {"oauth_path", "credentials_path", "timeout_seconds"}:
        raise GmailMCPError("Gmail configuration requires oauth_path, credentials_path, and timeout_seconds")
    for field in ("oauth_path", "credentials_path"):
        value = settings[field]
        if not isinstance(value, str) or not value or not Path(value).is_absolute():
            raise GmailMCPError(f"{field} must be an absolute path inside the container")
    timeout = settings["timeout_seconds"]
    if type(timeout) not in (int, float) or not 0 < timeout < math.inf:
        raise GmailMCPError("timeout_seconds must be a positive finite number")
    # Vault mode wins whenever both OAuth JSON values arrive in process memory.
    try:
        return vault_credentials.apply(settings)
    except vault_credentials.VaultCredentialError as error:
        raise GmailMCPError(str(error)) from None


def check_credentials(settings: dict[str, Any], *, require_message_labeling: bool = False) -> None:
    """Check required files without printing secrets or converting token formats."""
    data = {}
    for field in ("oauth_path", "credentials_path"):
        try:
            with Path(settings[field]).open("rb") as stream:
                raw = stream.read(65537)
            if len(raw) > 65536:
                raise ValueError
            data[field] = json.loads(raw)
            if not isinstance(data[field], dict):
                raise ValueError
        except (OSError, ValueError):
            raise GmailMCPError(
                f"Cannot read valid {field}; check the private mount, ownership, and JSON file"
            ) from None
    client = data["oauth_path"].get("installed") or data["oauth_path"].get("web")
    if not isinstance(client, dict) or any(
        not isinstance(client.get(key), str) or not client[key] for key in ("client_id", "client_secret")
    ):
        raise GmailMCPError("oauth_path must contain a Google Desktop or Web OAuth client JSON")
    credentials = data["credentials_path"]
    tokens = credentials.get("tokens", credentials)
    if not isinstance(tokens, dict) or not isinstance(tokens.get("refresh_token"), str) or not tokens["refresh_token"]:
        raise GmailMCPError("No MCP refresh token found; follow README authentication steps")
    if "token" in tokens or "token_uri" in tokens:
        raise GmailMCPError("This is a Python Google API token, not an MCP token; follow README authentication steps")
    scopes = credentials.get("scopes")
    if scopes is not None and (not isinstance(scopes, list) or any(not isinstance(scope, str) for scope in scopes)):
        raise GmailMCPError("MCP scopes must be a list of strings; authenticate again to a new token folder")
    if require_message_labeling:
        granted = scopes if scopes is not None else str(tokens.get("scope", "")).split()
        if not set(granted).intersection({
            "gmail.modify", "https://www.googleapis.com/auth/gmail.modify",
            "mail.google.com", "https://mail.google.com/",
        }):
            raise GmailMCPError("Message labeling requires a saved gmail.modify grant; follow README authentication steps")


def tool_text(result: Any, operation: str) -> str:
    """Extract the pinned server's fenced text without echoing private failures."""
    if result.isError:
        # Recognize fixed OAuth reason codes without ever echoing the response.
        error_text = "\n".join(getattr(item, "text", "") for item in result.content).lower()
        if "invalid_grant" in error_text:
            raise GmailMCPError("Google rejected the saved refresh token (invalid_grant); authenticate again using a new private folder as described in README")
        if "invalid_client" in error_text:
            raise GmailMCPError("Google rejected the OAuth client (invalid_client); check the client/token pairing or authenticate again")
        raise GmailMCPError(f"Gmail {operation} failed; check OAuth validity, scopes, Gmail API, and network access")
    if len(result.content) != 1 or result.content[0].type != "text":
        raise GmailMCPError(f"Unexpected Gmail MCP {operation} response format")
    text = result.content[0].text
    opening, closing = "<untrusted-tool-output>\n", "\n</untrusted-tool-output>"
    if text.startswith(opening) and text.endswith(closing):
        text = text[len(opening):-len(closing)]
    return text


def parse_label_result(result: Any) -> list[dict[str, str]]:
    """Validate all sections, then return only labels from the user section."""
    text = tool_text(result, "label listing")
    lines = [line for line in text.splitlines() if line]
    header = re.fullmatch(r"Found (\d+) labels \((\d+) system, (\d+) user\):", lines[0] if lines else "")
    if not header:
        raise GmailMCPError("Unexpected Gmail MCP label response format")
    total, system_count, user_count = map(int, header.groups())
    labels = []
    position = 1
    for heading, kind, count in (("System Labels:", "system", system_count), ("User Labels:", "user", user_count)):
        if position >= len(lines) or lines[position] != heading:
            raise GmailMCPError("Incomplete Gmail MCP label response")
        position += 1
        for _ in range(count):
            if (position + 1 >= len(lines) or not lines[position].startswith("ID: ")
                    or not lines[position + 1].startswith("Name: ")):
                raise GmailMCPError("Incomplete Gmail MCP label name/ID pair")
            label_id, name = lines[position][4:], lines[position + 1][6:]
            if not label_id or not name:
                raise GmailMCPError("Gmail MCP returned an empty label name or ID")
            labels.append({"id": label_id, "name": name, "type": kind})
            position += 2
    if position != len(lines) or len(labels) != total or len({label["id"] for label in labels}) != total:
        raise GmailMCPError("Gmail MCP label counts or IDs are inconsistent")
    return [label for label in labels if label["type"] == "user"]


def resolve_label_names(
    eligible_names: list[str], labels: list[dict[str, str]],
) -> dict[str, Any]:
    """Resolve exact names against a freshly parsed account list, without I/O.

    Catalog IDs are internal identifiers, not evidence of Gmail identity. Never
    guess between duplicate account names or fall back to a system label.
    """
    by_name: dict[str, list[str]] = {}
    for label in labels:
        if label["type"] == "user":
            by_name.setdefault(label["name"], []).append(label["id"])
    resolved = []
    problems = []
    for name in eligible_names:
        ids = by_name.get(name, [])
        if len(ids) == 1:
            resolved.append({"name": name, "id": ids[0]})
        else:
            problems.append({
                "name": name, "reason": "missing" if not ids else "conflicting",
                "gmail_ids": ids,
            })
    return {"resolved_labels": resolved, "mapping_problems": problems}


async def discover_tools(session: ClientSession) -> dict[str, Any]:
    """Initialize the session and discover tools without calling any of them."""
    initialized = await session.initialize()
    names = []
    cursor = None
    seen_cursors = set()
    while True:
        page = await session.list_tools(cursor=cursor)
        names.extend(tool.name for tool in page.tools)
        cursor = page.nextCursor
        if not cursor:
            break
        if cursor in seen_cursors:
            raise GmailMCPError("Gmail MCP tool discovery returned a repeated cursor")
        seen_cursors.add(cursor)
    return {
        "server": {"name": initialized.serverInfo.name, "version": initialized.serverInfo.version},
        "available_tools": sorted(names),
    }


def require_tools(discovered: dict[str, Any], required: set[str]) -> None:
    if not required.issubset(discovered["available_tools"]):
        raise GmailMCPError("Required Gmail tools are unavailable; check mounted OAuth credentials and granted scopes")


async def read_tool(session: ClientSession, name: str, arguments: dict[str, Any]) -> Any:
    """Application-owned allowlist; no configuration or model can request writes."""
    if name not in {"list_email_labels", "search_emails", "read_email"}:
        raise GmailMCPError("This application command permits only read-only Gmail tools")
    return await session.call_tool(name, arguments)


async def inspect_session(session: ClientSession) -> dict[str, Any]:
    discovered = await discover_tools(session)
    require_tools(discovered, {"list_email_labels"})
    labels = parse_label_result(await read_tool(session, "list_email_labels", {}))
    return {**discovered, "user_label_count": len(labels), "labels": labels}


@asynccontextmanager
async def open_session(
    settings: dict[str, Any], *, allow_label_creation: bool = False,
    allow_message_labeling: bool = False,
) -> AsyncIterator[ClientSession]:
    """Keep the shared MCP lifecycle and total Gmail-operation timeout in one place."""
    check_credentials(settings, require_message_labeling=allow_message_labeling)
    parameters = StdioServerParameters(
        command="gmail-mcp",
        env={
            "PATH": os.environ.get("PATH", os.defpath),
            "GMAIL_OAUTH_PATH": settings["oauth_path"],
            "GMAIL_CREDENTIALS_PATH": settings["credentials_path"],
            "GMAIL_MCP_STATE_DIR": "/tmp/noemi-gmail-mcp",
            "GMAIL_MCP_DRY_RUN": "false" if allow_label_creation or allow_message_labeling else "true",
            "GMAIL_MCP_TIMEOUT_MS": str(max(1, int(settings["timeout_seconds"] * 1000))),
        },
    )
    # The server can log OAuth errors with private details. Do not forward stderr.
    with open(os.devnull, "w") as server_errors:
        async with asyncio.timeout(settings["timeout_seconds"]):
            async with stdio_client(parameters, errlog=server_errors) as (read, write):
                async with ClientSession(read, write) as session:
                    yield session


async def connection_check(settings: dict[str, Any]) -> dict[str, Any]:
    async with open_session(settings) as session:
        return await inspect_session(session)


def parse_search_result(result: Any, maximum: int) -> list[str]:
    """Parse the pinned search response and reject excess or duplicate messages."""
    text = tool_text(result, "search")
    lines = [line for line in text.splitlines() if line]
    if len(lines) % 4:
        raise GmailMCPError("Unexpected Gmail MCP search response format")
    message_ids = []
    for position in range(0, len(lines), 4):
        group = lines[position:position + 4]
        if any(not line.startswith(prefix) for line, prefix in zip(group, ("ID: ", "Subject: ", "From: ", "Date: "))):
            raise GmailMCPError("Unexpected Gmail MCP search response format")
        message_id = group[0][4:]
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", message_id):
            raise GmailMCPError("Gmail search returned an invalid message ID")
        message_ids.append(message_id)
    if len(message_ids) > maximum or len(message_ids) != len(set(message_ids)):
        raise GmailMCPError("Gmail search exceeded the message limit or returned duplicate IDs")
    return message_ids


def parse_email_result(result: Any, body_max_characters: int) -> dict[str, str]:
    """Keep sender/subject and a bounded body prefix; ignore other header metadata."""
    text = tool_text(result, "message retrieval")
    header_text, separator, body = text.partition("\n\n")
    headers = {}
    for line in header_text.splitlines():
        name, delimiter, value = line.partition(": ")
        if not delimiter or name in headers:
            raise GmailMCPError("Unexpected Gmail MCP message header format")
        headers[name] = value
    required = {"Thread ID", "Message-ID", "Subject", "From", "To", "Date"}
    if not separator or not required.issubset(headers) or set(headers) - required - {"Cc", "Bcc"}:
        raise GmailMCPError("Incomplete Gmail MCP message response")
    # Remove only the pinned server's annotation, not arbitrary email text/HTML.
    html_note = "[Note: This email is HTML-formatted. Rendering the HTML body because the plain-text part was empty or a placeholder stub.]\n\n"
    body = body.removeprefix(html_note)
    return {"sender": headers["From"], "subject": headers["Subject"], "body": body[:body_max_characters]}


async def fetch_messages(
    settings: dict[str, Any], query: str, maximum: int, body_max_characters: int,
) -> dict[str, Any]:
    """Read one bounded search page; close MCP before inference begins."""
    async with open_session(settings) as session:
        discovered = await discover_tools(session)
        require_tools(discovered, {"list_email_labels", "search_emails", "read_email"})
        labels = parse_label_result(await read_tool(session, "list_email_labels", {}))
        result = await read_tool(session, "search_emails", {"query": query, "maxResults": maximum})
        message_ids = parse_search_result(result, maximum)
        messages = []
        for message_id in message_ids:
            result = await read_tool(session, "read_email", {
                "messageId": message_id, "format": "full", "maxBodyLength": 0,
                "includeAttachments": False,
            })
            email = parse_email_result(result, body_max_characters)
            messages.append({"id": message_id, "email": email})
        return {"user_labels": labels, "messages": messages}


async def search_time_window(settings: dict[str, Any], query: str, start: int, end: int) -> list[str]:
    """Cover a time window despite the pinned MCP's unpaginated 500-ID search.

    Split saturated windows, newest half first. One-second overlaps protect split
    boundaries; de-duplicate IDs. Refuse an unsplittable saturated window rather
    than silently declaring the mailbox complete.
    """
    async with open_session(settings) as session:
        discovered = await discover_tools(session)
        require_tools(discovered, {"search_emails"})

        async def search(lower: int, upper: int) -> list[str]:
            result = await read_tool(session, "search_emails", {
                "query": f"({query}) after:{lower - 1} before:{upper}", "maxResults": 500,
            })
            ids = parse_search_result(result, 500)
            if len(ids) < 500:
                return ids
            if upper - lower <= 1:
                raise GmailMCPError("Search saturated within one second; narrow the query before retrying")
            middle = (lower + upper) // 2
            newer = await search(middle, upper)
            older = await search(lower, middle)
            return list(dict.fromkeys(newer + older))

        return await search(start, end)


async def fetch_message_ids(
    settings: dict[str, Any], message_ids: list[str], body_max_characters: int,
) -> list[dict[str, Any]]:
    """Read only the already selected pending batch; never run a second search."""
    async with open_session(settings) as session:
        discovered = await discover_tools(session)
        require_tools(discovered, {"read_email"})
        messages = []
        for message_id in message_ids:
            response = await read_tool(session, "read_email", {
                "messageId": message_id, "format": "full", "maxBodyLength": 0,
                "includeAttachments": False,
            })
            messages.append({"id": message_id, "email": parse_email_result(response, body_max_characters)})
        return messages


def safe_diagnostic(error: Exception) -> str:
    if isinstance(error, GmailMCPError):
        return str(error)
    if isinstance(error, BaseExceptionGroup):
        for nested in error.exceptions:
            if isinstance(nested, (GmailMCPError, ExceptionGroup)):
                return safe_diagnostic(nested)
    if isinstance(error, TimeoutError):
        return "Gmail MCP timed out; check network access or increase timeout_seconds"
    return "Gmail MCP connection failed; check Docker dependencies, OAuth files, network access, and README troubleshooting"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gmail-config", type=Path, default=Path("config/gmail.example.json"))
    args = parser.parse_args()
    try:
        settings = load_gmail_config(args.gmail_config)
        result = asyncio.run(connection_check(settings))
    except Exception as error:
        parser.exit(2, f"Gmail connection check failed: {safe_diagnostic(error)}\n")
    except KeyboardInterrupt:
        parser.exit(130, "Gmail connection check interrupted.\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
