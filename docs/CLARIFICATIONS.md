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
**Context:** `docs/frameworks/gartner-trism.md` suggests an "Audit Log" requirement for all agent personas. A Phase 2 audit on 2026-03-20 confirmed this is missing from all 18 personas.
**Ambiguity / Drift:** This requirement is not currently implemented. To ensure consistency, a standardized JSON schema and delivery protocol (e.g., stderr for Loki/Grafana ingestion) are needed.
**Question for Product Owner:** Is there a preferred JSON schema (e.g., `reasoning`, `tools_used`, `duration_ms`) and delivery method for the "Audit Log" output?
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

### ❓ Question [2026-03-18] - Standardizing on "Rules & Constraints" vs "Core Mandates"
**Context:** The `DECISION_LOG.md` (2026-03-12) states that "Rules & Constraints" is the standardized header for persona files, yet `AGENTS.md` (Coding Standards section) still references the "Role, Mission, Core Mandates, Workflow, Boundaries" format.
**Ambiguity / Drift:** There is a discrepancy between the decision log and the active context rules in `AGENTS.md`, which could lead to inconsistent persona generation.
**Question for Product Owner:** Should `AGENTS.md` be updated to align with the `DECISION_LOG.md` by replacing "Core Mandates" with "Rules & Constraints" in its persona standards definition?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` to replace "Core Mandates" with "Rules & Constraints" in the Coding Standards section to ensure alignment with the latest project decisions.*

### ❓ Question [2026-03-18] - Granular Injection of AGENTS.md in Context Generation
**Context:** The `scripts/generate_gemini.js` script currently only injects two sections of `AGENTS.md` ("Secrets & Configuration" and "Error Handling"). It ignores "Execution Patterns" and "Coding Standards".
**Ambiguity / Drift:** Critical operational patterns and development standards are missing from the generated `GEMINI.md` context, limiting the agent's ability to adhere to project-wide mandates during active sessions.
**Question for Product Owner:** Should the generation script be updated to inject all top-level sections of `AGENTS.md` into `GEMINI.md`, or are some sections intentionally excluded for brevity?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Modify `scripts/generate_gemini.js` to dynamically parse and inject all H1 sections from `AGENTS.md` into the `GEMINI.md` file, ensuring all global mandates are present in the agent's runtime context.*

### ❓ Question [2026-03-18] - Implementation of the 4D Framework in Persona Structure
**Context:** `REQUIREMENTS.md` mandates the 4D Framework, but persona files currently only include a "Rules & Constraints (4D Diligence)" header.
**Ambiguity / Drift:** The structural representation of Delegation, Description, and Discernment is missing from the agent definitions, potentially leading to an incomplete application of the mandatory methodology.
**Question for Product Owner:** Should we update the `docs/AGENT_TEMPLATE.md` and all 18 existing personas to include dedicated sections or sub-headers for all four dimensions (4D) of the framework?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Revise the `docs/AGENT_TEMPLATE.md` to incorporate placeholders for Delegation, Description, and Discernment, and then update the 18 existing persona files in `agents/` to reflect this complete 4D structure.*

### ❓ Question [2026-03-19] - Automation for Agent Documentation Mirroring
**Context:** `REQUIREMENTS.md` mandates that `docs/agents/` must strictly mirror the `agents/` hierarchy. Currently, this is handled via manual symbolic links, but no automated script exists to maintain these as new personas are added.
**Ambiguity / Drift:** As the library grows, manual link maintenance is prone to error and "mirror drift."
**Question for Product Owner:** Should we implement an automated sync script (e.g., `scripts/sync-agent-docs.js`) to automatically create/update symbolic links in `docs/agents/` based on the content of `agents/`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a `scripts/sync-agent-docs.js` utility that scans the `agents/` directory and ensures the `docs/agents/` directory contains matching symbolic links for all persona files.*

### ❓ Question [2026-03-19] - Technical Contract for Casdoor Identity Integration
**Context:** `REQUIREMENTS.md` mandates Casdoor as the standardized identity provider for fleet deployments, but there is no technical "contract" or standardized environment variable pattern (e.g., `CASDOOR_TOKEN`) defined for agents to verify the requesting user's identity.
**Ambiguity / Drift:** Without a defined protocol, agents cannot reliably enforce Role-Based Access Control (RBAC) at the persona level.
**Question for Product Owner:** What is the standardized protocol for passing Casdoor identity tokens to agents? Should they expect a specific environment variable or a header provided by the orchestrator?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a technical specification for "Identity Propagation" within the fleet, defining the environment variables and protocols for agents to consume Casdoor-verified identities.*

### ❓ Question [2026-03-19] - Standardized Naming Convention for n8n Workflows
**Context:** The `docs/n8n workflows/` directory currently contains 6 JSON files with Hungarian names (e.g., `Bejövő levelek intelligens szűrése.json`), confirmed during the 2026-03-20 audit.
**Ambiguity / Drift:** The lack of a standardized, English-first naming convention for exported workflows makes the library difficult to maintain for international developers.
**Question for Product Owner:** Should we establish a mandatory English naming convention for all exported workflows (e.g., `ai-triage-inbound.json`) and migrate the existing files immediately?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Establish a "Workflow Naming Standard" in `docs/METHODOLOGY.md` and rename all files in `docs/n8n workflows/` to adhere to an English-first, slug-based format.*

### ❓ Question [2026-03-20] - Remediation of Security Policy Breach in Video Pod
**Context:** `AGENTS.md` (Secrets & Configuration) mandates a "Fetch-on-Demand" policy, stating: "NEVER create local `.env` parsing logic." However, `examples/video-automation-pod/dropbox_watcher.py` explicitly uses `load_dotenv()` and `python-dotenv`.
**Ambiguity / Drift:** This is a direct violation of the project's mandatory security architecture.
**Question for Product Owner:** Should Jules proceed with removing `load_dotenv()` from the Video Pod example and updating its documentation to reflect the mandatory use of `infisical run` or `op run`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Refactor `examples/video-automation-pod/dropbox_watcher.py` to remove `load_dotenv()` and update the accompanying `README.md` to mandate the use of SecretOps CLI wrappers for execution.*

### ❓ Question [2026-03-21] - Standardized Structural Placeholders for the 4D Framework
**Context:** A Phase 2 audit on 2026-03-21 verified that while "4D Diligence" is present in persona headers, the other three dimensions (Delegation, Description, Discernment) have no structural representation in any of the 18 persona files.
**Ambiguity / Drift:** The 4D framework is the mandatory development methodology, yet it is only partially represented in the active codebase. To ensure consistent application, a standardized way to integrate these dimensions is needed.
**Question for Product Owner:** Should we introduce standardized H3 headers (e.g., `### 4D Discernment`) within the "Rules & Constraints" section, or should these be distinct H2 sections to ensure visibility?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `docs/AGENT_TEMPLATE.md` to include standardized headers for all four dimensions of the 4D framework and perform a bulk update to all 18 personas in `agents/` to provide placeholders for these missing sections.*

