# MSP Deployment Guide: NoéMI for Managed Service Providers

This guide describes how a Managed Service Provider (MSP) can deploy and operate NoéMI's agent framework to deliver tiered, multi-tenant services to clients.

## Overview

NoéMI is a specification library — not a runtime. This makes it well-suited for MSP use because:

- **Client configurations are declarative and auditable** — each tenant gets a versioned set of Markdown specs and an `mcp.config.json`
- **Secrets never leave the vault** — per-client vault compartments isolate credentials
- **Orchestration is external** — the MSP chooses the execution engine (Gemini CLI, n8n, LangChain) per client need
- **Governance is built in** — AI TRiSM, red team gauntlets, and the 4D Framework apply uniformly across tenants

Before onboarding a client into an AI workflow, establish their Phase 0 initial assessment first. Use the client-side guide at [`../PHASE_ZERO_SECURITY_BASELINE.md`](../PHASE_ZERO_SECURITY_BASELINE.md) and the reusable templates in [`../phase-zero-assessment/`](../phase-zero-assessment/) to document both:

- the minimum **security posture** required to begin safely
- the minimum **AI readiness** required to produce real business value

That gives the MSP a grounded basis for readiness gates, first-pilot selection, and remediation planning.
When you operationalize tenants, pair this guide with the orchestrator runtime expectations in [`../tool-usages/orchestrator-runtime-contract.md`](../tool-usages/orchestrator-runtime-contract.md) so identity, approval boundaries, logging, and retry handling remain consistent across clients.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   MSP Control Plane                     │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ Fleet        │  │ Onboard  │  │ Governance &      │ │
│  │ Dashboard    │  │ Agent    │  │ Red Team Gauntlet │ │
│  └──────┬───────┘  └────┬─────┘  └───────────────────┘ │
│         │               │                               │
├─────────┼───────────────┼───────────────────────────────┤
│         ▼               ▼                               │
│  ┌─────────────────────────────────┐                    │
│  │       Per-Client Tenant         │  × N clients       │
│  │  ┌───────────┐ ┌─────────────┐  │                    │
│  │  │ mcp.config│ │ Vault       │  │                    │
│  │  │ .json     │ │ Compartment │  │                    │
│  │  └─────┬─────┘ └──────┬──────┘  │                    │
│  │        ▼              ▼         │                    │
│  │  ┌──────────────────────────┐   │                    │
│  │  │ Orchestrator (n8n /      │   │                    │
│  │  │ Gemini CLI / LangChain)  │   │                    │
│  │  └──────────┬───────────────┘   │                    │
│  │             ▼                   │                    │
│  │  ┌──────────────────────────┐   │                    │
│  │  │ Active Agents            │   │                    │
│  │  │ (infra, guardian, ops…)  │   │                    │
│  │  └──────────────────────────┘   │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## Service Tier Model

Map agent combinations to your service tiers:

| Tier | Agents | MCPs | Use Case |
|------|--------|------|----------|
| **Basic** | `infrastructure/cpanel`, `infrastructure/linux`, `guardian/pii-guard` | GitHub | Small hosting clients, server maintenance |
| **Standard** | Basic + `operations/qa-risk-manager`, `operations/knowledge-manager`, `communication/*` | GitHub, Slack, Gmail, Google Suite | Mid-market clients needing automation + comms |
| **Premium** | Standard + `operations/fleet-dashboard`, `marketing/*`, `coding/*`, `engineering/*` | All MCPs + n8n workflows | Enterprise clients, full managed IT + development support |

## Per-Client Configuration

### 1. Vault Compartment

Each client gets an isolated vault namespace. Never share secrets across tenants.

```bash
# 1Password structure
op://MSP-Clients/ClientA/github-token
op://MSP-Clients/ClientA/slack-webhook
op://MSP-Clients/ClientA/cpanel-api-token

# Infisical structure
infisical run --env=client-a -- [command]
```

