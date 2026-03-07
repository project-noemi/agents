# Decision Log

## [2026-03-03] - Human Feedback Integration and Phase 1 Cleanup
- **Decision**: Integrated 14 resolved clarification questions into core documentation and archived the Q&A history.
- **Context**: Phase 1 of the Doc workflow requires processing all answered questions from `CLARIFICATIONS.md` to ensure the `REQUIREMENTS.md` and `AGENTS.md` are up-to-date.
- **Impact**:
    - Standardized persona templates to the "Role, Mission, Core Mandates, Workflow, Boundaries" format.
    - Formally deprecated Python runtime support in favor of a Node.js-based, language-agnostic library.
    - Added global "Error Handling and Resilience" mandates to `AGENTS.md`.
    - Clarified external status of Support Helper and WHMCS MCP components.
    - Resolved contradictions regarding the pgvector memory layer and system dependencies.

- **Decision**: Answered all pending clarification questions and resolved documentation drifts.
- **Context**: Project required cleanup of requirements, branding standardization to "Project NoéMI", creation of `.env.template`, and clarifying the execution model (this is purely a definitions library for external orchestrators).
- **Impact**:
    - Created missing mirror directories in `docs/agents/`.
    - Added `.env.template` to the repository root.
    - Updated `REQUIREMENTS.md` to remove `[PENDING]` drifts and reflect updated consensus on stateless execution, standard persona templates, and removal of Python runtime requirements.
    - Updated `CLARIFICATIONS.md` with explicit answers.
    - Updated `README.md` to reflect Project NoéMI branding.

### 🏁 Resolved Clarifications (Detailed)

#### ❓ Question [2026-03-03] - Python Runtime Dependency Contradiction
**Context:** The `REQUIREMENTS.md` explicitly states that "Python runtime support is officially deprecated," yet the `scripts/verify-env.sh` pre-flight check still mandates the presence of `python3` (line 19).
**Ambiguity / Drift:** This creates confusion for new users and automated CI/CD pipelines. It is unclear if Python is required for specific examples or if the pre-flight check is simply outdated.
**Question for Product Owner:** Should the `python3` check be removed from `verify-env.sh`, or are there specific components (e.g., in `examples/`) that still strictly require a Python environment?
**Answer:** Python is deprecated per the answer to "Python Runtime Environment Support" (2026-02-25). Remove the `python3` check from `scripts/verify-env.sh` and `verify-env.ps1` to align with the core requirements. No components require a Python environment.

#### ❓ Question [2026-03-03] - Missing Casdoor Integration in Fleet Deployment
**Context:** The `REQUIREMENTS.md` (Strategic Alignment, Item 4) specifies that Fleet Deployment infrastructure requires "Casdoor (identity)" as part of the multi-tenant stack. However, `examples/fleet-deployment/docker-compose.yml` does not implement a Casdoor service.
**Ambiguity / Drift:** The core requirement for identity management is documented but not present in the provided reference architecture, preventing a complete "Fleet" demonstration.
**Question for Product Owner:** Is there a preferred Casdoor configuration or Docker image we should use to complete this example, or is identity management currently being handled by another component not shown in the compose file?
**Answer:** Add a Casdoor service to `examples/fleet-deployment/docker-compose.yml` using the official `casdoor/casdoor` image. Configuration secrets should follow the Infisical pattern established in the project. Provide a minimal working configuration with documentation for customization.

#### ❓ Question [2026-03-03] - Status of ROI Calculator Scripts
**Context:** `REQUIREMENTS.md` states the toolkit must include "Python/Excel-based ROI calculator scripts" (Strategic Alignment, Item 5). These files are not present in the repository.
**Ambiguity / Drift:** A high-priority "Feynman Requirement" for automated validation and ROI modeling is documented as a core deliverable but has no implementation or placeholder.
**Question for Product Owner:** Are the ROI calculator scripts intended to be part of this repository, and if so, can you provide the logic or templates that should be implemented?
**Answer:** Python is deprecated. Create a Google Sheets-based ROI calculator instead. The sheet should include a line item per agent with ROI calculated from estimated time savings for each task transferred to agents. See `tools/roi/README.md` for the detailed methodology and a link to the template sheet.

