# Windows Kickstart

Use this guide when your main machine is Windows and you want the safest beginner path into Project NoeMI.

If you have not chosen a workstation path yet, start with [`cross-platform-kickstart.md`](cross-platform-kickstart.md) first.

This is the right starting point if:

- you are comfortable using Windows but not yet comfortable with Bash
- you want one harmless, read-only AI success before Docker or business-system wiring
- you want to use PowerShell instead of guessing which Linux-style command still applies on Windows

## What You Need

- Git
- Node.js 24 or newer
- one supported local AI client: Gemini CLI, Claude Code, or OpenAI Codex
- PowerShell
  - `powershell` works on stock Windows
  - `pwsh` is recommended if you already use PowerShell 7

## Step 1: Clone The Repository

Open PowerShell and run:

```powershell
git clone https://github.com/newpush/agents.git
cd agents
```

## Step 2: Run The Windows Preflight

If you are using the PowerShell that ships with Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode builder
```

If you already have PowerShell 7:

```powershell
pwsh -File scripts/verify-env.ps1 -Mode builder
```

This checks:

- Git
- Node.js
- at least one supported local AI client
- whether Docker is present, without requiring it yet
- whether Infisical CLI or 1Password CLI is available for later Fetch-on-Demand work

## Step 3: Generate The Current Agent Context

```powershell
node scripts/generate_all.js
npm run validate
```

This gives you the current generated context files and confirms the repository contracts are healthy.

## Step 4: Get One Safe First Win

Use one read-only prompt against the local repository first.

### Gemini CLI

```powershell
gemini -p GEMINI.md "List the engineering agents in this repository and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

### Claude Code

Open the repository in Claude Code and ask:

> Read `CLAUDE.md`, inspect the engineering agents in this repository, and summarize what each one does in one sentence. Then tell me which one would help first with PR review.

### OpenAI Codex

Open the repository in Codex and ask:

> Inspect this repository and summarize the engineering agents in one sentence each. Then tell me which one would help first with PR review.

## Step 5: Add Secret Injection Only When You Need Business Systems

Do not start by pasting secrets into files.

When you move beyond local read-only work, wrap the client at launch:

```powershell
infisical run --env=dev -- gemini
op run --env-file=.env.template -- gemini
```

The same pattern applies to Claude Code and Codex.

## Step 6: Know What Comes Later

After this local-first success:

1. [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
3. [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
4. [`builder-first-30-minutes.md`](builder-first-30-minutes.md) when you are ready for Docker

## Windows Notes

- You do **not** need WSL for the first beginner path.
- You do **not** need Docker Desktop for the first beginner path.
- If you later move into Docker homes, use [`builder-first-30-minutes.md`](builder-first-30-minutes.md) and install Docker Desktop at that stage.

## Outcome

If this guide worked, you now have:

- one Windows-safe verification path
- one working local AI client
- one validated repository context
- one first success you can show to a colleague before connecting business systems
