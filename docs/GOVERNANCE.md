# Governance, TRiSM, and Red Teaming

## Overview
All agents developed within the Project NoeMI ecosystem must adhere to rigorous governance protocols before deployment. We align our security and operational standards with **Gartner AI TRiSM** (Trust, Risk and Security Management).

---

## 1. Gartner AI TRiSM Alignment

To ensure institutional-grade AI orchestration, every agent must be evaluated against the following pillars:

### Trust (Explainability & Reliability)
*   **Traceability:** The actions taken by an agent (especially via MCP tools) must be loggable and auditable.
*   **Prompt Transparency:** The base instructions (`GEMINI.md` and persona files) must clearly define the agent's boundaries and intended behavior.

### Risk (Compliance & Data Privacy)
*   **Data Minimization:** Agents must only retrieve the data strictly necessary for the task (e.g., using targeted Gmail searches rather than full inbox dumps).
*   **Secure Credentialing:** Hardcoded secrets are strictly forbidden. All MCP connections and API keys must utilize the established "Fetch-on-Demand" architecture via an approved SecretOps platform such as Infisical or 1Password.

### Security (Access Control & Threat Mitigation)
*   **Least Privilege:** MCP servers should be configured with the minimum permissions required. (e.g., An agent should not have 'Editor' access to a Google Drive folder if it only needs to 'View').
*   **Execution Confirmation:** Critical operations (e.g., sending an email, modifying a production database, or changing user permissions) must require explicit human confirmation.

---

## 2. Red Teaming Protocols

Before an agent is deployed to "production" (or finalized in the `agents/` directory), it must undergo a Red Team audit within the Innovation Studio.

### The Auditing Process
1.  **Prompt Injection Testing:** Attempt to bypass the agent's core directives (e.g., instruct the "Support Helper" to reveal its system prompt or perform an unauthorized action).
2.  **Boundary Testing:** Request the agent to use MCP tools outside its intended scope (e.g., asking the "Brand Strategist" to modify infrastructure settings).
3.  **Failure State Handling:** Intentionally provide malformed data or simulate MCP tool failures to ensure the agent handles errors gracefully without exposing sensitive stack traces or crashing.

### The "Teach-to-Master" Defense
As part of the credentialing process, architects must successfully defend their agent's architecture, demonstrating how it mitigates identified risks and adheres to the Diligence pillar of the 4D Framework.