### ❓ Question [2026-03-21] - Mandatory External Tooling Sections for Existing Personas
**Context:** `REQUIREMENTS.md` mandates that agents document their external tooling dependencies. The Phase 2 audit on 2026-03-21 confirmed this is missing from all personas, despite being a core functional requirement.
**Ambiguity / Drift:** Without this metadata, orchestrators cannot reliably provision the required environment for the agent.
**Question for Product Owner:** Should Jules proceed with a bulk update to all 18 persona files to add the `## External Tooling Dependencies` section, even if the specific tools for some personas are currently unknown (using 'None' as a default)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk audit and update of the `agents/` library to insert the `## External Tooling Dependencies` section into all 18 persona files, populating it with verified dependencies where possible.*

### ❓ Question [2026-03-21] - Standardized Template for "Data Inventory" (Description Gate)
**Context:** `REQUIREMENTS.md` (Core Objectives, Item 4) mandates a "Data Inventory (Description)" technical gate for all agents. However, `docs/lifecycle/DESCRIPTION.md` provides only high-level principles and no structured template or JSON schema for this inventory.
**Ambiguity / Drift:** Without a standardized format, Practitioners cannot consistently perform the required data classification (Public, Internal, Confidential) mandated in `docs/lifecycle/DELEGATION.md`.
**Question for Product Owner:** Should we provide a standardized Markdown template or a JSON schema for the "Data Inventory" gate to ensure consistency across all agent builds?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a standardized Markdown template for the "4D Data Inventory" and add it to `docs/lifecycle/templates/data-inventory.md`, then update `docs/lifecycle/DESCRIPTION.md` to reference it.*

