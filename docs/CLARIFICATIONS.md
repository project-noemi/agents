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

### ❓ Question [2026-05-02] - Agent Index Role Truncation
**Context:** `scripts/context_helpers.js` currently extracts only the first sentence of the `## Role` section for inclusion in the Agent Index.
**Ambiguity / Drift:** For complex agents with multi-sentence role definitions, this leads to truncated and potentially misleading descriptions in the generated context files (`GEMINI.md`, `CLAUDE.md`).
**Question for Product Owner:** Should the Agent Index logic be updated to extract the full first paragraph of the Role section, or should we introduce a specific `### Summary` subsection for this purpose?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/context_helpers.js` to extract the full first paragraph of the `## Role` section for the Agent Index to ensure descriptive accuracy.*

### ❓ Question [2026-05-02] - Config-to-Asset Mapping Validation
**Context:** `mcp.config.json` defines the `active_mcps` and `active_skills` for context generation.
**Ambiguity / Drift:** `scripts/audit-repo.js` does not verify that these entries actually correspond to existing files in `mcp-protocols/` and `skills/`. This allows typos or missing files to go undetected by the structural audit, leading to incomplete generated context.
**Question for Product Owner:** Should `scripts/audit-repo.js` be enhanced to perform a "referential integrity" check against `mcp.config.json`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to validate that every entry in the `active_mcps` and `active_skills` lists within `mcp.config.json` maps to a valid file in the repository.*

### ❓ Question [2026-05-02] - Automated Naming Convention Audit
**Context:** `AGENTS.md` mandates English-first, slug-based naming for all artifacts. The structural rename of `docs/n8n workflows/` was completed in Decision [2026-05-10], but no automated guard exists.
**Ambiguity / Drift:** Without automated enforcement, the repository will continue to accumulate naming drifts that hinder cross-platform compatibility and localization.
**Question for Product Owner:** Should Jules implement a regex-based naming convention check in `scripts/audit-repo.js`, and which directories (e.g., `docs/`, `agents/`, `skills/`, `examples/`, `tools/`) should it cover?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a regex-based filename validation check to `scripts/audit-repo.js` to enforce the English-first, slug-based naming convention across all key directories.*

### ❓ Question [2026-05-02] - Standardized Audit Log Emission for Build Utilities
**Context:** `REQUIREMENTS.md` mandates that agents and reference services emit JSON Audit Logs to `stderr`. Currently, build utilities like `generate_all.js` and `audit-repo.js` use `console.log/error` for status but do not emit a structured JSON audit log of their actions.
**Ambiguity / Drift:** If these utilities are considered "internal agents" of the repository, they lack the observability standard required of external agents.
**Question for Product Owner:** Should repository build and audit utilities also be required to emit a JSON Audit Log to `stderr` upon completion?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/generate_all.js` and `scripts/audit-repo.js` to emit a structured JSON audit log to `stderr` summarizing the files read, modified, and any risks or failures encountered.*

### ❓ Question [2026-05-02] - Audit Log Descriptor Standardization
**Context:** The requirement to emit logs "separately from the primary user-facing payload" is currently interpreted as "to stderr".
**Ambiguity / Drift:** In some orchestrator environments (e.g., n8n, custom Docker wrappers), `stderr` may be used for both technical crashes and structured audit logs, potentially leading to parsing errors.
**Question for Product Owner:** Should we standardize on a specific file descriptor (e.g., `FD 3`) or a prefixed format (e.g., `AUDIT_LOG: {...}`) to ensure unambiguous capture of the audit record?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `REQUIREMENTS.md` to specify a prefixed logging format or a dedicated file descriptor for unambiguous Audit Log capture.*

### ❓ Question [2026-05-02] - Refusal Criteria Substantive Enforcement
**Context:** The requirements and `AGENTS.md` mandate that `Refusal Criteria` must be a mandatory **H3 subsection** within `Rules & Constraints` and must enumerate three specific safety clauses (refused types, override resistance, and escalation path). The H3 structural check is now implemented in `scripts/audit-repo.js`.
**Ambiguity / Drift:** The audit does not yet verify substantive content (e.g., regex for the three mandatory clauses). This allows personas to pass the audit while remaining safety-deficient.
**Question for Product Owner:** Should the audit script be enhanced to perform basic substantive checks (e.g., regex for the three mandatory clauses) within the Refusal Criteria section?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to verify that `Refusal Criteria` contains the three mandated safety clauses.*

### ❓ Question [2026-05-02] - Tool Baseline Alignment (Executive Assistant)
**Context:** The `Executive Assistant` tool (`tools/executive-assistant/`) is implemented in Node.js but lacks structured JSON Audit Logs to `stderr`.
**Ambiguity / Drift:** Internal tools that act as agentic interfaces are currently drifting from the baseline observability requirement set for "external" agents.
**Question for Product Owner:** Should all Node.js-based tools in the `tools/` directory be required to adhere to the JSON Audit Log to `stderr` observability standard?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tools/executive-assistant/` to implement structured JSON Audit Log emission to `stderr` for all triage and configuration events.*

