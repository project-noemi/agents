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
- **Test Suite Gaps**: `tests/examples-smoke.test.js` lacks validation for mandated `NOEMI_DOCKER_SMOKE_*` environment variables (Requirement 9).
- **Missing Onboarding and Configuration Directories**: `clients/`, `.gatekeeper/`, and `templates/tiers/` directories referenced in agent specifications (`Client Onboarding`, `Gatekeeper`, `QBR Presenter`) do not exist in the repository root.
- **Structural vs. Substantive Compliance**: Most agent personas use identical placeholder text for `Data Inventory`, `Refusal Criteria`, and `Audit Log`, satisfying structural audits but failing framework requirements for role-specific precision.
- **Pre-flight Script Active Authentication**: `scripts/verify-env.sh` and `scripts/verify-env.ps1` have been updated to perform active authentication verification (e.g., `infisical whoami` or `op user get --me`) (Resolved: 2026-05-22).
- **Pre-flight Logic Contradiction**: `scripts/verify-env.sh` previously contained redundant and contradictory SecretOps checks. A code review (2026-05-28) confirms the script was refactored to a single unified SecretOps block with warning-only behavior for absent vault CLIs. The open policy question of whether `docker` mode should enforce a hard-fail remains tracked in Q [2026-05-22] (Resolved: 2026-05-28).
- **Skill Contract Structural Alignment**: All 8 reusable skills and the `SKILL_TEMPLATE.md` now include the mandatory `## Data Inventory` section and the `### Refusal Criteria` H3 subsection, although content remains as placeholders (Resolved: 2026-05-22).
- **Config-to-Asset Mapping Drift**: `mcp.config.json` entries for active MCPs/skills are not verified for existence by `scripts/audit-repo.js`, leading to potential "silent failures" in context generation.
- **Framework Injection Gap**: `Value Lenses` and `Operating Profiles` are documented in `docs/frameworks/` but not yet injected by `scripts/generate_all.js` due to missing `VALUE_LENS_INJECTIONS` and `OPERATING_PROFILE_INJECTIONS` template markers in `templates/context/`.
- **Template Marker Duplication**: `templates/context/GEMINI.template.md` contains duplicate marker pairs for `GLOBAL_MANDATES` and `AGENT_INDEX`, causing redundant section injection in generated context.
- **Agent Index Accuracy Drift**: `scripts/context_helpers.js` extracts only the first sentence of the `Role` section for the Agent Index table, resulting in truncated and potentially misleading descriptions for complex personas.
- **Resilience Helper Integration Gap**: `scripts/resilience_helpers.js` exists as a canonical reference but is not utilized by repository tools (`audit-repo.js`, `generate_all.js`) or any agent personas, violating the resilience mandate for agentic systems.
- **Sync Script Hardcoding**: `scripts/sync-upstream.sh` contains hardcoded `[MyOrganization]` placeholders and fixed URLs, requiring manual find-and-replace by organizations forking the reference architecture.
- **Audit Log Emission Gaps**: Build utilities (`generate_all.js`, `audit-repo.js`), reference services (`dashboard-ingest.js`), and tools (`executive-assistant`) lack structured JSON Audit Log emission to `stderr`, hindering fleet-wide observability.
- **Node.js 24 Baseline Drift**: Build utilities (`generate_all.js`, `audit-repo.js`) and internal tools in `tools/` (e.g., `executive-assistant`) were verified as correctly using Node.js 24 baseline (Resolved: 2026-05-22).
- **Internal Tool Observability Gap**: Node.js tools in `tools/` (e.g., `executive-assistant`) and reference services in `examples/` (e.g., `dashboard-ingest.js`) lack structured JSON Audit Log emission to `stderr`, using unstructured `console.log` instead.
- **Fleet Dashboard API Path Standardization**: The Fleet Dashboard API path is standardized to `/api/v1/reports` across `dashboard-ingest.js`, `docker-compose.yml`, and `tests/examples-smoke.test.js` (Resolved: 2026-05-21).
- **Skill-to-Agent Reference Integrity Gap**: `scripts/audit-repo.js` does not verify that skills referenced in agent `Workflow` sections exist in the `skills/` directory or are enabled in `mcp.config.json`, leading to potentially broken agent specifications.
- **New Agent Documentation Mirror Gap**: Three agents added in the 2026-05-25 wave (`agents/coding/architect/core.md`, `agents/coding/bolt/go.md`, `agents/education/student-success-coach.md`) have no corresponding guide entries in `docs/agents/`. The `docs/agents/education/` directory does not exist. Per Decision [2026-04-02], mirroring is at the directory and guide level; the gap is material for two new domains and one new specialist variant.
- **Branch Allowlist Maintenance Overhead**: `require-develop-source.yml` enforces the `develop → main` governance rule using a hardcoded list of branch-name pattern exceptions for AI agent doc branches. As new agent branch naming conventions emerge, each requires a manual workflow edit, creating ongoing governance maintenance overhead.
