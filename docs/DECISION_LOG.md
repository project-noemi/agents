# Decision Log

## [2026-04-02] Docker Image and Compose Version Update

- **Decision:** Bump `pgvector` and `Casdoor` image tags to their current versions, correct repository names, and remove the obsolete `version` attribute from `docker-compose.yml` files.
- **Context:** The Docker Smoke Validation CI suite failed due to "manifest unknown" for `ankane/pgvector:v0.8.x` tags and "pull access denied" for the `casdoor/casdoor` repository. CI logs also warned about the obsolete `version` attribute.
- **Impact:**
  - Updated `pgvector` to `ankane/pgvector:latest` due to inconsistent upstream tag manifesting.
  - Corrected Casdoor to `casbin/casdoor:2.377.0` (official repository).
  - Removed `version: "3.8"` from example compose files to align with modern Docker Compose specifications (Compose V2).

## [2026-04-02] Verified Codebase Realignment

- **Decision:** Align repository requirements with the verified codebase state regarding environment keys, MCP protocols, and documentation mirroring.
- **Context:** An audit of the codebase revealed several inconsistencies between implemented features (e.g., `gatekeeper-deployment`) and the core documentation/environment templates.
- **Impact:**
  - Updated `.env.template` to include mandatory InfluxDB and HMAC keys for Gatekeeper and Fleet deployments.
  - Formally documented the absence of the `logging-mcp` in `REQUIREMENTS.md`.
  - Clarified documentation mirroring expectations for `docs/agents/` to prioritize guides over individual file symlinks.
  - Verified the 4D AI Fluency Framework sequence (Delegation, Description, Discernment, Diligence) is consistent across all lifecycle documentation.

## [2026-04-02] Clarification Backlog Normalization

- **Decision:** Normalize the March-April clarification backlog by moving durable answers into the decision log and removing completed or superseded questions from the active clarification queue.
- **Context:** `docs/CLARIFICATIONS.md` had accumulated a large number of answered, duplicated, or implementation-overtaken questions, which made it harder to see what still required product-owner input.
- **Impact:**
  - Docker Compose remains the canonical deployment example path for this wave; Kubernetes manifests are deferred.
  - `docs/agents/` mirroring is interpreted at the directory and guide level, not as a mandatory 1:1 duplicated persona-file or symlink mirror.
  - The canonical persona contract remains `Role`, `Tone`, `Capabilities`, `Mission`, `Rules & Constraints`, `Boundaries`, `Workflow`, `External Tooling Dependencies`, and `Audit Log`.
  - 4D alignment is expressed through the canonical persona sections and lifecycle docs rather than by introducing dedicated D1-D4 top-level persona sections.
  - The canonical 4D sequence is D1 Delegation, D2 Description, D3 Discernment, D4 Diligence; Data Inventory belongs to Description.
  - Audit logs use the lightweight standardized JSON shape in `AGENTS.md` and `docs/AGENT_TEMPLATE.md` and must be emitted separately from the primary user-facing payload.
  - One of `infisical` or `op` is a required SecretOps dependency for credentialed execution, but the generic pre-flight check warns rather than hard-fails when the CLI is absent.
  - `dev` remains the default local environment name in shared examples and quick-start flows.
  - Gemini and Claude context generation are kept behaviorally aligned, including full global-mandate injection and Agent Index parity.
  - `github` is part of the default active MCP set; a repo-defined `logging-mcp` is not part of the current contract.
  - Identity verification is treated as an orchestrator or ingress responsibility rather than an agent-side Casdoor token contract.
  - English-first slug naming remains mandatory for exported workflows and similar artifacts.
  - Legacy Python examples remain allowed as historical references and should be migrated incrementally rather than through a blocking bulk rewrite.
  - The ROI calculator now uses a public anonymous-access Google Sheets URL in `tools/roi/README.md`.

## [2026-04-02] Balanced Reference + Implementation Alignment

