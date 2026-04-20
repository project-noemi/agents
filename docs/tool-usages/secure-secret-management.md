# Project NoéMI: Phase 0 Security & Secret Management

**Framework:** Gartner AI TRiSM (Security) | **Pedagogy:** Creation Diligence

## Overview

Project NoeMI uses a **Fetch-on-Demand** security model:

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

Project NoeMI supports both of these beginner-friendly injector patterns:

- **Infisical:** open-source SecretOps with `infisical run`
- **1Password CLI:** mature vault-backed wrapper with `op run`

Choose one for a given workflow and standardize on it within the team.

### Why These Two Paths Fit NoeMI

- they inject secrets into process memory at runtime
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

When the task needs credentials, wrap the client launch instead of creating a local secret file.

### Infisical examples

```bash
infisical run --env=dev -- gemini
infisical run --env=dev -- claude
infisical run --env=dev -- codex
```

### 1Password examples

```bash
op run --env-file=.env.template -- gemini
op run --env-file=.env.template -- claude
op run --env-file=.env.template -- codex
```

Unlike a plaintext `.env`, `.env.template` in this repo is only a vault-reference manifest.

## Step 3: Build Secure Muscle Memory

The first useful rule for beginners is:

- repo-only, read-only tasks can start without secrets
- the moment a task touches external systems, wrap the launch with `infisical run` or `op run`

That is how NoeMI keeps the transition from experimentation to business work secure without making beginners memorize infrastructure patterns on day one.

## Suggested Local Aliases

Once a builder chooses one secret path, create aliases so the secure path becomes the normal path:

```bash
alias safe-gemini='infisical run --env=dev -- gemini'
alias safe-claude='infisical run --env=dev -- claude'
alias safe-codex='infisical run --env=dev -- codex'
```

or:

```bash
alias safe-gemini='op run --env-file=.env.template -- gemini'
alias safe-claude='op run --env-file=.env.template -- claude'
alias safe-codex='op run --env-file=.env.template -- codex'
```

For the client-by-client comparison and the role of Google's Antigravity, Claude Code app, and Codex app on top of these CLI habits, see:

- [`agentic-local-workspaces.md`](agentic-local-workspaces.md)
- [`google-local-workspace.md`](google-local-workspace.md)
- [`claude-code-local-workspace.md`](claude-code-local-workspace.md)
- [`openai-codex-local-workspace.md`](openai-codex-local-workspace.md)

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
infisical run --env=dev -- python script.py
```

or:

```bash
op run --env-file=.env.template -- python script.py
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
4. Grant read-only access only to the specific environment needed for the runtime.

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

if the secret was never pasted into chat and never written to a local file, the model has much less chance to leak it.

That is why Phase 0 matters so early in NoeMI. The team learns secure habits before the first business-facing workflow becomes powerful enough to do damage.
