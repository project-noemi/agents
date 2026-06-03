# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-05-28] Bulk closure: a large block of late-cycle clarifications was either resolved by Decision entries dated 2026-05-28-0001 through 2026-05-28-0006 (logging-mcp payload alignment, onboarding directory bootstrap, SecretOps reference standardization, case-insensitive heading audits, Value Lens/Operating Profile injection, and the bulk closure of clarifications overtaken by prior decisions), or recognized as restatements of already-resolved questions. See `DECISION_LOG.md` for the durable record.

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

### ❓ Question [2026-04-03] - ROI Auditor Baseline Data Access
**Context:** The `ROI Auditor` persona is tasked with correlating actions against a "Human Baseline Time" and "Labor Rate" dictionary. `tools/roi/README.md` indicates these live in a Google Sheets template, but the `google-sheets` MCP is typically used for appending execution logs.
**Ambiguity / Drift:** There is no documented mechanism for the `ROI Auditor` to programmatically retrieve these "dictionaries" (e.g., via a specific MCP tool, a mounted JSON file, or a read-only Google Sheets range).
**Question for Product Owner:** How should the `ROI Auditor` access the baseline and labor rate data? Should we define a `google-sheets-read` capability or provide a local JSON reference file?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a `baseline-config.json` to `tools/roi/` or update the `ROI Auditor` persona to include a specific `read_rows` capability for the Google Sheets MCP.*

### ❓ Question [2026-04-05] - Fleet Dashboard Retention Policy Drift
**Context:** `agents/operations/fleet-dashboard.md` specifies "Retain detailed reports for 90 days, aggregate summaries for 1 year."
**Ambiguity / Drift:** The reference implementation in `examples/gatekeeper-deployment/docker-compose.yml` configures a single InfluxDB bucket with a 90-day retention policy (`DOCKER_INFLUXDB_INIT_RETENTION=90d`) and no mechanism for long-term aggregate storage.
**Question for Product Owner:** Should the reference implementation be updated to include a second InfluxDB bucket (e.g., `agent_summaries`) with a 1-year retention policy and a downsampling task, or should the persona be updated to reflect a single 90-day retention period?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `examples/gatekeeper-deployment/docker-compose.yml` to provision an `agent_summaries` bucket and implement an InfluxDB task for report downsampling.*

### ❓ Question [2026-04-05] - Red Team Gauntlet Test Vector Absence
**Context:** The `Client Onboarding` agent (`agents/operations/client-onboarding.md`) mandates running a validation suite using 5 specific test cases from `examples/red-team-gauntlet/`.
**Ambiguity / Drift:** The `examples/red-team-gauntlet/` directory only contains a `README.md` and lacks the actual test vectors (Prompts/PII patterns) required to execute the mandated validation workflow.
**Question for Product Owner:** Should the `red-team-gauntlet` example be populated with a starter set of YAML/JSON test vectors to support the `Client Onboarding` validation requirement?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create `examples/red-team-gauntlet/test-vectors.yaml` with the 5 starter cases (Prompt Injection and PII) required by the Onboarding workflow.*

