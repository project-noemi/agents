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

### ❓ Question [2026-04-04] - `logging-mcp` Standardized Log Shape vs. Audit Log
**Context:** `mcp-protocols/logging-mcp.md` defines a "Standardized Log Shape" that includes `timestamp`, `agent`, `task`, `status`, `duration_ms`, and `metadata`. Meanwhile, `AGENTS.md` and `REQUIREMENTS.md` mandate a "lightweight JSON summary shape" for the `Audit Log` as `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`.
**Ambiguity / Drift:** While complementary, it's unclear if the `Audit Log` is intended to be *part* of the `logging-mcp` payload (e.g., inside `metadata`) or if they are two separate emissions that need to be reconciled.
**Question for Product Owner:** Should the `logging-mcp` protocol be updated to explicitly incorporate the mandated `Audit Log` JSON shape as the primary payload for "success" events?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Align the `logging-mcp` protocol definition with the mandated `Audit Log` JSON shape to ensure technical consistency across the observability stack.*

### ❓ Question [2026-04-04] - Onboarding Directory Drift
**Context:** The `Client Onboarding` persona specification (`agents/operations/client-onboarding.md`) references a `templates/tiers/` directory for tier templates and a `clients/` directory for provisioned client configurations.
**Ambiguity / Drift:** Neither of these directories currently exists in the repository, and the `templates/` directory only contains `context/` templates.
**Question for Product Owner:** Where should the `Client Onboarding` tier templates be located? Should we create the `templates/tiers/` and `clients/` directories to support this workflow?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create `templates/tiers/` with basic templates (Basic/Standard/Premium) and initialize the `clients/` directory with a `.gitignore` to support the onboarding workflow.*

### ❓ Question [2026-04-04] - Fleet Dashboard API Path Mismatch
**Context:** The `Fleet Dashboard` persona (`agents/operations/fleet-dashboard.md`) specifies `/api/v1/reports` as the ingestion endpoint, but the reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` (and its corresponding `docker-compose.yml`) uses `/ingest`.
**Ambiguity / Drift:** This inconsistency causes agents following the persona specification to fail when communicating with the implemented dashboard.
**Question for Product Owner:** Should the Fleet Dashboard API ingest path be standardized to `/api/v1/reports` (matching the persona) or `/ingest` (matching the implementation)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Standardize the Fleet Dashboard API ingest endpoint path across all persona specifications and implementation scripts to ensure technical alignment.*

### ❓ Question [2026-04-04] - Framework Integration in Context Generators
**Context:** The `Value Lenses` and `Operating Profiles` frameworks are documented in `docs/frameworks/` and presented as core layers of the NoéMI architecture. However, the context generators (`scripts/generate_gemini.js` and `scripts/generate_claude.js`) do not currently inject these frameworks into the generated context files.
**Ambiguity / Drift:** Agents consuming `GEMINI.md` or `CLAUDE.md` lack direct access to the lens and profile definitions, making it difficult for them to adhere to these layers autonomously.
**Question for Product Owner:** Should the context generators be updated to include `Value Lenses` and `Operating Profiles` as part of the global mandates or as separate injection sections?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/context_helpers.js` and the context generators to support `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` markers.*

