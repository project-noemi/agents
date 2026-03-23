# Project NoéMI Agents Library - Requirements

## Overview
This repository serves as a comprehensive resource for agentic development and a ready-to-use toolkit for building AI agents. It functions as the central directory for Project NoéMI, housing agent personas, specialized workflows, domain-specific knowledge (Markdown documentation), and integration scripts.

The primary goal is to provide a robust foundation that developers can use to quickly scaffold, configure, and deploy intelligent agents, while also providing a suite of "out-of-the-box" agents ready for immediate use by external orchestrators.

### Agent Deployment Model
- **Standalone Collection**: This repository is exclusively a collection of standalone AI agent definitions, context templates, and scripts.
- **External Dependencies**: Specific agents are implemented as personas that rely on external tools, such as Model Context Protocol (MCP) servers, for their core functionality rather than hosting that logic locally. Execution is handled by external orchestrators (e.g., Gemini CLI, n8n, LangChain).
- **Separate Components**: Specialized components like the **Support Helper** persona and the **WHMCS MCP** server are maintained in separate repositories and are not part of this core library.

## Core Objectives
1. **Agentic Development Toolkit**: Provide reusable components, standardized persona definitions, and workflow templates to accelerate agent creation.
2. **Out-of-the-Box Agents**: Supply fully defined, operational agent personas that can be deployed immediately for common tasks across coding, infrastructure, communication, engineering, marketing, operations, and product domains. Documentation strictly mirrors these directories in `docs/agents/` via symbolic links [VERIFIED: Individual persona file mirroring is complete].
3. **Knowledge Base**: Act as a structured repository of information, protocols, and best practices that guide both human developers and the AI agents (NoéMI) operating within the ecosystem.
4. **The 4D AI Fluency Framework**: Formally adopt and document the Delegation, Description, Discernment, and Diligence framework as the mandatory methodology for all agent development.
    - **Methodology Gating**: All agents must pass through technical gates: Acceptance Criteria (Delegation), Data Inventory (Description), and Gartner AI TRiSM Assessment (Discernment).
    - **Role Accountability**: Development follows the "High-Tech Surfboard" model with distinct responsibilities for Explorers (Business/UAT), Practitioners (Engineering/Red-Teaming), and Accelerators (Security/ROI/Certification).
    - [VERIFIED 2026-03-21: The other three dimensions (Delegation, Description, Discernment) are structurally absent from all 18 agent personas].

## Functional Requirements
1. **Persona Definition**: Agents must be defined clearly using Markdown specifications (located in the `agents/` directory). The standard format is: **Role, Mission, Rules & Constraints, Workflow, Boundaries** [VERIFIED: All agents utilize 'Rules & Constraints']. Agents must also document any expected external tooling dependencies (e.g., `pnpm`, `docker`) in their persona files to ensure the orchestrator can prepare a compatible workspace [DRIFT: Missing from all 18 personas - VERIFIED 2026-03-21]. Documentation strictly mirrors these directories in `docs/agents/` via symbolic links [VERIFIED 2026-03-21: Hierarchy and file mirroring is complete]. [VERIFIED: AGENTS.md aligned with 'Rules & Constraints' persona standard].
2. **Configuration**:
    - **Context Assembly**: `mcp.config.json` is the source of truth for determining which MCP integrations are active during `GEMINI.md` generation. [DRIFT: `agents/guardian/roi-auditor.md` requires a `logging-mcp` which is absent from `active_mcps` - VERIFIED 2026-03-21].
    - **Runtime Secrets**: Environment variables (managed via `.env.template` and SecretOps) are the source of truth for runtime execution. [DRIFT: `examples/video-automation-pod/dropbox_watcher.py` incorrectly utilizes `load_dotenv()` instead of the mandatory Fetch-on-Demand security policy - VERIFIED 2026-03-21].