### ❓ Question [2026-05-02] - Skill Contract Enforcement Depth
**Context:** Reusable skills perform critical logic, but the current skill library contains placeholder content in the mandatory `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** There is a mismatch between the theoretical "Reusable Skill Contract" in `REQUIREMENTS.md` and the actual state of the skill library.
**Question for Product Owner:** Should Jules perform a fleet-wide remediation of the `skills/` directory to bring all skills into substantive compliance with the latest contract requirements?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a fleet-wide remediation of the `skills/` directory to bring all skills into substantive compliance with the latest contract requirements.*

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
**🤖 Jules Action Prompt:** *Perform a whole-fleet update of all agent personas in `agents/` to replace placeholder `Data Inventory` and `Refusal Criteria` sections with role-specific, technically accurate content.*

### ❓ Question [2026-05-13] - RFP Split Naming Convention Remediation
**Context:** `AGENTS.md` mandates English-first, slug-based naming. `examples/rfp-split/` contains several files like `Section_1_General_Information.pdf` that violate this rule.
**Ambiguity / Drift:** These files represent technical drift from the repository's naming standards and may cause issues in some environments.
**Question for Product Owner:** Should Jules perform a bulk rename of the assets in `examples/rfp-split/` to align with the slug-based naming convention (e.g., `section-1-general-information.pdf`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Rename all files in `examples/rfp-split/` to follow the English-first, slug-based naming convention.*

### ❓ Question [2026-05-15] - Test Suite Reinforcement of API Path Drift
**Context:** Decision [2026-05-20] standardized the Fleet Dashboard ingestion path on `/api/v1/reports` and mandated that `dashboard-ingest.js` and `tests/examples-smoke.test.js` be updated in lockstep. Verification that both files have been updated in the current main branch is still outstanding.
**Ambiguity / Drift:** The decision is durable; the implementation follow-through needs confirmation.
**Question for Product Owner:** Should Jules perform a verification sweep and, if needed, the lockstep update of `dashboard-ingest.js` and `tests/examples-smoke.test.js` to match the decision?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Verify and (if needed) update `examples/gatekeeper-deployment/dashboard-ingest.js` and `tests/examples-smoke.test.js` to use `/api/v1/reports`.*

### ❓ Question [2026-05-15] - Skill-to-Agent Referential Integrity
**Context:** Agent personas reference reusable skills in their `Workflow` sections using the `**Skill:** [path/to/skill]` pattern. Currently, `scripts/audit-repo.js` does not verify that these referenced skills exist or are enabled in `mcp.config.json`.
**Ambiguity / Drift:** This allows for "broken links" in agent specifications where an agent depends on a skill that has been renamed, deleted, or is not available in the current context.
**Question for Product Owner:** Should the audit script be enhanced to perform referential integrity checks on skill references within agent workflows?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse agent workflows for skill references and verify their existence in the `skills/` directory.*

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

### ❓ Question [2026-05-29] - Sync Script Parameterization
**Context:** `scripts/sync-upstream.sh` currently contains the hardcoded placeholder `MY_ORGANIZATION="[MyOrganization]"` and fixed URLs.
**Ambiguity / Drift:** Organizations forking the repository must perform manual find-and-replace on this script, which increases friction and leads to "identity drift" in forks.
**Question for Product Owner:** Should the sync script be refactored to use environment variables (e.g., `NOEMI_UPSTREAM_URL`, `NOEMI_ORG_NAME`) with sensible defaults, allowing it to be used without manual modification of the source?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/sync-upstream.sh` to pull organization names and upstream URLs from environment variables instead of hardcoded placeholders.*

### ❓ Question [2026-05-29] - Branch Protection Audit Implementation
**Context:** Decision [2026-05-20] and Requirement §7 mandate that branch protection enforcement is mandatory and that `scripts/audit-repo.js` should surface missing protection as a warning/error.
**Ambiguity / Drift:** The current implementation of `scripts/audit-repo.js` focuses on persona/skill headings and template markers but contains no logic to verify if branch protection is active (e.g., by checking the GitHub API or local git configuration).
**Question for Product Owner:** How should the audit script verify branch protection? Should it use the GitHub API (requiring a token) or check for the presence/execution of `scripts/setup-branch-protection.sh`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the branch protection verification logic in `scripts/audit-repo.js`, ensuring it fails in CI environments if protection is not detected.*

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

