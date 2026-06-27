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

## [2026-04-22] Formalizing the Reusable Skill Contract

- **Decision:** Extend the mandatory agent persona contract (Rules & Constraints, Audit Log) to all reusable skills in the `skills/` directory.
- **Context:** Decision [2026-04-13] updated `SKILL_TEMPLATE.md`, but the mandate was not yet formalized in the core requirements.
- **Impact:** All skills must include: Purpose, Inputs, Procedure, Outputs, Rules & Constraints (4D Diligence), Boundaries, and Audit Log.

## [2026-05-02] Holistic Codebase Alignment Audit

- **Decision:** Perform a whole-codebase audit to identify and document technical drifts in `REQUIREMENTS.md`.
- **Context:** The repository as a reference architecture must accurately reflect implementation gaps to guide future work.
- **Impact:** Documented drifts for Node.js 24 baseline, `resilience_helpers.js` integration, `sync-upstream.sh` placeholders, and `audit-repo.js` script gaps.

## [2026-05-02] Holistic Codebase Alignment Audit & Refinement

- **Decision:** Perform a multi-track audit of the entire repository to identify and consolidate technical drifts in `REQUIREMENTS.md`.
- **Context:** As the repository matures, structural, substantive, and environmental drifts have emerged across personas, skills, scripts, and examples.
- **Impact:**
  - Verified and documented 20 distinct technical drifts in `REQUIREMENTS.md`.
  - Identified missing `clients/` and `.gatekeeper/` directories referenced in agent personas.
  - Identified major gaps in automated audit coverage (skills directory, JSON schema validation, H3 hierarchy enforcement).
  - Documented environmental drifts (Node.js 24 baseline in Docker, SecretOps authentication depth).
  - Formalized the "Groundedness Rule" for documentation by verifying the dual-backend nature of the `logging-mcp` draft.

## [2026-05-10] Technical Drift Remediation and Artifact Normalization

- **Decision:** Remediate verified technical drifts regarding artifact naming, Node.js baselines, and legacy documentation headers.
- **Context:** A whole-codebase audit identified several areas where the implementation had drifted from the mandates in `AGENTS.md` and `REQUIREMENTS.md`.
- **Impact:**
  - Renamed `docs/n8n workflows/` to `docs/n8n-workflows/` to satisfy the English-first, slug-based naming convention.
  - Updated `examples/gatekeeper-deployment/docker-compose.yml` and `tools/executive-assistant/Dockerfile` to Node.js 24 images, ensuring fleet-wide baseline compliance.
  - Applied the mandatory `LEGACY/ILLUSTRATIVE` header to `tools/roi/generate_roi_template.py`.
  - Updated `REQUIREMENTS.md` to reflect these remediations and maintain an accurate list of known limitations.

## [2026-05-11] Reality Check and Documentation Refinement

- **Decision:** Perform a granular verification of documented technical drifts and refine `REQUIREMENTS.md` and `AGENTS.md` to ensure absolute accuracy.
- **Context:** An autonomous audit verified several persistent implementation gaps (missing directories, shallow pre-flight checks, template marker duplication) that require explicit tracking.
- **Impact:**
  - Confirmed `clients/`, `.gatekeeper/`, and `templates/tiers/` remain absent.
  - Confirmed `scripts/context_helpers.js` truncates `Role` sections, impacting Agent Index richness.
  - Confirmed `scripts/audit-repo.js` lacks `skills/` coverage and structured JSON Audit Log validation.
  - Confirmed `templates/context/GEMINI.template.md` contains duplicate marker pairs.
  - Documented the need for active SecretOps authentication verification in `scripts/verify-env.sh` and `scripts/verify-env.ps1`.

## [2026-05-12] Skill Contract and Internal Tool Alignment

- **Decision:** Extend the substantive persona contract (Data Inventory, Refusal Criteria) and observability standards (JSON Audit Log to `stderr`) to the reusable skill library and internal Node.js tools.
- **Context:** A reality check identified that while agent personas have made progress toward substantive compliance, reusable skills and internal tools (e.g., `executive-assistant`) remain largely in a placeholder or unstructured state.
- **Impact:**
  - `AGENTS.md` updated to explicitly mandate `Data Inventory` for skills and JSON Audit Logs for internal tools/services.
  - Identified a logic contradiction in `scripts/verify-env.sh` regarding SecretOps hard-failure vs. warning.
  - Formally documented the "Skill Contract Substantive Drift" and "Internal Tool Observability Gap" in `REQUIREMENTS.md`.

