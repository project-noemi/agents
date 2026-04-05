# Google Workspace For Agentic Clients

This guide explains how to connect Google Workspace to the main local agentic clients used in Project NoeMI:

- Gemini CLI
- Antigravity, Google's IDE-style Gemini workspace layer
- OpenAI Codex
- Claude Code app
- Claude Code CLI

The important point is that **Google Workspace does not look the same in every client**.

## Fast Decision Rule

| Client | Preferred Path | Why |
|------|----------------|-----|
| Gemini CLI | Official Google Workspace extension | This is the cleanest first-party Google path |
| Antigravity | Follow the same Google account and Gemini setup discipline as Gemini CLI | Treat Gemini CLI as the setup anchor |
| OpenAI Codex | MCP server | Codex is strongest when Google access is exposed through MCP |
| Claude Code app | MCP server | Durable and team-repeatable |
| Claude Code CLI | MCP server | Most explicit and scriptable path |

## Shared Security Rule

Do not paste Google OAuth secrets or refresh tokens into saved client config.

If the Google connection depends on a custom MCP server, register the **wrapper command**, not the secret itself.

Safe pattern:

```bash
op run --env-file=.env.template -- node path/to/google-workspace-mcp.js
```

Unsafe pattern:

- storing `GOOGLE_CLIENT_SECRET` directly in a local config file
- hardcoding bearer tokens in headers that get saved to disk

## Gemini CLI

For direct Google Workspace access, use the official Workspace extension:

```bash
gemini extensions install https://github.com/gemini-cli-extensions/workspace
gemini
```

Then complete the normal Google sign-in flow.

Use this path when you want:

- Drive search
- Docs summarization
- Gmail and Calendar assistance
- human-led local work

If you need a **custom** Google Workspace MCP server instead of the official extension:

```bash
gemini mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/google-workspace-mcp.js
```

## Antigravity

Treat Antigravity as the visual Google workspace layer on top of Gemini habits.

Recommended pattern:

1. Validate the Google connection in Gemini CLI first.
2. Confirm the correct Workspace account is in use.
3. Reuse the same extension and MCP discipline when working in Antigravity.

That reduces the chance that a builder trusts a visual surface whose underlying auth state they do not actually understand.

## OpenAI Codex

Codex uses the MCP path for Google Workspace work:

```bash
codex mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/google-workspace-mcp.js
```

For HTTP MCP servers:

```bash
codex mcp add googleWorkspace --url https://your-google-mcp.example.com/mcp
```

Validate with a low-risk read first:

- list a Drive file
- read a document title
- inspect calendar availability without writing changes

## Claude Code App

The durable setup path is still to register the server explicitly, then use the app as the interactive surface.

Example:

```bash
claude mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/google-workspace-mcp.js
```

Once the server is registered and tested, use the app for co-work and review. Do not assume the app should be configured first just because it feels more approachable.

## Claude Code CLI

Claude Code CLI exposes the most explicit setup path:

```bash
claude mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/google-workspace-mcp.js
```

Or for an HTTP MCP endpoint:

```bash
claude mcp add --transport http googleWorkspace https://your-google-mcp.example.com/mcp
```

Keep verification simple:

1. Read from Drive.
2. Read from Docs or Calendar.
3. Only then allow writes such as drafting or document creation.

## Recommended Order

1. Gemini CLI when Google Workspace is your main daily surface
2. Antigravity for a more visual Google-side workflow
3. Codex or Claude Code when Google must be one tool among several governed MCP integrations

## Related Guides

- [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
- [`../tool-usages/google-local-workspace.md`](../tool-usages/google-local-workspace.md)
- [`../tool-usages/claude-code-local-workspace.md`](../tool-usages/claude-code-local-workspace.md)
- [`../tool-usages/openai-codex-local-workspace.md`](../tool-usages/openai-codex-local-workspace.md)
- [`google-workspace.md`](google-workspace.md)