### ❓ Question [2026-06-01] - Memory-Code Synchronization Drift
**Context:** The repository's "Memory" records several remediations as completed on 2026-05-31 (parameterized sync script, enhanced agent index, shared `audit_logger.js`), but these changes are absent from the VM's filesystem.
**Ambiguity / Drift:** There is a significant discrepancy between the recorded architectural history (Memory) and the implemented codebase truth. This creates a high risk of assuming compliance where technical debt remains.
**Question for Product Owner:** Should Jules proceed with a fresh implementation of these 2026-05-31 remediations to align the codebase with the reported state, or is there an external branch/sync issue that explains the absence of these files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Re-implement the 2026-05-31 remediation set (Sync Script parameterization, Agent Index first-paragraph extraction, and shared `audit_logger.js` integration) to bring the codebase into alignment with recorded decisions.*

### ❓ Question [2026-06-01] - Substantive vs. Structural Audit Policy
**Context:** `audit-repo.js` verifies that headings like `Data Inventory` and `Refusal Criteria` exist, but it ignores their content. Current scan shows 100% of these sections in `skills/` contain "TBD" placeholders.
**Ambiguity / Drift:** The repository is structurally compliant but substantively hollow, violating the 4D Description (D2) and Refusal Principle mandates for role-specific precision.
**Question for Product Owner:** Should the audit gate be enhanced to reject files containing "TBD" or similar placeholders in mandatory sections, or should substantive remediation be deferred to domain experts?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to flag "TBD" placeholders in mandatory persona and skill sections as a fatal audit failure.*

### ❓ Question [2026-06-01] - Audit Log Schema Enforcement
**Context:** `REQUIREMENTS.md` mandates a specific JSON shape for Audit Logs, but `audit-repo.js` only verifies that the block is valid JSON.
**Ambiguity / Drift:** Incomplete audit logs can pass the gate but fail to provide the required fields for fleet observability and ROI calculation.
**Question for Product Owner:** Should `audit-repo.js` be updated to perform mandatory schema validation (checking for `task`, `inputs`, `actions`, `risks`, and `result`) for all Audit Log blocks?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement mandatory JSON schema validation for Audit Log sections in `scripts/audit-repo.js` to ensure fleet-wide observability compliance.*

### ❓ Question [2026-06-10] - Red Team Gauntlet Machine-Readable Test Vectors
**Context:** `examples/red-team-gauntlet/README.md` documents test cases for `PromptShield` and `PIIGuard` in prose, but there are no machine-readable files (JSON/YAML) to support automated validation.
**Ambiguity / Drift:** The `Client Onboarding` agent mandates running a validation suite using these cases, but they cannot be easily consumed by an automated test runner or the agent itself.
**Question for Product Owner:** Should Jules be tasked with serializing the prose test cases into a machine-readable format (e.g., `test-vectors.json`) within the `red-team-gauntlet` directory?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Serialize the Red Team Gauntlet prose test cases into `examples/red-team-gauntlet/test-vectors.json` to support automated validation.*

### ❓ Question [2026-06-10] - Empty Tier Templates Implementation Gap
**Context:** The `Client Onboarding` agent specification references service tier templates (e.g., `basic.md`, `standard.md`) located in `templates/tiers/`.
**Ambiguity / Drift:** The `templates/tiers/` directory currently contains only a `README.md` and lacks the actual template files, preventing the Onboarding agent from fulfilling its mission.
**Question for Product Owner:** Should Jules implement a starter set of service tier templates in `templates/tiers/` based on the documented `basic`, `standard`, and `premium` tiers?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the starter service tier templates (`basic.md`, `standard.md`, `premium.md`) in `templates/tiers/` to enable the Client Onboarding workflow.*

### ❓ Question [2026-06-10] - Mandated audit_logger.js Absence and Ownership
**Context:** Architectural mandates in `AGENTS.md` and `REQUIREMENTS.md` reference a shared `scripts/audit_logger.js` utility for structured JSON logging.
**Ambiguity / Drift:** The file is missing from the repository, causing internal tools and reference services to drift from the observability standard.
**Question for Product Owner:** Is `audit_logger.js` pending delivery from an external team, or should Jules autonomously implement this shared utility and refactor the reference services to use it?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the shared `scripts/audit_logger.js` utility and refactor `executive-assistant` and `dashboard-ingest.js` to use it for mandated JSON Audit Log emission.*

