---
name: alert-notify
description: "Deliver alerts and notifications to communication channels (Slack, email) with consistent formatting, severity levels, and routing rules."
---

> **Governance: NoéMI 4D** — this skill ships with Refusal Criteria, hard
> `Ask First` / `Never` gates, and an audit-log contract, and passed
> cross-model review before publication.
>
> **Generated file — do not edit.** Built from [`skills/reporting/alert-notify.md`](https://github.com/project-noemi/agents/blob/main/skills/reporting/alert-notify.md)
> in [project-noemi/agents](https://github.com/project-noemi/agents) by `node scripts/generate_all.js`.
>
> **License:** Functional Source License, Version 1.1, Apache 2.0 Future
> License (FSL-1.1-Apache-2.0) — see [LICENSE](https://github.com/project-noemi/agents/blob/main/LICENSE)
> before redistribution or commercial use.

# Alert & Notify — Reporting Skill

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
Deliver alerts and notifications to communication channels (Slack, email) with consistent formatting, severity levels, and routing rules. This skill standardizes how agents escalate information to humans — ensuring alert fatigue is minimized and critical notifications are never lost.

## Inputs
- **severity** — Alert level: `info`, `warning`, or `critical`
- **title** — Short summary of the alert (one line)
- **body** — Detailed message content
- **channel** — Target delivery channel: `slack`, `email`, or `both`
- **recipients** — Channel-specific routing (Slack channel name, email addresses)
- **source_agent** — ID of the agent raising the alert

## Procedure
1. **Format for channel** — Apply channel-specific formatting:
   - **Slack:** Use Block Kit. Code blocks for errors/logs. Bold for severity. Include agent ID and timestamp in footer.
   - **Email:** Use HTML formatting. Include severity in subject line prefix (e.g., `[CRITICAL]`).
2. **Apply severity rules:**
   - `info` — Standard delivery, no special routing.
   - `warning` — Include `@here` mention in Slack (or priority flag in email).
   - `critical` — Include `@channel` mention in Slack (or urgent flag in email). Require delivery confirmation.
3. **Truncate if needed** — If body exceeds channel limits (Slack: 3000 chars), truncate and append a link to the full report.
4. **Deliver** — Send via the appropriate MCP (`slack` or `gmail`).
5. **Confirm delivery** — Verify the message was accepted by the channel API. Log failures to stderr.

## Outputs
- **delivered** — Boolean indicating successful delivery
- **channel** — Which channel was used
- **message_id** — Channel-specific message identifier (for threading follow-ups)

```json
{
  "delivered": true,
  "channel": "slack",
  "message_id": "1234567890.123456"
}
```

## MCP Dependencies
- `slack` MCP — For Slack delivery (Block Kit formatting, channel posting)
- `gmail` MCP — For email delivery


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
- **Always:** Include the source agent ID and timestamp in every alert. Truncate large payloads rather than failing. Log delivery failures.
- **Ask First:** Sending `critical` severity alerts. Using `@channel` or `@all` mentions.
- **Never:** Send alerts without a severity level. Include raw secrets or tokens in alert content. Retry failed deliveries more than 3 times.

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
