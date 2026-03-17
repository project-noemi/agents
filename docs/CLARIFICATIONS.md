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

### ❓ Question [2026-03-14] - Enforcement of SecretOps CLI Verification
**Context:** `AGENTS.md` mandates a "Fetch-on-Demand" architecture using `infisical` or `op`. However, the pre-flight script `scripts/verify-env.sh` does not yet check for these tools.
**Ambiguity / Drift:** There is a gap between the mandatory security policy and the automated environment validation, which could lead to runtime failures for new developers.
**Question for Product Owner:** Should the `scripts/verify-env.sh` script be updated to fail if neither `infisical` nor `op` is found, or should it simply issue a warning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/verify-env.sh` to include a check for `infisical` and `op` CLIs, ensuring at least one is available to satisfy the Fetch-on-Demand requirement.*

### ❓ Question [2026-03-14] - Finalization of ROI Template Link
**Context:** `tools/roi/README.md` and `REQUIREMENTS.md` mention a standardized Google Sheets ROI calculator.
**Ambiguity / Drift:** The link in `tools/roi/README.md` is still a placeholder (`[Link Placeholder for ROI Calculator Template]`), preventing users from actually using the methodology.
**Question for Product Owner:** Is the official Google Sheets template ready for public link inclusion, or should we point to a staging version in the interim?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `tools/roi/README.md` with the live URL for the ROI Calculator Template once provided by the Product Owner.*

### ❓ Question [2026-03-12] - Missing "External Tooling Dependencies" Section
**Context:** `REQUIREMENTS.md` mandates that "Agents must also document any expected external tooling dependencies (e.g., pnpm, docker) in their persona files."
**Ambiguity / Drift:** A codebase audit revealed that none of the 18 existing agent personas in the `agents/` directory currently contain this section.
**Question for Product Owner:** Should Jules proceed with adding a placeholder `## External Tooling Dependencies` section to all personas, or should this be added only as each persona is updated with specific tool requirements?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Audit all 18 persona files in `agents/` and insert a mandatory `## External Tooling Dependencies` section with initial values based on their known capabilities (e.g., Docker for infrastructure agents).*

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

### ❓ Question [2026-03-16] - Incomplete Injection in `generate_gemini.js`
**Context:** `AGENTS.md` contains critical sections for "Execution Patterns" and "Coding Standards", but `scripts/generate_gemini.js` currently only parses and injects the "Secrets & Configuration" and "Error Handling" sections.
**Ambiguity / Drift:** Global mandates for environment injection and coding standards are not automatically included in the compiled `GEMINI.md` context, meaning agents may not be aware of these requirements during active sessions.
**Question for Product Owner:** Should `scripts/generate_gemini.js` be updated to inject the entirety of `AGENTS.md` into `GEMINI.md`, or are specific sections like "Execution Patterns" intended for human reference only?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `scripts/generate_gemini.js` to dynamically parse and inject all H1 sections from `AGENTS.md` into the `GEMINI.md` context to ensure full policy awareness.*

### ❓ Question [2026-03-16] - Mandatory vs. Optional External Tooling Dependencies
**Context:** `REQUIREMENTS.md` states that "Agents must also document any expected external tooling dependencies... in their persona files", yet `docs/AGENT_TEMPLATE.md` labels this section as "Optional".
**Ambiguity / Drift:** This inconsistency has resulted in 0 out of 18 agent personas implementing the section. Without this metadata, orchestrators cannot automatically provision the required tools (e.g., Docker, pnpm) for the agent.
**Question for Product Owner:** Should `docs/AGENT_TEMPLATE.md` be updated to mark the "External Tooling Dependencies" section as "Required", and should Jules proceed with a bulk update to add this section to all 18 persona files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `docs/AGENT_TEMPLATE.md` to mark "External Tooling Dependencies" as required and audit all files in `agents/` to insert the missing section with relevant initial values.*

### ❓ Question [2026-03-16] - Holistic Integration of the 4D Framework
**Context:** `REQUIREMENTS.md` mandates the adoption of the 4D Framework (Delegation, Description, Discernment, Diligence), but currently, persona files only explicitly reference "4D Diligence" within the "Rules & Constraints" header.
**Ambiguity / Drift:** The other dimensions of the framework (Delegation, Description, Discernment) are not structurally represented in the persona Markdown files, leading to an incomplete application of the mandatory methodology.
**Question for Product Owner:** Should the agent persona template be updated to include dedicated sections or specific guidance for all four dimensions (4D) of the framework, rather than just Diligence?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Revise `docs/AGENT_TEMPLATE.md` to provide structural placeholders for Delegation, Description, and Discernment, and update the `roi-auditor.md` persona as a reference implementation of the full 4D structure.*

### ❓ Question [2026-03-17] - Structural Separation of Role-Based Toolkits
**Context:** `REQUIREMENTS.md` specifies a requirement to "Categorize templates for 'Practitioners' and 'Accelerators'". Currently, all personas are mixed within the `agents/` directory without clear role-based distinction.
**Ambiguity / Drift:** The lack of structural separation makes it difficult for users to identify which tools are intended for "Vibe Coding" (Practitioners) vs "Governance/Security" (Accelerators).
**Question for Product Owner:** Should we reorganize the `agents/` and `docs/agents/` directories to include `practitioner/` and `accelerator/` subfolders, or should this categorization be handled via metadata/tags within the Markdown files?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Propose a new directory structure for `agents/` that separates personas into `practitioner/` and `accelerator/` categories, and migrate existing files to their respective roles.*

### ❓ Question [2026-03-17] - Audit Log Delivery Protocol
**Context:** `AGENTS.md` and `REQUIREMENTS.md` mandate a JSON "Audit Log" for reasoning.
**Ambiguity / Drift:** It is unclear if this JSON should be appended to the agent's primary Markdown response (e.g., in a hidden block), emitted to `stderr`, or handled as a separate API payload.
**Question for Product Owner:** What is the preferred technical delivery method for the JSON Audit Log to ensure it is captured by the centralized observability stack (Grafana/Loki)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a technical specification for Audit Log delivery (e.g., standardizing on `stderr` or a specific Markdown block) and update the `roi-auditor.md` persona as the first implementation.*

### ❓ Question [2026-03-17] - Mandatory "External Tooling Dependencies" in Template
**Context:** `REQUIREMENTS.md` mandates documenting external tool dependencies in persona files, but `docs/AGENT_TEMPLATE.md` still marks this section as "Optional".
**Ambiguity / Drift:** This documentation inconsistency is preventing the automated provisioning of required environments (e.g., ensuring `docker` is available for `linux.md`).
**Question for Product Owner:** Can we formally update the `docs/AGENT_TEMPLATE.md` to mark "External Tooling Dependencies" as "Required" and proceed with a bulk update to all 18 personas?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `docs/AGENT_TEMPLATE.md` to make "External Tooling Dependencies" a required H2 section and audit the persona library to insert relevant tool requirements.*
