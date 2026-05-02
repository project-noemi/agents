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
- `Rules & Constraints (4D Diligence)`
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
  - required persona or skill headings are missing
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

### 8. Reference Examples Must Tell the Truth

- The Gatekeeper deployment example must use HMAC-signed dashboard submissions and a verifiable ingest path.
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
- The builder path must also include a short Docker onboarding walkthrough that chains environment verification, context generation, validation, and initial Docker launch after the first local success.

## Runtime and Tooling Requirements

- Node.js is the primary runtime for repository utilities and generation scripts.
- The built-in Node test runner is the primary validation framework for repository contracts and smoke tests.
- Git, Node.js, and at least one supported local AI client (Gemini CLI, Claude Code CLI, or OpenAI Codex) remain part of the documented beginner toolchain.
- Docker becomes part of the documented toolchain when a builder moves into runtime homes or Docker verification.
- Python examples may remain for historical context, but they are not the canonical implementation path for new work.
- The `logging-mcp` is defined as a dual-backend protocol supporting both Loki/Grafana (structured log queries) and n8n webhooks (event-driven ingestion).

## Current Known Limitations

- Historical Python examples remain in the repository as legacy references and are not yet fully converted to Node.js. All legacy Python and Bash examples now include explicit LEGACY/ILLUSTRATIVE headers (Decision 2026-04-04).
- The Gatekeeper deployment example currently demonstrates safe scanning, signed reporting, and observability plumbing; it does not yet implement the full mutating action set described in the Gatekeeper persona.
- The Docker e2e suite depends on Docker being installed in the execution environment; in environments without Docker, those runtime checks are skipped rather than failed.
- `mcp.config.json` is the current source of truth for active MCPs and skills; any future schema expansion or dynamic service discovery should be treated as a separate contract change.
- The `logging-mcp` protocol is currently a Draft Protocol; it is documented in `mcp-protocols/logging-mcp.md` but is not yet enabled in the default `mcp.config.json`.
- Symbolic link mirroring in `docs/agents/` is not strictly enforced at the 1:1 file level; directory and guide-level documentation takes precedence.
- The `Client Onboarding` persona (`agents/operations/client-onboarding.md`) references `templates/tiers/` and `clients/` directories that are currently absent from the repository.
- There is an API path inconsistency between the Fleet Dashboard persona (specifying `/api/v1/reports`) and the current reference implementation (`examples/gatekeeper-deployment/dashboard-ingest.js` using `/ingest`).
- The standardized `Audit Log` JSON shape and its integration with the `logging-mcp` and `Structured Report` skill schemas remain under clarification for technical alignment.
- The `Value Lenses` and `Operating Profiles` frameworks are documented in `docs/frameworks/` but not yet integrated into the automated context generation scripts (`scripts/generate_gemini.js` and `scripts/generate_claude.js`).
- The `logging-mcp` protocol definition does not currently include InfluxDB as a supported backend, despite InfluxDB being the primary time-series store in the reference implementation.
- The Fleet Dashboard specification (90-day detailed / 1-year aggregate) drifts from the reference implementation (single 90-day bucket).
- The `Client Onboarding` validation workflow references `red-team-gauntlet` test vectors that are currently missing from the repository.
- Reference implementation services (e.g., `dashboard-ingest.js`) do not yet emit the mandated JSON Audit Log shape.
- There is an implementation gap between the `Fleet Dashboard` multi-tenancy registry and verification specification and the current single-agent reference implementation.
- The mandatory `Audit Log` JSON shape lacks automated technical validation in `scripts/audit-repo.js`.
- **Audit Script Gaps**: `scripts/audit-repo.js` currently only audits files in the `agents/` directory. It does not yet enforce structural contracts (Required Headings, Refusal Criteria) on the `skills/` directory, nor does it perform JSON schema validation for the `Audit Log` content.
- **Test Suite Gaps**: `tests/examples-smoke.test.js` lacks the mandated static smoke check validation for `NOEMI_DOCKER_SMOKE_*` environment variables required by Section 9.
- **Structural vs. Substantive Compliance**: 100% of agent personas currently use identical placeholder text for the mandatory `Data Inventory` and `Refusal Criteria` sections. While these satisfy structural audit checks, they fail to provide role-specific technical and safety context required by the 4D framework.
- **Reference Example Completeness**: Several reference examples, notably `examples/red-team-gauntlet/`, lack the actual assets (test vectors, prompts) required to execute the workflows described in agent specifications.
- **Node.js 24 Baseline Drift**: Reference Docker configurations in `examples/gatekeeper-deployment/docker-compose.yml` and `tools/executive-assistant/Dockerfile` are still pinned to `node:20-alpine`, drifting from the repository's mandatory Node.js 24 baseline.
- **Persona Journal Inconsistency**: The `Journal` section is currently implemented in only 4 of 22 agent personas (`sentinel/core.md`, `bolt/core.md`, `bolt/nextjs-16.md`, `gatekeeper.md`), drifting from the goal of a standardized across-fleet learning mechanism.
- **Reference Service Audit Log Drift**: Reference implementation services (e.g., `dashboard-ingest.js`) do not yet emit their own operational audit logs to `stderr` in the mandated JSON shape, hindering unified observability of the ingestion stack.
- **Resilience Helper Integration Gap**: While `scripts/resilience_helpers.js` is provided as a reference, it is not yet integrated into the repository's own Node.js-based tooling (`audit-repo.js`, `generate_all.js`), nor utilized by the 22 agent personas.
- **Sync Script Hardcoding**: `scripts/sync-upstream.sh` and its documentation contain hardcoded `[MyOrganization]` placeholders and fixed GitHub URLs, drifting from the project's goal of providing generalized, environment-agnostic reference assets.
- **Audit Script Heading Case Sensitivity**: `scripts/audit-repo.js` expects "Refusal Criteria" but some personas or templates might use "Refusal criteria" or other case variations, causing potential audit failures or drift.
- **Audit Log Placeholder Ubiquity**: 100% of agent personas and skills use the exact same placeholder JSON for the `Audit Log` section, satisfying structural audits but providing no substantive implementation guidance.
- **Audit Script Structural Blindness**: `scripts/audit-repo.js` verifies the presence of the `Refusal Criteria` heading but ignores its required hierarchy (H3 subsection within `Rules & Constraints`), drifting from the mandate in `AGENTS.md`.
- **Artifact Naming Drift**: `docs/n8n workflows/` contains spaces, drifting from the mandatory "English-first, slug-based naming" convention defined in `AGENTS.md`.
- **Pre-flight Script Shallow Validation**: `scripts/verify-env.sh` and `scripts/verify-env.ps1` check for the presence of SecretOps CLIs but do not perform active authentication verification (e.g., `op whoami`), leading to potential runtime failures in "Fetch-on-Demand" mode.
- **Audit Log Emission Gaps in Tooling**: Current build and audit utilities (`generate_all.js`, `audit-repo.js`) and reference services (`dashboard-ingest.js`) use standard `console.error` for errors but do not emit the mandated JSON Audit Log shape to `stderr`, drifting from the observability requirements set for agents and reference services.
- **Undocumented Protocol Support**: `mcp.config.json` includes active protocols (e.g., `web-search`, `github`) that are implemented in `mcp-protocols/` but not yet formally documented as mandatory baseline requirements in `REQUIREMENTS.md`.
