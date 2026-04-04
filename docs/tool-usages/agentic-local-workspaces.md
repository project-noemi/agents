# Agentic Local Workspaces

Project NoeMI treats Gemini CLI, Claude Code, and OpenAI Codex as **local agentic workspaces**, not just coding tools.

They can absolutely write and review code, but that is only one slice of the job. In practice, Builders, Practitioners, and Accelerators also use them to:

- inspect repositories and operating environments
- normalize documents and operating procedures
- review prompts, workflows, and security boundaries
- run repeatable local automation
- connect governed MCP tools to business systems such as Google Workspace, Slack, GitHub, or Microsoft 365

## Why The CLI Matters

For NoeMI, the CLI is not a scary developer ritual. It is a chat surface that happens to sit closer to the machine.

That matters because the CLI is the layer that is easiest to:

- run under `infisical run` or `op run`
- version and document
- reproduce on another workstation
- use over SSH, WSL, or remote shells
- connect to local scripts, worktrees, and MCP servers

The visual surfaces are valuable, but the CLI is usually the most durable source of truth.

## NoeMI Taxonomy

- **Explorers** do not need deep CLI fluency. They mostly need to understand what these tools are and when to ask for help.
- **Builders / Practitioners** should get comfortable launching the CLI, approving actions, and running a few safe commands.
- **Accelerators** should be able to standardize local environments, secret-injection patterns, MCP setup, and repeatable workflows across teams.

## The Three Main Stacks

| Stack | CLI | Visual Surface | Best Fit | Main Tradeoff |
|------|-----|----------------|----------|---------------|
| Google | Gemini CLI | Antigravity, Google's IDE-style Gemini workspace layer | Google-heavy local work, fast iteration, Workspace-first flows | Google Workspace has a strong first-party path, but not every external business system is equally turnkey |
| Anthropic | Claude Code CLI | Claude Code app | Co-work, repository understanding, interactive editing, MCP-rich local work | Strong interactive experience, but teams still need discipline around repeatable CLI setup |
| OpenAI | Codex CLI | Codex app and IDE surfaces | Local agentic execution, reviews, worktrees, governed automation, OpenAI-native workflows | Powerful local/project controls, but setup is clearer for practitioners once the CLI basics click |

## Advantages Of CLI-First Builders

- easier SecretOps discipline
- easier to teach approval and sandbox habits
- simpler to automate
- fewer mysteries when something breaks
- easier to share exact working commands with a cohort or client

## Advantages Of The Visual Tools

- less intimidating at first contact
- easier multi-pane context for documents, code, and terminal output
- better for interactive co-work and inspection
- better for people who are still building confidence

## Disadvantages To Be Honest About

### CLI Friction

- the terminal can feel unfamiliar
- permission flags and config names can look technical
- users may fear they can "break everything" when they usually cannot

### Visual Tool Friction

- hidden state is harder to debug
- people can forget what was configured under the hood
- it is easier to drift away from reproducible team habits

## NoeMI Recommendation

For Builders, Practitioners, and Accelerators:

1. Learn the CLI first at a basic comfort level.
2. Use the visual surface as the friendlier cockpit.
3. Keep secret injection, MCP wiring, and reusable commands anchored in the CLI.

That gives you the best of both worlds: a less intimidating daily workspace and a more reliable operating foundation.

## Where To Go Next

- [`google-local-workspace.md`](google-local-workspace.md)
- [`claude-code-local-workspace.md`](claude-code-local-workspace.md)
- [`openai-codex-local-workspace.md`](openai-codex-local-workspace.md)
- [`../mcp-setup/google-workspace-agentic-clients.md`](../mcp-setup/google-workspace-agentic-clients.md)
- [`../mcp-setup/microsoft-365-agentic-clients.md`](../mcp-setup/microsoft-365-agentic-clients.md)
