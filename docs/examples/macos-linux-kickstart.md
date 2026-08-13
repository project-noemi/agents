# macOS / Linux Kickstart

Use this guide when your main machine is macOS or Linux.

This is the safest beginner path if:

- you already have a normal Terminal workflow
- you want one harmless, read-only AI success before Docker or business-system wiring
- you want the cleanest path into later Docker work

If your machine is ChromeOS, use [`chromeos-kickstart.md`](chromeos-kickstart.md) instead. ChromeOS starts with the Linux development environment first, then joins the same local-first flow.

## What You Need

- Git
- Node.js 24 or newer
- one supported local AI client: Gemini CLI, Claude Code, OpenAI Codex, or Grok Build
- Terminal access with `bash` or `zsh`

If you want **Grok Build** and do not have `grok` yet:

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
grok --version
```

Open a new terminal after install so `PATH` includes `~/.grok/bin`. Full notes: [`../tool-usages/grok-build-local-workspace.md`](../tool-usages/grok-build-local-workspace.md).

## Step 1: Clone The Repository

Open Terminal and run:

```bash
git clone https://github.com/project-noemi/agents.git
cd agents
```

## Step 2: Run The macOS / Linux Preflight

```bash
bash scripts/verify-env.sh --mode=builder
```

This checks:

- Git
- Node.js
- at least one supported local AI client
- whether Docker is present, without requiring it yet
- whether Infisical CLI or 1Password CLI is available for later Fetch-on-Demand work

Already know you want to start with **Claude Code** or **Grok Build**? Target it directly:

```bash
bash scripts/verify-env.sh --mode=claude
```

```bash
bash scripts/verify-env.sh --mode=grok
```

## Step 3: Generate The Current Agent Context

```bash
node scripts/generate_all.js
npm run validate
```

This gives you the current generated context files and confirms the repository contracts are healthy.

> **Heads up:** `CLAUDE.md` and `GEMINI.md` are *generated* by this command — don't hand-edit them. To change what your client sees, edit the sources under `templates/context/` and re-run `node scripts/generate_all.js`. Manual edits get overwritten, and CI checks these files against golden fixtures.

## Step 4: Get One Safe First Win

Use one read-only prompt against the local repository first.

### Gemini CLI

```bash
gemini -p GEMINI.md "List the engineering agents in this repository and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

### Claude Code

From the repository root, launch Claude Code with the same task:

```bash
claude "Read CLAUDE.md, inspect the engineering agents in this repository, and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

(Prefer to drive it interactively? Just run `claude` in the repo and paste the same request.)

### OpenAI Codex

Open the repository in Codex and ask:

> Inspect this repository and summarize the engineering agents in one sentence each. Then tell me which one would help first with PR review.

### Grok Build

```bash
grok -p "Read AGENTS.md and CLAUDE.md, list the engineering agents in this repository, and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

(Prefer the interactive TUI? Run `grok` in the repo and paste the same request.)

## Step 5: Add Secret Injection Only When You Need Business Systems

Do not start by pasting secrets into files.

When you move beyond local read-only work, wrap the client at launch with whichever SecretOps CLI your team uses — **pick one**, don't run both:

```bash
# Infisical
infisical run --env=dev -- gemini
```

```bash
# 1Password (.env.template maps env-var names to op:// secret references — no real secrets on disk)
op run --env-file=.env.template -- gemini
```

The same pattern applies to Claude Code, Codex, and Grok Build (swap `gemini` for `claude`, `codex`, or `grok`).

## Step 6: Know What Comes Later

After this local-first success:

1. [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
3. [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
4. [`builder-first-30-minutes.md`](builder-first-30-minutes.md) when you are ready for Docker

## macOS / Linux Notes

- You do **not** need Docker for the first beginner path.
- You do **not** need production credentials for the first beginner path.
- macOS and Linux are usually the cleanest platforms for moving from the local-first path into Docker later.

## Outcome

If this guide worked, you now have:

- one macOS / Linux-safe verification path
- one working local AI client
- one validated repository context
- one first success you can show to a colleague before connecting business systems
