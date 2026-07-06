# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-05-28] Bulk closure: a large block of late-cycle clarifications was either resolved by Decision entries dated 2026-05-28-0001 through 2026-05-28-0006 (logging-mcp payload alignment, onboarding directory bootstrap, SecretOps reference standardization, case-insensitive heading audits, Value Lens/Operating Profile injection, and the bulk closure of clarifications overtaken by prior decisions), or recognized as restatements of already-resolved questions. See `DECISION_LOG.md` for the durable record.
- [2026-07-05] Backlog reconciliation: fifty questions that had already been decided by the `[2026-06-19-0001]` through `[2026-06-19-0016]` decision series (shared `audit_logger.js`, sync-script parameterization, `NOEMI_DOCKER_SMOKE_*` inventory gate, Red Team vector serialization, audit-coverage scope, verify-env docker hard-fail policy, Operating Profile baseline, and the approved audit-script enhancement set) — or that duplicated still-open questions — were removed from this backlog. See Decision [2026-07-05-0001] for the full removal-to-decision mapping. Verified during removal: `scripts/audit_logger.js`, env-driven `scripts/sync-upstream.sh`, the `NOEMI_DOCKER_SMOKE_*` inventory test, and `examples/red-team-gauntlet/test-vectors.yaml` all exist in the codebase.

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
**🤖 Jules Action Prompt:** *Perform a whole-fleet update of all agent personas in `agents/` to replace placeholder `Data Inventory` and `Refusal Criteria` sections with role-specific, technically accurate content.*

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

### ❓ Question [2026-06-17] - Substantive Content Baseline for Agents
**Context:** The requirements state "Persona and Skill Contracts are Mandatory", but a whole-codebase audit revealed that 100% of agent personas use identical boilerplate text for the `Refusal Criteria` and `Data Inventory` sections.
**Ambiguity / Drift:** While structurally compliant, the repository is in substantive drift from the 4D Description (D2) and Refusal Principle mandates. Agents lack role-specific data and safety-gating logic, creating a false sense of production readiness.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to replace these boilerplate placeholders with role-specific substantive content across all 22+ agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a fleet-wide substantive remediation of all agent personas in `agents/`, replacing boilerplate `Data Inventory` and `Refusal Criteria` with role-specific, technically accurate content.*

### ❓ Question [2026-06-18] - E2E Smoke Test Docker Mandatory Check
**Context:** The requirements in `REQUIREMENTS.md` Section 9 state "The Docker e2e suite must skip cleanly when Docker is unavailable", but the codebase in `tests/e2e/docker-smoke.test.js` implements this as a silent skip.
**Ambiguity / Drift:** In CI/CD pipelines, a silent skip can lead to a "false green" where critical runtime checks are never actually executed because the runner lacks Docker or has a configuration error. This masks environmental gaps that would be fatal in production.
**Question for Product Owner:** Should the E2E suite be updated to require an explicit flag (e.g., `FORCE_DOCKER_SMOKE=true`) that, when set, causes the test to FAIL if Docker is missing, while preserving the "clean skip" behavior for local development?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tests/e2e/docker-smoke.test.js` to implement an optional mandatory mode that fails if Docker is missing when `FORCE_DOCKER_SMOKE` is true.*

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

### ❓ Question [2026-06-22] - Executive Assistant Admin API Formalization
**Context:** The requirements state that agents and reference services must adhere to strict observability and security standards, but the codebase in `tools/executive-assistant/server.js` implements several undocumented admin endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`).
**Ambiguity / Drift:** These endpoints provide direct access to internal agent state and configuration without any documented authentication or authorization requirement in `REQUIREMENTS.md`. This creates a "shadow" management surface that isn't governed by the project's security baseline.
**Question for Product Owner:** Should these admin endpoints be formalized in the requirements as a standard "Agent Control Plane" and secured via the reference identity layer (Casdoor), or should they be removed from the public reference implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Formalize the Agent Control Plane API requirements in `REQUIREMENTS.md` and implement JWT-based authorization for all `/api/` endpoints in the `executive-assistant` tool.*

