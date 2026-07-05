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
  - `Audit Log` sections contain structurally invalid JSON or fail **mandatory JSON schema validation** (checking for `task`, `inputs`, `actions`, `risks`, and `result`).
  - `AGENTS.md` is missing required top-level mandate sections
  - generator template markers drift
  - generated context files omit required global mandate headings

### 4. Context Generation Must Stay Aligned

- Both [`scripts/generate_gemini.js`](../scripts/generate_gemini.js) and [`scripts/generate_claude.js`](../scripts/generate_claude.js) must use shared helper logic.
- Both generators must inject:
  - the full mandate set from `AGENTS.md`
  - the **complete agent index** discovered from `agents/` (Automated tools must extract the **full first paragraph** of the `## Role` section for context richness).
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

### 1. Environmental & Deployment Drift
- **SecretOps Authentication Enforcement Gap**: `scripts/verify-env.sh` and `scripts/verify-env.ps1` currently issue only warnings for missing or invalid SecretOps authentication (e.g., failing `infisical whoami`) even in `docker` mode, violating the mandate for a fatal error (exit 1) in production-like environments.
- **CI/CD "False Green" Risk in E2E**: `tests/e2e/docker-smoke.test.js` silently skips runtime checks if Docker is absent. This masks environmental gaps in CI/CD when `FORCE_DOCKER_SMOKE=true` is not set.
- **SecretOps Provider Bias**: `tests/examples-smoke.test.js` contains hardcoded assertions for the `op://` (1Password) pattern (`assert.match(content, /op:\/\//)`), causing false failures for users of Infisical or other providers.
- **Merge Gate Branch Prefix Allowlist Drift**: `.github/workflows/require-develop-source.yml` rejects PRs to `main` unless the source is `develop` or matches one of six hardcoded `doc-*` prefixes. Governed automation now also runs on `claude/*` session branches and `sync/upstream-*` branches (Decision [2026-06-30-0001]), whose PRs to `main` fail the gate; the allowlist and its maintenance policy are undocumented in Requirement §7.
- **Internal Tool Observability Gap**: While the shared `scripts/audit_logger.js` utility is available, Node.js tools like `executive-assistant` and reference services like `dashboard-ingest.js` still rely on unstructured `console.log` and have not yet adopted the mandated JSON Audit Log emission to `stderr`.
- **AI Model Baseline Drift**: Legacy Python/Bash examples (e.g., `examples/docker/agent.py`) are pinned to `gemini-2.0-flash` rather than the canonical `gemini-2.5-flash` baseline. Additionally, `operating-profiles/local-sovereign-profile.json` pins `deepseek-coder:67b-instruct` and `llama3.3:70b-instruct`, which the single-baseline mandate does not currently recognize (see Clarification [2026-07-05] Sovereign Model Pins).
- **Resilience Helper Integration Gap**: `scripts/resilience_helpers.js` exists but is not utilized by any agent personas or network-bound tools, despite the mandate for resilience.
- **Resilience Helper Module Mismatch**: `tools/executive-assistant/` uses ESM (`"type": "module"`), preventing direct import of the CommonJS `scripts/resilience_helpers.js`.