- **Decision:** Treat this repository as both a public reference architecture and a truthful implementation library, and align documentation, personas, generators, and examples to that dual role.
- **Context:** `docs/PROJECT_REFERENCE.md` establishes the repository as the public reference for Project NoéMI, but several docs and examples had drifted away from that framing.
- **Impact:**
  - Phase 0 is now the explicit buyer entry point through the baseline guide and assessment kit.
  - The persona contract is standardized and enforced via `scripts/audit-repo.js`.
  - Both context generators now share helper logic, support config overrides, and inject the full `AGENTS.md` mandate set.
  - Gatekeeper reporting now uses HMAC-signed dashboard ingestion instead of posting unauthenticated line protocol directly.
  - Historical Python examples are clearly labeled as illustrative rather than recommended first paths.
  - The repository now includes a built-in Node test harness and a builder-facing Docker Agent Home guide to make validation and Docker adoption easier without reframing the repo as a runtime product.
  - Validation now has two layers: a canonical fast gate in `npm run validate` (repository audit plus `npm test`) and compose-based Docker smoke automation in `npm run test:e2e`, plus a builder onboarding walkthrough that ties the path together.
  - GitHub Actions now enforces the same audit, generation freshness, and Docker smoke validation path on pushes and pull requests targeting `develop` and `main`.

## [2026-03-03] Fetch-on-Demand and Definitions-Library Execution Model

- **Decision:** Formalize the repository as a definitions library for external orchestrators and standardize Fetch-on-Demand secret handling.
- **Context:** The project moved away from embedded runtime assumptions and needed a durable security posture for agent execution.
- **Impact:**
  - Agents rely on external orchestrators such as Gemini CLI, n8n, and LangChain.
  - Secrets must be injected at runtime via `infisical run` or `op run`.
  - Logging to `stdout` and `stderr` is treated as an orchestrator-facing contract.
  - Casdoor was selected as the reference identity layer for multi-tenant fleet deployments.

## [2026-02-21] Pivot to Standalone Agents and MCP

- **Decision:** Focus the repository on standalone agent specifications, MCP integrations, and supporting documentation.
- **Context:** Earlier directions tied too much of the project to adjacent runtime concerns.
- **Impact:**
  - The repository centers on agent personas, skills, MCP protocols, docs, and examples.
  - External tool integration is modeled through MCP protocol definitions instead of in-repo execution engines.

## [2026-02-15] Retire the WHMCS Addon Direction

- **Decision:** End development of the project as a WHMCS addon module.
- **Context:** The evolving NoéMI architecture required a broader, more portable model than a single product integration could support.
- **Impact:**
  - WHMCS-specific assumptions were removed from the core scope.
  - The project direction shifted toward a reusable agent architecture for broader organizational deployment.

## [2026-04-02] - Node.js Exponential Backoff Reference Implementation
- **Decision:** A standardized Node.js exponential backoff helper must be implemented in `scripts/resilience_helpers.js` (or equivalent) to satisfy the AGENTS.md and REQUIREMENTS.md resilience mandate. The shell `scripts/retry-with-backoff.sh` is insufficient for Node.js/Python agent runtimes.
- **Reference:** Requirements alignment — existing AGENTS.md and REQUIREMENTS.md resilience mandate.

## [2026-04-02] - ROI Auditor Logging: Dual Protocol Support
- **Decision:** The ROI Auditor must support BOTH Loki/Grafana protocol (for structured log querying) AND n8n webhook pattern (for event-driven ingestion). The `logging-mcp` protocol definition should be created to abstract both backends, allowing the ROI Auditor to ingest logs regardless of which observability stack is deployed.
- **Reference:** CEO Decision — treat both cases.

## [2026-04-03] - ROI Google Sheets Template URL — Confirmed
- **Decision:** The public Google Sheets ROI Calculator template URL is confirmed as published in `tools/roi/README.md`. The placeholder has been replaced with the live URL. No further action needed.
- **Reference:** Automated clarification resolution — URL verified at `https://docs.google.com/spreadsheets/d/1BFMzZFs9oXAdgccjq5y1A6xba-m4nVXC`.

## [2026-04-03] - logging-mcp Configuration Scope
- **Decision:** The `logging-mcp` protocol remains a reference documentation pattern in `mcp-protocols/logging-mcp.md` and is NOT added to the default `mcp.config.json` until a specific runtime environment is ready to consume it. This is consistent with the existing contract that `mcp.config.json` tracks only active, deployed MCPs.
- **Reference:** Automated clarification resolution — consistent with existing decision "a repo-defined logging-mcp is not part of the current contract."

