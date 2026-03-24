# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project NoéMI is an **agent specification library** — not a runtime or execution engine. It defines AI agent personas, MCP (Model Context Protocol) integrations, and governance frameworks as Markdown files. External orchestrators (Gemini CLI, n8n, LangChain) consume the generated output.

## Key Commands

```bash
# Generate GEMINI.md from template + active MCP protocols
node scripts/generate_gemini.js

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
- `mcp-protocols/` — One `.md` file per MCP integration (Slack, Gmail, Google Suite, n8n, etc.)
- `scripts/` — Build utilities (context generation, environment verification)
- `examples/` — Deployment examples (Docker sandbox, fleet deployment, video automation pod, red team gauntlet)

### Context Generation Pipeline

`GEMINI.template.md` + `mcp.config.json` → `scripts/generate_gemini.js` → `GEMINI.md`

The script reads `mcp.config.json` to determine active MCPs, injects their protocol definitions from `mcp-protocols/`, and produces the final `GEMINI.md` consumed by orchestrators. Changes to MCP protocols or the config require re-running the generator.

### Fetch-on-Demand Security (AGENTS.md)

All secrets live in 1Password or Infisical vaults. Never hardcode credentials. Always use CLI wrappers (`op run` / `infisical run`) for runtime injection. Code should read config from `process.env` — no `.env` parsing logic.

## Agent Specification Format

All agents follow the canonical template in `docs/AGENT_TEMPLATE.md`:

**Required sections:** Role, Tone, Capabilities, Rules & Constraints ({Methodology}), Boundaries (Always / Ask First / Never)

**Optional sections:** Mission, Workflow, Tool Usage, Output Format, Journal, Files of Interest

H1 format: `# {Name} — {Domain} Agent`

## Adding or Modifying Agents

1. Use `docs/AGENT_TEMPLATE.md` as the starting point
2. Place the spec in `agents/{domain}/{name}.md`
3. Create matching documentation in `docs/agents/{domain}/{name}/`
4. If the agent uses MCP tools, ensure referenced protocols exist in `mcp-protocols/`

## Governance

Agents are evaluated against Gartner AI TRiSM (Trust, Risk, Security Management) — see `docs/GOVERNANCE.md`. Red Team audits (prompt injection, boundary testing, failure handling) are required before deployment. The 4D Framework (Description, Discernment, Delegation, Diligence) guides all design decisions — see `docs/METHODOLOGY.md`.

## Commit Convention

Conventional Commits: `type(scope): subject`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`

Scope matches the domain or area (e.g., `marketing`, `guardian`, `agents`, `lifecycle`).
