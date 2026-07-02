# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- Durable answers from the March-April-May 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`, `2026-04-13`, `2026-05-20`, `2026-05-26`, and `2026-05-28-*`.
- [2026-07-02] **Bulk resolution:** the April–June 2026 backlog (~45 questions) was closed via `DECISION_LOG.md` entry `[2026-07-02] Bulk Clarification Resolution — 2026-04 through 2026-06 Backlog`. Answerable questions were resolved with reasoning and their implementations landed in the same PR (see [REQUIREMENTS.md](REQUIREMENTS.md) §5 Remediated Limitations for the concrete file changes). Questions that require product-owner or external-stakeholder judgment remain below.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.

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

## Deferred to Product Owner (open)

The following questions were reviewed on 2026-07-02 and require product-owner or external-stakeholder judgment before they can be resolved.

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
**Ambiguity / Drift:** While the repository passes structural audits (headings are present), it has drifted into substantive non-compliance with the 4D framework (D2 Description) and the Refusal Principle. Agents lack the role-specific data definitions and safety-gating logic required for production readiness. `scripts/audit-repo.js` now warns on these placeholders (Decision [2026-07-02]) but the warn-to-fatal switch (`NOEMI_AUDIT_SUBSTANTIVE=strict`) cannot be flipped until the placeholders are remediated.
**Question for Product Owner:** Should Jules be tasked with a bulk update to replace these placeholders with role-specific substantive content, or should this be handled incrementally during domain-specific work?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a whole-fleet update of all agent personas in `agents/` to replace placeholder `Data Inventory` and `Refusal Criteria` sections with role-specific, technically accurate content, then set `NOEMI_AUDIT_SUBSTANTIVE=strict` in CI.*

### ❓ Question [2026-05-01] - Node.js 24 Baseline Enforcement in Docker
**Context:** The repository mandates Node.js 24 as the baseline for all logic and utilities (`AGENTS.md`, `package.json`).
**Ambiguity / Drift:** Some reference Docker configurations may still be pinned to older Node images, drifting from the mandated baseline. Decision [2026-05-10] partially remediated this (gatekeeper-deployment and executive-assistant), but a fleet-wide sweep has not been completed.
**Question for Product Owner:** Should an automated audit check be added to `scripts/audit-repo.js` to flag any `Dockerfile` or `docker-compose.yml` that uses a Node image older than 24?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a Node baseline check to `scripts/audit-repo.js` that scans all `Dockerfile` and `docker-compose.yml` files for `node:<24`.*

