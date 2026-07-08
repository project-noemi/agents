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
- [2026-07-08] Closed as overtaken by events: Q [2026-06-10] Empty Tier Templates Implementation Gap and Q [2026-06-15] Service Tier Template Specifications — `templates/tiers/basic.md`, `standard.md`, and `premium.md` shipped with substantive content in commit `9c19548` (2026-07-05), so neither the authorization nor the service definitions are still needed. See Decision [2026-07-08-0001]. The two duplicate questions re-added to this file by the direct-to-main PR #273 (TBD placeholder rejection; Agent Index regex) were not re-imported during the 2026-07-08 sync-down because they restate approved Decisions [2026-06-19-0005] and [2026-06-19-0012] — see Decision [2026-07-08-0002].

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

### ❓ Question [2026-06-17] - Substantive Content Baseline for Agents
**Context:** The requirements state "Persona and Skill Contracts are Mandatory", but a whole-codebase audit revealed that 100% of agent personas use identical boilerplate text for the `Refusal Criteria` and `Data Inventory` sections.
**Ambiguity / Drift:** While structurally compliant, the repository is in substantive drift from the 4D Description (D2) and Refusal Principle mandates. Agents lack role-specific data and safety-gating logic, creating a false sense of production readiness.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to replace these boilerplate placeholders with role-specific substantive content across all 22+ agent personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a fleet-wide substantive remediation of all agent personas in `agents/`, replacing boilerplate `Data Inventory` and `Refusal Criteria` with role-specific, technically accurate content.*

### ❓ Question [2026-06-19] - Resilience Helper Persona Integration
**Context:** `REQUIREMENTS.md` identifies a "Resilience Helper Integration Gap" where `scripts/resilience_helpers.js` is not utilized by any agent personas, despite a mandate for resilience in agentic systems.
**Ambiguity / Drift:** Network-bound agents like `Gatekeeper` and `Client Onboarding` remain susceptible to transient failures because their specifications do not explicitly mandate retry-with-backoff logic for tool interactions.
**Question for Product Owner:** Should we authorize Jules to perform a bulk update to all network-bound agent personas to include `withRetry` logic in their `Workflow` and `External Tooling Dependencies` sections?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Integrate the `withRetry` resilience pattern into the `Workflow` and `External Tooling Dependencies` of all network-bound agent personas in `agents/`.*

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

### ❓ Question [2026-07-05] - Automation Branch Flow Under the develop-only Merge Gate
**Context:** Decision [2026-07-03-0001] narrows `.github/workflows/require-develop-source.yml` so that `develop` is the **only** valid PR source into `main`, removing the six accreted `doc-*` wildcard exceptions. Governed automation, however, runs on `claude/*` session branches and `sync/upstream-*` branches (Decision [2026-06-30-0001]) and historically opened PRs directly against `main`.
**Ambiguity / Drift:** Requirement §7 documents branch-protection enforcement but not the develop-only invariant or how automation branches integrate with it. The automation prompts (`docs/DEV_AGENT_PROMPT.md`, `docs/SYNC_AGENT_PROMPT.md`, and the Doc routine) do not state that automation PRs must target `develop`, so scheduled runs risk producing PRs that fail the gate by design.
**Question for Product Owner:** Should Requirement §7 and the automation prompt documents be updated to codify that all automation PRs target `develop` (reaching `main` only via a `develop → main` release PR), and is a periodic `develop → main` release cadence the responsibility of a human or a scheduled routine?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `REQUIREMENTS.md` §7 and the automation prompt docs (`DEV_AGENT_PROMPT.md`, `SYNC_AGENT_PROMPT.md`) to codify the develop-only merge invariant from Decision [2026-07-03-0001] for all automation PRs.*

### ❓ Question [2026-07-05] - Red Team Test Vector Canonical Format Conflict
**Context:** Decision [2026-06-12-0003] mandated (and the repository now ships) `examples/red-team-gauntlet/test-vectors.yaml` with a flat `vectors:` list, but the later Decision [2026-06-19-0008] mandates a single `test-vectors.json` with a different top-level shape (`{ "prompt_injection": [...], "pii_patterns": [...] }`). The backlog reconciliation (Decision [2026-07-05-0001]) noted the discrepancy parenthetically but left the format question unresolved.
**Ambiguity / Drift:** Two logged decisions prescribe conflicting formats for the same contract artifact, and the implemented file matches the earlier decision. An automated onboarding validation runner built against Decision [2026-06-19-0008] would fail to find `test-vectors.json`, while one built against the shipped YAML contradicts the most recent durable decision.
**Question for Product Owner:** Which format is canonical for the Red Team Gauntlet contract artifact — the shipped `test-vectors.yaml` (flat list, per [2026-06-12-0003]) or the decided `test-vectors.json` (categorized object, per [2026-06-19-0008])? The superseded decision should be annotated in the DECISION_LOG.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Reconcile the Red Team Gauntlet vector format: either convert `test-vectors.yaml` to the categorized `test-vectors.json` shape mandated by Decision [2026-06-19-0008] and update the Client Onboarding persona references, or annotate [2026-06-19-0008] as superseded by the shipped YAML implementation.*

