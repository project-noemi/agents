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
  - the Phase 0 Assessment Kit inventory mandated by §1 is incomplete — any of the eight kit files missing from `docs/phase-zero-assessment/` (Decision [2026-07-05-0011])

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
- **Develop-only merge invariant** (Decision [2026-07-03-0001], codified per Decision [2026-07-07-0002]): `develop` is the ONLY valid PR source into `main`. All feature, doc-uplift, and automation PRs — governed session branches (`claude/*`), upstream-sync branches (`sync/upstream-*`), doc branches (`doc/*`) — MUST target `develop`. `main` is reached exclusively through a periodic `develop → main` release PR, which is a scheduled routine responsibility (weekly by default). `docs/DEV_AGENT_PROMPT.md` and `docs/SYNC_AGENT_PROMPT.md` state this invariant explicitly so automation runs cannot accidentally target `main`. Any genuine hotfix-to-main exception must be added as a single explicit entry in `.github/workflows/require-develop-source.yml` — never a broad wildcard (the six accreted `doc-*` wildcards removed by [2026-07-03-0001] are the cautionary tale).

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
- The repository must expose a sync-upstream regression entrypoint through `npm run test:sync` (invoking `scripts/test-sync-upstream.sh`). This is included in `validate:full` and executed by GitHub Actions on every push and pull request targeting `develop` and `main` (Decision [2026-07-13-0003]).
- The same validation contract must be enforced in GitHub Actions on pushes and pull requests targeting `develop` and `main`.
- The Docker e2e suite must skip cleanly when Docker is unavailable and execute real compose-based runtime checks when it is available. Setting `FORCE_DOCKER_SMOKE=true` promotes a missing Docker binary from "skip" to "fail" (Decision [2026-07-05-0006]); the CI `docker-smoke` job sets this flag so a misconfigured runner fails loudly instead of producing a false green.

### 10. Docker Guidance Must Describe the Home, Not a Fake Runtime

- The builder path must include a beginner-safe onboarding guide that gets a new user from clone to one harmless local success before Docker becomes mandatory.
- The builder path must include a Docker-oriented guide that explains how to build a home around the repo's assets without misrepresenting the repository as a runtime product.
- That guide must connect the current local, fleet, and specialist Docker examples into one coherent progression.
- That guide must also include a short Docker onboarding walkthrough that chains environment verification, context generation, validation, and initial Docker launch after the first local success.

### 11. Licensing Posture Is a First-Class Requirement

- The repository is licensed under **Functional Source License, Version 1.1, Apache 2.0 Future License (FSL-1.1-Apache-2.0)** per Decision [2026-07-05-0004]. `LICENSE` MUST carry the canonical FSL header and SPDX identifier; `package.json` MUST declare `"license": "FSL-1.1-Apache-2.0"`; `docs/TRANSPARENT_SOURCE.md` MUST be present as the canonical definition of the NoéMI Transparent™ mark and its five-clause guarantee.
- `scripts/audit-repo.js` MUST verify (Decision [2026-07-13-0002]) that all three artifacts are present and consistent; any drift is a fatal audit failure. This prevents a future contributor from silently changing the license posture without tripping the governance gate.
- The FSL two-year conversion clock runs per published tagged release (see the "FSL Conversion Clock Has No Tagged Release Anchor" limitation for the current anchoring gap).

## Runtime and Tooling Requirements

- Node.js is the primary runtime for repository utilities and generation scripts.
- The built-in Node test runner is the primary validation framework for repository contracts and smoke tests.
- Git, Node.js, and at least one supported local AI client (Gemini CLI, Claude Code CLI, or OpenAI Codex) remain part of the documented beginner toolchain.
- The following MCP protocols are formally recognized as baseline requirements: `n8n`, `slack`, `gmail`, `google-*` suite, `web-search`, and `github`.
- Docker becomes part of the documented toolchain when a builder moves into runtime homes or Docker verification.
- Python examples may remain for historical context, but they are not the canonical implementation path for new work.
- The `logging-mcp` is defined as a dual-backend protocol supporting both Loki/Grafana (structured log queries) and n8n webhooks (event-driven ingestion).
- **AI Model Baseline (Dual-Track)** (Decision [2026-07-13-0004]): Project NoéMI supports two canonical model tracks; a persona or operating profile MUST declare which track it targets.
  - **Proprietary / Cloud Track (default)**: Reference workflows, lab examples, and smoke tests are pinned to **Gemini 2.5 Flash** (`models/gemini-2.5-flash`) for predictable performance and cost. This remains the baseline for any persona or example that does not explicitly opt into the sovereign track.
  - **Sovereign / Local Track**: Operating profiles under `operating-profiles/*sovereign*` and personas explicitly declaring `sovereign` posture may pin the approved local model set — primary `deepseek-coder:67b-instruct`, fallback `llama3.3:70b-instruct` — routed through the `local-inference-mcp` protocol. The audit script's non-baseline model-pin check (Decision [2026-06-19-0012]) MUST allowlist this pair when it is bound within a sovereign operating profile or persona; any other non-baseline pin remains a warning.
  - Additions to either track require a new decision entry. The two tracks are peers, not primary/exception.