#### Question 2026-02-21 - Missing Support Helper and WHMCS MCP Components
*   **Context:** The recently resolved clarifications state that specific agents like the "Support Helper" rely on a "WHMCS Model Context Protocol (MCP) server". However, the `agents/` directory does not contain a Support Helper persona, and `mcp-protocols/` lacks a `whmcs.md` definition.
*   **Ambiguity:** Architectural decisions reference these components, but they are not present in the repository, making it impossible to verify the implementation against the specs.
*   **Question:** Are the "Support Helper" persona and "WHMCS MCP" protocol documentation planned for this repository, or are they maintained in an external system?
*   **Answer:** These components are planned for a future release and will be maintained in a separate specialized repository; this repository focuses on general-purpose agents and their MCP protocols.

#### Question 2026-02-21 - Agent Execution Mechanism (Runner)
*   **Context:** `REQUIREMENTS.md` states that agents can be executed as "standalone scripts via CLI". The current codebase only contains `scripts/generate_gemini.js` for context assembly.
*   **Ambiguity:** There is no clear mechanism or example of how to "execute" a persona defined in Markdown using the toolkit.
*   **Question:** Is there an intended generic runner (e.g., a Python or Node.js script) that consumes these personas and the generated `GEMINI.md`, or is execution handled by an external orchestrator?
*   **Answer:** Execution is handled by external orchestrators (e.g., Gemini CLI, n8n, LangChain). This repository is a definitions library to build and compose contexts, not an execution engine.

#### Question 2026-02-21 - Documentation Mirroring Drift (`docs/agents/`)
*   **Context:** Project guidelines mandate that `docs/agents/` strictly mirror the hierarchy of `agents/`. Currently, `docs/agents/` is missing multiple domains (e.g., `engineering`, `marketing`, `operations`) found in the root `agents/` folder.
*   **Ambiguity:** This indicates significant drift between the codebase structure and its required documentation mirror.
*   **Question:** Should the `docs/agents/` mirror be updated manually to match the current `agents/` structure, or is this mirroring requirement being deprecated?
*   **Answer:** The `docs/agents/` mirror must be updated to match the `agents/` structure. The missing directories have been added.

#### Question 2026-02-24 - Standardized Logging Implementation
*   **Context:** `REQUIREMENTS.md` states that "Technical details must be logged using standardized logging to stdout and stderr."
*   **Ambiguity:** Since agents are defined as Markdown personas rather than executable code, it is unclear if "standardized logging" refers to a specific output format the persona must follow, or if this is a requirement for the (currently missing) agent runner/orchestrator.
*   **Question:** Should agent personas be updated with a "Logging" section defining their output format, or is this requirement handled by the execution environment?
*   **Answer:** This requirement applies to the external execution environment/orchestrator running the agents, not the persona definitions themselves.

#### Question 2026-02-24 - Configuration Source of Truth
*   **Context:** `REQUIREMENTS.md` specifies that configuration must be handled "entirely via environment variables," but `scripts/generate_gemini.js` currently relies on `mcp.config.json` to determine active MCPs.
*   **Ambiguity:** There is a conflict between the documented requirement and the actual implementation for managing active integrations.
*   **Question:** Should `mcp.config.json` be deprecated in favor of an `ACTIVE_MCPS` environment variable, or should the requirements be updated to recognize the JSON configuration as the source of truth?
*   **Answer:** `mcp.config.json` is the source of truth for context assembly (generating GEMINI.md). Environment variables are the source of truth for runtime secrets.

#### Question 2026-02-24 - Agent Resilience and Tool Failure Directives
*   **Context:** `REQUIREMENTS.md` requires that "Agents must handle tool execution and API failures gracefully."
*   **Ambiguity:** Most agent personas (e.g., `agents/coding/bolt/core.md`) do not currently contain instructions on how to behave when an MCP tool fails or returns an error.
*   **Question:** Should a standardized "Error Handling" or "Resilience" section be added to all agent persona templates to guide their behavior during tool failures?
*   **Answer:** A standardized "Error Handling and Resilience" directive will be added to the base templates or global guidelines rather than each individual persona.

