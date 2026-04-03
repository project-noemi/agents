# Pending Clarifications

This file now tracks only active, unresolved questions that still require product-owner input or an external artifact.

## Current Status

- There are no open product clarifications blocking the repository at this time.
- Durable answers from the March-April 2026 clarification backlog were normalized into [DECISION_LOG.md](DECISION_LOG.md), especially the entries dated `2026-04-02`.
- Questions that were superseded by implemented repo changes were closed as overtaken by events and removed from the active backlog.

## Operational Follow-Up

- Replace the placeholder ROI calculator reference in [tools/roi/README.md](../tools/roi/README.md) once the public Google Sheets template URL is available.

### ❓ Question [2026-04-02] - ROI Google Sheets Template URL
**Context:** The ROI Auditor documentation and `tools/roi/README.md` both refer to a central Google Sheets ROI Calculator. Currently, there is a placeholder link in `tools/roi/README.md`.
**Ambiguity / Drift:** The project cannot deliver a verifiable "ROI modeling" capability without the specific template for the calculator.
**Question for Product Owner:** Is the public Google Sheets template URL available? If not, what is the ETA or should we provide a mock schema for now?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update tools/roi/README.md to replace "[Link Placeholder for ROI Calculator Template]" with the verified URL.*

### ❓ Question [2026-04-02] - `logging-mcp` Implementation Scope
**Context:** The requirements now define `logging-mcp` as a dual-backend protocol (Loki/Grafana and n8n webhooks).
**Ambiguity / Drift:** The protocol is currently documented in `mcp-protocols/logging-mcp.md` but is missing from `mcp.config.json` and does not have a reference implementation in `scripts/`.
**Question for Product Owner:** Should the `logging-mcp` be added to the default `mcp.config.json` immediately, or should it remain a reference documentation pattern until a specific runtime environment is ready?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update mcp.config.json to include "logging-mcp" in the active_mcps list and ensure context generators inject it correctly.*

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