### ❓ Question [2026-07-05] - ROI Auditor Baseline Access Decision Conflict
**Context:** Decision [2026-06-12-0001] resolves the ROI Auditor baseline-data question with "read-only Google Sheets range; no local JSON shadow copy is added to the repository". The later Decision [2026-06-19-0015] resolves the same question the opposite way: "read from a local `tools/roi/baseline-config.json` checked into the repository". The backlog reconciliation (Decision [2026-07-05-0001]) closed the original question citing only [2026-06-19-0015]. Neither decision is implemented — `tools/roi/` contains no `baseline-config.json` and the `ROI Auditor` persona declares no `read_rows` capability.
**Ambiguity / Drift:** The decision log contains two contradictory durable answers to the same question. Any implementation pass (or downstream agent following the log) cannot determine which architecture to build, and the `ROI Auditor` persona remains unable to fulfil its correlation mission either way.
**Question for Product Owner:** Which decision is canonical for ROI baseline data access — the live read-only Google Sheets range ([2026-06-12-0001]) or the committed `baseline-config.json` snapshot ([2026-06-19-0015])? The superseded entry should be annotated in the DECISION_LOG.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the confirmed ROI baseline access pattern (either the `read_rows` Google Sheets capability in the ROI Auditor persona, or `tools/roi/baseline-config.json` plus an export script) and annotate the superseded decision in `docs/DECISION_LOG.md`.*

### ❓ Question [2026-07-08] - Merge Gate Wildcard Regression ("CI Deadlock" Fix vs. develop-only Invariant)
**Context:** The requirements and Decision [2026-07-03-0001] state that `develop` is the only valid PR source into `main` and that the `doc-*` wildcard exceptions were removed from `.github/workflows/require-develop-source.yml` ("never a broad `doc-*` wildcard"), but the codebase on `main` re-added a `^doc-requirements-uplift-` exception in commit `a0a7fad` (2026-07-07, "Fix CI deadlock by allowing doc-requirements-uplift branches to target main"). The workflow's own inline comment still describes the strict develop-only behavior its code no longer enforces.
**Ambiguity / Drift:** PR #273 merged directly into `main` through the re-added exception, immediately reproducing the failure mode the decision was written to eliminate: `main` diverged from `develop` (4 commits), and the direct-to-main doc-uplift run left `main` carrying eleven clarification questions the develop line does not — nine already closed on develop via the [2026-06-19] and [2026-07-05] decision series, plus two newly added duplicates of approved decisions. The governance record and the enforcing code now contradict each other, and each future doc-uplift run on `main` re-forks the documentation set.
**Question for Product Owner:** Should the `^doc-requirements-uplift-` exception be removed from the gate and the Jules doc-uplift automation repointed to open PRs against `develop` (per Decision [2026-07-03-0001] and the pending prompt updates in PR #275), or should Decision [2026-07-03-0001] be formally amended to allow this one documented exception — accepting the recurring `main`/`develop` doc fork it causes?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Remove the `^doc-requirements-uplift-` exception from `.github/workflows/require-develop-source.yml`, restore the strict develop-only check, and update the doc-uplift automation configuration so its PRs target `develop`.*

### ❓ Question [2026-07-08] - Dual Doc-Maintenance Automations Producing Forked Documentation Truth
**Context:** Two independent scheduled automations now maintain the same governed files (`docs/REQUIREMENTS.md`, `docs/CLARIFICATIONS.md`, `docs/DECISION_LOG.md`): the Jules doc-uplift bot (branches `doc-requirements-uplift-*`, PRs to `main` — e.g., PRs #250, #252, #273) and the Claude Doc routine (branches `doc/*` and `claude/*`, PRs to `develop` — e.g., PR #275). On 2026-07-06/07 both ran within a day of each other against different base branches.
**Ambiguity / Drift:** Each automation audits a branch the other does not update, so they reach conflicting conclusions about the same repository state: PR #273 (on `main`) re-added questions as "new" that the develop line had already resolved with recorded decisions, while PR #275 (on `develop`) resolves questions `main` still lists as open. Every dual run creates reconciliation work (this run's sync-down merge; the earlier #248/#255 cycle) and risks a decision being recorded twice with different outcomes — the exact failure documented in the Red Team vector and ROI Auditor decision-conflict clarifications.
**Question for Product Owner:** Should documentation maintenance be consolidated into a single scheduled pipeline with one integration branch (`develop`), retiring or repointing the Jules doc-uplift bot, or should both automations continue with an explicit ownership split (e.g., Jules owns `REQUIREMENTS.md` refinement, Claude owns clarification/decision lifecycle) and a mandatory pre-run branch-sync step?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Consolidate documentation automation per the confirmed model: repoint or retire the duplicate doc-uplift pipeline, document the surviving pipeline's branch flow in `docs/DEV_AGENT_PROMPT.md`, and add the pre-run sync requirement to the routine prompt(s).*