#### Question 2026-02-25 - Missing .env.template for Secret Resolution
*   **Context:** `AGENTS.md` and project memories specify that secrets should be resolved using `op run --env-file=.env.template`. However, the `.env.template` file is missing from the repository.
*   **Ambiguity:** Developers and agents lack a template to define the required environment variables for various integrations (e.g., n8n, Slack).
*   **Question:** Should a `.env.template` be added to the root directory, or is there another intended method for defining the required environment variable keys?
*   **Answer:** A `.env.template` file should be added to the root directory documenting the required structure for orchestrator execution.

#### Question 2026-02-25 - Python Runtime Environment Support
*   **Context:** `REQUIREMENTS.md` states that agents are designed for cross-platform compatibility, "primarily utilizing Node.js or Python environments." The current codebase only contains Node.js scripts.
*   **Ambiguity:** There are no Python-specific files (e.g., `requirements.txt`, `pyproject.toml`, or agent runners) to support the stated requirement.
*   **Question:** Is Python support planned for a future phase, and if so, what is the expected timeline or specific use case (e.g., specific agent runners)?
*   **Answer:** This requirement is deprecated. The repository is a language-agnostic library of markdown specifications, and execution scripts are node-based utilities for context generation.

#### Question 2026-02-25 - Consistent "NoeMI" Branding
*   **Context:** `REQUIREMENTS.md` mentions "Project NoeMI" and "AI agents (NoeMI)", but this branding is absent from the `README.md`, `GEMINI.template.md`, and individual agent personas.
*   **Ambiguity:** It is unclear if "NoeMI" is the official project name or an internal codename that should be standardized or removed.
*   **Question:** Should "NoeMI" be adopted as the official branding across all documentation, or should it be removed from `REQUIREMENTS.md`?
*   **Answer:** Yes, "Project NoéMI" is the official project branding and will be standardized across the README and other primary documentation.

#### Question 2026-02-26 - Persona Template Standardization
*   **Context:** `REQUIREMENTS.md` states agents must be defined using "Role, Tone, Capabilities, and Rules", which is followed by `ai-architect.md` and `brand-strategist.md`. However, `agents/coding/bolt/core.md` and `agents/coding/sentinel/core.md` use a divergent format (Role, Mission, Core Mandates, Workflow, Journal, Boundaries).
*   **Ambiguity:** Lack of a single source of truth for agent persona templates makes maintenance and scaling of the library difficult.
*   **Question:** Should all agents be migrated to the "Role, Tone, Capabilities, and Rules" format, or are there different classes of agents (e.g., "Standard" vs "Specialized/Task-Oriented") that require different templates?
*   **Answer:** The "Role, Mission, Core Mandates, Workflow, Boundaries" format is adopted as the new standard for specialized agents. Simpler agents may continue using basic templates, but standardization towards the Bolt/Sentinel format is preferred.

#### Question 2026-02-26 - Execution Context and Tooling References
*   **Context:** The personas for Bolt and Sentinel refer to `pnpm lint` and `pnpm test` as verification steps. This repository does not use `pnpm` and has no `package.json`.
*   **Ambiguity:** It is unclear if these agents are meant to operate on the repository they are stored in (which lacks these tools), or if they are intended to be deployed into external environments where these tools are expected.
*   **Question:** Should agent personas be generic regarding their verification tools, or should they assume a specific runtime environment?
*   **Answer:** Personas should document their expected external tooling dependencies in their requirements. They assume the orchestrator has prepared a compatible workspace.

#### Question 2026-02-26 - Global Security Mandate Injection
*   **Context:** `AGENTS.md` defines critical security rules (e.g., "NEVER ask for secrets", "ALWAYS use 1Password CLI"). These are not currently reflected in the "Rules" or "Boundaries" sections of the individual agent personas, nor are they injected into `GEMINI.md`.
*   **Ambiguity:** Agents might not be aware of these global security mandates if they only ingest their specific persona file.
*   **Question:** Should the global security and execution mandates from `AGENTS.md` be automatically injected into `GEMINI.md` via the generation script, or should they be manually added to each agent's "Rules" section?
*   **Answer:** Global security mandates should be included in `AGENTS.md` and injected by the orchestrator or `generate_gemini.js` into the final system prompt.

