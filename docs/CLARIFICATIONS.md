# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).

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

### ❓ Question [2026-04-02] - Node.js Resilience Helper Integration
**Context:** The `scripts/resilience_helpers.js` file exists and is mandated as a reference in `REQUIREMENTS.md`, but it is currently not utilized by the repository's core generation (`generate_all.js`) or audit tools (`audit-repo.js`).
**Ambiguity / Drift:** The core tools lack the exponential backoff resilience that the project mandates for agents.
**Question for Product Owner:** Should the `resilience_helpers.js` be integrated into the core repository scripts (`audit-repo.js`, `generate_all.js`) to satisfy the "Resilience" mandate within the repository's own tooling?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/audit-repo.js` and `scripts/generate_all.js` to use the `withRetry` helper for all filesystem operations.*

### ❓ Question [2026-04-03] - `logging-mcp` Activation Drift
**Context:** The `ROI Auditor` agent specification defines `logging-mcp` as a mandatory dependency for fleet-wide log ingestion, but the protocol is currently disabled (not present in `mcp.config.json`).
**Ambiguity / Drift:** The `ROI Auditor` cannot be fully validated as "active" in the current context files.
**Question for Product Owner:** Should `logging-mcp` be added to the default `active_mcps` list immediately to support Guardian agent development?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `mcp.config.json` to include "logging-mcp" in the `active_mcps` list and regenerate context.*

### ❓ Question [2026-04-03] - ROI Auditor Baseline Data Access
**Context:** The `ROI Auditor` persona is tasked with correlating actions against a "Human Baseline Time" and "Labor Rate" dictionary. `tools/roi/README.md` indicates these live in a Google Sheets template, but the `google-sheets` MCP is typically used for appending execution logs.
**Ambiguity / Drift:** There is no documented mechanism for the `ROI Auditor` to programmatically retrieve these "dictionaries" (e.g., via a specific MCP tool, a mounted JSON file, or a read-only Google Sheets range).
**Question for Product Owner:** How should the `ROI Auditor` access the baseline and labor rate data? Should we define a `google-sheets-read` capability or provide a local JSON reference file?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a `baseline-config.json` to `tools/roi/` or update the `ROI Auditor` persona to include a specific `read_rows` capability for the Google Sheets MCP.*

### ❓ Question [2026-04-04] - Environment Variable Inventory Drift
**Context:** The `.env.template` file is intended to be a variable inventory for the repository. However, `tests/e2e/docker-smoke.test.js` references several `NOEMI_DOCKER_SMOKE_*` variables (e.g., `NOEMI_DOCKER_SMOKE_TIMEOUT_MS`, `NOEMI_DOCKER_SMOKE_POLL_INTERVAL_MS`, `NOEMI_DOCKER_SMOKE_ARTIFACT_DIR`) that are missing from `.env.template`.
**Ambiguity / Drift:** Builders and CI/CD pipelines may be unaware of these configuration options, leading to inconsistent test environments.
**Question for Product Owner:** Should these test-specific environment variables be added to `.env.template` to complete the variable inventory, or should they remain documented only within the test files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `.env.template` to include the `NOEMI_DOCKER_SMOKE_*` variable set with sensible default placeholders.*

### ❓ Question [2026-04-04] - `logging-mcp` Standardized Log Shape vs. Audit Log
**Context:** `mcp-protocols/logging-mcp.md` defines a "Standardized Log Shape" that includes `timestamp`, `agent`, `task`, `status`, `duration_ms`, and `metadata`. Meanwhile, `AGENTS.md` and `REQUIREMENTS.md` mandate a "lightweight JSON summary shape" for the `Audit Log` as `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`.
**Ambiguity / Drift:** While complementary, it's unclear if the `Audit Log` is intended to be *part* of the `logging-mcp` payload (e.g., inside `metadata`) or if they are two separate emissions that need to be reconciled.
**Question for Product Owner:** Should the `logging-mcp` protocol be updated to explicitly incorporate the mandated `Audit Log` JSON shape as the primary payload for "success" events?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Align the `logging-mcp` protocol definition with the mandatory `Audit Log` JSON shape to ensure technical consistency across the observability stack.*