### ❓ Question [2026-06-11] - verify-env.sh Mode Discrepancy
**Context:** `AGENTS.md` mandates that "Missing or invalid SecretOps authentication in docker mode MUST be a fatal error (exit 1)".
**Ambiguity / Drift:** The current implementation of `scripts/verify-env.sh` only issues a warning for missing authentication in all modes, including `docker`.
**Question for Product Owner:** Should I update `scripts/verify-env.sh` to enforce the `exit 1` mandate for the `docker` mode, or is the current warning-only behavior intentional for the reference architecture?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` to enforce a fatal error (exit 1) for missing SecretOps authentication when running in `docker` mode.*

### ❓ Question [2026-06-11] - sync-upstream.sh Hardcoded Identity
**Context:** `AGENTS.md` mandates that "Utilities intended for cross-organization use (e.g., sync-upstream.sh) must use environment variables or CLI flags instead of hardcoded placeholders."
**Ambiguity / Drift:** `scripts/sync-upstream.sh` still contains the hardcoded placeholder `MY_ORGANIZATION="[MyOrganization]"`.
**Question for Product Owner:** Should I refactor the sync script to pull the organization name from an environment variable (e.g., `NOEMI_ORG_NAME`) with a sensible default?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/sync-upstream.sh` to use environment variables for organization-specific values instead of hardcoded placeholders.*

### ❓ Question [2026-06-11] - tests/examples-smoke.test.js Environmental Blindness
**Context:** Requirement §9 mandates that the default test suite must cover "static smoke checks for example stacks and Docker env inventories (including `NOEMI_DOCKER_SMOKE_*` variable validation)."
**Ambiguity / Drift:** `tests/examples-smoke.test.js` currently validates various examples but contains no logic to verify the presence or format of the `NOEMI_DOCKER_SMOKE_*` variables.
**Question for Product Owner:** Should I add a dedicated test case to `tests/examples-smoke.test.js` to validate that these variables are correctly defined in `.env.template`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/examples-smoke.test.js` to include validation for all `NOEMI_DOCKER_SMOKE_*` environment variables defined in `.env.template`.*

### ❓ Question [2026-06-11] - audit_logger.js Mandated Absence
**Context:** `AGENTS.md` mandates that "Node.js-based tools and reference services must use the shared scripts/audit_logger.js utility to emit structured JSON Audit Logs to stderr."
**Ambiguity / Drift:** `scripts/audit_logger.js` is missing from the repository, preventing internal tools and reference services from complying with the observability mandate.
**Question for Product Owner:** Should I implement the missing `scripts/audit_logger.js` utility and refactor the reference tools to use it, or is this file expected from an external source?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the shared `scripts/audit_logger.js` utility and refactor `executive-assistant` and `dashboard-ingest.js` to use it for mandated JSON Audit Log emission.*

### ❓ Question [2026-06-15] - Red Team Gauntlet Serialization Strategy
**Context:** The requirements state "Red Team validation is required for agent deployment readiness," but the codebase in `examples/red-team-gauntlet/README.md` implements only prose documentation without machine-readable vectors.
**Ambiguity / Drift:** The `Client Onboarding` workflow depends on these vectors for validation, but currently, they must be manually extracted, increasing the risk of inconsistent enforcement.
**Question for Product Owner:** Should we serialize these vectors into a single `test-vectors.json` file, or should we create separate files for each protection category (e.g., `prompt-injection.json`, `pii-patterns.json`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Serialize the Red Team Gauntlet test cases into machine-readable JSON files within `examples/red-team-gauntlet/` to support automated validation.*

### ❓ Question [2026-06-15] - Service Tier Template Specifications
**Context:** The requirements state the Client Onboarding agent references service tier templates in `templates/tiers/`, but the codebase in that directory implements only a placeholder README.
**Ambiguity / Drift:** Without these templates, the onboarding workflow cannot be demonstrated or executed, leaving the "Explorer" path blocked.
**Question for Product Owner:** Can you provide the specific service definitions (features, limits, pricing) for the Basic, Standard, and Premium tiers so I can implement the missing templates?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the `basic.md`, `standard.md`, and `premium.md` templates in `templates/tiers/` using the provided service definitions.*

### ❓ Question [2026-06-15] - Audit Script Placeholder Rejection Policy
**Context:** The requirements state `audit-repo.js` must fail when required headings are missing, but the codebase in `scripts/audit-repo.js` implements a presence-only check that ignores "TBD" or hollow placeholders.
**Ambiguity / Drift:** This satisfies the structural audit but leaves the system substantively safety-deficient by allowing agents to pass gates without real 4D-aligned content.
**Question for Product Owner:** Should I update `audit-repo.js` to treat "TBD" or empty placeholders in mandatory persona and skill sections as a fatal error (exit 1) in CI?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to reject files containing "TBD" placeholders in mandatory sections as a fatal audit failure.*

### ❓ Question [2026-06-15] - Operating Profile Baseline Absence
**Context:** The requirements state "The generator must inject... operating profiles from `operating-profiles/`", but the current repository only contains the `PROFILE_TEMPLATE.md` and `README.md`, resulting in empty injection blocks in `GEMINI.md` and `CLAUDE.md`.
**Ambiguity / Drift:** Without starter operating profiles (e.g., `enterprise-standard`, `high-velocity-startup`, `strict-compliance`), agents lack the culturally grounded execution instructions mandated by the framework.
**Question for Product Owner:** Should Jules implement a set of baseline Operating Profiles to match the Value Lenses, or is this intended to be entirely user-defined?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement starter Operating Profiles (e.g., `standard-operating-profile.md`) in `operating-profiles/` to provide a baseline for agentic tone and escalation behavior.*

### ❓ Question [2026-06-15] - Internal Tool Audit Log Event Mapping
**Context:** `AGENTS.md` mandates that internal tools like `executive-assistant` emit structured JSON Audit Logs to `stderr`. The current `executive-assistant` implements an internal `execLogs` array with custom fields (`event`, `details`, `actions`).
**Ambiguity / Drift:** There is no mapping between the internal tool events and the mandatory `Audit Log` schema (`task`, `inputs`, `actions`, `risks`, `result`). This makes it unclear how to refactor these tools for compliant emission.
**Question for Product Owner:** Should we map internal events like `SYNC_COMPLETE` or `TRIAGE_VIP` directly to the `task` field of the Audit Log, or should we define a more granular mapping for tool-specific operations?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Define a standardized mapping for internal tool events to the Audit Log schema and refactor the `executive-assistant` and `dashboard-ingest` services to use it.*

### ❓ Question [2026-06-18] - E2E Smoke Test Docker Mandatory Check
**Context:** The requirements in `REQUIREMENTS.md` Section 9 state "The Docker e2e suite must skip cleanly when Docker is unavailable", but the codebase in `tests/e2e/docker-smoke.test.js` implements this as a silent skip.
**Ambiguity / Drift:** In CI/CD pipelines, a silent skip can lead to a "false green" where critical runtime checks are never actually executed because the runner lacks Docker or has a configuration error. This masks environmental gaps that would be fatal in production.
**Question for Product Owner:** Should the E2E suite be updated to require an explicit flag (e.g., `FORCE_DOCKER_SMOKE=true`) that, when set, causes the test to FAIL if Docker is missing, while preserving the "clean skip" behavior for local development?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/e2e/docker-smoke.test.js` to implement an optional mandatory mode that fails if Docker is missing when `FORCE_DOCKER_SMOKE` is true.*

