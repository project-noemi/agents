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

## [2026-05-22-0001] Skill Contract Substantive Remediation

- **Decision:** All 8 reusable skills under `skills/` and `skills/SKILL_TEMPLATE.md` MUST include a role-specific `## Data Inventory` section and an `### Refusal Criteria` H3 subsection nested under `## Rules & Constraints (4D Diligence)`. Placeholder text is not acceptable; each section must reference the skill's actual inputs, outputs, refused task types, override-resistance posture, and escalation path.
- **Context:** Resolves the recurring clarifications [2026-04-22], [2026-05-02] (Skill Data Inventory Inconsistency), [2026-05-10] (Substantive Persona Remediation Strategy — skills side), [2026-05-12] (Skill Contract Substantive Drift), [2026-05-13] (Skill Directory Audit Enforcement), [2026-05-16] (Skill Template and Library Substantive Remediation). These were duplicates of the same root cause: the skill library structurally diverged from the persona contract codified in Decision [2026-04-22].
- **Impact:** `skills/SKILL_TEMPLATE.md` and all 8 skill files updated with substantive Data Inventory and Refusal Criteria H3 in this PR. `scripts/audit-repo.js` now enforces both sections across the entire `skills/` directory.

## [2026-05-22-0002] Audit Script Coverage Expansion — Implementation

- **Decision:** Implement the audit-script expansion mandated by Decision [2026-05-20] (Audit Script Coverage Expansion). `scripts/audit-repo.js` now (1) walks `skills/` and applies the persona-contract checks to every file; (2) validates the `## Audit Log` JSON shape against the canonical schema `{ "task", "inputs", "actions", "risks", "result" }` for all agents; (3) enforces `### Refusal Criteria` as an H3 subsection under `## Rules & Constraints` for agents and skills; (4) performs referential-integrity checks on `mcp.config.json` against `mcp-protocols/` and `skills/`; (5) performs case-insensitive heading matching; (6) emits a JSON Audit Log to `stderr` per the observability mandate; (7) surfaces English-first slug-naming violations as a non-fatal warning to support incremental remediation.
- **Context:** Resolves clarifications [2026-04-25] (Audit Log JSON Schema Validation), [2026-04-25] (Skill Contract Audit Enforcement), [2026-05-02] (Case-Insensitive Heading Audits, Config-to-Asset Mapping Validation, Refusal Criteria Structural Enforcement, Automated Audit Script Coverage Gaps, Automated Naming Convention Audit), [2026-05-10] (Audit Script Coverage Expansion), [2026-05-13] (Skill Directory Audit Enforcement), [2026-05-16] (Referential Integrity Enforcement for Context Configuration), [2026-05-19] (Audit Script JSON Schema Validation Mandate). All are symptoms of the same audit-gate blindness identified in Decision [2026-05-20].
- **Impact:** Closes seven "Current Known Limitations" in `REQUIREMENTS.md` under one coherent unit of work: Audit Script Structural Blindness, Audit Script Gaps, Audit Script JSON Schema Blindness, Audit Script Structural Limitation, Config-to-Asset Mapping Drift, Skill Contract Substantive Drift (gate side), and Naming Convention Drift (Examples). Naming convention surfaces as a warning rather than a hard failure to avoid blocking docs work on PascalCase React components and conventional `Dockerfile` filenames.

## [2026-05-22-0003] Agent Index Role Extraction — Full First Paragraph

- **Decision:** `scripts/context_helpers.js` `discoverAgents` MUST extract the full first paragraph of the `## Role` section (everything up to the first blank line) for the Agent Index table, capped at 400 characters. The previous behavior of extracting only the first sentence is deprecated.
- **Context:** Resolves clarification [2026-05-02] (Agent Index Role Truncation). Multi-sentence Role definitions (e.g., PromptShield, QA & Risk Manager) were being truncated in `GEMINI.md` and `CLAUDE.md`, leading to misleading agent descriptions.
- **Impact:** Closes the "Agent Index Accuracy Drift" limitation in `REQUIREMENTS.md`. Generated context files now carry richer Role descriptions; golden fixtures regenerated to match.

## [2026-05-22-0004] Template Marker De-duplication

- **Decision:** `templates/context/GEMINI.template.md` MUST contain exactly one `GLOBAL_MANDATES_START`/`_END` marker pair and one `AGENT_INDEX_START`/`_END` marker pair. Duplicates are removed.
- **Context:** Resolves clarification [2026-05-11] (Template Marker Duplication Resolution). The duplicate markers caused redundant section injection into generated `GEMINI.md`, wasting tokens and risking agent confusion.
- **Impact:** Closes the "Template Marker Duplication" limitation in `REQUIREMENTS.md`. Single canonical placement is now: AGENT_INDEX after the document-level guidance, GLOBAL_MANDATES after the agent index.

## [2026-05-22-0005] Pre-flight SecretOps Failure Policy by Mode

- **Decision:** `scripts/verify-env.sh` resolves the contradictory SecretOps check blocks by standardizing on mode-aware behavior: `docker` mode treats missing `infisical`/`op` as a hard failure (exit 1); all other modes (`builder`, `gemini`, `claude`, `codex`, `n8n`) treat it as a soft warning. This matches the "beginner-safe" requirement in `REQUIREMENTS.md` §8 and resolves the redundant duplicate block.
- **Context:** Resolves clarifications [2026-05-12] (Pre-flight Script Logic Contradiction) and [2026-05-21] (SecretOps Pre-flight Failure Policy).
- **Impact:** Closes the "Pre-flight Logic Contradiction" limitation in `REQUIREMENTS.md`. Active authentication checks (Q [2026-05-11], [2026-05-13], [2026-05-17]) remain pending PO decision on canonical commands and PowerShell parity.

