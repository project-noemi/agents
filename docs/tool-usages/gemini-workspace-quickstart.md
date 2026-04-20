# Gemini CLI + Google Workspace Quickstart

This is the supported path for a human using Gemini CLI directly with Google Workspace.

Use this guide when you want ad-hoc, interactive work such as:

- searching Google Drive
- summarizing Google Docs
- checking Gmail or Calendar manually
- drafting content before handing it to another system

This path uses the official Google Workspace extension for Gemini CLI. It does **not** use the generic `GOOGLE_CLIENT_ID` / `GOOGLE_REFRESH_TOKEN` environment-variable pattern described in the generic MCP setup guide, and it does **not** configure n8n credentials.

If you specifically want the newer **shared-machine** `gws` CLI path that can also be used by Claude Code and Codex on the same workstation, start with [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md) first.

For the broader comparison between Gemini CLI, Antigravity, Claude Code, and Codex as local agentic workspaces, start with [`agentic-local-workspaces.md`](agentic-local-workspaces.md) and [`google-local-workspace.md`](google-local-workspace.md).

If you want repeatable event-driven automation, use [`../examples/n8n-google-workspace-quickstart.md`](../examples/n8n-google-workspace-quickstart.md) instead.

## What This Path Is Good For

- individual builders and operators
- discovery work and document lookup
- low-volume, human-reviewed tasks
- prototyping before converting a flow into n8n

## What This Path Is Not

- not the right path for background automation
- not the right path for shared team credentials
- not the right path for webhook-driven business workflows
- not a replacement for n8n credential setup

## Prerequisites

- Gemini CLI installed
- a Google account or Google Workspace account
- a local browser for sign-in, or a headless environment where you can complete the extension's headless login flow
- this repository checked out locally

## Step 1: Install the Google Workspace Extension

```bash
gemini extensions install https://github.com/gemini-cli-extensions/workspace
```

This installs the official Workspace extension, which gives Gemini CLI access to Google Docs, Drive, Calendar, Gmail, and related Workspace surfaces.

## Step 2: Authenticate the Extension

For most local setups, start Gemini CLI and complete the normal Google sign-in flow:

```bash
gemini
```

For SSH, WSL, Cloud Shell, or another environment without a browser, use the extension's headless login flow as documented by the extension repository.

## Step 3: Activate Only the Google Protocols You Actually Need

Edit [`mcp.config.json`](../../mcp.config.json) so the generated context includes only the Google protocols relevant to the task at hand.

Example for lightweight document research:

```json
{
  "active_mcps": [
    "google-docs",
    "google-drive"
  ]
}
```

Example for executive-assistant style work:

```json
{
  "active_mcps": [
    "gmail",
    "google-calendar",
    "google-drive"
  ]
}
```

## Step 4: Regenerate Context

```bash
node scripts/generate_all.js
npm run validate
```

This keeps `GEMINI.md` aligned with the Google surfaces you actually intend to use.

## Step 5: Start Gemini with the Right Security Wrapper

If your session also needs non-Google secrets, run Gemini under `infisical run` or `op run` as usual:

```bash
infisical run --env=dev -- gemini
```

If the task only needs the Workspace extension and no additional secrets, a normal `gemini` launch is enough.

## First Tasks to Prove the Setup

Start with low-risk reads:

- "Find the Google Doc named 'Quarterly Planning' in Drive."
- "Summarize the last update made to that document."
- "What is on my calendar tomorrow?"

Only after that should you move into mutating actions such as drafting emails or creating documents.

## Common Mistakes

- setting `GOOGLE_CLIENT_ID` and expecting Gemini CLI to automatically use it
- assuming n8n Google credentials configure Gemini CLI
- enabling every Google protocol in `mcp.config.json` instead of the minimum needed set
- using this path for unattended background automation

## Security Notes

The Workspace extension can read and modify Workspace data. Do not aim it at untrusted documents, emails, or shared content without human review. Treat Workspace data as a potential indirect prompt-injection surface.

## Related Guides

- [`gemini-mcp-setup.md`](gemini-mcp-setup.md) for modular context generation
- [`agentic-local-workspaces.md`](agentic-local-workspaces.md) for the builder-facing local workspace model
- [`google-local-workspace.md`](google-local-workspace.md) for Gemini CLI plus Antigravity positioning
- [`../mcp-setup/google-workspace.md`](../mcp-setup/google-workspace.md) for generic Google MCP server auth patterns
- [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md) for the shared-machine `gws` setup
- [`../mcp-setup/google-workspace-agentic-clients.md`](../mcp-setup/google-workspace-agentic-clients.md) for Google Workspace across Gemini, Antigravity, Codex, and Claude Code
- [`../examples/n8n-google-workspace-quickstart.md`](../examples/n8n-google-workspace-quickstart.md) for repeatable automation
- [`../mcp-setup/google-n8n-credential-matrix.md`](../mcp-setup/google-n8n-credential-matrix.md) for Google vs n8n credential troubleshooting
