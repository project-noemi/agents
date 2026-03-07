# Project NoéMI Agents Repository - Requirements

## Overview
This repository serves as a comprehensive resource for agentic development and a ready-to-use toolkit for building AI agents. It functions as the central directory for Project NoéMI, housing agent personas, specialized workflows, domain-specific knowledge (Markdown documentation), and integration scripts.

The primary goal is to provide a robust foundation that developers can use to quickly scaffold, configure, and deploy intelligent agents, while also providing a suite of "out-of-the-box" agents ready for immediate use by external orchestrators.

### Agent Deployment Model
- **Standalone Collection**: This repository is exclusively a collection of standalone AI agent definitions, context templates, and scripts.
- **External Dependencies**: Specific agents are implemented as personas that rely on external tools, such as Model Context Protocol (MCP) servers, for their core functionality rather than hosting that logic locally. Execution is handled by external orchestrators (e.g., Gemini CLI, n8n).

## Core Objectives
1. **Agentic Development Toolkit**: Provide reusable components, standardized persona definitions, and workflow templates to accelerate agent creation.
2. **Out-of-the-Box Agents**: Supply fully defined, operational agent personas that can be deployed immediately for common tasks across coding, infrastructure, communication, engineering, marketing, operations, and product domains. Documentation strictly mirrors these directories in `docs/agents/`.
3. **Knowledge Base**: Act as a structured repository of information, protocols, and best practices that guide both human developers and the AI agents (NoéMI) operating within the ecosystem.

## Functional Requirements
1. **Persona Definition**: Agents must be defined clearly using Markdown specifications (located in the `agents/` directory). The new standard format is: **Role, Mission, Core Mandates, Workflow, Boundaries**. Simpler agents may use basic templates, but standardization towards this format is preferred. Agents must also document any expected external tooling dependencies in their persona files.
2. **Configuration**: Agent runtime execution is configured via the orchestrator's environment variables. The context assembly script uses `mcp.config.json` as the source of truth to generate the correct base templates.
3. **Extensibility (MCP Integration)**: Agents and the underlying toolkit must be capable of seamlessly interacting with external Model Context Protocol (MCP) servers. Specialized components like the **Support Helper** persona and the **WHMCS MCP** protocol are maintained in separate repositories.
4. **Modular Context Generation**: The system must provide a mechanism to compile `GEMINI.md` dynamically from base templates and modular MCP protocol files. This prevents context window overloading and allows developers to selectively activate only the MCP integrations relevant to their current task.

## Operational & Security Requirements
1. **Execution Environment**: This repository is a definitions library for building and composing agent contexts. Execution is handled by external orchestrators (e.g., Gemini CLI, n8n, LangChain).
2. **Security & Credentials (Fetch-on-Demand)**: The toolkit mandates a "Fetch-on-Demand" architecture for secrets. All sensitive credentials (e.g., API keys, MCP connection strings) must be stored exclusively in secure vaults (e.g., Infisical) and never hardcoded.
3. **Runtime Resolution**: Secrets must be resolved dynamically at runtime using secure CLI tools (e.g., the Infisical CLI `infisical`).
4. **Resilience & Logging**: Agents must handle tool execution and API failures gracefully. Standardized logging to `stdout` and `stderr`, as well as error handling during execution, is the sole responsibility of the execution platform/orchestrator.
5. **Identity & Access Management**:
    - **Authentication**: Delegated to the environment executing the agent (e.g., Infisical CLI auth for local runs).
    - **RBAC**: Role-Based Access Control is handled by the execution platform or host interface.
    - **Auditing**: Audit logging of tool executions is the responsibility of the MCP servers or the orchestrating platform.

## Technical Specifications
- **Architecture**: A hybrid structure containing static Markdown documentation (for knowledge and persona definition) and Node.js executable scripts/configurations for runtime context deployment. The repository is language-agnostic regarding agent personas.
- **Data Persistence**: The core execution model is stateless execution. The `pgvector` memory layer found in examples is an optional enhancement for advanced orchestrator setups.
- **Runtime Environment**: The context generation scripts use a Node.js environment. **Python runtime support is officially deprecated.** Docker and Gemini CLI are core system requirements for running local examples and environment pre-flight checks.
  - *Prerequisite Reading:* For a short class on managing Gemini CLI extensions, please see the [Getting Started with Gemini CLI Extensions Codelab](https://codelabs.developers.google.com/getting-started-gemini-cli-extensions).

## Strategic Alignment & Future Enhancements (Top 5 Areas for Improvement)
Based on the Project NoéMI strategy (1:50 Equilibrium, 4D Framework, and Fleet Deployment), the following are the top 5 required improvements to align the repository with the project's pedagogical and operational goals:

1. **Role-Based Agent Toolkits (Practitioner vs. Accelerator):** The repository must categorize its templates and agents to explicitly serve the distinct roles of the "High-Tech Surfboard" model. We need clear toolkits for "Practitioners" (vibe coding, description, single-agent builds) and "Accelerators" (governance, multi-agent orchestration, risk audits).
2. **Integration of the 4D AI Fluency Framework:** The agent development lifecycle documentation must be restructured around the 4 Ds: Delegation (Goal awareness), Description (Prompt engineering and contextualization), Discernment (Validation and quality control), and Diligence (ROI and ethical deployment).
3. **Formalizing the "Guardian Layer" (TRiSM & Red Teaming):** The repository must introduce explicit "Guardian Agent" personas (supervisory AIs designed to monitor and critique other agents) and provide "Red Team Gauntlet" lab examples to test for prompt injection, data leaks, and policy violations.
4. **Fleet-Ready Observability & Orchestration Infrastructure:** To support parallel "Fleet" deployments, the repository's examples include automated provisioning templates (e.g., `examples/fleet-deployment/docker-compose.yml`) for a multi-tenant stack including n8n (automation), Traefik (ingress), Casdoor (identity), and Loki/Grafana (centralized observability).
5. **Automated Validation & ROI Modeling (The Feynman Requirement):** The toolkit must include "Verification Bots" to audit agent logs for academic credentialing (GMU validation), alongside a Google Sheets-based ROI calculator (documented in `tools/roi/README.md`) to ensure agents deliver measurable business value before deployment.
