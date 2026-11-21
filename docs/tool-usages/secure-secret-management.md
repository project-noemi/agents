# Project NoéMI: Phase 0 Security & Secret Management

**Framework:** AI TRiSM (Gartner®, Inc.) — security dimension | **Pedagogy:** Creation Diligence

## Overview

Project NoéMI uses a **Fetch-on-Demand** security model:

1. **Storage (The Vault):** secrets live only in a SecretOps platform
2. **Access (The Injector):** the client or runtime receives secrets at launch time through a wrapper. `infisical run` and `op run` are the wrappers for Infisical and 1Password. `scripts/secret-inject.js` is the wrapper for Secret Manager (Google Cloud) and Azure Key Vault, which do not ship one.
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

## Supported stores follow the customer's architecture

NoéMI does not assign a secret-store brand. The customer uses the store that matches the infrastructure they already run. Infisical and 1Password are two of those stores, and they are the ones this repository's own examples call. They are not the list a customer must adopt.

| The organization already runs | Store | Launch |
| --- | --- | --- |
| No cloud account yet, or a vault that must stay portable across clouds | **Infisical** | `infisical run` |
| 1Password for the people who hold the secrets | **1Password** | `op run` |
| Google Cloud (workloads, IAM, audit log) | **Secret Manager** | `scripts/secret-inject.js` |
| Microsoft Azure (workloads, directory, audit log) | **Azure Key Vault**, secrets only | `scripts/secret-inject.js` |

Secret Manager and Azure Key Vault are first-class. A customer on those clouds starts there. They do not pass through Infisical first. Each store injects into process memory, scoped to one workflow, with no plaintext `.env` file, which is the Phase 0 rule in [`../../AGENTS.md`](../../AGENTS.md).

### Local workstation examples

