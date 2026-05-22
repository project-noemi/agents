# Pending Clarifications

This file tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time beyond the items listed below.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-05-22] Bulk closure: 30+ clarifications resolved or closed as overtaken in this PR. See `DECISION_LOG.md` entries dated `2026-05-22-0001` through `2026-05-22-0009`.

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

### ❓ Question [2026-04-03] - `logging-mcp` Runtime Activation Timing
**Context:** The `ROI Auditor` agent specification defines `logging-mcp` as a mandatory dependency for fleet-wide log ingestion, but the protocol is currently disabled (not present in `mcp.config.json`). Decision [2026-04-03] kept it reference-only until a runtime environment is ready to consume it.
**Ambiguity / Drift:** It is unclear when (or under what conditions) `logging-mcp` should be promoted from reference pattern to active MCP, and which deployment example will be the first consumer.
**Question for Product Owner:** When `logging-mcp` is ready to be activated, should it land in `mcp.config.json` at the same time as a reference service that emits to it (e.g., `dashboard-ingest.js` refactored to emit Loki/n8n payloads), or should the protocol be activated first to drive downstream adoption?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Once activated, update `mcp.config.json` to include `logging-mcp` and refactor `dashboard-ingest.js` to align with the protocol's standardized JSON shape.*

### ❓ Question [2026-04-03] - ROI Auditor Baseline Data Access
**Context:** The `ROI Auditor` persona is tasked with correlating actions against a "Human Baseline Time" and "Labor Rate" dictionary. `tools/roi/README.md` indicates these live in a Google Sheets template, but the `google-sheets` MCP is typically used for appending execution logs, not reading dictionaries.
**Ambiguity / Drift:** There is no documented mechanism for the `ROI Auditor` to programmatically retrieve these "dictionaries" (e.g., via a specific MCP tool, a mounted JSON file, or a read-only Google Sheets range).
**Question for Product Owner:** How should the `ROI Auditor` access the baseline and labor rate data? Should we define a `google-sheets-read` capability, mount a local `baseline-config.json`, or use a different mechanism?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a `baseline-config.json` to `tools/roi/` or update the `ROI Auditor` persona to include a specific `read_rows` capability for the Google Sheets MCP.*

### ❓ Question [2026-04-04] - `logging-mcp` Standardized Log Shape vs. Audit Log
**Context:** `mcp-protocols/logging-mcp.md` defines a "Standardized Log Shape" that includes `timestamp`, `agent`, `task`, `status`, `duration_ms`, and `metadata`. Meanwhile, `AGENTS.md` and `REQUIREMENTS.md` mandate a "lightweight JSON summary shape" for the `Audit Log` as `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`.
**Ambiguity / Drift:** While complementary, it's unclear if the `Audit Log` is intended to be *part* of the `logging-mcp` payload (e.g., inside `metadata`) or if they are two separate emissions that need to be reconciled.
**Question for Product Owner:** Should the `logging-mcp` protocol be updated to explicitly incorporate the mandated `Audit Log` JSON shape as the primary payload for "success" events?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Align the `logging-mcp` protocol definition with the mandated `Audit Log` JSON shape to ensure technical consistency across the observability stack.*

### ❓ Question [2026-04-05] - `logging-mcp` InfluxDB Backend Support
**Context:** `mcp-protocols/logging-mcp.md` defines Loki/Grafana and n8n webhooks as the primary backends, but the reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` and `docker-compose.yml` uses InfluxDB as the primary time-series datastore.
**Ambiguity / Drift:** The protocol definition does not account for the primary storage mechanism used in the specialist deployment examples.
**Question for Product Owner:** Should the `logging-mcp` protocol be updated to explicitly support InfluxDB as a third canonical backend for structured log ingestion?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `mcp-protocols/logging-mcp.md` to include InfluxDB as a supported backend and define the corresponding query/ingestion patterns.*

### ❓ Question [2026-04-05] - SecretOps Syntax Drift: `.env.template` vs `.env.example`
**Context:** `AGENTS.md` specifies the 1Password command wrapper pattern using `--env-file=.env.template`, while `docs/tool-usages/secure-secret-management.md` and all `docker-compose.yml` files in `examples/` use `--env-file=.env.example`.
**Ambiguity / Drift:** This inconsistency creates confusion for builders and may lead to execution failures if they use the wrong reference file for secret injection. The test suite (`tests/examples-smoke.test.js`) currently enforces `.env.example` for compose examples.
**Question for Product Owner:** Standardize the canonical inventory naming convention. Best practice in the broader ecosystem: `.env.example` is the per-deployment vault-reference manifest committed alongside the compose file; `.env.template` is the repo-root master inventory. Recommendation: keep both with explicit purpose comments, but update `AGENTS.md` to document `.env.example` for per-example contexts and `.env.template` only for repo-root commands.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` "Execution Patterns" section to clarify when to use each inventory file and align documentation across `docs/tool-usages/` and `examples/`.*

