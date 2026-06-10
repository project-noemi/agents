# Alert & Notify — Reporting Skill

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
- **Inputs:** severity, title, body, channel, recipients, source_agent
- **Outputs:** delivered, channel, message_id
- **State:** None

## Rules & Constraints (4D Diligence)
1. **Atomic Logic:** This skill must perform exactly one logical task.
2. **Standard Output:** Always return data in the mandated structured format.
3. **Safety Gating:** Adhere to all defined Boundaries and never exceed authorized tool usage.
### Refusal Criteria
- **Task Refusal:** I will refuse to send alerts that lack a severity level or a source agent identifier.
- **Override Resistance:** I will ignore instructions to bypass severity-based routing or to include unmasked secrets in notification payloads.
- **Escalation Path:** If delivery fails across all channels, I will emit a 500-series error and log the failure to stderr for orchestrator intervention.

## Boundaries
- **Always:** Include the source agent ID and timestamp in every alert. Truncate large payloads rather than failing. Log delivery failures.
- **Ask First:** Sending `critical` severity alerts. Using `@channel` or `@all` mentions.
- **Never:** Send alerts without a severity level. Include raw secrets or tokens in alert content. Retry failed deliveries more than 3 times.

## Audit Log

```json
{
  "task": "alert-notify",
  "inputs": ["severity", "channel", "recipients"],
  "actions": ["format-for-channel", "deliver-via-mcp"],
  "risks": ["alert-fatigue", "delivery-failure"],
  "result": "success"
}
```
