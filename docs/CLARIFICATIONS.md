# Pending Clarifications

<!-- Add new questions below this line using the required format -->

### ❓ Question [2026-03-03] - Python Runtime Dependency Contradiction
**Context:** The `REQUIREMENTS.md` explicitly states that "Python runtime support is officially deprecated," yet the `scripts/verify-env.sh` pre-flight check still mandates the presence of `python3` (line 19).
**Ambiguity / Drift:** This creates confusion for new users and automated CI/CD pipelines. It is unclear if Python is required for specific examples or if the pre-flight check is simply outdated.
**Question for Product Owner:** Should the `python3` check be removed from `verify-env.sh`, or are there specific components (e.g., in `examples/`) that still strictly require a Python environment?
**Answer:** Python is deprecated per the answer to "Python Runtime Environment Support" (2026-02-25). Remove the `python3` check from `scripts/verify-env.sh` and `verify-env.ps1` to align with the core requirements. No components require a Python environment.
**🤖 Jules Action Prompt:** *Remove the `python3` check from `scripts/verify-env.sh` and `verify-env.ps1`.*

### ❓ Question [2026-03-03] - Missing Casdoor Integration in Fleet Deployment
**Context:** The `REQUIREMENTS.md` (Strategic Alignment, Item 4) specifies that Fleet Deployment infrastructure requires "Casdoor (identity)" as part of the multi-tenant stack. However, `examples/fleet-deployment/docker-compose.yml` does not implement a Casdoor service.
**Ambiguity / Drift:** The core requirement for identity management is documented but not present in the provided reference architecture, preventing a complete "Fleet" demonstration.
**Question for Product Owner:** Is there a preferred Casdoor configuration or Docker image we should use to complete this example, or is identity management currently being handled by another component not shown in the compose file?
**Answer:** Add a Casdoor service to `examples/fleet-deployment/docker-compose.yml` using the official `casdoor/casdoor` image. Configuration secrets should follow the Infisical pattern established in the project. Provide a minimal working configuration with documentation for customization.
**🤖 Jules Action Prompt:** *Add a `casdoor` service to `examples/fleet-deployment/docker-compose.yml` using the official `casdoor/casdoor` Docker image with a backing database, following the Infisical secret management pattern. Document required environment variables in `.env.template`.*

### ❓ Question [2026-03-03] - Status of ROI Calculator Scripts
**Context:** `REQUIREMENTS.md` states the toolkit must include "Python/Excel-based ROI calculator scripts" (Strategic Alignment, Item 5). These files are not present in the repository.
**Ambiguity / Drift:** A high-priority "Feynman Requirement" for automated validation and ROI modeling is documented as a core deliverable but has no implementation or placeholder.
**Question for Product Owner:** Are the ROI calculator scripts intended to be part of this repository, and if so, can you provide the logic or templates that should be implemented?
**Answer:** Python is deprecated. Create a Google Sheets-based ROI calculator instead. The sheet should include a line item per agent with ROI calculated from estimated time savings for each task transferred to agents. See `tools/roi/README.md` for the detailed methodology and a link to the template sheet.
**🤖 Jules Action Prompt:** *Create `tools/roi/README.md` documenting the Google Sheets ROI calculator methodology (time-savings-based, per-agent line items) and include a link placeholder for the published Google Sheets template.*
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
*   **Context:** `AGENTS.md` and project memories specify that secrets should be resolved using `infisical run --env=dev`. However, the `.env.template` file is missing from the repository.
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
*   **Context:** `AGENTS.md` defines critical security rules (e.g., "NEVER ask for secrets", "ALWAYS use Infisical CLI"). These are not currently reflected in the "Rules" or "Boundaries" sections of the individual agent personas, nor are they injected into `GEMINI.md`.
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
