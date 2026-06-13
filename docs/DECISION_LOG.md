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

## [2026-06-12-0001] ROI Auditor Baseline Data via Read-Only Google Sheets Range

- **Decision:** The ROI Auditor accesses "Human Baseline Time" and "Labor Rate" dictionaries via a read-only Google Sheets range on the existing public template (see `tools/roi/README.md`). No local JSON shadow copy is added to the repository: the public sheet is the single source of truth, and forks that want offline operation can mirror it themselves. The persona must declare a `read_rows` capability on the `google-sheets` MCP for the dictionary tab; this is additive to (not a replacement for) the append-log capability already used for execution logs.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-03] (ROI Auditor Baseline Data Access). The repository's pattern is to treat published Google Sheets templates as canonical (see [2026-04-03] ROI Google Sheets Template URL — Confirmed); duplicating those dictionaries into the repo would create drift without operational benefit.
- **Impact:** No new file is added. The `ROI Auditor` persona's `External Tooling Dependencies` and `Capabilities` sections are the place to document the read-only range. Fleet operators continue to maintain dictionaries in the Sheet, not in code.

## [2026-06-12-0002] Fleet Dashboard Retention: Single 90-Day Bucket With Documented Roll-Up Pattern

- **Decision:** The Gatekeeper reference compose file keeps the single InfluxDB bucket with a 90-day retention policy. The `Fleet Dashboard` persona is updated to reflect this as the reference baseline and to describe long-term aggregate retention as an *operator extension* (downsampling task into a second `agent_summaries` bucket) rather than a mandatory part of the reference stack. The reference architecture demonstrates the path; production deployers size retention to their own compliance regime.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Fleet Dashboard Retention Policy Drift). The persona had drifted ahead of the reference implementation; aligning the persona to the truthful 90-day baseline (and documenting the extension pattern) avoids over-promising what the reference stack actually ships.
- **Impact:** Persona is truthful against the compose file; deployers with a 1-year aggregate requirement get a clear extension recipe instead of an unimplemented promise. Closes the `Fleet Dashboard Retention Drift` symptom without expanding the reference compose surface.

## [2026-06-12-0003] Red Team Gauntlet: Ship Starter Test Vectors

- **Decision:** The `examples/red-team-gauntlet/` directory must contain a starter `test-vectors.yaml` with the five validation cases the `Client Onboarding` agent mandates (covering prompt injection and PII patterns). The starter set is illustrative and labeled as such; production deployers extend it with their own organizational vectors. The Client Onboarding persona is the consumer of the file; the file is the contract.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Red Team Gauntlet Test Vector Absence). The persona referenced a contract artifact that did not exist, creating a "the spec lies about its own examples" drift identical to the Onboarding Directory Bootstrap pattern resolved in [2026-05-28-0002].
- **Impact:** Onboarding workflow becomes runnable against a real fixture instead of a missing path. Tracked separately as a follow-up implementation item; this decision is the durable answer.

## [2026-06-12-0004] Fleet Dashboard Multi-Tenancy: Persona Simplified to Reference Truth

- **Decision:** The `Fleet Dashboard` persona is simplified to reflect the current single-tenant reference implementation. The multi-tenant registry, per-agent HMAC secrets, and asynchronous GitHub verification described in the previous persona text are moved to an explicit "Operator Extensions" section. The reference compose stack is *one tenant, one HMAC secret, one ingest endpoint* — the same pattern customers extend, not a finished multi-tenant SaaS.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Fleet Dashboard Multi-tenancy Implementation Gap). The persona had drifted into describing a SaaS-grade product; aligning it to the reference architecture posture (per Decision [2026-04-02] Balanced Reference + Implementation Alignment) restores truth-telling.
- **Impact:** Persona is truthful; deployers needing multi-tenant get a clear extension brief; the reference compose stack stops carrying an unwritten contract. Closes the `Fleet Dashboard Multi-tenancy Implementation Gap` from `REQUIREMENTS.md` Current Known Limitations.

## [2026-06-12-0005] Gatekeeper Mutating Actions: Dry-Run Mode With Explicit Off-by-Default