## [2026-04-04] - Resilience Helpers: Core Script Integration Scope
- **Decision:** The `resilience_helpers.js` module satisfies the REQUIREMENTS.md resilience mandate as a reusable reference pattern for agents and external-facing tools. It should NOT be force-integrated into `audit-repo.js` or `generate_all.js`, which perform local filesystem operations that do not benefit from exponential backoff. Retry logic is appropriate for network/API calls, not deterministic local file reads.
- **Reference:** Automated clarification resolution — consistent with existing Decision [2026-04-02] "Node.js Exponential Backoff Reference Implementation" scope.

## [2026-04-04] - Legacy Example Labeling: Bulk Update Approved
- **Decision:** All non-Node.js example scripts (Python `.py` and Bash `.sh` files) in the `examples/` directory must include a top-level `LEGACY/ILLUSTRATIVE` comment header to distinguish them from the canonical Node.js implementation path. This implements the mandate added to `AGENTS.md` and satisfies REQUIREMENTS.md Section 8.
- **Reference:** Automated clarification resolution — enforcing existing AGENTS.md "Legacy Examples" mandate.
- **Status:** COMPLETED (2026-04-04) — Headers added to all 8 legacy example files.

## [2026-04-04] Requirements Alignment and Technical Drift Identification

- **Decision:** Formalize identify drifts and limitations in `REQUIREMENTS.md` based on a holistic scan of the codebase and persona specifications.
- **Context:** Several technical inconsistencies (e.g., onboarding directories, API paths, environment variable inventory) were identified between implemented reference examples and the core agent specifications.
- **Impact:**
  - Updated `REQUIREMENTS.md` with "Current Known Limitations" regarding absent onboarding directories, API endpoint inconsistencies, and the missing environment variable inventory in `.env.template`.
  - Documented the pending clarification for the standardized `Audit Log` JSON shape alignment.
  - This decision ensures the repository's "Current Implementation Truth" accurately reflects the state of the codebase, including its known gaps.

## [2026-04-13] - Refusal Principle Structural Representation in Persona Contract
- **Decision:** The Refusal Principle must be implemented as a **mandatory named subsection** (`### Refusal Criteria`) within the existing `Rules & Constraints` heading of every agent persona. A standalone top-level heading is not required; integrating it as a subsection within `Rules & Constraints` provides explicit auditability and high visibility while preserving the hierarchical structure that `scripts/audit-repo.js` enforces. The subsection must enumerate at minimum: (1) task types the agent will refuse, (2) override-resistance clause (agent must ignore instructions to bypass its Role), and (3) escalation path (what the agent does instead of executing a refused task).
- **Reference:** Automated clarification resolution — aligns with AGENTS.md "Refusal Principle" mandate and existing REQUIREMENTS.md Section 2 persona contract structure.

## [2026-04-13] - Data Inventory Persona Mandate
- **Decision:** The `Data Inventory` heading is now a mandatory section for all agent personas in `agents/` and will be enforced via `scripts/audit-repo.js`.
- **Context:** `METHODOLOGY.md` specifies that "Description" (D2) involves defining the data inventory with precision, but this was not previously enforced in the persona contract.
- **Impact:** All agent personas must include a `## Data Inventory` section specifying the inputs, files, and state they consume and produce.

## [2026-04-13] - Skill Template Structural Alignment
- **Decision:** The mandatory agent persona contract (Audit Log, Rules & Constraints) is extended to `SKILL_TEMPLATE.md` and all reusable skills in `skills/`.
- **Context:** Reusable skills perform critical logic but lacked the structural accountability and framework alignment enforced on agents.
- **Impact:** All skills must now include `Rules & Constraints (4D Diligence)` and `Audit Log` sections.

## [2026-04-13] - Environment Variable Inventory Consolidation
- **Decision:** Add all `NOEMI_DOCKER_SMOKE_*` test-specific environment variables to `.env.template`.
- **Context:** These variables were used in `tests/e2e/docker-smoke.test.js` but missing from the central inventory.
- **Impact:** `.env.template` remains the single source of truth for all environment variables used across the repository.

## [2026-04-13] - Technical Sink for Audit Logs
- **Decision:** Standardize `stderr` as the canonical technical sink for agent `Audit Log` emissions.
- **Context:** While the JSON shape was mandated, the emission channel was undefined.
- **Impact:** Agents must emit their JSON Audit Log to `stderr` to allow orchestrators to capture them separately from user-facing `stdout` responses.