#### Question 2026-02-27 - Stateless Execution vs. Persistent Memory Layer
*   **Context:** `REQUIREMENTS.md` mandates that "Agents must operate with stateless execution," yet `examples/docker/docker-compose.yml` implements a persistent `pgvector` service labeled as the "Memory Layer" where the agent stores embeddings and past conversations.
*   **Ambiguity:** There is a direct contradiction between the documented stateless requirement and the provided architectural example for persistent agent memory.
*   **Question:** Is the "Memory Layer" (pgvector) intended to be a core, required component of the Project NoéMI architecture, or is it an optional enhancement?
*   **Answer:** The core execution model is stateless. The `pgvector` memory layer in the Docker example is an optional enhancement for advanced orchestrator setups.

#### Question 2026-02-27 - Core Toolkit System Dependencies
*   **Context:** The `scripts/verify-env.sh` "Pre-Flight Check" mandates the presence of `Docker` and the `Gemini CLI`, but these are not currently listed as core requirements in `REQUIREMENTS.md`.
*   **Ambiguity:** It is unclear if these tools are strictly required for the toolkit to function or if they are only necessary for running the specific examples and pre-flight scripts provided.
*   **Question:** Should `Docker` and the `Gemini CLI` be officially designated as core system requirements for the Project NoéMI toolkit?
*   **Answer:** Docker and Gemini CLI are required dependencies for running the local examples and pre-flight checks, but not for simply reading the library definitions.

## [2026-02-21] - Pivot to Standalone Agents and MCP
- **Decision**: The repository is strictly for standalone scripts and agents. The "Support Helper" will be an agent that connects to a WHMCS MCP server.
- **Context**: Clarification provided that this is an agents repo, and any WHMCS features should rely on an MCP server instead of hosting module code.
- **Impact**: Removed `src/addonmodule.php`. Completely rewrote `REQUIREMENTS.md` and answered all pending questions in `CLARIFICATIONS.md`.

## [2026-02-21] - Resolved Architecture and Operational Clarifications
- **Decision**: Formally integrated architecture, security, and operational resolutions into `REQUIREMENTS.md`.
- **Impact**:
    - Verified that Auth/RBAC/Audit are delegated to the execution environment.
    - Standardized logging to `stdout`/`stderr`.
    - Confirmed stateless execution model.
    - Explicitly documented the pivot away from WHMCS PHP modules to standalone agents.
- **Resolved Questions**:
    - **New Platform/Architecture**: The repository is exclusively a collection of standalone AI agents and scripts. Support Helper will be a persona relying on external WHMCS MCP.
    - **Core Functionality Replacement**: No "Support Dashboard"; Support Helper uses MCP tools (cache clearing, status checks).
    - **Legacy Code Cleanup**: `src/addonmodule.php` removed.
    - **Legacy Configuration Fields**: Discarded. Config via env vars and Infisical.
    - **Undocumented Utility (Clear Cache)**: Handled by external WHMCS MCP tool.
    - **Performance Metrics**: Applies to agent response times, not a dashboard.
    - **Authentication Provider**: Delegated to execution environment (CLI/Orchestrator).
    - **Data Persistence**: Stateless execution; no relational DB required.
    - **Standardized Error Handling**: Use standardized logging to `stdout` and `stderr`.
    - **RBAC & Auditing**: Delegated to host platform or MCP server.
    - **Utility Extensibility**: Dynamic via Model Context Protocol (MCP).
    - **Target Runtime Environment**: Cross-platform (Node.js/Python), no longer PHP-specific.

## [2026-02-15] - Project Direction Pivot
- **Decision**: The project is no longer being developed as a WHMCS Addon Module.
- **Context**: Answer provided in CLARIFICATIONS.md regarding Cache Clearing Feature.
- **Impact**: REQUIREMENTS.md updated to remove WHMCS dependencies.

