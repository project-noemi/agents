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

## [2026-06-19-0001] Shared audit_logger.js Utility — Ship It

- **Decision:** The mandated shared utility `scripts/audit_logger.js` is implemented in this PR. It exposes `emit(record, options)`, `createLogger(source)`, `normalize(record)`, and `validate(record)`. Records are emitted as one NDJSON line to `stderr` per event. The canonical schema is the same lightweight shape already mandated for agents (`task`, `inputs`, `actions`, `risks`, `result`); an optional `source` tag and ISO `timestamp` are added by the emitter. Internal tools (`tools/executive-assistant`) and reference services (`examples/gatekeeper-deployment/dashboard-ingest.js`) SHOULD adopt it incrementally; the utility itself is the prerequisite that has been missing.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] Standardized Audit Log Emission for Build Utilities, Q [2026-05-02] Audit Log Descriptor Standardization, Q [2026-05-02] Tool Baseline Alignment (Executive Assistant), Q [2026-05-19] Internal Tool Observability Standard, Q [2026-05-29] Internal Tool Observability Implementation, Q [2026-06-01] Memory-Code Synchronization Drift (audit_logger.js portion), Q [2026-06-10] Mandated audit_logger.js Absence and Ownership, Q [2026-06-11] audit_logger.js Mandated Absence, Q [2026-06-15] Internal Tool Audit Log Event Mapping, and Q [2026-06-17] Internal Tool Audit Log Mapping. The file was repeatedly referenced as if it existed; its absence has been the single largest source of observability drift in the repository. Industry practice (e.g. `pino`, `winston`) standardizes one logger per service; best practice for a reference architecture is the smallest dependency-free shim that enforces a schema; the recommendation, accordingly, is a single-purpose stderr NDJSON emitter with no third-party dependencies.
- **Impact:** Closes the "Internal Tool Observability Gap" prerequisite. Downstream adoption work (refactoring `executive-assistant` and `dashboard-ingest` to call the shared module) is now an implementation chore rather than a missing dependency, and is tracked as an open requirement until completed. Event-to-schema mapping is the caller's responsibility: tools map their domain events (`SYNC_COMPLETE`, `TRIAGE_VIP`, etc.) into the `task` field, with structured detail in `inputs`/`actions`/`risks`/`result`.

## [2026-06-19-0002] sync-upstream.sh — Environment-Driven Parameterization

- **Decision:** `scripts/sync-upstream.sh` reads `NOEMI_UPSTREAM_REMOTE`, `NOEMI_UPSTREAM_URL`, `NOEMI_LOCAL_BRANCH`, and `NOEMI_ORG_NAME` from the environment with sensible defaults that preserve the original behavior. The hardcoded `MY_ORGANIZATION="[MyOrganization]"` placeholder is replaced; forks may set `NOEMI_ORG_NAME` in their shell or wrapper script instead of patching the source file.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] Sync Script Parameterization, Q [2026-06-11] sync-upstream.sh Hardcoded Identity, and the sync-script portion of Q [2026-06-01] Memory-Code Synchronization Drift. Industry practice is to expose org-specific values through env vars or CLI flags (see `gh`, `git-extras`); best practice for cross-org reference scripts is to provide defaults so a clean clone still runs; the recommendation is therefore env-var overrides with the upstream defaults retained.
- **Impact:** Closes the "Sync Script Parameterization Gap" item under Current Known Limitations. Forks can run the script unmodified.

## [2026-06-19-0003] tests/examples-smoke.test.js — NOEMI_DOCKER_SMOKE_* Inventory Gate

