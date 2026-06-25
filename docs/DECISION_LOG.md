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

## [2026-06-25-0001] Multi-Provider SecretOps Smoke Test Support

- **Decision:** `tests/examples-smoke.test.js` must accept either the `op://` (1Password) or `infisical://` (Infisical) vault-reference pattern when asserting that `.env.example` files contain vault references rather than placeholder secrets. The multi-provider mandate already documented in REQUIREMENTS.md Section 5 (Fetch-on-Demand Security) and AGENTS.md SecretOps section requires the test suite to honor both providers.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-19] (SecretOps Provider Bias in Smoke Tests). The `op://` hard-assertion produces false test failures for organizations standardized on Infisical.
- **Reference:** Implementation lands in this PR.

## [2026-06-25-0002] Shared audit_logger.js Implementation

- **Decision:** Jules is authorized to autonomously implement `scripts/audit_logger.js` as the canonical shared utility for emitting structured JSON Audit Logs to `stderr`. The utility implements the canonical 5-field schema (`task`, `inputs`, `actions`, `risks`, `result`) and exposes a thin event-to-schema mapping helper for internal operational events (e.g., `SYNC_COMPLETE`, `TRIAGE_VIP`, `CONFIG_UPDATE` map to the `task` field; the event's structured payload populates `actions` and `result`). Internal tools (`executive-assistant`, `dashboard-ingest.js`) must adopt the utility incrementally; this PR introduces the utility itself.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-10] (Mandated audit_logger.js Absence and Ownership), Q [2026-06-11] (audit_logger.js Mandated Absence), Q [2026-06-15] (Internal Tool Audit Log Event Mapping), Q [2026-06-17] (Internal Tool Audit Log Mapping), Q [2026-06-18] (audit_logger.js Canonical Schema and Behavior), and Q [2026-06-19] (audit_logger.js Schema and Event Mapping). No external implementation is pending.
- **Reference:** Implementation lands in this PR. The same 5-field schema applies to both agent personas and infrastructure-level events to keep observability uniform across the fleet (no separate infrastructure schema).

## [2026-06-25-0003] AI Model Baseline Update for Legacy Examples

- **Decision:** Legacy Python/Bash examples (currently `examples/docker/agent.py`) must be updated to the canonical `models/gemini-2.5-flash` baseline. The LEGACY/ILLUSTRATIVE label remains; pinning a deprecated model on examples that are kept for historical purposes contradicts the AI Model Baseline mandate. Future Python examples may use any then-current baseline so long as it matches `REQUIREMENTS.md`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-19] (Legacy Example Model Drift).
- **Reference:** Implementation lands in this PR.

## [2026-06-25-0004] Sync Script Parameterization

- **Decision:** `scripts/sync-upstream.sh` must read organization-specific values from environment variables: `NOEMI_UPSTREAM_REMOTE` (default `upstream`), `NOEMI_UPSTREAM_URL` (default `https://github.com/project-noemi/agents.git`), `NOEMI_LOCAL_BRANCH` (default `develop`), and `NOEMI_ORG_NAME` (default `[MyOrganization]` for the success-message label only). The hardcoded `MY_ORGANIZATION="[MyOrganization]"` placeholder is removed.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Sync Script Parameterization) and Q [2026-06-11] (sync-upstream.sh Hardcoded Identity).
- **Reference:** Implementation lands in this PR.

## [2026-06-25-0005] FORCE_DOCKER_SMOKE Mandatory Mode

- **Decision:** `tests/e2e/docker-smoke.test.js` must honor a `FORCE_DOCKER_SMOKE` environment variable. When `FORCE_DOCKER_SMOKE=true` is set and Docker is unavailable, the test suite must fail (rather than silently skipping). When the variable is unset, the existing "clean skip" behavior remains in place to preserve local-development friendliness.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-18] (E2E Smoke Test Docker Mandatory Check). Aligns with REQUIREMENTS.md Section 9 ("The Docker e2e suite must skip cleanly when Docker is unavailable") while preventing CI/CD "false green" outcomes when Docker is mandatory.
- **Reference:** Implementation lands in this PR.

## [2026-06-25-0006] NOEMI_DOCKER_SMOKE_* Variable Validation

- **Decision:** `tests/examples-smoke.test.js` must include a dedicated test case that validates the presence and naming-convention compliance of all `NOEMI_DOCKER_SMOKE_*` environment variables defined in `.env.template`. The naming convention is `NOEMI_DOCKER_SMOKE_<UPPER_SNAKE_CASE>`. The test reports the inventory and fails if expected variables (`TIMEOUT_MS`, `POLL_INTERVAL_MS`, `ARTIFACT_DIR`) are missing.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-29] (Docker Smoke Test Variable Validation) and Q [2026-06-11] (tests/examples-smoke.test.js Environmental Blindness).
- **Reference:** Implementation lands in this PR.

