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
Agents must emit their JSON Audit Log to `stderr` separately from the primary user-facing payload (Decision [2026-04-13]).

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
- **Testing Blind Spots (Known Gaps)**:
  - `tests/examples-smoke.test.js` now validates `NOEMI_DOCKER_SMOKE_*` inventory in `.env.template` (Decision [2026-06-27-0010]).
  - `scripts/audit-repo.js` now performs JSON schema validation for Audit Logs (Decision [2026-06-27-0002]) and referential integrity for `mcp.config.json` (Decision [2026-06-27-0004]). General internal-markdown-link integrity remains a deferred gap.
  - The E2E suite `tests/e2e/docker-smoke.test.js` now respects `FORCE_DOCKER_SMOKE=true` for mandatory-mode operation; without that flag, the clean-skip behavior is preserved for local dev (Decision [2026-06-27-0009]).

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

### 1. Environmental & Deployment Drift
- **Internal Tool Observability Gap**: Node.js tools like `executive-assistant` and reference services like `dashboard-ingest.js` rely on unstructured `console.log` and have not yet been refactored to use the shared `scripts/audit_logger.js`. The utility is now available (Decision [2026-06-27-0001]); the refactor of consumers is the next PR's scope.
- **AI Model Baseline Drift**: Legacy Python/Bash examples (e.g., `examples/docker/agent.py`) are pinned to `gemini-2.0-flash` rather than the canonical `gemini-2.5-flash` baseline. The LEGACY/ILLUSTRATIVE header (Decision [2026-04-04]) tags these as historical references; an automated audit check is deferred (Decision [2026-06-27-0015]).
- **Resilience Helper Integration Gap**: `scripts/resilience_helpers.js` exists but is not utilized by any agent personas or network-bound tools, despite the mandate for resilience. Fleet-wide persona update is deferred to a domain-by-domain review (Decision [2026-06-27-0015]).
- **Resilience Helper Module Mismatch**: `tools/executive-assistant/` uses ESM, preventing direct import of the CommonJS `scripts/resilience_helpers.js`. ESM/CJS dual-export migration is deferred as its own coordinated change.

### 2. Structural & Architectural Drift
- **Audit Script Coverage Blind Spot (partial)**: `scripts/audit-repo.js` covers `agents/`, `skills/`, `AGENTS.md`, `templates/context/`, `docs/phase-zero-assessment/`, and `mcp.config.json` referential integrity (Decisions [2026-06-27-0003], [2026-06-27-0004]). It still does not audit the contents of `mcp-protocols/`, `value-lenses/`, or `operating-profiles/` for structural alignment with their respective `*_TEMPLATE.md` files.
- **Tier Templates Empty**: `templates/tiers/` contains only a README; concrete `basic.md`, `standard.md`, `premium.md` files require product-line definitions and remain pending product-owner input (CLARIFICATIONS Q [2026-06-10]).
- **Heading Inconsistency**: The mandatory Diligence heading is "Rules & Constraints" in agents but "Rules & Constraints (4D Diligence)" in skills. The audit is case-insensitive and tolerant of the suffix; unification is deferred as a coordinated PR (Decision [2026-06-27-0015]).
- **Undocumented "Learning Agent" Pattern**: `tools/executive-assistant/server.js` implements a `/api/resolution` feedback loop and "Learning Agent" logic that is undocumented and lacks a persona specification. Formalization requires product-owner input (CLARIFICATIONS Q [2026-06-20]).

### 3. Substantive & Safety Drift
- **Substantive Content Baseline (The "TBD" Problem)**: 100% of reusable skills and most agent personas use "TBD" placeholders or boilerplate for `Data Inventory` and `Refusal Criteria`. The audit now emits `AUDIT WARN:` lines for each occurrence (Decision [2026-06-27-0013]); promotion to a fatal error is deferred until the fleet has been substantively remediated with domain-specific content.
- **Substantive Remediation Backlog**: Bulk replacement of placeholders requires per-agent / per-skill domain knowledge that exceeds an automated PR's scope. Tracked as ongoing work with the warning-level audit surfacing the queue.