### ❓ Question [2026-06-18] - Audit Script JSON Schema Validation Mandate
**Context:** The requirements state "Audit Log sections contain structurally invalid JSON (Mandatory JSON shape validation)," but the codebase in `scripts/audit-repo.js` only implements `JSON.parse()` and does not verify mandated fields.
**Ambiguity / Drift:** Personas can pass the audit with empty objects `{}` or unrelated JSON, violating the observability contract required for fleet ROI and risk calculation. Without schema validation, the "Diligence" (D4) layer of the framework remains unenforced.
**Question for Product Owner:** Should Jules implement a strict JSON schema check in `audit-repo.js` that verifies the presence and non-empty status of `task`, `inputs`, `actions`, `risks`, and `result`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement mandatory JSON schema validation for Audit Log sections in `scripts/audit-repo.js` to ensure they contain all five mandated fields.*

### ❓ Question 2026-06-17 - MCP Protocol Specification Contract Audit Gap
**Context:** The requirements state "Persona and Skill Contracts are Mandatory" and Section 3 mandates "Contract and Generator Drift Must Fail Fast," but the codebase in `scripts/audit-repo.js` entirely skips the `mcp-protocols/` directory.
**Ambiguity / Drift:** MCP protocols define the technical "Rules of Engagement" for external tools, yet they currently lack the automated structural enforcement (Purpose, Inputs, Procedure, Outputs, etc.) applied to agents and skills, creating a governance blind spot for tool-heavy agents.
**Question for Product Owner:** Should MCP protocols in `mcp-protocols/` be brought under the same mandatory structural contract and audited by `scripts/audit-repo.js` for heading completeness?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `scripts/audit-repo.js` to define and enforce a mandatory structural contract for all MCP protocol specifications in `mcp-protocols/`.*

### ❓ Question 2026-06-17 - Value Lens and Operating Profile Structural Audit
**Context:** The requirements mandate the injection of Value Lenses and Operating Profiles into context generators, but the codebase in `scripts/audit-repo.js` lacks any logic to verify the structural integrity of these framework assets.
**Ambiguity / Drift:** While there are templates for these assets, there is no automated gate to ensure that a newly added lens or profile adheres to the expected format (e.g., specific headings or neutral operational naming), increasing the risk of "hollow" or biased framework layers.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to enforce structural contracts (via `*_TEMPLATE.md` alignment) for `value-lenses/` and `operating-profiles/`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement structural audit checks for `value-lenses/` and `operating-profiles/` within `scripts/audit-repo.js` to ensure all framework assets align with their respective templates.*