- **Decision:** `tests/examples-smoke.test.js` gains a dedicated test that (1) scans `tests/e2e/docker-smoke.test.js` for every `NOEMI_DOCKER_SMOKE_*` reference, (2) asserts each referenced variable is declared in `.env.template`, and (3) asserts each declaration carries a non-empty default value. The assertion is symmetric with the requirement in §9 (Docker env inventory coverage).
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] Docker Smoke Test Variable Validation and Q [2026-06-11] tests/examples-smoke.test.js Environmental Blindness. Industry practice is to gate runtime env contracts at the test boundary (e.g. `dotenv-safe`); best practice is bidirectional verification — every consumer must be inventoried, and every inventoried variable must have a usable default; the recommendation is the bidirectional check implemented here.
- **Impact:** Closes the "Smoke Test Variable Validation Gap" item under Current Known Limitations. Future additions to the e2e suite that introduce a new `NOEMI_DOCKER_SMOKE_*` variable without a matching inventory entry will fail `npm test` immediately.

## [2026-06-19-0004] Resilience Helpers Integration — Reaffirmed Reference-Only Scope

- **Decision:** `scripts/resilience_helpers.js` remains a reusable reference pattern. It is NOT force-integrated into `scripts/audit-repo.js` or `scripts/generate_all.js`. The "Resilience Helper Integration Gap" entry under Current Known Limitations is closed as overtaken by events: it duplicates the [2026-04-04] decision that already settled this scope.
- **Context:** Resolves the resilience-helper portion of CLARIFICATIONS.md Q [2026-06-01] Memory-Code Synchronization Drift. The 2026-04-04 decision explicitly carved retry logic out of deterministic local-FS tools; the open limitation entry was tracking a phantom requirement.
- **Impact:** Removes the limitation from `REQUIREMENTS.md` Current Known Limitations to keep the truth list honest.

## [2026-06-19-0005] Bulk Closure of Clarifications Subsumed by 2026-05-20 Audit Coverage Decision

- **Decision:** The following CLARIFICATIONS.md questions are closed as already-resolved by [2026-05-20] Audit Script Coverage Expansion (Skills + JSON Schema) and are removed from the active backlog without further action. The decision already mandates that `audit-repo.js` validate JSON Audit Log schema and apply the persona-contract checks to `skills/`; the implementation work to actually wire those checks is tracked as an open requirement in `REQUIREMENTS.md`, not as an open clarification.
  - Q [2026-05-02] Config-to-Asset Mapping Validation → subsumed (referential integrity is part of the same coverage expansion).
  - Q [2026-05-02] Refusal Criteria Substantive Enforcement → subsumed.
  - Q [2026-05-02] Skill Contract Enforcement Depth → subsumed.
  - Q [2026-05-15] Skill-to-Agent Referential Integrity → subsumed.
  - Q [2026-06-01] Audit Log Schema Enforcement → subsumed.
  - Q [2026-06-01] Substantive vs. Structural Audit Policy → subsumed by combination of [2026-05-20] and the substantive-content questions still open below.
  - Q [2026-06-15] Audit Script Placeholder Rejection Policy → subsumed.
  - Q [2026-06-17] Automated Internal Documentation Link Integrity → subsumed (link-integrity is the same referential-integrity work item).
- **Context:** Multiple clarifications restate the [2026-05-20] decision in different language. Carrying them as open questions misrepresents the queue.
- **Impact:** CLARIFICATIONS.md shrinks; the work itself remains visible as "Audit Script Enforcement Depth" under Current Known Limitations in `REQUIREMENTS.md`.

## [2026-06-19-0006] MCP Protocol Contract and Framework Asset Audits — Approved Scope

- **Decision:** MCP protocol specifications in `mcp-protocols/` SHALL be brought under a mandatory structural contract: `Purpose`, `Inputs`, `Procedure`, `Outputs`, `Rules & Constraints`, `Boundaries`, `Audit Log`. Likewise, `value-lenses/` and `operating-profiles/` SHALL be audited for alignment with their respective `*_TEMPLATE.md` files (mandatory headings only). `scripts/audit-repo.js` SHALL acquire the corresponding checks. This is a scope decision; the implementation is tracked under "Audit Script Enforcement Depth" in `REQUIREMENTS.md` Current Known Limitations alongside the existing skills/JSON-schema coverage gap.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-17] MCP Protocol Specification Contract Audit Gap and Q [2026-06-17] Value Lens and Operating Profile Structural Audit. Industry practice for tool-governance layers is to apply the same structural contract used for agents; best practice is single-source enforcement via the shared audit gate; the recommendation is therefore extension of `audit-repo.js` rather than a new script.
- **Impact:** Closes the "MCP Protocol Structural Audit Gap" and "Framework Asset Structural Audit Gap" entries as scope-resolved; they remain open as implementation tasks under the consolidated audit-coverage limitation.

