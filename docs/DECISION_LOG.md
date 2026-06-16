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

## [2026-06-16-0001] ROI Auditor Baseline Data Access Pattern

- **Decision:** The `ROI Auditor` persona accesses the baseline ("Human Baseline Time") and labor-rate dictionaries through a local read-only reference file (`tools/roi/baseline-config.json`), not via a privileged `google-sheets-read` capability. The published Google Sheets template (Decision [2026-04-03]) remains the human-editable source; the JSON snapshot is the machine-readable contract that agents consume. Refresh cadence is manual export-to-JSON, captured as a documented step in `tools/roi/README.md`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-03] (ROI Auditor Baseline Data Access). Avoids granting agents broad Sheets read scope, keeps the contract reproducible across environments where the `google-sheets` MCP is not available, and aligns with the existing Fetch-on-Demand posture (no online dependency for cold-path reasoning).
- **Impact:** `tools/roi/` gains a `baseline-config.json` reference fixture; the ROI Auditor persona's `Data Inventory` cites that file; the persona does not declare a new MCP capability. Sheets remains the human editing surface.

## [2026-06-16-0002] Fleet Dashboard Retention Policy: Two-Bucket Reference

- **Decision:** The Fleet Dashboard reference stack adopts a two-bucket InfluxDB layout matching the persona spec: `agent_reports` (90-day retention, detailed events) and `agent_summaries` (1-year retention, downsampled aggregates). `examples/gatekeeper-deployment/docker-compose.yml` provisions both buckets; a documented downsampling task (Flux script in the example directory) populates `agent_summaries`. The persona is not weakened to single-bucket.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Fleet Dashboard Retention Policy Drift). The persona's tiered retention is the source of truth; the reference implementation must follow the persona, not the other way around (consistent with [2026-05-20] Fleet Dashboard Ingestion Path).
- **Impact:** Closes the retention drift item. Sub-tasks tracked in REQUIREMENTS.md: (a) add `agent_summaries` bucket to compose; (b) ship a Flux downsampling task fixture; (c) document the refresh cadence in `examples/gatekeeper-deployment/README.md`.

## [2026-06-16-0003] Red Team Gauntlet Machine-Readable Vectors

- **Decision:** The Red Team Gauntlet test vectors are serialized as `examples/red-team-gauntlet/test-vectors.json` — a single file with two top-level keys (`prompt_injection`, `pii_patterns`), not separate files per category. Each entry carries `id`, `category`, `payload`, `expected_outcome`, and `notes`. The prose README remains as human-readable documentation that links to the JSON as the machine-readable source.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Red Team Gauntlet Test Vector Absence), Q [2026-06-10] (Machine-Readable Test Vectors), and Q [2026-06-15] (Red Team Gauntlet Serialization Strategy). Single-file serialization keeps the dataset easy to diff, easy to consume from `tests/`, and avoids the cross-file invariant problem of split JSON.
- **Impact:** Unblocks the Client Onboarding validation workflow. Sub-tasks tracked in REQUIREMENTS.md: (a) populate `test-vectors.json` with the five mandated cases (prompt injection + PII); (b) add a smoke test that loads the file and asserts schema shape; (c) link the JSON from `examples/red-team-gauntlet/README.md`.

## [2026-06-16-0004] Fleet Dashboard Multi-tenancy + Gatekeeper Mutating Actions Scope

- **Decision:** Persona specifications remain the source of truth (multi-tenant registry + asynchronous verification for Fleet Dashboard; mutating PR/issue actions for Gatekeeper). The reference implementations in `examples/gatekeeper-deployment/` extend toward those specs through a documented `dry-run` mode rather than full production logic: (a) `dashboard-ingest.js` gains a per-agent HMAC registry shape (JSON file, single-process verification) and a stub async verification worker; (b) `entrypoint.sh` gains a `GATEKEEPER_DRY_RUN=true` default that logs intended merge/close actions without executing them.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Fleet Dashboard Multi-tenancy Implementation Gap) and Q [2026-04-23] (Gatekeeper Reference Implementation Mutating Actions). Full production logic is out of scope for a reference architecture; `dry-run` mode demonstrates the contract without requiring an inattentive operator to grant production permissions.
- **Impact:** Closes both clarifications. Sub-tasks tracked in REQUIREMENTS.md under the Gatekeeper Implementation Gap line.

## [2026-06-16-0005] Substantive Remediation: Autonomous with Generic-Safe Defaults

