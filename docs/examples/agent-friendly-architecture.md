# Agent-Friendly Architecture

An agent starts each task with little context. It finds its way by reading the tree, searching for similar code, and copying what it finds. A repository is agent-friendly when that behaviour leads to the right answer: the shortest path through the code is also the correct one.

This guide adapts ideas from the AI Engineer CODE 2026 talk "All Code Is Slop (Except Mine)", where good API design and architecture are the first layer of an agent's environment, ahead of lint, verification, and prose rules. It uses this repository as the worked example.

## Principles

1. **Boundaries are visible in the tree.** A reader should be able to tell from paths alone what a file is for and who owns it.
2. **The easiest path is the correct path.** If a safe helper exists, it should be the one an agent finds first; unsafe shortcuts should be absent, not merely discouraged.
3. **One source per fact.** Generated files point to their source, and the audit checks they are current.
4. **Context loads on demand.** Always-on instructions stay short; detailed specs live in files the agent opens when the task needs them.
5. **Anti-patterns are removed, not tolerated.** Old patterns left in place look like the established way to do things. See [agent gardeners](../governance/agent-gardeners.md).

## How This Repository Applies Them

| Principle | Where to look |
|---|---|
| Visible boundaries | Personas in [`agents/`](../../agents/), reusable procedures in [`skills/`](../../skills/), published copies in [`skills-dist/`](../../skills-dist/), MCP rules in [`mcp-protocols/`](../../mcp-protocols/), the issue loop in [`coding-loop/`](../../coding-loop/). Each has one kind of content. |
| Easiest path is correct | PRs are opened through [`scripts/agent-gh.sh`](../../scripts/agent-gh.sh) or [`scripts/agent-pr.js`](../../scripts/agent-pr.js), which refuse any login other than the expected machine identity. The short command is also the compliant one. |
| One source per fact | `CLAUDE.md` and `GEMINI.md` are generated pointers to `AGENTS.md`; `npm run audit` fails if generated outputs are stale. |
| On-demand context | `AGENTS.md` tells agents to load personas, skills, and MCP protocols from disk when needed rather than expecting an injected catalogue (Decision [2026-09-22-0001]). |
| Layered, not forked | Organization-specific rules go in layer files listed in `AGENTS.layers`, never in edits to the upstream baseline ([`configuration-layers.md`](../configuration-layers.md)). |

## Procedure for Your Repository

1. **Map the tree.** List top-level directories and write one line on what belongs in each. If a directory needs two lines, it probably holds two things.
2. **Find the duplicate paths.** Search for two ways to do the same sensitive thing (open a PR, read a secret, call a model). Keep one, make it the obvious one, and delete or wrap the other.
3. **Make generated files traceable.** Put a header in each generated file naming its source and the command that regenerates it, and add a check that fails when it is stale.
4. **Trim always-on instructions.** Move procedures out of the root instructions file into skills or specs the agent loads when relevant. Keep the root file for rules that apply to every task.
5. **Test with a fresh agent.** Give a new session a small task with no extra context and watch which files it opens. Where it goes wrong, fix the structure before adding instructions.

## Done Bar

- Every top-level directory has a one-line purpose in the repository's index (for this repository, Chapter 17 of [`PROJECT_REFERENCE.md`](../PROJECT_REFERENCE.md)).
- Each sensitive operation has one documented entry point.
- Generated files are checked for staleness in CI.
- A fresh agent completes the trial task using the intended entry points.

## What This Guide Does Not Cover

It does not prescribe a language, framework, or monorepo layout. It does not replace review: a clean structure lowers the error rate, and the [AI review](../AI_REVIEW_GOVERNANCE.md) and human merge still apply.

Related: [codebase as memory](codebase-as-memory.md), [verification skills](verification-skills.md).