## [2026-05-22-0006] Missing Onboarding Directories Created

- **Decision:** Create `clients/` and `templates/tiers/` at the repository root to make `Client Onboarding`, `Fleet Dashboard`, and `QBR Presenter` persona workflows executable in a fresh fork. `clients/` is shipped with a `.gitignore` that excludes per-client provisioned material from upstream while preserving the directory; `templates/tiers/` ships three starter tier configs (`basic`, `standard`, `premium`) as `mcp.config.json`-shaped templates.
- **Context:** Resolves clarifications [2026-04-04] (Onboarding Directory Drift), [2026-05-02] (Missing Referenced Assets and Directories), [2026-05-10] (Missing Infrastructure Assets for Agent Validation — directory portion). The `examples/red-team-gauntlet/` test-vector population remains PO-pending because it requires defining the canonical 5 test cases (3 prompt injection, 2 PII leak) and that is a content/security decision, not a structural one.
- **Impact:** Closes the "Missing Onboarding and Configuration Directories" limitation in `REQUIREMENTS.md`. Red Team Gauntlet test vectors remain tracked as a separate limitation.

## [2026-05-22-0007] RFP-split Asset Naming Normalization

- **Decision:** Rename all `examples/rfp-split/Section_*_*.{pdf,txt}` files to slug-compliant `section-N-description.{pdf,txt}` form (lowercase, hyphen-separated).
- **Context:** Resolves clarification [2026-05-13] (RFP Split Naming Convention Remediation). The previous filenames violated the English-first slug-based naming mandate in `AGENTS.md` and `REQUIREMENTS.md`.
- **Impact:** Closes the "Naming Convention Drift (Examples)" limitation in `REQUIREMENTS.md`. The audit script's slug-naming check now reports zero violations across the canonical roots.

## [2026-05-22-0008] Phase 0 Assessment Kit Inventory Expansion

- **Decision:** Expand the canonical Phase 0 Assessment Kit inventory in `REQUIREMENTS.md` §1 to explicitly include `docs/phase-zero-assessment/PRACTITIONER_NOTES.md` and `docs/phase-zero-assessment/network-security-assessment.md` alongside the existing security/AI readiness guides, consent, report-of-findings, roadmap, and rubric templates.
- **Context:** Resolves clarifications [2026-05-17] and [2026-05-20] (Phase 0 Assessment Kit Inventory Drift / Completion). The "extra-canonical" assets exist in the codebase and have been in use, but the requirement only listed the original templates.
- **Impact:** Closes the "Phase 0 Assessment Kit Inventory Under-reporting" limitation in `REQUIREMENTS.md`.

## [2026-05-22-0009] Closure of Overtaken Clarifications

- **Decision:** The following clarifications are closed as **Overtaken by Events** — the underlying conditions described in the questions have already been remediated in a previous PR or by a previous decision, and no further action is required:
  - **[2026-05-01] / [2026-05-02] Node.js 24 Baseline in Docker / Reference Examples** — `examples/gatekeeper-deployment/docker-compose.yml` (`dashboard-ingest` service) and `tools/executive-assistant/Dockerfile` both use `node:24-alpine` in the current `main`. Remediation completed under Decision [2026-05-10].
  - **[2026-05-02] Tool Baseline Alignment (Executive Assistant)** — Same root cause; Dockerfile already at `node:24-alpine`. Audit-log emission tracked under the still-open "Internal Tool Observability Gap" item which remains PO-pending pending shared logger design.
  - **[2026-04-04] Fleet Dashboard API Path Mismatch**, **[2026-05-15] / [2026-05-16] Test Suite Reinforcement of API Path Drift** — Decision [2026-05-20] (Fleet Dashboard Ingestion Path: Standardize on `/api/v1/reports`) is the authoritative resolution. Coordinated implementation change is tracked separately.
  - **[2026-05-17] Branch Protection Enforcement Mandate** — Resolved by Decision [2026-05-20] (Branch Protection: Mandatory Enforcement). `REQUIREMENTS.md` §7 already carries the mandate; an audit-script check is tracked as a follow-up.
  - **[2026-05-02] / [2026-05-20] Automated Branch Protection Verification Depth** — Remains PO-pending pending decision on whether the audit script should hit the GitHub API (requires token plumbing); this is a separate question from the mandate itself.
- **Context:** A cross-check between `CLARIFICATIONS.md`, `DECISION_LOG.md`, and the current codebase confirmed that these questions were already resolved in earlier work or are duplicates of newer decisions. Keeping them in the active queue muddies the actual PO backlog.
- **Impact:** Active clarifications queue shrinks; remaining items are genuine PO-decisions or architecture work.

## [2026-05-20] Formalization of Technical Drift Tracking

- **Decision:** Establish a formal requirement to track and surface newly identified technical drifts in `REQUIREMENTS.md` to ensure the "Current Implementation Truth" remains grounded in the codebase state.
- **Context:** A Phase 2 Reality Check confirmed that several substantive and technical implementation gaps (naming convention violations in `rfp-split`, under-reported Phase 0 Kit assets, and unstructured logging in `executive-assistant`) were not explicitly tracked as limitations.
- **Impact:**
  - Mandatory inclusion of confirmed technical drifts in `REQUIREMENTS.md` §"Current Known Limitations".
  - Documentation of naming convention drift (English-first, slug-based) for non-compliant example assets.
  - Identification of the "Internal Tool Observability Gap" (JSON Audit Log to `stderr`) for repository-adjacent Node.js tools.
