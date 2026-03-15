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

### ❓ Question [2026-03-08] - JSON Schema for Mandatory "Audit Log"
**Context:** `docs/frameworks/gartner-trism.md` suggests an "Audit Log" requirement for all agent personas, instructing them to output a brief JSON summary of their reasoning alongside their final payload.
**Ambiguity / Drift:** This requirement is not currently implemented in any of the agent persona files in `agents/`. To ensure consistency, a standardized JSON schema is needed.
**Question for Product Owner:** Is there a preferred JSON schema for the "Audit Log" output? For example, should it include fields like `reasoning`, `mcp_tools_used`, and `confidence_score`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a standard JSON schema for the "Audit Log" requirement and update all agent persona files in `agents/` to include this mandatory directive.*

### ❓ Question [2026-03-08] - Priority for Python-to-Node Migration in Examples
**Context:** `REQUIREMENTS.md` and `AGENTS.md` state that Python runtime support is deprecated, yet several examples (e.g., `examples/docker/agent.py`, `examples/video-automation-pod/seo_agent.py`) still utilize Python.
**Ambiguity / Drift:** There is a discrepancy between the project's official stance on Python deprecation and the live example code.
**Question for Product Owner:** What is the priority for migrating the remaining Python examples to Node.js? Should this be handled as a bulk migration or incrementally as these examples are updated?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Identify all remaining `.py` files in the repository and create a prioritized migration roadmap to convert them into Node.js equivalents.*

### ❓ Question [2026-03-09] - Enforcement of Persona Documentation Mirroring
**Context:** `REQUIREMENTS.md` (Core Objectives, Item 2) states that "Documentation strictly mirrors these directories in `docs/agents/`." and `DECISION_LOG.md` (2026-03-03) mentions "Mandated that `docs/agents/` must strictly mirror the `agents/` hierarchy."
**Ambiguity / Drift:** While the directory structure is mirrored, individual persona Markdown files (e.g., `agents/coding/bolt/core.md`) are missing their counterparts in `docs/agents/`. Only READMEs and a few select guides exist.
**Question for Product Owner:** Should every individual persona file in `agents/` be mirrored as a documentation file in `docs/agents/`, or is mirroring only required at the directory/README level?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Identify all missing persona documentation files in `docs/agents/` and create mirror Markdown files that provide a technical overview and usage guide for each corresponding persona in `agents/`.*

### ❓ Question [2026-03-09] - Persona Template Standardization (Core Mandates vs Rules & Constraints)
**Context:** `REQUIREMENTS.md` (Functional Requirements, Item 1) specifies the standard format as "Role, Mission, Core Mandates, Workflow, Boundaries."
**Ambiguity / Drift:** A majority of personas in the `agents/` directory (e.g., `ai-architect.md`, `brand-strategist.md`, `pii-guard.md`) utilize a "Rules & Constraints" header instead of "Core Mandates."
**Question for Product Owner:** Should all existing personas be updated to strictly use the "Core Mandates" header to align with the latest standard, or is "Rules & Constraints" considered an acceptable alias?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk update of all persona files in `agents/` to rename the "Rules & Constraints" section to "Core Mandates" for strict adherence to the standardized template.*

### ❓ Question [2026-03-09] - Missing "External Tooling Dependencies" in Personas
**Context:** `REQUIREMENTS.md` (Functional Requirements, Item 1) states that "Agents must also document any expected external tooling dependencies (e.g., pnpm, docker) in their persona files."
**Ambiguity / Drift:** None of the current persona files in the `agents/` directory contain an explicit "External Tooling Dependencies" section, which may lead to environment setup failures during orchestrator preparation.
**Question for Product Owner:** Should a new mandatory section "External Tooling Dependencies" be added to the persona template, and should existing personas be audited to populate it?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Audit all persona files in `agents/` and add a mandatory "External Tooling Dependencies" section, documenting required tools like `npm`, `docker`, or specific MCP servers for each.*
### ❓ Question [2026-03-09] - Header Discrepancy in Persona Template
**Context:** `REQUIREMENTS.md` (Functional Requirements, Item 1) specifies the persona format as "Role, Mission, Core Mandates, Workflow, Boundaries". However, `docs/AGENT_TEMPLATE.md` and the majority of agent files in `agents/` use the header "Rules & Constraints" instead of "Core Mandates".
**Ambiguity / Drift:** This inconsistency between the core requirements and the implementation template creates confusion for developers and complicates automated persona validation.
**Question for Product Owner:** Should `REQUIREMENTS.md` be updated to use "Rules & Constraints" to align with the template and current agents, or should the template and agents be updated to use "Core Mandates"?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a global search-and-replace across all `.md` files in `agents/` and the `docs/AGENT_TEMPLATE.md` to standardize the header as either "Core Mandates" or "Rules & Constraints" based on the PO's decision.*