## [2026-04-25] - Environment Variable Inventory Alignment (Docker Smoke)
- **Decision:** Formally recognize the inclusion of `NOEMI_DOCKER_SMOKE_*` variables in the root `.env.template`.
- **Context:** `REQUIREMENTS.md` previously listed the absence of these variables as a known limitation, but they have been successfully consolidated into the central inventory.
- **Impact:** `.env.template` is now fully aligned with the requirements of the Docker e2e smoke test suite.

## [2026-04-27] - ROI Auditor Baseline Data Access
- **Decision:** ROI Auditor baseline data (Human Baseline Time and Labor Rate dictionaries) will be supplied via a local JSON reference file at `tools/roi/baseline-config.json`. The `google-sheets` MCP retains its append-only role for execution logs; baseline lookups should not require runtime Sheets reads. The Google Sheets template in `tools/roi/README.md` remains the human-editable source for editing baselines, but a JSON snapshot is committed for deterministic agent consumption.
- **Reference:** Automated clarification resolution — separates editable source-of-truth (Sheets) from machine-consumable artifact (JSON), consistent with the Fetch-on-Demand and definitions-library posture.

## [2026-04-27] - logging-mcp and Audit Log Layering
- **Decision:** The mandated `Audit Log` JSON shape (`{ task, inputs, actions, risks, result }`) is the **payload** that lives inside the `metadata` field of the `logging-mcp` Standardized Log Shape (`{ timestamp, agent, task, status, duration_ms, metadata }`) for `success` events. The two layers are complementary: `logging-mcp` is the transport/observability envelope, the Audit Log is the content. Reference services emitting to `stderr` should emit the Audit Log JSON directly; orchestrators that ship logs through `logging-mcp` wrap that payload inside the standardized envelope.
- **Reference:** Automated clarification resolution — resolves [2026-04-04] Standardized Log Shape vs. Audit Log question.

## [2026-04-27] - Onboarding Directory Scaffolding
- **Decision:** Create `templates/tiers/` (with `basic.md`, `standard.md`, `premium.md` starter files) and `clients/` (with a `.gitignore` to keep client-specific configs out of source control by default). The `Client Onboarding` persona (`agents/operations/client-onboarding.md`) becomes truthful against the repository structure.
- **Reference:** Automated clarification resolution — closes [2026-04-04] Onboarding Directory Drift.