### ❓ Question [2026-04-05] - `logging-mcp` InfluxDB Backend Support
**Context:** `mcp-protocols/logging-mcp.md` defines Loki/Grafana and n8n webhooks as the primary backends, but the reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` and `docker-compose.yml` uses InfluxDB as the primary time-series datastore.
**Ambiguity / Drift:** The protocol definition does not account for the primary storage mechanism used in the specialist deployment examples.
**Question for Product Owner:** Should the `logging-mcp` protocol be updated to explicitly support InfluxDB as a third canonical backend for structured log ingestion?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `mcp-protocols/logging-mcp.md` to include InfluxDB as a supported backend and define the corresponding query/ingestion patterns.*

### ❓ Question [2026-04-05] - SecretOps Syntax Drift: `.env.template` vs `.env.example`
**Context:** `AGENTS.md` specifies the 1Password command wrapper pattern using `--env-file=.env.template`, while `docs/tool-usages/secure-secret-management.md` and all `docker-compose.yml` files in `examples/` use `--env-file=.env.example`.
**Ambiguity / Drift:** This inconsistency creates confusion for builders and may lead to execution failures if they use the wrong reference file for secret injection.
**Question for Product Owner:** Should the repository standardize on `.env.template` (the root inventory) or `.env.example` (the per-example inventory) for all 1Password command wrapper documentation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Standardize all 1Password command wrapper examples across `AGENTS.md`, `docs/tool-usages/`, and `examples/` to use the chosen reference file.*

### ❓ Question [2026-04-05] - Incomplete Example Smoke Test Coverage
**Context:** `REQUIREMENTS.md` Section 9 mandates "static smoke checks for example stacks and Docker env inventories." However, `tests/examples-smoke.test.js` currently omits several reference implementations including `examples/rfp-split`, `examples/gmu-validation`, and `examples/secure-secret-management`.
**Ambiguity / Drift:** Reference examples that are not covered by the smoke test suite may drift from the core architecture (e.g., regarding secret handling or Node baseline) without being detected by the CI pipeline.
**Question for Product Owner:** Should all subdirectories in `examples/` be covered by at least one static smoke check to satisfy Requirement 9?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Expand `tests/examples-smoke.test.js` to include static smoke checks for `rfp-split`, `gmu-validation`, and `secure-secret-management`, ensuring they adhere to the Fetch-on-Demand and Node 24 baselines.*

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

### ❓ Question [2026-04-25] - Audit Log JSON Schema Validation
**Context:** `REQUIREMENTS.md` Section 2 mandates a specific JSON shape for Audit Logs. Currently, `scripts/audit-repo.js` only checks for the presence of the "Audit Log" heading.
**Ambiguity / Drift:** There is no technical enforcement of the actual JSON schema within the agent files, leading to potential drift where the heading exists but the content is structurally invalid.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to include strict JSON schema validation for the Audit Log section in all agent and skill files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse and validate the JSON shape of the Audit Log section against the mandated schema `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`.*

### ❓ Question [2026-04-25] - Skill Contract Audit Enforcement
**Context:** Decision [2026-04-13] mandated specific sections (Rules & Constraints, Audit Log) for skills, but `scripts/audit-repo.js` currently only audits agent personas in `agents/`.
**Ambiguity / Drift:** Reusable skills perform critical logic, but their structural integrity is not automatically enforced, leading to silent drift where new skills skip safety-critical sections or the Refusal Criteria subsection.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to enforce the same structural contract (Required Headings, Refusal Criteria) on all files in the `skills/` directory?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to discover and audit all files in the `skills/` directory for structural compliance with the mandatory skill contract.*

### ❓ Question [2026-04-22] - Data Inventory for Skills
**Context:** Agent personas have a mandatory `Data Inventory` (D2) section to satisfy 4D Description requirements. Reusable skills currently use `Inputs` and `Outputs` headings but lack a consolidated `Data Inventory`.
**Ambiguity / Drift:** Inconsistency between agent and skill documentation makes it harder for builders to maintain a unified data dictionary across the fleet.
**Question for Product Owner:** Should the `Data Inventory` heading be added to the mandatory skill contract (`SKILL_TEMPLATE.md`) for architectural symmetry with agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `SKILL_TEMPLATE.md` and all existing skills to include a mandatory `Data Inventory` section, replacing or consolidating the current `Inputs`/`Outputs` logic where appropriate.*

### ❓ Question [2026-04-26] - Substantive Persona Content Drift
**Context:** A whole-codebase audit revealed that 100% of agent personas (22/22) currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** While the repository passes structural audits (headings are present), it has drifted into substantive non-compliance with the 4D framework (D2 Description) and the Refusal Principle. Agents lack the role-specific data definitions and safety-gating logic required for production readiness.
**Question for Product Owner:** Should Jules be tasked with a bulk update to replace these placeholders with role-specific substantive content, or should this be handled incrementally during domain-specific work?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a whole-fleet update of all agent personas in `agents/` to replace placeholder `Data Inventory` and `Refusal Criteria` sections with role-specific, technically accurate content.*

### ❓ Question [2026-04-26] - Reference Asset Absence
**Context:** Several agent specifications (e.g., `Client Onboarding`) mandate the use of assets from the `examples/` directory (e.g., `red-team-gauntlet` test vectors), but these directories are currently empty or missing the actual assets.
**Ambiguity / Drift:** The agent specifications describe workflows that cannot be executed or validated with the current codebase state.
**Question for Product Owner:** Should we prioritize populating these example directories with starter assets to make the agent specifications "truthful" and testable?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Populate `examples/red-team-gauntlet/` and other referenced example directories with the starter assets, test vectors, and templates required by the agent specifications.*

### ❓ Question [2026-04-23] - Missing NOEMI_DOCKER_SMOKE_* Smoke Test Validation
**Context:** `REQUIREMENTS.md` Section 9 mandates static smoke checks for `NOEMI_DOCKER_SMOKE_*` environment variables, but these are currently missing from `tests/examples-smoke.test.js`.
**Ambiguity / Drift:** Without these checks, the repository lacks automated validation that the mandatory Docker smoke test configuration is correctly present and formatted in `.env.template`.
**Question for Product Owner:** Should Jules be tasked with implementing these specific smoke checks in `tests/examples-smoke.test.js` to satisfy Requirement 9?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement static smoke checks in `tests/examples-smoke.test.js` to validate the presence and format of `NOEMI_DOCKER_SMOKE_*` variables in the root `.env.template`.*

### ❓ Question [2026-04-23] - Gatekeeper Reference Implementation Mutating Actions
**Context:** The `Gatekeeper` agent persona describes mutating actions (merging PRs, closing issues), but the reference implementation in `examples/gatekeeper-deployment/` is currently limited to signed reporting.
**Ambiguity / Drift:** The implementation truth drifts from the persona specification, leaving the "Accelerator" role partially unimplemented in the reference stack.
**Question for Product Owner:** Should we extend the Gatekeeper reference implementation to include "dry-run" or optional mutating actions to better reflect the persona's mission?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Extend the Gatekeeper deployment example and `entrypoint.sh` to include a placeholder or dry-run mode for the mutating actions defined in the Gatekeeper persona.*

### ❓ Question [2026-05-01] - Node.js 24 Baseline Enforcement in Docker
**Context:** The repository mandates Node.js 24 as the baseline for all logic and utilities (`AGENTS.md`, `package.json`).
**Ambiguity / Drift:** Reference Docker configurations in `examples/gatekeeper-deployment/docker-compose.yml` and `tools/executive-assistant/Dockerfile` are still pinned to `node:20-alpine`, drifting from the mandated baseline.
**Question for Product Owner:** Should all reference Dockerfiles and Compose files be updated to `node:24-alpine` to maintain technical alignment with the repository baseline?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update all `Dockerfile` and `docker-compose.yml` files in `examples/` and `tools/` to use the `node:24-alpine` image to satisfy the repository's baseline requirement.*

### ❓ Question [2026-05-01] - Persona Journal Section Standardization
**Context:** Only 4 out of 22 agent personas (`sentinel/core.md`, `bolt/core.md`, `bolt/nextjs-16.md`, `gatekeeper.md`) currently include a `## Journal` section.
**Ambiguity / Drift:** While not a strictly mandated section in `AGENTS.md`, its presence in a minority of agents creates inconsistency in how agents are expected to record critical learnings across the fleet.
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