## [2026-05-17] Phase 3 Clarification and Requirement Alignment

- **Decision:** Formalize and document the newly identified technical drifts regarding Phase 0 Assessment Kit inventory, AI Model Baselines, and Branch Protection enforcement.
- **Context:** A Phase 2 Reality Check identified several "extra-canonical" assets and unmandated baselines that create structural and technical ambiguity.
- **Impact:** Updated `REQUIREMENTS.md` and `CLARIFICATIONS.md` to ensure absolute accuracy and track the remediation of these newly identified drifts.

## [2026-05-20] Audit Script Coverage Expansion (Skills + JSON Schema)

- **Decision:** Treat the expansion of `scripts/audit-repo.js` to cover the `skills/` directory and to validate the mandated JSON Audit Log schema as a **mandatory governance fix**. The script MUST: (1) iterate every `*.md` file under `skills/` and apply the same persona-contract checks already applied to `agents/`; (2) parse the `## Audit Log` section's JSON block in agents and skills and validate it against the canonical schema (`{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`); (3) emit its own JSON Audit Log to `stderr` per the observability mandate.
- **Context:** Resolves Q [2026-05-20] (Audit Script Enforcement Depth — Skills & Schema). The previously documented `Audit Script Gaps`, `Audit Script JSON Schema Blindness`, `Skill-to-Agent Reference Integrity Gap`, `Audit Script Structural Limitation`, and `Skill Contract Substantive Drift` entries in `REQUIREMENTS.md` Current Known Limitations are all symptoms of the same root cause: structurally limited gates.
- **Impact:** The expansion lands as a single coherent unit of work because partial coverage gives a false sense of governance. Until shipped, the listed limitations stay tagged as "open"; once shipped, they collapse into a single resolution entry.

## [2026-05-20] Fleet Dashboard Ingestion Path: Standardize on `/api/v1/reports`

- **Decision:** The Fleet Dashboard ingestion path MUST be `/api/v1/reports`. The reference implementation in `examples/fleet-dashboard/dashboard-ingest.js` and the assertion in `tests/examples-smoke.test.js` MUST both be updated to that path in the same PR — the test must follow the persona, not the other way around.
- **Context:** Resolves Q [2026-05-20] (Fleet Dashboard API Path Standardization). Persona specifications are the source of truth in this repository; a test that codifies a deviation from the persona is itself a drift and must be remediated rather than preserved.
- **Impact:** Closes the `Reference implementation Path Inconsistency` and `Test Suite Reinforcement of Technical Drift` items from `REQUIREMENTS.md` Current Known Limitations. A single coordinated PR updates persona reference, implementation file, and test in lockstep.

## [2026-05-20] Branch Protection: Mandatory Enforcement

- **Decision:** Branch protection enforcement (via `scripts/setup-branch-protection.sh` or an equivalent automated mechanism) is now a **mandatory** requirement under `REQUIREMENTS.md §7 Governance and Trust Controls`. New forks MUST run the script (or its equivalent) on first setup. `scripts/audit-repo.js` SHOULD acquire a check that surfaces missing protection as a non-fatal warning in non-CI runs and as a fatal error in CI.
- **Context:** Resolves Q [2026-05-20] (Branch Protection Enforcement Mandate). Branch protection is baseline governance for any repository with multiple maintainers — leaving it optional creates a silent integrity gap that can be exploited by an inattentive direct push to `main`.
- **Impact:** Closes the `Branch Protection Enforcement Gap` item from `REQUIREMENTS.md` Current Known Limitations. Section 7 of `REQUIREMENTS.md` is updated in this PR to include the new mandate.

## [2026-05-20] Formalization of Technical Drift Tracking

- **Decision:** Establish a formal requirement to track and surface newly identified technical drifts in `REQUIREMENTS.md` to ensure the "Current Implementation Truth" remains grounded in the codebase state.
- **Context:** A Phase 2 Reality Check confirmed that several substantive and technical implementation gaps (naming convention violations in `rfp-split`, under-reported Phase 0 Kit assets, and unstructured logging in `executive-assistant`) were not explicitly tracked as limitations.
- **Impact:**
  - Mandatory inclusion of confirmed technical drifts in `REQUIREMENTS.md` §"Current Known Limitations".
  - Documentation of naming convention drift (English-first, slug-based) for non-compliant example assets.
  - Identification of the "Internal Tool Observability Gap" (JSON Audit Log to `stderr`) for repository-adjacent Node.js tools.

