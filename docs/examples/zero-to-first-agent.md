# Zero To First Agent

This is the safest beginner path in Project NoeMI.

Use it when you are new to AI, comfortable around technology, and want one real success before you connect Google Workspace, Microsoft 365, GitHub, n8n, or Docker.

If your machine is Windows or ChromeOS, use the matching platform guide alongside this one:

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

You only need **one** of these to get your first success.

If you have not chosen yet, use the comparison guide in [`../tool-usages/agentic-local-workspaces.md`](../tool-usages/agentic-local-workspaces.md).

## Step 2: Verify Only The Path You Need

From the repository root, run the preflight mode that matches your first client.

If you are on macOS, Linux, or ChromeOS inside the Linux terminal:

```bash
bash scripts/verify-env.sh --mode=gemini
```

```bash
bash scripts/verify-env.sh --mode=claude
```

```bash
bash scripts/verify-env.sh --mode=codex
```

If you just want a general beginner check first, use:

```bash
bash scripts/verify-env.sh --mode=builder
```

If you are on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode gemini
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode claude
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode codex
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode builder
```

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

## Step 4: Get One Safe First Win

Use a local, read-only task that does not touch external systems.

Recommended first prompt:

> List the engineering agents in this repository and summarize what each one does in one sentence. Then tell me which one would help first with PR review.

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

## Outcome

If this guide worked, you are no longer at the "AI is abstract" stage.

You now have:

- one working local client
- one validated repository context
- one successful AI task you can explain to a colleague
- a secure next step for connecting business systems without skipping Phase 0