- **Decision:** The Gatekeeper reference implementation gains a documented "dry-run" mode for mutating actions (merging PRs, closing issues). The implementation prints the action it *would* take and the rationale, then emits the standard audit log; it does not call the GitHub API in this mode. A non-dry-run mode is left to operators to wire up against their own secrets and policy; the reference compose ships with dry-run as the default and a clear `GATEKEEPER_MUTATING_MODE=off|dry-run|live` environment switch documented in `.env.template` and the deployment README.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-23] (Gatekeeper Reference Implementation Mutating Actions). The reference stack must demonstrate the action path without shipping a "merge any PR" risk by default. Dry-run is the same pattern the Branch Protection mandate ([2026-05-20]) takes: visible governance, safe default.
- **Impact:** Persona and reference stack agree on the action surface; deployers see exactly what the agent would do before granting it write scopes. Tracked separately as a follow-up implementation item.

## [2026-06-12-0006] Substantive Persona and Skill Remediation: Incremental, Domain-Owned

- **Decision:** Substantive remediation of placeholder `Data Inventory`, `Refusal Criteria`, and `Audit Log` sections in agent personas and skills proceeds incrementally as domain-specific work happens, not as a single fleet-wide bulk update. Each persona/skill is brought into substantive compliance by the next PR that touches it for any reason; `scripts/audit-repo.js` continues to enforce structural compliance, and a per-PR convention requires that any persona or skill touched in a PR exits the PR in substantive compliance with its `Data Inventory` and `Refusal Criteria` sections.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-26] (Substantive Persona Content Drift), Q [2026-05-02] (Skill Contract Enforcement Depth), Q [2026-05-10] (Substantive Persona Remediation Strategy), and Q [2026-05-28] (Substantive Remediation of the Skill Library). A one-shot bulk update would produce 22+ files of model-authored "plausible content" with no domain accountability; the incremental rule keeps quality high while still driving the placeholder count to zero on a predictable cadence.
- **Impact:** `REQUIREMENTS.md` Current Known Limitations entry "Structural vs. Substantive Compliance" reframed to track the *count* of placeholder files rather than a missing bulk operation. Each PR is a small, reviewable remediation step.

## [2026-06-12-0007] Audit Script Enhancements: Single Coherent Expansion

- **Decision:** The following audit-script enhancements are batched into a single coherent expansion of `scripts/audit-repo.js`, planned but not landed in this PR: (a) Node baseline check that flags any `Dockerfile` or `docker-compose.yml` referencing `node:<24`; (b) referential integrity check that every `active_mcps` / `active_skills` entry in `mcp.config.json` maps to an existing file; (c) naming convention regex check across `docs/`, `agents/`, `skills/`, `examples/`, `tools/`; (d) Refusal Criteria substantive regex check for the three mandated clauses; (e) AI model baseline regex flagging non-`gemini-2.5-flash` model pins in `examples/` and `tests/`; (f) skill-to-agent referential integrity check parsing agent `Workflow` sections for `**Skill:** [path]` references. These all share the same scan-files-and-regex shape and ship together so the audit gate moves once, not six times.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-01] (Node.js 24 Baseline Enforcement in Docker), Q [2026-05-02] (Config-to-Asset Mapping Validation), Q [2026-05-02] (Automated Naming Convention Audit), Q [2026-05-02] (Refusal Criteria Substantive Enforcement), Q [2026-05-15] (Skill-to-Agent Referential Integrity), and Q [2026-05-20] (AI Model Version Baseline Formalization Follow-through). Consistent with the [2026-05-20] Audit Script Coverage Expansion philosophy that partial coverage gives a false sense of governance.
- **Impact:** A single follow-up PR will land all six checks together; the existing `Current Known Limitations` entries collapse into one resolution. Until shipped, the limitations remain tagged as open.

## [2026-06-12-0008] Persona Journal Section: Optional, Not Mandatory

- **Decision:** The `## Journal` section is NOT added to the mandatory persona contract. Personas that benefit from cross-fleet learning notes (typically long-lived operations agents) may include a `## Journal` section, but it is explicitly optional and not enforced by `scripts/audit-repo.js`. The canonical persona contract remains as documented in `REQUIREMENTS.md` §2.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-01] (Persona Journal Section Standardization). Mandating Journal across 22+ personas would produce 22 placeholder Journal sections — the same drift pattern the substantive remediation decision ([2026-06-12-0006]) is structured to avoid. Journal works best as voluntary observability for agents with operational continuity needs.
- **Impact:** No structural change to `AGENTS.md` or `AGENT_TEMPLATE.md`. Existing Journal sections in some personas are valid and preserved.

