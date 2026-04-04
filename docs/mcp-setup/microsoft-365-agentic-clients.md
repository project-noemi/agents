# Microsoft 365 For Agentic Clients

This guide explains how to connect Microsoft 365, also commonly called Office 365, to the main local agentic clients used in Project NoeMI:

- Gemini CLI
- Antigravity, Google's IDE-style Gemini workspace layer
- OpenAI Codex
- Claude Code app
- Claude Code CLI

Unlike Gemini's first-party Google Workspace extension path, the Microsoft 365 story in this repository is standardized around **MCP servers**.

## What "Microsoft 365" Usually Means Here

Most teams want one or more of:

- Outlook
- OneDrive
- SharePoint
- Teams
- directory and calendar access through Microsoft Graph

## Shared Security Rule

Do not store Microsoft tenant secrets, client secrets, or bearer tokens directly in saved local client config.

Prefer wrapper-based MCP launches so Entra ID or Graph credentials are resolved only at runtime:

```bash
op run --env-file=.env.template -- node path/to/microsoft-365-mcp.js
```

## Common Prerequisites

Before any client-specific setup:

1. Register or obtain a Microsoft 365 / Graph-capable MCP server.
2. Create the required Entra ID app registration or service principal.
3. Grant only the minimum Graph scopes required.
4. Verify the MCP server can perform one read-only action before enabling writes.

## Gemini CLI

Microsoft 365 in Gemini CLI is handled through MCP:

```bash
gemini mcp add microsoft365 -- op run --env-file=.env.template -- node path/to/microsoft-365-mcp.js
```

Use this path when Gemini is your preferred local shell but the business system is Microsoft-first.

## Antigravity

For Antigravity, the safest pattern is still:

1. configure the Microsoft 365 MCP path from Gemini CLI first
2. verify read-only access
3. use Antigravity as the visual operating layer

That keeps the IDE-style experience grounded in the same repeatable setup.

## OpenAI Codex

Codex uses the same MCP-first pattern:

```bash
codex mcp add microsoft365 -- op run --env-file=.env.template -- node path/to/microsoft-365-mcp.js
```

Or with an HTTP MCP endpoint:

```bash
codex mcp add microsoft365 --url https://your-m365-mcp.example.com/mcp
```

Good first checks:

- list a OneDrive folder
- read a calendar event
- inspect a SharePoint document title

## Claude Code App

Register the Microsoft 365 MCP server first, then use the app as the interactive surface:

```bash
claude mcp add microsoft365 -- op run --env-file=.env.template -- node path/to/microsoft-365-mcp.js
```

That keeps the saved client setup free of raw credentials.

## Claude Code CLI

The CLI path is the most explicit:

```bash
claude mcp add microsoft365 -- op run --env-file=.env.template -- node path/to/microsoft-365-mcp.js
```

Or for a hosted MCP service:

```bash
claude mcp add --transport http microsoft365 https://your-m365-mcp.example.com/mcp
```

## Recommended Verification Order

1. Outlook or calendar read
2. OneDrive or SharePoint read
3. Teams or write operations only after the read path is stable

## Related Guides

- [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
- [`../tool-usages/google-local-workspace.md`](../tool-usages/google-local-workspace.md)
- [`../tool-usages/claude-code-local-workspace.md`](../tool-usages/claude-code-local-workspace.md)
- [`../tool-usages/openai-codex-local-workspace.md`](../tool-usages/openai-codex-local-workspace.md)
