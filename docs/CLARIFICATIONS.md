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
- [2026-07-10] Overtaken-by-events closure: Questions [2026-06-10] (Empty Tier Templates Implementation Gap) and [2026-06-15] (Service Tier Template Specifications) were closed because commit `9c19548` (salvaged from stale PR #254) shipped `templates/tiers/{basic,standard,premium}.md` and `operating-profiles/standard-operating-profile.md`. Verified on `develop`: all three tier templates and the standard operating profile exist, and the profile injects into generated context. See Decision [2026-07-10-0001]. Backlog shrinks from 15 to 13, then grows to 15 with two newly verified drifts (merge-gate wildcard re-accretion on `main`; ungoverned `compassion-lens.json`).
- [2026-07-10] Two same-day drift resolutions via Decisions `[2026-07-10-0002]` and `[2026-07-10-0003]`: (a) the merge-gate wildcard re-accretion on `main` is answered — the two `doc-*` wildcards are removed and the reconciling `develop → main` release PR is assigned to a scheduled weekly routine, with the initial reconciliation authored by a human this cycle to unblock the cadence; (b) the ungoverned `compassion-lens.json` is promoted to a canonical Markdown lens (`compassion-lens.md`) following the `american-dream` pattern (`.md` + `.json` companion), and the Project NoéMI Anti-Replacement rule is defined in `value-lenses/README.md` as the governing value-lens framework concept. Backlog shrinks from 15 to 13.
- [2026-07-12] Cycle result: no `Answer:` fields were filled, so the update loop was a no-op; no new questions were raised because every drift found this cycle is already tracked or decided on `develop`. The reality check verified: `value-lenses/compassion-lens.md` exists and injects (Decision [2026-07-10-0003] implemented), the tier templates and standard operating profile remain in place, and `guardian-layer/` is **compliant, not drift** — it carries the mandated LEGACY/ILLUSTRATIVE headers, a vault-reference-only `.env.example`, and the canonical Gemini 2.5 Flash pin, so the main-side bot question proposing its Node.js re-implementation should be closed as mischaracterized during reconciliation. The develop/main divergence evidence was updated in `REQUIREMENTS.md`. See Decision [2026-07-12-0001].
- [2026-07-11] Duplicate consolidation: the substantive-remediation family ([2026-04-26], [2026-05-10], [2026-06-17] for personas; [2026-05-28], [2026-05-29] for skills) restated one PO decision five times — Decision [2026-06-19-0010] defers exactly this authorization — and is consolidated into the single canonical question [2026-04-26] below, widened to cover both personas and skills. The Casdoor pair ([2026-05-02], [2026-05-22]) asked the same integration question twice and is consolidated into [2026-05-02], keeping the more specific action prompt from [2026-05-22]. No question was answered or closed — the consolidated entries still await product-owner input. See Decision [2026-07-11-0001] for the mapping. Backlog goes from 13 to 9, then to 11 with two newly verified drifts (licensing posture not codified in requirements; sync-upstream test harness outside the validation gate).

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

### ❓ Question [2026-04-26] - Substantive Content Remediation for Personas and Skills (Consolidated)
**Context:** Whole-codebase audits confirm that 100% of reusable skills and most agent personas use identical "TBD"/boilerplate text for the mandatory `Data Inventory` and `Refusal Criteria` sections. Decision [2026-06-19-0010] deferred the bulk-remediation authorization to the Product Owner and domain experts, and the question has since been restated four times without new information. This consolidated entry replaces [2026-05-10], [2026-06-17] (personas) and [2026-05-28], [2026-05-29] (skills) — see Decision [2026-07-11-0001].
**Ambiguity / Drift:** While structurally compliant (the headings exist), the fleet is in substantive drift from the 4D Description (D2) and Refusal Principle mandates. Agents and skills lack role-specific data definitions and safety-gating logic, creating a false sense of production readiness.
**Question for Product Owner:** Do you authorize a fleet-wide substantive remediation (personas and skills) using technically grounded defaults derived from each spec's documented Role/Procedure, or should remediation remain incremental, applied only when domain work touches a given spec?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a fleet-wide substantive remediation of `agents/` and `skills/`, replacing "TBD"/boilerplate `Data Inventory` and `Refusal Criteria` sections (and template-only Audit Log JSON in skills) with role-specific, technically accurate content derived from each spec's documented Role and Procedure.*

### ❓ Question [2026-05-02] - Casdoor Identity Integration Gap (Consolidated)
**Context:** `DECISION_LOG.md` and `REQUIREMENTS.md` identify Casdoor as the reference identity layer for multi-tenant fleet deployments, and `examples/fleet-deployment/docker-compose.yml` includes a Casdoor service. Decision [2026-06-19-0013] deferred the integration decision to the Product Owner. This consolidated entry replaces the duplicate [2026-05-22] — see Decision [2026-07-11-0001].
**Ambiguity / Drift:** No code in the repository (scripts, middleware, or agent personas) actually performs Casdoor token validation or user-context extraction, so the identity-layer requirement is not yet "truthful" as a reference implementation.
**Question for Product Owner:** Should Jules implement a reference `casdoor-auth` skill and/or JWT validation middleware for the reference services to make the identity layer demonstrable, or should the Casdoor references remain compose-level only?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a `skills/security/casdoor-validate.md` specification and implement basic JWT validation middleware in `examples/gatekeeper-deployment/dashboard-ingest.js`.*

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

### ❓ Question [2026-07-11] - Licensing Posture Missing from the Requirements Contract
**Context:** Commit `c3c0e82` relicensed the repository from SSPL v1 to **FSL-1.1-Apache-2.0**, and commit `7f756b6` added the Transparent Source Guarantee (`docs/TRANSPARENT_SOURCE.md`, README section, Decision [2026-07-05-0004]). However, `docs/REQUIREMENTS.md` — the self-declared "current implementation truth" — contains no mention of the license, the Fair Source registration, or the Transparent Source commitments, and `scripts/audit-repo.js` performs no check that `LICENSE` and the `package.json` `license` field stay aligned.
**Ambiguity / Drift:** The licensing posture is a first-class governance control for a public reference architecture (it determines what forks and MSP deployments may do), yet it lives only in the decision log and ancillary docs. A future contributor could change `LICENSE` or the `package.json` field without tripping any requirement or audit gate.
**Question for Product Owner:** Should the FSL-1.1-Apache-2.0 license and the Transparent Source Guarantee be codified as a numbered requirement in `REQUIREMENTS.md` (with an audit check that `LICENSE`, the `package.json` `license` field, and `docs/TRANSPARENT_SOURCE.md` remain present and consistent), or is the decision-log record sufficient?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a licensing requirement section to `docs/REQUIREMENTS.md` codifying FSL-1.1-Apache-2.0 and the Transparent Source Guarantee, and extend `scripts/audit-repo.js` to verify `LICENSE` / `package.json` license-field consistency and the presence of `docs/TRANSPARENT_SOURCE.md`.*

### ❓ Question [2026-07-11] - Sync-Upstream Test Harness Outside the Validation Gate
**Context:** Requirement §9 ("Validation Must Be Easy to Run") enumerates what `npm run validate` and `npm test` cover, and Decision [2026-06-30-0001] shipped `scripts/test-sync-upstream.sh` — an offline harness that verifies override surfacing, `--continue` resume, dry-run, and the duplicate guard for `scripts/sync-upstream.sh` with a stubbed `gh`. The harness is documented in `README.md` and `docs/UPSTREAM_SYNC.md`, but neither `package.json` scripts nor `.github/workflows/validate.yml` ever execute it.
**Ambiguity / Drift:** A governed automation script (the upstream sync that fork owners depend on) has a working regression suite that CI never runs. A regression in `sync-upstream.sh` would ship silently and only surface when a fork's scheduled sync run breaks — exactly the "false green" pattern Requirement §9 exists to prevent.
**Question for Product Owner:** Should `scripts/test-sync-upstream.sh` be wired into the canonical validation contract — e.g., a `test:sync` npm script included in `validate:full` and a CI job in `validate.yml` — or is it intentionally a manual-only, fork-owner tool kept outside the gate (in which case §9 should say so)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a `test:sync` script to `package.json` invoking `scripts/test-sync-upstream.sh`, include it in `validate:full` and as a job in `.github/workflows/validate.yml`, and update Requirement §9 to list sync-script regression coverage.*