- **Decision:** Jules is authorized to perform fleet-wide substantive remediation of `Data Inventory` and `Refusal Criteria` placeholders across `agents/` and `skills/` using **role-specific, technically grounded defaults** derived from each file's existing `Role`, `Mission`, `Inputs`, and `Procedure` sections. Domain experts may refine the content later; the audit gate is allowed to enforce the absence of "TBD" only once the bulk remediation lands (see [2026-06-16-0010]).
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Substantive Persona Content Drift), Q [2026-05-02] (Skill Contract Enforcement Depth), Q [2026-05-10] (Substantive Persona Remediation Strategy), Q [2026-05-28] (Substantive Remediation of the Skill Library), and Q [2026-05-29] (Skill Remediation Priority). Carrying these as five separate questions obscured that they are a single workstream gated on PO approval.
- **Impact:** Closes five clarifications. Sub-tasks: (a) generate role-specific content from each persona/skill's existing sections; (b) PR per directory (`agents/` then `skills/`) to keep diffs reviewable; (c) update REQUIREMENTS.md to remove the "Structural vs. Substantive Compliance" and "Skill Contract Substantive Drift" limitation lines once landed.

## [2026-06-16-0006] Audit Script Enforcement Sweep

- **Decision:** `scripts/audit-repo.js` will acquire the following checks as a single coordinated change (analogous to [2026-05-20] Audit Script Coverage Expansion): (a) Node baseline scan for `Dockerfile`/`docker-compose.yml` flagging `node:<24`; (b) referential integrity for `mcp.config.json` (`active_mcps` → `mcp-protocols/`, `active_skills` → `skills/`); (c) regex-based filename slug-naming check across `docs/`, `agents/`, `skills/`, `examples/`, `tools/`; (d) skill-reference integrity scan parsing `**Skill:** [path]` patterns in agent workflows; (e) Refusal Criteria substantive check for the three mandated clauses (refused types, override resistance, escalation path); (f) AI Model baseline grep across `examples/` and `tests/` flagging non-`models/gemini-2.5-flash` pins; (g) "TBD" placeholder rejection in mandatory persona/skill sections as a fatal error; (h) Audit Log JSON schema validation for the five mandated keys (`task`, `inputs`, `actions`, `risks`, `result`); (i) branch-protection check using the GitHub API when `GITHUB_TOKEN` is present, falling back to detecting `scripts/setup-branch-protection.sh` execution markers — fatal in CI, warning otherwise.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-01] (Node.js 24 Baseline Enforcement in Docker), Q [2026-05-02] (Config-to-Asset Mapping Validation), Q [2026-05-02] (Automated Naming Convention Audit), Q [2026-05-02] (Refusal Criteria Substantive Enforcement), Q [2026-05-15] (Skill-to-Agent Referential Integrity), Q [2026-05-20] (AI Model Version Baseline Formalization Follow-through), Q [2026-05-29] (Branch Protection Audit Implementation), Q [2026-06-01] (Substantive vs. Structural Audit Policy), Q [2026-06-01] (Audit Log Schema Enforcement), and Q [2026-06-15] (Audit Script Placeholder Rejection Policy). All are coverage expansions to the same gate; per [2026-05-20] precedent, they ship as one coherent unit because partial coverage gives a false sense of governance.
- **Impact:** Closes ten clarifications. Sub-tasks tracked in REQUIREMENTS.md under a single "Audit Script Coverage Sweep" entry; landing this collapses the "Audit Script Enforcement Depth", "Audit Script JSON Schema Blindness", and "Branch Protection Audit Gap" Known Limitations into a single resolution.

## [2026-06-16-0007] Persona Journal Section: Optional, Documented

- **Decision:** The `## Journal` section remains **optional**, not mandatory. Personas that already include it keep it; new personas may add it; `AGENT_TEMPLATE.md` documents it as a recommended extension for agents with reflective learning loops. The audit gate does not enforce its presence.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-01] (Persona Journal Section Standardization). Promoting `Journal` to mandatory would force 22 substantive rewrites across personas where reflection is not part of the role (e.g., deterministic gatekeeper reporting). Optional preserves the value where it fits without inventing safety theater.
- **Impact:** Closes the clarification. Sub-task: add a one-paragraph note to `docs/AGENT_TEMPLATE.md` documenting `## Journal` as a recommended extension.

## [2026-06-16-0008] Agent Index Extraction: Full First Paragraph

- **Decision:** `scripts/context_helpers.js` extracts the **full first paragraph** of the `## Role` section for the Agent Index, not the first sentence and not a new `### Summary` subsection. A paragraph is a natural narrative unit; introducing a new mandatory subsection would force 22 persona edits for marginal benefit.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Agent Index Role Truncation). Closes the "Agent Index Descriptive Truncation" Known Limitation once landed.
- **Impact:** Sub-task: update `scripts/context_helpers.js` extraction logic; regenerate golden fixtures with `scripts/update-golden-fixtures.js`.

