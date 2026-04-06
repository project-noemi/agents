# Templates

This directory groups the repository's generated context templates and other supporting infrastructure templates below the repo root.

Project NoeMI keeps the final generated outputs at the top level:

- `GEMINI.md`
- `CLAUDE.md`

Those stay in the root because local agentic clients consume them directly.

The source templates live here instead so the repo root stays focused on:

- the public entry docs
- the generated context outputs
- the active MCP config
- the core governance contract in `AGENTS.md`

## Current Template Areas

- `context/` — base templates for generated orchestrator context files

The canonical agent specification template remains in [`docs/AGENT_TEMPLATE.md`](../docs/AGENT_TEMPLATE.md), because it is primarily a human-facing authoring guide rather than generator infrastructure.