## [2026-02-15] - Removal of Support Ticketing
- **Decision**: Support ticket management is removed from the scope of this tool.
- **Context**: Answer provided in CLARIFICATIONS.md regarding Dashboard Performance Metric.
- **Impact**: REQUIREMENTS.md updated to remove ticketing functional requirements.

## [2026-02-15] - API Timeout Handling De-prioritization
- **Decision**: Specific API timeout handling is currently N/A.
- **Context**: Answer provided in CLARIFICATIONS.md regarding API Timeout Handling.
- **Impact**: Requirement removed from REQUIREMENTS.md.

## [2026-02-16] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: Requirements updated based on codebase drift and security policy (Infisical) analysis.

## [2026-02-19] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: REQUIREMENTS.md updated to explicitly flag legacy ticketing drift and security policy conflicts in `src/addonmodule.php`. Added new questions to CLARIFICATIONS.md regarding RBAC, Audit Logging, and Extensibility.

## [2026-02-21] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: REQUIREMENTS.md updated based on codebase analysis of `src/addonmodule.php` and security policy in `AGENTS.md`. Identified specific implementation drift in cache clearing and access control. Integrated "Fetch-on-Demand" execution patterns.

## [2026-02-24] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: REQUIREMENTS.md updated to incorporate missing agent domains (engineering, marketing, operations) found in the codebase. Flagged several items as [PENDING] due to implementation drift (Support Helper, WHMCS MCP, Config via env vars, and Standardized Logging). Added new questions to CLARIFICATIONS.md to resolve these ambiguities.

## [2026-02-25] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: REQUIREMENTS.md updated to flag newly identified implementation drifts: missing `.env.template` for secret resolution, lack of Python runtime environment support, and inconsistent "NoeMI" branding. Added corresponding questions to CLARIFICATIONS.md.

## [2026-02-26] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: REQUIREMENTS.md updated to flag newly identified implementation drifts: inconsistent persona templates in `agents/coding/` (Bolt, Sentinel) and references to external tooling (`pnpm`, `npm test`) not present in this repository. Added corresponding questions to CLARIFICATIONS.md regarding template standardization, execution context, and global security mandate injection.

## [2026-02-27] - Documentation Audit
- **Status**: No new human feedback provided in CLARIFICATIONS.md.
- **Action**: REQUIREMENTS.md updated to resolve "Project NoéMI" branding and specify the missing agent domain manual directories. Flagged the architectural contradiction between the "Stateless Execution" mandate and the `pgvector` "Memory Layer" found in Docker examples. Added new questions to CLARIFICATIONS.md regarding the memory layer and core system dependencies (Docker, Gemini CLI).
# Pending Clarifications

<!-- Add new questions below this line using the required format -->

### Question 2026-02-21 - Missing Support Helper and WHMCS MCP Components
*   **Context:** The recently resolved clarifications state that specific agents like the "Support Helper" rely on a "WHMCS Model Context Protocol (MCP) server". However, the `agents/` directory does not contain a Support Helper persona, and `mcp-protocols/` lacks a `whmcs.md` definition.
*   **Ambiguity:** Architectural decisions reference these components, but they are not present in the repository, making it impossible to verify the implementation against the specs.
*   **Question:** Are the "Support Helper" persona and "WHMCS MCP" protocol documentation planned for this repository, or are they maintained in an external system?
*   **Answer:** These components are planned for a future release and will be maintained in a separate specialized repository; this repository focuses on general-purpose agents and their MCP protocols.

### Question 2026-02-21 - Agent Execution Mechanism (Runner)
*   **Context:** `REQUIREMENTS.md` states that agents can be executed as "standalone scripts via CLI". The current codebase only contains `scripts/generate_gemini.js` for context assembly.
*   **Ambiguity:** There is no clear mechanism or example of how to "execute" a persona defined in Markdown using the toolkit.
*   **Question:** Is there an intended generic runner (e.g., a Python or Node.js script) that consumes these personas and the generated `GEMINI.md`, or is execution handled by an external orchestrator?
*   **Answer:** Execution is handled by external orchestrators (e.g., Gemini CLI, n8n, LangChain). This repository is a definitions library to build and compose contexts, not an execution engine.

