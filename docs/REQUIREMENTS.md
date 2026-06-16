# Project NoéMI Reference Architecture - Requirements

## Overview

This repository is both:

- the **public reference architecture** for Project NoéMI
- the **agent specification library** and example set that supports that architecture

It is not a runtime or execution engine. External orchestrators such as Gemini CLI, n8n, and LangChain consume the generated context and persona specifications defined here.

## Canonical Sources of Truth

- [`PROJECT_REFERENCE.md`](PROJECT_REFERENCE.md) is the canonical public narrative.
- [`REQUIREMENTS.md`](REQUIREMENTS.md) is the current implementation truth.
- [`DECISION_LOG.md`](DECISION_LOG.md) is the durable architectural audit trail.

## Core Requirements

### 1. Phase 0 Comes Before Advanced AI

- The repository must present **Phase 0 security** as the prerequisite for serious AI adoption.
- Client and buyer navigation must reach [`PHASE_ZERO_SECURITY_BASELINE.md`](PHASE_ZERO_SECURITY_BASELINE.md) directly from the top-level experience.
- The public documentation must include a reusable **Phase 0 Assessment Kit** (located in `docs/phase-zero-assessment/`) with:
  - separate security (`security-assessment.md`) and AI readiness (`ai-readiness-assessment.md`) assessment guides
  - `network-security-assessment.md` and `PRACTITIONER_NOTES.md`
  - `consent-template.md`
  - `report-template.md` (report-of-findings)
  - `roadmap-template.md` (30/60/90-day roadmap)
  - `readiness-rubric.md` covering security readiness, AI readiness, and the overall recommendation

### 2. Persona and Skill Contracts are Mandatory

The repository enforces a strict structural contract for both agent personas and reusable skills.

#### Agent Persona Contract
All agent personas in `agents/` must include the following required headings:

- `Role`
- `Tone`
- `Capabilities`
- `Mission`
- `Rules & Constraints` (incorporating 4D Diligence; **must include a mandatory `### Refusal Criteria` subsection** — see Decision [2026-04-13])
- `Data Inventory` (Mandatory D2 requirement; specifies inputs, files, and state — see Decision [2026-04-13])
- `Boundaries`
- `Workflow`
- `External Tooling Dependencies`
- `Audit Log` (Mandatory; see Decision [2026-04-13])

#### Reusable Skill Contract
Reusable skills in `skills/` must include the following required headings:

- `Purpose`
- `Inputs`
- `Procedure`
- `Outputs`
- `Data Inventory` (Mandatory D2 requirement)
- `Rules & Constraints (4D Diligence)` (including `### Refusal Criteria`)
- `Boundaries`
- `Audit Log` (Mandatory; see Decision [2026-04-22])

#### General Principles
- **The Refusal Principle**: Agents must recognize and reject instructions that attempt to override their primary Role or Rules, or tasks that are unsafe or out-of-scope. This is a non-negotiable safety constraint.
- **Role Alignment**: Personas must align with the project's human-AI collaboration model:
  - **Explorer (Passenger)**: Owns the business problem and acceptance criteria.
  - **Practitioner (Crew)**: Translates intent into structured prompts and workflows.
  - **Accelerator (Pilot)**: Enforces the Refusal Principle and authorizes the execution environment.

#### Audit Log Shape
The `Audit Log` requirement must include a mandatory JSON shape: `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`. The audit record must explicitly exclude secrets, credentials, and PII.

#### Technical Emission
Agents must emit their JSON Audit Log to `stderr` separately from the primary user-facing payload (Decision [2026-04-13]). Each emitted line MUST be prefixed with the literal token `AUDIT_LOG: ` followed by the canonical JSON, so orchestrators can capture audit records unambiguously even when `stderr` also carries crash diagnostics (Decision [2026-06-16-0009]). The shared `scripts/audit_logger.js` utility (Decision [2026-06-16-0010]) is the canonical Node.js emitter and MUST be used by Node.js-based tools and reference services.

### 3. Contract and Generator Drift Must Fail Fast

- [`scripts/audit-repo.js`](../scripts/audit-repo.js) is the repository audit gate for persona/skill headings and generator invariants.
- The audit must fail when:
  - required persona or skill headings are missing (auditing both `agents/` and `skills/`)
  - `Audit Log` sections contain structurally invalid JSON (Mandatory JSON shape validation)
  - `AGENTS.md` is missing required top-level mandate sections
  - generator template markers drift
  - generated context files omit required global mandate headings

