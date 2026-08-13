## Active Skills

9 reusable skills available. Agents reference these in their Workflow sections.
Summaries only: **read the full skill spec before executing it** — the Procedure, Boundaries, and Refusal Criteria that govern execution live in the spec, not here.
All skills, always: adhere to the defined Boundaries and **never exceed authorized tool usage**; each skill's hard gates (`Ask First` / `Never`) are reproduced below verbatim.

### Risk Triage — Classification Skill

- **Spec:** `skills/classification/risk-triage.md`
- **Purpose:** Categorize items into risk tiers to determine the appropriate action path.
- **Ask First:** Overriding a Blocked classification to a lower tier.
- **Never:** Classify an item as Safe when any criterion is ambiguous or unresolvable. Skip the escape hatch check.

### Pre-Flight Check — Verification Skill

- **Spec:** `skills/verification/pre-flight-check.md`
- **Purpose:** Validate that preconditions are met before executing a state-changing action.
- **Ask First:** Proceeding when any check fails. Skipping the backup step.
- **Never:** Execute the state-changing action during the pre-flight check. Modify the target system during verification.

### Cross-Reference — Verification Skill

- **Spec:** `skills/verification/cross-reference.md`
- **Purpose:** Verify that a claimed action actually occurred by checking it against an authoritative source of truth. This skill addresses the trust gap between what an agent _reports_ it did and what _actually happened_ in the target system.
- **Ask First:** Increasing batch_size beyond the default. Marking a mismatch as "resolved" without investigation.
- **Never:** Modify the source of truth during verification. Silently ignore mismatches. Assume a claim is true without querying.

### Structured Report — Reporting Skill

- **Spec:** `skills/reporting/structured-report.md`
- **Purpose:** Generate a standardized, machine-readable report from agent activity data.
- **Ask First:** Changing the report schema (requires Fleet Dashboard coordination).
- **Never:** Include raw secrets, tokens, or credentials in report output. Omit the reasoning field from detail entries.

### Alert & Notify — Reporting Skill

- **Spec:** `skills/reporting/alert-notify.md`
- **Purpose:** Deliver alerts and notifications to communication channels (Slack, email) with consistent formatting, severity levels, and routing rules.
- **Ask First:** Sending `critical` severity alerts. Using `@channel` or `@all` mentions.
- **Never:** Send alerts without a severity level. Include raw secrets or tokens in alert content. Retry failed deliveries more than 3 times.

### Release Herald — Reporting Skill

- **Spec:** `skills/reporting/release-herald.md`
- **Purpose:** Turn a **week of changes** (the commits and date-versioned `YYYY.MM.DD` releases from the past week) into a user-facing **currency digest**: a set of feature highlights written in benefit language, the week's governance provenance, and a matching LinkedIn/social post.
- **Ask First:** Publishing or scheduling a post to any channel. Changing tone/branding away from the requested `audience` and `channel`. Including customer names, logos, or quotes.
- **Never:** Auto-post to social or any external channel without explicit human approval (unless a deployment has explicitly configured an approved auto-post path). Fabricate features, metrics, dates, or release links not present in the source. Include secrets, credentials, or unreleased/embargoed information.

### HMAC Sign & Submit — Security Skill

- **Spec:** `skills/security/hmac-sign-submit.md`
- **Purpose:** Sign an outgoing payload with HMAC-SHA256 and submit it to a receiving API that verifies agent identity and payload integrity.
- **Ask First:** Retrying after a 401 response. Changing the signing algorithm.
- **Never:** Log or expose the signing secret or auth token in outputs. Retry 401 responses automatically. Submit without both authentication headers.

### PII Scan — Security Skill

- **Spec:** `skills/security/pii-scan.md`
- **Purpose:** Scan a data payload for Personally Identifiable Information (PII) and sensitive data patterns, then classify, redact, or block the payload accordingly.
- **Ask First:** Changing redaction patterns. Allowing a Confidential payload through in `report_only` mode.
- **Never:** Forward unscanned payloads to public APIs. Include actual PII values in scan result logs. Attempt to answer the user's underlying question — this skill is a compliance filter only.

### Dispatch & Coordinate — Orchestration Skill

- **Spec:** `skills/orchestration/dispatch-coordinate.md`
- **Purpose:** Delegate work to one or more sub-agents and aggregate their outputs into a unified result.
- **Ask First:** Overriding a sub-agent's output to resolve a conflict. Re-dispatching to a sub-agent after a consistency failure.
- **Never:** Modify a sub-agent's output without flagging it. Dispatch to an agent spec that doesn't exist. Skip consistency checks.
