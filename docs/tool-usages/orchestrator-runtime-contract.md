# Orchestrator Runtime Contract

Project NoeMI defines personas, skills, policies, and reference topologies. The orchestrator is responsible for turning those assets into a governed runtime.

This document describes the canonical runtime contract expected around the repository's agents. It is the missing layer between "the repo says what the agent is" and "a real system runs the agent safely."

## Core Principle

The repository does not verify identity, authorization, secret resolution, observability, and execution control by itself. Those responsibilities belong to the surrounding orchestrator, ingress layer, workflow engine, or runtime platform.

## 1. Identity and Authorization

### What the orchestrator owns

- authenticate the human or system invoking the workflow
- enforce role-based access before a persona is invoked
- decide whether the caller is allowed to use a high-risk agent or MCP
- prevent privilege escalation across agents, tenants, and environments

### What the agent should not assume

- raw Casdoor token parsing
- direct user-session validation
- standalone RBAC enforcement without orchestration support

### Recommended pattern

1. identity is verified at ingress or workflow-entry level
2. the orchestrator maps that identity to an allowed persona and action set
3. the agent receives only the minimal identity context it needs:
   - tenant or workspace identifier
   - user role or policy tier
   - request or trace identifier
4. raw identity tokens remain outside the agent context whenever possible

This keeps the repo aligned with the current decision that identity verification is primarily an orchestrator or ingress concern.

## 2. Secret Resolution

The orchestrator must preserve the repository's Fetch-on-Demand policy:

- use `infisical run` or `op run`
- inject secrets into process memory at runtime
- never hand the agent plaintext secrets through prompts or checked-in files
- keep `.env.template` and `.env.example` as inventories or vault-reference manifests only

## 3. Execution Contract

For a clean runtime boundary, the orchestrator should treat agent execution as having three outputs:

### Primary payload

- the user-facing or downstream-facing answer
- usually written to `stdout` or returned as the workflow's main result

### Technical errors

- operational failures, stack traces, dependency issues, retry exhaustion
- should be written to `stderr`

### Audit log

- the lightweight structured JSON record required by `AGENTS.md`
- must be emitted separately from the primary payload
- must exclude secrets, credentials, and PII

The repository standardizes the minimum audit shape but does not force one transport for every orchestrator. A workflow engine may store it as a side-channel JSON field, a log event, or another machine-readable trace record.

## 4. Observability Contract

At minimum, the orchestrator should capture:

- agent or persona identifier
- task or workflow name
- request or trace id
- tenant or workspace identifier when multi-tenant
- start time and finish time
- success or failure status
- retry count when retries occur
- separate technical error output
- separate audit-log record

### Recommended sinks

- local builder home: container logs plus minimal runtime inspection
- fleet operator home: Loki/Grafana or equivalent centralized observability
- specialist home: service-specific metrics and dashboard plumbing

## 5. Human Approval Boundaries

The orchestrator must enforce the repository's "ask first" and "human-in-the-loop" intent for mutating actions.

Examples:

- sending email
- merging or closing pull requests
- changing infrastructure or permissions
- deleting data
- executing production-impacting workflows

The persona can describe the boundary, but the orchestrator must implement the stop.

## 6. Failure Handling

The orchestrator should implement:

- graceful degradation when MCPs or external services fail
- exponential backoff for transient failures and rate limits
- explicit user-facing explanation when a fallback path is used
- bounded retries rather than infinite loops

Use the repository's reference helper where useful:

- [`../../scripts/retry-with-backoff.sh`](../../scripts/retry-with-backoff.sh)

## 7. Multi-Tenant Safety

For MSP, cohort, or fleet deployments:

- isolate secrets by tenant
- isolate orchestrator config by tenant
- do not reuse write-capable credentials across client boundaries
- carry tenant identity through logging, alerts, and audit records
- ensure one tenant's agent cannot report or act as another tenant's agent

This is especially important for stacks built on:

- [`../examples/msp-deployment.md`](../examples/msp-deployment.md)
- [`../examples/docker-agent-home.md`](../examples/docker-agent-home.md)
- [`../../examples/fleet-deployment/`](../../examples/fleet-deployment/)

## 8. Recommended Runtime Envelope

When an orchestrator invokes an agent, the surrounding envelope should include:

- the resolved persona or context file
- allowed MCP set
- tenant or workspace scope
- request id
- human approval state when relevant
- minimal identity claims

It should not include:

- raw vault secrets in prompt text
- unnecessary PII
- broad cross-tenant credentials
- raw identity tokens unless absolutely required

## 9. Relationship to the Docker Examples

Use the examples as reference homes:

- [`../examples/docker-agent-home.md`](../examples/docker-agent-home.md) for local builder shape
- [`../examples/docker-runtime-verification.md`](../examples/docker-runtime-verification.md) for boot verification
- [`../examples/msp-deployment.md`](../examples/msp-deployment.md) for multi-tenant operator framing

The examples show topology. This contract explains the responsibilities the topology must uphold.
