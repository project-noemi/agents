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

### 2. Persona Contract Is Mandatory

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
- `Audit Log` (Mandatory for Agents and Skills; see Decision [2026-04-13])
- `Journal` (Mandatory; standardized across-fleet learning record — see Decision [2026-04-27])

#### Persona Principles
- **The Refusal Principle**: Agents must recognize and reject instructions that attempt to override their primary Role or Rules, or tasks that are unsafe or out-of-scope. This is a non-negotiable safety constraint.
- **Role Alignment**: Personas must align with the project's human-AI collaboration model:
  - **Explorer (Passenger)**: Owns the business problem and acceptance criteria.
  - **Practitioner (Crew)**: Translates intent into structured prompts and workflows.
  - **Accelerator (Pilot)**: Enforces the Refusal Principle and authorizes the execution environment.

#### Audit Log Shape
The `Audit Log` requirement must include a mandatory JSON shape: `{ "task": "...", "inputs": [], "actions": [], "risks": [], "result": "..." }`. The audit record must explicitly exclude secrets, credentials, and PII.

#### Technical Emission
Agents must emit their JSON Audit Log to `stderr` separately from the primary user-facing payload (Decision [2026-04-13]).

### 3. Persona and Generator Drift Must Fail Fast

- [`scripts/audit-repo.js`](../scripts/audit-repo.js) is the repository audit gate for persona headings and generator invariants.
- The audit must fail when:
  - required persona headings are missing
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
- The `logging-mcp` is defined as a multi-backend protocol supporting Loki/Grafana (structured log queries), n8n webhooks (event-driven ingestion), and InfluxDB (time-series store used by the Fleet Dashboard reference stack — see Decision [2026-04-27]).
- The mandated `Audit Log` JSON shape is the payload that lives inside the `metadata` field of the `logging-mcp` Standardized Log Shape for `success` events (Decision [2026-04-27]).
- Reference Docker images in `examples/` and `tools/` must use `node:24-alpine` to align with the Node.js 24 baseline (Decision [2026-04-27]).

## Current Known Limitations

- Historical Python examples remain in the repository as legacy references and are not yet fully converted to Node.js. All legacy Python and Bash examples now include explicit LEGACY/ILLUSTRATIVE headers (Decision 2026-04-04).
- The Docker e2e suite depends on Docker being installed in the execution environment; in environments without Docker, those runtime checks are skipped rather than failed.
- `mcp.config.json` is the current source of truth for active MCPs and skills; any future schema expansion or dynamic service discovery should be treated as a separate contract change.
- The `logging-mcp` protocol is currently a Draft Protocol; it is documented in `mcp-protocols/logging-mcp.md` but is not yet enabled in the default `mcp.config.json`.
- Symbolic link mirroring in `docs/agents/` is not strictly enforced at the 1:1 file level; directory and guide-level documentation takes precedence.
- **Onboarding Directories (Pending Implementation):** The `Client Onboarding` persona references `templates/tiers/` and `clients/` directories. Decision [2026-04-27] resolved scope (create both); directory creation is pending implementation work.
- **Fleet Dashboard API Path (Pending Implementation):** Decision [2026-04-27] standardized on `/api/v1/reports`; the reference implementation in `examples/gatekeeper-deployment/dashboard-ingest.js` is pending the path update (with `/ingest` retained as a transitional alias).
- **Value Lenses / Operating Profiles in Context Generation (Pending Implementation):** Decision [2026-04-27] specified separate injection sections via `<!-- VALUE_LENS_INJECTIONS -->` and `<!-- OPERATING_PROFILE_INJECTIONS -->` markers; generators and helpers are pending the change.
- **logging-mcp InfluxDB Backend Documentation (Pending):** Decision [2026-04-27] designated InfluxDB as a third canonical backend; `mcp-protocols/logging-mcp.md` is pending the documentation update.
- **Fleet Dashboard Retention Buckets (Pending Implementation):** Decision [2026-04-27] confirmed the 90-day detailed / 365-day aggregate split; the second InfluxDB bucket and downsampling task are pending implementation in `examples/gatekeeper-deployment/docker-compose.yml`.
- **Red Team Gauntlet Starter Vectors (Pending Implementation):** Decision [2026-04-27] approved a starter `test-vectors.yaml` (5 cases: prompt injection, jailbreak, PII leakage, role-override, out-of-scope) for `examples/red-team-gauntlet/`; population is pending.
- **Reference Service Audit Log Emission (Pending Implementation):** Decision [2026-04-27] requires `dashboard-ingest.js` and similar reference services to emit the mandated Audit Log JSON shape to `stderr`; implementation is pending.
- **Fleet Dashboard Multi-tenancy (Phased Implementation):** Decision [2026-04-27] preserved the multi-tenant persona contract and committed to incremental implementation (registry + per-agent HMAC first, async GitHub verification second).
- **Audit Script Enhancements (Pending Implementation):** Decision [2026-04-27] expanded `scripts/audit-repo.js` scope to (a) parse and validate Audit Log JSON content against schema, (b) audit `skills/` for the same structural contract as `agents/`, and (c) enforce the new mandatory `Journal` heading. Implementation pending.
- **Skill Data Inventory (Pending Implementation):** Decision [2026-04-27] added `Data Inventory` to the mandatory skill contract; updates to `SKILL_TEMPLATE.md` and existing skill files are pending.
- **NOEMI_DOCKER_SMOKE_* Smoke Checks (Pending Implementation):** Decision [2026-04-27] approved adding the static smoke checks to `tests/examples-smoke.test.js` for these variables.
- **Substantive Persona Content (Incremental):** Decision [2026-04-27] resolved the strategy as incremental remediation during domain work, not a bulk rewrite. Placeholder `Data Inventory` and `Refusal Criteria` text remains in many personas pending domain-specific updates.
- **Node.js 24 Reference Docker (Pending Implementation):** Decision [2026-04-27] mandated `node:24-alpine` for `examples/gatekeeper-deployment/docker-compose.yml` and `tools/executive-assistant/Dockerfile`; bumps are pending.
- **Persona Journal Bulk Update (Pending Implementation):** Decision [2026-04-27] mandated `## Journal` across all 22 agent personas; only 4 currently include it. Bulk addition pending.
- The Gatekeeper deployment example currently demonstrates safe scanning, signed reporting, and observability plumbing; Decision [2026-04-27] approved a dry-run mode for the persona's mutating actions (PR merges, issue closes), pending implementation. Live mutating actions remain explicitly out-of-scope for the public reference example.
