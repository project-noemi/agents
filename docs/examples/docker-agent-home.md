# Docker Agent Home

This guide explains how to use Docker to build a **home for agents** around Project NoeMI without turning this repository into a runtime engine.

Project NoeMI is **not a runtime or execution engine**. It provides the personas, governance, skills, MCP rules, and reference examples that a runtime consumes. A Docker-based "agent home" is the environment you build around those assets so agents can live somewhere consistent, observable, and secure.

If you are brand new to AI implementation, start with [`zero-to-first-agent.md`](zero-to-first-agent.md) first.
If you already have a first local success and want the shortest guided Docker path, start with [`builder-first-30-minutes.md`](builder-first-30-minutes.md).
For the runtime validation path that proves these homes actually boot on a Docker-capable host, see [`docker-runtime-verification.md`](docker-runtime-verification.md).

## What an Agent Home Includes

A practical Docker home for agents usually has four layers:

1. **Context Layer**
   - the agent specs in `agents/`
   - generated context files such as `GEMINI.md` and `CLAUDE.md`
   - `mcp.config.json`, which decides which MCPs and skills are active
2. **Runtime Layer**
   - the orchestrator or worker container that actually runs tasks
   - examples: Gemini CLI wrapper, n8n, a focused worker container
3. **Support Layer**
   - optional memory stores, databases, queues, or file volumes
   - examples: PostgreSQL with pgvector, workflow state, persistent work dirs
4. **Operations Layer**
   - logging, metrics, dashboards, health checks, and ingress
   - examples: Grafana, Loki, InfluxDB, Traefik

## The Three Current Docker Topologies

The repository already contains three useful home shapes:

### 1. Local Builder Home

Use [`examples/docker/`](../../examples/docker/) when you want a small, local sandbox for experimenting with an agent runtime and a memory store.

- good for learning the file layout
- good for testing Fetch-on-Demand env injection inside containers
- not the recommended long-term production topology

### 2. Operator Home

Use [`examples/fleet-deployment/`](../../examples/fleet-deployment/) when you want a governed, multi-tenant home with ingress, identity, and observability.

- good for cohort operations, MSP-style isolation, and shared observability
- introduces Traefik, Casdoor, Grafana, Loki, and multiple isolated runtimes
- best fit for the "many agents, one governed environment" story

### 3. Specialist Home

Use [`examples/gatekeeper-deployment/`](../../examples/gatekeeper-deployment/) when you want one focused agent with its own reporting path, dashboard plumbing, and health model.

- good for production-minded single-agent services
- shows signed dashboard submission and health-aware reporting
- useful as a template for other specialized worker homes

## How to Build the Home Safely

### 1. Start with SecretOps, Not with `.env` Files

Before you start any stack:

- store the real values in Infisical or 1Password
- keep `.env.example` files as inventories or vault-reference manifests only
- launch containers through `op run` or `infisical run`

Examples:

```bash
op run --env-file=.env.example -- docker compose up -d --build
infisical run --env=dev -- docker compose up -d --build
```

For the security baseline behind this pattern, see [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md).
For the runtime responsibilities your orchestrator must own around identity, logging, retries, and approval gates, see [`../tool-usages/orchestrator-runtime-contract.md`](../tool-usages/orchestrator-runtime-contract.md).

### 2. Generate Context Before You Launch

Your containers should consume the generated context, not hand-written copies.

```bash
node scripts/generate_all.js
npm run validate
npm run test:e2e
```

That gives your runtime a current `GEMINI.md`, `CLAUDE.md`, a validated persona/MCP contract, and a runtime smoke check before you start treating the stack as trustworthy.

### 3. Mount Specs and Context as Inputs

The clean pattern is:

- keep persona source files in the repo
- regenerate context when specs or MCP config change
- mount the generated context into the runtime container as read-only input when possible

That keeps the repo as the source of truth and the containers as execution homes.

### 4. Separate Runtime from Support Services

Even in a small home, avoid collapsing everything into one container. A useful split is:

- one runtime container for the agent or orchestrator
- one support service for memory or state
- one optional observability service when the workflow matters operationally

This is why the examples are split across dedicated services rather than a single "magic box" image.

## A Minimal Home Pattern

The following pattern is intentionally small and meant as a starting point:

```yaml
version: "3.8"

services:
  agent-runtime:
    image: node:24-alpine
    command: ["sh", "-lc", "sleep infinity"]
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ../../agents:/workspace/agents:ro
      - ../../skills:/workspace/skills:ro
      - ../../mcp-protocols:/workspace/mcp-protocols:ro
      - ../../GEMINI.md:/workspace/GEMINI.md:ro

  agent-memory:
    image: ankane/pgvector:latest
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

This is not a new official runtime. It is the shape of a safe Docker home:

- context mounted in
- secrets injected at launch
- support services separated
- no hardcoded credentials

## How to Choose the Right Home

Choose based on the job you need the environment to do:

- use the local builder home when you are exploring one agent or one workflow
- use the operator home when you need governance, observability, and multiple isolated runtimes
- use the specialist home when one agent needs a durable reporting and health model

If you are unsure, start with the secure secret pattern, then the local builder home, then graduate into the fleet deployment once the workflow is worth governing.

## Suggested Builder Path

1. Read [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. Read [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
3. Generate context with `node scripts/generate_all.js`
4. Validate the repo with `npm run validate`
5. Start with [`../../examples/docker/`](../../examples/docker/)
6. Move to [`../../examples/fleet-deployment/`](../../examples/fleet-deployment/) when you need a real operator home

If the runtime smoke tier fails on a real host, inspect `test-artifacts/docker-smoke/` locally or the `docker-smoke-diagnostics` artifact in GitHub Actions.

## What This Guide Does Not Claim

- it does not turn this repository into a runtime product
- it does not replace n8n, Gemini CLI, or another orchestrator
- it does not eliminate the need for Phase 0 security and environment-specific hardening

It gives builders a cleaner way to think about Docker: not as "running the repo," but as building a governed home around the repo's agent definitions.
