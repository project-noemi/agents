# Gemini CLI Modular MCP Setup Guide

This guide covers **context generation**, not every possible authentication path for every external tool.

Its purpose is simple:

- choose the MCP protocols you want active
- generate a focused `GEMINI.md`
- keep Gemini CLI context narrow enough to stay useful

If you need actual Google Workspace connectivity, pick the correct runtime guide first:

- [`gemini-workspace-quickstart.md`](gemini-workspace-quickstart.md) for Gemini CLI with the Google Workspace extension
- [`../examples/n8n-google-workspace-quickstart.md`](../examples/n8n-google-workspace-quickstart.md) for n8n workflows
- [`../mcp-setup/google-workspace.md`](../mcp-setup/google-workspace.md) for generic or self-hosted Google MCP server auth

## Why Modular Context Exists

When you hand Gemini CLI one giant instruction file, three bad things happen:

1. token waste
2. tool confusion
3. cross-domain instruction bleed

Project NoeMI avoids that by generating `GEMINI.md` from only the active skills and MCP protocols required for the current job.

## The Four Inputs

The generation pipeline uses:

1. `templates/context/GEMINI.template.md`
2. `AGENTS.md`
3. `mcp.config.json`
4. `scripts/generate_gemini.js`

The generated output is `GEMINI.md`.

## Step 1: Pick Only the MCPs You Need

Edit [`mcp.config.json`](../../mcp.config.json) and keep the `active_mcps` list as small as practical.

Example for a document-research session:

```json
{
  "active_mcps": [
    "google-docs",
    "google-drive",
    "web-search"
  ]
}
```

Example for an operations session:

```json
{
  "active_mcps": [
    "github",
    "slack",
    "n8n"
  ]
}
```

## Step 2: Generate the Context

```bash
node scripts/generate_gemini.js
```

Or regenerate both orchestrator context files together:

```bash
node scripts/generate_all.js
```

## Step 3: Validate Before You Start

```bash
npm run validate
```

This confirms the generator, templates, and current protocol inventory still align.

## Step 4: Launch Gemini with the Right Runtime Wrapper

If the task needs vault-backed secrets beyond Gemini CLI's own auth state:

```bash
infisical run --env=dev -- gemini
```

or

```bash
op run --env-file=.env.template -- gemini
```

## Token-Discipline Rules

When the active MCPs include large Google surfaces like Gmail, Drive, or Sheets:

- search or filter before reading
- fetch metadata before full bodies
- paginate large result sets
- ask for targeted fields, not full records

## Important Boundary

`mcp.config.json` controls which **instructions** are injected into `GEMINI.md`.

It does **not** install tools, configure Gemini CLI extensions, or create n8n credentials by itself.

That is why the runtime-specific setup guides above matter.
