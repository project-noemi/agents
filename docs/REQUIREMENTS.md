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
- **Gatekeeper Implementation Gap**: The reference implementation in `examples/gatekeeper-deployment/` does not yet execute the full mutating action set (merges/closes) described in the persona.
- **Docker e2e Skip Behavior**: The Docker e2e suite skips runtime checks if Docker is absent, rather than failing, which can mask environmental gaps in CI.
- **Logging Protocol Implementation Gap**: `logging-mcp` is a dual-backend draft (Loki/n8n) but is not yet active in `mcp.config.json`, and reference services (e.g., `dashboard-ingest.js`) lack alignment with its schema.
- **Missing Onboarding and Configuration Directories** (Remediated: 2026-05-28): `clients/`, `.gatekeeper/`, and `templates/tiers/` directories referenced in agent specifications (`Client Onboarding`, `Gatekeeper`, `QBR Presenter`) now exist in the repository root with `.gitignore` placeholders for the runtime-state directories and a README for tier templates (Decision [2026-05-28-0002]).
- **Framework Injection Gap** (Remediated: 2026-05-28): `Value Lenses` and `Operating Profiles` are now injected by `scripts/generate_all.js` into the `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` template markers (Decision [2026-05-28-0005]). Generated `GEMINI.md` and `CLAUDE.md` carry the framework layer inline.
- **Operating Profile Substantive Gap**: While the injection mechanism for Operating Profiles is active, the `operating-profiles/` directory contains only templates and no baseline profiles, resulting in empty injection blocks in generated context files.
- **Structural vs. Substantive Compliance**: Most agent personas use identical placeholder text for `Data Inventory`, `Refusal Criteria`, and `Audit Log`, satisfying structural audits but failing framework requirements for role-specific precision.
- **Skill Contract Substantive Drift**: 100% of active reusable skills in `skills/` contain "TBD" placeholders for mandatory `Data Inventory` and `Refusal Criteria` sections, failing substantive compliance with the 4D framework.
- **Audit Script Enforcement Depth**: `scripts/audit-repo.js` fails to verify that skills or MCPs referenced in `mcp.config.json` and agent workflows exist as physical files. It also lacks schema-level validation for `Audit Log` JSON, performing only basic structural parsing.
- **Branch Protection Audit Gap**: `scripts/audit-repo.js` lacks the mandated logic to verify branch protection status, as required by Section 7 Governance and Trust Controls.
- **Internal Tool Observability Adoption Gap**: The shared `scripts/audit_logger.js` utility now exists (Decision [2026-06-19-0001]) and provides the canonical NDJSON-to-stderr emitter. `tools/executive-assistant` and `examples/gatekeeper-deployment/dashboard-ingest.js` still need to be refactored to import and call it; this is an adoption task, no longer a missing-dependency task.
- **Sync Script Parameterization Gap** (Remediated: 2026-06-19): `scripts/sync-upstream.sh` now reads `NOEMI_UPSTREAM_REMOTE`, `NOEMI_UPSTREAM_URL`, `NOEMI_LOCAL_BRANCH`, and `NOEMI_ORG_NAME` from the environment with sensible defaults (Decision [2026-06-19-0002]). Forks no longer need to patch the source file.
- **Memory-Code Synchronization Drift** (Verified: 2026-06-17): A significant discrepancy exists between the repository's recorded architectural history (Memory) and the implemented codebase truth. A 2026-06-17 audit confirmed that remediations reported as completed (shared `audit_logger.js`, parameterized sync script, enhanced agent index extraction) remain missing or incomplete in the live filesystem.
- **Substantive Content Boilerplate** (Verified: 2026-06-17): While 100% of agent personas are structurally compliant, they utilize identical boilerplate for `Refusal Criteria` and `Data Inventory`, representing a substantive drift from the 4D Description (D2) and Refusal Principle mandates.
- **Audit Script JSON Schema Blindness**: `scripts/audit-repo.js` verifies that the `Audit Log` section contains valid JSON, but it does not perform schema validation for mandated fields (`task`, `inputs`, `actions`, `risks`, `result`) or detect "TBD" placeholders.
- **MCP Protocol Structural Audit Gap**: `scripts/audit-repo.js` does not perform structural or heading audits for protocol specifications in `mcp-protocols/`, leaving the repository's tool-governance layer unvalidated against the core Persona/Skill contract standards.
- **Framework Asset Structural Audit Gap**: `scripts/audit-repo.js` fails to audit the contents of `value-lenses/` and `operating-profiles/` for alignment with their respective mandatory templates, relying only on marker presence in context generators.
- **Internal Referential Integrity Gap**: The repository lacks automated verification that internal markdown links or `**Skill:**` path references within agent workflows point to valid, existing files, leading to silent "broken link" drift during asset refactors.
- **SecretOps Authentication Verification Depth**: `scripts/verify-env.sh` and `scripts/verify-env.ps1` currently issue only warnings for missing SecretOps authentication in `docker` mode, failing to meet the mandate for a fatal error (exit 1) to ensure runtime security.
- **Agent Index Descriptive Truncation**: `scripts/context_helpers.js` extracts only the first sentence of the `Role` section, resulting in truncated descriptions in the Agent Index for complex personas.
- **Red Team Gauntlet Machine-Readable Serialization Gap**: Test vectors for PromptShield and PIIGuard are documented in prose within `examples/red-team-gauntlet/README.md` but are not yet serialized into machine-readable JSON/YAML files for automated testing.
- **Service Tier Template Implementation Gap**: The `templates/tiers/` directory exists but lacks the actual service tier templates (e.g., basic.md, standard.md) referenced by the Client Onboarding agent.
- **Smoke Test Variable Validation Gap** (Remediated: 2026-06-19): `tests/examples-smoke.test.js` now includes a bidirectional check that every `NOEMI_DOCKER_SMOKE_*` variable referenced by `tests/e2e/docker-smoke.test.js` is declared in `.env.template` with a non-empty default, and vice versa (Decision [2026-06-19-0003]).
- **Operating Profile Substantive Gap**: While the injection mechanism for Operating Profiles is active, `operating-profiles/` contains only the template and README. Decision [2026-06-19-0011] approves authoring a baseline set (`standard-operating-profile.md`, `high-trust-regulated.md`, `fast-iteration-startup.md`); these are not yet authored.
- **ROI Auditor Baseline Data Access**: Decision [2026-06-19-0015] selects a local `tools/roi/baseline-config.json` snapshot (read-only) as the auditor's data source over a live Sheets read. The snapshot file and the persona update that references it are not yet implemented.
- **SecretOps Authentication Verification Depth**: `scripts/verify-env.sh` and `scripts/verify-env.ps1` currently issue only warnings for missing SecretOps authentication in `docker` mode, failing to meet the mandate for a fatal error (exit 1) to ensure runtime security.
- **Agent Index Descriptive Truncation**: `scripts/context_helpers.js` extracts only the first sentence of the `Role` section, resulting in truncated descriptions in the Agent Index for complex personas.
- **Audit Script Structural Limitation**: `scripts/audit-repo.js` verifies the presence of mandatory headings but fails to detect "TBD" or hollow placeholders, allowing safety-deficient personas to pass the audit.
- **Internal Referential Integrity Gap**: The repository lacks automated verification that internal markdown links or `**Skill:**` path references within agent workflows point to valid, existing files, leading to silent "broken link" drift.
- **Audit Script JSON Schema Blindness**: `scripts/audit-repo.js` verifies that the `Audit Log` section contains valid JSON, but it does not perform schema validation for mandated fields (`task`, `inputs`, `actions`, `risks`, `result`) or detect "TBD" placeholders.
