# Pending Clarifications

<!-- Add new questions below this line using the required format -->

### ❓ Question [2026-03-08] - Missing Kubernetes Manifests for Fleet Deployment
**Context:** The `REQUIREMENTS.md` (Strategic Alignment, Item 4) specifies that for parallel "Fleet" deployments, the repository's examples must be expanded to include "automated provisioning templates (e.g., docker-compose or Kubernetes manifests)". Currently, only a Docker Compose example is provided.
**Ambiguity / Drift:** The Kubernetes requirement is documented but no manifests exist in the repository, making it difficult for users to deploy to Kubernetes-based clusters.
**Question for Product Owner:** Should Kubernetes manifests be created to complement the Docker Compose example, or is Docker Compose currently the primary target for fleet deployments?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a `examples/fleet-deployment/k8s/` directory and implement basic Kubernetes manifests (Deployments, Services, and Ingress) mirroring the multi-tenant architecture found in the Docker Compose example.*

### ❓ Question [2026-03-08] - Status of Verification Bots for ROI
**Context:** `REQUIREMENTS.md` (Strategic Alignment, Item 5) states that the toolkit must include "Verification Bots" to audit agent logs for academic credentialing and ROI validation.
**Ambiguity / Drift:** While the ROI methodology is now documented in `tools/roi/README.md`, the actual "Verification Bots" (automated agents or scripts that perform the auditing) are not yet present.
**Question for Product Owner:** Are the "Verification Bots" intended to be implemented as a new agent persona (e.g., a `guardian/roi-auditor.md`), or should they be implemented as a specialized script in the `tools/` directory?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a new agent persona `agents/guardian/roi-auditor.md` specifically tasked with auditing logs for ROI validation, and provide an accompanying Node.js script in `tools/roi/audit-logs.js` to automate the verification.*

### ❓ Question [2026-03-08] - Comprehensive Specification for Mandatory "Audit Log"
**Context:** `REQUIREMENTS.md` and `docs/frameworks/gartner-trism.md` mandate a JSON "Audit Log" for agent reasoning, which is currently missing from all 18 personas. Previous queries ([2026-03-08], [2026-03-10], [2026-03-17], [2026-03-22]) addressed schema, destination, and delivery.
**Ambiguity / Drift:** Without a standardized schema (e.g., `reasoning`, `tools_used`, `duration_ms`) and delivery protocol (e.g., `stderr` for Loki/Grafana ingestion or integrated into Markdown), the `roi-auditor` and observability stack cannot function consistently.
**Question for Product Owner:** What is the finalized JSON schema and standardized delivery method (stderr vs. Markdown block) for the Audit Log to ensure it is correctly captured by the centralized observability stack?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a standard JSON schema and delivery specification for the "Audit Log" requirement, and perform a bulk update to all 18 agent persona files in `agents/` to include this mandatory directive.*

### ❓ Question [2026-03-08] - Priority for Python-to-Node Migration in Examples
**Context:** `REQUIREMENTS.md` and `AGENTS.md` state that Python runtime support is deprecated, yet several examples (e.g., `examples/docker/agent.py`, `examples/video-automation-pod/seo_agent.py`) still utilize Python.
**Ambiguity / Drift:** There is a discrepancy between the project's official stance on Python deprecation and the live example code.
**Question for Product Owner:** What is the priority for migrating the remaining Python examples to Node.js? Should this be handled as a bulk migration or incrementally as these examples are updated?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Identify all remaining `.py` files in the repository and create a prioritized migration roadmap to convert them into Node.js equivalents.*