### ❓ Question [2026-05-02] - Skill Data Inventory Inconsistency
**Context:** Agent personas have a mandatory `Data Inventory` (D2) section to satisfy 4D Description requirements. Reusable skills currently lack this section, using only `Inputs` and `Outputs`.
**Ambiguity / Drift:** This creates a structural inconsistency across the fleet and drifts from the 4D Description standard for reusable logic components.
**Question for Product Owner:** Should the `Data Inventory` heading be added to the mandatory skill contract (`SKILL_TEMPLATE.md`) to ensure all repository logic follows the same D2 Description standard?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `SKILL_TEMPLATE.md` and all 8 existing skills to include a mandatory `Data Inventory` section, replacing or consolidating the current `Inputs`/`Outputs` logic where appropriate.*

### ❓ Question [2026-05-02] - Automated Naming Convention Audit
**Context:** `AGENTS.md` mandates English-first, slug-based naming for all artifacts, but `scripts/audit-repo.js` does not yet enforce this. A drift was identified in `docs/n8n workflows/`.
**Ambiguity / Drift:** Without automated enforcement, the repository will continue to accumulate naming drifts that hinder cross-platform compatibility and localization.
**Question for Product Owner:** Should Jules implement a regex-based naming convention check in any key directory?
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

### ❓ Question [2026-05-02] - Refusal Criteria Structural and Substantive Enforcement
**Context:** The requirements and `AGENTS.md` mandate that `Refusal Criteria` must be a mandatory **H3 subsection** within `Rules & Constraints` and must enumerate three specific safety clauses (refused types, override resistance, and escalation path).
**Ambiguity / Drift:** Currently, `scripts/audit-repo.js` only verifies the presence of the "Refusal Criteria" heading at any level and does not validate the required substantive content. This allows personas to pass the audit while remaining safety-deficient.
**Question for Product Owner:** Should the audit script be enhanced to enforce the H3 hierarchy and perform basic substantive checks (e.g., regex for the three mandatory clauses) within the Refusal Criteria section?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to verify that `Refusal Criteria` is a child of `Rules & Constraints` and contains the three mandated safety clauses.*

### ❓ Question [2026-05-02] - Artifact Naming Convention Drift
**Context:** `AGENTS.md` mandates that all exported artifacts (workflows, scripts, documentation) must use **English-first, slug-based naming** (e.g., `ai-triage-inbound.json`) to avoid localization drift.
**Ambiguity / Drift:** A whole-codebase scan identified `docs/n8n workflows/`, which uses spaces instead of slugs. Additionally, `scripts/audit-repo.js` currently lacks any logic to enforce this naming convention across the repository.
**Question for Product Owner:** Should `scripts/audit-repo.js` be updated to enforce slug-based naming for all files and directories in `docs/`, `examples/`, and `tools/`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` to enforce English-first, slug-based naming for all repository artifacts and rename `docs/n8n workflows/` to `docs/n8n-workflows/`.*

### ❓ Question [2026-05-02] - Framework Markers in Context Templates
**Context:** The `Value Lenses` and `Operating Profiles` frameworks are core NoéMI layers, but the context generators and templates (`GEMINI.template.md`, `CLAUDE.template.md`) lack the corresponding `<!-- VALUE_LENS_INJECTIONS_START -->` and `<!-- OPERATING_PROFILE_INJECTIONS_START -->` markers.
**Ambiguity / Drift:** Agents cannot currently receive these frameworks in their context files, even though they are documented as mandatory layers.
**Question for Product Owner:** Should we prioritize adding these markers to the templates and updating the generators to support framework injection?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` markers to context templates and update `scripts/context_helpers.js` to support their injection.*

