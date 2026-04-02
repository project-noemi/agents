# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project NoéMI is an **agent specification library** — not a runtime or execution engine. It defines AI agent personas, MCP (Model Context Protocol) integrations, and governance frameworks as Markdown files. External orchestrators (Gemini CLI, n8n, LangChain) consume the generated output.
Project NoéMI also serves as the **public reference architecture** for NewPush's governed AI operating model, so code and docs in this repository should remain aligned with that role.

## Key Commands

```bash
# Generate GEMINI.md from template + active MCP protocols
node scripts/generate_gemini.js

# Generate CLAUDE.md from template + active MCP protocols
node scripts/generate_claude.js

# Verify environment prerequisites (Docker, Gemini CLI, etc.)
bash scripts/verify-env.sh

# Run commands with secrets injected (never hardcode credentials)
op run --env-file=.env.template -- [command]
infisical run --env=dev -- [command]
```

## Architecture

### Repository Layout

- `agents/` — **Source of truth** for all agent specifications, organized by domain (`coding/`, `guardian/`, `marketing/`, etc.)
- `docs/` — Documentation mirroring `agents/` structure, plus framework docs (REQUIREMENTS.md, METHODOLOGY.md, GOVERNANCE.md)
- `skills/` — Reusable task definitions that agents compose into their workflows
- `mcp-protocols/` — One `.md` file per MCP integration (Slack, Gmail, Google Suite, n8n, etc.)
- `scripts/` — Build utilities (context generation, environment verification)
- `examples/` — Deployment examples (Docker sandbox, fleet deployment, video automation pod, red team gauntlet)

### Context Generation Pipeline

Both `GEMINI.md` and `CLAUDE.md` are generated from their respective templates:

```
{GEMINI,CLAUDE}.template.md + mcp.config.json + AGENTS.md
    → scripts/generate_{gemini,claude}.js
    → {GEMINI,CLAUDE}.md
```

The scripts read `mcp.config.json` to determine active MCPs, inject their protocol definitions from `mcp-protocols/`, and produce the final context files. Changes to MCP protocols or the config require re-running the generators.

### Fetch-on-Demand Security (AGENTS.md)

All secrets live in 1Password or Infisical vaults. Never hardcode credentials. Always use CLI wrappers (`op run` / `infisical run`) for runtime injection. Code should read config from `process.env` — no `.env` parsing logic.

## Agent Specification Format

All agents follow the canonical template in `docs/AGENT_TEMPLATE.md`:

**Required sections:** Role, Tone, Capabilities, Mission, Rules & Constraints ({Methodology}), Boundaries, Workflow, Audit Log, External Tooling Dependencies

**Optional sections:** Tool Usage, Output Format, Journal, Files of Interest

H1 format: `# {Name} — {Domain} Agent`

## Dynamic Persona Protocol

When working on a task in this repository, adopt the appropriate agent persona based on context:

1. **Identify the domain** — Determine the area (infrastructure, marketing, coding, etc.)
2. **Read the spec** — Load the matching agent file from `agents/{domain}/{name}.md`
3. **Adopt the role** — Follow the Role, Tone, Capabilities, Rules, and Boundaries defined in the spec
4. **Load skills** — If the agent's Workflow references skills (marked with `**Skill:**`), read the skill spec from `skills/` and follow its Procedure
5. **Cross-reference** — For multi-domain tasks, combine guidelines from relevant agents

**Fallback:** If no agent spec matches, operate as a Senior Software Engineer following standard best practices and this repository's conventions.

## Adding or Modifying Agents

1. Use `docs/AGENT_TEMPLATE.md` as the starting point
2. Place the spec in `agents/{domain}/{name}.md`
3. Create matching documentation in `docs/agents/{domain}/{name}/`
4. If the agent uses MCP tools, ensure referenced protocols exist in `mcp-protocols/`

## Governance

Agents are evaluated against Gartner AI TRiSM (Trust, Risk, Security Management) — see `docs/GOVERNANCE.md`. Red Team audits (prompt injection, boundary testing, failure handling) are required before deployment. The 4D Framework (Delegation, Description, Discernment, Diligence) guides all design decisions — see `docs/METHODOLOGY.md`.

