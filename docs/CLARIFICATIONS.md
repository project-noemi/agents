# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time, but several questions remain open for Product Owner judgment (listed below).
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-04-30] Resolved Fleet Dashboard API path standardization (`/api/v1/reports`), Onboarding directory drift (`templates/tiers/` and `clients/` created), Red Team Gauntlet test vectors (starter `test-vectors.yaml` added), ROI baseline data access (local JSON fallback in `tools/roi/baseline-config.json`), `logging-mcp` InfluxDB backend (added as third canonical backend), `logging-mcp` audit-log embedding (`metadata.audit_log` on success), SecretOps `.env.template` vs `.env.example` scope (root vs per-example), framework injection in context generators (deferred), and example smoke-test coverage (rfp-split, gmu-validation, secure-secret-management). See [DECISION_LOG.md](DECISION_LOG.md) entries dated `2026-04-30`.

## Template for New Questions

Add new questions below this line using the required format.

```md
### ❓ Question [YYYY-MM-DD] - Short Title
**Context:** Why this question exists and what file, workflow, or contract it relates to.
**Ambiguity / Drift:** What is unclear, contradictory, or externally blocked.
**Question for Product Owner:** The specific decision that still needs to be made.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Optional implementation prompt once the answer is known.*
```

### ❓ Question [2026-04-05] - Fleet Dashboard Retention Policy Drift
**Context:** `agents/operations/fleet-dashboard.md` specifies "Retain detailed reports for 90 days, aggregate summaries for 1 year."
**Ambiguity / Drift:** The reference implementation in `examples/gatekeeper-deployment/docker-compose.yml` configures a single InfluxDB bucket with a 90-day retention policy (`DOCKER_INFLUXDB_INIT_RETENTION=90d`) and no mechanism for long-term aggregate storage.
**Question for Product Owner:** Should the reference implementation be updated to include a second InfluxDB bucket (e.g., `agent_summaries`) with a 1-year retention policy and a downsampling task, or should the persona be updated to reflect a single 90-day retention period?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `examples/gatekeeper-deployment/docker-compose.yml` to provision an `agent_summaries` bucket and implement an InfluxDB task for report downsampling.*

### ❓ Question [2026-04-05] - Reference Service Audit Log Compliance
**Context:** `REQUIREMENTS.md` and `AGENTS.md` mandate a JSON Audit Log shape for all personas. Reference implementation services like `examples/gatekeeper-deployment/dashboard-ingest.js` perform critical ingestion tasks.
**Ambiguity / Drift:** The `dashboard-ingest.js` service does not currently emit its own internal audit logs in the mandated `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }` shape, making it harder for orchestrators to monitor the health of the observability stack itself.
**Question for Product Owner:** Should reference implementation services (e.g., `dashboard-ingest.js`) also adhere to the mandatory Audit Log JSON emission standard?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `examples/gatekeeper-deployment/dashboard-ingest.js` to emit a JSON audit log for every accepted and rejected report ingestion.*

### ❓ Question [2026-04-05] - Fleet Dashboard Multi-tenancy Implementation Gap
**Context:** The `Fleet Dashboard` persona (`agents/operations/fleet-dashboard.md`) specifies a multi-tenant registry system with per-agent HMAC secrets and asynchronous verification of mutating claims (merges, closes).
**Ambiguity / Drift:** The current reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` is a single-agent sink with hardcoded validation logic and no registry or verification workflow.
**Question for Product Owner:** Should the `Fleet Dashboard` reference implementation be expanded to include the registry and asynchronous verification logic, or should the persona be simplified to reflect the current single-tenant implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the multi-tenant agent registry and asynchronous GitHub verification worker in the Fleet Dashboard reference stack.*

### ❓ Question [2026-04-13] - Automated Validation for Audit Log JSON Schema
**Context:** `REQUIREMENTS.md` Section 2 mandates a specific JSON shape for Audit Logs. Currently, `scripts/audit-repo.js` only checks for the presence of the "Audit Log" heading.
**Ambiguity / Drift:** There is no technical enforcement of the actual JSON schema within the agent files, leading to potential drift where the heading exists but the content is structurally invalid.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to include basic JSON schema validation for the Audit Log section in all agent and skill files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse and validate the JSON shape of the Audit Log section against the mandated schema.*

### ❓ Question [2026-04-22] - Technical Enforcement of Skill Contracts
**Context:** Decision [2026-04-13] mandated specific sections (Rules & Constraints, Audit Log) for skills, but `scripts/audit-repo.js` currently only audits agent personas in `agents/`.
**Ambiguity / Drift:** Skills perform critical logic but their structural integrity is not automatically enforced in CI, leading to potential silent drift where new skills skip safety-critical sections.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to enforce the same structural contract (Required Headings, Refusal Criteria) on all files in the `skills/` directory?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to discover and audit all files in the `skills/` directory for structural compliance with the mandatory skill contract.*

### ❓ Question [2026-04-22] - Audit Log JSON Schema Validation Level
**Context:** `REQUIREMENTS.md` Section 2 mandates a specific JSON shape for Audit Logs. Currently, the "Audit Log" heading presence is enforced (for agents), but its content is not validated.
**Ambiguity / Drift:** Agents may emit malformed JSON or JSON that lacks required keys (task, inputs, actions, risks, result), breaking downstream observability and ROI calculation.
**Question for Product Owner:** Should the repository audit script perform strict JSON schema validation for the Audit Log section, or merely verify that the block contains syntactically valid JSON?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse the Audit Log section and validate it against the mandated JSON schema `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`.*

### ❓ Question [2026-04-22] - Data Inventory for Skills
**Context:** Agent personas have a mandatory `Data Inventory` (D2) section to satisfy 4D Description requirements. Reusable skills currently use `Inputs` and `Outputs` headings but lack a consolidated `Data Inventory`.
**Ambiguity / Drift:** Inconsistency between agent and skill documentation makes it harder for builders to maintain a unified data dictionary across the fleet.
**Question for Product Owner:** Should the `Data Inventory` heading be added to the mandatory skill contract (`SKILL_TEMPLATE.md`) for architectural symmetry with agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `SKILL_TEMPLATE.md` and all existing skills to include a mandatory `Data Inventory` section, replacing or consolidating the current `Inputs`/`Outputs` logic where appropriate.*
