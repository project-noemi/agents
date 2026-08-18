---
name: risk-triage
description: "Categorize items into risk tiers to determine the appropriate action path."
---

> **Governance: NoéMI 4D** — this skill ships with Refusal Criteria, hard
> `Ask First` / `Never` gates, and an audit-log contract, and passed
> cross-model review before publication.
>
> **Generated file — do not edit.** Built from [`skills/classification/risk-triage.md`](https://github.com/project-noemi/agents/blob/main/skills/classification/risk-triage.md)
> in [project-noemi/agents](https://github.com/project-noemi/agents) by `node scripts/generate_all.js`.
>
> **License:** Functional Source License, Version 1.1, Apache 2.0 Future
> License (FSL-1.1-Apache-2.0) — see [LICENSE](https://github.com/project-noemi/agents/blob/main/LICENSE)
> before redistribution or commercial use.

# Risk Triage — Classification Skill

## Global Mandates

These repository-wide mandates travel with the skill and bind regardless of
the host agent's own context:

### 🔐 Secrets & Configuration

This project follows a "Fetch-on-Demand" architecture for security (Phase 0 Security). All sensitive credentials (API keys, database URLs, etc.) are stored exclusively in an encrypted SecretOps platform (Infisical or 1Password) and are never written to disk or hardcoded in source code.

#### Mandatory Security Rules

- NEVER ask the user for secrets in the chat interface.


- NEVER hardcode actual secret values in any files, `.env` files, or logs.


- ALWAYS use an Environment Injection CLI (`infisical run` or `op run`) to resolve credentials at runtime.

### 🛡 Error Handling and Resilience

To ensure reliability and stability, agents and toolkit components must implement robust error handling patterns.

#### Mandatory Directives
- **Graceful Degradation**: If an MCP tool or external API fails, the agent must explain the error clearly and attempt alternative strategies if available, rather than silently failing.
- **Exponential Backoff**: Implement exponential backoff retry logic for transient network errors or rate-limiting (429) responses. Use `scripts/resilience_helpers.js` as the canonical Node.js reference implementation.
- **Standardized Logging**: All technical errors must be logged to `stderr` to allow the orchestrator to capture and report execution failures accurately. Agent observability should leverage the `logging-mcp` protocol for unified access to Loki/Grafana and n8n webhook backends.
- **Internal Tool & Service Audit Logs**: All Node.js-based tools in `tools/` and reference services in `examples/` that perform automated ingestion, routing, or state mutation must emit a structured JSON Audit Log to `stderr` for every significant operational event, following the same lightweight shape as agent personas.

## Purpose
Categorize items into risk tiers to determine the appropriate action path. This skill standardizes the pattern of multi-tier classification used across triage agents (PR review, data privacy, prompt security) so that the classification logic, output format, and escalation rules are consistent fleet-wide.

## Inputs
- **item** — The entity to classify (PR metadata, data payload, user prompt, alert, etc.)
- **criteria** — A set of rules provided by the calling agent that define what qualifies for each tier
- **tiers** — The classification tiers to use (defaults to three-tier: Safe / Needs Review / Blocked)
- **escape_hatch** — Optional label or flag that causes the item to be logged as "Skipped" with no action

## Procedure
1. **Check escape hatch** — If the item carries the escape hatch flag, log it as `SKIPPED` and return immediately.
2. **Evaluate against criteria** — Test the item against the calling agent's criteria, starting from the most restrictive tier (Blocked) down to the least restrictive (Safe).
3. **Classify** — Assign the item to the first matching tier. If no tier matches, default to the middle tier (Needs Review) — never default to Safe.
4. **Annotate** — Record which specific criteria triggered the classification. This becomes the audit trail.
5. **Return** — Provide the classification result with tier, reasoning, and matched criteria.

## Outputs
- **tier** — The assigned classification (e.g., `SAFE`, `NEEDS_REVIEW`, `BLOCKED`, `SKIPPED`)
- **reasons** — List of criteria that determined the classification
- **confidence** — `high` (all criteria clearly matched) or `low` (ambiguous — defaulted to conservative tier)

```json
{
  "tier": "NEEDS_REVIEW",
  "reasons": ["CI check pending", "Author is external contributor"],
  "confidence": "high"
}
```


## Data Inventory
- **Inputs:** TBD
- **Outputs:** TBD
- **State:** None

## Rules & Constraints (4D Diligence)
1. **Atomic Logic:** This skill must perform exactly one logical task.
2. **Standard Output:** Always return data in the mandated structured format.
3. **Safety Gating:** Adhere to all defined Boundaries and never exceed authorized tool usage.
### Refusal Criteria
- **Task Refusal:** TBD
- **Override Resistance:** TBD
- **Escalation Path:** TBD

## Boundaries
- **Always:** Default to the conservative (middle) tier when uncertain. Include the full reasoning in the output.
- **Ask First:** Overriding a Blocked classification to a lower tier.
- **Never:** Classify an item as Safe when any criterion is ambiguous or unresolvable. Skip the escape hatch check.


## Audit Log

```json
{
  "task": "...",
  "inputs": [],
  "actions": [],
  "risks": [],
  "result": "..."
}
```