## [2026-06-16-0009] Audit Log Channel: stderr with `AUDIT_LOG:` Prefix

- **Decision:** Audit Log emission stays on `stderr` (Decision [2026-04-13]) but every line is prefixed with the literal token `AUDIT_LOG: ` followed by the canonical JSON. This preserves the orchestrator contract while making capture unambiguous in environments where `stderr` mixes audit records with crash diagnostics. The prefix is documented in `AGENTS.md` and `REQUIREMENTS.md` Section 2.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Audit Log Descriptor Standardization). Dedicated FD 3 was considered and rejected: it works in Linux shells but breaks under Windows orchestrators, Docker logs drivers, and most n8n/LangChain transports. A line prefix is portable and trivially `grep`-able.
- **Impact:** Sub-tasks: (a) update `AGENTS.md` Audit Log section to mandate the prefix; (b) update `REQUIREMENTS.md` Section 2 Technical Emission paragraph; (c) refactor the shared `audit_logger.js` helper (see [2026-06-16-0010]) to emit with the prefix.

## [2026-06-16-0010] Internal Tool Observability: Shared `audit_logger.js`

- **Decision:** Implement a shared `scripts/audit_logger.js` utility as the canonical Node.js JSON Audit Log emitter, and refactor `tools/executive-assistant/`, `examples/gatekeeper-deployment/dashboard-ingest.js`, `scripts/generate_all.js`, and `scripts/audit-repo.js` to use it. The helper enforces the canonical shape (`task`, `inputs`, `actions`, `risks`, `result`), applies the `AUDIT_LOG:` prefix from [2026-06-16-0009], and is the only sanctioned audit emitter for Node.js tools in this repository. Internal tool events map to the schema as: `task` ← the tool's high-level operation name (e.g., `executive-assistant.triage`), `inputs` ← the request shape minus secrets, `actions` ← the ordered list of side effects (e.g., `["label.applied", "mail.archived"]`), `risks` ← any deferred or skipped actions with reason codes, `result` ← `"success"` or `"failure"` with optional reason.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Standardized Audit Log Emission for Build Utilities), Q [2026-05-02] (Tool Baseline Alignment Executive Assistant), Q [2026-05-19] (Internal Tool Observability Standard), Q [2026-05-29] (Internal Tool Observability Implementation), Q [2026-06-01] (Memory-Code Synchronization Drift — `audit_logger.js` re-implementation), Q [2026-06-10] (Mandated audit_logger.js Absence and Ownership), Q [2026-06-11] (audit_logger.js Mandated Absence), and Q [2026-06-15] (Internal Tool Audit Log Event Mapping). All seven are facets of the same missing utility plus its consumer-refactor; treating them separately created the appearance of unresolved disagreement when the answer is simply "ship the helper and the refactors together."
- **Impact:** Closes seven clarifications and the "Internal Tool Observability Gap" Known Limitation. Sub-tasks tracked in REQUIREMENTS.md.

## [2026-06-16-0011] verify-env.sh Docker-Mode Fatal Enforcement

- **Decision:** `scripts/verify-env.sh` (and the PowerShell equivalent `verify-env.ps1`) MUST exit with code 1 when SecretOps authentication is missing or invalid and the script is invoked with `docker` mode. The current warning-only behavior in `docker` mode is a bug relative to the mandate in `AGENTS.md` line 46 and Decision [2026-05-26] Pre-flight Logic Normalization — `builder` mode keeps the warning, `docker` mode hard-fails.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-11] (verify-env.sh Mode Discrepancy). The mandate already exists; this decision authorizes the remediation patch.
- **Impact:** Closes the "SecretOps Authentication Verification Depth" Known Limitation. Sub-task: update both verify-env scripts and add a test fixture covering the mode-conditional exit code.

## [2026-06-16-0012] sync-upstream.sh Environment-Variable Parameterization