### ❓ Question [2026-06-17] - Automated Internal Documentation Link Integrity
**Context:** The requirements state "Persona and Skill Contracts are Mandatory" and Section 3 mandates "Contract and Generator Drift Must Fail Fast," but the codebase in `scripts/audit-repo.js` entirely skips the `mcp-protocols/` directory and lacks any verification for internal file paths.
**Ambiguity / Drift:** Many agent personas reference reusable skills using the `**Skill:** [path/to/skill]` pattern, and `REQUIREMENTS.md` Section 1 references multiple assessment kit files. There is no automated verification that these internal file paths are valid. As files are renamed or moved, these references become broken links, leading to "Execution Drift" where an agent cannot find its required logic.
**Question for Product Owner:** Should Jules implement a referential integrity check in `scripts/audit-repo.js` that validates all internal markdown links and skill paths across the repository?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a referential integrity audit to `scripts/audit-repo.js` that verifies all internal markdown links (`[text](path/to/file.md)`) and skill references (`**Skill:** [path/to/skill]`) point to existing files.*

### ❓ Question [2026-06-17] - Substantive Content Baseline for Agents
**Context:** The requirements state "Persona and Skill Contracts are Mandatory", but a whole-codebase audit revealed that 100% of agent personas use identical boilerplate text for the `Refusal Criteria` and `Data Inventory` sections.
**Ambiguity / Drift:** While structurally compliant, the repository is in substantive drift from the 4D Description (D2) and Refusal Principle mandates. Agents lack role-specific data and safety-gating logic, creating a false sense of production readiness.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to replace these boilerplate placeholders with role-specific substantive content across all 22+ agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a fleet-wide substantive remediation of all agent personas in `agents/`, replacing boilerplate `Data Inventory` and `Refusal Criteria` with role-specific, technically accurate content.*

### ❓ Question [2026-06-17] - Internal Tool Audit Log Mapping
**Context:** `AGENTS.md` mandates that internal tools like `executive-assistant` emit structured JSON Audit Logs to `stderr`.
**Ambiguity / Drift:** Current internal tools use unstructured `console.log` for operational events. There is no mapping between these events (e.g., `Pub/Sub notification received`, `Triage execution complete`) and the mandatory `Audit Log` schema (`task`, `inputs`, `actions`, `risks`, `result`).
**Question for Product Owner:** Should Jules implement a standard event-to-schema mapping for internal tools, or should we define a more granular audit schema specifically for build/infrastructure tools?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Define a standardized mapping for internal tool events to the Audit Log schema and refactor the `executive-assistant` and `dashboard-ingest` services to use it.*

### ❓ Question [2026-06-18] - audit_logger.js Canonical Schema and Behavior
**Context:** The requirements state "Node.js-based tools and reference services must use the shared `scripts/audit_logger.js` utility to emit structured JSON Audit Logs to `stderr`", but the codebase in `scripts/` lacks this file entirely.
**Ambiguity / Drift:** Internal tools like `executive-assistant` and reference services like `dashboard-ingest.js` are drifting from the observability mandate. Without a canonical utility, there is no standardized way to map internal operational events to the mandatory `Audit Log` schema.
**Question for Product Owner:** Should I autonomously implement `scripts/audit_logger.js` with a mapping function for internal events, or is there a specific external implementation I should wait for?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the shared `scripts/audit_logger.js` utility and refactor `executive-assistant` and `dashboard-ingest.js` to use it for mandated JSON Audit Log emission.*

### ❓ Question [2026-06-18] - Substantive Remediation of Skill "TBD" Placeholders
**Context:** The requirements state "Persona and Skill Contracts are Mandatory", but the codebase in `skills/` currently contains "TBD" placeholders for 100% of the active reusable skills in mandatory sections like `Data Inventory` and `Refusal Criteria`.
**Ambiguity / Drift:** The skill library passes structural audits but is substantively safety-deficient, failing the 4D framework's "Description" (D2) mandate. This creates a risk where agents depend on "hollow" skills for critical logic.
**Question for Product Owner:** Should Jules perform a bulk substantive remediation to replace these "TBD" placeholders with technically grounded defaults based on each skill's documented Procedure, or should this wait for manual domain-specific input?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of the `skills/` directory, replacing "TBD" placeholders with technically grounded defaults based on each skill's documented Procedure.*

