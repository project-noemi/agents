# Project NoéMI: Phase 0 Security & Secret Management

**Framework:** AI TRiSM (Gartner®, Inc.) — security dimension | **Pedagogy:** Creation Diligence

## Overview

Project NoéMI uses a **Fetch-on-Demand** security model:

1. **Storage (The Vault):** secrets live only in a SecretOps platform
2. **Access (The Injector):** the client or runtime receives secrets at launch time through a wrapper such as `infisical run` or `op run`
3. **Governance (The Guardian Layer):** secrets are never written to disk, committed to Git, or pasted into chat

For the client-side readiness conversation that should happen before implementation, see [`../PHASE_ZERO_SECURITY_BASELINE.md`](../PHASE_ZERO_SECURITY_BASELINE.md) and the reusable templates in [`../phase-zero-assessment/`](../phase-zero-assessment/).
If you are brand new to this repo, start with [`../examples/zero-to-first-agent.md`](../examples/zero-to-first-agent.md) before you come back here.
For the builder-facing Docker layout that comes later, see [`../examples/docker-agent-home.md`](../examples/docker-agent-home.md).
For the runtime-side expectations that sit on top of secret injection, see [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md).

## Beginner Quick Path: Local First

For Builders and Practitioners, the right first habit is simple:

1. choose **one** supported SecretOps path
2. sign in locally with your human identity
3. run the local client through the wrapper when the task needs credentials
4. only then connect business systems such as Gmail, Drive, GitHub, or n8n

You do **not** need machine identities for your first harmless local task.

## The Two Recommended SecretOps Paths

Project NoéMI supports both of these beginner-friendly injector patterns:

- **Infisical:** open-source SecretOps with `infisical run`
- **1Password CLI:** mature vault-backed wrapper with `op run`

Choose one for a given workflow and standardize on it within the team.

### Why These Two Paths Fit NoéMI

- they inject secrets into process memory at runtime, scoped to a folder or manifest per task
- they support secure local builder habits
- they avoid plaintext `.env` files
- they map cleanly to the Phase 0 rules in [`../../AGENTS.md`](../../AGENTS.md)

## Step 1: Authenticate Locally

### Infisical

```bash
infisical login
```

### 1Password CLI

```bash
op signin
```

## Step 2: Launch The Local Client Securely

When the task needs credentials, wrap the client launch instead of creating a local secret file, and inject only the secrets that one task needs.

The default is **task-scoped**: each workflow gets its own vault folder (or its own machine identity) that holds only that workflow's secrets, and the client is launched against that folder alone. Launching an agent against a whole environment hands it, and everything it starts, every secret in that environment.

### Infisical example (task-scoped)

Keep each workflow's secrets in its own folder, for example `/workflows/inbox-triage`, and launch the client against that path only:

```bash
infisical run --env=dev --path=/workflows/inbox-triage -- gemini
infisical run --env=dev --path=/workflows/inbox-triage -- claude
infisical run --env=dev --path=/workflows/inbox-triage -- codex
infisical run --env=dev --path=/workflows/inbox-triage -- grok
```

For a runtime that is not a person's workstation, use a machine identity whose access is limited to that folder (see [Configuring Machine Identity With Infisical](#configuring-machine-identity-with-infisical)).

### 1Password example (task-scoped)

Give each workflow its own reference manifest that lists only the secrets it needs, by name:

```bash
# workflows/inbox-triage.env.template: vault references only, never values
# MAIL_API_TOKEN=op://Inbox Triage/mail-api/credential

op run --env-file=workflows/inbox-triage.env.template -- gemini
op run --env-file=workflows/inbox-triage.env.template -- claude
op run --env-file=workflows/inbox-triage.env.template -- codex
op run --env-file=workflows/inbox-triage.env.template -- grok
```

Keep the workflow's items in a vault that holds only that workflow's secrets. Unlike a plaintext `.env`, a `.env.template` is only a vault-reference manifest. The repository's root `.env.template` is the full inventory of names, not the manifest to launch an agent with.

### What the agent's children see

Secrets injected with `infisical run` or `op run` become environment variables of the client process, and every process it starts inherits them: MCP servers, shell commands, package scripts and plugins. Any of that code can read them. So:

- inject the minimum set of secrets, named one by one, for the one task;
- start only the MCP servers and tools the task needs, from pinned versions;
- end the session when the task ends, so the secrets are not left in a long-running process.

Fetch-on-Demand keeps secrets out of files, Git and chat. It does not protect a secret from code running inside the agent's process; scoping and short sessions limit what such code can reach.

### Agent configuration files are code

Files such as `opencode.json`, `.mcp.json`, `.cursor/mcp.json` and `.claude/settings.json` decide which servers and commands an agent runs. Review them like code, and keep keys out of them: they reference an environment variable injected from the vault, using the client's own reference syntax, and never hold a key value. If you find a key in one, move it to the vault and revoke the original.

## Step 3: Build Secure Muscle Memory

The first useful rule for beginners is:

- repo-only, read-only tasks can start without secrets
- the moment a task touches external systems, wrap the launch with `infisical run` or `op run`

That is how NoéMI keeps the transition from experimentation to business work secure without making beginners memorize infrastructure patterns on day one.