### ❓ Question [2026-05-02] - Case-Insensitive Heading Audits
**Context:** `scripts/audit-repo.js` currently performs strict string matching for required headings like `Refusal Criteria`.
**Ambiguity / Drift:** Minor casing differences (e.g., "Refusal criteria") can cause audit failures for files that are substantively compliant.
**Question for Product Owner:** Should `scripts/audit-repo.js` be updated to perform case-insensitive heading validation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/audit-repo.js` and `scripts/context_helpers.js` to perform case-insensitive matching for all required persona and skill headings.*

### ❓ Question [2026-05-02] - SecretOps Authentication Verification
**Context:** `verify-env.sh` and `verify-env.ps1` check for the *presence* of the Infisical or 1Password CLI but do not verify whether the user is actually *authenticated* to their respective vault.
**Ambiguity / Drift:** A successful pre-flight check may still lead to runtime failures if the user is not logged in, as "Fetch-on-Demand" commands (`infisical run`, `op run`) will fail to resolve secrets.
**Question for Product Owner:** Should the pre-flight verification scripts be updated to include an authentication check (e.g., `infisical whoami` or `op get user`) for the detected SecretOps provider?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to include an active authentication check for Infisical or 1Password when in `builder` or `docker` modes.*

### ❓ Question [2026-05-02] - Sync Script Generalization
**Context:** `scripts/sync-upstream.sh` and `docs/UPSTREAM_SYNC.md` contain hardcoded `[MyOrganization]` placeholders and use fixed repository URLs.
**Ambiguity / Drift:** This forces every "forking" organization to manually find and replace these strings in a script that is intended to be a reusable, low-friction reference utility.
**Question for Product Owner:** Should the synchronization script be generalized to use environment variables or a local `.noemi-sync.json` configuration file for the organization name and repository URLs?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Generalize `scripts/sync-upstream.sh` to read its configuration from environment variables or a local config file, and update `docs/UPSTREAM_SYNC.md` to reflect the new standardized usage.*

### ❓ Question [2026-04-05] - Audit Log Emission to Stderr in Reference Services
**Context:** `REQUIREMENTS.md` mandates that agents emit JSON Audit Logs to `stderr`.
**Ambiguity / Drift:** Reference implementation services that perform agent-like ingestion and processing, such as `examples/gatekeeper-deployment/dashboard-ingest.js`, do not currently emit their own audit logs to `stderr` in the mandated JSON shape.
**Question for Product Owner:** Should reference implementation services also be required to emit JSON audit logs to `stderr` to align with the observability standards set for agents?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `examples/gatekeeper-deployment/dashboard-ingest.js` and other reference services to emit JSON audit logs to `stderr` for every significant operational event.*

### ❓ Question [2026-05-02] - Node.js 24 Baseline Enforcement in Docker Reference Examples
**Context:** `AGENTS.md` and `package.json` mandate Node.js 24 as the technical baseline for all repository logic and utilities.
**Ambiguity / Drift:** Reference Docker configurations in `examples/gatekeeper-deployment/docker-compose.yml` and `tools/executive-assistant/Dockerfile` are still pinned to `node:20-alpine`, drifting from the mandated baseline.
**Question for Product Owner:** Should all reference Dockerfiles and Compose files be updated to `node:24-alpine` to maintain technical alignment with the repository baseline?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update all `Dockerfile` and `docker-compose.yml` files in `examples/` and `tools/` to use the `node:24-alpine` image to satisfy the repository's baseline requirement.*

### ❓ Question [2026-05-02] - Persona Journal Section Standardization
**Context:** Only 4 out of 22 agent personas (`sentinel/core.md`, `bolt/core.md`, `bolt/nextjs-16.md`, `gatekeeper.md`) currently include a `## Journal` section.
**Ambiguity / Drift:** While not a strictly mandated section in `AGENTS.md`, its presence in a minority of agents creates inconsistency in how agents are expected to record critical learnings across the fleet.
**Question for Product Owner:** Should the `## Journal` section be added to the mandatory persona contract in `AGENTS.md` and enforced across all agents to support standardized across-fleet learning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/AGENT_TEMPLATE.md` to include `Journal` as a mandatory section, then perform a bulk update to add it to all 22 agent personas.*

### ❓ Question [2026-05-02] - Automated Audit Script Coverage Gaps
**Context:** `AGENTS.md` and `REQUIREMENTS.md` mandate strict structural contracts for both agents and skills. However, a holistic scan confirms that `scripts/audit-repo.js` currently only audits the `agents/` directory and ignores the `skills/` directory. Additionally, it verifies the existence of the "Audit Log" heading but does not perform JSON schema validation on the mandated shape.
**Ambiguity / Drift:** Reusable skills and Audit Log structural integrity are currently unenforced by the repository's own gates, leading to silent drift in safety-critical sections.
**Question for Product Owner:** Should the audit script be prioritized for a bulk update to include skill auditing and strict JSON schema validation for the Audit Log section?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to audit all files in `skills/` and implement JSON schema validation for the `Audit Log` section across all personas and skills.*

### ❓ Question [2026-05-02] - Artifact Naming Convention Drift
**Context:** `AGENTS.md` mandates English-first, slug-based naming for all artifacts. A codebase scan identified `docs/n8n workflows/`, which uses spaces instead of slugs.
**Ambiguity / Drift:** Non-slug naming creates cross-platform compatibility risks and violates the repository's own naming mandate.
**Question for Product Owner:** Should we rename `docs/n8n workflows/` to `docs/n8n-workflows/` and add automated filename validation to the audit script?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Rename `docs/n8n workflows/` to `docs/n8n-workflows/` and update `scripts/audit-repo.js` to enforce slug-based naming for all files in `docs/`, `agents/`, and `skills/`.*

### ❓ Question [2026-05-02] - SecretOps Authentication Depth
**Context:** `verify-env.sh` and `verify-env.ps1` check for the *presence* of SecretOps CLIs (Infisical/1Password) but do not verify if the user is actually *authenticated* to their vault.
**Ambiguity / Drift:** A "success" in pre-flight may still lead to runtime failures when "Fetch-on-Demand" commands fail due to an expired or missing session.
**Question for Product Owner:** Should the pre-flight scripts be updated to perform an active authentication check (e.g., `infisical whoami` or `op get user`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to include active authentication checks for the detected SecretOps provider.*

### ❓ Question [2026-05-02] - Tool Baseline Alignment (Executive Assistant)
**Context:** The `Executive Assistant` tool (`tools/executive-assistant/`) is implemented in Node.js but lacks several repository-wide standards: it uses Node 20 in its `Dockerfile` and does not emit structured JSON Audit Logs to `stderr`.
**Ambiguity / Drift:** Internal tools that act as agentic interfaces are currently drifting from the baseline requirements set for "external" agents.
**Question for Product Owner:** Should all Node.js-based tools in the `tools/` directory be required to adhere to the same technical baseline (Node 24) and observability standard (JSON Audit Log to `stderr`) as agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tools/executive-assistant/` to use Node 24 and implement structured JSON Audit Log emission to `stderr` for all triage and configuration events.*