## [2026-05-26] Pre-flight Logic Normalization

- **Decision:** Standardize environment verification scripts (`scripts/verify-env.sh`, `scripts/verify-env.ps1`) to include active authentication checks (e.g., `infisical whoami` or `op user get --me`). Missing SecretOps CLIs will default to a warning in `builder` mode but a fatal error (exit 1) in `docker` mode to ensure runtime reliability.
- **Context:** Previous logic was contradictory, treating missing SecretOps as both a failure and a warning in different blocks.
- **Impact:** Beginners can explore the repo without SecretOps, while Docker deployments are gated for security.

## [2026-05-26] Verified Template Marker Consistency

- **Decision:** Audit and remediate duplication of template markers in `templates/context/GEMINI.template.md` and `templates/context/CLAUDE.template.md`. Each template must contain exactly one pair of markers for `GLOBAL_MANDATES` and `AGENT_INDEX`.
- **Context:** Drift identified where duplicate markers caused redundant section injection in generated context files.
- **Impact:** Cleaner generated context and reduced token consumption for agents.

## [2026-05-28-0001] logging-mcp Audit Log Payload Alignment

- **Decision:** The `logging-mcp` protocol's "Standardized Log Shape" must explicitly carry the mandated Audit Log JSON (`{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`) inside its `metadata` field for success/failure events. The two are not separate emissions — `logging-mcp` is the transport envelope and the mandated Audit Log is the canonical payload.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-04] (logging-mcp Standardized Log Shape vs. Audit Log). Decisions [2026-04-02] (dual-protocol logging-mcp) and [2026-04-13] (stderr emission for Audit Log) already established the transport and the shape independently; this decision binds them so observability and persona contracts stay coherent.
- **Impact:** When `logging-mcp` is activated, references services and agents emit one envelope per event whose `metadata.audit_log` field carries the canonical Audit Log JSON. The Audit Log to `stderr` mandate continues to apply for orchestrators that do not consume `logging-mcp`.

## [2026-05-28-0002] Onboarding and Configuration Directory Bootstrap

- **Decision:** The repository will materialize the missing `clients/`, `.gatekeeper/`, and `templates/tiers/` directories with `.gitignore` placeholders so persona specifications (Client Onboarding, Gatekeeper, QBR Presenter) become truthful and orchestrator-runnable. Sensitive runtime state (`clients/*`, `.gatekeeper/*`) is git-ignored; only the placeholder is tracked. `templates/tiers/` is tracked normally as it holds reusable tier templates.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-04] (Onboarding Directory Drift), Q [2026-05-02] (Missing Referenced Assets and Directories), Q [2026-05-10] (Missing Infrastructure Assets), and Q [2026-05-28] (Missing Onboarding and Configuration Infrastructure). These are all symptoms of the same drift.
- **Impact:** Agent personas referencing these directories now have a real, discoverable target; orchestrators can mount them as volumes; the repository's "Current Implementation Truth" closes one of its long-standing limitations.

## [2026-05-28-0003] SecretOps Reference File Standardization

- **Decision:** Standardize on `.env.template` as the canonical reference file in all 1Password and Infisical command wrapper examples appearing in `AGENTS.md`, `docs/tool-usages/`, and `CLAUDE.md`/`GEMINI.md` quick-start blocks. Per-example `docker-compose.yml` and `examples/*/.env.example` files remain valid where Docker Compose's own conventions require them, but documentation prose must reference `.env.template` as the root inventory.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (SecretOps Syntax Drift: `.env.template` vs `.env.example`). `.env.template` is already the single source of truth for the root variable inventory (see Decision [2026-04-13] Environment Variable Inventory Consolidation and [2026-04-25] Environment Variable Inventory Alignment); examples follow Docker Compose's `.env.example` convention but inherit from the same vault references.
- **Impact:** Documentation prose is consistent; builders never wonder which file to point `op run --env-file` at; Docker examples remain idiomatic.

## [2026-05-28-0004] Case-Insensitive Heading Audits