## [2026-06-19-0007] verify-env.sh — Docker Mode Hard-Fail (Reaffirmed)

- **Decision:** `scripts/verify-env.sh` and `scripts/verify-env.ps1` MUST `exit 1` when the selected mode is `docker` AND no SecretOps CLI (`op` or `infisical`) is detected, OR a CLI is detected but the active-authentication probe (`op user get --me` / `infisical whoami`) fails. The `builder` mode retains warning-only behavior. This reaffirms and concretizes the [2026-05-26] Pre-flight Logic Normalization decision, which was already binding; the implementation in the current `verify-env.sh` only warns. The implementation work is tracked under "SecretOps Authentication Verification Depth" in `REQUIREMENTS.md` Current Known Limitations.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-11] verify-env.sh Mode Discrepancy. The earlier decision settled the policy; the current script does not match it. No further clarification is required; only an implementation pass.
- **Impact:** Closes the clarification. The limitation entry stays open as a concrete implementation task.

## [2026-06-19-0008] Red Team Gauntlet Serialization — Single test-vectors.json

- **Decision:** The Red Team Gauntlet test cases SHALL be serialized into a single machine-readable file `examples/red-team-gauntlet/test-vectors.json`, with a top-level shape of `{ "prompt_injection": [...], "pii_patterns": [...] }`. Each entry carries `id`, `name`, `category`, `payload` (string for prompt injection, object for PII), and `expected` (`BLOCKED` or `REDACTED`). The prose `README.md` remains the human-readable companion. A single file is preferred over per-category files for atomic loading by the Client Onboarding agent's validation suite.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] Red Team Gauntlet Test Vector Absence, Q [2026-06-10] Red Team Gauntlet Machine-Readable Test Vectors, and Q [2026-06-15] Red Team Gauntlet Serialization Strategy. Industry practice for adversarial test suites (e.g. OWASP LLM Top-10 reference vectors, Garak) is JSON/YAML with a small number of top-level categories; best practice is a single file when category count is low (<10) to keep the validation runner trivial; the recommendation is therefore a single JSON file. The implementation is tracked as an open requirement; this decision only fixes the format.
- **Impact:** Closes the three clarifications. The "Red Team Gauntlet Machine-Readable Serialization Gap" limitation in `REQUIREMENTS.md` stays open as an implementation task with a defined target shape.

## [2026-06-19-0009] Service Tier Templates — Deferred to PO

- **Decision:** Implementation of `templates/tiers/basic.md`, `standard.md`, `premium.md` requires concrete service definitions (features, included MCPs/skills, limits, pricing tier) that are a Product Owner / commercial decision, not a technical default. The clarifications asking for these templates remain LEFT for human input until the PO provides the definitions. The directory and tracked README already exist (Decision [2026-05-28-0002]) so persona references do not break.
- **Context:** Concerns CLARIFICATIONS.md Q [2026-06-10] Empty Tier Templates Implementation Gap and Q [2026-06-15] Service Tier Template Specifications. Neither is technically answerable; both ask for commercial product definitions. Leaving them open is correct per the automation contract.
- **Impact:** No change to CLARIFICATIONS.md or REQUIREMENTS.md for these items; logged here so the next automation pass does not re-litigate them.

## [2026-06-19-0010] Substantive Persona/Skill Remediation — Deferred to PO/Domain Experts