### ❓ Question [2026-04-05] - Fleet Dashboard Multi-tenancy Implementation Gap
**Context:** The `Fleet Dashboard` persona (`agents/operations/fleet-dashboard.md`) specifies a multi-tenant registry system with per-agent HMAC secrets and asynchronous verification of mutating claims (merges, closes).
**Ambiguity / Drift:** The current reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` is a single-agent sink with hardcoded validation logic and no registry or verification workflow.
**Question for Product Owner:** Should the `Fleet Dashboard` reference implementation be expanded to include the registry and asynchronous verification logic, or should the persona be simplified to reflect the current single-tenant implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the multi-tenant agent registry and asynchronous GitHub verification worker in the Fleet Dashboard reference stack.*

### ❓ Question [2026-04-23] - Gatekeeper Reference Implementation Mutating Actions
**Context:** The `Gatekeeper` agent persona describes mutating actions (merging PRs, closing issues), but the reference implementation in `examples/gatekeeper-deployment/` is currently limited to signed reporting.
**Ambiguity / Drift:** The implementation truth drifts from the persona specification, leaving the "Accelerator" role partially unimplemented in the reference stack.
**Question for Product Owner:** Should we extend the Gatekeeper reference implementation to include "dry-run" or optional mutating actions to better reflect the persona's mission?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Extend the Gatekeeper deployment example and `entrypoint.sh` to include a placeholder or dry-run mode for the mutating actions defined in the Gatekeeper persona.*

### ❓ Question [2026-04-26] - Substantive Persona Content Drift
**Context:** A whole-codebase audit revealed that 100% of agent personas (22/22) currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** While the repository passes structural audits (headings are present), it has drifted into substantive non-compliance with the 4D framework (D2 Description) and the Refusal Principle. Agents lack the role-specific data definitions and safety-gating logic required for production readiness.
**Question for Product Owner:** Should Jules be tasked with a bulk update to replace these placeholders with role-specific substantive content, or should this be handled incrementally during domain-specific work?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a whole-fleet update of all agent personas in `agents/` to replace placeholder `Data Inventory` and `Refusal Criteria` sections with role-specific, technically accurate content.*

### ❓ Question [2026-05-01] - Node.js 24 Baseline Enforcement in Docker
**Context:** The repository mandates Node.js 24 as the baseline for all logic and utilities (`AGENTS.md`, `package.json`).
**Ambiguity / Drift:** Some reference Docker configurations may still be pinned to older Node images, drifting from the mandated baseline. Decision [2026-05-10] partially remediated this (gatekeeper-deployment and executive-assistant), but a fleet-wide sweep has not been completed.
**Question for Product Owner:** Should an automated audit check be added to `scripts/audit-repo.js` to flag any `Dockerfile` or `docker-compose.yml` that uses a Node image older than 24?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a Node baseline check to `scripts/audit-repo.js` that scans all `Dockerfile` and `docker-compose.yml` files for `node:<24`.*

### ❓ Question [2026-05-01] - Persona Journal Section Standardization
**Context:** Only a minority of agent personas currently include a `## Journal` section.
**Ambiguity / Drift:** While not strictly mandated in `AGENTS.md`, its presence in some agents creates inconsistency in how agents are expected to record critical learnings across the fleet.
**Question for Product Owner:** Should the `## Journal` section be added to the mandatory persona contract in `AGENTS.md` and enforced across all agents to support standardized across-fleet learning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/AGENT_TEMPLATE.md` to include `Journal` as a mandatory section, then perform a bulk update to add it to all 22 agent personas.*

### ❓ Question [2026-05-02] - Audit Log Descriptor Standardization
**Context:** The requirement to emit logs "separately from the primary user-facing payload" is currently interpreted as "to stderr".
**Ambiguity / Drift:** In some orchestrator environments (e.g., n8n, custom Docker wrappers), `stderr` may be used for both technical crashes and structured audit logs, potentially leading to parsing errors.
**Question for Product Owner:** Should we standardize on a specific file descriptor (e.g., `FD 3`) or a prefixed format (e.g., `AUDIT_LOG: {...}`) to ensure unambiguous capture of the audit record?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `REQUIREMENTS.md` to specify a prefixed logging format or a dedicated file descriptor for unambiguous Audit Log capture.*

### ❓ Question [2026-05-02] - Identity Provider Implementation Gap
**Context:** `DECISION_LOG.md` and `REQUIREMENTS.md` mention Casdoor as the reference identity layer for multi-tenant fleet deployments.
**Ambiguity / Drift:** While `docker-compose.yml` in `examples/fleet-deployment/` includes a Casdoor service, there is no evidence of Casdoor integration logic in any of the repository's scripts or agent personas.
**Question for Product Owner:** Should we implement a basic `casdoor-mcp` or add authentication middleware to the reference services to make the identity layer requirement "truthful"?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a `casdoor-mcp` protocol and implement basic JWT validation middleware for the Fleet Dashboard reference services.*

### ❓ Question [2026-05-10] - Substantive Persona Remediation Strategy
**Context:** All agent personas and reusable skills currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** While structurally compliant (the headings exist), the repository is in substantive drift from the 4D Description (D2) and Refusal Principle mandates.
**Question for Product Owner:** Should Jules be authorized to perform a fleet-wide "substantive remediation" to replace these placeholders with role-specific, technically accurate content?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of all agent personas in `agents/` and skills in `skills/` to replace placeholder Data Inventory and Refusal Criteria with role-specific content.*

### ❓ Question [2026-05-13] - RFP Split Naming Convention Remediation
**Context:** `AGENTS.md` mandates English-first, slug-based naming. `examples/rfp-split/` contains several files like `Section_1_General_Information.pdf` that violate this rule.
**Ambiguity / Drift:** These files represent technical drift from the repository's naming standards and may cause issues in some environments.
**Question for Product Owner:** Should Jules perform a bulk rename of the assets in `examples/rfp-split/` to align with the slug-based naming convention (e.g., `section-1-general-information.pdf`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Rename all files in `examples/rfp-split/` to follow the English-first, slug-based naming convention.*

### ❓ Question [2026-05-17] - Generator Script Redundancy
**Context:** The repository contains `scripts/generate_all.js`, `scripts/generate_gemini.js`, and `scripts/generate_claude.js`. `generate_all.js` performs the same logic for both Gemini and Claude by calling shared helpers.
**Ambiguity / Drift:** Maintenance overhead is increased by having three entry points for context generation. It's unclear if `generate_gemini.js` and `generate_claude.js` should be deprecated in favor of the single `generate_all.js` orchestrator.
**Question for Product Owner:** Should we deprecate `scripts/generate_gemini.js` and `scripts/generate_claude.js` and standardize on `scripts/generate_all.js` for all context generation tasks?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Remove `scripts/generate_gemini.js` and `scripts/generate_claude.js`, ensuring `scripts/generate_all.js` is the sole, fully-featured entry point for context generation.*

### ❓ Question [2026-05-19] - Internal Tool Observability Standard
**Context:** `AGENTS.md` and `REQUIREMENTS.md` mandate that agents and reference services emit JSON Audit Logs to `stderr`.
**Ambiguity / Drift:** Build utilities (`generate_all.js`, `audit-repo.js`) and internal tools (`executive-assistant`) currently use unstructured logs, drifting from the observability standard set for external agents.
**Question for Product Owner:** Should internal repository tools and build utilities also be required to emit a structured JSON Audit Log to `stderr` upon completion for fleet-wide observability?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/generate_all.js`, `scripts/audit-repo.js`, and `tools/executive-assistant/server.js` to emit structured JSON Audit Logs to `stderr`.*

