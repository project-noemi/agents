# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-05-28] Bulk closure: a large block of late-cycle clarifications was either resolved by Decision entries dated 2026-05-28-0001 through 2026-05-28-0006 (logging-mcp payload alignment, onboarding directory bootstrap, SecretOps reference standardization, case-insensitive heading audits, Value Lens/Operating Profile injection, and the bulk closure of clarifications overtaken by prior decisions), or recognized as restatements of already-resolved questions. See `DECISION_LOG.md` for the durable record.
- [2026-07-05] Bulk closure: 40+ late-cycle clarifications were either subsumed by prior Decisions (`2026-06-19-0001` through `2026-06-19-0016`, `2026-06-12-*`, etc.) or resolved in this PR under Decisions dated `2026-07-05-*`. See `DECISION_LOG.md` for the durable record. Remaining open items below all require CEO/Product-Owner judgment.

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
**Context:** The `Fleet Dashboard` persona (`agents/operations/fleet-dashboard.md`) previously specified a multi-tenant registry system with per-agent HMAC secrets and asynchronous verification of mutating claims. Decision [2026-06-12-0004] simplified the persona to reflect the current single-tenant reference implementation and moved multi-tenancy to "Operator Extensions."
**Ambiguity / Drift:** The persona is now truthful, but a residual question remains: should the reference stack be *expanded* to actually implement the multi-tenant registry and verification worker as a first-party feature, or should it remain in the "Operator Extensions" appendix indefinitely? Per Decision [2026-06-19-0013], this expansion is a scope question deferred to the Product Owner.
**Question for Product Owner:** Should Project NoéMI invest in materializing the multi-tenant Fleet Dashboard as a first-party reference implementation, or keep it as a documented extension pattern only?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If approved, implement the multi-tenant agent registry and asynchronous GitHub verification worker in the Fleet Dashboard reference stack.*

### ❓ Question [2026-04-26] - Substantive Persona Content Drift
**Context:** A whole-codebase audit revealed that 100% of agent personas (22/22) currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections. Decision [2026-06-12-0006] set the strategy: incremental remediation per PR. Decision [2026-06-19-0010] deferred the *bulk* remediation question to the PO because model-authored safety-critical content requires domain-expert review.
**Ambiguity / Drift:** The incremental path is running but slow. The question remains whether to authorize a bounded bulk rewrite with subsequent domain-expert review, or continue the pure per-PR remediation cadence.
**Question for Product Owner:** Should Jules be authorized to perform a fleet-wide substantive remediation (with the explicit understanding that a domain-expert review pass will follow), or should we continue the strictly incremental per-PR remediation cadence set in [2026-06-12-0006]?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If approved, perform a whole-fleet update of all agent personas in `agents/` to replace placeholder `Data Inventory` and `Refusal Criteria` sections with role-specific, technically accurate content.*

### ❓ Question [2026-05-02] - Identity Provider Implementation Gap
**Context:** `DECISION_LOG.md` and `REQUIREMENTS.md` mention Casdoor as the reference identity layer for multi-tenant fleet deployments. Decision [2026-06-12-0011] approved shipping a `skills/security/casdoor-validate.md` specification plus optional middleware sample. Decision [2026-06-19-0013] then deferred the *broader* Casdoor integration scope (expansion of the reference implementation to include first-party JWT enforcement across all admin surfaces) to the Product Owner.
**Ambiguity / Drift:** The narrow implementation is scheduled; the broader question of whether Casdoor is a *reference dependency* or a first-party enforcement layer remains open.
**Question for Product Owner:** Should Casdoor identity validation be enforced across all reference services (Executive Assistant admin API, dashboard-ingest, etc.) by default, or remain an opt-in operator extension?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If approved for default enforcement, wire Casdoor middleware into all admin API surfaces and update `.env.template` with mandatory Casdoor variables.*

### ❓ Question [2026-05-10] - Substantive Persona Remediation Strategy
**Context:** All agent personas and reusable skills currently use identical placeholder text for the `Data Inventory` and `Refusal Criteria` sections. This is the same drift tracked by Q [2026-04-26]; the two questions ask the same thing at different points in time. Both are subject to Decision [2026-06-19-0010] which defers the bulk-authorization question to the PO.
**Ambiguity / Drift:** See Q [2026-04-26].
**Question for Product Owner:** See Q [2026-04-26]. This entry is retained as a chronological marker; a single PO answer resolves both questions.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-04-26].*