### ❓ Question [2026-06-27] - Generator Fail-Fast Policy for Framework Assets
**Context:** `REQUIREMENTS.md` Section 3 mandates "Contract and Generator Drift Must Fail Fast," but the codebase in `scripts/generate_all.js` (via `context_helpers.js`) implements a "silent success" pattern where missing framework directories or empty assets return HTML comments rather than an exit 1.
**Ambiguity / Drift:** This allows for "hollow" context files to be generated and shipped without surfacing the structural gap, potentially leading to agents operating without mandated framework layers (Value Lenses/Operating Profiles) in production-like environments.
**Question for Product Owner:** Should the generator be updated to enforce a fatal error (exit 1) if any mandated framework asset directory is missing or contains no operational files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/generate_all.js` and `scripts/context_helpers.js` to enforce a fatal error if mandated framework assets or active skills/MCPs are missing during context generation.*

### ❓ Question [2026-07-03] - Generator Fail-Fast Enforcement for Skills/MCPs
**Context:** `scripts/generate_all.js` currently allows "silent success" (exit 0) when skills or MCP protocols defined in `mcp.config.json` are missing from the filesystem, injecting a warning comment into the generated markdown instead.
**Ambiguity / Drift:** This violates the "Fail Fast" mandate in Requirement §3. It allows agents to be deployed with "broken" workflows because they are missing the specific skills or tools they expect to have available.
**Question for Product Owner:** Should the generator be updated to enforce a fatal error (exit 1) if any active skill or MCP protocol specified in the configuration is missing during generation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/generate_all.js` to enforce a fatal error (exit 1) if any active skill or MCP protocol defined in `mcp.config.json` is missing from the filesystem.*

### ❓ Question [2026-07-04] - ESM Migration vs. Dual-Export for Shared Utilities
**Context:** The `Executive Assistant` tool (`tools/executive-assistant/`) and modern reference services use Node.js ESM (`"type": "module"`), but shared repository utilities like `scripts/resilience_helpers.js` use CommonJS. This prevents direct code reuse and integration of mandated resilience patterns.
**Ambiguity / Drift:** We have a mismatch between the Node 24 ESM baseline for services and the legacy CJS baseline for scripts.
**Question for Product Owner:** Should Jules perform a wholesale migration of the `scripts/` directory to ESM to align with the Node 24 baseline, or should we implement a dual-export strategy (CJS/ESM) for shared utilities?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Migrate all shared Node.js utilities in `scripts/` to ESM to ensure seamless integration with modern reference services and tools.*

### ❓ Question [2026-07-05] - Sovereign JSON Asset Layer Governance ("Great AI Pivot")
**Context:** The requirements state "Persona and Skill Contracts are Mandatory" (§2) and mandate audit/generation alignment (§3, §4), but commit `64f5a09` ("The Great AI Pivot") introduced four framework assets as **JSON files** that the Markdown-only pipeline cannot see: `agents/guardian/jailbreak-monitor-agent.json`, `skills/model-fusion-consensus/definition.json`, `mcp-protocols/local-inference-mcp.json`, and `operating-profiles/local-sovereign-profile.json`. `scripts/context_helpers.js` filters on `.endsWith('.md')`, and `scripts/audit-repo.js` audits only Markdown personas/skills.
**Ambiguity / Drift:** A Guardian agent, a skill, and an MCP protocol now exist with zero structural audit, no Refusal Criteria/Audit Log contract enforcement, no Agent Index entry, and no injection into `GEMINI.md`/`CLAUDE.md`. `docs/SOVEREIGN_LLM_GUIDELINES.md` documents this sovereign path but is referenced nowhere in `REQUIREMENTS.md`. The repository effectively has a second, ungoverned specification format.
**Question for Product Owner:** Should the sovereign JSON assets be converted to the canonical Markdown persona/skill/protocol contracts (keeping JSON only as machine-readable companions), or should a parallel JSON specification contract be formalized in `REQUIREMENTS.md` with matching audit (JSON schema) and generator support?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Bring the four sovereign JSON assets from commit `64f5a09` under governance: either convert them to canonical Markdown contract files or extend `scripts/audit-repo.js` and `scripts/context_helpers.js` to audit and inject JSON specifications, and reference `docs/SOVEREIGN_LLM_GUIDELINES.md` from `REQUIREMENTS.md`.*