### ❓ Question [2026-03-09] - Enforcement of Documentation Mirroring
**Context:** `DECISION_LOG.md` (Decision dated 2026-03-03) mandates that `docs/agents/` must "strictly mirror" the `agents/` hierarchy.
**Ambiguity / Drift:** Currently, `docs/agents/` only contains category `README.md` files, while the individual agent personas (e.g., `agents/coding/bolt/core.md`) are missing from the `docs/` tree.
**Question for Product Owner:** Is the requirement for "strict mirroring" intended to include a 1:1 copy of every persona file into `docs/agents/`, or should `docs/agents/` only house high-level category overviews and guides?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a script to automatically sync and mirror all persona `.md` files from the `agents/` directory into their corresponding locations in `docs/agents/` to ensure documentation parity.*

### ❓ Question [2026-03-10] - SecretOps CLI Verification in Pre-Flight
**Context:** `AGENTS.md` mandates the use of `infisical run` or `op run` for "Fetch-on-Demand" security. However, `scripts/verify-env.sh` and `verify-env.ps1` do not check if these CLIs are installed.
**Ambiguity / Drift:** The core security policy is not enforced or verified by the project's own environment validation tools.
**Question for Product Owner:** Should the pre-flight scripts be updated to mandate the presence of either `infisical` or `op` CLIs, or should these be treated as optional dependencies?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` and `scripts/verify-env.ps1` to include a check for SecretOps CLIs, ensuring at least one of the mandated tools (`infisical` or `op`) is available in the environment.*

### ❓ Question [2026-03-10] - Documentation for Gemini CLI Dependency
**Context:** `REQUIREMENTS.md` and `scripts/verify-env.sh` list the `gemini` CLI as a mandatory dependency for the project.
**Ambiguity / Drift:** There is no documentation within the repository explaining where to obtain this CLI, how to install it, or which version is required.
**Question for Product Owner:** Where is the official source for the `gemini` CLI, and can a "Dependencies" or "Getting Started" guide be added to `docs/` to provide installation instructions?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create `docs/DEPENDENCIES.md` to document all external toolchain requirements, specifically providing installation sources and versioning for the `gemini` CLI.*

### ❓ Question [2026-03-10] - Standardized Output for Mandatory "Audit Log"
**Context:** `docs/frameworks/gartner-trism.md` and `REQUIREMENTS.md` mandate a JSON "Audit Log" for agent reasoning.
**Ambiguity / Drift:** It is unclear if this JSON payload should be emitted to `stdout`, a dedicated `.log` file, or as a specific field in the agent's final API/Markdown response.
**Question for Product Owner:** What is the standardized destination for the JSON Audit Log? Should it be printed to `stdout` following the primary output, or integrated into the final Markdown response within a `<details>` block?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a technical specification for Audit Log delivery and update the `docs/AGENT_TEMPLATE.md` to include a standardized "Audit Log" section that adheres to this protocol.*

### ❓ Question [2026-03-15] - Drift in MCP Configuration for ROI Auditor
**Context:** The `agents/guardian/roi-auditor.md` persona specifies a dependency on a `Logging MCP (or Webhook)` to retrieve execution records. However, this MCP is not listed in the `active_mcps` array in `mcp.config.json`.
**Ambiguity / Drift:** The `roi-auditor` cannot function in the current "out-of-the-box" configuration because its primary data source is not enabled in the central MCP manifest.
**Question for Product Owner:** Should a standard `logging-mcp` be added to `mcp.config.json`, or is the `roi-auditor` intended to rely exclusively on custom webhooks provided by the orchestrator?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `mcp.config.json` to include the `logging-mcp` and ensure it is properly configured to interface with the `roi-auditor.md` persona.*

### ❓ Question [2026-03-15] - Standardized Library for Exponential Backoff
**Context:** `AGENTS.md` mandates that "agents and toolkit components must implement robust error handling patterns," including "Exponential Backoff."
**Ambiguity / Drift:** While the policy is clear, there is no standardized Node.js library or implementation pattern specified in the documentation or found in the `scripts/` directory.
**Question for Product Owner:** Is there a preferred Node.js library (e.g., `p-retry`, `axios-retry`, or a native implementation) that should be standardized across the toolkit for exponential backoff?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/METHODOLOGY.md` to specify the mandatory Node.js library for exponential backoff and provide a reference implementation in `scripts/utils/retry-helper.js`.*
