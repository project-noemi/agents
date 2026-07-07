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
- [2026-07-07] Four answerable clarifications resolved via Decisions `[2026-07-07-0001]` through `[2026-07-07-0004]`: Resilience Helper Persona Integration (incremental opt-in reference pattern), Automation Branch Flow (Requirement §7 codifies the develop-only invariant, both automation prompts updated), Red Team Vector Format (shipped YAML wins; `[2026-06-19-0008]` annotated as superseded), and ROI Auditor Baseline Access (committed JSON snapshot wins; `[2026-06-12-0001]` annotated as superseded). Backlog shrinks from 19 to 15 open questions; the remaining backlog is dominated by the PO-deferred substantive-remediation and tier-template families ([2026-06-19-0009], [2026-06-19-0010], [2026-06-19-0013]) plus the four genuine Executive Assistant / Sovereign JSON / Sovereign Model governance questions.

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

### ❓ Question [2026-06-20] - Executive Assistant "Learning Agent" Resolution Path
**Context:** The `Executive Assistant` reference implementation in `tools/executive-assistant/server.js` includes an `/api/resolution` endpoint that claims to be processed by a "Learning Agent" and updates internal execution logs with "Historical messages passed".
**Ambiguity / Drift:** This "Learning Agent" and the human-in-the-loop resolution pattern are not defined in `REQUIREMENTS.md` or any agent persona. This suggests a feature drift where the implementation introduces a feedback loop that isn't governed by the requirements.
**Question for Product Owner:** Is the "Learning Agent" resolution path a core architectural requirement for NoéMI reference services, and if so, should it be formalized in `REQUIREMENTS.md` and supported by a dedicated agent persona?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Document the "Learning Agent" resolution pattern in `REQUIREMENTS.md` and create a dedicated persona specification in `agents/operations/learning-agent.md` that governs how agents should learn from human resolutions.*

### ❓ Question [2026-06-22] - Executive Assistant Admin API Formalization
**Context:** The requirements state that agents and reference services must adhere to strict observability and security standards, but the codebase in `tools/executive-assistant/server.js` implements several undocumented admin endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`).
**Ambiguity / Drift:** These endpoints provide direct access to internal agent state and configuration without any documented authentication or authorization requirement in `REQUIREMENTS.md`. This creates a "shadow" management surface that isn't governed by the project's security baseline.
**Question for Product Owner:** Should these admin endpoints be formalized in the requirements as a standard "Agent Control Plane" and secured via the reference identity layer (Casdoor), or should they be removed from the public reference implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Formalize the Agent Control Plane API requirements in `REQUIREMENTS.md` and implement JWT-based authorization for all `/api/` endpoints in the `executive-assistant` tool.*

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