### ❓ Question [2026-03-10] - SecretOps CLI Verification and Parity in Pre-Flight
**Context:** `AGENTS.md` mandates "Fetch-on-Demand" security via `infisical` or `op`. Current `verify-env.sh` and `verify-env.ps1` scripts lack checks for these CLIs and required fleet environment variables.
**Ambiguity / Drift:** The core security policy is not enforced or verified by the project's own validation tools.
**Question for Product Owner:** Should the pre-flight scripts be updated to mandate the presence of `infisical` or `op` CLIs and verify mandatory fleet configuration keys (e.g., `CASDOOR_DB_PASSWORD`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to include checks for SecretOps CLIs and verify the presence of mandatory fleet configuration variables.*

### ❓ Question [2026-03-10] - Documentation for Gemini CLI Dependency
**Context:** `REQUIREMENTS.md` and `scripts/verify-env.sh` list the `gemini` CLI as a mandatory dependency for the project.
**Ambiguity / Drift:** There is no documentation within the repository explaining where to obtain this CLI, how to install it, or which version is required.
**Question for Product Owner:** Where is the official source for the `gemini` CLI, and can a "Dependencies" or "Getting Started" guide be added to `docs/` to provide installation instructions?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create `docs/DEPENDENCIES.md` to document all external toolchain requirements, specifically providing installation sources and versioning for the `gemini` CLI.*

### ❓ Question [2026-03-14] - Finalization of ROI Template Link
**Context:** `tools/roi/README.md` and `REQUIREMENTS.md` mention a standardized Google Sheets ROI calculator.
**Ambiguity / Drift:** The link in `tools/roi/README.md` is still a placeholder (`[Link Placeholder for ROI Calculator Template]`), preventing users from actually using the methodology.
**Question for Product Owner:** Is the official Google Sheets template ready for public link inclusion, or should we point to a staging version in the interim?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tools/roi/README.md` with the live URL for the ROI Calculator Template once provided by the Product Owner.*

### ❓ Question [2026-03-12] - Bulk Update for Mandatory "External Tooling Dependencies"
**Context:** `REQUIREMENTS.md` mandates documenting external tool dependencies in persona files, but `docs/AGENT_TEMPLATE.md` labels it "Optional" (causing a 0/18 implementation rate).
**Ambiguity / Drift:** Without this metadata, orchestrators cannot reliably provision the required environment for the agent.
**Question for Product Owner:** Should `docs/AGENT_TEMPLATE.md` be updated to "Required" and Jules proceed with a bulk update to all 18 persona files, populating them with verified dependencies where possible?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `docs/AGENT_TEMPLATE.md` to mark "External Tooling Dependencies" as required and perform a bulk audit/update of all 18 personas in `agents/` to insert the missing section.*

### ❓ Question [2026-03-15] - Drift in MCP Configuration for ROI Auditor
**Context:** The `agents/guardian/roi-auditor.md` persona specifies a dependency on a `logging-mcp`, which is missing from `mcp.config.json` and the `mcp-protocols/` directory.
**Ambiguity / Drift:** The `roi-auditor` cannot function in the current "out-of-the-box" configuration because its primary data source is not enabled or defined.
**Question for Product Owner:** Should a standard `logging-mcp` protocol be created and added to `mcp.config.json`, or is the `roi-auditor` intended to rely on custom webhooks?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create the missing `mcp-protocols/logging-mcp.md` protocol definition and update `mcp.config.json` to include it in the `active_mcps` list.*

### ❓ Question [2026-03-15] - Standardized Library for Exponential Backoff
**Context:** `AGENTS.md` mandates "Exponential Backoff," but no standardized library or implementation pattern is specified or present in `scripts/`.
**Ambiguity / Drift:** Lack of a standard implementation leads to inconsistent resilience patterns across the toolkit.
**Question for Product Owner:** Is there a preferred Node.js library (e.g., `p-retry`, `axios-retry`) that should be standardized for exponential backoff across the toolkit?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` to specify the mandatory Node.js library for exponential backoff and provide a reference implementation in `scripts/utils/retry-helper.js`.*

### ❓ Question [2026-03-16] - Granular Injection and Parity for Context Generation
**Context:** `scripts/generate_gemini.js` ignores "Execution Patterns" and "Coding Standards" from `AGENTS.md` and lacks the "Agent Index" feature present in `scripts/generate_claude.js`.
**Ambiguity / Drift:** Gemini-based agents lack full policy awareness and library visibility compared to Claude-based counterparts.
**Question for Product Owner:** Should `scripts/generate_gemini.js` be updated to inject all sections of `AGENTS.md` and include the automated "Agent Index" discovery logic?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/generate_gemini.js` to inject the entirety of `AGENTS.md` and refactor it to include the 'Agent Index' discovery and injection logic from `scripts/generate_claude.js`.*

### ❓ Question [2026-03-16] - Structural Integration and Standardization of the 4D Framework
**Context:** `REQUIREMENTS.md` mandates the 4D Framework, but personas only mention "4D Diligence" in the header. Mapping inconsistencies exist between `docs/METHODOLOGY.md` and `docs/lifecycle/README.md`.
**Ambiguity / Drift:** Incomplete structural application of the 4D framework and contradictory documentation (e.g., D1-D4 mapping) leads to architectural confusion.
**Question for Product Owner:** Should we reorganize the persona structure in `docs/AGENT_TEMPLATE.md` to explicitly include all four dimensions, and what is the canonical sequence (D1-D4) for the framework?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Redesign `docs/AGENT_TEMPLATE.md` to incorporate all four 4D dimensions as first-class sections and standardize the 4D sequence across all lifecycle documentation.*

### ❓ Question [2026-03-17] - Structural Separation of Role-Based Toolkits
**Context:** `REQUIREMENTS.md` specifies a requirement to "Categorize templates for 'Practitioners' and 'Accelerators'". Currently, all personas are mixed within the `agents/` directory.
**Ambiguity / Drift:** Lack of structural separation makes it difficult for users to distinguish between engineering tools and governance/security tools.
**Question for Product Owner:** Should the `agents/` and `docs/agents/` directories be reorganized into `practitioner/` and `accelerator/` subfolders?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Propose a directory reorganization plan for `agents/` that separates personas into `practitioner/` and `accelerator/` categories and migrates existing files.*

### ❓ Question [2026-03-19] - Technical Contract for Casdoor Identity Integration
**Context:** `REQUIREMENTS.md` mandates Casdoor for fleet deployments, but there is no technical contract (e.g., `CASDOOR_TOKEN`) defined for agents to verify user identity.
**Ambiguity / Drift:** Agents cannot reliably enforce Role-Based Access Control (RBAC) without a defined identity propagation protocol.
**Question for Product Owner:** What is the standardized protocol for passing Casdoor identity tokens to agents (e.g., specific environment variable or header)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a technical specification for "Identity Propagation" within the fleet, defining how agents consume Casdoor-verified identities.*

### ❓ Question [2026-03-20] - Remediation of Security Policy Breach in Video Pod
**Context:** `AGENTS.md` mandates "Fetch-on-Demand" and forbids local `.env` parsing. However, `examples/video-automation-pod/dropbox_watcher.py` explicitly uses `load_dotenv()`.
**Ambiguity / Drift:** This is a direct violation of the project's mandatory security architecture.
**Question for Product Owner:** Should Jules proceed with refactoring the Video Pod example to remove `load_dotenv()` and mandate SecretOps CLI wrappers?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `examples/video-automation-pod/dropbox_watcher.py` to remove `load_dotenv()` and update its documentation to mandate SecretOps CLI wrappers.*

### ❓ Question [2026-03-21] - Standardized Templates for 4D Technical Gates
**Context:** `REQUIREMENTS.md` mandates "Acceptance Criteria" (Delegation) and "Data Inventory" (Description) gates, but no formal templates or schemas exist.
**Ambiguity / Drift:** Lack of structured formats prevents consistent performance of technical gating by Explorers and Practitioners.
**Question for Product Owner:** Should standardized Markdown templates be created for the "Acceptance Criteria" and "Data Inventory" gates?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create standardized templates for "Acceptance Criteria" and "Data Inventory" in `docs/lifecycle/templates/` and update the respective lifecycle docs to reference them.*

### ❓ Question [2026-03-21] - Project-Wide Environment Naming Standard
**Context:** `AGENTS.md` and various scripts reference `dev` as the default environment, but this hierarchy (dev, staging, prod) is not formally defined.
**Ambiguity / Drift:** Lack of formal standard could lead to confusion in multi-tenant fleet configurations.
**Question for Product Owner:** Should `dev` be formally documented as the mandatory default environment name for all local development and initial fleet provisioning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/METHODOLOGY.md` to formally define the standardized environment naming hierarchy (dev, staging, prod).*

### ❓ Question [2026-03-25] - Resolution of Omitted GitHub MCP Protocol
**Context:** `mcp-protocols/github.md` exists, but `github` is missing from the `active_mcps` list in `mcp.config.json`.
**Ambiguity / Drift:** It is unclear if the GitHub integration is intended to be disabled by default or if its omission was accidental.
**Question for Product Owner:** Should the `github` MCP be added to the default active list in `mcp.config.json`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `mcp.config.json` to include the `github` MCP in the `active_mcps` list and verify its injection into `GEMINI.md`.*

### ❓ Question [2026-03-26] - Absence of Root `src/` and `tests/` Directories
**Context:** Requirements and agent prompts reference `src/` and `tests/` directories, but they are physically absent from the repository root (logic is in `scripts/`, `skills/`, `tools/`).
**Ambiguity / Drift:** Discrepancy between documentation/prompts and physical structure leads to navigation and execution confusion.
**Question for Product Owner:** Should the repository be reorganized to include root-level `src/` and `tests/` folders, or is the current distributed structure the final architecture?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Propose a root-level directory reorganization plan that consolidates logic into `src/` and `tests/` folders while maintaining backward compatibility.*

### ❓ Question [2026-03-28] - Discrepancy in 4D Framework Structural Integration
**Context:** `REQUIREMENTS.md` and `AGENTS.md` mandate that personas must "structurally incorporate" the 4D framework dimensions, yet `docs/AGENT_TEMPLATE.md` and all 18 existing personas only feature "Rules & Constraints (4D Diligence)" without sections for Delegation, Description, or Discernment.
**Ambiguity / Drift:** The core architectural requirement for persona structure is not reflected in the templates or the persona library.
**Question for Product Owner:** Should `docs/AGENT_TEMPLATE.md` be updated to include dedicated H2 or H3 sections for all four 4D dimensions, and should the existing 18 personas be migrated to this new structural standard?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Redesign the persona Markdown structure in `docs/AGENT_TEMPLATE.md` to incorporate Delegation, Description, and Discernment as first-class sections and migrate the persona library to this standard.*

### ❓ Question [2026-03-28] - Omission of Technical Gates from Methodology Guidance
**Context:** `REQUIREMENTS.md` specifies technical gates for Acceptance Criteria (Delegation), Data Inventory (Description), and TRiSM Assessment (Discernment). These gates are not referenced in the persona-facing guidance in `GEMINI.template.md` or `AGENTS.md`.
**Ambiguity / Drift:** Agents are not aware of the mandatory technical gates they must pass through or facilitate during their lifecycle.
**Question for Product Owner:** Should the mandatory technical gates be explicitly documented in the "Dynamic Persona Protocol" in `GEMINI.template.md` to ensure agents prioritize these gates during execution?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update the Dynamic Persona Protocol in `GEMINI.template.md` to include mandatory verification steps for the 4D technical gates (Acceptance Criteria, Data Inventory, TRiSM Assessment).*
