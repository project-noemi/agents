# MCP Setup Guides

Developer-facing setup guides for configuring MCP (Model Context Protocol) integrations used by Project NoéMI agents.

> **Note:** These guides cover **infrastructure setup** (auth, connections, error handling). For **behavioral rules** that govern how agents use each MCP at runtime, see the protocol files in [`mcp-protocols/`](../../mcp-protocols/).

## Guides

| Guide | Covers | Protocol Files |
|-------|--------|----------------|
| [Google Workspace](google-workspace.md) | Gmail, Calendar, Chat, Contacts, Docs, Drive, Forms, Keep, Meet, Sheets, Slides, Admin | `mcp-protocols/gmail.md`, `mcp-protocols/google-calendar.md`, `mcp-protocols/google-chat.md`, `mcp-protocols/google-contacts.md`, `mcp-protocols/google-docs.md`, `mcp-protocols/google-drive.md`, `mcp-protocols/google-forms.md`, `mcp-protocols/google-keep.md`, `mcp-protocols/google-meet.md`, `mcp-protocols/google-sheets.md`, `mcp-protocols/google-slides.md`, `mcp-protocols/google-admin.md` |
| [Google Workspace For Agentic Clients](google-workspace-agentic-clients.md) | How Gemini CLI, Antigravity, Codex, and Claude Code connect to Google Workspace | Cross-cutting guide |
| [Google + n8n Credential Matrix](google-n8n-credential-matrix.md) | How Gemini CLI, generic Google MCP auth, n8n Google nodes, and n8n Gemini credentials differ | Cross-cutting guide |
| [Microsoft 365 For Agentic Clients](microsoft-365-agentic-clients.md) | How Gemini CLI, Antigravity, Codex, and Claude Code connect to Microsoft 365 / Office 365 | Cross-cutting guide |
| [Slack](slack.md) | Slack workspace integration | `mcp-protocols/slack.md` |
| [n8n](n8n.md) | n8n workflow orchestrator | `mcp-protocols/n8n.md` |
| [Web Search](web-search.md) | Built-in web_fetch / web_search | `mcp-protocols/web-search.md` |

## General Principles

All MCP integrations follow the **Fetch-on-Demand** security model defined in `AGENTS.md`:

- Secrets live in **1Password** or **Infisical** vaults — never hardcoded
- Use `op run --env-file=.env.template -- [command]` or `infisical run --env=dev -- [command]` for runtime injection
- Application code reads credentials from `process.env` — no `.env` parsing logic