- **Decision:** Bulk substantive remediation of placeholder `Data Inventory`, `Refusal Criteria`, and `Audit Log` content across all 22+ agent personas and all reusable skills requires role-specific domain knowledge that cannot be supplied autonomously without risking incorrect safety-gating logic. The relevant clarifications remain LEFT for human input until the PO authorizes a remediation campaign with domain-expert review. Structural compliance remains enforced by `audit-repo.js`; substantive checks are tracked separately and are gated on this authorization.
- **Context:** Concerns CLARIFICATIONS.md Q [2026-04-05] Substantive Persona Content Drift, Q [2026-05-10] Substantive Persona Remediation Strategy, Q [2026-05-28] Substantive Remediation of the Skill Library, Q [2026-05-29] Skill Remediation Priority, and Q [2026-06-17] Substantive Content Baseline for Agents. All five ask the same question (authorize a bulk autonomous rewrite of safety-critical content) and the answer should not be made by automation.
- **Impact:** No change to CLARIFICATIONS.md or REQUIREMENTS.md for these items; logged here as a durable record that the question is recognized but intentionally not auto-resolved. Future automation passes should not reopen this.

## [2026-06-19-0011] Operating Profile Baseline — Implementation Approved (Bounded)

- **Decision:** A small baseline set of Operating Profiles SHALL be authored: `standard-operating-profile.md` (neutral default), `high-trust-regulated.md` (financial/healthcare-style cautious posture), and `fast-iteration-startup.md` (startup-style direct posture). These are baseline reference profiles, not exhaustive cultural catalogs. They are tracked as an open implementation task in `REQUIREMENTS.md` and not implemented in this PR (scope was bounded to the three highest-impact items already shipped).
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-15] Operating Profile Baseline Absence. Industry practice for templated frameworks is to ship neutral starter profiles so the injection mechanism is exercised; best practice is 2-4 starters covering distinct postures; the recommendation is the three named here.
- **Impact:** Closes the clarification. The "Operating Profile Substantive Gap" entry under Current Known Limitations is updated to reference the approved starter set as the target.

## [2026-06-19-0012] Node.js 24 Baseline Audit, AI Model Baseline Audit, Naming Convention Audit, Generator Script Deduplication — Approved Scope

- **Decision:** The following audit-script enhancements are approved in scope and rolled into the consolidated audit-coverage limitation in `REQUIREMENTS.md`:
  - Add a check that scans `Dockerfile` and `docker-compose.yml` for `node:<24` images and reports as a warning (CLARIFICATIONS Q [2026-05-01]).
  - Add a check that scans `examples/` and `tests/` for non-baseline AI model pins (`gemini-2.5-flash` is the canonical baseline; warn on others) (CLARIFICATIONS Q [2026-05-20]).
  - Add a regex-based filename audit for English-first, slug-based naming across `docs/`, `agents/`, `skills/`, `examples/`, `tools/` (CLARIFICATIONS Q [2026-05-02]).
  - Add a branch-protection probe that surfaces missing protection as warning (non-CI) or error (CI=true) (CLARIFICATIONS Q [2026-05-29]).
  - Deprecate `scripts/generate_gemini.js` and `scripts/generate_claude.js` in favor of `scripts/generate_all.js` (CLARIFICATIONS Q [2026-05-17]); they remain temporarily as thin shims that delegate to the orchestrator.
  - Update `scripts/context_helpers.js` to extract the full first paragraph (not the first sentence) of `## Role` for the Agent Index (CLARIFICATIONS Q [2026-05-02]).
  - Persona Journal section remains OPTIONAL; not promoted to a mandatory contract heading because the structural payload is already heavy and Journal is genuinely role-specific. (CLARIFICATIONS Q [2026-05-01]).
- **Context:** Each of these clarifications is technically answerable from the existing mandates in `AGENTS.md` and `REQUIREMENTS.md` and does not require PO judgment. Industry practice for governance gates is layered automated checks; best practice is to consolidate them in one audit script rather than scatter; the recommendation is therefore extension of `audit-repo.js`. Journal is the only outlier: making it mandatory would invalidate every existing persona without proportional benefit.
- **Impact:** Closes the listed clarifications. Implementation work is tracked under the "Audit Script Enforcement Depth" consolidated entry plus the existing "Agent Index Descriptive Truncation" entry in `REQUIREMENTS.md`.

