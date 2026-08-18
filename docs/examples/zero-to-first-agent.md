# Zero To First Agent

This is the safest beginner path in Project NoeMI.

Use it when you are new to AI, comfortable around technology, and want one real success before you connect Google Workspace, Microsoft 365, GitHub, n8n, or Docker.

## Decision Point: Choose The Matching Workstation Path

Use the matching workstation guide alongside this one:

- [`cross-platform-kickstart.md`](cross-platform-kickstart.md)
- [`macos-linux-kickstart.md`](macos-linux-kickstart.md)
- [`windows-kickstart.md`](windows-kickstart.md)
- [`chromeos-kickstart.md`](chromeos-kickstart.md)

By the end of this guide, you will:

- verify the local tools you actually need
- generate the current agent context from this repository
- complete one harmless, read-only AI task against local repository content
- understand when to bring in secret injection, business systems, and Docker later

## What You Are Not Doing Yet

In this first pass, do **not** start with:

- production credentials
- background automation
- autonomous email sending
- GitHub write access
- Docker runtime homes

The goal is to build confidence and secure habits before complexity.

## Step 1: Choose One Local Client

Pick the local AI client you want to learn first:

- **Gemini CLI** if your team expects Google-heavy workflows or a clean terminal-first path
- **Claude Code CLI / app** if you want a strong co-work experience around repositories and documents
- **OpenAI Codex CLI / app** if you want a strong local execution and review workflow
- **Grok Build (`grok`)** if you want xAI's local TUI / headless CLI. Install on the platform you actually use, then continue this guide:

  **macOS / Linux** (and ChromeOS Linux terminal):

  ```bash
  curl -fsSL https://x.ai/cli/install.sh | bash
  grok --version
  ```

  **Windows PowerShell**:

  ```powershell
  irm https://x.ai/cli/install.ps1 | iex
  grok --version
  ```

  Open a new terminal after install so `PATH` includes `~/.grok/bin` (Windows: `%USERPROFILE%\.grok\bin`). Full notes: [`../tool-usages/grok-build-local-workspace.md`](../tool-usages/grok-build-local-workspace.md). The same commands are in [`cross-platform-kickstart.md`](cross-platform-kickstart.md) and each workstation guide.

You only need **one** of these to get your first success.

If you have not chosen yet, use the comparison guide in [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md).

## Step 2: Verify Only The Path You Need

From the repository root, run the preflight mode from your matching workstation guide:

- `builder` if you want a general beginner check first
- `gemini` if Gemini CLI is your first client
- `claude` if Claude Code is your first client
- `codex` if OpenAI Codex is your first client
- `grok` if Grok Build is your first client

Your workstation guide shows the exact `builder` command for your machine; substitute the client mode name (`gemini`, `claude`, `codex`, or `grok`) in the same command to target one specific client.

This verifies Git, Node.js, and the local client you actually plan to use. It does **not** require Docker for the beginner path.

## Step 3: Generate The Current Agent Context

```bash
node scripts/generate_all.js
npm run validate
```

This gives you the latest:

- `GEMINI.md`
- `CLAUDE.md`

and confirms the repo contracts are healthy before you ask the client to do anything with them.

> **Heads up:** `CLAUDE.md` and `GEMINI.md` are *generated* by this command — don't hand-edit them. To change what your client sees, edit the sources under `templates/context/` (plus the agents, skills, and protocols they include) and re-run `node scripts/generate_all.js`. Manual edits are overwritten on the next run, and CI checks these files against golden fixtures.

## Step 4: Get One Safe First Win

Use a local, read-only task that does not touch external systems.

Recommended first prompt:

> List the engineering agents in this repository and summarize what each one does in one sentence. Then tell me which one would help first with PR review.

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

This is the right first success because it is:

- useful
- local
- read-only
- easy to verify with your own eyes

## Step 5: Add Secure Muscle Memory Before Business Systems

Once you move beyond local read-only work, bring in Phase 0 security immediately.

Choose **one** supported SecretOps path:

- **Infisical**
- **1Password**

Then authenticate locally:

```bash
infisical login
```

```bash
op signin
```

When a task needs credentials, launch the client through the wrapper instead of hardcoding values:

```bash
infisical run --env=dev -- gemini
op run --env-file=.env.template -- claude
op run --env-file=.env.template -- codex
op run --env-file=.env.template -- grok
```

For the full local-first security flow, go next to [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md).

## Step 6: Turn The First Win Into A Safe Business Pilot

Once the first local task works, choose one low-risk business use case:

- summarize one internal document
- classify inbound requests into simple buckets
- draft, but do not send, a reply
- extract action items from a meeting note

Keep the initial pilot inside these boundaries:

- read-heavy before write-heavy
- human approval before external action
- one department before the whole company
- one clear success metric before broad rollout

## What To Learn Next

After this first win, follow this order:

1. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
2. [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md)
3. one product path:
   [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md) or [`n8n-google-workspace-quickstart.md`](n8n-google-workspace-quickstart.md)
4. [`builder-first-30-minutes.md`](builder-first-30-minutes.md) when you want the Docker phase
5. [`docker-agent-home.md`](docker-agent-home.md) when you are ready to build a governed runtime home
6. [`build-your-coding-loop.md`](build-your-coding-loop.md) when you are a coder and want issues to become PRs

## Outcome

If this guide worked, you are no longer at the "AI is abstract" stage.

You now have:

- one working local client
- one validated repository context
- one successful AI task you can explain to a colleague
- a secure next step for connecting business systems without skipping Phase 0
