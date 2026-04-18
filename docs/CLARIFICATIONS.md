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
**🤖 Jules Action Prompt:** *Align the `logging-mcp` protocol definition with the mandatory `Audit Log` JSON shape to ensure technical consistency across the observability stack.*

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

### ❓ Question [2026-04-13] - Automated Validation for Audit Log JSON Schema
**Context:** `REQUIREMENTS.md` Section 2 mandates a specific JSON shape for Audit Logs. Currently, `scripts/audit-repo.js` only checks for the presence of the "Audit Log" heading.
**Ambiguity / Drift:** There is no technical enforcement of the actual JSON schema within the agent files, leading to potential drift where the heading exists but the content is structurally invalid.
**Question for Product Owner:** Should `scripts/audit-repo.js` be expanded to include basic JSON schema validation for the Audit Log section in all agent and skill files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Enhance `scripts/audit-repo.js` to parse and validate the JSON shape of the Audit Log section against the mandated schema.*

### ❓ Question [2026-04-20] - Node.js Version Baseline Enforcement
**Context:** `package.json`, `.nvmrc`, `.node-version`, and `.github/workflows/validate.yml` all strictly enforce Node.js version 24. However, `REQUIREMENTS.md` only states that "Node.js is the primary runtime" without specifying the version baseline.
**Ambiguity / Drift:** Builders using older LTS versions (e.g., Node 18 or 20) may encounter execution failures with repo utilities or tests that rely on Node 24 features (like the built-in test runner or `fetch`).
**Question for Product Owner:** Should the Node 24 requirement be formally added to `REQUIREMENTS.md` as the mandatory baseline for the repository?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `REQUIREMENTS.md` to explicitly specify Node.js 24 as the mandatory baseline for all repository utilities, validation scripts, and reference implementations.*

### ❓ Question [2026-04-20] - Verification Script Mode Alignment
**Context:** `scripts/verify-env.sh` and `scripts/verify-env.ps1` implement specific validation modes: `builder`, `gemini`, `claude`, `codex`, `docker`, and `n8n`. These modes are enforced in `tests/contracts.test.js`.
**Ambiguity / Drift:** `REQUIREMENTS.md` Section 9 mentions the validation gate but does not define these specific operational modes, which are critical for the onboarding workflows described in Section 10.
**Question for Product Owner:** Should the specific operational modes for environment verification be documented in `REQUIREMENTS.md` to ensure future implementations of verification scripts remain consistent?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Document the mandatory verification modes (`builder`, `gemini`, `claude`, `codex`, `docker`, `n8n`) in `REQUIREMENTS.md` Section 9.*

### ❓ Question [2026-04-20] - Mermaid Diagram Mandate for Visual Guides
**Context:** `tests/contracts.test.js` enforces that visual guides in `docs/visuals/` must contain Mermaid diagrams and be referenced in the index.
**Ambiguity / Drift:** This technical constraint ensures that architectural visuals remain "live" and editable within the repo, but it is not currently listed as a requirement in `REQUIREMENTS.md`.
**Question for Product Owner:** Should the use of Mermaid.js for all architectural diagrams be mandated in `REQUIREMENTS.md` to prevent a drift toward static image artifacts?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Add a requirement to `REQUIREMENTS.md` Section 8 stating that all architectural diagrams must be implemented using Mermaid.js within Markdown files.*
