# Google Local Workspace

This guide explains the Google stack as a **local agentic workspace**:

- **Gemini CLI** as the operational core
- **Antigravity** as Google's IDE-style Gemini workspace layer

For NoeMI, the key idea is simple: Antigravity makes the experience friendlier, but Gemini CLI is still the layer that teaches durable builder habits.

If your actual problem is "how do I get Google Workspace working on this machine for Gemini, Claude, and Codex without losing my mind?", start with [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md).

## What This Stack Is Good At

- Google Workspace-heavy day-to-day work
- document research and synthesis
- drive and calendar exploration
- moving from ad-hoc work into governed automation

## Why Gemini CLI Matters

Gemini CLI is not just a coding shell. It is the easiest Google-side surface to:

- launch under `infisical run` or `op run`
- connect to MCP servers
- install and manage extensions
- run from SSH, WSL, or a remote shell
- standardize across a practitioner cohort

Local command surfaces available in the current CLI include:

```bash
gemini mcp
gemini extensions
gemini skills
```

## Where Antigravity Fits

Antigravity is Google's IDE-style Gemini workspace layer. It is useful when you want:

- a more visual multi-pane environment
- interactive review of files and outputs
- a smoother on-ramp for less terminal-comfortable builders

The practical NoeMI stance is:

- use Gemini CLI to establish the working setup
- use Antigravity as the visual operating layer on top of that

## Recommended Configuration Pattern

### 1. Start With Gemini CLI

Install and validate Gemini CLI first. This keeps the setup reproducible even if a builder later prefers Antigravity.

If you are using Google Workspace directly, the supported first-party route is the Workspace extension:

```bash
gemini extensions install https://github.com/gemini-cli-extensions/workspace
```

See [`gemini-workspace-quickstart.md`](gemini-workspace-quickstart.md) for the Google-first path.
If you want one shared local Google Workspace substrate across Gemini, Claude, and Codex, use [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md).

### 2. Add MCP Servers When You Need Non-Google Systems

Gemini CLI supports MCP server management directly:

```bash
gemini mcp add my-server -- op run --env-file=.env.template -- node path/to/server.js
```

This pattern matters because it preserves Project NoeMI's Phase 0 security model. The config stores the launcher command, not the underlying secrets.

### 3. Keep Secret Injection Outside The Client Config

Do not paste OAuth tokens, API keys, or Microsoft / Google client secrets into local config files.

Prefer wrapper-based launches such as:

```bash
infisical run --env=dev -- gemini
op run --env-file=.env.template -- gemini
```

### 4. Then Use Antigravity As The Friendlier Surface

Once Gemini CLI, extensions, and any MCP server launches are understood, Antigravity becomes much easier to trust. The builder knows what is happening under the hood instead of treating the IDE as magic.

## Strengths

- strong fit for Google Workspace-first teams
- approachable path from chat to local automation
- good balance between ad-hoc work and governed tool use

## Weaknesses

- builders can over-rely on the visual layer and skip CLI habits
- Google Workspace is the cleanest first-party story; other suites often still require MCP discipline

## Recommended Next Docs

- [`agentic-local-workspaces.md`](agentic-local-workspaces.md)
- [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md)
- [`gemini-workspace-quickstart.md`](gemini-workspace-quickstart.md)
- [`../mcp-setup/google-workspace-agentic-clients.md`](../mcp-setup/google-workspace-agentic-clients.md)
- [`../mcp-setup/microsoft-365-agentic-clients.md`](../mcp-setup/microsoft-365-agentic-clients.md)

## Official References

- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [Google Workspace extension for Gemini CLI](https://github.com/gemini-cli-extensions/workspace)