## Suggested Local Aliases

Once a builder chooses one secret path, create one alias per task, so the scoped launch becomes the normal path. Name the alias after the task, not after the client:

```bash
alias triage-gemini='infisical run --env=dev --path=/workflows/inbox-triage -- gemini'
alias triage-claude='infisical run --env=dev --path=/workflows/inbox-triage -- claude'
```

or:

```bash
alias triage-gemini='op run --env-file=workflows/inbox-triage.env.template -- gemini'
alias triage-claude='op run --env-file=workflows/inbox-triage.env.template -- claude'
```

Avoid one alias that injects a whole environment into every session.

For the client-by-client comparison and the role of Google's Antigravity, Claude Code app, and Codex app on top of these CLI habits, see:

- [`agentic-local-workspaces.md`](agentic-local-workspaces.md)
- [`google-local-workspace.md`](google-local-workspace.md)
- [`claude-code-local-workspace.md`](claude-code-local-workspace.md)
- [`openai-codex-local-workspace.md`](openai-codex-local-workspace.md)
- [`grok-build-local-workspace.md`](grok-build-local-workspace.md)

## The Tool Matrix For Project NoéMI

These are the main SecretOps patterns you may encounter as the work becomes more advanced:

- **Infisical:** best open-source fit for local and self-hosted builder workflows
- **1Password CLI:** strong local and SMB-friendly operational path
- **Google Secret Manager / AWS Secrets Manager:** strong cloud-native path for workloads that rely on IAM and SDK-based secret retrieval rather than CLI injection
- **Bitwarden Secrets Manager:** another strong option for teams that already standardize on Bitwarden

The beginner path in this repo focuses on Infisical and 1Password because they most directly reinforce the Fetch-on-Demand habit.

## The Agent Contract (Prompting Guide)

To ensure the agent writes secure code, Practitioners should describe the security model explicitly.

### The Reference Prompt

User:

> Write a Python script to connect to the database. Assume the `DATABASE_URL` is securely injected into the environment at runtime via our SecretOps tool. Do not create a local `.env` file or ask me for the password.

Agent (correct pattern):

```python
import os

db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise ValueError("Missing DATABASE_URL. Did you execute the script with `infisical run` or `op run`?")
```

### The Execution Prompt

User:

> Run the script you just wrote.

Correct action:

```bash
infisical run --env=dev --path=/workflows/db-report -- python script.py
```

or:

```bash
op run --env-file=workflows/db-report.env.template -- python script.py
```

## Advanced Path: Accelerators And Headless Runtimes

Once the team moves beyond local workstations into n8n, cloud VMs, or other background runtimes, Accelerators must provision **machine identities** or another non-human auth path.

That is where the architecture becomes different:

- local human sign-in is no longer enough
- the runtime needs scoped, non-human access
- environment access must be read-only and limited to the exact environment it needs

## Configuring Machine Identity With Infisical

1. Log in to the Infisical dashboard.
2. Navigate to **Access Control > Machine Identities**.
3. Create an identity such as `noemi-agent-crew`.
4. Grant read-only access only to the specific environment and secret folder (for example `/workflows/inbox-triage`) the runtime needs.

Generate an `INFISICAL_TOKEN` for that machine identity and inject it into the remote environment rather than a human session.

## Configuring Remote Agents (n8n / Headless Runtimes)

1. Add the machine token to the remote environment as `INFISICAL_TOKEN`.
2. Install the CLI in the runtime image or setup script.
3. Make the launch command explicitly use `infisical run`.

Example setup snippet:

```bash
#!/bin/bash
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
sudo apt-get update && sudo apt-get install -y infisical

if infisical export > /dev/null 2>&1; then
  echo "✅ Phase 0: Guardian Layer connection established."
else
  echo "❌ Phase 0 Error: Auth failed. Check INFISICAL_TOKEN." >&2
fi
```

## Verifying Phase 0 Security

### Core identity check

```bash
infisical me
```

### Test secret resolution

```bash
infisical export --env=dev
```

For 1Password-based local verification, the practical equivalent is confirming the relevant vault references resolve during an `op run` launch instead of appearing in plaintext on disk.

## Troubleshooting Common Governance Errors

| Symptom | Likely Cause | Fix |
|---|---|---|
| Unauthorized access | Token or vault reference is scoped to the wrong environment. | Update RBAC or the vault reference to the correct environment. |
| `infisical: command not found` or `op: command not found` | The CLI is not installed or not in the shell `$PATH`. | Install the CLI and rerun the preflight check. |
| Agent hardcodes secrets | The security contract was not described clearly enough or the repo rules were ignored. | Restate the Fetch-on-Demand rule and correct the prompt or persona guidance. |

## The Pedagogical "Aha!" Moment

The beginner breakthrough is simple but important:

if the secret was never pasted into chat and never written to a local file, the model has much less chance to leak it. Fetch-on-Demand does not make a compromised tool safe, though: anything running in the agent's process can read what was injected, so inject only what the task needs.

That is why Phase 0 matters so early in NoéMI. The team builds secure habits before the first business-facing workflow becomes powerful enough to do damage.