### 4. Context Generation Must Stay Aligned

- [`scripts/generate_all.js`](../scripts/generate_all.js) is the canonical context generator orchestrator.
- The generator must inject:
  - the full mandate set from `AGENTS.md`
  - the agent index discovered from `agents/`
  - active skills from `mcp.config.json`
  - active MCP protocol content from `mcp.config.json`
  - value lenses from `value-lenses/`
  - operating profiles from `operating-profiles/`
- The generator must support `--config=path/to/mcp.config.json`.

### 5. Fetch-on-Demand Security Is Non-Negotiable

- Secrets must be stored in a SecretOps platform such as Infisical or 1Password.
- Commands that require credentials must run through `infisical run` or `op run`.
- Code must read configuration from environment variables in process memory (`process.env`, `os.getenv()`).
- Local `.env` parsing logic is not an approved pattern in this repository.
- `.env.template` and example `.env.example` files are variable inventories or vault-reference manifests only. They must not contain real secrets.

### 6. 4D Framework Order Must Remain Canonical

The canonical order of the 4D AI Fluency Framework across the repository is:

1. Delegation
2. Description
3. Discernment
4. Diligence

Lifecycle docs, templates, and governance text must not reorder these dimensions.

### 7. Governance and Trust Controls Are First-Class

- Project NoéMI aligns agent design and deployment with Gartner AI TRiSM.
- Red Team validation is required for agent deployment readiness.
- Guardian-layer patterns remain a core architectural requirement where trust, data protection, or prompt integrity matters.
- **Branch protection enforcement is mandatory** (Decision [2026-05-20] — Branch Protection: Mandatory Enforcement). All forks of the reference architecture MUST run `scripts/setup-branch-protection.sh` (or an equivalent automated mechanism) on first setup to enforce the canonical `develop → main` flow. `scripts/audit-repo.js` SHOULD acquire a check that surfaces missing protection as a non-fatal warning in non-CI runs and as a fatal error in CI.

### 8. Reference Examples Must Tell the Truth

- The Gatekeeper deployment example must use HMAC-signed dashboard submissions and a verifiable ingest path (`/api/v1/reports`).
- PowerShell preflight verification must check SecretOps availability to the same standard as the shell script (currently defaulting to a warning/soft-fail to support local exploration).
- The repository must contain at least one reusable reference pattern for exponential backoff and retry (Node.js implementation: `scripts/resilience_helpers.js`).
- Historical Python and Bash examples are clearly labeled as LEGACY/ILLUSTRATIVE to distinguish them from the canonical Node.js implementation path.

### 9. Validation Must Be Easy to Run

- The repository must expose a canonical fast validation gate through `npm run validate`.
- The repository must expose a lightweight built-in test harness through `npm test`.
- The default test suite must cover:
  - persona and template contracts
  - generator determinism and config override behavior
  - golden fixtures for generated context sections (Maintenance: `scripts/update-golden-fixtures.js` must be used to keep fixtures healthy when templates change).
  - static smoke checks for example stacks and Docker env inventories (including `NOEMI_DOCKER_SMOKE_*` variable validation).
- The repository must expose a Docker-focused smoke entrypoint through `npm run test:e2e`.
- The same validation contract must be enforced in GitHub Actions on pushes and pull requests targeting `develop` and `main`.
- The Docker e2e suite must skip cleanly when Docker is unavailable and execute real compose-based runtime checks when it is available.

### 10. Docker Guidance Must Describe the Home, Not a Fake Runtime

- The builder path must include a beginner-safe onboarding guide that gets a new user from clone to one harmless local success before Docker becomes mandatory.
- The builder path must include a Docker-oriented guide that explains how to build a home around the repo's assets without misrepresenting the repository as a runtime product.
- That guide must connect the current local, fleet, and specialist Docker examples into one coherent progression.
- That guide must also include a short Docker onboarding walkthrough that chains environment verification, context generation, validation, and initial Docker launch after the first local success.

## Runtime and Tooling Requirements

