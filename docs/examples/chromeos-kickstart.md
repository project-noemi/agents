# ChromeOS Kickstart

Use this guide when your main machine is a Chromebook or ChromeOS device.

If you have not chosen a workstation path yet, start with [`cross-platform-kickstart.md`](cross-platform-kickstart.md) first.

The key idea is simple: on ChromeOS, Project NoeMI starts inside the **Linux development environment**. Once that terminal is available, the beginner path looks like the Linux path from this repository.

## What You Need

- a ChromeOS device with the Linux development environment enabled
- Git
- Node.js 24 or newer inside the Linux environment
- one supported local AI client: Gemini CLI, Claude Code, or OpenAI Codex

## Step 1: Turn On The Linux Development Environment

In ChromeOS:

1. Open **Settings**
2. Go to **Developers**
3. Turn on **Linux development environment**
4. Open the Terminal window that ChromeOS creates

If your Chromebook is managed and Linux is disabled, stop here and use another machine or a remote development host. The beginner path depends on that Linux terminal.

## Step 2: Clone The Repository In The Linux Terminal

```bash
git clone https://github.com/newpush/agents.git
cd agents
```

## Step 3: Run The Beginner Preflight

```bash
bash scripts/verify-env.sh --mode=builder
```

This checks:

- Git
- Node.js
- at least one supported local AI client
- whether Docker is present, without requiring it yet
- whether Infisical CLI or 1Password CLI is available for later Fetch-on-Demand work

If `node -v` is lower than 24, update Node inside the Linux environment before continuing.

## Step 4: Generate The Current Agent Context

```bash
node scripts/generate_all.js
npm run validate
```

## Step 5: Get One Safe First Win

Use one read-only prompt against the local repository first.

### Gemini CLI

```bash
gemini -p GEMINI.md "List the engineering agents in this repository and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

### Claude Code

Open the repository in Claude Code and ask:

> Read `CLAUDE.md`, inspect the engineering agents in this repository, and summarize what each one does in one sentence. Then tell me which one would help first with PR review.

### OpenAI Codex

Open the repository in Codex and ask:

> Inspect this repository and summarize the engineering agents in one sentence each. Then tell me which one would help first with PR review.

## Step 6: Add Secret Injection Only When You Need Business Systems

When you move beyond local read-only work, wrap the client at launch:

```bash
infisical run --env=dev -- gemini
op run --env-file=.env.template -- gemini
```

The same pattern applies to Claude Code and Codex.

## ChromeOS Notes

- ChromeOS is excellent for the local-first builder path.
- ChromeOS is often **not** the easiest place to start the Docker phase. Many users stop at the local client path on the Chromebook and move Docker runtime work to a stronger Linux, macOS, or Windows host later.
- If your Chromebook is powerful and your Linux environment supports the tools you need, you can still continue into [`builder-first-30-minutes.md`](builder-first-30-minutes.md). Just do not treat Docker as part of the required first win.

## What To Read Next

1. [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
3. [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
4. [`builder-first-30-minutes.md`](builder-first-30-minutes.md) when you are ready for the Docker phase

## Outcome

If this guide worked, you now have:

- one Chromebook-safe verification path
- one working local AI client inside the Linux terminal
- one validated repository context
- one first success before adding business-system credentials or Docker complexity
