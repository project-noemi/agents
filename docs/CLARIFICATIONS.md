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
**🤖 Jules Action Prompt:** *Perform a bulk update of all files in `skills/` to include the mandatory `Data Inventory` and `Refusal Criteria` H3 subsection with role-specific content.*

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

### ❓ Question [2026-05-29] - Golden Fixture Coverage Gap for Value Lenses and Operating Profiles
**Context:** The requirements state "golden fixtures for generated context sections" (Requirement 9), and Decision [2026-05-28-0005] mandated that `generate_all.js` inject `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` markers into generated context files. This injection is now implemented. However, `tests/golden-fixtures.test.js` and `scripts/update-golden-fixtures.js` only cover 4 of the 6 required template injection markers — `GLOBAL_MANDATES`, `AGENT_INDEX`, `SKILLS_INJECTIONS`, and `MCP_INJECTIONS` — while `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` have no corresponding fixture files in `tests/fixtures/generated/`.
**Ambiguity / Drift:** A regression in value lens or operating profile content (accidental edit, template corruption, or prompt-injection attack against the generator) would NOT be detected by the automated test suite. The golden fixture safety net that protects the other four injection zones does not extend to the two newly added framework sections.
**Question for Product Owner:** Should Jules add `value-lenses.md` and `operating-profiles.md` golden fixtures to `tests/fixtures/generated/`, expand `tests/golden-fixtures.test.js` to cover all six markers, and update `scripts/update-golden-fixtures.js` to regenerate all six fixtures?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Action Prompt:** *Extend `tests/golden-fixtures.test.js` and `scripts/update-golden-fixtures.js` to include the `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` markers, generate the two missing fixture files, and confirm the full test suite passes.*

### ❓ Question [2026-05-29] - Test Harness Skills Coverage Asymmetry
**Context:** The requirements state the test suite must cover "persona and template contracts" (Requirement 9). `tests/contracts.test.js` validates agent persona contracts via `discoverAgents` and `REQUIRED_AGENT_SECTIONS`, but there is no equivalent test for skill contracts in the `tests/` directory. Skill contract compliance is enforced only by `scripts/audit-repo.js` (invoked via `npm run audit`), which is a separate gate from `npm test`.
**Ambiguity / Drift:** A developer or CI job running only `npm test` will receive a green result even if one or more skill files in `skills/` are missing a required section (`Purpose`, `Data Inventory`, `Refusal Criteria`, etc.). The asymmetry is undocumented: personas are tested in the harness; skills are not. This creates false confidence for workflows that shortcut `npm run validate` and run only `npm test`.
**Question for Product Owner:** Should a `all skills expose the required contract headings` test be added to `tests/contracts.test.js` (or a new `tests/skills.test.js`) to bring skill contract validation into `npm test`, symmetrically with persona validation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Action Prompt:** *Add a skill contract test to `tests/contracts.test.js` that mirrors the existing persona test — discover all `*.md` files under `skills/` (excluding `SKILL_TEMPLATE.md`) and assert each exposes the full `REQUIRED_SKILL_SECTIONS` headings.*

### ❓ Question [2026-05-29] - Gatekeeper Config Schema Absent
**Context:** The Gatekeeper agent persona (`agents/engineering/gatekeeper.md`) lists `.gatekeeper/config.yml` as a "File of Interest" and describes it as enabling "per-repo overrides (allowlisted file patterns, custom thresholds)." Decision [2026-05-28-0002] materialized the `.gatekeeper/` directory with a `.gitignore` placeholder so the persona becomes "truthful and orchestrator-runnable." However, only a `.gitignore` is present; no YAML schema, field reference, or `config.yml.example` template has been defined.
**Ambiguity / Drift:** A deployer trying to configure the Gatekeeper agent for their organization has no documented contract for what fields `config.yml` may contain. The persona references the file as the primary configuration surface for allowlists and thresholds, yet there is no schema or example to guide them. This leaves the most operationally critical configuration point of the Gatekeeper agent undocumented, increasing misconfiguration risk.
**Question for Product Owner:** Should Jules create a `.gatekeeper/config.yml.example` or `templates/gatekeeper-config.yml` with a documented YAML schema covering the fields the persona describes (repo allowlist, file-pattern overrides, diff thresholds, grace-period settings)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Action Prompt:** *Create `.gatekeeper/config.yml.example` documenting the full YAML schema for the Gatekeeper configuration surface (repo allowlist, file-pattern overrides, diff-size thresholds, conflict grace period) and add a reference to it in `agents/engineering/gatekeeper.md`.*

### ❓ Question [2026-05-31] - Case-Sensitivity Mismatch Between Test Suite and Audit Script
**Context:** Decision [2026-05-28-0004] mandated case-insensitive heading comparison and implemented it in `scripts/audit-repo.js` (lines 60–66). However, `tests/contracts.test.js` (line 48) still uses strict case-sensitive string equality (`heading === required`) for the "all personas expose the required contract headings" test.
**Ambiguity / Drift:** A persona file with non-canonical but semantically valid capitalization (e.g., `## Rules & constraints` or `## Audit log`) will pass `npm run audit` (case-insensitive) but fail `npm test` (case-sensitive). This contradictory result is confusing for contributors and means the CI pipeline can report inconsistent outcomes depending on which command runs. The behavioral gap was introduced by updating only the audit script and not the corresponding test.
**Question for Product Owner:** Should `tests/contracts.test.js` be updated to use case-insensitive heading comparison to match the behavior mandated by Decision [2026-05-28-0004] and already implemented in `scripts/audit-repo.js`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Action Prompt:** *Update the `all personas expose the required contract headings` test in `tests/contracts.test.js` to use `.toLowerCase()` for both the required heading and the extracted heading, mirroring the case-insensitive logic already in `scripts/audit-repo.js`.*