### ❓ Question [2026-05-20] - AI Model Version Baseline Formalization Follow-through
**Context:** Decision [2026-05-17] / Requirement §"AI Model Baseline" pinned Gemini 2.5 Flash as the canonical reference model. Multiple example workflows and smoke tests reference `models/gemini-2.5-flash`.
**Ambiguity / Drift:** Decision exists; an automated audit check that flags drift from the baseline does not.
**Question for Product Owner:** Should `scripts/audit-repo.js` add a grep-based check that flags any reference workflow or smoke test pinning a non-baseline model?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add an AI model baseline check to `scripts/audit-repo.js` scanning `examples/` and `tests/` for non-baseline model pins.*

### ❓ Question [2026-05-22] - Casdoor Identity Integration Logic
**Context:** `REQUIREMENTS.md` and `DECISION_LOG.md` identify Casdoor as the reference identity layer for multi-tenant deployments.
**Ambiguity / Drift:** While Casdoor is present in `fleet-deployment` compose files, there is no implementation logic in the repository (scripts, middleware, or agents) that actually performs token validation or user context extraction.
**Question for Product Owner:** Should Jules implement a reference `casdoor-auth` skill or Node.js middleware to demonstrate how agents should validate identity in a multi-tenant fleet?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a `skills/security/casdoor-validate.md` specification and implement basic JWT validation middleware in `examples/gatekeeper-deployment/dashboard-ingest.js`.*

### ❓ Question [2026-05-28] - Substantive Remediation of the Skill Library
**Context:** While `SKILL_TEMPLATE.md` has been updated with mandatory `Data Inventory` and `Refusal Criteria` sections, the active skills in the `skills/` directory currently contain "TBD" placeholders for these sections and template-only JSON in their `Audit Log`.
**Ambiguity / Drift:** The skill library is in substantive drift from the 4D Description (D2) and Refusal Principle mandates. This makes the skills "hollow" from a safety and documentation perspective, even if they pass structural audits.
**Question for Product Owner:** Should Jules perform a fleet-wide "substantive remediation" to replace these placeholders with role-specific, technically accurate content for all reusable skills?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of the `skills/` directory to replace all TBD placeholders with role-specific Data Inventory, Refusal Criteria, and valid example Audit Logs.*