### ❓ Question [2026-05-28] - Substantive Remediation of the Skill Library
**Context:** `SKILL_TEMPLATE.md` has been updated with mandatory `Data Inventory` and `Refusal Criteria` sections, but the active skills in the `skills/` directory currently contain "TBD" placeholders for these sections. This is the same drift as Q [2026-04-26] applied to the skill library instead of agent personas. Decision [2026-06-19-0010] defers the bulk-authorization question to the PO for the same reasons.
**Ambiguity / Drift:** See Q [2026-04-26].
**Question for Product Owner:** Should Jules perform a fleet-wide "substantive remediation" of the `skills/` directory to replace placeholders with role-specific, technically accurate content?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If approved, perform a bulk substantive remediation of the `skills/` directory to replace all TBD placeholders with role-specific Data Inventory, Refusal Criteria, and valid example Audit Logs.*

### ❓ Question [2026-05-29] - Skill Remediation Priority
**Context:** Restatement of Q [2026-05-28] with a different framing. Both are subject to Decision [2026-06-19-0010].
**Ambiguity / Drift:** See Q [2026-05-28].
**Question for Product Owner:** See Q [2026-05-28].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-05-28].*

### ❓ Question [2026-06-10] - Empty Tier Templates Implementation Gap
**Context:** The `Client Onboarding` agent specification references service tier templates (e.g., `basic.md`, `standard.md`) located in `templates/tiers/`. Decision [2026-05-28-0002] created the directory placeholder; Decision [2026-06-19-0009] then deferred the *content* to the Product Owner because tier definitions are commercial/product decisions, not technical defaults.
**Ambiguity / Drift:** The directory exists but has no content. The Onboarding workflow cannot demonstrate a full run without tier definitions.
**Question for Product Owner:** Please provide the service definitions (features, included MCPs/skills, limits, pricing) for the Basic, Standard, and Premium tiers so the templates can be implemented.
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Once definitions are provided, implement the starter service tier templates (`basic.md`, `standard.md`, `premium.md`) in `templates/tiers/`.*

### ❓ Question [2026-06-15] - Service Tier Template Specifications
**Context:** Restatement of Q [2026-06-10] with more direct language. Subject to Decision [2026-06-19-0009].
**Ambiguity / Drift:** See Q [2026-06-10].
**Question for Product Owner:** See Q [2026-06-10].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-06-10].*

### ❓ Question [2026-06-15] - Audit Script Placeholder Rejection Policy
**Context:** `audit-repo.js` currently performs a presence-only heading check that ignores "TBD" or hollow placeholders. Requirement §3 mandates that structural drift must fail fast, but does not explicitly cover substantive drift. Decisions [2026-06-19-0005] and [2026-06-19-0010] intentionally deferred this to the PO because turning "TBD" into a fatal error would immediately fail every currently-hollow persona and skill, breaking CI until substantive remediation lands.
**Ambiguity / Drift:** This is a policy sequencing question: can we tighten the audit gate before substantive remediation is authorized, or must the two proceed in lockstep?
**Question for Product Owner:** Should Jules turn on "TBD placeholder = fatal audit error" *now* (immediately failing CI until content is filled in), or wait until Q [2026-04-26] / Q [2026-05-28] are authorized?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If approved to turn on now, update `scripts/audit-repo.js` to treat "TBD" placeholders in mandatory sections as a fatal audit failure.*

### ❓ Question [2026-06-17] - Substantive Content Baseline for Agents
**Context:** Restatement of Q [2026-04-26] focused on the audit-gate angle rather than the remediation-cadence angle. Subject to Decision [2026-06-19-0010].
**Ambiguity / Drift:** See Q [2026-04-26].
**Question for Product Owner:** See Q [2026-04-26].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-04-26].*

### ❓ Question [2026-06-18] - Substantive Remediation of Skill "TBD" Placeholders
**Context:** Restatement of Q [2026-05-28] with a June framing. Subject to Decision [2026-06-19-0010].
**Ambiguity / Drift:** See Q [2026-05-28].
**Question for Product Owner:** See Q [2026-05-28].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-05-28].*