## [2026-04-27] - Fleet Dashboard API Path Standardization
- **Decision:** The canonical Fleet Dashboard ingest path is `/api/v1/reports`, matching the persona specification. The reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` and its `docker-compose.yml` must be updated to expose `/api/v1/reports` (the existing `/ingest` path may remain as a deprecated alias during transition). Persona specifications are the durable contract; reference implementations follow.
- **Reference:** Automated clarification resolution — closes [2026-04-04] Fleet Dashboard API Path Mismatch.

## [2026-04-27] - Value Lenses and Operating Profiles in Context Generation
- **Decision:** `scripts/generate_gemini.js` and `scripts/generate_claude.js` (via shared helpers in `scripts/context_helpers.js`) must inject `Value Lenses` and `Operating Profiles` content as **separate, named sections** in the generated context, not merged into the global mandates block. New marker tokens `<!-- VALUE_LENS_INJECTIONS -->` and `<!-- OPERATING_PROFILE_INJECTIONS -->` will be supported in the templates so the framework content can be discovered from `value-lenses/` and `operating-profiles/` and surfaced to consuming agents without diluting the mandate set.
- **Reference:** Automated clarification resolution — closes [2026-04-04] Framework Integration in Context Generators.

## [2026-04-27] - logging-mcp InfluxDB Backend Support
- **Decision:** `mcp-protocols/logging-mcp.md` must be updated to recognize InfluxDB as a third canonical backend alongside Loki/Grafana and n8n webhooks. InfluxDB is the primary time-series store in the `examples/gatekeeper-deployment/` reference stack, so the protocol must document the line-protocol ingestion pattern and Flux query pattern for it.
- **Reference:** Automated clarification resolution — closes [2026-04-05] InfluxDB Backend Support; updates Runtime and Tooling Requirements in `REQUIREMENTS.md`.

## [2026-04-27] - SecretOps Reference File Standardization
- **Decision:** `.env.template` is the **root inventory** and is the correct reference file for repository-level command wrappers documented in `AGENTS.md` and root-level scripts. `.env.example` is the **per-example inventory** and is the correct reference file for command wrappers inside `examples/<name>/` and `tools/<name>/`. Documentation in `docs/tool-usages/secure-secret-management.md` must reflect this split: pick the file scoped to the directory you are running from. This preserves the existing root vs. per-example separation rather than collapsing them.
- **Reference:** Automated clarification resolution — closes [2026-04-05] SecretOps Syntax Drift.

## [2026-04-27] - Smoke Test Coverage Expansion
- **Decision:** All subdirectories under `examples/` must be covered by at least one static smoke check in `tests/examples-smoke.test.js`. The minimum check is presence of either a `docker-compose.yml`, a runnable script, or an `.env.example`/README that declares its dependencies. `rfp-split`, `gmu-validation`, and `secure-secret-management` are added to the explicit coverage list. This satisfies REQUIREMENTS.md Section 9.
- **Reference:** Automated clarification resolution — closes [2026-04-05] Incomplete Example Smoke Test Coverage.

## [2026-04-27] - Fleet Dashboard Retention Policy
- **Decision:** Persona specification (90-day detailed retention, 1-year aggregate retention) is the durable contract. The reference implementation in `examples/gatekeeper-deployment/docker-compose.yml` must be extended with a second InfluxDB bucket (`agent_summaries`) at 365-day retention plus an InfluxDB downsampling task. Single-bucket configurations are interim and should not be normalized into the persona.
- **Reference:** Automated clarification resolution — closes [2026-04-05] Fleet Dashboard Retention Policy Drift.

## [2026-04-27] - Red Team Gauntlet Starter Vectors
- **Decision:** The `examples/red-team-gauntlet/` directory must include a starter `test-vectors.yaml` with at minimum the 5 cases referenced by the `Client Onboarding` validation workflow (covering prompt injection, jailbreak, PII leakage, role-override, and out-of-scope task patterns). This makes the persona's mandated workflow runnable against the repository as published.
- **Reference:** Automated clarification resolution — closes [2026-04-05] Red Team Gauntlet Test Vector Absence and [2026-04-26] Reference Asset Absence (red-team-gauntlet portion).

## [2026-04-27] - Reference Service Audit Log Compliance
- **Decision:** Reference implementation services that perform agent-like work (notably `examples/gatekeeper-deployment/dashboard-ingest.js`) must emit the mandated Audit Log JSON shape to `stderr` for each accepted and rejected ingestion. Reference services are exemplars of the persona contract and must obey the same observability rules; the audit log requirement is not limited to in-`agents/` personas.
- **Reference:** Automated clarification resolution — closes [2026-04-05] Reference Service Audit Log Compliance and [2026-05-01] Audit Log Emission to Stderr in Reference Services.

## [2026-04-27] - Fleet Dashboard Multi-tenancy Phasing
- **Decision:** The `Fleet Dashboard` persona specification (multi-tenant registry, per-agent HMAC secrets, asynchronous verification of mutating claims) is preserved as the durable contract. The reference implementation will be expanded incrementally — registry and HMAC-per-agent first, asynchronous GitHub verification worker second — rather than simplifying the persona to match the current single-agent sink. The persona is intentionally aspirational so the reference architecture can evolve toward it without doc rewrites at every step.
- **Reference:** Automated clarification resolution — closes [2026-04-05] Fleet Dashboard Multi-tenancy Implementation Gap.

## [2026-04-27] - Audit Log JSON Schema Validation in audit-repo.js
- **Decision:** `scripts/audit-repo.js` must be expanded beyond heading-presence checks to parse the `Audit Log` section content of every persona file and validate it against the mandated JSON schema (`{ task, inputs, actions, risks, result }`). Files where the `Audit Log` section exists but does not contain a parseable JSON example matching the schema must fail the audit. This converts structural compliance into substantive compliance.
- **Reference:** Automated clarification resolution — closes [2026-04-25] Audit Log JSON Schema Validation.

## [2026-04-27] - Skill Contract Audit Enforcement
- **Decision:** `scripts/audit-repo.js` must discover and audit all files under `skills/` (excluding `SKILL_TEMPLATE.md`) using the same structural contract defined in Decision [2026-04-13] (`Rules & Constraints` with mandatory `### Refusal Criteria` subsection, and `Audit Log`). Skills that drift from this contract must fail the audit identically to agent personas.
- **Reference:** Automated clarification resolution — closes [2026-04-25] Skill Contract Audit Enforcement.