### ❓ Question [2026-05-02] - Skill Contract Enforcement Depth
**Context:** Reusable skills perform critical logic, but all 8 current skills lack the mandatory `Data Inventory` (D2) section and the `Refusal Criteria` H3 subsection.
**Ambiguity / Drift:** There is a mismatch between the theoretical "Reusable Skill Contract" in `REQUIREMENTS.md` and the actual state of the skill library.
**Question for Product Owner:** Should Jules perform a fleet-wide remediation of the `skills/` directory to bring all 8 skills into substantive compliance with the latest contract requirements?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk update of all 8 files in `skills/` to include the mandatory `Data Inventory` section and `Refusal Criteria` H3 subsection.*

### ❓ Question [2026-05-02] - Missing Referenced Assets and Directories
**Context:** Several agent personas (e.g., `Client Onboarding`, `Gatekeeper`, `QBR Presenter`) reference directories like `clients/` and `.gatekeeper/` which do not currently exist in the repository. Additionally, `red-team-gauntlet` test vectors are missing.
**Ambiguity / Drift:** The agent specifications describe workflows and configurations that cannot be executed or validated because the supporting infrastructure and assets are absent.
**Question for Product Owner:** Should we prioritize creating these directory structures with `.gitignore` placeholders and populating the test vectors to make the repository specifications "runnable" for external orchestrators?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create the missing `clients/` and `.gatekeeper/` directories with `.gitignore` placeholders and populate `examples/red-team-gauntlet/` with the starter test vectors required for agent validation.*

### ❓ Question [2026-05-02] - Node.js 24 Baseline Enforcement in Reference Examples
**Context:** The repository mandates Node.js 24 as the technical baseline, but several reference Docker images (e.g., `gatekeeper-deployment`, `executive-assistant`) are still pinned to Node 20.
**Ambiguity / Drift:** This environmental drift creates inconsistency between the repository's core logic and its deployment examples, potentially leading to runtime issues or security gaps.
**Question for Product Owner:** Should all reference Dockerfiles and Docker Compose files be updated to `node:24-alpine` immediately to ensure baseline compliance across the entire ecosystem?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk update of all `Dockerfile` and `docker-compose.yml` files in the repository to use `node:24-alpine` as the standard base image.*

### ❓ Question [2026-05-02] - Identity Provider Implementation Gap
**Context:** `DECISION_LOG.md` and `REQUIREMENTS.md` mention Casdoor as the reference identity layer for multi-tenant fleet deployments.
**Ambiguity / Drift:** While `docker-compose.yml` in `examples/fleet-deployment/` includes a Casdoor service, there is no evidence of Casdoor integration logic in any of the repository's scripts or agent personas.
**Question for Product Owner:** Should we implement a basic `casdoor-mcp` or add authentication middleware to the reference services to make the identity layer requirement "truthful"?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a `casdoor-mcp` protocol and implement basic JWT validation middleware for the Fleet Dashboard reference services.*

### ❓ Question [2026-05-10] - Substantive Persona Remediation Strategy
**Context:** All 22 agent personas and 8 reusable skills currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** While structurally compliant (the headings exist), the repository is in substantive drift from the 4D Description (D2) and Refusal Principle mandates.
**Question for Product Owner:** Should Jules be authorized to perform a fleet-wide "substantive remediation" to replace these placeholders with role-specific, technically accurate content?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of all agent personas in `agents/` and skills in `skills/` to replace placeholder Data Inventory and Refusal Criteria with role-specific content.*

### ❓ Question [2026-05-10] - Audit Script Coverage Expansion
**Context:** `scripts/audit-repo.js` currently only audits the `agents/` directory and ignores `skills/`. It also lacks JSON schema validation for the `Audit Log` section.
**Ambiguity / Drift:** The repository's own gates are currently blind to structural or substantive drift within the skill library and the mandatory Audit Log shape.
**Question for Product Owner:** Should we prioritize expanding `audit-repo.js` to include the `skills/` directory and strict JSON schema validation for the Audit Log section?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to audit the `skills/` directory and implement strict JSON schema validation for the `Audit Log` section across all personas and skills.*

### ❓ Question [2026-05-10] - Missing Infrastructure Assets for Agent Validation
**Context:** Several agent specifications (e.g., `Client Onboarding`, `Gatekeeper`, `QBR Presenter`) reference directories (`clients/`, `.gatekeeper/`) and test vectors (`red-team-gauntlet`) that do not exist.
**Ambiguity / Drift:** These agents describe workflows that cannot be executed or validated because the supporting infrastructure and reference data are missing.
**Question for Product Owner:** Should Jules be tasked with creating these directory structures (with `.gitignore` placeholders) and populating the test vectors to make the agent specifications "truthful" and runnable?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create the missing `clients/` and `.gatekeeper/` directories with `.gitignore` placeholders and populate `examples/red-team-gauntlet/` with the starter test vectors required for agent validation.*

### ❓ Question [2026-05-11] - Pre-flight Authentication Check Implementation
**Context:** `AGENTS.md` now mandates active authentication checks in pre-flight scripts, but `scripts/verify-env.sh` and `scripts/verify-env.ps1` currently only check for tool presence.
**Ambiguity / Drift:** Builders may pass pre-flight but fail at runtime due to expired SecretOps sessions. We need to standardize the specific commands used for `whoami` checks across Infisical and 1Password.
**Question for Product Owner:** Should we implement `infisical whoami` and `op user get --me` as the canonical verification commands, and should a failure in these checks be a "Hard Fail" (exit 1) or a "Warning"?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to include active authentication checks using the approved SecretOps commands.*