- **Decision:** `scripts/audit-repo.js` and `scripts/context_helpers.js` perform case-insensitive comparison when checking required persona and skill headings. The canonical casing remains as documented (e.g., "Refusal Criteria"); the audit tolerates capitalization variants so that substantively compliant files do not fail on cosmetic drift.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Case-Insensitive Heading Audits). Strict string matching previously rejected files like "Refusal criteria" even though they satisfy the structural contract.
- **Impact:** Lower friction for contributors; canonical casing is documented but not punitively enforced; substantive checks (JSON shape, Refusal subsection contents) remain unchanged.

## [2026-05-28-0005] Value Lenses and Operating Profiles Injection

- **Decision:** `scripts/generate_all.js` must inject the contents of `value-lenses/` and `operating-profiles/` into the `<!-- VALUE_LENS_INJECTIONS_START -->` and `<!-- OPERATING_PROFILE_INJECTIONS_START -->` template markers (which already exist per Decision [2026-05-26]). The injected payload is a deterministic listing of each tracked lens/profile file (excluding `*_TEMPLATE.md` and `README.md`), so generated `GEMINI.md` and `CLAUDE.md` carry the same framework layer at runtime that the docs describe at design time.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-04] (Framework Integration in Context Generators), Q [2026-05-02] (Framework Markers in Context Templates), Q [2026-05-21] (Framework Marker Injection Standardization), and Q [2026-05-22] (Generator Script Marker Alignment). The markers were added but the generator never filled them.
- **Impact:** Closes the "Framework Injection Gap" from `REQUIREMENTS.md` Current Known Limitations; agents consuming generated context now receive the Value Lenses and Operating Profiles inline.

## [2026-06-27-0001] audit_logger.js Canonical Implementation and Schema

- **Decision:** Implement `scripts/audit_logger.js` as the shared utility for emitting structured JSON Audit Logs to `stderr` from Node.js-based tools and reference services. The utility exports `emit()`, `buildAuditLog()`, `validateAuditLog()`, and a canonical `EVENT_TASK_MAP` (`SYNC_COMPLETE`, `TRIAGE_VIP`, `CONFIG_UPDATE`, `OAUTH_REFRESH`, `INGEST_REPORT`, `LEARNING_RESOLUTION`, `HEALTHCHECK`, `SCHEDULED_RUN`, `AUDIT_RUN`, `GENERATE_CONTEXT`, etc.) that maps internal events to canonical Audit Log `task` strings. Audit Log lines are prefixed with `AUDIT_LOG: ` so orchestrators can reliably distinguish them from unstructured stderr noise.
- **Context:** Resolves CLARIFICATIONS Q [2026-06-10] / Q [2026-06-11] / Q [2026-06-15] / Q [2026-06-18] / Q [2026-06-19] (all variants of the missing `audit_logger.js` + event mapping). The mandate existed in AGENTS.md but the utility was absent from the repo.
- **Impact:** `scripts/audit-repo.js` now uses `audit_logger.validateAuditLog()` for in-file Audit Log JSON validation and emits its own AUDIT_LOG on completion. Subsequent PRs will refactor `tools/executive-assistant/server.js` and `examples/gatekeeper-deployment/dashboard-ingest.js` to use the shared utility (incremental). Schema fields enforced: `task` (non-empty string), `inputs/actions/risks` (arrays), `result` (non-empty string).

## [2026-06-27-0002] Audit Log Schema Validation in audit-repo.js

- **Decision:** `scripts/audit-repo.js` MUST validate that every `## Audit Log` JSON block in agents and skills conforms to the canonical schema (`task` non-empty string, `inputs/actions/risks` arrays, `result` non-empty string). Validation is performed via `scripts/audit_logger.validateAuditLog()` so the schema lives in exactly one place.
- **Context:** Resolves CLARIFICATIONS Q [2026-06-01] / Q [2026-06-18] (JSON Schema Enforcement). The previous audit only checked that the block parsed as JSON; empty objects passed silently.
- **Impact:** Personas and skills that ship malformed audit logs now fail the audit gate. Existing fleet content was verified compliant before this decision landed.

## [2026-06-27-0003] Phase 0 Assessment Kit Audit Coverage