## [2026-04-27] - Data Inventory in Skill Contract
- **Decision:** `Data Inventory` becomes a mandatory section of `SKILL_TEMPLATE.md` and all files in `skills/`, replacing or consolidating the existing `Inputs`/`Outputs` headings. This brings skill documentation into structural symmetry with agent personas (Decision [2026-04-13]) and supports a unified data dictionary across the fleet. `scripts/audit-repo.js` will enforce this section once the skills audit pass (this date) lands.
- **Reference:** Automated clarification resolution — closes [2026-04-22] Data Inventory for Skills.

## [2026-04-27] - Substantive Persona Content Remediation
- **Decision:** The placeholder-text drift in `Data Inventory` and `Refusal Criteria` across all 22 agent personas will be remediated **incrementally during domain-specific work** rather than via a single bulk rewrite. The audit-repo.js enhancements (Decision [2026-04-27] Audit Log JSON Schema Validation; Skill Contract Audit Enforcement) provide the technical guard against future drift. A bulk find-and-replace of role-specific safety/data text without domain context risks producing equally generic but more confidently-wrong content; the incremental approach ties content to the practitioner closest to each persona's domain.
- **Reference:** Automated clarification resolution — closes [2026-04-26] Substantive Persona Content Drift.

## [2026-04-27] - Reference Example Asset Population Priority
- **Decision:** Populating empty reference example directories with starter assets is a P1 priority (right after audit-script enhancements) because agent specifications currently describe workflows that cannot be executed against the published repository. Order: `examples/red-team-gauntlet/test-vectors.yaml` first (blocks Client Onboarding), then any other empty example directories surfaced by the smoke test expansion.
- **Reference:** Automated clarification resolution — closes [2026-04-26] Reference Asset Absence.

## [2026-04-27] - NOEMI_DOCKER_SMOKE_* Smoke Test Implementation
- **Decision:** `tests/examples-smoke.test.js` must add static smoke checks that validate the presence and basic format of `NOEMI_DOCKER_SMOKE_*` variables in the root `.env.template`. These checks are part of the canonical fast gate (`npm run validate`) and satisfy REQUIREMENTS.md Section 9.
- **Reference:** Automated clarification resolution — closes [2026-04-23] Missing NOEMI_DOCKER_SMOKE_* Smoke Test Validation.

## [2026-04-27] - Gatekeeper Reference Implementation Mutating Actions (Dry-Run)
- **Decision:** The `examples/gatekeeper-deployment/` reference implementation will be extended to include a **dry-run mode** for the Gatekeeper persona's mutating actions (PR merges, issue closes). Dry-run mode logs the intended action via the standard Audit Log shape but does not call GitHub mutation APIs. Live mutating actions remain explicitly out-of-scope for the public reference example for the same safety reasons that motivate the Refusal Principle; orchestrator-side environments can flip the flag.
- **Reference:** Automated clarification resolution — closes [2026-04-23] Gatekeeper Reference Implementation Mutating Actions.

## [2026-04-27] - Node.js 24 Baseline Enforcement in Reference Docker
- **Decision:** All `Dockerfile` and `docker-compose.yml` files in `examples/` and `tools/` must pin to `node:24-alpine` to align with the AGENTS.md Node.js 24 baseline. Specifically: `examples/gatekeeper-deployment/docker-compose.yml` (currently `node:20-alpine`) and `tools/executive-assistant/Dockerfile` (currently `node:20-alpine` in both builder and runtime stages) must be bumped. Future reference Docker examples must be born on `node:24-alpine`.
- **Reference:** Automated clarification resolution — closes [2026-05-01] and [2026-05-02] Node.js 24 Baseline Enforcement in Docker (duplicate questions consolidated).

## [2026-04-27] - Persona Journal Section Mandate
- **Decision:** The `## Journal` section is added to the **mandatory** persona contract in `AGENTS.md`, `REQUIREMENTS.md` Section 2, and `docs/AGENT_TEMPLATE.md` (the template already includes it). All 22 agent personas must include a `## Journal` section to support standardized cross-fleet learning. `scripts/audit-repo.js` will be extended to enforce this heading. This formalizes a pattern already present in 4 personas (`sentinel/core.md`, `bolt/core.md`, `bolt/nextjs-16.md`, `gatekeeper.md`).
- **Reference:** Automated clarification resolution — closes [2026-05-01] and [2026-05-02] Persona Journal Section Standardization (duplicate questions consolidated).