### ❓ Question [2026-06-20] - Executive Assistant "Learning Agent" Resolution Path
**Context:** The `Executive Assistant` reference implementation in `tools/executive-assistant/server.js` includes an `/api/resolution` endpoint that claims to be processed by a "Learning Agent" and updates internal execution logs with "Historical messages passed". This "Learning Agent" and the human-in-the-loop resolution pattern are not defined in `REQUIREMENTS.md` or any agent persona.
**Ambiguity / Drift:** This is a feature drift where the implementation introduces a novel feedback loop that isn't governed by the requirements. Formalizing it requires a product decision about whether NoéMI's reference architecture endorses in-loop learning agents as a first-class pattern.
**Question for Product Owner:** Is the "Learning Agent" resolution path a core architectural requirement for NoéMI reference services (formalize in `REQUIREMENTS.md` and add a persona), or is it an experimental feature that should be removed from the reference implementation?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If formalize: document the "Learning Agent" pattern in `REQUIREMENTS.md` and create `agents/operations/learning-agent.md`. If remove: delete the `/api/resolution` endpoint and associated Learning Agent logic from `executive-assistant/server.js`.*

### ❓ Question [2026-06-22] - Executive Assistant Admin API Formalization
**Context:** The requirements state that agents and reference services must adhere to strict observability and security standards, but `tools/executive-assistant/server.js` implements several undocumented admin endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`) that provide direct access to internal agent state and configuration without any documented authentication or authorization requirement in `REQUIREMENTS.md`.
**Ambiguity / Drift:** This creates a "shadow" management surface that isn't governed by the project's security baseline. Whether to promote these endpoints to a first-class "Agent Control Plane" or strip them from the public reference implementation is a product/security decision.
**Question for Product Owner:** Should these admin endpoints be formalized in the requirements as a standard "Agent Control Plane" and secured via the reference identity layer (Casdoor), or should they be removed from the public reference implementation entirely?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If formalize: add "Agent Control Plane" section to `REQUIREMENTS.md` and implement JWT-based authorization for all `/api/` endpoints. If remove: delete admin endpoints from `executive-assistant/server.js`.*

### ❓ Question [2026-06-22] - Learning Agent Feedback Loop Status
**Context:** Restatement of Q [2026-06-20]. Same product decision required.
**Ambiguity / Drift:** See Q [2026-06-20].
**Question for Product Owner:** See Q [2026-06-20].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-06-20].*

### ❓ Question [2026-06-22] - Audit Script Placeholder Rejection Policy (Restated)
**Context:** Restatement of Q [2026-06-15]. Subject to Decision [2026-06-19-0010].
**Ambiguity / Drift:** See Q [2026-06-15].
**Question for Product Owner:** See Q [2026-06-15].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-06-15].*

### ❓ Question [2026-07-03] - Executive Assistant Admin API Security Baseline
**Context:** Restatement of Q [2026-06-22] with a July framing focused on the security-baseline angle.
**Ambiguity / Drift:** See Q [2026-06-22].
**Question for Product Owner:** See Q [2026-06-22].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-06-22].*

### ❓ Question [2026-07-04] - Substantive Audit Gate Enforcement (TBD Rejection)
**Context:** Restatement of Q [2026-06-15]. Subject to Decision [2026-06-19-0010].
**Ambiguity / Drift:** See Q [2026-06-15].
**Question for Product Owner:** See Q [2026-06-15].
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *See Q [2026-06-15].*

### ❓ Question [2026-07-04] - Executive Assistant Learning Agent Schema Alignment
**Context:** `tools/executive-assistant/server.js` implements a "Learning Agent" loop that updates `execLogs`, but the logging schema (`event`, `details`, `actions`) drifts from the mandatory `Audit Log` schema (`task`, `inputs`, `actions`, `risks`, `result`). Refactoring the Learning Agent's log emission depends on the outcome of Q [2026-06-20] (whether the Learning Agent is a formalized pattern at all).
**Ambiguity / Drift:** Cannot align the schema without first deciding whether the pattern is being kept.
**Question for Product Owner:** Contingent on Q [2026-06-20]. If the Learning Agent is retained, should its internal logs be refactored to use the canonical 5-field Audit Log schema via `scripts/audit_logger.js`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *If retained and canonical schema is chosen, refactor the Executive Assistant "Learning Agent" loop to use the canonical Audit Log schema and emit structured JSON via `scripts/audit_logger.js`.*
