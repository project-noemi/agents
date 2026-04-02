## Active Skills

8 reusable skills available. Agents reference these in their Workflow sections.

# Risk Triage — Classification Skill

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

## Boundaries
- **Always:** Default to the conservative (middle) tier when uncertain. Include the full reasoning in the output.
- **Ask First:** Overriding a Blocked classification to a lower tier.
- **Never:** Classify an item as Safe when any criterion is ambiguous or unresolvable. Skip the escape hatch check.

## Examples

**PR Triage (Gatekeeper agent):**
- Input: PR with passing CI, 12 lines changed, docs-only, org member author
- Criteria: Gatekeeper Rule #2 (all conditions met)
- Output: `{ "tier": "SAFE", "reasons": ["CI green", "docs-only", "<300 LOC", "org member"], "confidence": "high" }`

**Data Privacy (PIIGuard agent):**
- Input: JSON payload containing "SSN: 999-00-1234"
- Criteria: PIIGuard classification (Confidential/PII patterns)
- Output: `{ "tier": "BLOCKED", "reasons": ["SSN pattern detected"], "confidence": "high" }`

# Pre-Flight Check — Verification Skill

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

## Boundaries
- **Always:** Perform read-only operations only during checks. Create backups before file modifications. Document the rollback plan.
- **Ask First:** Proceeding when any check fails. Skipping the backup step.
- **Never:** Execute the state-changing action during the pre-flight check. Modify the target system during verification.

## Examples

**Linux config change (SysAdmin agent):**
- Action: "Edit /etc/nginx/nginx.conf to add new server block"
- Checks: [`nginx -t` (syntax), `df -h` (disk), `systemctl status nginx` (running)]
- Output: `{ "status": "CONFIRM", "risk_level": "medium", "backup_path": "/etc/nginx/nginx.conf.bak" }`

**PR merge (Gatekeeper agent):**
- Action: "Squash-merge PR #42"
- Checks: [CI green, no conflicts, branch protection rules met]
- Output: `{ "status": "READY", "risk_level": "low", "checks_result": [...] }`

# Cross-Reference — Verification Skill

## Purpose
Verify that a claimed action actually occurred by checking it against an authoritative source of truth. This skill addresses the trust gap between what an agent _reports_ it did and what _actually happened_ in the target system. Used by dashboards, auditors, and any agent that consumes reports from other agents.

## Inputs
- **claims** — List of claimed actions to verify, each with:
  - `type` — The action type (e.g., "pr_merged", "pr_closed", "label_added", "file_created")
  - `identifier` — Resource identifier (e.g., repo + PR number, file path)
  - `expected_state` — What the source of truth should show if the claim is true
- **source_of_truth** — The system to verify against (e.g., GitHub API, filesystem, database)
- **batch_size** — Max claims to verify per cycle (to respect rate limits)

## Procedure
1. **Queue claims** — Accept claims and mark each as `pending`.
2. **Batch verify** — For each claim up to `batch_size`:
   a. Query the source of truth for the current state of the resource.
   b. Compare the actual state against `expected_state`.
   c. Mark the claim as `verified` (match), `mismatch` (contradiction), or `unverifiable` (no method available).
3. **Record evidence** — For each verification, store the query result and timestamp as audit evidence.
4. **Flag mismatches** — Any `mismatch` result triggers an anomaly alert with expected vs. actual values.
5. **Return results** — Provide per-claim verification status.

## Outputs
- **results** — List of verification outcomes per claim
- **summary** — Counts of verified, mismatch, unverifiable, and pending claims

```json
{
  "results": [
    { "type": "pr_merged", "identifier": "org/repo#42", "status": "verified", "evidence": "merged=true, sha=abc123" },
    { "type": "label_added", "identifier": "org/repo#43", "status": "mismatch", "expected": "needs-review", "actual": "no matching label" }
  ],
  "summary": { "verified": 1, "mismatch": 1, "unverifiable": 0, "pending": 0 }
}
```

## MCP Dependencies
- Depends on the MCP for the source of truth being queried (e.g., `github` MCP for PR verification)

## Boundaries
- **Always:** Respect rate limits on the source of truth API. Record evidence for every verification. Flag all mismatches immediately.
- **Ask First:** Increasing batch_size beyond the default. Marking a mismatch as "resolved" without investigation.
- **Never:** Modify the source of truth during verification. Silently ignore mismatches. Assume a claim is true without querying.

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