## [2026-06-25-0007] Audit Script Expansion — TBD Detection, JSON Schema, MCP/Lens Audit, Naming, Resilience, Model Baseline

- **Decision:** `scripts/audit-repo.js` will be expanded to enforce the following gates (these collapse Q-level questions into a single coherent unit of work):
  - **TBD-placeholder detection** in mandatory persona and skill sections (`Data Inventory`, `Refusal Criteria`) — fatal error when found in CI runs, warning otherwise.
  - **JSON schema validation** for the `Audit Log` block, verifying presence and non-empty values for `task`, `inputs`, `actions`, `risks`, `result`.
  - **MCP-protocol structural audit** over `mcp-protocols/*.md` for the same canonical contract (Purpose, Inputs, Procedure, Outputs, Rules & Constraints, Audit Log).
  - **Value-lens and operating-profile structural audit** against their respective `*_TEMPLATE.md` files.
  - **Referential integrity check** for internal markdown links and `**Skill:**` references in agent workflows.
  - **Config-to-asset mapping** validation against `mcp.config.json` (every `active_mcps` and `active_skills` entry must resolve to a file).
  - **Naming-convention audit** (regex-based, English-first slug naming) over `docs/`, `agents/`, `skills/`, `examples/`, `tools/`.
  - **AI-model-baseline check** that scans `examples/` and `tests/` for non-baseline Gemini model pins (`gemini-(?!2\.5-flash)`).
  - **Node.js 24 baseline check** over `Dockerfile` and `docker-compose.yml` to flag `node:<24` pins.
  - **Branch-protection audit** via the presence/last-run timestamp of `scripts/setup-branch-protection.sh`; non-fatal warning outside CI, fatal in CI.
  - **Refusal Criteria substantive check** (regex for the three mandatory clauses: refused-types, override-resistance, escalation).
  - **Audit Log emission** via the new shared `scripts/audit_logger.js` utility, per the observability mandate.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-01] (Node 24 baseline), Q [2026-05-02] (multiple — config-to-asset mapping, naming convention, build-utility audit log, Refusal substantive enforcement, Audit Log descriptor standardization → see Decision [2026-06-25-0012]), Q [2026-05-15] (Skill-to-Agent Referential Integrity), Q [2026-05-19] (Internal Tool Observability Standard for build utilities), Q [2026-05-20] (AI Model Baseline Formalization Follow-through), Q [2026-05-29] (Branch Protection Audit Implementation), Q [2026-06-01] (Substantive vs Structural Audit Policy, Audit Log Schema Enforcement), Q [2026-06-15] (Audit Script Placeholder Rejection Policy), Q [2026-06-17] (MCP Protocol Specification Contract Audit Gap, Value Lens and Operating Profile Structural Audit, Automated Internal Documentation Link Integrity), and Q [2026-06-18] (Audit Script JSON Schema Validation Mandate).
- **Reference:** Authorization only — the audit-repo.js refactor is deliberately deferred to a follow-up PR to keep this change set focused. Tracking is in REQUIREMENTS.md under "Audit Script Enforcement Depth".

## [2026-06-25-0008] Generator Script Consolidation

- **Decision:** Deprecate `scripts/generate_gemini.js` and `scripts/generate_claude.js`; `scripts/generate_all.js` becomes the sole entry point for context generation. The two legacy scripts will be removed after a one-PR transition window during which they become thin shims that delegate to `generate_all.js`.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-17] (Generator Script Redundancy).
- **Reference:** Authorization only — script removal is deferred to a follow-up PR (one shim transition, then deletion).

## [2026-06-25-0009] Persona Journal Section Remains Optional

- **Decision:** The `## Journal` section is NOT promoted to a mandatory persona-contract heading. Agents that benefit from across-fleet learning may include it, but it is not enforced by `scripts/audit-repo.js` and is not added to `docs/AGENT_TEMPLATE.md` as a required heading.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-01] (Persona Journal Section Standardization). The canonical persona contract from [2026-04-02] Clarification Backlog Normalization is sufficient; adding another mandatory section would inflate the contract without commensurate observability benefit.
- **Reference:** Decision-only; no code changes.

## [2026-06-25-0010] Resilience Helper Module System (Dual CJS+ESM Export)