## Commit Convention

Conventional Commits: `type(scope): subject`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`

Scope matches the domain or area (e.g., `marketing`, `guardian`, `agents`, `lifecycle`).

<!-- GLOBAL_MANDATES_START -->
## 🔐 Secrets & Configuration
This project follows a "Fetch-on-Demand" architecture for security (Phase 0 Security). All sensitive credentials (API keys, database URLs, etc.) are stored exclusively in an encrypted SecretOps platform (Infisical or 1Password) and are never written to disk or hardcoded in source code.

## Mandatory Security Rules

- NEVER ask the user for secrets in the chat interface.


- NEVER hardcode actual secret values in any files, `.env` files, or logs.


- ALWAYS use an Environment Injection CLI (`infisical run` or `op run`) to resolve credentials at runtime.

## 🛡 Error Handling and Resilience
To ensure reliability and stability, agents and toolkit components must implement robust error handling patterns.

## Mandatory Directives
- **Graceful Degradation**: If an MCP tool or external API fails, the agent must explain the error clearly and attempt alternative strategies if available, rather than silently failing.
- **Exponential Backoff**: Implement exponential backoff retry logic for transient network errors or rate-limiting (429) responses.
- **Standardized Logging**: All technical errors must be logged to `stderr` to allow the orchestrator to capture and report execution failures accurately.

## 🚀 Execution Patterns
The Infisical CLI or 1Password CLI is required in the environment. When you need to execute scripts, tests, or servers that require credentials, you must wrap the command using the following pattern:

## Standard Command Wrapper
Use `infisical run` or `op run` to dynamically pull the specified environment and inject secrets directly into the process memory.

## Examples:


- Infisical Pattern: `infisical run --env=dev -- <command>`


- 1Password Pattern: `op run --env-file=.env.template -- <command>`


- Starting a Chat Session: `infisical run --env=dev -- gemini chat`

## 🛠 Local Development & Authentication
When running on a local host, the system uses human SSO or Desktop App integration for authentication.


- Infisical: If execution fails, ensure you are logged in via `infisical login`.
- 1Password: If execution fails, ensure you are logged in via `op signin`.

## 📝 Coding Standards
- **Fetch-on-Demand**: When writing code that requires configuration, always assume the values will be provided via process memory environment variables (e.g., `os.getenv()`). Do not create local `.env` parsing logic.
- **4D Framework Alignment**: All development must adhere to the 4D AI Fluency Framework (Delegation, Description, Discernment, Diligence). Personas must structurally incorporate these dimensions to ensure technical and ethical gating.
- **Persona Standards**: Specialized agent personas must include the following required sections: `Role`, `Tone`, `Capabilities`, `Mission`, `Rules & Constraints`, `Boundaries`, `Workflow`, `External Tooling Dependencies`, and `Audit Log`.
- **Naming Conventions**: All exported artifacts (n8n workflows, scripts, documentation) must use English-first, slug-based naming (e.g., `ai-triage-inbound.json`) to avoid localization drift.
- **Audit Log (Mandatory)**: All agent personas must include a dedicated `Audit Log` section. The minimum lightweight shape is `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`. Audit logs must exclude secrets and PII and should be emitted separately from the primary payload so the orchestrator can capture them safely.
<!-- GLOBAL_MANDATES_END -->

<!-- AGENT_INDEX_START -->
## Agent Index

22 agent specifications across 8 domains:

| Domain | Agent | Spec File |
|--------|-------|-----------|
| coding | Bolt — Performance Agent | `agents/coding/bolt/core.md` |
| coding | Bolt (Next.js 16) — Performance Agent | `agents/coding/bolt/nextjs-16.md` |
| coding | Sentinel — Security Agent | `agents/coding/sentinel/core.md` |
| communication | Postman — Communication Agent | `agents/communication/postman.md` |
| engineering | AI Architect — Engineering Agent | `agents/engineering/ai-architect.md` |
| engineering | Gatekeeper — Engineering Agent | `agents/engineering/gatekeeper.md` |
| guardian | PIIGuard — Guardian Agent | `agents/guardian/pii-guard.md` |
| guardian | PromptShield — Guardian Agent | `agents/guardian/prompt-shield.md` |
| guardian | ROI Auditor — Guardian Agent | `agents/guardian/roi-auditor.md` |
| infrastructure | cPanel — Infrastructure Agent | `agents/infrastructure/cpanel.md` |
| infrastructure | SysAdmin — Infrastructure Agent | `agents/infrastructure/linux.md` |
| marketing | Marketing & Brand Strategist — Marketing Agent | `agents/marketing/brand-strategist.md` |
| marketing | YouTube SEO Strategist — Marketing Agent | `agents/marketing/seo-strategist.md` |
| marketing | Thumbnail Specialist — Marketing Agent | `agents/marketing/thumbnail-specialist.md` |
| marketing | Video Content Manager — Marketing Agent | `agents/marketing/video-content-manager.md` |
| operations | Client Onboarding — Operations Agent | `agents/operations/client-onboarding.md` |
| operations | Drive Cataloger — Operations Agent | `agents/operations/drive-cataloger.md` |
| operations | Fleet Dashboard — Operations Agent | `agents/operations/fleet-dashboard.md` |
| operations | Knowledge Manager & Researcher — Operations Agent | `agents/operations/knowledge-manager.md` |
| operations | Multimodal Operations Specialist — Operations Agent | `agents/operations/multimodal-specialist.md` |
| operations | QA & Risk Manager — Operations Agent | `agents/operations/qa-risk-manager.md` |
| product | Doc — Product Agent | `agents/product/doc.md` |

Read the relevant agent specification before performing domain-specific tasks.

<!-- AGENT_INDEX_END -->

<!-- SKILLS_INJECTIONS_START -->
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
<!-- SKILLS_INJECTIONS_END -->

<!-- MCP_INJECTIONS_START -->
## Active MCP Protocols

The following MCP integrations are active. When working with these tools, follow the protocol rules below.

### N8n Protocol

#### Overview
This file contains specific capabilities, protocols, and workflows when interacting with the **n8n MCP tool**.

#### 1. Silent Execution
Execute n8n operations silently. Call tools in parallel and report back only upon completion.

#### 2. Multi-Level Validation
When configuring nodes, use minimal validation first, then comprehensive runtime validation before building workflows.

#### 3. Never Trust Defaults
Always explicitly define configurations when interacting with nodes rather than relying on default parameters which often fail at runtime.

### Slack Protocol

#### Overview
This file dictates how Gemini interacts with Slack using the designated Slack MCP.

#### 1. Notification Formatting
Ensure all Slack notifications are properly formatted utilizing Slack's Block Kit. Prioritize using code blocks for errors and warnings.

#### 2. Context Limits
Always truncate large logs before sending them to a Slack channel. Include links to external logging systems instead of printing full stack traces to channels.

### Gmail Protocol

#### Overview
This file dictates how Gemini interacts with Gmail via the MCP.

#### 1. Safety & Confirmation
**CRITICAL:** Never send an email without explicit, unambiguous user confirmation unless executing an automated, pre-approved workflow. Always prefer drafting emails over sending them directly.

#### 2. Drafting & Formatting
When drafting emails, strictly adhere to the requested tone, professionalism, and formatting requirements. Ensure all recipient addresses (To, Cc, Bcc) are accurate and validated before drafting.

#### 3. Reading & Searching
When searching for or reading emails, prioritize specific search queries (e.g., `from:user@example.com subject:"Update"`) to minimize data retrieval and respect privacy constraints. Do not summarize entire threads unless requested; focus on extracting the requested information.

### Google Drive Protocol

#### Overview
This file dictates how Gemini interacts with Google Drive via the MCP.

#### 1. File Search & Discovery
Use precise query parameters when searching for files or folders to avoid returning massive datasets. Always verify the file ID or folder ID before performing operations.

#### 2. Permissions & Sharing
**CRITICAL:** Be extremely cautious when modifying file permissions or sharing settings. Never make a file public or share it broadly without explicit user confirmation. Always prefer the least privileged access level necessary (e.g., Viewer instead of Editor).

#### 3. Structure & Metadata
When creating new files or folders, always ensure they are placed within the correct target directory. Do not leave files orphaned in the root directory unless explicitly instructed. Respect existing naming conventions and metadata requirements.

### Google Calendar Protocol

#### Overview
This file dictates how Gemini interacts with Google Calendar via the MCP.

#### 1. Timezone Handling
**CRITICAL:** Always explicitly verify and state the timezone when creating, reading, or modifying events. Never assume the user's timezone; if it is ambiguous, ask for clarification. Convert times accurately when dealing with participants in different locations.

#### 2. Event Creation & Modification
When scheduling events, ensure all participant email addresses are correct. Clearly summarize the event details (title, time, timezone, participants, description, location/meet link) to the user before finalizing the creation or modification.

#### 3. Conflict Resolution
When checking availability or proposing times, proactively identify and flag scheduling conflicts. Offer alternative time slots based on the participants' visible availability.

### Google Docs Protocol

#### Overview
This file dictates how Gemini interacts with Google Docs via the MCP.

#### 1. Document Creation & Formatting
When creating or formatting Google Docs, utilize standard structural elements (headings, paragraphs, lists) to ensure readability and proper document outline.

#### 2. Content Modification
When appending or replacing text, ensure you are targeting the correct section of the document. Do not overwrite existing content unless explicitly instructed to do so. If the document is large, consider breaking updates into smaller, targeted operations.

#### 3. Reading & Extraction
When reading documents, extract only the necessary context. For large documents, summarize the relevant sections rather than attempting to ingest the entire content at once.

### Google Sheets Protocol

#### Overview
This file dictates how Gemini interacts with Google Sheets via the MCP.

#### 1. Data Integrity & Validation
**CRITICAL:** Ensure data types (numbers, dates, strings) are formatted correctly when writing to a sheet. Validate data before insertion to prevent corrupting existing formulas or data structures.

#### 2. Range Operations
Always be precise when specifying ranges (e.g., `Sheet1!A1:D10`). Avoid open-ended ranges (`A:D`) when writing data to prevent accidental overwrites. When appending data, verify the next available empty row before writing.

#### 3. Reading & Analysis
When reading from a sheet, handle empty cells and varying row lengths gracefully. If extracting data for analysis, ensure the header row is clearly identified and mapped to the corresponding data columns.

### Google Slides Protocol

#### Overview
This file dictates how Gemini interacts with Google Slides via the MCP.

#### 1. Slide Creation & Structure
When creating presentations, utilize appropriate slide layouts (Title, Title and Body, Blank, etc.) to ensure a consistent and professional design.

#### 2. Content Placement
When adding text, shapes, or images, specify exact positioning and dimensions when possible. Ensure content does not overlap or spill outside the visible slide boundaries.

#### 3. Presentation Updates
When modifying existing slides, carefully identify the target slide ID or index before applying changes. Do not delete slides or rearrange the presentation order without explicit instruction.

### Google Meet Protocol

#### Overview
This file dictates how Gemini interacts with Google Meet via the MCP.

#### 1. Meeting Generation
When generating a Google Meet link, ensure it is attached to the corresponding Google Calendar event if applicable.

#### 2. Participant Management
Be aware of meeting entry settings (e.g., who can bypass the waiting room) if the MCP supports configuring them. Ensure the generated meeting links are provided clearly to the user.

### Google Chat Protocol

#### Overview
This file dictates how Gemini interacts with Google Chat via the MCP.

#### 1. Message Formatting
When sending messages to spaces or direct messages, utilize Google Chat's formatting capabilities (bold, italics, code blocks) to ensure readability.

#### 2. Threading & Context
When replying to existing conversations, always ensure the reply is correctly threaded to maintain context. Do not start a new thread for an ongoing topic unless instructed.

#### 3. Notification Management
Use `@mentions` judiciously. Only mention specific individuals or `@all` when the message requires immediate attention or action from those parties.

### Google Keep Protocol

#### Overview
This file dictates how Gemini interacts with Google Keep via the MCP.

#### 1. Note Creation
When creating notes, utilize appropriate formats (text, lists) based on the user's request. Add relevant labels or colors if specified to aid in organization.

#### 2. Task Management
For to-do lists, clearly distinguish between completed and pending tasks when reading or updating the note.

### Google Forms Protocol

#### Overview
This file dictates how Gemini interacts with Google Forms via the MCP.

#### 1. Form Structure
When creating or modifying a form, ensure questions are clearly worded and utilize the appropriate input type (multiple choice, short answer, linear scale, etc.).

#### 2. Response Handling
When reading or analyzing form responses, treat the data as structured output (often linked to a Google Sheet). Handle missing or malformed responses gracefully during analysis.

### Google Contacts Protocol

#### Overview
This file dictates how Gemini interacts with Google Contacts via the MCP.

#### 1. Contact Management
When creating or updating contacts, ensure fields (name, email, phone, organization) are populated accurately. Avoid creating duplicate entries; search for existing contacts before adding a new one.

#### 2. Privacy & Scope
Only access or modify contacts that are strictly relevant to the user's immediate request. Do not perform bulk exports or broad searches without clear authorization.

### Google Admin Protocol

#### Overview
This file dictates how Gemini interacts with the Google Workspace Admin Console via the MCP.

#### 1. Extreme Caution
**CRITICAL:** Operations within the Admin Console have organization-wide impact. Proceed with extreme caution. Never execute actions that create, suspend, or delete users, or modify organization-wide settings (like domain routing or security policies) without explicit, multi-step confirmation from an authorized administrator.

#### 2. Auditing & Logging
When performing administrative tasks, maintain a clear audit trail of actions taken, reasoning, and the specific IDs of users or groups affected.

#### 3. Group Management
When managing Google Groups, carefully verify the email addresses being added or removed, and confirm the intended permission levels (Owner, Manager, Member) before applying changes.

### Web Search Protocol

#### Overview
This file dictates how Gemini interacts with its built-in web search and web fetch capabilities.

#### 1. Verification vs. Discovery
Use web search primarily for verifying facts, gathering up-to-date documentation, or diagnosing unknown error messages. Do not use web search for general conversational knowledge that is already well-established within your training data.

#### 2. URL Processing
When fetching content from specific URLs (`web_fetch`), ensure the URLs are well-formed. If a URL returns a paywall or anti-bot challenge, do not attempt to bypass it; inform the user that the content is inaccessible.

#### 3. Citation & Summarization
Always synthesize and summarize search results in your own words rather than dumping raw excerpts. If asked for sources, clearly provide the URLs or citations corresponding to the information retrieved.

### Github Protocol

#### Overview
This file dictates how agents interact with GitHub using the GitHub CLI (`gh`) and the GitHub REST/GraphQL APIs.

#### 1. Authentication
Always authenticate via environment variable `GH_TOKEN` injected at runtime through vault CLI wrappers (`op run` / `infisical run`). Never store tokens in config files or commit them to the repository.

#### 2. Rate Limit Awareness
Monitor `X-RateLimit-Remaining` headers on every API response. When remaining calls drop below 100, introduce a backoff delay. On `403` or `429` responses, wait for the `X-RateLimit-Reset` timestamp before retrying.

#### 3. Pagination
Always paginate API responses. Use `--paginate` with `gh api` or follow `Link` headers in raw REST calls. Never assume a single page contains all results.

#### 4. Scope Minimization
Request only the scopes and data fields necessary for the current operation. Use GraphQL queries to select specific fields rather than fetching full objects via REST when possible.

#### 5. Audit Trail
Log every mutating API call (merge, close, comment, label) with the full request and response status for traceability. Include the agent identifier in all comments and commit messages.
<!-- MCP_INJECTIONS_END -->