### ❓ Question [2026-05-29] - Docker Smoke Test Variable Validation
**Context:** Requirement §9 mandates that the default test suite must cover "static smoke checks for example stacks and Docker env inventories (including `NOEMI_DOCKER_SMOKE_*` variable validation)."
**Ambiguity / Drift:** `tests/examples-smoke.test.js` currently validates Docker `.env.example` files and compose configurations but lacks any logic to verify the presence or format of the `NOEMI_DOCKER_SMOKE_*` variables used by the E2E suite.
**Question for Product Owner:** Should we add a dedicated test case to `tests/examples-smoke.test.js` to validate that these variables are correctly defined in `.env.template` and follow a standard naming/value convention?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/examples-smoke.test.js` to include validation for all `NOEMI_DOCKER_SMOKE_*` environment variables defined in `.env.template`.*

### ❓ Question [2026-05-29] - Skill Remediation Priority
**Context:** 100% of the active reusable skills in `skills/` currently contain "TBD" placeholders for mandatory `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** This represents a significant substantive drift from the 4D framework. However, remediating all skills requires domain-specific knowledge for each skill's inputs and procedures.
**Question for Product Owner:** Should Jules prioritize a bulk remediation of these placeholders with generic/safe defaults, or should remediation be deferred until a human provides the domain-specific logic for each skill?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of the `skills/` directory, replacing "TBD" placeholders with technically grounded defaults based on each skill's documented Procedure.*

### ❓ Question [2026-05-29] - Internal Tool Observability Implementation
**Context:** Multiple Node.js tools in `tools/` and reference services in `examples/` rely on unstructured `console.log` for operational events, violating the JSON Audit Log mandate.
**Ambiguity / Drift:** While the requirement is clear, the implementation involves refactoring multiple disparate utilities.
**Question for Product Owner:** Should we implement a shared Node.js logging utility (e.g., `scripts/audit_logger.js`) to standardize this emission across the fleet, or should each tool implement its own lightweight JSON emission logic?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a shared `scripts/audit_logger.js` utility and refactor `executive-assistant` and `dashboard-ingest.js` to use it for mandated JSON Audit Log emission to stderr.*

### ❓ Question [2026-06-03] - Memory-Code Synchronization Drift
**Context:** The repository's "Memory" records several remediations as completed on 2026-05-31 (parameterized sync script, enhanced agent index, shared `audit_logger.js`), but these changes are absent from the VM's filesystem.
**Ambiguity / Drift:** There is a significant discrepancy between the recorded architectural history (Memory) and the implemented codebase truth. This creates a high risk of assuming compliance where technical debt remains.
**Question for Product Owner:** Should Jules proceed with a fresh implementation of these missing remediations to align the codebase with the reported state, or is there an external branch/sync issue that explains the absence of these files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Re-implement the 2026-05-31 remediation set (Sync Script parameterization, Agent Index first-paragraph extraction, and shared `audit_logger.js` integration) to bring the codebase into alignment with recorded decisions.*

### ❓ Question [2026-06-03] - Substantive vs. Structural Audit Policy
**Context:** `scripts/audit-repo.js` verifies that headings like `Data Inventory` and `Refusal Criteria` exist, but it ignores their content. Current scan shows 100% of these sections in `skills/` contain "TBD" placeholders.
**Ambiguity / Drift:** The repository is structurally compliant but substantively hollow, violating the 4D Description (D2) and Refusal Principle mandates for role-specific precision.
**Question for Product Owner:** Should the audit gate be enhanced to reject files containing "TBD" or similar placeholders in mandatory sections, or should substantive remediation be deferred to domain experts?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to flag "TBD" placeholders in mandatory persona and skill sections as a fatal audit failure.*

### ❓ Question [2026-06-03] - Audit Log Schema Enforcement
**Context:** `REQUIREMENTS.md` mandates a specific JSON shape for Audit Logs, but `scripts/audit-repo.js` only verifies that the block is valid JSON.
**Ambiguity / Drift:** Incomplete audit logs can pass the gate but fail to provide the required fields for fleet observability and ROI calculation.
**Question for Product Owner:** Should `scripts/audit-repo.js` be updated to perform mandatory schema validation (checking for `task`, `inputs`, `actions`, `risks`, and `result` keys) for all Audit Log blocks?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement mandatory JSON schema validation for Audit Log sections in `scripts/audit-repo.js` to ensure fleet-wide observability compliance.*