### ❓ Question [2026-04-05] - Incomplete Example Smoke Test Coverage
**Context:** `REQUIREMENTS.md` Section 9 mandates "static smoke checks for example stacks and Docker env inventories." However, `tests/examples-smoke.test.js` currently omits several reference implementations including `examples/rfp-split`, `examples/gmu-validation`, and `examples/secure-secret-management`.
**Ambiguity / Drift:** Reference examples that are not covered by the smoke test suite may drift from the core architecture (e.g., regarding secret handling or Node baseline) without being detected by the CI pipeline.
**Question for Product Owner:** Should all subdirectories in `examples/` be covered by at least one static smoke check to satisfy Requirement 9?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Expand `tests/examples-smoke.test.js` to include static smoke checks for `rfp-split`, `gmu-validation`, and `secure-secret-management`, ensuring they adhere to the Fetch-on-Demand and Node 24 baselines.*

### ❓ Question [2026-04-05] - Fleet Dashboard Retention Policy
**Context:** `agents/operations/fleet-dashboard.md` specifies "Retain detailed reports for 90 days, aggregate summaries for 1 year."
**Ambiguity / Drift:** The reference implementation in `examples/gatekeeper-deployment/docker-compose.yml` configures a single InfluxDB bucket with a 90-day retention policy and no mechanism for long-term aggregate storage.
**Question for Product Owner:** Update the reference implementation to include a second InfluxDB bucket with 1-year retention and a downsampling task, or update the persona to reflect a single 90-day retention period?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `examples/gatekeeper-deployment/docker-compose.yml` to provision an `agent_summaries` bucket and implement an InfluxDB task for report downsampling.*

### ❓ Question [2026-04-05] - Red Team Gauntlet Test Vectors
**Context:** The `Client Onboarding` agent (`agents/operations/client-onboarding.md`) mandates running a validation suite using 5 specific test cases from `examples/red-team-gauntlet/`. The directory only contains a `README.md`.
**Ambiguity / Drift:** The validation workflow cannot be executed without the actual test vectors (3 prompt injection, 2 PII leak).
**Question for Product Owner:** Provide the canonical 5 starter test cases for the Red Team Gauntlet (or authorize Jules to draft well-known, industry-standard examples for review). This is a security/content decision that PO must drive.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create `examples/red-team-gauntlet/test-vectors.yaml` with the 5 starter cases (3 prompt injection, 2 PII leak) required by the Onboarding workflow.*

### ❓ Question [2026-04-05] - Fleet Dashboard Multi-tenancy Scope
**Context:** The `Fleet Dashboard` persona specifies a multi-tenant registry system with per-agent HMAC secrets and asynchronous verification of mutating claims.
**Ambiguity / Drift:** The current reference implementation is a single-agent sink with hardcoded validation logic.
**Question for Product Owner:** Expand the reference implementation to include the registry and asynchronous verification logic, or simplify the persona to reflect the current single-tenant implementation? This is a roadmap/scope question.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the multi-tenant agent registry and asynchronous GitHub verification worker in the Fleet Dashboard reference stack.*

