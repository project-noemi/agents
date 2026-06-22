# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-05-28] Bulk closure: a large block of late-cycle clarifications was either resolved by Decision entries dated 2026-05-28-0001 through 2026-05-28-0006 (logging-mcp payload alignment, onboarding directory bootstrap, SecretOps reference standardization, case-insensitive heading audits, Value Lens/Operating Profile injection, and the bulk closure of clarifications overtaken by prior decisions), or recognized as restatements of already-resolved questions. See `DECISION_LOG.md` for the durable record.
- [2026-06-19] Bulk closure: a large block of clarifications was resolved by Decision entries `2026-06-19-0001` through `2026-06-19-0016`, covering the shared `audit_logger.js` utility (shipped), `sync-upstream.sh` parameterization (shipped), `NOEMI_DOCKER_SMOKE_*` smoke-test inventory gate (shipped), reaffirmed reference-only scope for `resilience_helpers.js`, scope-approved MCP/value-lens/operating-profile audits, reaffirmed Docker-mode hard-fail for `verify-env.sh`, Red Team Gauntlet single-file serialization shape, ROI Auditor local JSON snapshot, operating-profile baseline set, and the bulk closure of clarifications subsumed by the [2026-05-20] audit-coverage expansion. The remaining open questions below all require Product Owner judgment (commercial definitions, scope of reference-implementation expansion, or authorization for safety-critical bulk content rewrites).

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

### ❓ Question [2026-05-29] - Skill Remediation Priority
**Context:** 100% of the active reusable skills in `skills/` currently contain "TBD" placeholders for mandatory `Data Inventory` and `Refusal Criteria` sections.
**Ambiguity / Drift:** This represents a significant substantive drift from the 4D framework. However, remediating all skills requires domain-specific knowledge for each skill's inputs and procedures.
**Question for Product Owner:** Should Jules prioritize a bulk remediation of these placeholders with generic/safe defaults, or should remediation be deferred until a human provides the domain-specific logic for each skill?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of the `skills/` directory, replacing "TBD" placeholders with technically grounded defaults based on each skill's documented Procedure.*

### ❓ Question [2026-06-10] - Empty Tier Templates Implementation Gap
**Context:** The `Client Onboarding` agent specification references service tier templates (e.g., `basic.md`, `standard.md`) located in `templates/tiers/`.
**Ambiguity / Drift:** The `templates/tiers/` directory currently contains only a `README.md` and lacks the actual template files, preventing the Onboarding agent from fulfilling its mission.
**Question for Product Owner:** Should Jules implement a starter set of service tier templates in `templates/tiers/` based on the documented `basic`, `standard`, and `premium` tiers?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the starter service tier templates (`basic.md`, `standard.md`, `premium.md`) in `templates/tiers/` to enable the Client Onboarding workflow.*

### ❓ Question [2026-06-15] - Service Tier Template Specifications
**Context:** The requirements state the Client Onboarding agent references service tier templates in `templates/tiers/`, but the codebase in that directory implements only a placeholder README.
**Ambiguity / Drift:** Without these templates, the onboarding workflow cannot be demonstrated or executed, leaving the "Explorer" path blocked.
**Question for Product Owner:** Can you provide the specific service definitions (features, limits, pricing) for the Basic, Standard, and Premium tiers so I can implement the missing templates?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the `basic.md`, `standard.md`, and `premium.md` templates in `templates/tiers/` using the provided service definitions.*

### ❓ Question [2026-06-17] - Automated Internal Documentation Link Integrity
**Context:** The requirements state "Persona and Skill Contracts are Mandatory" and Section 3 mandates "Contract and Generator Drift Must Fail Fast," but the codebase in `scripts/audit-repo.js` entirely skips the `mcp-protocols/` directory and lacks any verification for internal file paths.
**Ambiguity / Drift:** Many agent personas reference reusable skills using the `**Skill:** [path/to/skill]` pattern, and `REQUIREMENTS.md` Section 1 references multiple assessment kit files. There is no automated verification that these internal file paths are valid. As files are renamed or moved, these references become broken links, leading to "Execution Drift" where an agent cannot find its required logic.
**Question for Product Owner:** Should Jules implement a referential integrity check in `scripts/audit-repo.js` that validates all internal markdown links and skill paths across the repository?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a referential integrity audit to `scripts/audit-repo.js` that verifies all internal markdown links (`[text](path/to/file.md)`) and skill references (`**Skill:** [path/to/skill]`) point to existing files.*

### ❓ Question [2026-06-18] - E2E Smoke Test Docker Mandatory Check
**Context:** The requirements in `REQUIREMENTS.md` Section 9 state "The Docker e2e suite must skip cleanly when Docker is unavailable", but the codebase in `tests/e2e/docker-smoke.test.js` implements this as a silent skip.
**Ambiguity / Drift:** In CI/CD pipelines, a silent skip can lead to a "false green" where critical runtime checks are never actually executed because the runner lacks Docker or has a configuration error. This masks environmental gaps that would be fatal in production.
**Question for Product Owner:** Should the E2E suite be updated to require an explicit flag (e.g., `FORCE_DOCKER_SMOKE=true`) that, when set, causes the test to FAIL if Docker is missing, while preserving the "clean skip" behavior for local development?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/e2e/docker-smoke.test.js` to implement an optional mandatory mode that fails if Docker is missing when `FORCE_DOCKER_SMOKE` is true.*

### ❓ Question [2026-06-17] - Substantive Content Baseline for Agents
**Context:** The requirements state "Persona and Skill Contracts are Mandatory", but a whole-codebase audit revealed that 100% of agent personas use identical boilerplate text for the `Refusal Criteria` and `Data Inventory` sections.
**Ambiguity / Drift:** While structurally compliant, the repository is in substantive drift from the 4D Description (D2) and Refusal Principle mandates. Agents lack role-specific data and safety-gating logic, creating a false sense of production readiness.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to replace these boilerplate placeholders with role-specific substantive content across all 22+ agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a fleet-wide substantive remediation of all agent personas in `agents/`, replacing boilerplate `Data Inventory` and `Refusal Criteria` with role-specific, technically accurate content.*

### ❓ Question [2026-06-18] - Substantive Remediation of Skill "TBD" Placeholders
**Context:** The requirements state "Persona and Skill Contracts are Mandatory", but the codebase in `skills/` currently contains "TBD" placeholders for 100% of the active reusable skills in mandatory sections like `Data Inventory` and `Refusal Criteria`.
**Ambiguity / Drift:** The skill library passes structural audits but is substantively safety-deficient, failing the 4D framework's "Description" (D2) mandate. This creates a risk where agents depend on "hollow" skills for critical logic.
**Question for Product Owner:** Should Jules perform a bulk substantive remediation to replace these "TBD" placeholders with technically grounded defaults based on each skill's documented `Procedure`, or should this wait for manual domain-specific input?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk substantive remediation of the `skills/` directory, replacing "TBD" placeholders with technically grounded defaults based on each skill's documented Procedure.*