- **Decision:** `scripts/audit-repo.js` MUST verify the presence of all 8 mandated files in `docs/phase-zero-assessment/` (`security-assessment.md`, `ai-readiness-assessment.md`, `network-security-assessment.md`, `PRACTITIONER_NOTES.md`, `consent-template.md`, `report-template.md`, `roadmap-template.md`, `readiness-rubric.md`).
- **Context:** Resolves CLARIFICATIONS Q [2026-06-20] (Phase 0 Assessment Kit Audit Coverage). Requirement §1 mandates this inventory; without an automated check, file renames or deletions silently break the buyer's first-contact experience.
- **Impact:** Missing or renamed Phase 0 files now fail the audit immediately, surfacing drift at PR time rather than at buyer-onboarding time.

## [2026-06-27-0004] mcp.config.json Referential Integrity

- **Decision:** `scripts/audit-repo.js` MUST verify that every entry in `mcp.config.json` `active_mcps` and `active_skills` maps to an existing file in `mcp-protocols/` or `skills/` respectively. Typos and missing files now fail the audit gate.
- **Context:** Resolves CLARIFICATIONS Q [2026-05-02] (Config-to-Asset Mapping Validation). Without this check, generated context silently omitted MCPs/skills referenced by config.
- **Impact:** `mcp.config.json` becomes a verifiable contract instead of a free-text list.

## [2026-06-27-0005] Agent Index Paragraph Extraction

- **Decision:** `scripts/context_helpers.js` MUST extract the full first paragraph (up to the first blank line, capped at 400 chars) of the `## Role` section for the Agent Index, replacing the previous first-sentence extraction. Multi-sentence Role definitions now produce informative index entries.
- **Context:** Resolves CLARIFICATIONS Q [2026-05-02] (Agent Index Role Truncation) and the Memory-Code Synchronization gap from Q [2026-06-01]. Single-sentence extraction produced index lines like "You are a Multimodal Operations Specialist." which give downstream models no signal.
- **Impact:** GEMINI.md/CLAUDE.md Agent Index entries are richer. Golden fixtures (`tests/fixtures/generated/agent-index.md`) were regenerated in lockstep.

## [2026-06-27-0006] sync-upstream.sh Parameterization

- **Decision:** `scripts/sync-upstream.sh` MUST source its organization name, upstream URL, upstream remote name, and local branch from environment variables (`NOEMI_ORG_NAME`, `NOEMI_UPSTREAM_URL`, `NOEMI_UPSTREAM_REMOTE`, `NOEMI_LOCAL_BRANCH`) with sensible defaults, removing the hardcoded `[MyOrganization]` placeholder.
- **Context:** Resolves CLARIFICATIONS Q [2026-05-29] / Q [2026-06-11] (Sync Script Parameterization / sync-upstream.sh Hardcoded Identity). Hardcoded placeholders forced every fork to patch the script.
- **Impact:** Forks can run `NOEMI_ORG_NAME=foo bash scripts/sync-upstream.sh` without editing source. AGENTS.md "Script Parameterization" mandate is now satisfied.

## [2026-06-27-0007] verify-env Fatal SecretOps in Docker Mode

- **Decision:** `scripts/verify-env.sh` and `scripts/verify-env.ps1` MUST exit 1 when running in `--mode=docker` if no SecretOps CLI is installed OR if the installed CLI(s) fail their active authentication check (`op user get --me` / `infisical whoami`). Other modes (builder/gemini/claude/codex/n8n) retain warning-only behavior to keep local exploration friction-free.
- **Context:** Resolves CLARIFICATIONS Q [2026-06-11] / Q [2026-06-18] (verify-env.sh Mode Discrepancy) and aligns the implementation with the AGENTS.md mandate that already specified this behavior.
- **Impact:** Docker-mode pre-flight now genuinely gates on Fetch-on-Demand readiness. Closes the "SecretOps Authentication Enforcement Gap" from REQUIREMENTS.md Current Known Limitations.

## [2026-06-27-0008] Smoke Test SecretOps Provider Neutrality

- **Decision:** `tests/examples-smoke.test.js` MUST accept either `op://` (1Password) or `infisical://` / `INFISICAL_*` (Infisical) vault-reference patterns in example `.env.example` files. Either form satisfies the multi-provider mandate from AGENTS.md.
- **Context:** Resolves CLARIFICATIONS Q [2026-06-19] (SecretOps Provider Bias in Smoke Tests). Hardcoding only `op://` produced false failures for Infisical-first organizations.
- **Impact:** Forks standardizing on Infisical no longer fail the smoke test for a cosmetic SecretOps choice.