### 2. Client-Specific mcp.config.json

Fork the base config per client, enabling only the MCPs their tier includes:

```json
{
  "client": "client-a",
  "tier": "standard",
  "active_mcps": [
    "github",
    "slack",
    "gmail",
    "google-docs",
    "google-sheets"
  ],
  "active_agents": [
    "infrastructure/cpanel",
    "infrastructure/linux",
    "guardian/pii-guard",
    "guardian/prompt-shield",
    "operations/qa-risk-manager",
    "operations/knowledge-manager"
  ]
}
```

### 3. Context Generation

Generate the client-specific context file:

```bash
# Generate with client config
op run --env-file=.env.client-a -- node scripts/generate_all.js --config=clients/client-a/mcp.config.json
```

## Orchestration Patterns

### Pattern A: n8n per Client (Recommended for Standard+)

Each client gets an n8n instance (or namespace) with workflows wired to their agent specs. Typical MSP workflows:

- **Ticket triage** — Incoming PSA tickets classified and routed by the Knowledge Manager agent
- **Scheduled maintenance** — Linux/cPanel agents run health checks on cron, post results to Slack
- **Alert escalation** — Guardian agents detect anomalies, create tickets, notify on-call

### Pattern B: Gemini CLI for Ad-Hoc (Basic Tier)

For simpler engagements, technicians invoke agents directly:

```bash
op run --env-file=.env.client-a -- gemini -p clients/client-a/GEMINI.md "Check disk usage on web01"
```

### Pattern C: Fleet Deployment (Premium)

Use the `examples/fleet-deployment/docker-compose.yml` as a base, extending it with per-client service definitions and the Fleet Dashboard for cross-client observability.

## Governance for MSPs

### Per-Client Red Team Validation

Before onboarding a new client, run the Red Team Gauntlet (`examples/red-team-gauntlet/`) against their specific agent configuration to validate:

- Prompt injection resistance with client-specific context
- PII handling for the client's data domain
- Boundary enforcement (agents stay within their tenant scope)

### Cross-Client Reporting

The Fleet Dashboard aggregates reports across all client tenants. Use the three-layer authentication model (TLS → HMAC → data verification) to ensure reports from Client A's agents cannot be spoofed or confused with Client B's.

### Compliance Mapping

| MSP Requirement | NoéMI Component |
|----------------|-----------------|
| Data isolation | Per-client vault compartments + separate mcp.config |
| Audit trail | Fleet Dashboard ingestion logs + n8n execution history |
| Access control | Vault RBAC + orchestrator-level permissions |
| Incident response | Guardian agents + alert escalation workflows |
| Change management | Git-versioned agent specs + conventional commits |

## Getting Started

1. **Assess the client** — Complete the two-track Phase 0 initial assessment and document security readiness, AI readiness, and the overall recommendation
2. **Fork client configs** — Create `clients/{client-id}/mcp.config.json` from the base config
3. **Provision vault** — Set up the client's vault compartment with required credentials
4. **Select tier** — Enable the appropriate agents and MCPs
5. **Generate context** — Run `generate_gemini.js` with the client config
6. **Run gauntlet** — Validate with Red Team before going live
7. **Deploy orchestrator** — Stand up n8n workflows or configure Gemini CLI access
8. **Connect dashboard** — Point the client's agents at the Fleet Dashboard ingestion endpoint

## Next Steps

The following components are planned to complete the MSP story:

- [Client Onboarding Agent](../agents/operations/client-onboarding/) — Automates tenant provisioning
- [PSA/Ticketing MCP](../mcp-setup/psa-ticketing/) — Integration with ConnectWise, Autotask, HaloPSA
- [RMM MCP](../mcp-setup/rmm/) — Integration with Datto, NinjaRMM, N-able
- [Multi-Tenant Fleet Dashboard Extensions](../agents/operations/fleet-dashboard/) — Cross-client views, tenant-scoped RBAC