### ❓ Question [2026-03-21] - Standardized Template for "Acceptance Criteria" (Delegation Gate)
**Context:** `REQUIREMENTS.md` mandates an "Acceptance Criteria (Delegation)" technical gate. While `docs/lifecycle/DELEGATION.md` defines the concept of "Definition of Done," there is no formal template provided.
**Ambiguity / Drift:** The lack of a structured "Acceptance Criteria" format prevents Explorers from providing the precise requirements needed for the subsequent Description and Discernment phases.
**Question for Product Owner:** Is there a preferred format (e.g., Gherkin/Cucumber `Given/When/Then` or a simple bulleted list) that should be mandated for the "Acceptance Criteria" gate?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a standardized `Acceptance Criteria` template in `docs/lifecycle/templates/acceptance-criteria.md` and update `docs/lifecycle/DELEGATION.md` to mandate its use.*

### ❓ Question [2026-03-21] - Project-Wide Environment Naming Standard
**Context:** The `AGENTS.md`, `scripts/verify-env.sh`, and `examples/fleet-deployment/docker-compose.yml` files consistently use or reference `dev` as the default environment name (e.g., `--env=dev`).
**Ambiguity / Drift:** This naming convention is not formally defined in `REQUIREMENTS.md` or `AGENTS.md` as the project-wide standard, which could lead to confusion when configuring multi-tenant fleet deployments (e.g., using `production` or `staging` unexpectedly).
**Question for Product Owner:** Should `dev` be formally documented as the mandatory default environment name for all local development and initial fleet provisioning?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Update `AGENTS.md` and `docs/METHODOLOGY.md` to formally define the standardized environment naming hierarchy (e.g., dev, staging, prod) and ensure all scripts and examples adhere to this standard.*

### ❓ Question [2026-03-22] - Standardizing ROI Calculator Metric Collection
**Context:** The `roi-auditor.md` persona specifies a dependency on a `Logging MCP` to retrieve records, but `REQUIREMENTS.md` (Operational Requirement 3) delegates standardized logging to the orchestrator.
**Ambiguity / Drift:** Without a standardized log schema (e.g., JSON to stderr), the `roi-auditor` cannot reliably parse execution frequency or duration to calculate ROI.
**Question for Product Owner:** Should we mandate a specific JSON schema for agent execution logs (e.g., `persona`, `task`, `duration_ms`, `success`) to be emitted to `stderr` by all agents?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Define a mandatory JSON log schema for agent observability and update all persona definitions to include this requirement as part of the "Audit Log" workflow step.*

### ❓ Question [2026-03-22] - 4D Framework Structural Integration in Persona MD Files
**Context:** `REQUIREMENTS.md` mandates the 4D framework, yet 18/18 personas only mention "4D Diligence" in the header. The other three dimensions (Delegation, Description, Discernment) have no structural presence in the Markdown files.
**Ambiguity / Drift:** There is a gap between the mandatory methodology and its implementation in the persona definitions.
**Question for Product Owner:** Should we reorganize the persona Markdown structure to explicitly include sections for Delegation (Acceptance Criteria), Description (Data Inventory), and Discernment (TRiSM/Risk Assessment)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Redesign the `docs/AGENT_TEMPLATE.md` to incorporate all four 4D dimensions as first-class sections and migrate the existing 18 personas to this new structural standard.*

### ❓ Question [2026-03-22] - Resolution of Hungarian Localization in Workflow Documentation
**Context:** A Phase 2 audit on 2026-03-22 verified 6 JSON workflow files in `docs/n8n workflows/` using Hungarian names (e.g., `E-mail összefoglalók.json`).
**Ambiguity / Drift:** This localization drift complicates cross-repository maintenance and is inconsistent with the project's English-first documentation standard.
**Question for Product Owner:** Should we proceed with an immediate bulk renaming of these files to slug-based English equivalents (e.g., `email-daily-briefing.json`)?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Rename all 6 Hungarian-named JSON files in `docs/n8n workflows/` to English slug-based names and update any internal documentation references to ensure consistency.*