### ❓ Question [2026-05-11] - Template Marker Duplication Resolution
**Context:** `templates/context/GEMINI.template.md` contains duplicate marker pairs for `GLOBAL_MANDATES` and `AGENT_INDEX`.
**Ambiguity / Drift:** This causes the generated `GEMINI.md` to have redundant sections, increasing token usage and potential agent confusion.
**Question for Product Owner:** Should we standardize on a single placement for these markers (e.g., at the end of the file) and remove the duplicates?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Remove duplicate `GLOBAL_MANDATES` and `AGENT_INDEX` markers from `templates/context/GEMINI.template.md` and ensure a clean, single-injection structure.*

### ❓ Question [2026-05-12] - Skill Contract Substantive Drift and Placeholder Audit
**Context:** A reality check confirms that all 8 reusable skills in the `skills/` directory lack the mandated `## Data Inventory` and `### Refusal Criteria` sections. Furthermore, the `Audit Log` section in these skills consists entirely of placeholder JSON.
**Ambiguity / Drift:** While the repository mandates these sections in `AGENTS.md` and `REQUIREMENTS.md`, the actual skill library is in substantive non-compliance, leaving reusable logic components without the required data definitions and safety gates.
**Question for Product Owner:** Should Jules perform a fleet-wide update of the `skills/` directory to replace these placeholders and missing sections with technically accurate, role-specific content?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of the `skills/` directory to include mandatory `Data Inventory` and `Refusal Criteria` sections and replace Audit Log placeholders.*

### ❓ Question [2026-05-12] - Internal Tool Observability Gap
**Context:** `AGENTS.md` mandates that all personas emit a JSON Audit Log to `stderr`. However, internal Node.js tools like `tools/executive-assistant/server.js` and reference services like `examples/gatekeeper-deployment/dashboard-ingest.js` currently only use unstructured `console.log/error`.
**Ambiguity / Drift:** Internal tools that act as agentic gateways or ingestion sinks lack the observability standard required of the agents they serve.
**Question for Product Owner:** Should we enforce the structured JSON Audit Log emission to `stderr` for all internal tools and reference services to ensure a unified observability stack?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement structured JSON Audit Log emission to `stderr` for `executive-assistant` and `dashboard-ingest` services.*

### ❓ Question [2026-05-12] - Pre-flight Script Logic Contradiction
**Context:** `scripts/verify-env.sh` contains two redundant blocks for SecretOps CLI verification. The first block treats the absence of both `infisical` and `op` as a hard failure (`ALL_GOOD=false` and exit 1), while the second block treats it as a warning for "local repo-only prompts."
**Ambiguity / Drift:** This contradiction causes the script to fail for beginners who may not yet need SecretOps for local exploration, violating the "beginner-safe" requirement.
**Question for Product Owner:** Should we remove the first "hard-fail" block and standardize on the "warning" behavior for pre-flight SecretOps checks to support local-first onboarding?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/verify-env.sh` and `scripts/verify-env.ps1` to remove redundant SecretOps checks and ensure consistent "Warning" behavior for missing vault CLIs.*

### ❓ Question [2026-05-13] - RFP Split Naming Convention Remediation
**Context:** `AGENTS.md` mandates English-first, slug-based naming. `examples/rfp-split/` contains several files like `Section_1_General_Information.pdf` that violate this rule.
**Ambiguity / Drift:** These files represent technical drift from the repository's naming standards and may cause issues in some environments.
**Question for Product Owner:** Should Jules perform a bulk rename of the assets in `examples/rfp-split/` to align with the slug-based naming convention (e.g., `section-1-general-information.pdf`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Rename all files in `examples/rfp-split/` to follow the English-first, slug-based naming convention.*

### ❓ Question [2026-05-13] - Skill Directory Audit Enforcement
**Context:** `scripts/audit-repo.js` currently skips the `skills/` directory.
**Ambiguity / Drift:** This allows skills to drift from the mandatory structural contract (Audit Log, Data Inventory, Refusal Criteria) without being caught by the repository's gates.
**Question for Product Owner:** Should we prioritize expanding `audit-repo.js` to include a structural and substantive audit of the `skills/` directory?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to discover and audit all files in `skills/` for structural and substantive compliance.*

### ❓ Question [2026-05-13] - Pre-flight Active Authentication Checks
**Context:** `AGENTS.md` mandates active authentication checks in pre-flight scripts, but `verify-env.sh` and `verify-env.ps1` currently only check for CLI presence.
**Ambiguity / Drift:** We need to confirm the canonical commands for authentication verification.
**Question for Product Owner:** Should we use `infisical whoami` and `op user get --me` as the standard authentication checks, and should their failure be treated as a "Hard Fail" (exit 1) in `builder` and `docker` modes?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to implement active authentication checks with the specified commands.*

### ❓ Question [2026-05-17] - Branch Protection Enforcement Mandate
**Context:** The repository contains `scripts/setup-branch-protection.sh` to automate GitHub branch protection rules, aligning with the `develop` -> `main` workflow mandated in `REQUIREMENTS.md` Section 9.
**Ambiguity / Drift:** While the workflow is mandated, the use of the enforcement script itself is not a requirement. This leads to a "soft enforcement" where the script exists but its execution is not verified or required for repository governance.
**Question for Product Owner:** Should the execution of `scripts/setup-branch-protection.sh` (or an equivalent automated enforcement) be added as a mandatory requirement for "Governance and Trust Controls" in `REQUIREMENTS.md`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `REQUIREMENTS.md` Section 7 to include mandatory branch protection enforcement using the provided script and add a validation check to `audit-repo.js` to ensure protection is active via the GitHub API.*

### ❓ Question [2026-05-17] - Phase 0 Assessment Kit Inventory Drift
**Context:** `REQUIREMENTS.md` Section 1 specifies a list of templates for the Phase 0 Assessment Kit (security/AI readiness guides, consent, report-of-findings, roadmap, rubric).
**Ambiguity / Drift:** The `docs/phase-zero-assessment/` directory contains additional critical assets: `PRACTITIONER_NOTES.md` and `network-security-assessment.md`. These are currently "extra-canonical" and not tracked by the requirement suite.
**Question for Product Owner:** Should the Phase 0 Assessment Kit requirement in `REQUIREMENTS.md` be expanded to explicitly include `PRACTITIONER_NOTES.md` and `network-security-assessment.md`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `REQUIREMENTS.md` Section 1 to include `PRACTITIONER_NOTES.md` and `network-security-assessment.md` in the canonical Phase 0 Assessment Kit inventory.*

### ❓ Question [2026-05-17] - AI Model Version Baseline for Reference Workflows
**Context:** Reference n8n workflows (e.g., `examples/workflows/rfp-responder.json`) and smoke tests (`tests/examples-smoke.test.js`) are pinned to `models/gemini-2.5-flash`.
**Ambiguity / Drift:** There is no "AI Model Baseline" requirement in `REQUIREMENTS.md` or `AGENTS.md` comparable to the "Node.js 24 Baseline." This makes it unclear if `gemini-2.5-flash` is the mandated reference model for all NoéMI examples or if it's just a placeholder.
**Question for Product Owner:** Should the repository establish a canonical AI Model Baseline (e.g., Gemini 2.5 Flash) for all reference workflows and examples to ensure predictable performance and cost during validation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Define a "Reference AI Model Baseline" in `AGENTS.md` and `REQUIREMENTS.md` and update all example workflows and smoke tests to adhere to this standard.*

### ❓ Question [2026-05-15] - Test Suite Reinforcement of API Path Drift
**Context:** The requirements and `Fleet Dashboard` persona mandate `/api/v1/reports` as the ingestion endpoint. However, `examples/gatekeeper-deployment/dashboard-ingest.js` implements `/ingest`, and `tests/examples-smoke.test.js` explicitly asserts that `/ingest` is the correct path.
**Ambiguity / Drift:** The test suite is currently "codifying" a technical drift, making it harder to remediate the inconsistency without breaking the build.
**Question for Product Owner:** Should the test suite be updated to reflect the persona mandate (`/api/v1/reports`) even if the current implementation still uses `/ingest`, or should we wait until the implementation is ready to change?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/examples-smoke.test.js` to expect `/api/v1/reports` and coordinate with the implementation fix in `dashboard-ingest.js`.*