When the organization has not chosen a cloud, the first exercises use Infisical or 1Password. Both are workstation-friendly and need no cloud project. The steps below are those two examples. Secret Manager and Key Vault launches are in [Choose a store](#choose-a-store).

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

These are the supported stores. Use the one that matches the architecture the organization already pays for.

- **Infisical:** portable, including self-hosted. Also the store this repository's own CI examples use. That example is not a customer requirement.
- **1Password CLI:** the store when the organization already keeps secrets in 1Password.
- **Secret Manager** (Google Cloud): the store when the organization already runs on Google Cloud. The product name is Secret Manager.
- **Azure Key Vault:** the store when the organization already runs on Azure. The product name is Azure Key Vault. A vault holds secrets, keys, and certificates. Agent tokens use **secrets** only, in a vault that holds only those secrets.
- **AWS Secrets Manager** and **Bitwarden Secrets Manager:** stores an organization may already run. This change does not add a wrapper for them. A customer on AWS still must not be told to adopt Infisical in order to comply. A later wrapper can follow the same manifest shape.

A first local exercise can use Infisical or 1Password without a cloud project. A customer whose systems already run on Google Cloud or Azure uses that cloud's store from the start.

## Choose a store

Pick one store for a workflow. Do not keep the same names live in two vaults.

| If this is true | Use |
| --- | --- |
| The organization has no cloud secret store yet, or it wants a vault that is not tied to one cloud | **Infisical** |
| The people who hold the secrets already use 1Password, and agents run on workstations | **1Password** |
| The workload, IAM, and audit log are already Google Cloud | **Secret Manager** |
| The workload, directory, and audit log are already Azure | **Azure Key Vault** |

Secret Manager stores only secrets: named, versioned blobs in a Google Cloud project. Azure Key Vault is also a key and certificate service. Using it for agent tokens does not mean putting encryption keys in that same vault. A vault used for agent secrets should contain only those secrets, so a **Key Vault Secrets User** grant cannot also read unrelated keys.

| | Infisical | 1Password | Secret Manager (Google Cloud) | Azure Key Vault |
| --- | --- | --- | --- | --- |
| Address of one secret | project, environment, folder, name | `op://Vault/Item/field` | project, secret id, version (`latest`) | vault name, secret name, version |
| Human sign-in | `infisical login` | `op signin` | `gcloud auth application-default login` | `az login` |
| Machine identity | machine identity scoped to one folder | service account limited to one vault | Workload Identity Federation and `roles/secretmanager.secretAccessor` on those secrets | Microsoft Entra federated credential and **Key Vault Secrets User** on that vault |
| Task scope | one folder | one reference manifest | one manifest of secret ids | one vault that holds only that workflow |
| Launch | `infisical run --env=… --path=… -- cmd` | `op run --env-file=….env.template -- cmd` | `node scripts/secret-inject.js --manifest ….secrets -- cmd` | the same injector, with `kv://` references |

`gcloud auth login` alone does not give Application Default Credentials. Secret Manager reads need `gcloud auth application-default login` on a workstation, or Workload Identity Federation in CI.

Neither cloud ships an `infisical run` equivalent. That is why `scripts/secret-inject.js` is in this repository: a customer on Google Cloud or Azure has to be able to launch an agent the same way a customer on Infisical or 1Password does. Reading the secret from application code, or writing `gcloud` / `az` output into a dotenv file, breaks Fetch-on-Demand. The script reads a manifest and places the values in the child process environment.

Secret ids in Secret Manager are letters, numbers, hyphens, and underscores, and start with a letter. Key Vault secret names are letters, numbers, and hyphens. An Infisical folder path does not become a secret id. The manifest maps one environment variable to one id.

### Secret Manager launch

`workflows/inbox-triage.secrets` holds references only:

```text
MAIL_API_TOKEN=sm://PROJECT/inbox-triage-mail-token/latest
```

```bash
gcloud auth application-default login
node scripts/secret-inject.js --manifest workflows/inbox-triage.secrets -- gemini
```

### Azure Key Vault launch

Use a different manifest. One launch is one cloud.

```text
MAIL_API_TOKEN=kv://inbox-triage/mail-token/latest
```

```bash
az login
node scripts/secret-inject.js --manifest workflows/inbox-triage.secrets -- gemini
```

## Migrate one workflow to Google Cloud or Azure

Do this once per workflow. Inventory names, not values. Do not print a secret into the terminal history, a file, or a pull request.

1. List the names. From Infisical, list the folder. From 1Password, list the `op://` references in the task manifest. Write the destination manifest with new resource ids. Leave values out of that file.
2. Create the destination before copying. On Google Cloud, enable the Secret Manager API on the project the workload already uses, and turn on Cloud Audit Logs for Secret Manager. On Azure, create one Key Vault that uses Azure RBAC (not an access policy), and send diagnostic logs to Azure Monitor.
3. Copy each value once, through the old injector, into the new store. Turn shell history off for the session (`unset HISTFILE`, or start a shell that does not record it). Pipe the variable. Do not paste it, and do not pass it as `--value` (that puts the secret in the process list).

   From Infisical into Secret Manager:

   ```bash
   unset HISTFILE
   infisical run --env=dev --path=/workflows/inbox-triage -- \
     sh -c 'printf %s "$MAIL_API_TOKEN" | gcloud secrets create inbox-triage-mail-token --data-file=- --replication-policy=automatic --project=PROJECT'
   ```

   From Infisical into Azure Key Vault (`--file /dev/stdin`, never `--value`):

   ```bash
   unset HISTFILE
   infisical run --env=dev --path=/workflows/inbox-triage -- \
     sh -c 'printf %s "$MAIL_API_TOKEN" | az keyvault secret set --vault-name inbox-triage --name mail-token --file /dev/stdin'
   ```

   From 1Password, replace the `infisical run …` prefix with `op run --env-file=workflows/inbox-triage.env.template --`.
4. Grant read on those objects only: `roles/secretmanager.secretAccessor` on the Google Cloud secrets, or **Key Vault Secrets User** on the Azure vault. Confirm with a command that checks the name is non-empty and does not print it:

   ```bash
   node scripts/secret-inject.js --manifest workflows/inbox-triage.secrets -- \
     sh -c 'test -n "$MAIL_API_TOKEN"'
   ```
5. Point the workflow at the new manifest. After one successful run, revoke the old Infisical folder or the old 1Password items.
6. Rotate every migrated secret at the service that issued it, and store the new value as a new version. A value that lived in the old store and passed through a shell is treated as exposed.
7. Leave one store for that workflow. Delete the old names when the rotation is done.

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
    raise ValueError("Missing DATABASE_URL. Did you execute the script with `infisical run`, `op run`, or `scripts/secret-inject.js`?")
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

or, for a workflow that already moved to Secret Manager or Azure Key Vault:

```bash
node scripts/secret-inject.js --manifest workflows/db-report.secrets -- python script.py
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