## [2026-06-12-0009] Audit Log Capture Channel: Stderr With JSON-Per-Line Prefix Convention

- **Decision:** Agents and internal tools continue to emit JSON Audit Logs to `stderr` (per Decision [2026-04-13]). To disambiguate audit lines from technical crash output in orchestrator environments that conflate the two, each audit line should be emitted as a single self-contained JSON object on its own line (newline-delimited JSON). Orchestrators that need stronger separation may parse `stderr` for lines that are valid JSON containing the `task` key. A dedicated file descriptor (FD 3) is NOT mandated, because most container runtimes (Docker, Kubernetes) do not propagate FDs above 2 by default.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Audit Log Descriptor Standardization). The newline-delimited-JSON convention is already what most reference services emit; this decision formalizes it.
- **Impact:** `AGENTS.md` Observability section is the place to document the NDJSON convention. No code changes are required for services already emitting one JSON object per `console.error` call.

## [2026-06-12-0010] Internal Tool and Build Utility Observability: Adopt Stderr JSON Audit Log

- **Decision:** Build utilities (`scripts/generate_all.js`, `scripts/audit-repo.js`, `scripts/update-golden-fixtures.js`) and internal Node.js tools in `tools/` (e.g., `executive-assistant`) and reference services in `examples/` (e.g., `dashboard-ingest.js`) must emit a structured JSON Audit Log to `stderr` summarizing files read, files modified, risks, and result. The audit log shape matches the canonical persona contract: `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`. Tracked as a follow-up implementation item; this decision is the durable answer.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Standardized Audit Log Emission for Build Utilities), Q [2026-05-02] (Tool Baseline Alignment — Executive Assistant), and Q [2026-05-19] (Internal Tool Observability Standard). These are restatements of the same drift; collapsing them into one decision matches the [2026-05-28-0006] consolidation pattern.
- **Impact:** Closes the `Audit Log Emission Gaps` and `Internal Tool Observability Gap` items from `REQUIREMENTS.md` Current Known Limitations once the follow-up implementation lands.

## [2026-06-12-0011] Casdoor Identity Integration: Reference Skill Plus Middleware Sample

- **Decision:** A `skills/security/casdoor-validate.md` skill specification will document JWT validation against a Casdoor instance, and `examples/gatekeeper-deployment/dashboard-ingest.js` will gain an optional middleware sample that demonstrates the validation flow. The sample is off by default (gated on `CASDOOR_VALIDATE_TOKENS=true`) so the reference compose stack continues to start without a Casdoor service running. This pattern mirrors the dry-run philosophy in [2026-06-12-0005]: ship the demonstration, leave activation to the operator.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Identity Provider Implementation Gap) and Q [2026-05-22] (Casdoor Identity Integration Logic). Both ask the same question; the architectural answer was set in [2026-03-03] (Casdoor as reference identity layer) but the implementation had never landed.
- **Impact:** The identity-layer requirement becomes truthful in the repository. Tracked separately as a follow-up implementation item; this decision is the durable answer.

## [2026-06-12-0012] Agent Index Extracts Full First Paragraph

- **Decision:** `scripts/context_helpers.js` is updated to extract the full first paragraph of the `## Role` section for the Agent Index, rather than only the first sentence. Multi-sentence role definitions are preserved; the column is widened in the generated table but no schema change is required. A separate `### Summary` subsection is NOT introduced — it would create another required heading without sufficient operational benefit.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Agent Index Role Truncation). The current first-sentence behavior truncates role descriptions in misleading ways for complex agents; first-paragraph is the lowest-impact correct fix.
- **Impact:** Closes the `Agent Index Accuracy Drift` item from `REQUIREMENTS.md` Current Known Limitations once the implementation lands. Golden fixtures for `AGENT_INDEX` will need to be regenerated as part of that change.

## [2026-06-12-0013] RFP Split Naming Remediation: Approved