### ❓ Question [2026-06-18] - verify-env.sh Fatal Error Enforcement in Docker Mode
**Context:** The requirements state "Missing or invalid SecretOps authentication in docker mode MUST be a fatal error (exit 1)", but the codebase in `scripts/verify-env.sh` and `scripts/verify-env.ps1` only implements non-fatal warnings for all modes.
**Ambiguity / Drift:** This allows Docker deployments to proceed without verified SecretOps access, violating the "Fetch-on-Demand" security mandate for production-like environments.
**Question for Product Owner:** Should I update the pre-flight scripts to enforce the `exit 1` fatal error mandate when `--mode=docker` is specified, even if it might block initial local exploration for some users?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to enforce a fatal error (exit 1) for missing SecretOps authentication when running in `docker` mode.*

### ❓ Question [2026-06-19] - SecretOps Provider Bias in Smoke Tests
**Context:** The `AGENTS.md` mandates that secrets can be stored in Infisical OR 1Password, but the test suite in `tests/examples-smoke.test.js` explicitly asserts the presence of the `op://` pattern.
**Ambiguity / Drift:** This creates a "false failure" for users who have adopted Infisical as their primary SecretOps provider, violating the multi-provider architectural mandate.
**Question for Product Owner:** Should the smoke test be updated to accept either `op://` or `infisical://` (or generic vault reference patterns) to truly support the multi-provider mandate?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/examples-smoke.test.js` to support both `op://` and `infisical://` vault reference patterns in its assertion logic.*

### ❓ Question [2026-06-19] - Resilience Helper Persona Integration
**Context:** `REQUIREMENTS.md` identifies a "Resilience Helper Integration Gap" where `scripts/resilience_helpers.js` is not utilized by any agent personas, despite a mandate for resilience in agentic systems.
**Ambiguity / Drift:** Network-bound agents like `Gatekeeper` and `Client Onboarding` remain susceptible to transient failures because their specifications do not explicitly mandate retry-with-backoff logic for tool interactions.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to all network-bound agent personas to include `withRetry` logic in their `Workflow` and `External Tooling Dependencies` sections?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Integrate the `withRetry` resilience pattern into the `Workflow` and `External Tooling Dependencies` of all network-bound agent personas in `agents/`.*

### ❓ Question [2026-06-19] - Legacy Example Model Drift
**Context:** The `AGENTS.md` mandates **Gemini 2.5 Flash** as the canonical baseline, but `examples/docker/agent.py` is pinned to `gemini-2.0-flash`.
**Ambiguity / Drift:** This creates inconsistent behavior and cost profiles across the reference architecture, potentially confusing users who follow the legacy examples.
**Question for Product Owner:** Should all legacy Python/Bash examples be updated to point to the `gemini-2.5-flash` baseline, or should they be allowed to remain on older models for illustrative purposes?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `examples/docker/agent.py` and any other legacy examples to use the canonical `models/gemini-2.5-flash` baseline.*

### ❓ Question [2026-06-19] - Resilience Helper Module System Mismatch
**Context:** The requirements state "The repository must contain at least one reusable reference pattern for exponential backoff and retry (Node.js implementation: `scripts/resilience_helpers.js`)", but the codebase in `tools/executive-assistant/package.json` implements `"type": "module"` (ESM), while `scripts/resilience_helpers.js` uses CommonJS `module.exports`.
**Ambiguity / Drift:** ESM-based tools and services cannot directly `import` CommonJS files without additional configuration or wrapper logic. This creates technical friction for the mandated integration of resilience patterns into the "Executive Assistant" and other ESM-native services.
**Question for Product Owner:** Should we migrate all shared utilities in `scripts/` to ESM to match the modern tool baseline, or should we provide dual-system (CJS/ESM) support for core resilience helpers?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Migrate `scripts/resilience_helpers.js` and other shared utilities to ESM or implement a dual-module export pattern to support both CLI utilities and ESM-native services.*

### ❓ Question [2026-06-19] - audit_logger.js Schema and Event Mapping
**Context:** `AGENTS.md` mandates that internal tools and services use a shared `scripts/audit_logger.js` to emit structured JSON Audit Logs to `stderr`, but the file is missing from the repository.
**Ambiguity / Drift:** Without a canonical utility or a clearly defined schema for "internal operational events" (e.g., `SYNC_COMPLETE`, `CONFIG_UPDATE`), there is a risk of disparate logging implementations across the fleet. This undermines the goal of unified observability and automated ROI/Risk calculation.
**Question for Product Owner:** Should the `audit_logger.js` implement the exact same 5-field schema as agent personas (`task`, `inputs`, `actions`, `risks`, `result`), or should we extend it for infrastructure-level events?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the `scripts/audit_logger.js` utility with a standardized internal event schema and refactor `executive-assistant` and `dashboard-ingest` to use it.*