## [2026-06-27-0009] Docker Smoke FORCE_DOCKER_SMOKE Mandatory Mode

- **Decision:** `tests/e2e/docker-smoke.test.js` MUST treat `FORCE_DOCKER_SMOKE=true` as opt-in mandatory mode: when set, a missing Docker CLI/Compose throws immediately rather than silently skipping. When unset, the existing clean-skip behavior is preserved.
- **Context:** Resolves CLARIFICATIONS Q [2026-06-18] (E2E Smoke Test Docker Mandatory Check). CI pipelines that misconfigure Docker previously produced false greens.
- **Impact:** CI workflows can opt into hard-fail behavior with one env var; local dev experience is unchanged. Closes the "CI/CD False Green Risk in E2E" limitation.

## [2026-06-27-0010] NOEMI_DOCKER_SMOKE_* Variable Inventory Validation

- **Decision:** `tests/examples-smoke.test.js` MUST verify that `.env.template` documents the three `NOEMI_DOCKER_SMOKE_*` variables consumed by `tests/e2e/docker-smoke.test.js` (`_TIMEOUT_MS`, `_POLL_INTERVAL_MS`, `_ARTIFACT_DIR`). Drift between the test runner and the documented inventory is surfaced at smoke-test time.
- **Context:** Resolves CLARIFICATIONS Q [2026-05-29] / Q [2026-06-11] (Docker Smoke Test Variable Validation / Environmental Blindness).
- **Impact:** `.env.template` cannot quietly drop documentation of e2e-suite variables without a smoke-test failure.

## [2026-06-27-0011] Red Team Gauntlet Machine-Readable Test Vectors

- **Decision:** `examples/red-team-gauntlet/test-vectors.json` MUST exist as a machine-readable serialization of the prose test cases in `README.md`. The schema includes per-vector `id`, `name`, `category`, `severity`, `input`, `expected_status`, and `expected_reason` fields. Categories follow the persona split: `prompt-injection` for PromptShield (PS-*) and `pii-redaction` / `secret-exfiltration` for PIIGuard (PG-*). The prose README remains the human-readable reference.
- **Context:** Resolves CLARIFICATIONS Q [2026-04-05] / Q [2026-06-10] / Q [2026-06-15] (Red Team Gauntlet Test Vector Absence / Machine-Readable Test Vectors / Serialization Strategy).
- **Impact:** The Client Onboarding agent's validation workflow now has a single JSON file to load. Automated guardrail regressions can iterate the vectors directly.

## [2026-06-27-0012] Starter Operating Profile

- **Decision:** Materialize `operating-profiles/standard-operating-profile.md` as the baseline operating profile that the context generator injects when no locale- or sector-specific profile applies. The profile encodes the framework's default execution norms (Audit Log to stderr, dry-run for mutating actions, Refusal Criteria escalation form, etc.).
- **Context:** Resolves CLARIFICATIONS Q [2026-06-15] (Operating Profile Baseline Absence). The `<!-- OPERATING_PROFILE_INJECTIONS_START -->` marker was wired up by Decision [2026-05-28-0005] but no actual profile existed, so generated context carried an empty injection block.
- **Impact:** Generated `GEMINI.md`/`CLAUDE.md` now carry an actual operating profile inline. Locale/sector profiles can inherit from it.

## [2026-06-27-0013] Audit Substantive Placeholder Warning (Phased Rollout)

- **Decision:** `scripts/audit-repo.js` MUST surface `TBD` and `placeholder` strings inside the mandatory `Data Inventory` (H2) and `Refusal Criteria` (H3) sections as warnings on stderr. Promotion to a fatal error is deferred to a future decision once the fleet has been substantively remediated. The phased approach surfaces the substantive drift without immediately breaking CI while the remediation work is in flight.
- **Context:** Resolves CLARIFICATIONS Q [2026-04-05] / Q [2026-05-10] / Q [2026-05-28] / Q [2026-06-01] / Q [2026-06-15] / Q [2026-06-17] / Q [2026-06-18] / Q [2026-06-21] (variants of Substantive Persona Content Drift and Audit Script Placeholder Rejection Policy). A bulk substantive remediation requires per-agent domain knowledge that exceeds an automated PR's scope, but the warning gives reviewers a checklist.
- **Impact:** The "Substantive Content Baseline" limitation in REQUIREMENTS.md is downgraded from "structurally compliant but invisibly hollow" to "structurally compliant with visible warnings on every audit run."