3. **Extensibility (MCP Integration)**: Agents and the underlying toolkit must be capable of seamlessly interacting with external Model Context Protocol (MCP) servers.
4. **Modular Context Generation**: The system must provide a mechanism (`scripts/generate_gemini.js`) to compile `GEMINI.md` dynamically from base templates, modular MCP protocol files, and global security and resilience mandates from `AGENTS.md`. [DRIFT: Current implementation only injects "Secrets & Configuration" and "Error Handling" sections, ignoring "Execution Patterns" and "Coding Standards" - VERIFIED 2026-03-20].
5. **Guardian Layer Defense**: Implement and maintain a specialized layer of "Guardian" agents (e.g., `PIIGuard`, `PromptShield`) to enforce security boundaries and data privacy protocols.

## Operational & Security Requirements
1. **Execution Environment**: This repository is a definitions library; execution is handled by external orchestrators.
2. **Security & Credentials (Fetch-on-Demand)**: All sensitive credentials must be stored in secure vaults (e.g., Infisical, 1Password) and resolved at runtime using CLI wrappers (`infisical run` or `op run`).
3. **Resilience & Error Handling**: Agents must handle tool execution and API failures gracefully by following the global mandates in `AGENTS.md` (e.g., exponential backoff, graceful degradation). Standardized logging to `stdout` and `stderr` is the responsibility of the orchestrator.
4. **Identity & Access Management**: Delegated to the execution environment and MCP servers. **Casdoor** is the standardized identity management provider for multi-tenant fleet deployments. [PENDING: Technical integration contract for agents to utilize Casdoor identities].
5. **Fleet-Ready Infrastructure**: Maintain standardized `docker-compose.yml` templates for parallel "Fleet" deployments.
    - **Traffic Routing**: Standardize on Traefik with host-based routing (e.g., `auth.noemi.local`, `audit.noemi.local`) for service isolation and multi-tenancy.
    - **Observability**: A centralized stack (Grafana/Loki) is mandatory for cross-cohort auditing.
6. **ROI Modeling & Validation**: Implement a standardized labor-cost-avoidance methodology for calculating agent ROI, documented in `tools/roi/README.md`. A specialized `roi-auditor` agent persona is available to automate this process [PENDING: Production-ready ROI calculator template link].

## Technical Specifications
- **Architecture**: Static Markdown documentation and Node.js executable scripts.
- **Data Persistence**: The core execution model is stateless. Optional persistent memory layers (e.g., `pgvector`) are handled by advanced orchestrators.
- **Runtime Environment**: Node.js based utilities. **Python runtime support is officially deprecated.** Legacy Python scripts in `examples/` are maintained for historical context but are slated for conversion [PENDING: Migration roadmap].
- **System Dependencies**: Git, Node.js, Docker, and the Gemini CLI are required for running local examples, pre-flight checks (`scripts/verify-env.sh`), and environment validation [PENDING: Gemini CLI source and installation documentation - VERIFIED 2026-03-21]. SecretOps CLI verification (`infisical` or `op`) is missing from `scripts/verify-env.sh` [VERIFIED 2026-03-21].

## Strategic Alignment & Future Enhancements
1. **Role-Based Agent Toolkits**: Categorize templates for "Practitioners" and "Accelerators".
2. **Kubernetes Support**: Expand fleet deployment examples to include Kubernetes manifests (Deployments, Services, and Ingress).
3. **Automated Validation Bots**: Develop specialized "Verification Bots" for auditing agent logs for academic credentialing and ROI validation [VERIFIED: Academic audit logic implemented in `examples/gmu-validation/`].
4. **Persona Standards Audit**: Standardize all agent personas to include a mandatory "Audit Log" requirement, ensuring they output a brief JSON summary of their reasoning alongside their final payload [PENDING: Schema definition and implementation - VERIFIED 2026-03-20: Missing from all 18 personas].
5. **Workflow Standardization**: Implement a standardized naming and documentation convention for exported n8n workflows in `docs/n8n workflows/` to avoid localization drift [PENDING: Renaming of 6 files with Hungarian names verified 2026-03-20].