## [2026-06-19-0013] Fleet Dashboard / Gatekeeper Mutating Actions / Casdoor Integration — Deferred to Product Owner

- **Decision:** Three clarifications ask whether to expand the reference implementations to match more ambitious persona specifications (Fleet Dashboard multi-tenancy + verification worker, Gatekeeper mutating actions, Casdoor integration logic). All three are scope questions about how much of the persona to materialize in the reference repo vs. leave to consumers. They remain LEFT for PO input.
- **Context:** Concerns CLARIFICATIONS.md Q [2026-04-05] Fleet Dashboard Multi-tenancy Implementation Gap, Q [2026-04-23] Gatekeeper Reference Implementation Mutating Actions, Q [2026-05-02] Identity Provider Implementation Gap, and Q [2026-05-22] Casdoor Identity Integration Logic. Implementing them would materially expand the runtime surface of the reference repo, which conflicts with the [2026-03-03] "definitions library" decision unless the PO explicitly authorizes the expansion.
- **Impact:** No change to CLARIFICATIONS.md or REQUIREMENTS.md; logged for traceability.

## [2026-06-19-0014] Fleet Dashboard Retention Policy and API Path Verification — Approved Scope

- **Decision:** Two narrow clarifications resolve to implementation tasks, not PO questions:
  - Q [2026-04-05] Fleet Dashboard Retention Policy Drift: the reference compose SHALL provision a second InfluxDB bucket (`agent_summaries`) with 365-day retention and a downsampling task, OR the persona text SHALL be downgraded to a single 90-day window. Pick the latter when implementing in the reference repo (less moving parts; persona is the documentation, the runtime is the consumer's responsibility); promote to dual-bucket only when an actual downstream demand exists. Logged as a documentation-edit task in `REQUIREMENTS.md`.
  - Q [2026-05-15] Test Suite Reinforcement of API Path Drift: a single verification sweep is needed; if `dashboard-ingest.js` and `tests/examples-smoke.test.js` already use `/api/v1/reports` (the smoke test in this PR confirms they do), the clarification is closed. Verified in this PR via the existing assertion at `tests/examples-smoke.test.js:46`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] Fleet Dashboard Retention Policy Drift and Q [2026-05-15] Test Suite Reinforcement of API Path Drift.
- **Impact:** Q [2026-05-15] closes outright (verification complete). Q [2026-04-05] retention closes with a recorded preference for the simpler "downgrade persona" approach; the actual edit is a future small PR.

## [2026-06-19-0015] ROI Auditor Baseline Data Access — Local JSON Reference File

- **Decision:** The `ROI Auditor` persona SHALL read its baseline-time and labor-rate dictionaries from a local `tools/roi/baseline-config.json` file checked into the repository, rather than from a live Google Sheets range. The Sheets template remains the human-editable source; `baseline-config.json` is the machine-readable snapshot updated when the template changes. This avoids adding a `google-sheets-read` capability to the `ROI Auditor` capability list, which would expand its blast radius beyond append-only ROI logging.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-03] ROI Auditor Baseline Data Access. Industry practice for auditor-style agents is to read read-only data from a committed snapshot to keep the audit trail reproducible; best practice is to separate the human-editable canonical source (Sheets) from the machine-consumed snapshot (JSON); the recommendation is therefore a JSON snapshot in the repo. Implementation tracked as a small open task; the persona update plus a one-shot export script are sufficient.
- **Impact:** Closes the clarification. New open requirement entry added to `REQUIREMENTS.md`.

## [2026-06-19-0016] Bulk Closure — Memory-Code Sync Drift Components

- **Decision:** Q [2026-06-01] Memory-Code Synchronization Drift is resolved component-wise across this PR and prior decisions: (a) `audit_logger.js` shipped in this PR (Decision [2026-06-19-0001]); (b) `sync-upstream.sh` parameterized in this PR (Decision [2026-06-19-0002]); (c) Agent Index first-paragraph extraction scope-approved (Decision [2026-06-19-0012], implementation pending). With these three components resolved, the umbrella question is closed.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-01] Memory-Code Synchronization Drift.
- **Impact:** Closes the clarification. Remaining work is tracked as concrete limitation entries in `REQUIREMENTS.md`, not as a sprawling umbrella question.