### Question 2026-02-21 - Documentation Mirroring Drift (`docs/agents/`)
*   **Context:** Project guidelines mandate that `docs/agents/` strictly mirror the hierarchy of `agents/`. Currently, `docs/agents/` is missing multiple domains (e.g., `engineering`, `marketing`, `operations`) found in the root `agents/` folder.
*   **Ambiguity:** This indicates significant drift between the codebase structure and its required documentation mirror.
*   **Question:** Should the `docs/agents/` mirror be updated manually to match the current `agents/` structure, or is this mirroring requirement being deprecated?
*   **Answer:** The `docs/agents/` mirror must be updated to match the `agents/` structure. The missing directories have been added.

### Question 2026-02-24 - Standardized Logging Implementation
*   **Context:** `REQUIREMENTS.md` states that "Technical details must be logged using standardized logging to stdout and stderr."
*   **Ambiguity:** Since agents are defined as Markdown personas rather than executable code, it is unclear if "standardized logging" refers to a specific output format the persona must follow, or if this is a requirement for the (currently missing) agent runner/orchestrator.
*   **Question:** Should agent personas be updated with a "Logging" section defining their output format, or is this requirement handled by the execution environment?
*   **Answer:** This requirement applies to the external execution environment/orchestrator running the agents, not the persona definitions themselves.

### Question 2026-02-24 - Configuration Source of Truth
*   **Context:** `REQUIREMENTS.md` specifies that configuration must be handled "entirely via environment variables," but `scripts/generate_gemini.js` currently relies on `mcp.config.json` to determine active MCPs.
*   **Ambiguity:** There is a conflict between the documented requirement and the actual implementation for managing active integrations.
*   **Question:** Should `mcp.config.json` be deprecated in favor of an `ACTIVE_MCPS` environment variable, or should the requirements be updated to recognize the JSON configuration as the source of truth?
*   **Answer:** `mcp.config.json` is the source of truth for context assembly (generating GEMINI.md). Environment variables are the source of truth for runtime secrets.

### Question 2026-02-24 - Agent Resilience and Tool Failure Directives
*   **Context:** `REQUIREMENTS.md` requires that "Agents must handle tool execution and API failures gracefully."
*   **Ambiguity:** Most agent personas (e.g., `agents/coding/bolt/core.md`) do not currently contain instructions on how to behave when an MCP tool fails or returns an error.
*   **Question:** Should a standardized "Error Handling" or "Resilience" section be added to all agent persona templates to guide their behavior during tool failures?
*   **Answer:** A standardized "Error Handling and Resilience" directive will be added to the base templates or global guidelines rather than each individual persona.

### Question 2026-02-25 - Missing .env.template for Secret Resolution
*   **Context:** `AGENTS.md` and project memories specify that secrets should be resolved using `op run --env-file=.env.template`. However, the `.env.template` file is missing from the repository.
*   **Ambiguity:** Developers and agents lack a template to define the required environment variables for various integrations (e.g., n8n, Slack).
*   **Question:** Should a `.env.template` be added to the root directory, or is there another intended method for defining the required environment variable keys?
*   **Answer:** A `.env.template` file should be added to the root directory documenting the required structure for orchestrator execution.

### Question 2026-02-25 - Python Runtime Environment Support
*   **Context:** `REQUIREMENTS.md` states that agents are designed for cross-platform compatibility, "primarily utilizing Node.js or Python environments." The current codebase only contains Node.js scripts.
*   **Ambiguity:** There are no Python-specific files (e.g., `requirements.txt`, `pyproject.toml`, or agent runners) to support the stated requirement.
*   **Question:** Is Python support planned for a future phase, and if so, what is the expected timeline or specific use case (e.g., specific agent runners)?
*   **Answer:** This requirement is deprecated. The repository is a language-agnostic library of markdown specifications, and execution scripts are node-based utilities for context generation.