### ❓ Question [2026-05-01] - Persona Journal Section Standardization
**Context:** Only a minority of agent personas currently include a `## Journal` section.
**Ambiguity / Drift:** While not strictly mandated in `AGENTS.md`, its presence in some agents creates inconsistency in how agents are expected to record critical learnings across the fleet. Adding this as mandatory would fail 100% of current personas until backfilled.
**Question for Product Owner:** Should the `## Journal` section be added to the mandatory persona contract in `AGENTS.md` and enforced across all agents to support standardized across-fleet learning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/AGENT_TEMPLATE.md` to include `Journal` as a mandatory section, then perform a bulk update to add it to all 22 agent personas.*

### ❓ Question [2026-05-02] - Automated Naming Convention Audit
**Context:** `AGENTS.md` mandates English-first, slug-based naming for all artifacts. The structural rename of `docs/n8n workflows/` was completed in Decision [2026-05-10], but no automated guard exists.
**Ambiguity / Drift:** Without automated enforcement, the repository will continue to accumulate naming drifts.
**Question for Product Owner:** Should Jules implement a regex-based naming convention check in `scripts/audit-repo.js`, and which directories (e.g., `docs/`, `agents/`, `skills/`, `examples/`, `tools/`) should it cover?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a regex-based filename validation check to `scripts/audit-repo.js` to enforce the English-first, slug-based naming convention across all key directories.*

### ❓ Question [2026-05-02] - Casdoor Identity Integration Logic
**Context:** `REQUIREMENTS.md` and `DECISION_LOG.md` identify Casdoor as the reference identity layer for multi-tenant deployments.
**Ambiguity / Drift:** While Casdoor is present in `fleet-deployment` compose files, there is no implementation logic (scripts, middleware, or agents) that actually performs token validation or user context extraction. This is coupled to the Fleet Dashboard multi-tenancy question above.
**Question for Product Owner:** Should Jules implement a reference `casdoor-auth` skill or Node.js middleware to demonstrate how agents should validate identity in a multi-tenant fleet?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a `skills/security/casdoor-validate.md` specification and implement basic JWT validation middleware in `examples/gatekeeper-deployment/dashboard-ingest.js`.*

### ❓ Question [2026-05-13] - RFP Split Naming Convention Remediation
**Context:** `AGENTS.md` mandates English-first, slug-based naming. `examples/rfp-split/` contains several files like `Section_1_General_Information.pdf` that violate this rule.
**Ambiguity / Drift:** These files may be referenced from external documents; a bulk rename could break outside links.
**Question for Product Owner:** Should Jules perform a bulk rename of the assets in `examples/rfp-split/` to align with the slug-based naming convention (e.g., `section-1-general-information.pdf`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Rename all files in `examples/rfp-split/` to follow the English-first, slug-based naming convention.*

### ❓ Question [2026-05-20] - AI Model Version Baseline Formalization Follow-through
**Context:** Decision [2026-05-17] / Requirement §"AI Model Baseline" pinned Gemini 2.5 Flash as the canonical reference model. Multiple example workflows and smoke tests reference `models/gemini-2.5-flash`. Legacy `examples/docker/agent.py` was remediated on 2026-07-02.
**Ambiguity / Drift:** A repo-wide automated check for non-baseline model pins does not exist. Adding one requires knowing which "exceptions" are allowed.
**Question for Product Owner:** Should `scripts/audit-repo.js` add a grep-based check that flags any reference workflow or smoke test pinning a non-baseline model? If so, which files/paths (if any) are allowed to reference legacy models?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add an AI model baseline check to `scripts/audit-repo.js` scanning `examples/` and `tests/` for non-baseline model pins, with an allowlist for legacy examples.*

### ❓ Question [2026-06-17] - MCP Protocol Specification Contract Audit Gap
**Context:** The requirements state "Persona and Skill Contracts are Mandatory" and Section 3 mandates "Contract and Generator Drift Must Fail Fast," but `scripts/audit-repo.js` entirely skips the `mcp-protocols/` directory. MCP protocols define the technical "Rules of Engagement" for external tools yet lack automated structural enforcement.
**Ambiguity / Drift:** No mandatory-heading contract exists for MCP protocol specifications; enforcement cannot land until the contract is defined.
**Question for Product Owner:** What is the mandatory structural contract for MCP protocol specifications in `mcp-protocols/`? Once defined, `scripts/audit-repo.js` can enforce it.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Define the mandatory MCP protocol contract in `AGENTS.md` and implement matching audit logic in `scripts/audit-repo.js`.*

### ❓ Question [2026-06-17] - Value Lens and Operating Profile Structural Audit
**Context:** The requirements mandate the injection of Value Lenses and Operating Profiles into context generators, but `scripts/audit-repo.js` lacks any logic to verify the structural integrity of these framework assets.
**Ambiguity / Drift:** `LENS_TEMPLATE.md` and `PROFILE_TEMPLATE.md` exist but the audit does not enforce alignment with them.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to enforce structural contracts (via `*_TEMPLATE.md` alignment) for `value-lenses/` and `operating-profiles/`? If so, which template headings are mandatory?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement structural audit checks for `value-lenses/` and `operating-profiles/` within `scripts/audit-repo.js` to ensure all framework assets align with their respective templates.*

### ❓ Question [2026-06-17] - Automated Internal Documentation Link Integrity
**Context:** Many agent personas reference reusable skills using the `**Skill:** [path/to/skill]` pattern, and `REQUIREMENTS.md` references multiple assessment kit files. There is no automated verification that these internal file paths are valid. `mcp.config.json` referential integrity is now enforced (Decision [2026-07-02]) but the full internal-link check has larger surface.
**Ambiguity / Drift:** As files are renamed or moved, references become broken links.
**Question for Product Owner:** Should Jules implement a referential integrity check in `scripts/audit-repo.js` that validates all internal markdown links (`[text](path.md)`) and `**Skill:**` references across the repository?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a referential integrity audit to `scripts/audit-repo.js` that verifies all internal markdown links and skill references point to existing files.*

### ❓ Question [2026-06-19] - Resilience Helper Persona Integration
**Context:** `REQUIREMENTS.md` identifies a "Resilience Helper Integration Gap" where `scripts/resilience_helpers.js` is not utilized by any agent personas, despite a mandate for resilience in agentic systems. The ESM shim is now available (Decision [2026-07-02]).
**Ambiguity / Drift:** Network-bound agents like `Gatekeeper` and `Client Onboarding` remain susceptible to transient failures because their specifications do not explicitly mandate retry-with-backoff logic for tool interactions.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to all network-bound agent personas to include `withRetry` logic in their `Workflow` and `External Tooling Dependencies` sections?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Integrate the `withRetry` resilience pattern into the `Workflow` and `External Tooling Dependencies` of all network-bound agent personas in `agents/`.*

### ❓ Question [2026-06-20] - Rules & Constraints Heading Inconsistency
**Context:** `AGENTS.md` and `audit-repo.js` require "Rules & Constraints" for agent personas but "Rules & Constraints (4D Diligence)" for reusable skills.
**Ambiguity / Drift:** Standardizing on either name requires bulk-editing 26 agents or 8 skills. Case-insensitive matching already tolerates cosmetic drift, but the two-name convention adds real complexity.
**Question for Product Owner:** Should we standardize on a single heading name (e.g., `Rules & Constraints (4D Diligence)`) for both agent personas and skills to ensure consistency? Which direction (add the suffix to agents, or remove it from skills)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Standardize the "Rules & Constraints" heading name across all personas, skills, and audit scripts.*

### ❓ Question [2026-06-20] / [2026-06-22] - Learning Agent Feedback Loop & Admin Control Plane
**Context:** `tools/executive-assistant/server.js` implements an `/api/resolution` endpoint and "Learning Agent" logic, plus several admin endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`) without documented authentication.
**Ambiguity / Drift:** The Learning Agent and admin API are undocumented feature drift — they are not defined in `REQUIREMENTS.md` or any agent persona. This is a governance question: formalize or remove?
**Question for Product Owner:** Should the Learning Agent and admin control plane be formalized as first-class NoéMI requirements (with a dedicated persona and Casdoor-secured API), or removed from the reference implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Formalize or remove the Learning Agent HITL pattern and the admin API in `tools/executive-assistant/`, updating `REQUIREMENTS.md` and adding a persona at `agents/operations/learning-agent.md` if formalized.*

### ❓ Question [2026-06-27] - Generator Fail-Fast Policy for Framework Assets
**Context:** `REQUIREMENTS.md` Section 3 mandates "Contract and Generator Drift Must Fail Fast," but `scripts/generate_all.js` (via `context_helpers.js`) returns HTML comments rather than `exit 1` when framework directories are missing or empty.
**Ambiguity / Drift:** This allows "hollow" context files to be generated silently. Making this fatal is a policy shift, not a bug fix.
**Question for Product Owner:** Should the generator enforce a fatal error (exit 1) if any mandated framework asset directory is missing or contains no operational files? Which directories are "mandatory" for this purpose (`value-lenses/`, `operating-profiles/`, both)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/generate_all.js` and `scripts/context_helpers.js` to enforce a fatal error if mandated framework assets are missing during context generation.*
