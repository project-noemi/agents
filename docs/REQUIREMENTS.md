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
- The public documentation must include a reusable **Phase 0 Assessment Kit** with:
  - separate security and AI readiness assessment guides
  - `network-security-assessment.md` and `PRACTITIONER_NOTES.md`
  - consent template
  - report-of-findings template
  - 30/60/90-day roadmap template
  - readiness rubric covering security readiness, AI readiness, and the overall recommendation

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

- Both [`scripts/generate_gemini.js`](../scripts/generate_gemini.js) and [`scripts/generate_claude.js`](../scripts/generate_claude.js) must use shared helper logic.
- Both generators must inject:
  - the full mandate set from `AGENTS.md`
  - the agent index discovered from `agents/`
  - active skills from `mcp.config.json`
  - active MCP protocol content from `mcp.config.json`
- Both generators must support `--config=path/to/mcp.config.json`.

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
- **Branch protection enforcement is mandatory** (Decision [2026-05-20] — Branch Protection: Mandatory Enforcement). All forks of the reference architecture MUST run `scripts/setup-branch-protection.sh` (or an equivalent automated mechanism) on first setup to enforce the canonical `develop → main` flow. `scripts/audit-repo.js` SHOULD surface missing protection as a non-fatal warning in non-CI runs and as a fatal error in CI.

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
- **Structural vs. Substantive Compliance**: Most agent personas use identical placeholder text for `Data Inventory`, `Refusal Criteria`, and `Audit Log`, satisfying structural audits but failing framework requirements for role-specific precision.
- **Skill Contract Substantive Drift**: 100% of active reusable skills in `skills/` contain "TBD" placeholders for mandatory `Data Inventory` and `Refusal Criteria` sections, failing substantive compliance with the 4D framework.
- **Audit Script Enforcement Depth** (Verified: 2026-06-13): `scripts/audit-repo.js` now audits both `agents/` and `skills/` for required headings and validates that `Audit Log` blocks parse as JSON. Remaining gaps: it does not validate the mandated schema keys (`task`, `inputs`, `actions`, `risks`, `result`), does not detect "TBD" placeholders in mandatory sections, and does not verify that skills or MCPs referenced in `mcp.config.json` and agent workflows exist as physical files.
- **Branch Protection Audit Gap**: `scripts/audit-repo.js` lacks the mandated logic to verify branch protection status, as required by Section 7 Governance and Trust Controls.
- **Agent Index Accuracy Drift** (Verified: 2026-06-13): `scripts/context_helpers.js` extracts only the first sentence of the `Role` section (`scripts/context_helpers.js:177-181`) for the Agent Index table, resulting in truncated and potentially misleading descriptions for complex personas.
- **Resilience Helper Scope (By Design)**: `scripts/resilience_helpers.js` is a reference-only pattern per Decision [2026-04-04] — it is intentionally not integrated into deterministic local-filesystem tools (`audit-repo.js`, `generate_all.js`). The open gap is narrower: no network-facing tool or reference service in the repository currently consumes it.
- **Internal Tool Observability Gap**: Node.js tools in `tools/` (e.g., `executive-assistant`) and reference services in `examples/` (e.g., `dashboard-ingest.js`) lack structured JSON Audit Log emission to `stderr`, relying on unstructured `console.log` and missing the shared `audit_logger.js` utility mentioned in architectural mandates.
- **Docker Smoke Test Variable Validation Gap**: `tests/examples-smoke.test.js` lacks validation for mandated `NOEMI_DOCKER_SMOKE_*` environment variables required by Requirement 9.
- **Sync Script Parameterization Gap**: `scripts/sync-upstream.sh` relies on hardcoded `[MyOrganization]` placeholders and fixed URLs instead of environment-based parameterization, increasing friction for forks.
- **Memory-Code Synchronization Drift**: A significant discrepancy exists between the repository's recorded architectural history (Memory) and the implemented codebase truth. Several remediations reported as completed (e.g., shared `audit_logger.js`, parameterized sync script, enhanced agent index extraction) are missing or incomplete in the live filesystem.
- **SecretOps Authentication Verification Depth** (Verified: 2026-06-13): `scripts/verify-env.sh` currently issues only warnings for missing or unauthenticated SecretOps CLIs in all modes, including `docker` mode — the script completes with exit 0 regardless. This fails to implement Decision [2026-05-26], which mandates a fatal error (exit 1) in `docker` mode.
- **Red Team Gauntlet Serialization Gap**: Test vectors for PromptShield and PIIGuard are documented in prose within `examples/red-team-gauntlet/README.md` but are not yet serialized into machine-readable JSON/YAML files for automated testing.
- **Service Tier Template Implementation Gap**: The `templates/tiers/` directory exists but lacks the actual service tier templates (e.g., basic.md, standard.md) referenced by the Client Onboarding agent.
- **GMU Validation Example Documentation Gap** (Identified: 2026-06-13): The GMU partnership and badge program are documented in `docs/PROJECT_REFERENCE.md`, but the supporting example `examples/gmu-validation/verification-bot.js` (a Boot Camp certification audit simulator) is not referenced by any documentation, has no directory-level README, is not covered by `tests/examples-smoke.test.js`, and uses unstructured `console.log` output instead of the mandated JSON Audit Log pattern for verification/reporting tools.
- **Operating Profiles Asset Gap** (Identified: 2026-06-13): The Operating Profile injection pipeline works (Decision [2026-05-28-0005]), but `operating-profiles/` contains only `PROFILE_TEMPLATE.md` and `README.md` — zero actual profiles. Generated context files therefore carry an empty Operating Profiles layer (`<!-- No operating profiles defined in operating-profiles/ -->`) while framework documentation instructs agents to consult the profile matching their engagement context.
- **Framework Layer Ownership Metadata Gap** (Identified: 2026-06-13): All three active Value Lenses (`balanced-enterprise`, `care-continuity`, `performance-efficiency`) ship with `Owner: TBD` in their Lens Metadata while being injected verbatim into generated agent context, leaving lens validation and trade-off arbitration without an accountable human owner.