## [2026-06-27-0014] Generator Script Consolidation Deferred

- **Decision:** `scripts/generate_all.js`, `scripts/generate_gemini.js`, and `scripts/generate_claude.js` REMAIN as three entry points for now. `generate_all.js` is the canonical orchestrator (per Decision [2026-04-02] Balanced Reference + Implementation Alignment), and the two single-target scripts are kept for backwards compatibility with downstream CI configurations that invoke them directly. Consolidation to a single entry point is deferred pending an audit of external consumers.
- **Context:** Resolves CLARIFICATIONS Q [2026-05-17] (Generator Script Redundancy). Removing the single-target scripts without a deprecation window risks breaking external orchestrators.
- **Impact:** No change to runtime behavior. The redundancy is documented as intentional during the deprecation window.

## [2026-06-27-0015] Bulk Closure of Items Overtaken or Restated

- **Decision:** The following CLARIFICATIONS questions are closed as already-resolved or overtaken by prior decisions and removed from the active backlog without further action:
  - Q [2026-05-02] (Standardized Audit Log Emission for Build Utilities) — resolved by [2026-06-27-0001] / [2026-06-27-0002]; `audit-repo.js` now emits its own AUDIT_LOG.
  - Q [2026-05-02] (Audit Log Descriptor Standardization) — resolved by [2026-06-27-0001]; `AUDIT_LOG: ` prefix selected as the unambiguous marker.
  - Q [2026-05-02] (Refusal Criteria Substantive Enforcement) — folded into [2026-06-27-0013]'s phased rollout; substantive content enforcement starts as warnings.
  - Q [2026-05-02] (Skill-to-Agent Referential Integrity) / Q [2026-06-17] (Automated Internal Documentation Link Integrity) — deferred; outside this PR's scope; tracked as REQUIREMENTS.md limitation.
  - Q [2026-05-02] (Tool Baseline Alignment — Executive Assistant) / Q [2026-05-19] / Q [2026-05-29] / Q [2026-06-15] / Q [2026-06-17] (Internal Tool Observability and Event Mapping variants) — `audit_logger.js` with `EVENT_TASK_MAP` is now available per [2026-06-27-0001]; the actual refactor of `tools/executive-assistant/server.js` and `dashboard-ingest.js` is the next PR's scope.
  - Q [2026-05-02] (Identity Provider Implementation Gap) / Q [2026-05-22] (Casdoor Identity Integration Logic) — remains deferred; Decision [2026-03-03] established Casdoor as the reference identity layer but kept identity verification as an orchestrator/ingress responsibility. No agent-side change needed; documented as a future implementation track.
  - Q [2026-05-10] / Q [2026-05-28] / Q [2026-06-17] / Q [2026-06-18] (variants of Substantive Persona Remediation Strategy) — folded into [2026-06-27-0013]'s phased approach.
  - Q [2026-05-13] (RFP Split Naming Convention Remediation) — defer; cosmetic asset rename in `examples/rfp-split/` is low-priority and risks breaking external references; revisit when example is updated.
  - Q [2026-05-15] (Test Suite Reinforcement of API Path Drift) — verified clean; `dashboard-ingest.js` and `tests/examples-smoke.test.js` both reference `/api/v1/reports` per Decision [2026-05-20].
  - Q [2026-05-20] (AI Model Version Baseline Formalization Follow-through) / Q [2026-06-19] (Legacy Example Model Drift) — defer; legacy examples are labeled LEGACY/ILLUSTRATIVE per Decision [2026-04-04]; model pin update is incremental work tracked in REQUIREMENTS.md.
  - Q [2026-04-05] (Fleet Dashboard Retention Policy Drift) / Q [2026-04-05] (Fleet Dashboard Multi-tenancy) / Q [2026-04-23] (Gatekeeper Mutating Actions) — defer; these are reference-implementation expansion items that exceed a documentation-resolution PR's scope. Tracked as REQUIREMENTS.md drift items for future work.
  - Q [2026-04-03] (ROI Auditor Baseline Data Access) — defer; resolution depends on whether the ROI Calculator template's structure stabilizes; tracked as open product question.
  - Q [2026-05-01] (Node.js 24 Baseline Enforcement in Docker) / Q [2026-05-02] (Automated Naming Convention Audit) — defer; fleet-wide structural sweeps better handled by a dedicated PR with focused review.
  - Q [2026-05-29] (Branch Protection Audit Implementation) — defer; the audit script knows the mandate exists (Decision [2026-05-20]) but verifying GitHub branch protection requires API access with a token. Deferred until the audit harness supports authenticated checks.
  - Q [2026-05-29] (Skill Remediation Priority) / Q [2026-06-18] (Substantive Remediation of Skill TBD Placeholders) — folded into [2026-06-27-0013]'s phased approach.
  - Q [2026-06-10] (Empty Tier Templates Implementation Gap) / Q [2026-06-15] (Service Tier Template Specifications) — defer; tier templates require specific product-line definitions that exceed the automated PR's scope; tracked as a product-input dependency.
  - Q [2026-06-19] (Resilience Helper Persona Integration) — defer; fleet-wide persona update for `withRetry` patterns better handled by domain-by-domain review.
  - Q [2026-06-19] (Resilience Helper Module System Mismatch) — defer; ESM/CJS dual-export migration is its own coordinated change; not blocking the current Doc+Impl PR.
  - Q [2026-06-20] (Rules & Constraints Heading Inconsistency) — defer; the heading variance ("Rules & Constraints" vs "Rules & Constraints (4D Diligence)") is intentional for now since the audit is case-insensitive and tolerant of the suffix; future unification is a coordinated PR.
  - Q [2026-06-20] / Q [2026-06-21] (Executive Assistant Learning Agent Formalization) — defer; formalizing the Learning Agent persona requires product-owner input on whether HITL feedback is a core requirement. Tracked as an open product question.
  - Q [2026-06-17] / Q [2026-06-21] (Framework Asset Structural Audit / value-lenses operating-profiles) — defer; framework templates exist and serve as structural reference; an automated audit of inheritance is a future enhancement.
