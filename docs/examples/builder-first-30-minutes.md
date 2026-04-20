# Builder First 30 Minutes

This walkthrough is the fastest safe path from a **first local success** to a working Docker-based agent home.

If you are completely new to AI implementation, start with [`zero-to-first-agent.md`](zero-to-first-agent.md) first. That guide gets you through the first harmless, read-only local task. This guide is the **phase-two Docker path**.

It does not turn Project NoeMI into a runtime engine. It shows how to validate the reference architecture, generate the current agent context, and launch one local Docker home around those assets.

## Before You Start

Read these guides first:

1. [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
3. [`docker-agent-home.md`](docker-agent-home.md)
4. [`../tool-usages/orchestrator-runtime-contract.md`](../tool-usages/orchestrator-runtime-contract.md)
5. choose one implementation path:
   [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md) for human-led Gemini CLI work or [`n8n-google-workspace-quickstart.md`](n8n-google-workspace-quickstart.md) for event-driven automation

Those explain the security contract, the shape of the Docker home you are about to launch, and the runtime responsibilities your orchestrator must own.

## Decision Point: Pick The Docker Host Path

| If your Docker host is | Use this path |
|------------------------|---------------|
| macOS or Linux | Run the Docker phase locally with the shell path below |
| Windows | Use the PowerShell path below |
| ChromeOS | Continue only if your Linux environment is truly Docker-capable; otherwise move the Docker phase to a stronger Linux, macOS, or Windows host |

## Step 1: Verify The Docker Toolchain

From the repository root:

macOS, Linux, or a Docker-capable ChromeOS Linux terminal:

```bash
bash scripts/verify-env.sh --mode=docker
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode docker
```

This checks the Docker-oriented path without pretending Docker was required for the very first beginner task.

## Step 2: Generate The Current Agent Context

```bash
node scripts/generate_all.js
```

This rebuilds:

- `GEMINI.md`
- `CLAUDE.md`

Run this any time you change:

- `agents/`
- `skills/`
- `mcp-protocols/`
- `mcp.config.json`
- `AGENTS.md`

## Step 3: Validate The Repository Contracts

```bash
npm run validate
```

This runs the fast validation tier:

- repository audit for persona and generator invariants
- persona and template contracts
- generator determinism
- golden fixtures for generated context sections
- static smoke checks for example inventories and Docker-facing docs

If you intentionally changed generated sections, refresh the golden fixtures with:

```bash
npm run test:update-fixtures
```

## Step 4: Run Docker Smoke Validation

```bash
npm run test:e2e
```

This is the slower runtime tier. It attempts to bring up the current Docker homes and verify that expected services reach a running state:

- local builder home
- fleet operator home
- gatekeeper specialist home

If Docker is not installed in your environment, the e2e suite skips cleanly.
If it fails on a Docker-capable host, inspect `test-artifacts/docker-smoke/` or follow the deeper playbook in [`docker-runtime-verification.md`](docker-runtime-verification.md).

## Step 5: Launch The Local Builder Home

Start with the smallest Docker home:

```bash
cd examples/docker
cat .env.example
op run --env-file=.env.example -- docker compose up -d --build
```

This gives you:

- one runtime container
- one memory store
- vault-injected secrets
- a safe place to experiment without inventing your own topology first

If you want to inspect the container directly:

```bash
docker exec -it noemi-agent-runtime bash
```

The historical Python sample inside this sandbox is optional and illustrative. The main goal here is to prove the home shape, secret injection, and container wiring.

## Step 6: Try The Generated Context With An Orchestrator

Back at the repository root, use a safe local task again:

```bash
gemini -p GEMINI.md "List the engineering agents in this repository and summarize what each one does in one sentence."
```

That confirms the generated context and orchestrator path are both usable after the Docker home is in place.
If you are using Claude Code or Codex instead, reuse the same repo-local prompt there.

If the task needs external credentials, switch to the Fetch-on-Demand wrapper:

```bash
infisical run --env=dev -- gemini
```

## Step 7: Choose The Next Home

After the local builder home works:

- move to [`../../examples/fleet-deployment/`](../../examples/fleet-deployment/) when you need a governed multi-tenant operator home
- move to [`../../examples/gatekeeper-deployment/`](../../examples/gatekeeper-deployment/) when you want a focused specialist home with reporting and health plumbing

## Practical Working Rhythm

The normal builder loop for Docker-facing work looks like this:

```bash
bash scripts/verify-env.sh --mode=docker
node scripts/generate_all.js
npm run validate
npm run test:e2e
```

On Windows, use the same loop with the PowerShell preflight:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode docker
node scripts/generate_all.js
npm run validate
npm run test:e2e
```

Then launch or relaunch the Docker home you are working on.

## If Something Fails

- `verify-env.sh` fails:
  install the missing tool for the Docker path first
- `npm run validate` fails:
  fix the contract or generator drift before launching Docker
- `npm run test:e2e` fails:
  inspect `test-artifacts/docker-smoke/` and the relevant compose stack before assuming the persona or docs are wrong
- the container runs but the agent workflow fails:
  check whether the required vault-backed variables were actually injected at launch

## Outcome

By the end of this walkthrough you should have:

- validated the repo
- generated the current context
- exercised the Docker path
- launched one safe agent home
- confirmed an orchestrator can consume the generated output