### ❓ Question [2026-07-05] - Sovereign Model Pins vs. Canonical AI Model Baseline
**Context:** The requirements state the AI Model Baseline is **Gemini 2.5 Flash** (`models/gemini-2.5-flash`) as "the canonical baseline for predictable performance and cost," but `operating-profiles/local-sovereign-profile.json` pins `deepseek-coder:67b-instruct` (primary) and `llama3.3:70b-instruct` (fallback) routed through a local inference gateway.
**Ambiguity / Drift:** The single-baseline requirement and the sovereign profile contradict each other: an operating profile that pins non-baseline models is either a violation of the baseline mandate or evidence that the mandate needs a dual-track (proprietary vs. sovereign/local) formulation. The approved audit check for non-baseline model pins (Decision [2026-06-19-0012]) would flag these files as drift once implemented.
**Question for Product Owner:** Should `REQUIREMENTS.md` formalize a dual-track model baseline — Gemini 2.5 Flash for proprietary/cloud reference workflows and a named local model set for the sovereign path — or should the sovereign profile be treated as a non-baseline exception that the model-pin audit must explicitly allowlist?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update the AI Model Baseline section of `REQUIREMENTS.md` to define the approved sovereign/local model track (or an explicit exception list) and align the planned non-baseline model-pin audit in `scripts/audit-repo.js` with it.*

### ❓ Question [2026-07-05] - Automation Branch Flow Under the develop-only Merge Gate
**Context:** Decision [2026-07-03-0001] narrows `.github/workflows/require-develop-source.yml` so that `develop` is the **only** valid PR source into `main`, removing the six accreted `doc-*` wildcard exceptions. Governed automation, however, runs on `claude/*` session branches and `sync/upstream-*` branches (Decision [2026-06-30-0001]) and historically opened PRs directly against `main`.
**Ambiguity / Drift:** Requirement §7 documents branch-protection enforcement but not the develop-only invariant or how automation branches integrate with it. The automation prompts (`docs/DEV_AGENT_PROMPT.md`, `docs/SYNC_AGENT_PROMPT.md`, and the Doc routine) do not state that automation PRs must target `develop`, so scheduled runs risk producing PRs that fail the gate by design.
**Question for Product Owner:** Should Requirement §7 and the automation prompt documents be updated to codify that all automation PRs target `develop` (reaching `main` only via a `develop → main` release PR), and is a periodic `develop → main` release cadence the responsibility of a human or a scheduled routine?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `REQUIREMENTS.md` §7 and the automation prompt docs (`DEV_AGENT_PROMPT.md`, `SYNC_AGENT_PROMPT.md`) to codify the develop-only merge invariant from Decision [2026-07-03-0001] for all automation PRs.*

### ❓ Question [2026-07-05] - Executive Assistant Admin API Security Baseline
**Context:** The `Executive Assistant` tool (`tools/executive-assistant/server.js`) exposes several unauthenticated admin endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`) and a "Learning Agent" feedback loop (`/api/resolution`).
**Ambiguity / Drift:** These endpoints provide direct access to internal state and rule-mutation capabilities without adhering to the project's Phase 0 Security Baseline (SecretOps, JWT-based identity). This creates a "shadow" control surface that bypasses mandated governance.
**Question for Product Owner:** Should these admin endpoints be formalized in the requirements as a standard "Agent Control Plane" and secured via the reference identity layer (Casdoor), or should they be removed to align with the core security baseline?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Formalize the Agent Control Plane requirements in `REQUIREMENTS.md` and implement JWT-based authorization for all `/api/` endpoints in the `executive-assistant` tool.*

### ❓ Question [2026-07-05] - Sovereign JSON Asset Specification Governance
**Context:** The "Great AI Pivot" (commit `64f5a09`) introduced several framework assets as JSON files (e.g., `agents/guardian/jailbreak-monitor-agent.json`). The current audit (`audit-repo.js`) and generation (`generate_all.js`) pipelines only recognize Markdown (`.md`) files.
**Ambiguity / Drift:** These assets exist outside the structural contracts (Refusal Criteria, Audit Log) and are never injected into the generated context (`GEMINI.md`, `CLAUDE.md`). This creates a parallel, ungoverned specification format that is invisible to the primary AI context.
**Question for Product Owner:** Should sovereign JSON assets be converted to canonical Markdown specifications (using JSON only for machine-readable sidecars), or should the repository formalize a parallel JSON specification contract with full audit and generator support?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Bring sovereign JSON assets under governance by either converting them to Markdown or extending `scripts/audit-repo.js` and `scripts/context_helpers.js` to support JSON specifications.*