### 2. Structural & Architectural Drift
- **Audit Script Coverage Blind Spot**: `scripts/audit-repo.js` entirely skips the `mcp-protocols/`, `value-lenses/`, and `operating-profiles/` directories, leaving critical framework assets ungoverned.
- **Phase 0 Audit Gap**: `scripts/audit-repo.js` lacks logic to verify the presence of the 8+ mandated assessment files in `docs/phase-zero-assessment/`, violating Requirement §1.
- **Agent Index Descriptive Truncation (Sentence Regex Failure)**: `scripts/context_helpers.js` extracts only the first sentence of the `Role` section (`role.split('\n')[0]` followed by sentence regex), violating the "paragraph extraction" mandate in `AGENTS.md`. The regex `/^[^.!?]+[.!?]/` fails to capture full technology names containing dots (e.g., "Next.js" is truncated to "Next."), leading to inaccurate role summaries in the Agent Index.
- **Generator "Silent Success" on Missing Framework Assets**: `scripts/generate_all.js` returns HTML comments (e.g., `<!-- Framework directory not found... -->`) when `value-lenses/` or `operating-profiles/` are missing or empty, rather than failing the build. This violates the "Fail Fast" mandate for generator drift (Requirement 3).
- **Sovereign JSON Asset Layer Governance Gap**: Commit `64f5a09` ("The Great AI Pivot") added an agent persona (`agents/guardian/jailbreak-monitor-agent.json`), a skill (`skills/model-fusion-consensus/definition.json`), an MCP protocol (`mcp-protocols/local-inference-mcp.json`), and an operating profile (`operating-profiles/local-sovereign-profile.json`) as JSON files. The Markdown-only pipeline (`scripts/audit-repo.js`, `scripts/context_helpers.js` filtering `.endsWith('.md')`) neither audits, indexes, nor injects them, so these assets exist outside every structural contract, and `docs/SOVEREIGN_LLM_GUIDELINES.md` is referenced nowhere in this document (see Clarification [2026-07-05] Sovereign JSON Asset Layer Governance).
- **Infrastructure Asset Implementation Gap**: `templates/tiers/` contains only a README, and `operating-profiles/` contains no Markdown profiles (only the template, README, and the JSON sovereign profile invisible to the generator), resulting in hollow or empty injection blocks in generated context. The approved starter profile set from Decision [2026-06-19-0011] remains unimplemented.
- **Heading Inconsistency**: The mandatory Diligence heading is "Rules & Constraints" in agents but "Rules & Constraints (4D Diligence)" in skills, complicating automated audit logic.
- **Undocumented "Learning Agent" Pattern**: `tools/executive-assistant/server.js` implements a `/api/resolution` feedback loop and "Learning Agent" logic (`event: 'LEARNING_AGENT_UPDATE'`) that maps human feedback back into the system's execution logs. This pattern lacks a persona specification and governance requirements in `REQUIREMENTS.md`.
- **Undocumented Admin Control Surface**: `tools/executive-assistant/server.js` implements several admin-facing API endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`) that provide unauthenticated access to internal agent state, queued tasks, and rule configurations, creating a governance drift from the security baseline.

### 3. Substantive & Safety Drift
- **Substantive Content Baseline (The "TBD" Problem)**: 100% of reusable skills and most agent personas use "TBD" placeholders or boilerplate for `Data Inventory` and `Refusal Criteria`, bypassing the D2 (Description) and Refusal Principle mandates.
- **Audit Script Substantive Blindness**: `scripts/audit-repo.js` verifies the presence of headings but fails to detect "TBD" placeholders or validate the content of `Refusal Criteria` subsections.
- **Audit Log Schema Validation Gap**: `scripts/audit-repo.js` verifies that Audit Logs are valid JSON but does not yet implement the mandated JSON schema validation (checking for `task`, `inputs`, `actions`, `risks`, and `result`), despite the requirement in §3.

### 4. Referential & Link Integrity Drift
- **Internal Referential Integrity Gap**: The repository lacks automated verification for internal markdown links and `**Skill:**` path references within agent workflows.
- **Audit Script File Verification Gap**: `scripts/audit-repo.js` does not verify that skills or MCPs referenced in `mcp.config.json` exist as physical files.

### 5. Remediated Limitations (Archive)
- **Sync Script Identity Drift** (Remediated: 2026-06-19, verified 2026-07-05): `scripts/sync-upstream.sh` now reads `NOEMI_UPSTREAM_REMOTE`, `NOEMI_UPSTREAM_URL`, and related values from the environment with upstream-preserving defaults; the hardcoded `MY_ORGANIZATION` placeholder is gone (Decision [2026-06-19-0002]).
- **Red Team Gauntlet Serialization Gap** (Remediated, verified 2026-07-05): machine-readable starter vectors now ship as `examples/red-team-gauntlet/test-vectors.yaml` (five vectors: three prompt-injection, two PII), consumable by the `Client Onboarding` validation workflow (Decision [2026-06-19-0008]; shipped as YAML rather than the JSON named in the decision).
- **Smoke Test Variable Validation Gap** (Remediated: 2026-06-19, verified 2026-07-05): `tests/examples-smoke.test.js` now bidirectionally validates every `NOEMI_DOCKER_SMOKE_*` variable referenced by the e2e suite against `.env.template` (Decision [2026-06-19-0003]).
- **Missing shared `audit_logger.js`** (Remediated: 2026-06-19): The shared utility for structured JSON Audit Log emission is now available in the `scripts/` directory.
- **Missing Onboarding and Configuration Directories** (Remediated: 2026-05-28): `clients/`, `.gatekeeper/`, and `templates/tiers/` directories now exist with `.gitignore` placeholders.
- **Framework Injection Gap** (Remediated: 2026-05-28): `Value Lenses` and `Operating Profiles` are now injected by `scripts/generate_all.js`.
- **Artifact Naming Convention Alignment** (Remediated: 2026-05-10): `docs/n8n workflows/` renamed to `docs/n8n-workflows/`.
- **Node.js 24 Baseline Alignment** (Remediated: 2026-05-10): `executive-assistant` and `gatekeeper-deployment` updated to Node 24 images.