### ❓ Question [2026-06-20] - Executive Assistant "Learning Agent" Resolution Path
**Context:** The `Executive Assistant` reference implementation in `tools/executive-assistant/server.js` includes an `/api/resolution` endpoint that claims to be processed by a "Learning Agent" and updates internal execution logs with "Historical messages passed".
**Ambiguity / Drift:** This "Learning Agent" and the human-in-the-loop resolution pattern are not defined in `REQUIREMENTS.md` or any agent persona. This suggests a feature drift where the implementation introduces a feedback loop that isn't governed by the requirements.
**Question for Product Owner:** Is the "Learning Agent" resolution path a core architectural requirement for NoéMI reference services, and if so, should it be formalized in `REQUIREMENTS.md` and supported by a dedicated agent persona?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Document the "Learning Agent" resolution pattern in `REQUIREMENTS.md` and create a dedicated persona specification in `agents/operations/learning-agent.md` that governs how agents should learn from human resolutions.*

### ❓ Question [2026-06-20] - Rules & Constraints Heading Inconsistency
**Context:** `AGENTS.md` and `audit-repo.js` require "Rules & Constraints" for agent personas but "Rules & Constraints (4D Diligence)" for reusable skills.
**Ambiguity / Drift:** This inconsistency in the mandatory heading name complicates the audit logic and creates confusion for builders. Given that both are intended to incorporate the 4D framework (specifically Diligence), there is no clear reason for the different naming conventions.
**Question for Product Owner:** Should we standardize on a single heading name (e.g., `Rules & Constraints (4D Diligence)`) for both agent personas and skills to ensure consistency across the repository?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Standardize the "Rules & Constraints" heading name across all personas, skills, and audit scripts to use the `(4D Diligence)` suffix.*

### ❓ Question [2026-06-20] - Phase 0 Assessment Kit Audit Coverage
**Context:** Requirement §1 mandates a specific inventory of 8+ files for the Phase 0 Assessment Kit, but `scripts/audit-repo.js` currently provides no verification for this critical business asset.
**Ambiguity / Drift:** As the "front door" for buyers, the Assessment Kit's completeness is paramount. Without automated auditing, files can be accidentally moved or renamed, breaking the buyer's first-contact experience and violating Requirement §1.
**Question for Product Owner:** Should the Phase 0 Assessment Kit inventory be added to the mandatory repository audit performed by `scripts/audit-repo.js`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Extend `scripts/audit-repo.js` to verify the presence of all 8 mandated files in the `docs/phase-zero-assessment/` directory.*

### ❓ Question [2026-06-21] - Executive Assistant "Learning Agent" Formalization
**Context:** The `executive-assistant` tool in `tools/executive-assistant/server.js` implements a `/api/resolution` endpoint and "Learning Agent" logic for mapping human feedback to internal logs, which is missing from `REQUIREMENTS.md`.
**Ambiguity / Drift:** This implementation introduces a Human-in-the-Loop (HITL) feedback loop that is not governed by a persona or requirement. It creates an undocumented feature drift where agents are "learning" without a defined specification for how that learning is applied or audited.
**Question for Product Owner:** Should the "Learning Agent" resolution path be formalized as a core NoéMI requirement? If so, should we create a dedicated `Learning Agent` persona in `agents/operations/` to govern this behavior?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Document the "Learning Agent" HITL resolution pattern in `REQUIREMENTS.md` and create a matching persona specification in `agents/operations/learning-agent.md`.*

### ❓ Question [2026-06-21] - Audit Script Placeholder and Content Rejection
**Context:** `audit-repo.js` currently passes files containing "TBD" placeholders in mandatory sections (100% of skills currently contain them), violating the "Substantive Compliance" mandate in `AGENTS.md`.
**Ambiguity / Drift:** The repository is structurally compliant but substantively hollow, masking a significant lack of production-ready safety and data definitions.
**Question for Product Owner:** Should the audit gate be updated to reject any persona or skill containing "TBD" or similar placeholders in mandatory sections as a fatal error (exit 1) in CI?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to flag "TBD" and "placeholder" strings in mandatory persona and skill sections as a fatal audit failure.*

### ❓ Question [2026-06-21] - Framework Asset Structural Audit
**Context:** Framework assets like `value-lenses/` and `operating-profiles/` are injected by `generate_all.js` but are not audited for structural integrity by `audit-repo.js`.
**Ambiguity / Drift:** Without an automated audit, these assets can drift from their respective templates (e.g., `LENS_TEMPLATE.md`), leading to inconsistent context injection and potentially breaking the "Comparison Mode" logic used by downstream agents.
**Question for Product Owner:** Should framework assets in `value-lenses/` and `operating-profiles/` be brought under the mandatory structural contract and audited for heading completeness by `scripts/audit-repo.js`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement structural audit checks for `value-lenses/` and `operating-profiles/` in `scripts/audit-repo.js`, enforcing alignment with their respective templates.*