### 4. Referential & Link Integrity Drift
- **Internal Markdown Link Integrity Gap**: The repository lacks automated verification for `[text](path/to/file.md)` markdown links and `**Skill:**` path references inside agent workflows. Referential integrity for `mcp.config.json` is now enforced (Decision [2026-06-27-0004]); broader markdown link audit is deferred.

### 5. Remediated Limitations (Archive)
- **Missing Onboarding and Configuration Directories** (Remediated: 2026-05-28): `clients/`, `.gatekeeper/`, and `templates/tiers/` directories now exist with `.gitignore` placeholders.
- **Framework Injection Gap** (Remediated: 2026-05-28): `Value Lenses` and `Operating Profiles` are now injected by `scripts/generate_all.js`.
- **Artifact Naming Convention Alignment** (Remediated: 2026-05-10): `docs/n8n workflows/` renamed to `docs/n8n-workflows/`.
- **Node.js 24 Baseline Alignment** (Remediated: 2026-05-10): `executive-assistant` and `gatekeeper-deployment` updated to Node 24 images.
- **Missing shared `audit_logger.js`** (Remediated: 2026-06-27, Decision [2026-06-27-0001]): The shared utility is now implemented at `scripts/audit_logger.js` with `emit()`, `buildAuditLog()`, `validateAuditLog()`, and a canonical `EVENT_TASK_MAP` for internal-event to Audit Log task mapping.
- **Audit Log Schema Blindness** (Remediated: 2026-06-27, Decision [2026-06-27-0002]): `scripts/audit-repo.js` now validates that every Audit Log JSON block conforms to the canonical schema via `audit_logger.validateAuditLog()`.
- **Phase 0 Audit Gap** (Remediated: 2026-06-27, Decision [2026-06-27-0003]): `scripts/audit-repo.js` now verifies the 8 mandated files in `docs/phase-zero-assessment/`.
- **Audit Script File Verification Gap** (Remediated: 2026-06-27, Decision [2026-06-27-0004]): `scripts/audit-repo.js` now verifies that every entry in `mcp.config.json` `active_mcps` and `active_skills` corresponds to an existing file.
- **Agent Index Descriptive Truncation** (Remediated: 2026-06-27, Decision [2026-06-27-0005]): `scripts/context_helpers.js` now extracts the full first paragraph (up to 400 chars) of the `Role` section.
- **Sync Script Identity Drift** (Remediated: 2026-06-27, Decision [2026-06-27-0006]): `scripts/sync-upstream.sh` now sources its identity values from `NOEMI_ORG_NAME`, `NOEMI_UPSTREAM_URL`, `NOEMI_UPSTREAM_REMOTE`, `NOEMI_LOCAL_BRANCH`.
- **SecretOps Authentication Enforcement Gap** (Remediated: 2026-06-27, Decision [2026-06-27-0007]): `scripts/verify-env.sh` and `scripts/verify-env.ps1` now exit 1 in `--mode=docker` when SecretOps CLI is missing or unauthenticated.
- **SecretOps Provider Bias in Smoke Tests** (Remediated: 2026-06-27, Decision [2026-06-27-0008]): `tests/examples-smoke.test.js` now accepts `op://` or `infisical://` / `INFISICAL_*` vault references.
- **CI/CD "False Green" Risk in E2E** (Remediated: 2026-06-27, Decision [2026-06-27-0009]): `tests/e2e/docker-smoke.test.js` now throws on missing Docker when `FORCE_DOCKER_SMOKE=true`, preserving the clean-skip default for local dev.
- **Docker Smoke Variable Inventory Gap** (Remediated: 2026-06-27, Decision [2026-06-27-0010]): `tests/examples-smoke.test.js` now verifies that `NOEMI_DOCKER_SMOKE_*` variables are documented in `.env.template`.
- **Red Team Gauntlet Serialization Gap** (Remediated: 2026-06-27, Decision [2026-06-27-0011]): `examples/red-team-gauntlet/test-vectors.json` serializes the prose test cases for automated consumption.
- **Operating Profile Baseline Absence** (Remediated: 2026-06-27, Decision [2026-06-27-0012]): `operating-profiles/standard-operating-profile.md` materializes the default operating profile so generated context carries a real injection rather than an empty block.
