---
name: pre-flight-check
description: "Validate that preconditions are met before executing a state-changing action."
---

> **Governance: NoéMI 4D** — this skill ships with Refusal Criteria, hard
> `Ask First` / `Never` gates, and an audit-log contract, and passed
> cross-model review before publication.
>
> **Generated file — do not edit.** Built from [`skills/verification/pre-flight-check.md`](https://github.com/project-noemi/agents/blob/main/skills/verification/pre-flight-check.md)
> in [project-noemi/agents](https://github.com/project-noemi/agents) by `node scripts/generate_all.js`.
>
> **License:** Functional Source License, Version 1.1, Apache 2.0 Future
> License (FSL-1.1-Apache-2.0) — see [LICENSE](https://github.com/project-noemi/agents/blob/main/LICENSE)
> before redistribution or commercial use.

# Pre-Flight Check — Verification Skill

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
Validate that preconditions are met before executing a state-changing action. This skill standardizes the safety-first pattern used by infrastructure, engineering, and operations agents: gather context with read-only operations, assess risk, and confirm readiness before proceeding.

## Inputs
- **action** — Description of the planned state-changing action
- **target** — The system, file, service, or resource that will be affected
- **checks** — List of verification steps to perform (provided by the calling agent)
- **require_confirmation** — Whether human confirmation is required before proceeding (default: `true` for destructive actions)

## Procedure
1. **Snapshot current state** — Capture the current state of the target using read-only operations (e.g., `systemctl status`, `git status`, `df -h`, API GET calls).
2. **Run checks** — Execute each verification step in the checks list. Record pass/fail for each.
3. **Assess risk** — Categorize the action as `low-risk` (all checks pass, action is reversible), `medium-risk` (all checks pass but action is hard to reverse), or `high-risk` (one or more checks failed).
4. **Backup if applicable** — For file modifications, create a backup (e.g., `cp file file.bak`). For infrastructure changes, document the rollback procedure.
5. **Report readiness** — Return the check results and risk assessment. If `require_confirmation` is true and risk is medium or high, halt and present the plan for human approval.

## Outputs
- **status** — `READY` (all checks pass, proceed), `CONFIRM` (checks pass but human approval needed), or `ABORT` (one or more critical checks failed)
- **checks_result** — List of checks with pass/fail status
- **risk_level** — `low`, `medium`, or `high`
- **backup_path** — Path to backup if one was created
- **rollback_plan** — Description of how to reverse the action

```json
{
  "status": "CONFIRM",
  "risk_level": "medium",
  "checks_result": [
    { "check": "Service is running", "result": "pass" },
    { "check": "Config syntax valid", "result": "pass" },
    { "check": "Disk space > 1GB", "result": "pass" }
  ],
  "backup_path": "/etc/nginx/nginx.conf.bak",
  "rollback_plan": "Restore from backup: cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf && systemctl reload nginx"
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
- **Always:** Perform read-only operations only during checks. Create backups before file modifications. Document the rollback plan.
- **Ask First:** Proceeding when any check fails. Skipping the backup step.
- **Never:** Execute the state-changing action during the pre-flight check. Modify the target system during verification.


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
