# Structured Report — Reporting Skill

## Purpose
Generate a standardized, machine-readable report from agent activity data. This skill provides a consistent reporting format across all agents that produce cycle reports, triage summaries, or audit outputs — ensuring the Fleet Dashboard and downstream consumers can parse reports uniformly regardless of which agent produced them.

## Inputs
- **agent_id** — Identifier of the reporting agent
- **cycle_timestamp** — ISO 8601 timestamp of the reporting cycle
- **summary** — Key-value pairs of aggregate metrics (e.g., `{ "total_evaluated": 42, "auto_merged": 12 }`)
- **details** — List of individual action records, each with: action type, target identifier, outcome, and reasoning
- **format** — Output format: `markdown` (human-readable) or `json` (machine-readable). Default: both.

## Procedure
1. **Validate inputs** — Ensure `agent_id` and `cycle_timestamp` are present. Verify `details` entries have required fields.
2. **Build summary section** — Aggregate metrics into a summary table.
3. **Build details section** — Group individual actions by type (e.g., "Auto-merged", "Flagged", "Closed"). Include the target identifier, outcome, and reasoning for each.
4. **Build metadata** — Add report generation timestamp, agent version, and cycle duration.
5. **Format output** — Generate the report in the requested format(s).
6. **Return** — Provide the formatted report(s).

## Outputs
- **markdown** — Human-readable Markdown report with summary table and grouped details
- **json** — Machine-readable JSON following the Fleet Dashboard ingestion schema

```json
{
  "agent_id": "gatekeeper",
  "agent_version": "1.0.0",
  "cycle_timestamp": "2026-03-17T12:00:00Z",
  "generated_at": "2026-03-17T12:05:00Z",
  "summary": {
    "total_evaluated": 42,
    "actions": { "auto_merged": 12, "flagged_for_review": 8 }
  },
  "details": [
    { "action": "auto_merged", "target": "org/repo#42", "reasoning": "All safety criteria met" }
  ]
}
```

## MCP Dependencies
- None (format-only skill). Delivery to specific channels (Slack, Dashboard API) is handled by the `alert-notify` or `hmac-sign-submit` skills.

## Boundaries
- **Always:** Include `agent_id` and `cycle_timestamp` in every report. Validate all detail entries have required fields before formatting.
- **Ask First:** Changing the report schema (requires Fleet Dashboard coordination).
- **Never:** Include raw secrets, tokens, or credentials in report output. Omit the reasoning field from detail entries.