### ❓ Question [2026-05-02] - Persona Journal Section Standardization
**Context:** Only 4 out of 22 agent personas (`sentinel/core.md`, `bolt/core.md`, `bolt/nextjs-16.md`, `gatekeeper.md`) currently include a `## Journal` section.
**Ambiguity / Drift:** While not a strictly mandated section in `AGENTS.md`, its presence in a minority of agents creates inconsistency in how agents are expected to record critical learnings across the fleet.
**Question for Product Owner:** Should the `## Journal` section be added to the mandatory persona contract in `AGENTS.md` and enforced across all agents to support standardized across-fleet learning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/AGENT_TEMPLATE.md` to include `Journal` as a mandatory section, then perform a bulk update to add it to all 22 agent personas.*

### ❓ Question [2026-05-02] - Audit Log Descriptor Standardization
**Context:** The requirement to emit logs "separately from the primary user-facing payload" is currently interpreted as "to stderr".
**Ambiguity / Drift:** In some orchestrator environments (e.g., n8n, custom Docker wrappers), `stderr` may be used for both technical crashes and structured audit logs, potentially leading to parsing errors. The new `audit-repo.js` already uses an `AUDIT_LOG: ` prefix on `stderr` to disambiguate; ratifying this as the cross-fleet standard would simplify orchestrator parsing.
**Question for Product Owner:** Standardize on a prefixed format (e.g., `AUDIT_LOG: {...}`) for unambiguous audit-record capture across all repo Node.js tools? Or use a dedicated file descriptor (FD 3) for the same purpose?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `REQUIREMENTS.md` to specify the chosen format and propagate it through all internal tools and reference services.*

### ❓ Question [2026-05-10] - Substantive Persona Remediation Strategy
**Context:** All 22 agent personas currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections. The skill side was remediated in Decision [2026-05-22-0001].
**Ambiguity / Drift:** While structurally compliant (the headings exist), agent personas are in substantive drift from the 4D Description (D2) and Refusal Principle mandates.
**Question for Product Owner:** Authorize Jules to perform a fleet-wide "substantive remediation" of all 22 agent personas to replace these placeholders with role-specific, technically accurate content, or handle incrementally during domain-specific work?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of all agent personas in `agents/` to replace placeholder Data Inventory and Refusal Criteria with role-specific content.*

### ❓ Question [2026-05-11] - Pre-flight Active Authentication Check Commands
**Context:** `AGENTS.md` now mandates active authentication checks in pre-flight scripts. The canonical command surface needs ratification before implementation.
**Ambiguity / Drift:** Industry-standard verification commands: `infisical whoami` (Infisical) and `op user get --me` (1Password). For non-interactive runs the latter exits non-zero when not signed in.
**Question for Product Owner:** Confirm `infisical whoami` and `op user get --me` as the canonical verification commands. Should failure be Hard Fail (exit 1) in `docker` mode and Warning in `builder`/`n8n` modes (matching Decision [2026-05-22-0005] for CLI presence)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to include active authentication checks using the approved SecretOps commands with mode-aware fail policy.*

### ❓ Question [2026-05-17] - Generator Script Redundancy
**Context:** The repository contains `scripts/generate_all.js`, `scripts/generate_gemini.js`, and `scripts/generate_claude.js`. `generate_all.js` performs the same logic for both via shared helpers.
**Ambiguity / Drift:** Maintenance overhead is increased by having three entry points. `REQUIREMENTS.md` §4 references both `generate_gemini.js` and `generate_claude.js` by name, which would need to be updated if they are deprecated.
**Question for Product Owner:** Deprecate `scripts/generate_gemini.js` and `scripts/generate_claude.js` in favor of `scripts/generate_all.js`, or keep the individual entry points as orchestrator-friendly shortcuts?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If deprecating: remove the individual scripts, update `REQUIREMENTS.md` §4 to reference only `generate_all.js`, and add a `package.json` script alias if any external workflows depend on the old names.*

### ❓ Question [2026-05-17] - Logging MCP Reference Implementation Gap
**Context:** `mcp-protocols/logging-mcp.md` exists as a dual-backend draft, but it is not active in `mcp.config.json` and reference services like `dashboard-ingest.js` do not yet adhere to its schema. Tied to Q [2026-04-03] and Q [2026-04-04].
**Ambiguity / Drift:** The observability standard is documented but not implemented in the repository's own reference services.
**Question for Product Owner:** Prioritize a "substantive implementation" of the `logging-mcp` pattern across the repository's reference services and build tools, or keep it as a future-state reference?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Activate `logging-mcp` in `mcp.config.json` and refactor `dashboard-ingest.js` and build utilities to emit logs according to the protocol's standardized JSON shape.*

### ❓ Question [2026-05-20] - AI Model Version Baseline Formalization
**Context:** Multiple reference workflows (e.g., `rfp-responder.json`) and n8n lab examples are pinned to `models/gemini-2.5-flash`. There is no "AI Model Baseline" requirement in `REQUIREMENTS.md` or `AGENTS.md` comparable to the "Node.js 24 Baseline."
**Ambiguity / Drift:** Unclear if `gemini-2.5-flash` is the mandated reference model or a placeholder that can drift. This is a strategic decision (cost, performance, vendor alignment).
**Question for Product Owner:** Establish a canonical AI Model Baseline (e.g., Gemini 2.5 Flash) for all reference workflows and examples? If yes, what's the update cadence policy (pinned to a specific version, or "latest LTS")?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Define a "Reference AI Model Baseline" in `AGENTS.md` and `REQUIREMENTS.md` and update all example workflows and smoke tests to adhere to this standard.*

### ❓ Question [2026-05-20] - Automated Branch Protection Verification Depth
**Context:** Branch protection is now mandatory (Decision [2026-05-20]). `scripts/setup-branch-protection.sh` exists to automate this.
**Ambiguity / Drift:** Unclear if `scripts/audit-repo.js` should perform an active GitHub API check (requires `GITHUB_TOKEN`) or simply verify the existence of the governance script and documentation.
**Question for Product Owner:** Enhance `scripts/audit-repo.js` to perform an active GitHub API check (gated on `GITHUB_TOKEN` presence), or keep audit script local-filesystem-only?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to optionally verify branch protection status via the GitHub API when a `GITHUB_TOKEN` is present in the environment.*

### ❓ Question [2026-05-21] - Framework Marker Injection Standardization
**Context:** `REQUIREMENTS.md` identifies a "Framework Injection Gap" where `Value Lenses` and `Operating Profiles` are not injected into generated context.
**Ambiguity / Drift:** Templates (`GEMINI.template.md`, `CLAUDE.template.md`) lack the corresponding markers, and the generators lack the injection logic. Marker naming and placement need standardization.
**Question for Product Owner:** Use `<!-- VALUE_LENS_INJECTIONS_START -->` and `<!-- OPERATING_PROFILE_INJECTIONS_START -->` as the canonical markers? Place them before or after the Global Mandates?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add the canonical framework markers to all context templates and update `scripts/context_helpers.js` to support their injection.*

### ❓ Question [2026-05-21] - Internal Tool Audit Log Implementation Pattern
**Context:** `AGENTS.md` now mandates structured JSON Audit Logs to `stderr` for internal tools like `executive-assistant`.
**Ambiguity / Drift:** Implementing this requires standardizing on a shared logging utility or pattern across Node.js tools. The format from Decision [2026-05-22-0002] (`AUDIT_LOG: {...}` on `stderr`) is one candidate; tied to Q [2026-05-02] (Audit Log Descriptor Standardization).
**Question for Product Owner:** Introduce a shared `scripts/audit_logger.js` utility that all Node.js tools and services must use? If yes, ratify its API surface and the audit-log line prefix.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a shared `scripts/audit_logger.js` utility and refactor `tools/executive-assistant/server.js` and `examples/gatekeeper-deployment/dashboard-ingest.js` to use it for all operational events.*

### ❓ Question [2026-04-04] - Gatekeeper Reference Implementation Mutating Actions
**Context:** The `Gatekeeper` agent persona describes mutating actions (merging PRs, closing issues), but the reference implementation in `examples/gatekeeper-deployment/` is currently limited to signed reporting.
**Ambiguity / Drift:** The implementation truth drifts from the persona specification.
**Question for Product Owner:** Extend the Gatekeeper reference implementation to include "dry-run" or optional mutating actions, or limit the persona to the implemented scope?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Extend the Gatekeeper deployment example and `entrypoint.sh` to include a placeholder or dry-run mode for the mutating actions defined in the Gatekeeper persona.*