## [2026-06-30-0001] sync-upstream.sh — Reviewed-PR Model + Offline Test Harness

- **Decision:** `scripts/sync-upstream.sh` is hardened to a **reviewed pull-request** model instead of pushing merges directly to `develop`. It creates a collision-safe `sync/upstream-*` branch from `origin/develop`, merges `upstream/main` then `upstream/develop` auto-resolving content conflicts with `-X ours`, surfaces every overridden file in the PR body, and opens the PR via `gh`. A duplicate guard refuses to open a second sync PR while one is open; structural conflicts (rename, modify/delete) stop the run for manual resolution and resume via `--continue`. A companion offline harness `scripts/test-sync-upstream.sh` verifies override surfacing, `--continue`, dry-run, and the duplicate guard with a stubbed `gh` (no network/auth). The environment-driven parameterization from Decision [2026-06-19-0002] is preserved (`NOEMI_UPSTREAM_REMOTE`, `NOEMI_UPSTREAM_URL`, `NOEMI_LOCAL_BRANCH`).
- **Context:** The previous script pushed merges straight to `develop`, leaving no human review gate and silently dropping upstream hunks on conflict. Best practice for a governed fork that tracks a moving upstream is to *propose* changes through a reviewed PR with a visible record of what local customization overrode upstream. Supports a daily scheduled Claude Code routine (see `docs/SYNC_AGENT_PROMPT.md`) without PR pile-up.
- **Impact:** `docs/UPSTREAM_SYNC.md` updated (new "PR-Based Sync (Reviewed)" section, `--continue` flow, `gh`/Claude-GitHub-App troubleshooting), `README.md` "Staying Aligned with a Moving Architecture" updated, and `docs/SYNC_AGENT_PROMPT.md` added as the drop-in routine prompt. Direct-merge Options 2–4 in the sync guide are retained as labelled fallbacks.

## [2026-07-03-0001] Branching Invariant — `develop` Is the Only Valid PR Source Into `main`

- **Decision:** The canonical flow is `feature/* → develop → main`. `develop` MUST contain everything on `main` at all times; the **only** valid PR source into `main` is `develop`. The `require-develop-source` CI gate (`.github/workflows/require-develop-source.yml`) is narrowed to enforce exactly this — all pre-existing wildcard exceptions (`doc-workflow-audit-drift*`, `doc-requirements-refinement*`, `doc-requirements-drift-audit*`, `doc-reality-check*`, `doc-requirements-update*`, `doc-requirements-uplift*`) are removed. Doc-uplift and other automation must open PRs into `develop` and reach `main` only via a `develop → main` release PR. If a genuine hotfix-to-main path is ever required, it must be added as a single explicit, documented exception — never a broad `doc-*` wildcard.
- **Context:** Doc-uplift automation (e.g. PRs #250, #252) had been merging **directly into `main`** through the gate's accreted wildcard whitelist (added piecemeal in prior "fix CI whitelist" commits). This repeatedly diverged `main` from `develop`: `main` gained commits `develop` lacked, which put the in-flight release PR #248 (`develop → main`) into merge conflict on `docs/REQUIREMENTS.md` and forced a manual sync-down (PR #255, `main → develop`) before the release could proceed. Standard Git-flow treats the trunk as strictly downstream of the integration branch; every direct-to-trunk merge breaks that invariant and taxes the next release with a reconciliation. Removing the wildcards makes the invariant self-enforcing rather than relying on remembering to sync down.
- **Impact:** `.github/workflows/require-develop-source.yml` now allows only `develop` as a PR head into `main`, with an explanatory failure message pointing at this decision and `CONTRIBUTING.md#branching-model`. Automation that previously targeted `main` directly must be repointed at `develop` (its PRs to `main` will now fail the gate by design). Eliminates the recurring divergence-then-sync-down cycle observed across the #248/#250/#252/#255 sequence.
