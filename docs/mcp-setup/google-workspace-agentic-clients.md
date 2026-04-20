# Google Workspace For Agentic Clients

This guide explains how to connect Google Workspace to the main local agentic clients used in Project NoeMI:

- Gemini CLI
- Antigravity, Google's IDE-style Gemini workspace layer
- OpenAI Codex
- Claude Code app
- Claude Code CLI

The important point is that **Google Workspace does not look the same in every client**.

If you want the most beginner-proof **single-machine** path first, start with [`gws-cli-machine-setup.md`](gws-cli-machine-setup.md). That gives Gemini CLI, Claude Code, and Codex one shared local Google Workspace command surface before you decide whether you also need MCP or n8n.

## Shared Local Foundation: `gws`

For a personal desktop or laptop, the simplest stable foundation is often:

1. install `gws`
2. authenticate `gws`
3. prove one read-only Google Workspace command
4. let Gemini, Claude, or Codex use that same local CLI

This avoids making a beginner debug three different Google auth stories at once.

## Fast Decision Rule

| Client | Preferred Path | Why |
|------|----------------|-----|
| Gemini CLI | `gws` + Gemini extension for local-machine use; official Workspace extension if you only care about Gemini | `gws` is the best shared desktop foundation, while the official Workspace extension remains a strong Gemini-only path |
| Antigravity | Follow the same Google account and Gemini setup discipline as Gemini CLI | Treat Gemini CLI as the setup anchor |
| OpenAI Codex | `gws` on the local machine first; MCP when you need a managed transport layer | Beginner-friendly first, then team-grade if needed |
| Claude Code app | `gws` on the local machine first; MCP when you need project- or team-scoped transport | Easier initial setup, then more structure later |
| Claude Code CLI | `gws` on the local machine first; MCP when you need explicit transport control | Keeps the first setup simpler |

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

For the shared-machine `gws` path:

```bash
gws auth setup
gemini extensions install https://github.com/googleworkspace/cli
gemini
```

If you want the step-by-step machine guide, use [`gws-cli-machine-setup.md`](gws-cli-machine-setup.md).

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

For a local machine, start with `gws` on `PATH` and let Codex use the shell first.

Use the MCP path when you need a reusable managed transport:

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

For a local machine, start with `gws` on `PATH` and let Claude use the shell first.

The more structured setup path is to register the server explicitly, then use the app as the interactive surface.

Example:

```bash
claude mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/google-workspace-mcp.js
```

Once the server is registered and tested, use the app for co-work and review. Do not assume the app should be configured first just because it feels more approachable.

## Claude Code CLI

For a local machine, start with `gws` on `PATH` and let Claude use the shell first.

Claude Code CLI also exposes the more explicit MCP path:

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

1. [`gws-cli-machine-setup.md`](gws-cli-machine-setup.md) for the shared local Google Workspace foundation
2. Gemini CLI when Google Workspace is your main daily surface
3. Antigravity for a more visual Google-side workflow
4. Codex or Claude Code when Google must be one tool among several governed integrations
5. MCP when you need a more managed, reusable transport layer than local shell usage

## Related Guides

- [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
- [`gws-cli-machine-setup.md`](gws-cli-machine-setup.md)
- [`../tool-usages/google-local-workspace.md`](../tool-usages/google-local-workspace.md)
- [`../tool-usages/claude-code-local-workspace.md`](../tool-usages/claude-code-local-workspace.md)
- [`../tool-usages/openai-codex-local-workspace.md`](../tool-usages/openai-codex-local-workspace.md)
- [`google-workspace.md`](google-workspace.md)