- Node.js is the primary runtime for repository utilities and generation scripts.
- The built-in Node test runner is the primary validation framework for repository contracts and smoke tests.
- Git, Node.js, and at least one supported local AI client (Gemini CLI, Claude Code CLI, or OpenAI Codex) remain part of the documented beginner toolchain.
- The following MCP protocols are formally recognized as baseline requirements: `n8n`, `slack`, `gmail`, `google-*` suite, `web-search`, and `github`.
- Docker becomes part of the documented toolchain when a builder moves into runtime homes or Docker verification.
- Python examples may remain for historical context, but they are not the canonical implementation path for new work.
- The `logging-mcp` is defined as a dual-backend protocol supporting both Loki/Grafana (structured log queries) and n8n webhooks (event-driven ingestion).
- **AI Model Baseline**: Reference workflows, lab examples, and smoke tests are pinned to **Gemini 2.5 Flash** (`models/gemini-2.5-flash`) as the canonical baseline for predictable performance and cost.

## Current Known Limitations

- **Historical Python Drift**: Legacy Python/Bash examples include mandatory "LEGACY/ILLUSTRATIVE" headers (Decision [2026-04-04]) but remain unmigrated to the Node.js baseline.
- **Gatekeeper Implementation Gap** (Scope clarified: 2026-06-16): The reference implementation in `examples/gatekeeper-deployment/` does not yet execute the full mutating action set (merges/closes) described in the persona. Per Decision [2026-06-16-0004], the resolution is a documented `dry-run` mode rather than full production logic. Sub-tasks:
  - Add `GATEKEEPER_DRY_RUN=true` default to `examples/gatekeeper-deployment/entrypoint.sh` that logs intended merge/close actions without executing them.
  - Extend `dashboard-ingest.js` with a per-agent HMAC registry (JSON file) and a stub asynchronous verification worker matching the Fleet Dashboard persona.
  - Document the dry-run posture in `examples/gatekeeper-deployment/README.md`.
- **Docker e2e Skip Behavior**: The Docker e2e suite skips runtime checks if Docker is absent, rather than failing, which can mask environmental gaps in CI.
- **Logging Protocol Implementation Gap**: `logging-mcp` is a dual-backend draft (Loki/n8n) but is not yet active in `mcp.config.json`, and reference services (e.g., `dashboard-ingest.js`) lack alignment with its schema.
- **Missing Onboarding and Configuration Directories** (Remediated: 2026-05-28): `clients/`, `.gatekeeper/`, and `templates/tiers/` directories referenced in agent specifications (`Client Onboarding`, `Gatekeeper`, `QBR Presenter`) now exist in the repository root with `.gitignore` placeholders for the runtime-state directories and a README for tier templates (Decision [2026-05-28-0002]).
- **Framework Injection Gap** (Remediated: 2026-05-28): `Value Lenses` and `Operating Profiles` are now injected by `scripts/generate_all.js` into the `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` template markers (Decision [2026-05-28-0005]). Generated `GEMINI.md` and `CLAUDE.md` carry the framework layer inline.
- **Operating Profile Substantive Gap**: While the injection mechanism for Operating Profiles is active, the `operating-profiles/` directory contains only templates and no baseline profiles, resulting in empty injection blocks in generated context files.
- **Substantive Remediation (Personas + Skills)** (Authorized: 2026-06-16): Per Decision [2026-06-16-0005], Jules is authorized to perform autonomous fleet-wide substantive remediation of `Data Inventory` and `Refusal Criteria` placeholders using role-specific, technically grounded defaults derived from each file's existing sections. Sub-tasks:
  - Generate role-specific content for all 22 agent personas in `agents/`; ship as one PR.
  - Generate role-specific content for all reusable skills in `skills/`; ship as one PR.
  - Once both PRs land, remove the legacy "Structural vs. Substantive Compliance" and "Skill Contract Substantive Drift" lines from this section.
  - Enable the "TBD" rejection check in `scripts/audit-repo.js` only after these PRs land (see Audit Script Coverage Sweep below).
