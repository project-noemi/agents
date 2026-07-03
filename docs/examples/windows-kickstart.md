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
  - Install with `winget install OpenJS.NodeJS.LTS`, or use [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage versions. Confirm with `node -v` showing `v24` or higher.
- one supported local AI client: Gemini CLI, Claude Code, or OpenAI Codex
- PowerShell
  - `powershell` works on stock Windows
  - `pwsh` is recommended if you already use PowerShell 7

## Step 1: Clone The Repository

Open PowerShell and run:

```powershell
git clone https://github.com/project-noemi/agents.git
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

Already know you want to start with **Claude Code**? Target it directly (swap `builder` for `claude`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode claude
```

## Step 3: Generate The Current Agent Context

```powershell
node scripts/generate_all.js
npm run validate
```

This gives you the current generated context files and confirms the repository contracts are healthy.

> **Heads up:** `CLAUDE.md` and `GEMINI.md` are *generated* by this command — don't hand-edit them. To change what your client sees, edit the sources under `templates/context/` and re-run `node scripts/generate_all.js`. Manual edits get overwritten, and CI checks these files against golden fixtures.

## Step 4: Get One Safe First Win

Use one read-only prompt against the local repository first.

### Gemini CLI

```powershell
gemini -p GEMINI.md "List the engineering agents in this repository and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

### Claude Code

From the repository root, launch Claude Code with the same task:

```powershell
claude "Read CLAUDE.md, inspect the engineering agents in this repository, and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

(Prefer to drive it interactively? Just run `claude` in the repo and paste the same request.)

New to Claude Code, or only know the desktop app? See [`../tool-usages/claude-code-local-workspace.md`](../tool-usages/claude-code-local-workspace.md) for the difference between the CLI and the app.

### OpenAI Codex

Open the repository in Codex and ask:

> Inspect this repository and summarize the engineering agents in one sentence each. Then tell me which one would help first with PR review.

## Step 5: Add Secret Injection Only When You Need Business Systems

Do not start by pasting secrets into files.

When you move beyond local read-only work, wrap the client at launch with whichever SecretOps CLI your team uses — **pick one**, don't run both:

```powershell
# Infisical
infisical run --env=dev -- gemini
```

```powershell
# 1Password (.env.template maps env-var names to op:// secret references — no real secrets on disk)
op run --env-file=.env.template -- gemini
```

The same pattern applies to Claude Code and Codex (swap `gemini` for `claude` or `codex`).

## Step 6: Know What Comes Later

After this local-first success:

1. [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
3. [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
4. [`builder-first-30-minutes.md`](builder-first-30-minutes.md) when you are ready for Docker

## Windows Notes

- You do **not** need WSL for the first beginner path.
- You do **not** need Docker Desktop for the first beginner path.
- Run every command in this guide in **PowerShell** — not Git Bash or WSL. Forward slashes in script paths (`scripts/verify-env.ps1`) work fine in PowerShell; you do not need to convert them to backslashes.
- `-ExecutionPolicy Bypass` is needed only because Windows blocks unsigned local scripts by default. It applies to that single command and does **not** change your system-wide policy.
- If you later move into Docker homes, use [`builder-first-30-minutes.md`](builder-first-30-minutes.md) and install Docker Desktop at that stage.

## Outcome

If this guide worked, you now have:

- one Windows-safe verification path
- one working local AI client
- one validated repository context
- one first success you can show to a colleague before connecting business systems