## Current Known Limitations

### 1. Environmental & Deployment Drift
- **SecretOps Authentication Enforcement Gap**: `scripts/verify-env.sh` and `scripts/verify-env.ps1` currently issue only warnings for missing or invalid SecretOps authentication (e.g., failing `infisical whoami`) even in `docker` mode, violating the mandate for a fatal error (exit 1) in production-like environments.
- **Internal Tool Observability Gap**: While the shared `scripts/audit_logger.js` utility is available, Node.js tools like `executive-assistant` and reference services like `dashboard-ingest.js` still rely on unstructured `console.log` and have not yet adopted the mandated JSON Audit Log emission to `stderr`. This includes events like `[Pub/Sub] Notification received` and `[Triage Router] Execution Complete`.
- **AI Model Baseline — Sovereign Track Audit Allowlist Pending** (Answered 2026-07-13-0004; implementation pending): The AI Model Baseline is now dual-track (Gemini 2.5 Flash cloud + DeepSeek/Llama sovereign) per Decision [2026-07-13-0004]. The approved non-baseline model-pin audit (Decision [2026-06-19-0012]) still needs to acquire the sovereign-track allowlist logic so `operating-profiles/local-sovereign-profile.json` and future sovereign personas are recognized as compliant rather than flagged as drift. The legacy-example portion was remediated on 2026-07-05: `examples/docker/agent.py` now uses `gemini-2.5-flash` (Decision [2026-07-05-0008]).
- **Resilience Helper Integration Gap**: `scripts/resilience_helpers.js` exists but is not yet referenced by any network-bound agent personas. Decision [2026-07-07-0001] reframed this as an incremental opt-in documentation convention — network-bound personas name the reference pattern in their `External Tooling Dependencies` section on the next PR that touches them for any reason. Bulk fleet update explicitly not authorized. Entry remains open to track adoption progress.
- **Resilience Helper Module Mismatch**: `tools/executive-assistant/` uses ESM (`"type": "module"`), preventing direct import of the CommonJS `scripts/resilience_helpers.js`. Decision [2026-07-05-0005] approved a dual-export CJS/ESM shim strategy (add `.mjs` re-export files as consumers actually need them); implementation pending — no `.mjs` shims exist yet.
- **Merge-Gate Wildcard Re-Accretion and Automation Gate Self-Modification** (Answered 2026-07-10-0002; escalated 2026-07-14): Requirement §7 mandates that `develop` is the only valid PR source into `main` and that any hotfix exception must be "a single explicit entry... never a broad wildcard," but `.github/workflows/require-develop-source.yml` re-accreted two wildcard exceptions (`doc-requirements-uplift-*` and `doc-requirements-refinement-*`) via direct-to-main automation commits `a0a7fad` (2026-07-07) and `e54275a` (2026-07-09) — after Decision [2026-07-03-0001] removed the previous six. Verified 2026-07-14: the two wildcards were present on **both** `main`'s and `develop`'s copies of the gate (the 2026-07-13 reconciliation merge carried them onto `develop`); `develop`'s copy is stripped back to the bare develop-only check as of Decision [2026-07-14-0001], while `main`'s copy still carries them until the next release PR. **Escalation evidence:** the direct-to-main automation ran again on 2026-07-12 (PR #286, merged into `main` through the `doc-requirements-uplift-*` wildcard) and on 2026-07-14 (PR #291, open, from `doc-requirements-drift-uplift-20260713-*` — whose "resolve CI failure" commit **adds a third wildcard** `^doc-requirements-drift-uplift-` to the gate so its own PR can pass). The automation is now self-modifying the governance control that exists to constrain it. **Occurrence update (verified 2026-07-16):** PR #291 was closed unmerged on 2026-07-14 and PR #294 (same Jules task family, direct-to-main) was closed unmerged on 2026-07-15 — but the task itself has not been reconfigured: **PR #295** (`doc-requirements-drift-uplift-2026-07-13-*` → `main`, opened 2026-07-16) is the **fourth consecutive direct-to-main run**, again based on stale `main` context (e.g., it re-counts the Phase 0 kit against `main`'s file list and re-raises questions already consolidated on `develop`). Humans are closing each PR by hand while the generator keeps producing them. Remaining sub-tasks: **(i)** author the `develop → main` release PR (carries the stripped gate to `main`; later timeline from `develop` wins on governance docs); **(ii — urgent, still open)** reconfigure or disable the external Jules doc-uplift task (runs as user WSwarm) so future runs base off and target `develop` — closing individual PRs (#291, #294, and pending #295) has not stopped the pattern; **(iii)** enable the weekly scheduled `develop → main` release routine; **(iv)** consider an audit guard and CODEOWNERS protection on the gate file (see Clarifications [2026-07-14]).

### 2. Structural & Architectural Drift
- **Audit Script Coverage Blind Spot**: `scripts/audit-repo.js` entirely skips the `mcp-protocols/`, `value-lenses/`, and `operating-profiles/` directories, leaving critical framework assets ungoverned.
- **Agent Index Descriptive Truncation (Sentence Regex Failure)**: `scripts/context_helpers.js` extracts only the first sentence of the `Role` section (`role.split('\n')[0]` followed by sentence regex), violating the "paragraph extraction" mandate in `AGENTS.md`. The regex `/^[^.!?]+[.!?]/` fails to capture full technology names containing dots (e.g., "Next.js" is truncated to "Next."), leading to inaccurate role summaries in the Agent Index.
- **Generator "Silent Success" on Missing Framework Assets**: `scripts/generate_all.js` returns HTML comments (e.g., `<!-- Framework directory not found... -->`) when `value-lenses/` or `operating-profiles/` are missing or empty, rather than failing the build. This violates the "Fail Fast" mandate for generator drift (Requirement 3). Decision [2026-07-05-0009] approved fail-fast for both missing framework assets and missing active skills/MCPs; implementation pending.
- **Sovereign JSON Asset Layer Governance** (Answered 2026-07-13-0005; implementation pending): The four sovereign JSON assets from commit `64f5a09` — `agents/guardian/jailbreak-monitor-agent.json`, `skills/model-fusion-consensus/definition.json`, `mcp-protocols/local-inference-mcp.json`, and `operating-profiles/local-sovereign-profile.json` — SHALL be promoted to canonical Markdown contracts with the existing JSON retained as machine-readable companions, following the dual-format precedent established by `value-lenses/compassion-lens.md` + `.json` (Decision [2026-07-10-0003]). `docs/SOVEREIGN_LLM_GUIDELINES.md` MUST be referenced from Requirement §7 (Governance and Trust Controls) once the Markdown personas/skills/protocol/profile ship. Substantive authoring (Role, Capabilities, Rules & Constraints w/ Refusal Criteria, Data Inventory, Boundaries, Workflow, External Tooling Dependencies, Audit Log for the agent; equivalent contract for the skill, MCP protocol, and operating profile) is a domain-review task tracked here — the JSON `system_prompt`, `mcp_subscriptions`, `steps`, `capabilities`, and `governance_override` fields supply the substantive stance so authoring is derived, not invented.
- **Undocumented Top-Level Asset Directories**: `infrastructure/secret-ops/` (the LEGACY-labeled Python Phase 0 Fetch-on-Demand execution boilerplate `agent_logic.py`, added in commit `d88469d`) and `n8n-templates/layer-b-labs/` (the `customer-inquiry-router.json` n8n workflow template, added in commit `175e266`) are referenced by zero files outside themselves — not by `README.md`, `REQUIREMENTS.md`, `CONTRIBUTING.md`, or anything under `docs/` (verified 2026-07-15). Both directories carry substantive, standards-compliant content (correct LEGACY labeling; slug-based naming; the n8n template is pinned to the canonical `models/gemini-2.5-flash`), but they are invisible to the documented builder path, the repository-layout documentation, and `scripts/audit-repo.js` coverage (see Clarification [2026-07-15] Undocumented Top-Level Asset Directories).
- **Undocumented "Learning Agent" Pattern**: `tools/executive-assistant/server.js` implements a `/api/resolution` feedback loop and "Learning Agent" logic (`event: 'LEARNING_AGENT_UPDATE'`) that maps human feedback back into the system's execution logs. This pattern lacks a persona specification and governance requirements in `REQUIREMENTS.md`. It utilizes a mock `firestoreThreadDocs` for context grouping.
- **Undocumented Admin Control Surface**: `tools/executive-assistant/server.js` implements several admin-facing API endpoints (`/api/queue`, `/api/stats`, `/api/logs`, `/api/rules`) that provide unauthenticated access to internal agent state, queued tasks, and rule configurations, creating a governance drift from the security baseline. The `/admin` path serves a Vite-based UI from `ui/dist`.
- **Executive Assistant Container Build Is Broken** (verified 2026-07-16): the `tools/executive-assistant/Dockerfile` final stage runs `COPY --from=builder /usr/src/app/index.js ./`, but no `index.js` exists in the tool — `docker build` fails at that layer, so the published reference image cannot be built at all. Additionally, `server.js` serves `/admin` from `ui/dist`, but the Vite UI is never built: no Dockerfile stage runs the `ui/` build, and `ui/dist` is (correctly) not committed — so even with the COPY fixed, the admin UI would 404 in the container. This violates Requirement §8 ("Reference Examples Must Tell the Truth"). See Clarification [2026-07-16].
- **Committed Test-Coverage Artifacts** (verified 2026-07-16): `tools/executive-assistant/coverage/` checks 21 generated Istanbul coverage files (HTML reports, `clover.xml`, `coverage-final.json`) into git. Generated artifacts in version control go stale against the source they describe, bloat diffs, and drift from the repository's convention that generated outputs are either reproducible on demand or golden-fixture-managed. See Clarification [2026-07-16].
- **FSL Conversion Clock Has No Tagged Release Anchor**: Decision [2026-07-05-0004] makes tagged GitHub releases the canonical published versions so each version's two-year FSL-to-Apache-2.0 conversion date is legally unambiguous, and prescribes cutting a tagged release at the relicense merge commit. The repository's only tag, `v0.1.0` (2026-05-25), predates the relicense commit `c3c0e82` (2026-07-05), so no published version currently carries an FSL conversion start date (see Clarification [2026-07-13] FSL Conversion Clock Has No Tagged Release Anchor).

### 3. Substantive & Safety Drift
- **Substantive Content Baseline (The "TBD" Problem)**: 100% of reusable skills (e.g., `skills/reporting/alert-notify.md`) and most agent personas use "TBD" placeholders or boilerplate for `Data Inventory` and `Refusal Criteria`, bypassing the D2 (Description) and Refusal Principle mandates.
- **Audit Script Substantive Blindness**: `scripts/audit-repo.js` verifies the presence of headings but fails to detect "TBD" placeholders or validate the content of `Refusal Criteria` subsections.

### 4. Referential & Link Integrity Drift
- **Internal Referential Integrity Gap**: The repository lacks automated verification for internal markdown links and `**Skill:**` path references within agent workflows.
- **Audit Script File Verification Gap**: `scripts/audit-repo.js` does not verify that skills or MCPs referenced in `mcp.config.json` exist as physical files.

### 5. Remediated Limitations (Archive)
- **CI/CD "False Green" Risk in E2E** (Remediated: 2026-07-16, Decision [2026-07-05-0006]): `tests/e2e/docker-smoke.test.js` now supports the opt-in `FORCE_DOCKER_SMOKE=true` flag that promotes a missing Docker binary from "skip" to "fail" while preserving the clean-skip default for local development, and the CI `docker-smoke` job in `.github/workflows/validate.yml` sets the flag so a runner misconfigured to lack Docker fails loudly. Verified: forced mode fails on a Docker-less host; default mode still skips 3/3 cleanly.
- **Phase 0 Audit Gap** (Remediated: 2026-07-16, Decision [2026-07-05-0011]): `scripts/audit-repo.js` now runs `checkPhaseZeroKit()`, a fatal file-presence check for the eight kit files mandated by Requirement §1 in `docs/phase-zero-assessment/` (`security-assessment.md`, `ai-readiness-assessment.md`, `network-security-assessment.md`, `PRACTITIONER_NOTES.md`, `consent-template.md`, `report-template.md`, `roadmap-template.md`, `readiness-rubric.md`). Verified: removing a kit file fails the audit with exit 1.
- **Audit Log Schema Validation Gap** (Remediated: 2026-07-16, per Requirement §3 / Decision [2026-05-20]): `scripts/audit-repo.js` now validates that every persona and skill Audit Log JSON carries the five mandatory keys (`task`, `inputs`, `actions`, `risks`, `result`) in addition to the existing valid-JSON check. All 26 personas and 8 skills pass; a missing key fails the audit with exit 1.
- **ROI Auditor Baseline Snapshot Missing** (Remediated: 2026-07-16, Decision [2026-07-07-0004] / [2026-06-19-0015]): `tools/roi/baseline-config.json` now exists as the committed machine-readable snapshot of the baseline-time and labor-rate dictionaries, derived from the illustrative data in `tools/roi/generate_roi_template.py` (the public Sheets template remains the human-editable source). The `ROI Auditor` persona's Workflow, Capabilities, and External Tooling Dependencies now reference the local snapshot for baseline reads, keeping Google Sheets access append-only.
- **Licensing Posture Not Codified** (Remediated: 2026-07-13, Decision [2026-07-13-0002]): Requirement §11 now codifies the FSL-1.1-Apache-2.0 posture and the Transparent Source Guarantee, and `scripts/audit-repo.js` verifies that `LICENSE` carries the canonical FSL header/SPDX identifier, that `package.json` declares `"license": "FSL-1.1-Apache-2.0"`, and that `docs/TRANSPARENT_SOURCE.md` is present. Any drift is now a fatal audit failure. A future contributor cannot silently change the license posture without tripping the governance gate.
- **Sync-Upstream Regression Harness Outside the Validation Gate** (Remediated: 2026-07-13, Decision [2026-07-13-0003]): `package.json` now exposes `npm run test:sync` (invoking `scripts/test-sync-upstream.sh`), included in `validate:full`; `.github/workflows/validate.yml` runs it as the `sync-upstream-regression` job on every push and PR targeting `develop` and `main`. Requirement §9 lists sync-script regression coverage as part of the canonical validation contract.
- **Red Team Vector JSON Companion Divergence** (Remediated: 2026-07-13, Decision [2026-07-13-0006]): `examples/red-team-gauntlet/test-vectors.json` regenerated as a lockstep companion of the canonical `test-vectors.yaml` (Decision [2026-07-07-0003]) — same vector IDs (`pi-*`, `pii-*`), same field shape, same content. `examples/red-team-gauntlet/test-vectors.schema.json` shipped so the JSON's `$schema` reference resolves. The JSON now self-identifies as the companion (`"canonical": "yaml"`, `"source": "examples/red-team-gauntlet/test-vectors.yaml"`) so downstream tooling cannot mistake it for the source of truth.
- **Ungoverned Value-Lens JSON (compassion-lens)** (Remediated: 2026-07-10): `value-lenses/compassion-lens.md` now exists as the canonical Markdown lens, with `compassion-lens.json` retained as its machine-readable companion — the same dual-format pattern established by `american-dream`. The Project NoéMI Anti-Replacement rule is defined in `value-lenses/README.md` with five operational clauses (Human-Review Gate on Terminal Actions, Workforce Uplift Audit, Contextual Forgiveness, Precarity Consciousness, Anti-Dehumanizing Language) each traced to the persona clauses that already materialize it (`roi-auditor.md` Workforce Uplift Constraint, `student-success-coach.md` Precarity Consciousness, `qa-risk-manager.md` Contextual Forgiveness Rule). `GEMINI.md`, `CLAUDE.md`, and the value-lenses golden fixture were regenerated; full test suite passes 44/44 (Decision [2026-07-10-0003]). An optional follow-up remains open under the "Audit Script Coverage Blind Spot" limitation: extend `scripts/audit-repo.js` to enforce a small JSON schema on lens companion files so no future JSON-only lens can re-introduce this drift.
- **Infrastructure Asset Implementation Gap** (Remediated: 2026-07-05, verified 2026-07-10): `templates/tiers/` now ships substantive `basic.md`, `standard.md`, and `premium.md` tier templates, and `operating-profiles/standard-operating-profile.md` provides the first Markdown profile, which the generator injects into `GEMINI.md`/`CLAUDE.md` (the operating-profiles golden fixture was regenerated accordingly). The assets were salvaged from stale PR #254 in commit `9c19548`. This satisfies the bounded implementation approved by Decision [2026-06-19-0011] and overtakes the tier-template PO-deferral in Decision [2026-06-19-0009]; Clarifications [2026-06-10] and [2026-06-15] were closed as overtaken by events (Decision [2026-07-10-0001]).
- **Automation Branch Flow Documentation Gap** (Remediated: 2026-07-07): Requirement §7 now codifies the develop-only merge invariant established by Decision [2026-07-03-0001] and the automation-branch documentation follow-through from Decision [2026-07-07-0002]. `docs/DEV_AGENT_PROMPT.md` and `docs/SYNC_AGENT_PROMPT.md` state the invariant explicitly. All governed automation (`claude/*`, `sync/upstream-*`, `doc/*`) targets `develop`; `main` is reached only via a periodic release PR.
- **Red Team Vector Format Ambiguity** (Resolved: 2026-07-07): the shipped `examples/red-team-gauntlet/test-vectors.yaml` is canonical per Decision [2026-07-07-0003]; Decision [2026-06-19-0008] (which prescribed a JSON alternative) is annotated as superseded. No file rewrite is required.
- **ROI Auditor Baseline Access Ambiguity** (Resolved: 2026-07-07; implemented 2026-07-16): the committed `tools/roi/baseline-config.json` snapshot path from Decision [2026-06-19-0015] is canonical per Decision [2026-07-07-0004]; the live-Sheets alternative in Decision [2026-06-12-0001] is annotated as superseded. The snapshot file now exists (see the ROI Auditor Baseline Snapshot Missing entry above).
- **SecretOps Provider Bias** (Remediated: 2026-07-05): `tests/examples-smoke.test.js` now accepts either `op://` or `infisical://` vault-reference patterns and either `op run` or `infisical run` Compose wrappers, satisfying the multi-provider mandate in Requirement §5 (Decision [2026-07-05-0007]).
- **Heading Inconsistency** (Resolved by design: 2026-07-05): the dual naming — `Rules & Constraints` for personas, `Rules & Constraints (4D Diligence)` for skills — is retained; `scripts/audit-repo.js` performs case-insensitive comparison and tolerates the suffix per Decision [2026-05-28-0004], so no rename is needed (Decision [2026-07-05-0010]).
- **Sync Script Identity Drift** (Remediated: 2026-06-19, verified 2026-07-05): `scripts/sync-upstream.sh` now reads `NOEMI_UPSTREAM_REMOTE`, `NOEMI_UPSTREAM_URL`, and related values from the environment with upstream-preserving defaults; the hardcoded `MY_ORGANIZATION` placeholder is gone (Decision [2026-06-19-0002]).
- **Red Team Gauntlet Serialization Gap** (Remediated, verified 2026-07-05): machine-readable starter vectors now ship as `examples/red-team-gauntlet/test-vectors.yaml` (five vectors: three prompt-injection, two PII), consumable by the `Client Onboarding` validation workflow (Decision [2026-06-19-0008]; shipped as YAML rather than the JSON named in the decision). A JSON companion `test-vectors.json` was additionally salvaged from PR #254 in commit `9c19548` (2026-07-05); YAML remains the canonical format per Decision [2026-07-07-0003], and the companion has since been found divergent from it (see the Red Team Vector JSON Companion Divergence entry under Referential & Link Integrity Drift).
- **Smoke Test Variable Validation Gap** (Remediated: 2026-06-19, verified 2026-07-05): `tests/examples-smoke.test.js` now bidirectionally validates every `NOEMI_DOCKER_SMOKE_*` variable referenced by the e2e suite against `.env.template` (Decision [2026-06-19-0003]).
- **Missing shared `audit_logger.js`** (Remediated: 2026-06-19): The shared utility for structured JSON Audit Log emission is now available in the `scripts/` directory.
- **Missing Onboarding and Configuration Directories** (Remediated: 2026-05-28): `clients/`, `.gatekeeper/`, and `templates/tiers/` directories now exist with `.gitignore` placeholders.
- **Framework Injection Gap** (Remediated: 2026-05-28): `Value Lenses` and `Operating Profiles` are now injected by `scripts/generate_all.js`.
- **Artifact Naming Convention Alignment** (Remediated: 2026-05-10): `docs/n8n workflows/` renamed to `docs/n8n-workflows/`.
- **Node.js 24 Baseline Alignment** (Remediated: 2026-05-10): `executive-assistant` and `gatekeeper-deployment` updated to Node 24 images.
