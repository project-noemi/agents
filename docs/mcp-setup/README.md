# MCP Setup Guides

Developer-facing setup guides for configuring MCP (Model Context Protocol) integrations used by Project NoéMI agents.

> **Note:** These guides cover **infrastructure setup** (auth, connections, error handling). For **behavioral rules** that govern how agents use each MCP at runtime, see the protocol files in [`mcp-protocols/`](../../mcp-protocols/).

## Guides

| Guide | Covers | Protocol Files |
|-------|--------|----------------|
| [Google Workspace](google-workspace.md) | Gmail, Calendar, Chat, Contacts, Docs, Drive, Forms, Keep, Meet, Sheets, Slides, Admin | `mcp-protocols/gmail.md`, `google-calendar.md`, `google-chat.md`, `google-contacts.md`, `google-docs.md`, `google-drive.md`, `google-forms.md`, `google-keep.md`, `google-meet.md`, `google-sheets.md`, `google-slides.md`, `google-admin.md` |
| [Slack](slack.md) | Slack workspace integration | `mcp-protocols/slack.md` |
| [n8n](n8n.md) | n8n workflow orchestrator | `mcp-protocols/n8n.md` |
| [Web Search](web-search.md) | Built-in web_fetch / web_search | `mcp-protocols/web-search.md` |

## General Principles

All MCP integrations follow the **Fetch-on-Demand** security model defined in `AGENTS.md`:

- Secrets live in **1Password** or **Infisical** vaults — never hardcoded
- Use `op run --env-file=.env.template -- [command]` or `infisical run --env=dev -- [command]` for runtime injection
- Application code reads credentials from `process.env` — no `.env` parsing logic