- **Context:** Multiple late-cycle clarifications restate or duplicate earlier resolved questions or call for scope larger than a single Doc+Impl PR. Carrying them in the active backlog inflates the queue.
- **Impact:** CLARIFICATIONS.md shrinks to genuinely open or deferred-with-rationale items. Durable answers and deferrals remain here for traceability.

## [2026-05-28-0006] Resolved Clarifications Overtaken by Prior Decisions

- **Decision:** The following CLARIFICATIONS.md questions are closed as already-resolved by prior entries in this log and are removed from the active backlog without further action:
  - Q [2026-04-02] / [2026-04-04] Node.js Resilience Helper integration into core scripts → resolved by [2026-04-04] Resilience Helpers: Core Script Integration Scope (reference-only; do not force-integrate into deterministic local-FS tools).
  - Q [2026-04-03] / [2026-04-05] / [2026-05-17] `logging-mcp` activation in `mcp.config.json` → resolved by [2026-04-03] logging-mcp Configuration Scope (remains reference-only until a runtime consumer ships).
  - Q [2026-04-04] Fleet Dashboard API path → resolved by [2026-05-20] Fleet Dashboard Ingestion Path: Standardize on `/api/v1/reports`.
  - Q [2026-04-25] / [2026-05-02] / [2026-05-10] / [2026-05-13] / [2026-05-19] Audit script coverage for `skills/` and JSON schema validation → resolved by [2026-05-20] Audit Script Coverage Expansion.
  - Q [2026-05-17] / [2026-05-20] Branch protection mandatory enforcement → resolved by [2026-05-20] Branch Protection: Mandatory Enforcement.
  - Q [2026-05-11] / [2026-05-22] Template marker duplication → resolved by [2026-05-26] Verified Template Marker Consistency.
  - Q [2026-05-12] / [2026-05-21] / [2026-05-22] / [2026-05-13] / [2026-05-17] Pre-flight active authentication checks → resolved by [2026-05-26] Pre-flight Logic Normalization.
  - Q [2026-05-21] Pre-flight failure policy / Q [2026-05-22] Docker mode hard-fail policy → resolved by [2026-05-26] Pre-flight Logic Normalization.
- **Context:** Multiple late-cycle clarifications restate or duplicate earlier resolved questions. Carrying them in the active backlog made the queue look much larger than the real outstanding work.
- **Impact:** CLARIFICATIONS.md shrinks to genuinely open product-owner questions; the durable answers remain in this log for traceability.