### ❓ Question [2026-05-15] - Skill-to-Agent Referential Integrity
**Context:** Agent personas reference reusable skills in their `Workflow` sections using the `**Skill:** [path/to/skill]` pattern. Currently, `scripts/audit-repo.js` does not verify that these referenced skills exist or are enabled in `mcp.config.json`.
**Ambiguity / Drift:** This allows for "broken links" in agent specifications where an agent depends on a skill that has been renamed, deleted, or is not available in the current context.
**Question for Product Owner:** Should the audit script be enhanced to perform referential integrity checks on skill references within agent workflows?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse agent workflows for skill references and verify their existence in the `skills/` directory.*

### ❓ Question [2026-05-16] - Skill Template and Library Substantive Remediation
**Context:** A whole-codebase audit verified that `skills/SKILL_TEMPLATE.md` and all 8 reusable skills in the `skills/` directory are missing the mandated `## Data Inventory` and `### Refusal Criteria` sections.
**Ambiguity / Drift:** The skill library is in substantive drift from the 4D Description (D2) and Refusal Principle mandates, which are required for production-ready logic.
**Question for Product Owner:** Should Jules be tasked with a fleet-wide "substantive remediation" of the skill library to add these missing sections and replace Audit Log placeholders with role-specific content?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of `skills/SKILL_TEMPLATE.md` and all files in `skills/` to incorporate `Data Inventory` and `Refusal Criteria` and replace Audit Log placeholders.*

### ❓ Question [2026-05-16] - Referential Integrity Enforcement for Context Configuration
**Context:** `mcp.config.json` defines the `active_mcps` and `active_skills` injected into context. Currently, `scripts/audit-repo.js` does not verify that these entries actually map to existing files.
**Ambiguity / Drift:** Typos or missing files in the configuration lead to incomplete context generation without triggering an audit failure, creating a "silent failure" mode in the CI/CD pipeline.
**Question for Product Owner:** Should the repository's audit gate be enhanced to perform strict "referential integrity" checks ensuring all configured MCPs and skills exist in their respective directories?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to validate that every entry in `mcp.config.json` maps to a valid file in `mcp-protocols/` or `skills/`.*