## Boundaries
- **Always:** Include the source agent ID and timestamp in every alert. Truncate large payloads rather than failing. Log delivery failures.
- **Ask First:** Sending `critical` severity alerts. Using `@channel` or `@all` mentions.
- **Never:** Send alerts without a severity level. Include raw secrets or tokens in alert content. Retry failed deliveries more than 3 times.

# HMAC Sign & Submit — Security Skill

## Purpose
Sign an outgoing payload with HMAC-SHA256 and submit it to a receiving API that verifies agent identity and payload integrity. This skill implements the cryptographic trust layer used by agents reporting to the Fleet Dashboard or any API that requires authenticated, tamper-evident submissions.

## Inputs
- **payload** — The JSON body to sign and submit (will be serialized with deterministic key ordering)
- **signing_secret** — The agent's HMAC secret (resolved from vault at runtime, never hardcoded)
- **api_url** — The target API endpoint
- **auth_token** — Bearer token for API authentication (resolved from vault at runtime)

## Procedure
1. **Serialize** — Convert the payload to a JSON string with deterministic key ordering (keys sorted alphabetically). This ensures the same payload always produces the same signature.
2. **Sign** — Compute `HMAC-SHA256(signing_secret, serialized_payload)` and encode as hex.
3. **Build headers** — Construct the request with:
   - `Content-Type: application/json`
   - `Authorization: Bearer <auth_token>`
   - `X-Signature-256: sha256=<hex_signature>`
4. **Submit** — POST the serialized payload to `api_url` with the constructed headers. Apply a 30-second timeout.
5. **Handle response:**
   - `200-299` — Success. Return the response body.
   - `401` — Authentication failure. Log the error and alert via Slack. **Do not retry with different credentials.**
   - `429` — Rate limited. Apply exponential backoff (max 3 retries).
   - `5xx` — Server error. Retry once after 5 seconds. If still failing, log and alert.

## Outputs
- **submitted** — Boolean indicating successful submission
- **status_code** — HTTP response status code
- **response** — Response body from the API (if successful)
- **signature** — The hex-encoded HMAC signature that was sent (for audit logging)

```json
{
  "submitted": true,
  "status_code": 200,
  "response": { "id": "report-123", "status": "accepted" },
  "signature": "a1b2c3d4e5f6..."
}
```

## Boundaries
- **Always:** Use deterministic key ordering for serialization. Include both Bearer token and HMAC signature. Log every submission attempt (success or failure) with timestamp.
- **Ask First:** Retrying after a 401 response. Changing the signing algorithm.
- **Never:** Log or expose the signing secret or auth token in outputs. Retry 401 responses automatically. Submit without both authentication headers.

## Examples

**Fleet Dashboard submission (Gatekeeper agent):**
```bash
BODY='{"agent_id":"gatekeeper","cycle_timestamp":"2026-03-17T12:00:00Z",...}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')
curl -X POST "$DASHBOARD_API_URL/api/v1/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DASHBOARD_AUTH_TOKEN" \
  -H "X-Signature-256: sha256=$SIGNATURE" \
  -d "$BODY"
```

# PII Scan — Security Skill

## Purpose
Scan a data payload for Personally Identifiable Information (PII) and sensitive data patterns, then classify, redact, or block the payload accordingly. This skill extracts the core detection and redaction logic used by Guardian agents into a reusable component that any agent can invoke before sending data to external systems.

