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
Copy-paste install prompt: [`../examples/grok-claude-plugin-prompt.md`](../examples/grok-claude-plugin-prompt.md).  
Routing policy: [`../agents/engineering/orchestrator/README.md`](../agents/engineering/orchestrator/README.md).

## Headless Runs

`claude -p` inherits the same user-level hooks, plugins, and MCP servers as the interactive session. A hook that waits for a person (a dictation tool, a notifier, a "keep working until I answer" helper) stalls a headless run at the end of every turn. Decision [2026-09-27-0001]:

- `claude --bare -p ...` for scripts: skips hooks, plugins, MCP servers, and CLAUDE.md discovery.
- `claude --settings templates/headless-agent-home/claude/settings.headless.json -p ...` when the run still needs plugins and CLAUDE.md; `disableAllHooks` takes precedence over user, project, and local settings for that invocation.
- Neither mode runs the repository's `.claude/settings.json` hooks. Neither this repository nor the platform ships a loop-owned Claude hook today; how one would be delivered to a headless run is an open design point to verify against the Claude Code documentation for the version in use.
- Verify before dispatch with `npm run check:headless -- --claude-settings <file>` or `--claude-bare`, together with the Grok home flags. Nothing invokes the gate automatically yet.

The Grok side of the same rule is in [`grok-build-claude-code.md`](grok-build-claude-code.md#headless-profile); the contract is [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md#10-headless-execution-control).

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
