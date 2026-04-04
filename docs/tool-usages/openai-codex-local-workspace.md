# OpenAI Codex Local Workspace

OpenAI Codex is also best understood as a local agentic workspace, not merely a coding assistant.

The important pair is:

- **Codex CLI** for the durable operating surface
- **Codex app** for interactive local work, project actions, and visual review

## Why It Is More Than A Coding Tool

Codex is useful for:

- code generation and review
- local repository operations
- governed task execution
- project-specific setup actions
- MCP-driven access to external systems
- repeatable automation and non-interactive runs

## Why The CLI Matters

Codex CLI exposes the most reproducible working model:

```bash
codex
codex exec
codex review
codex mcp add
```

It also uses a documented user config file at `~/.codex/config.toml`.

OpenAI's docs also document MCP setup from the CLI and note that the MCP configuration is shared between the CLI and IDE extension.

## Where The App Fits

The Codex app is valuable when you want a friendlier local cockpit around the same project:

- project actions
- worktree setup
- integrated local terminal actions
- richer inspection of state while staying inside the repo

OpenAI's local-environments docs also describe project-level setup scripts and actions stored inside the project's `.codex` folder, which makes the app especially useful for standardizing a team workspace once the CLI basics are already understood.

## Recommended Configuration Pattern

### 1. Start With Codex CLI

Use the CLI to establish authentication, model defaults, and MCP connections first.

For MCP:

```bash
codex mcp add my-server --url https://example.com/mcp
```

For local stdio servers that need vault-backed credentials:

```bash
codex mcp add microsoft365 -- op run --env-file=.env.template -- node path/to/server.js
```

This keeps secret resolution in the wrapper, not in the saved config.

### 2. Use The App For Shared Project Actions

After the CLI is working, use the app's local-environment features to define shared setup scripts and common actions in `.codex/`. That is a strong NoeMI fit for Accelerators who want to make a builder environment more repeatable.

### 3. Keep Google And Microsoft Integrations MCP-Based

Unlike Gemini's Google Workspace extension path, the clean Codex story for Google Workspace and Microsoft 365 is the MCP route.

## Strengths

- strong local agent execution model
- excellent fit for review, automation, and worktrees
- good project-level environment standardization

## Weaknesses

- practitioners benefit from a little CLI coaching before the tool feels natural
- teams need to stay disciplined about where MCP setup lives

## Recommended Next Docs

- [`agentic-local-workspaces.md`](agentic-local-workspaces.md)
- [`../mcp-setup/google-workspace-agentic-clients.md`](../mcp-setup/google-workspace-agentic-clients.md)
- [`../mcp-setup/microsoft-365-agentic-clients.md`](../mcp-setup/microsoft-365-agentic-clients.md)

## Official References

- [Codex docs](https://developers.openai.com/codex)
- [Codex Docs MCP](https://developers.openai.com/learn/docs-mcp)
- [Codex local environments](https://developers.openai.com/codex/app/local-environments)
