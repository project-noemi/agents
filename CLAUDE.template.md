# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project NoéMI is an **agent specification library** — not a runtime or execution engine. It defines AI agent personas, MCP (Model Context Protocol) integrations, and governance frameworks as Markdown files. External orchestrators (Gemini CLI, n8n, LangChain) consume the generated output.
Project NoéMI also serves as the **public reference architecture** for NewPush's governed AI operating model, so code and docs in this repository should remain aligned with that role.

## Key Commands

```bash
# Generate GEMINI.md from template + active MCP protocols
node scripts/generate_gemini.js

# Generate CLAUDE.md from template + active MCP protocols
node scripts/generate_claude.js

# Verify environment prerequisites (Docker, Gemini CLI, etc.)
bash scripts/verify-env.sh

# Run commands with secrets injected (never hardcode credentials)
op run --env-file=.env.template -- [command]
infisical run --env=dev -- [command]
```

## Architecture

### Repository Layout

- `agents/` — **Source of truth** for all agent specifications, organized by domain (`coding/`, `guardian/`, `marketing/`, etc.)
- `docs/` — Documentation mirroring `agents/` structure, plus framework docs (REQUIREMENTS.md, METHODOLOGY.md, GOVERNANCE.md)
- `skills/` — Reusable task definitions that agents compose into their workflows
- `mcp-protocols/` — One `.md` file per MCP integration (Slack, Gmail, Google Suite, n8n, etc.)
- `scripts/` — Build utilities (context generation, environment verification)
- `examples/` — Deployment examples (Docker sandbox, fleet deployment, video automation pod, red team gauntlet)

### Context Generation Pipeline

Both `GEMINI.md` and `CLAUDE.md` are generated from their respective templates:

```
{GEMINI,CLAUDE}.template.md + mcp.config.json + AGENTS.md
    → scripts/generate_{gemini,claude}.js
    → {GEMINI,CLAUDE}.md
```

The scripts read `mcp.config.json` to determine active MCPs, inject their protocol definitions from `mcp-protocols/`, and produce the final context files. Changes to MCP protocols or the config require re-running the generators.

### Fetch-on-Demand Security (AGENTS.md)

All secrets live in 1Password or Infisical vaults. Never hardcode credentials. Always use CLI wrappers (`op run` / `infisical run`) for runtime injection. Code should read config from `process.env` — no `.env` parsing logic.

## Agent Specification Format

All agents follow the canonical template in `docs/AGENT_TEMPLATE.md`:

**Required sections:** Role, Tone, Capabilities, Mission, Rules & Constraints ({Methodology}), Boundaries, Workflow, Audit Log, External Tooling Dependencies

**Optional sections:** Tool Usage, Output Format, Journal, Files of Interest

H1 format: `# {Name} — {Domain} Agent`

## Dynamic Persona Protocol

When working on a task in this repository, adopt the appropriate agent persona based on context:

1. **Identify the domain** — Determine the area (infrastructure, marketing, coding, etc.)
2. **Read the spec** — Load the matching agent file from `agents/{domain}/{name}.md`
3. **Adopt the role** — Follow the Role, Tone, Capabilities, Rules, and Boundaries defined in the spec
4. **Load skills** — If the agent's Workflow references skills (marked with `**Skill:**`), read the skill spec from `skills/` and follow its Procedure
5. **Cross-reference** — For multi-domain tasks, combine guidelines from relevant agents

**Fallback:** If no agent spec matches, operate as a Senior Software Engineer following standard best practices and this repository's conventions.

## Adding or Modifying Agents

1. Use `docs/AGENT_TEMPLATE.md` as the starting point
2. Place the spec in `agents/{domain}/{name}.md`
3. Create matching documentation in `docs/agents/{domain}/{name}/`
4. If the agent uses MCP tools, ensure referenced protocols exist in `mcp-protocols/`

## Governance

Agents are evaluated against Gartner AI TRiSM (Trust, Risk, Security Management) — see `docs/GOVERNANCE.md`. Red Team audits (prompt injection, boundary testing, failure handling) are required before deployment. The 4D Framework (Delegation, Description, Discernment, Diligence) guides all design decisions — see `docs/METHODOLOGY.md`.

## Commit Convention

Conventional Commits: `type(scope): subject`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`

Scope matches the domain or area (e.g., `marketing`, `guardian`, `agents`, `lifecycle`).

<!-- GLOBAL_MANDATES_START -->
<!-- GLOBAL_MANDATES_END -->

<!-- AGENT_INDEX_START -->
<!-- AGENT_INDEX_END -->

<!-- SKILLS_INJECTIONS_START -->
<!-- SKILLS_INJECTIONS_END -->

<!-- MCP_INJECTIONS_START -->
<!-- MCP_INJECTIONS_END -->