## Inputs
- **payload** — The data to scan (string, JSON, or structured document)
- **context** — Where the payload is headed: `public_api` (external LLM, SaaS), `walled_garden` (internal/local model), or `internal_log` (audit storage)
- **redaction_mode** — `auto` (attempt redaction), `strict` (block if any PII found), or `report_only` (scan but don't modify)

## Procedure
1. **Pattern scan** — Search the payload for known PII patterns:
   - Social Security Numbers (XXX-XX-XXXX)
   - Credit card numbers (Luhn-valid sequences)
   - Email addresses
   - Phone numbers
   - Private health information (PHI) markers
   - API keys, connection strings, and credential patterns
   - Physical addresses
2. **Classify sensitivity** — Assign the payload to a tier:
   - **Public** — No PII detected. Safe for any destination.
   - **Internal** — Contains internal identifiers or business data. Safe for walled garden, not for public APIs.
   - **Confidential/PII** — Contains PII or credentials.
3. **Apply action based on context + classification:**
   - Public payload → any context: `APPROVED`
   - Internal payload → `walled_garden` or `internal_log`: `APPROVED`
   - Internal payload → `public_api`: `FLAGGED`
   - Confidential payload + `auto` mode: Attempt redaction → `REDACTED`
   - Confidential payload + `strict` mode: `BLOCKED`
   - Confidential payload where redaction destroys utility: `BLOCKED`
4. **Redact** (if applicable) — Replace detected PII with typed placeholders: `[REDACTED_SSN]`, `[REDACTED_CC]`, `[REDACTED_EMAIL]`, etc. Preserve semantic structure.
5. **Return** — Provide the scan result with classification, action, and sanitized payload.

## Outputs
- **status** — `APPROVED`, `FLAGGED`, `REDACTED`, or `BLOCKED`
- **classification** — `public`, `internal`, or `confidential`
- **findings** — List of detected patterns with type and location
- **payload** — Original (if approved) or sanitized (if redacted) payload
- **reason** — Human-readable explanation of the decision

```json
{
  "status": "REDACTED",
  "classification": "confidential",
  "findings": [
    { "type": "SSN", "location": "summary field", "redacted": true },
    { "type": "credit_card", "location": "summary field", "redacted": true }
  ],
  "payload": "New hire [REDACTED_NAME] completed orientation. SSN: [REDACTED_SSN], card: [REDACTED_CC]. Please process.",
  "reason": "2 PII patterns detected and redacted. Semantic structure preserved."
}
```

## Boundaries
- **Always:** Scan every payload before forwarding to external systems. Use typed placeholders that indicate what was redacted. Log scan results (without the PII itself) for audit.
- **Ask First:** Changing redaction patterns. Allowing a Confidential payload through in `report_only` mode.
- **Never:** Forward unscanned payloads to public APIs. Include actual PII values in scan result logs. Attempt to answer the user's underlying question — this skill is a compliance filter only.

# Dispatch & Coordinate — Orchestration Skill

## Purpose
Delegate work to one or more sub-agents and aggregate their outputs into a unified result. This skill standardizes the pattern used by coordinator agents (like Video Content Manager) that decompose a task, dispatch it to specialists, monitor for cross-agent consistency, and compile the final deliverable.

## Inputs
- **task_context** — Shared context document that all sub-agents need (e.g., project brief, source material analysis)
- **dispatches** — List of sub-agent assignments, each with:
  - `agent` — Path to the agent spec (e.g., `agents/marketing/seo-strategist.md`)
  - `task` — Specific instructions for this sub-agent
  - `depends_on` — Optional list of other dispatch IDs whose output this agent needs
- **consistency_checks** — Optional list of cross-agent validation rules (e.g., "thumbnail hook text must align with title")

## Procedure
1. **Prepare shared context** — Compile the task_context document that all sub-agents will receive.
2. **Resolve dependencies** — Determine execution order from `depends_on` declarations. Independent dispatches can run in parallel.
3. **Dispatch** — For each sub-agent (in dependency order):
   a. Load the agent spec to understand its Role, Tone, and expected Output Format.
   b. Provide the shared context + agent-specific task instructions.
   c. If the agent depends on prior outputs, include those in the task instructions.
   d. Collect the sub-agent's output.
4. **Validate consistency** — Run each consistency check across the collected outputs. Flag conflicts.
5. **Aggregate** — Compile all sub-agent outputs into a unified deliverable, organized by agent contribution.
6. **Return** — Provide the aggregated result with consistency check outcomes.

## Outputs
- **deliverable** — Unified output combining all sub-agent contributions
- **agent_outputs** — Individual outputs keyed by agent ID (for traceability)
- **consistency_results** — Pass/fail for each consistency check
- **conflicts** — List of cross-agent inconsistencies requiring human resolution

```json
{
  "deliverable": { "titles": [...], "thumbnails": [...], "description": "..." },
  "agent_outputs": {
    "seo-strategist": { "titles": [...], "tags": [...] },
    "thumbnail-specialist": { "variants": [...] }
  },
  "consistency_results": [
    { "check": "Title-thumbnail hook alignment", "status": "pass" }
  ],
  "conflicts": []
}
```

## Boundaries
- **Always:** Provide the shared context to every sub-agent. Validate consistency before returning the final deliverable. Preserve individual agent outputs for traceability.
- **Ask First:** Overriding a sub-agent's output to resolve a conflict. Re-dispatching to a sub-agent after a consistency failure.
- **Never:** Modify a sub-agent's output without flagging it. Dispatch to an agent spec that doesn't exist. Skip consistency checks.
