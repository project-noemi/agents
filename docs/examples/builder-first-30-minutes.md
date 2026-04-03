# Builder First 30 Minutes

This walkthrough is the fastest safe path for a builder or accelerator who wants to move from clone to a working Docker-based agent home.

It does not turn Project NoeMI into a runtime engine. It shows how to validate the reference architecture, generate the current agent context, and launch one local Docker home around those assets.

## Before You Start

Read these two guides first:

1. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
2. [`docker-agent-home.md`](docker-agent-home.md)
3. [`../tool-usages/orchestrator-runtime-contract.md`](../tool-usages/orchestrator-runtime-contract.md)
4. Choose one implementation path:
   [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md) for human-led Gemini CLI work or [`n8n-google-workspace-quickstart.md`](n8n-google-workspace-quickstart.md) for event-driven automation

Those explain the security contract, the shape of the Docker home you are about to launch, and the runtime responsibilities your orchestrator must own.

## Step 1: Verify the Local Toolchain

From the repository root:

```bash
bash scripts/verify-env.sh
```

This checks the core local prerequisites and reminds you that secrets must come from `op run` or `infisical run`, not local plaintext env files.

## Step 2: Generate the Current Agent Context

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

## Step 3: Validate the Repository Contracts

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

## Step 4: Run Docker Smoke Validation When Docker Is Available

```bash
npm run test:e2e
```

This is the slower runtime tier. It attempts to bring up the current Docker homes and verify that expected services reach a running state:

- local builder home
- fleet operator home
- gatekeeper specialist home

If Docker is not installed in your environment, the e2e suite skips cleanly.
If it fails on a Docker-capable host, inspect `test-artifacts/docker-smoke/` or follow the deeper playbook in [`docker-runtime-verification.md`](docker-runtime-verification.md).

## Step 5: Launch the Local Builder Home

Start with the smallest Docker home:

```bash
cd examples/docker
cat .env.example
op run --env-file=.env.example -- docker compose up -d --build
```

Then enter the runtime container:

```bash
docker exec -it noemi-agent-runtime bash
python agent.py
```

This gives you:

- one runtime container
- one memory store
- vault-injected secrets
- a safe place to experiment without inventing your own topology first

## Step 6: Try the Generated Context with an Orchestrator

Back at the repository root:

```bash
infisical run --env=dev -- gemini -p GEMINI.md "List the engineering agents in this repository"
```

That confirms the generated context and orchestrator path are both usable.

## Step 7: Choose the Next Home

After the local builder home works:

- move to [`../../examples/fleet-deployment/`](../../examples/fleet-deployment/) when you need a governed multi-tenant operator home
- move to [`../../examples/gatekeeper-deployment/`](../../examples/gatekeeper-deployment/) when you want a focused specialist home with reporting and health plumbing

## Practical Working Rhythm

The normal builder loop looks like this:

```bash
bash scripts/verify-env.sh
node scripts/generate_all.js
npm run validate
npm run test:e2e
```

Then launch or relaunch the Docker home you are working on.

## If Something Fails

- `verify-env.sh` fails:
  install the missing tool or authenticate the SecretOps CLI first
- `npm run validate` fails:
  fix the contract or generator drift before launching Docker
- `npm run test:e2e` fails:
  inspect `test-artifacts/docker-smoke/` and the relevant compose stack before assuming the persona or docs are wrong
- the container runs but the agent fails:
  check whether the required vault-backed variables were actually injected at launch

## Outcome

By the end of this walkthrough you should have:

- validated the repo
- generated the current context
- exercised the current Docker path
- launched one safe agent home
- confirmed an orchestrator can consume the generated output
