# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Preview or explicitly create missing Gmail user labels for the five base categories."""

import argparse
import asyncio
import json
import re
from pathlib import Path
from typing import Any

from mcp import ClientSession

from noemi_mailsort import audit_log, gmail_mcp
from noemi_mailsort.prompts import load_catalog


BASE_CATALOG = Path(__file__).resolve().parents[2] / "config/labels.example.json"


async def setup_session(session: ClientSession, *, apply: bool = False) -> dict[str, Any]:
    """Only create missing names from the shipped catalog; never modify messages."""
    names = [label["name"] for label in load_catalog(BASE_CATALOG)["labels"]]
    discovered = await gmail_mcp.discover_tools(session)
    gmail_mcp.require_tools(discovered, {"list_email_labels"})
    existing = gmail_mcp.parse_label_result(await gmail_mcp.read_tool(session, "list_email_labels", {}))
    by_name = {label["name"]: label["id"] for label in existing}
    missing = [name for name in names if name not in by_name]
    can_create = "create_label" in discovered["available_tools"]
    rows = [
        {"name": name, "id": by_name.get(name), "action": "existing" if name in by_name else "would_create"}
        for name in names
    ]
    if not apply:
        return {"dry_run": True, "can_create": can_create, "missing_count": len(missing), "labels": rows}
    if missing and not can_create:
        raise gmail_mcp.GmailMCPError("create_label is unavailable; authorize gmail.modify or gmail.labels before applying setup")

    created = {}
    for name in missing:
        # This is the only write call in this setup command. Names come from the
        # shipped catalog, never model output or the user's imported catalog.
        result = await session.call_tool("create_label", {"name": name})
        text = gmail_mcp.tool_text(result, "base label creation")
        # Gmail may omit type from the create response; the pinned JS formatter
        # renders that as undefined/null. Verify user type via the final listing.
        match = re.fullmatch(r"Label created successfully:\nID: ([^\n]+)\nName: ([^\n]+)\nType: (?:user|undefined|null)", text)
        if not match or match[2] != name or not match[1].strip():
            raise gmail_mcp.GmailMCPError("Unexpected label creation response; rerun the preview to inspect account state")
        created[name] = match[1]

    if created:
        current = gmail_mcp.parse_label_result(await gmail_mcp.read_tool(session, "list_email_labels", {}))
        by_name = {label["name"]: label["id"] for label in current}
        if any(by_name.get(name) != label_id for name, label_id in created.items()):
            raise gmail_mcp.GmailMCPError("Created labels could not be verified in the account; rerun the preview")
        for name, label_id in created.items():
            audit_log.emit("setup", "Create missing Gmail base labels",
                           inputs=[{"label_name": name}], actions=[{"created_label_id": label_id}],
                           risks=[], result="created")
    return {
        "dry_run": False, "created_count": len(created), "existing_count": len(names) - len(created),
        "labels": [
            {"name": name, "id": by_name[name], "action": "created" if name in created else "existing"}
            for name in names
        ],
    }


async def setup_base_labels(settings: dict[str, Any], *, apply: bool = False) -> dict[str, Any]:
    async with gmail_mcp.open_session(settings, allow_label_creation=apply) as session:
        return await setup_session(session, apply=apply)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gmail-config", type=Path, default=Path("config/gmail.example.json"))
    parser.add_argument("--apply", action="store_true", help="Create missing base labels in Gmail; default is a read-only preview")
    args = parser.parse_args()
    try:
        settings = gmail_mcp.load_gmail_config(args.gmail_config)
        result = asyncio.run(setup_base_labels(settings, apply=args.apply))
    except Exception as error:
        message = gmail_mcp.safe_diagnostic(error)
        suffix = " Earlier creations may have succeeded; rerun without --apply to inspect." if args.apply else ""
        if args.apply:
            audit_log.emit("setup", "Create missing Gmail base labels", inputs=[], actions=[],
                           risks=[message], result="error")
        parser.exit(2, f"Base label setup failed: {message}.{suffix}\n")
    except KeyboardInterrupt:
        if args.apply:
            audit_log.emit("setup", "Create missing Gmail base labels", inputs=[], actions=[],
                           risks=["Base label setup interrupted"], result="interrupted")
        parser.exit(130, "Base label setup interrupted; rerun the preview to inspect account state.\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