- **Audit Script Coverage Sweep** (Authorized: 2026-06-16): Per Decision [2026-06-16-0006], `scripts/audit-repo.js` will acquire the following checks as one coordinated change (analogous to [2026-05-20] Audit Script Coverage Expansion). Landing this collapses the legacy "Audit Script Enforcement Depth", "Audit Script JSON Schema Blindness", and "Branch Protection Audit Gap" entries into a single resolution. Sub-tasks:
  - Node baseline scan for `Dockerfile`/`docker-compose.yml` flagging `node:<24`.
  - Referential integrity for `mcp.config.json` (`active_mcps` → `mcp-protocols/`, `active_skills` → `skills/`).
  - Regex-based filename slug-naming check across `docs/`, `agents/`, `skills/`, `examples/`, `tools/`.
  - Skill-reference integrity scan parsing `**Skill:** [path]` patterns in agent workflows.
  - Refusal Criteria substantive check for the three mandated clauses (refused types, override resistance, escalation path).
  - AI Model baseline grep across `examples/` and `tests/` flagging non-`models/gemini-2.5-flash` pins.
  - "TBD" placeholder rejection in mandatory persona/skill sections as a fatal error (sequenced after substantive remediation above).
  - Audit Log JSON schema validation for the five mandated keys (`task`, `inputs`, `actions`, `risks`, `result`).
  - Branch-protection check via GitHub API when `GITHUB_TOKEN` is present; fatal in CI, warning otherwise.
- **Internal Tool Observability Gap** (Scope clarified: 2026-06-16): Node.js tools in `tools/` (e.g., `executive-assistant`) and reference services in `examples/` (e.g., `dashboard-ingest.js`) lack structured JSON Audit Log emission to `stderr`. Per Decisions [2026-06-16-0009] and [2026-06-16-0010], the resolution is a shared `scripts/audit_logger.js` utility emitting with the `AUDIT_LOG:` line prefix. Sub-tasks:
  - Implement `scripts/audit_logger.js` exporting a single function that emits the canonical shape with the `AUDIT_LOG: ` prefix to `stderr`.
  - Refactor `tools/executive-assistant/server.js` to use the helper for every significant event (sync, triage, configuration mutation).
  - Refactor `examples/gatekeeper-deployment/dashboard-ingest.js` to use the helper.
  - Refactor `scripts/generate_all.js` and `scripts/audit-repo.js` to emit an `AUDIT_LOG:` line summarizing files read/modified and any risks at completion.
  - Update `AGENTS.md` and Section 2 of this document to mandate the `AUDIT_LOG: ` prefix.
- **Sync Script Parameterization Gap** (Authorized: 2026-06-16): Per Decision [2026-06-16-0012], `scripts/sync-upstream.sh` is refactored to pull from `NOEMI_ORG_NAME`, `NOEMI_UPSTREAM_URL`, and `NOEMI_UPSTREAM_BRANCH` with sensible defaults; CLI flags override. Sub-tasks:
  - Refactor `scripts/sync-upstream.sh` to consume env vars and `--org`/`--upstream`/`--branch` flags.
  - Remove the hardcoded `[MyOrganization]` placeholder and any fixed URLs.
  - Document the variables in `docs/UPSTREAM_SYNC.md` and add them to `.env.template`.
- **Memory-Code Synchronization Drift**: A significant discrepancy exists between the repository's recorded architectural history (Memory) and the implemented codebase truth. Several remediations reported as completed (e.g., shared `audit_logger.js`, parameterized sync script, enhanced agent index extraction) are missing or incomplete in the live filesystem. The fresh implementation work is now tracked under the explicit sub-task chains in this section (Internal Tool Observability Gap, Sync Script Parameterization Gap, Agent Index Descriptive Truncation).
- **SecretOps Authentication Verification Depth** (Authorized: 2026-06-16): `scripts/verify-env.sh` and `scripts/verify-env.ps1` currently issue only warnings for missing SecretOps authentication in `docker` mode. Per Decision [2026-06-16-0011], they must exit 1 in `docker` mode. Sub-tasks:
  - Patch `scripts/verify-env.sh` to exit 1 when invoked in `docker` mode without authenticated SecretOps.
  - Patch `scripts/verify-env.ps1` to mirror the behavior.
  - Add a smoke-test fixture covering the mode-conditional exit code.
- **Agent Index Descriptive Truncation** (Authorized: 2026-06-16): Per Decision [2026-06-16-0008], `scripts/context_helpers.js` extracts the full first paragraph of the `Role` section for the Agent Index, not the first sentence. Sub-tasks:
  - Update the extraction regex/logic in `scripts/context_helpers.js`.
  - Regenerate golden fixtures with `scripts/update-golden-fixtures.js`.