### ❓ Question [2026-05-16] - Test Suite Alignment with API Mandates
**Context:** The `Fleet Dashboard` persona mandates `/api/v1/reports`, but the implementation uses `/ingest`. `tests/examples-smoke.test.js` currently asserts that `/ingest` is the correct path.
**Ambiguity / Drift:** The test suite is codifying and reinforcing a technical drift, making it harder to remediate the API path inconsistency.
**Question for Product Owner:** Should the test suite be updated to expect the mandated `/api/v1/reports` path (triggering a deliberate failure until the implementation is fixed) or should the persona be updated to match the implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/examples-smoke.test.js` to expect `/api/v1/reports` and implement the corresponding fix in `examples/gatekeeper-deployment/dashboard-ingest.js`.*

### ❓ Question [2026-05-17] - Generator Script Redundancy
**Context:** The repository contains `scripts/generate_all.js`, `scripts/generate_gemini.js`, and `scripts/generate_claude.js`. `generate_all.js` appears to perform the same logic for both Gemini and Claude by calling shared helpers.
**Ambiguity / Drift:** Maintenance overhead is increased by having three entry points for context generation. It's unclear if `generate_gemini.js` and `generate_claude.js` should be deprecated in favor of the single `generate_all.js` orchestrator.
**Question for Product Owner:** Should we deprecate `scripts/generate_gemini.js` and `scripts/generate_claude.js` and standardize on `scripts/generate_all.js` for all context generation tasks?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Remove `scripts/generate_gemini.js` and `scripts/generate_claude.js`, ensuring `scripts/generate_all.js` is the sole, fully-featured entry point for context generation.*

### ❓ Question [2026-05-17] - Logging MCP Reference Implementation Gap
**Context:** `mcp-protocols/logging-mcp.md` exists as a dual-backend draft, but it is not active in `mcp.config.json`, and reference services like `dashboard-ingest.js` do not yet adhere to its schema.
**Ambiguity / Drift:** The observability "standard" is documented but not implemented in the repository's own reference services, creating a gap between architectural theory and implementation truth.
**Question for Product Owner:** Should Jules be tasked with a "substantive implementation" of the `logging-mcp` pattern across the repository's reference services and build tools?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Activate `logging-mcp` in `mcp.config.json` and refactor `dashboard-ingest.js` and build utilities to emit logs according to the protocol's standardized JSON shape.*

### ❓ Question [2026-05-17] - Pre-flight Active Authentication Checks
**Context:** `AGENTS.md` mandates active authentication checks in pre-flight scripts, but `verify-env.sh` and `verify-env.ps1` currently only check for CLI presence.
**Ambiguity / Drift:** We need to confirm the canonical commands for authentication verification.
**Question for Product Owner:** Should we use `infisical whoami` and `op user get --me` as the standard authentication checks, and should their failure be treated as a "Hard Fail" (exit 1) in `builder` and `docker` modes?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to implement active authentication checks with the specified commands.*

### ❓ Question [2026-05-19] - Audit Script JSON Schema Validation Mandate
**Context:** `REQUIREMENTS.md` Section 2 mandates a specific JSON shape for Audit Logs, but `scripts/audit-repo.js` currently only verifies the presence of the "Audit Log" heading.
**Ambiguity / Drift:** There is no technical enforcement of the mandated schema (`{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`), allowing agents to pass audits with structurally invalid or placeholder JSON.
**Question for Product Owner:** Should Jules be tasked with implementing strict JSON schema validation within `scripts/audit-repo.js` for all agent and skill files to ensure technical compliance?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse and validate the JSON Audit Log section in all agents and skills against the mandated schema.*

### ❓ Question [2026-05-19] - Internal Tool Observability Standard
**Context:** `AGENTS.md` and `REQUIREMENTS.md` mandate that agents and reference services emit JSON Audit Logs to `stderr`.
**Ambiguity / Drift:** Build utilities (`generate_all.js`, `audit-repo.js`) and internal tools (`executive-assistant`) currently use unstructured logs, drifting from the observability standard set for external agents.
**Question for Product Owner:** Should internal repository tools and build utilities also be required to emit a structured JSON Audit Log to `stderr` upon completion for fleet-wide observability?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `scripts/generate_all.js`, `scripts/audit-repo.js`, and `tools/executive-assistant/server.js` to emit structured JSON Audit Logs to `stderr`.*

### ❓ Question [2026-05-20] - Audit Script Enforcement Depth (Skills & Schema)
**Context:** `REQUIREMENTS.md` and `AGENTS.md` mandate strict structural contracts for both agents and skills, including a specific JSON shape for Audit Logs. Currently, `scripts/audit-repo.js` only audits the `agents/` directory and only checks for the presence of the "Audit Log" heading.
**Ambiguity / Drift:** Reusable skills and Audit Log structural integrity are currently unenforced by the repository's own gates, leading to silent drift in safety-critical sections.
**Question for Product Owner:** Should the audit script expansion (to include `skills/` and JSON schema validation) be prioritized as a mandatory governance fix?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to audit all files in `skills/` and implement JSON schema validation for the `Audit Log` section across all personas and skills.*

### ❓ Question [2026-05-20] - Fleet Dashboard API Path Standardization
**Context:** The `Fleet Dashboard` persona mandates `/api/v1/reports` as the ingestion endpoint. However, the reference implementation in `dashboard-ingest.js` uses `/ingest`, and `tests/examples-smoke.test.js` explicitly asserts that `/ingest` is correct.
**Ambiguity / Drift:** The test suite is currently codifying a technical drift, making it harder to remediate the inconsistency without breaking the build.
**Question for Product Owner:** Should we standardize on the persona-mandated `/api/v1/reports` path across the implementation and test suite immediately?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Standardize the Fleet Dashboard API ingest path to `/api/v1/reports` across `fleet-dashboard.md`, `dashboard-ingest.js`, and `examples-smoke.test.js`.*

### ❓ Question [2026-05-20] - Branch Protection Enforcement Mandate
**Context:** The repository contains `scripts/setup-branch-protection.sh` to automate GitHub governance rules (e.g., `develop` -> `main` flow).
**Ambiguity / Drift:** While the workflow is mandated, the use of the enforcement script is not currently a mandatory requirement in `REQUIREMENTS.md`.
**Question for Product Owner:** Should the execution of `scripts/setup-branch-protection.sh` (or an equivalent automated enforcement) be added as a mandatory requirement for NoéMI governance?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `REQUIREMENTS.md` Section 7 to include mandatory branch protection enforcement using the provided script and add a validation check to `audit-repo.js`.*
