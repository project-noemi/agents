# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- [2026-04-03] Resolved ROI Google Sheets Template URL (URL confirmed in `tools/roi/README.md`) and `logging-mcp` configuration scope (remains reference-only, not added to `mcp.config.json`).
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.
- [2026-04-04] Resolved Node.js Resilience Helper scope (mandate satisfied by reference pattern; core scripts do not need retry for local filesystem ops) and Legacy Example Labeling (bulk update completed — LEGACY/ILLUSTRATIVE headers added to all Python and Bash examples).
- [2026-05-28] Bulk closure: a large block of late-cycle clarifications was either resolved by Decision entries dated 2026-05-28-0001 through 2026-05-28-0006 (logging-mcp payload alignment, onboarding directory bootstrap, SecretOps reference standardization, case-insensitive heading audits, Value Lens/Operating Profile injection, and the bulk closure of clarifications overtaken by prior decisions), or recognized as restatements of already-resolved questions. See `DECISION_LOG.md` for the durable record.
- [2026-06-16] Bulk closure: the April-June clarification backlog was normalized into Decision entries 2026-06-16-0001 through 2026-06-16-0017 covering ROI baseline access, Fleet Dashboard retention and multi-tenancy, Red Team vector serialization, substantive remediation strategy, audit-script enforcement sweep, journal section policy, agent index extraction, audit-log prefix, shared `audit_logger.js`, verify-env docker-mode enforcement, sync-upstream parameterization, smoke-test variable validation, generator-script consolidation, Casdoor scope, RFP-split renaming, and the API-path verification sweep. See `DECISION_LOG.md` for the durable record. The questions below remain because they require external input (specific service-tier definitions) or product-owner judgment that cannot be inferred from the codebase.

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

### ❓ Question [2026-06-15] - Service Tier Template Specifications
**Context:** The requirements state the Client Onboarding agent references service tier templates in `templates/tiers/`, but the codebase in that directory implements only a placeholder README.
**Ambiguity / Drift:** Without these templates, the onboarding workflow cannot be demonstrated or executed, leaving the "Explorer" path blocked. This requires external input: the specific commercial definitions (features, limits, pricing) for the Basic, Standard, and Premium tiers cannot be inferred from the codebase or from general technical knowledge — they are a business-positioning decision.
**Question for Product Owner:** Can you provide the specific service definitions (features, limits, pricing) for the Basic, Standard, and Premium tiers so Jules can implement the missing templates?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Implement the `basic.md`, `standard.md`, and `premium.md` templates in `templates/tiers/` using the provided service definitions.*