- **Red Team Gauntlet Machine-Readable Serialization Gap** (Authorized: 2026-06-16): Per Decision [2026-06-16-0003], test vectors are serialized as a single `examples/red-team-gauntlet/test-vectors.json` with `prompt_injection` and `pii_patterns` top-level keys. Sub-tasks:
  - Populate `test-vectors.json` with the five mandated cases.
  - Add a smoke test that loads the file and asserts schema shape (`id`, `category`, `payload`, `expected_outcome`, `notes`).
  - Link the JSON from `examples/red-team-gauntlet/README.md`.
- **Service Tier Template Implementation Gap**: The `templates/tiers/` directory exists but lacks the actual service tier templates (e.g., `basic.md`, `standard.md`) referenced by the Client Onboarding agent. Blocked on external input — the specific commercial tier definitions (features/limits/pricing) are tracked as an active clarification in `CLARIFICATIONS.md` (Q [2026-06-15] Service Tier Template Specifications).
- **Smoke Test Variable Validation Gap** (Authorized: 2026-06-16): Per Decision [2026-06-16-0013]. Sub-tasks:
  - Add a dedicated test case in `tests/examples-smoke.test.js` that loads `.env.template`, enumerates `NOEMI_DOCKER_SMOKE_*` variables, and asserts each is documented and referenced.
  - Add a short README inside `tests/` documenting the expected variable inventory.
- **Resilience Helper Integration Gap**: `scripts/resilience_helpers.js` exists as a canonical reference but is not utilized by repository tools (`audit-repo.js`, `generate_all.js`). Per Decision [2026-04-04] (Resilience Helpers: Core Script Integration Scope), this is intentional — the helper is a reference pattern for agents and external-facing tools; deterministic local-FS operations in `audit-repo.js` and `generate_all.js` do not benefit from retry. This entry is retained for visibility but should not be treated as a remediation backlog item.
- **Fleet Dashboard Retention Two-Bucket Reference** (Authorized: 2026-06-16): Per Decision [2026-06-16-0002], the reference stack adopts a two-bucket InfluxDB layout. Sub-tasks:
  - Add an `agent_summaries` bucket (1-year retention) to `examples/gatekeeper-deployment/docker-compose.yml` alongside the existing `agent_reports` bucket (90 days).
  - Ship a Flux downsampling task fixture that populates `agent_summaries` from `agent_reports`.
  - Document the refresh cadence in `examples/gatekeeper-deployment/README.md`.
- **ROI Auditor Baseline Reference File** (Authorized: 2026-06-16): Per Decision [2026-06-16-0001]. Sub-tasks:
  - Add `tools/roi/baseline-config.json` as the machine-readable snapshot of the published Google Sheets template.
  - Update the `ROI Auditor` persona's `Data Inventory` to cite the JSON file.
  - Document the manual export-to-JSON refresh step in `tools/roi/README.md`.
- **Casdoor Reference Skill** (Authorized: 2026-06-16): Per Decision [2026-06-16-0015]. Sub-task:
  - Author `skills/security/casdoor-validate.md` following the Reusable Skill Contract; document the JWT validation pattern as an orchestrator/ingress responsibility (no service-side implementation).
- **RFP Split Asset Renaming** (Authorized: 2026-06-16): Per Decision [2026-06-16-0016]. Sub-tasks:
  - Bulk-rename files in `examples/rfp-split/` to slug case.
  - Update any cross-references in code or documentation.
- **Persona Journal Section Documentation** (Authorized: 2026-06-16): Per Decision [2026-06-16-0007], the `## Journal` section is documented as optional. Sub-task:
  - Add a one-paragraph note to `docs/AGENT_TEMPLATE.md` describing `## Journal` as a recommended (not required) extension for agents with reflective learning loops.
- **Generator Script Documentation** (Authorized: 2026-06-16): Per Decision [2026-06-16-0014], `generate_all.js`, `generate_gemini.js`, and `generate_claude.js` are all retained. Sub-task:
  - Document in the appropriate README that `generate_all.js` is the canonical orchestrator and the per-client scripts are thin wrappers for direct invocation.
- **Fleet Dashboard API Path Verification** (Authorized: 2026-06-16): Per Decision [2026-06-16-0017]. Sub-task:
  - Grep `examples/gatekeeper-deployment/dashboard-ingest.js` and `tests/examples-smoke.test.js` for `/api/v1/reports`; if either is missing, file a focused fix PR.
