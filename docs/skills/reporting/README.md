# Reporting Skills

Skills for generating standardized reports and delivering notifications.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Structured Report](../../../skills/reporting/structured-report.md) | Generate Markdown/JSON cycle reports | Gatekeeper, Fleet Dashboard, ROI Auditor |
| [Alert & Notify](../../../skills/reporting/alert-notify.md) | Deliver alerts to Slack/email with severity routing | Gatekeeper, Fleet Dashboard |

## Pattern

Reporting skills separate **format** from **delivery**:
- `structured-report` handles formatting (Markdown, JSON) but not sending
- `alert-notify` handles delivery (Slack, email) with severity-based routing

This separation means an agent can generate a report and deliver it to multiple channels independently.
