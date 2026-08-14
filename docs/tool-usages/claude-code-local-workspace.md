# Claude Code Local Workspace

Claude Code should be understood as a local agentic workspace with two complementary surfaces:

- **Claude Code CLI** for the durable, automatable operating layer
- **Claude Code app** for interactive co-work, review, and a less intimidating daily experience

## Why It Is More Than A Coding Tool

In NoeMI, Claude Code is useful for far more than code generation. It is also strong at:

- repository comprehension
- PR and change review
- local workflow cleanup
- documentation work
- MCP-driven business operations
- governance-sensitive human-in-the-loop tasks

## Why The CLI Still Matters

The CLI gives Builders, Practitioners, and Accelerators a repeatable place to learn:

- worktrees
- permission modes
- non-interactive runs
- MCP registration
- portable launch commands

If the immediate goal is Google Workspace on a real desktop or laptop, start with [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md) before you build out a broader MCP story.

Useful surfaces exposed by the current CLI include:

```bash
claude mcp
claude --worktree
claude --print
```

## Where The App Fits

The Claude Code app is the friendlier co-work surface. It is better when you want:

- a more guided interactive experience
- less terminal anxiety
- inspection and editing with richer local context

The app is not a separate philosophy. It works best when the team still understands the CLI underneath it.

## Recommended Configuration Pattern

### 1. Configure MCP Through Durable Commands

Claude Code supports direct MCP registration:

```bash
claude mcp add --transport http my-server https://example.com/mcp
```

For local stdio servers that need vault-backed credentials, keep the launcher wrapped:

```bash
claude mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/server.js
```

That pattern avoids storing raw secrets in config.

### 2. Use Project Or Repo MCP Config Where Helpful

Claude Code also supports `--mcp-config` and project-scoped MCP configuration. That is useful when a team wants repeatable setup inside a repository rather than ad-hoc per-user memory.

### 3. Use The App After The CLI Baseline Is Clear

Once the MCP and secret-injection model is understood, the app becomes safer to scale across a cohort because people can reason about what is happening when something fails.

## Strengths

- excellent co-work experience
- strong repository reasoning
- flexible MCP management
- good bridge between visual comfort and local automation

## Weaknesses

- users can forget which behavior came from app state vs project state
- teams still need explicit Phase 0 setup discipline

## Multi-Model Bridges Inside Claude Code

Claude Code can stay the host workspace while a second model family challenges or rescues work:

| Bridge | Plugin | Typical use |
|--------|--------|-------------|
| Grok Build | [`xai-org/grok-build-plugin-cc`](https://github.com/xai-org/grok-build-plugin-cc) | Independent review, design critique, write-capable delegate, Claude→Grok session import |
| OpenAI Codex | `openai/codex-plugin-cc` | gpt-class bulk work, Codex review gate, rescue loops |

Operator guide for Grok: [`grok-build-claude-code.md`](grok-build-claude-code.md).  
Routing policy: [`../agents/engineering/orchestrator/README.md`](../agents/engineering/orchestrator/README.md).

## Recommended Next Docs

- [`grok-build-claude-code.md`](grok-build-claude-code.md)
- [`agentic-local-workspaces.md`](agentic-local-workspaces.md)
- [`openai-codex-local-workspace.md`](openai-codex-local-workspace.md)
- [`../agents/engineering/orchestrator/README.md`](../agents/engineering/orchestrator/README.md)
- [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md)
- [`../mcp-setup/google-workspace-agentic-clients.md`](../mcp-setup/google-workspace-agentic-clients.md)
- [`../mcp-setup/microsoft-365-agentic-clients.md`](../mcp-setup/microsoft-365-agentic-clients.md)

## Official References

- [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Grok Build ↔ Claude Code Bridge](https://github.com/xai-org/grok-build-plugin-cc)