### Question 2026-02-25 - Consistent "NoeMI" Branding
*   **Context:** `REQUIREMENTS.md` mentions "Project NoeMI" and "AI agents (NoeMI)", but this branding is absent from the `README.md`, `GEMINI.template.md`, and individual agent personas.
*   **Ambiguity:** It is unclear if "NoeMI" is the official project name or an internal codename that should be standardized or removed.
*   **Question:** Should "NoeMI" be adopted as the official branding across all documentation, or should it be removed from `REQUIREMENTS.md`?
*   **Answer:** Yes, "Project NoéMI" is the official project branding and will be standardized across the README and other primary documentation.

### Question 2026-02-26 - Persona Template Standardization
*   **Context:** `REQUIREMENTS.md` states agents must be defined using "Role, Tone, Capabilities, and Rules", which is followed by `ai-architect.md` and `brand-strategist.md`. However, `agents/coding/bolt/core.md` and `agents/coding/sentinel/core.md` use a divergent format (Role, Mission, Core Mandates, Workflow, Journal, Boundaries).
*   **Ambiguity:** Lack of a single source of truth for agent persona templates makes maintenance and scaling of the library difficult.
*   **Question:** Should all agents be migrated to the "Role, Tone, Capabilities, and Rules" format, or are there different classes of agents (e.g., "Standard" vs "Specialized/Task-Oriented") that require different templates?
*   **Answer:** The "Role, Mission, Core Mandates, Workflow, Boundaries" format is adopted as the new standard for specialized agents. Simpler agents may continue using basic templates, but standardization towards the Bolt/Sentinel format is preferred.

### Question 2026-02-26 - Execution Context and Tooling References
*   **Context:** The personas for Bolt and Sentinel refer to `pnpm lint` and `pnpm test` as verification steps. This repository does not use `pnpm` and has no `package.json`.
*   **Ambiguity:** It is unclear if these agents are meant to operate on the repository they are stored in (which lacks these tools), or if they are intended to be deployed into external environments where these tools are expected.
*   **Question:** Should agent personas be generic regarding their verification tools, or should they assume a specific runtime environment?
*   **Answer:** Personas should document their expected external tooling dependencies in their requirements. They assume the orchestrator has prepared a compatible workspace.

### Question 2026-02-26 - Global Security Mandate Injection
*   **Context:** `AGENTS.md` defines critical security rules (e.g., "NEVER ask for secrets", "ALWAYS use 1Password CLI"). These are not currently reflected in the "Rules" or "Boundaries" sections of the individual agent personas, nor are they injected into `GEMINI.md`.
*   **Ambiguity:** Agents might not be aware of these global security mandates if they only ingest their specific persona file.
*   **Question:** Should the global security and execution mandates from `AGENTS.md` be automatically injected into `GEMINI.md` via the generation script, or should they be manually added to each agent's "Rules" section?
*   **Answer:** Global security mandates should be included in `AGENTS.md` and injected by the orchestrator or `generate_gemini.js` into the final system prompt.

### Question 2026-02-27 - Stateless Execution vs. Persistent Memory Layer
*   **Context:** `REQUIREMENTS.md` mandates that "Agents must operate with stateless execution," yet `examples/docker/docker-compose.yml` implements a persistent `pgvector` service labeled as the "Memory Layer" where the agent stores embeddings and past conversations.
*   **Ambiguity:** There is a direct contradiction between the documented stateless requirement and the provided architectural example for persistent agent memory.
*   **Question:** Is the "Memory Layer" (pgvector) intended to be a core, required component of the Project NoéMI architecture, or is it an optional enhancement?
*   **Answer:** The core execution model is stateless. The `pgvector` memory layer in the Docker example is an optional enhancement for advanced orchestrator setups.

### Question 2026-02-27 - Core Toolkit System Dependencies
*   **Context:** The `scripts/verify-env.sh` "Pre-Flight Check" mandates the presence of `Docker` and the `Gemini CLI`, but these are not currently listed as core requirements in `REQUIREMENTS.md`.
*   **Ambiguity:** It is unclear if these tools are strictly required for the toolkit to function or if they are only necessary for running the specific examples and pre-flight scripts provided.
*   **Question:** Should `Docker` and the `Gemini CLI` be officially designated as core system requirements for the Project NoéMI toolkit?
*   **Answer:** Docker and Gemini CLI are required dependencies for running the local examples and pre-flight checks, but not for simply reading the library definitions.