- **Decision:** Rename the files in `examples/rfp-split/` to follow the English-first, slug-based naming convention (e.g., `Section_1_General_Information.pdf` → `section-1-general-information.pdf`). Internal references in `examples/rfp-split/README.md` and any test fixtures are updated in lockstep. This is the same remediation pattern applied to `docs/n8n workflows/` in Decision [2026-05-10].
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-13] (RFP Split Naming Convention Remediation). Naming drift in examples directly contradicts the AGENTS.md mandate and the [2026-05-10] precedent.
- **Impact:** Tracked separately as a follow-up implementation item; this decision is the durable answer.

## [2026-06-12-0014] Fleet Dashboard API Path Verification: Confirmed Aligned

- **Decision:** Manual verification of `examples/gatekeeper-deployment/dashboard-ingest.js` and `tests/examples-smoke.test.js` against Decision [2026-05-20] (Fleet Dashboard Ingestion Path) confirms both files now use `/api/v1/reports`. No further action is required; the lockstep update mandated in the original decision has landed.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-15] (Test Suite Reinforcement of API Path Drift). The implementation follow-through was outstanding when the clarification was filed but is now in place.
- **Impact:** Confirms closure of the `Reference implementation Path Inconsistency` and `Test Suite Reinforcement of Technical Drift` items.

## [2026-06-12-0015] Generator Script Consolidation: Standardize on generate_all.js

- **Decision:** `scripts/generate_gemini.js` and `scripts/generate_claude.js` are deprecated in favor of `scripts/generate_all.js` as the sole entry point for context generation. The two single-target scripts may remain as thin wrappers that invoke `generate_all.js` with a target filter, or be removed outright in a follow-up PR. The `package.json` `generate` script already points to `generate_all.js`; no consumer-facing behavior changes.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-17] (Generator Script Redundancy). Three entry points doing the same work is maintenance overhead with no operational benefit.
- **Impact:** Tracked separately as a follow-up implementation item; this decision is the durable answer. The consolidation will need a generators.test.js update if the wrappers are removed.

## [2026-06-12-0016] Golden Fixture Coverage Expansion: Value Lenses and Operating Profiles

- **Decision:** The golden fixture safety net in `tests/golden-fixtures.test.js` and `scripts/update-golden-fixtures.js` is expanded to cover all six template injection markers (adding `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS`). Two new fixture files `tests/fixtures/generated/value-lenses.md` and `tests/fixtures/generated/operating-profiles.md` are added so that regressions in either framework section are caught by `npm test`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Golden Fixture Coverage Gap). Decision [2026-05-28-0005] mandated injection but the fixtures never followed; this closes the regression gap with a one-PR change.
- **Impact:** Closes the `Golden Fixture Coverage Gap (Value Lenses & Operating Profiles)` item from `REQUIREMENTS.md` Current Known Limitations. Implemented in this PR.

## [2026-06-12-0017] Skill Contract Test Symmetry

- **Decision:** A new `all skills expose the required contract headings` test is added to `tests/contracts.test.js`, symmetrical to the existing persona test. The test discovers all `*.md` files under `skills/` (excluding `SKILL_TEMPLATE.md`) and asserts each exposes the canonical `REQUIRED_SKILL_SECTIONS` headings (`Purpose`, `Inputs`, `Procedure`, `Outputs`, `Data Inventory`, `Rules & Constraints (4D Diligence)`, `Boundaries`, `Audit Log`). Skill contract compliance now lives in both `npm run audit` and `npm test`, matching the persona path.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Test Harness Skills Coverage Asymmetry). Skills were being checked only by the audit gate; developers running `npm test` alone got a false-green for skill contract violations.
- **Impact:** Closes the `Test Harness Skills Coverage Asymmetry` item from `REQUIREMENTS.md` Current Known Limitations. Implemented in this PR.

## [2026-06-12-0018] Gatekeeper Config Schema: Document via Example

- **Decision:** A `.gatekeeper/config.yml.example` file is added documenting the full YAML schema for the Gatekeeper configuration surface: repo allowlist, file-pattern overrides, diff-size thresholds, and conflict grace period. The example is the documentation; the `.gatekeeper/.gitignore` already ensures runtime config does not leak into git. A reference to the example is added to `agents/engineering/gatekeeper.md`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Gatekeeper Config Schema Absent). The persona named the config file as the primary operational surface but provided no schema; this closes that documentation gap without expanding the audit surface.
- **Impact:** Closes the `Gatekeeper Config Schema Absent` item from `REQUIREMENTS.md` Current Known Limitations. Implemented in this PR.

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