- **Decision:** `scripts/resilience_helpers.js` retains its current CommonJS implementation and adds an ESM-compatible default export so that ESM-native tools (e.g., `tools/executive-assistant/`) can `import { withRetry } from '../../scripts/resilience_helpers.js'` without a wrapper. Implementation pattern: keep `module.exports.withRetry = ...` and add `module.exports.default = module.exports` so default-import semantics work under Node's CJS-to-ESM interop. A future migration to a dual-package `package.json` `exports` map can ship later if needed.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-19] (Resilience Helper Module System Mismatch).
- **Reference:** Authorization only — implementation deferred to the same PR that integrates `withRetry` into a first network-bound consumer.

## [2026-06-25-0011] Persona and Skill Substantive Remediation Strategy

- **Decision:** Jules is authorized to perform a bulk substantive remediation of agent personas (`agents/`) and reusable skills (`skills/`), replacing `TBD` placeholders and identical-boilerplate text in `Data Inventory` and `Refusal Criteria` sections with role-specific, technically grounded defaults derived from each artifact's documented `Role`/`Mission`/`Procedure`. The remediation must:
  - Treat the substantive content as a draft anchored in the canonical contract — not a final domain-expert version. Each remediated section ends with the marker `<!-- substantive-draft: needs domain-expert review -->` so a human can later refine without losing the structural compliance gain.
  - Use the same three-clause Refusal Criteria pattern (refused task types, override-resistance, escalation path) mandated by Decision [2026-04-13].
  - Land as multiple focused PRs (one per agent/skill category) to avoid a single sprawling change; not all 22+ artifacts in one PR.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-26] (Substantive Persona Content Drift), Q [2026-05-02] (Refusal Criteria Substantive Enforcement, Skill Contract Enforcement Depth, Tool Baseline Alignment), Q [2026-05-10] (Substantive Persona Remediation Strategy), Q [2026-05-28] (Substantive Remediation of the Skill Library), Q [2026-05-29] (Skill Remediation Priority), Q [2026-06-17] (Substantive Content Baseline for Agents), and Q [2026-06-18] (Substantive Remediation of Skill "TBD" Placeholders).
- **Reference:** Authorization only — actual content remediation is deferred to follow-up PRs because the work spans 22+ files and must be reviewable.

## [2026-06-25-0012] Audit Log Descriptor Stays on stderr (No FD3, No Prefix)

- **Decision:** The canonical technical sink for Audit Logs remains `stderr` per Decision [2026-04-13]. We do NOT introduce a dedicated file descriptor (e.g., FD 3) and we do NOT mandate a `AUDIT_LOG:` prefix. Orchestrators that need to disambiguate technical crashes from structured audit logs should rely on the JSON shape itself: a valid Audit Log is parseable JSON containing all five canonical fields; anything else on `stderr` is treated as crash/diagnostic output.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-05-02] (Audit Log Descriptor Standardization). The shape-based disambiguation keeps orchestrator integrations simple without introducing platform-specific FD conventions that may break on Windows or in serverless runtimes.
- **Reference:** Decision-only; no code changes.

## [2026-06-25-0013] Red Team Gauntlet Serialization Format

- **Decision:** Red Team Gauntlet test vectors will be serialized as a single YAML file at `examples/red-team-gauntlet/test-vectors.yaml`, grouped into top-level keys per protection category (`prompt_injection`, `pii_patterns`, `output_safety`, etc.). YAML is preferred over JSON for ease of human editing (multi-line patterns, comments). The `Client Onboarding` validation workflow consumes this file directly.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-04-05] (Red Team Gauntlet Test Vector Absence), Q [2026-06-10] (Red Team Gauntlet Machine-Readable Test Vectors), and Q [2026-06-15] (Red Team Gauntlet Serialization Strategy).
- **Reference:** Authorization only — file creation is deferred to a follow-up PR.

## [2026-06-25-0014] Memory-Code Synchronization Drift Resolution

- **Decision:** Where "Memory" records remediations that are absent from the filesystem (sync script parameterization, agent index extraction depth, shared `audit_logger.js`), Jules reimplements them from scratch using the current canonical decisions as the source of truth. Memory entries are advisory; filesystem truth wins. This PR closes the `audit_logger.js` and sync-upstream parameterization sub-cases.
- **Context:** Resolves CLARIFICATIONS.md Q [2026-06-01] (Memory-Code Synchronization Drift).
- **Reference:** Partial implementation in this PR (`audit_logger.js` + sync-upstream parameterization). Agent-index extraction depth is deferred to the audit-repo.js follow-up.

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