- **Decision:** `scripts/sync-upstream.sh` is refactored to pull organization-specific values from environment variables with sensible defaults: `NOEMI_ORG_NAME` (default: the directory name of the script's parent repo), `NOEMI_UPSTREAM_URL` (default: the public Project NoéMI upstream URL), and `NOEMI_UPSTREAM_BRANCH` (default: `main`). The hardcoded `[MyOrganization]` placeholder and fixed URLs are removed. CLI flags (`--org`, `--upstream`, `--branch`) override environment variables.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Sync Script Parameterization) and Q [2026-06-11] (sync-upstream.sh Hardcoded Identity). The mandate already exists in `AGENTS.md` line 62 (Script Parameterization).
- **Impact:** Closes the "Sync Script Parameterization Gap" Known Limitation. Sub-task: implement the env-var parameterization, document the variables in `docs/UPSTREAM_SYNC.md`, and update `.env.template` with the new variables.

## [2026-06-16-0013] NOEMI_DOCKER_SMOKE_* Validation in Smoke Test

- **Decision:** `tests/examples-smoke.test.js` gains a dedicated test case that loads `.env.template`, enumerates all variables matching `NOEMI_DOCKER_SMOKE_*`, asserts each is documented (present in the file with a non-empty default or placeholder comment), and asserts each is referenced by at least one file under `examples/` or `tests/`. This closes Requirement §9's mandate that the default test suite cover `NOEMI_DOCKER_SMOKE_*` variable validation.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Docker Smoke Test Variable Validation) and Q [2026-06-11] (tests/examples-smoke.test.js Environmental Blindness).
- **Impact:** Closes the "Smoke Test Variable Validation Gap" Known Limitation. Sub-task: add the test case; document the expected variable inventory in a short README inside `tests/`.

## [2026-06-16-0014] Generator Script Consolidation: Retain Three Entry Points

- **Decision:** Retain `scripts/generate_all.js`, `scripts/generate_gemini.js`, and `scripts/generate_claude.js`. The two single-target generators delegate to `scripts/context_helpers.js` and re-export the same logic `generate_all.js` calls; they are thin wrappers, not duplicated logic. Removing them would break documented quick-start commands and external orchestrator integrations that invoke a specific generator by name. The maintenance overhead is negligible because the actual logic lives in `context_helpers.js`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-17] (Generator Script Redundancy). The premise that the wrappers are redundant is partially true (they share logic) but their existence is a public interface contract.
- **Impact:** No code changes. Sub-task: document in `scripts/README.md` (or the appropriate README) that `generate_all.js` is the canonical orchestrator and the per-client scripts are thin wrappers for direct invocation.

## [2026-06-16-0015] Casdoor Identity: Reference Skill Specification Only

- **Decision:** Implement a `skills/security/casdoor-validate.md` skill specification (persona-contract-compliant) describing the JWT-validation pattern for multi-tenant deployments. Do NOT implement JWT validation middleware in `dashboard-ingest.js` or any other reference service. The repository remains a definitions library (Decision [2026-03-03]); identity verification is an orchestrator/ingress concern (Decision [2026-04-02] Clarification Backlog Normalization line: "Identity verification is treated as an orchestrator or ingress responsibility rather than an agent-side Casdoor token contract"). The new skill documents the pattern so orchestrators know what to implement; reference services keep their current HMAC-based posture.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Identity Provider Implementation Gap) and Q [2026-05-22] (Casdoor Identity Integration Logic). The prior Clarification Backlog Normalization already settled this at the architectural level; this decision adds the missing skill file so the reference is discoverable.
- **Impact:** Sub-task: author `skills/security/casdoor-validate.md` following the Reusable Skill Contract.

## [2026-06-16-0016] RFP Split Asset Renaming

- **Decision:** Bulk-rename files in `examples/rfp-split/` to follow the English-first, slug-based naming convention (e.g., `Section_1_General_Information.pdf` → `section-1-general-information.pdf`). Any cross-references in code or documentation are updated in the same PR.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-13] (RFP Split Naming Convention Remediation). The mandate already exists; the audit script slug-naming check from [2026-06-16-0006] would flag these files once it lands, so renaming pre-empts noisy first-run failures.
- **Impact:** Sub-task: rename files and update references; verify with the slug-naming check after [2026-06-16-0006] ships.

## [2026-06-16-0017] Fleet Dashboard API Path Verification Sweep

- **Decision:** Treat Q [2026-05-15] as a closed verification request. Decision [2026-05-20] already standardized the path on `/api/v1/reports`; the verification sweep is captured as a one-shot sub-task in REQUIREMENTS.md rather than a standing clarification.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-15] (Test Suite Reinforcement of API Path Drift). Carrying a "did we actually do it" question in the active backlog when the durable answer is already logged inflates the queue.
- **Impact:** Sub-task: grep `examples/gatekeeper-deployment/dashboard-ingest.js` and `tests/examples-smoke.test.js` for `/api/v1/reports`; if either is missing, file a focused fix PR.

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
