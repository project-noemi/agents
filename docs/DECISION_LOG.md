# Decision Log

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
