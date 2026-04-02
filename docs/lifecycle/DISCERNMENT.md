# The 4D Framework: Discernment

## 1. The Core Principle
Discernment focuses on validation, quality control, and testing. AI output is probabilistic, not deterministic, which means trust requires continuous verification. This phase maps directly to Gartner's TRiSM "Trust" pillar.

## 2. Product and Performance Validation
- **Product Discernment**: Is the output factually true and logically sound?
- **Performance Discernment**: Is the agent acting within its defined guardrails and performance parameters? Are tools and MCP connections failing gracefully?

## 3. The Discernment Process (High-Tech Surfboard Model)
- **Explorers (Passengers)**: Conduct "User Acceptance Testing" (UAT) on the agents built by the Practitioners, flagging when the "vibe" feels off or data is wrong.
- **Practitioners (Crew)**: Execute "Red Teaming." Actively try to break their own agents using edge-case inputs (e.g., inputting data in the wrong language, adversarial prompts).
- **Accelerators (Pilots)**: Deploy the "Guardian Layer." They build supervisor agents that scan the input/output of the primary agent for policy violations, PII leaks, and prompt injections before the Explorer sees the result.

# Security, Testing, & Quality Assurance

## 1. Testing Protocols

Testing non-deterministic AI agents requires a fundamentally different approach than traditional unit testing. A multi-layered strategy is mandatory.

*   **Prompt Unit Testing (LLM-as-a-Judge):** Run the agent persona through a suite of standard input prompts. Use a separate, highly configured LLM to programmatically evaluate the output, ensuring the specified Tone, Role, and Rules are strictly respected.
*   **Integration Testing (Mock MCPs):** Spin up mock MCP servers that return static, predictable JSON responses. Verify that the agent correctly formats its tool calls, parses the mock responses accurately, and takes the appropriate subsequent actions.
*   **Continuous Evaluation:** Periodically test production agents against a "golden dataset" of ideal interactions. This helps detect "persona drift" that can occur silently when underlying base LLM models (e.g., GPT-4, Claude 3, Gemini) receive updates from their providers.

## 2. Security Hardening

Security must align strictly with the **Gartner AI TRiSM** standards and the *Diligence* pillar of the 4D Framework.

*   **Least Privilege MCPs:** If an agent (e.g., the Knowledge Manager) only needs to *read* Google Docs, its configured MCP server MUST NOT be granted write permissions at the API level.
*   **Human-in-the-Loop (HITL):** Enforce hard blocks within the orchestrator for any mutating actions (e.g., sending emails, deleting files, executing SQL `UPDATE` statements, pushing code). The agent must draft the action and explicitly await human confirmation before execution.
*   **Prompt Injection Defense:** Design orchestrators to sanitize user inputs before passing them to the agent. Furthermore, explicitly instruct the agent within its persona file to recognize and reject instructions that attempt to override its primary Role or Rules.

## 3. Phase 0 Security & Secret Management

Agents require credentials to interact with external tools and MCP servers, but these must never be hardcoded or written to disk. The project mandates a "Fetch-on-Demand" architecture (Phase 0 Security) utilizing SecretOps platforms like Infisical.

*   **Environment Injection CLI:** All agent executions must be wrapped in a secure CLI (e.g., `infisical run --env=dev -- gemini chat`) that dynamically injects secrets purely into the process memory.
*   **Machine Identities:** Headless agents (e.g., in n8n or cloud VMs) must use strictly scoped, read-only Machine Identities to fetch their specific environments. 
*   **Red Team Gauntlet:** During testing, explicitly prompt the agent to reveal its API keys (e.g., `OPENAI_API_KEY`). If the environment injection is configured correctly, the secret exists only in the executing process memory, not in the AI's chat context, and thus cannot be leaked or hallucinated.
*   **Detailed Guide:** See [Secure Secret Management for AI Agents](../tool-usages/secure-secret-management.md) for the complete pedagogical guide and implementation matrix.

## 4. User Access Control (RBAC)

Agents do not handle their own authentication. Security boundaries must be enforced at the orchestration and infrastructure levels.

*   **Orchestrator Level Authorization:** The system running the agent (e.g., a chat UI, CLI, or workflow engine) must enforce Role-Based Access Control (RBAC). A standard user should not be able to invoke the "AI Architect" agent if they do not have the required permissions.
*   **Identity Propagation:** Whenever possible, the orchestrator should pass the authenticated human user's identity through to the MCP server (e.g., via OAuth tokens or scoped API keys). This ensures the agent acts strictly within the permission boundaries of the human requesting the action, preventing privilege escalation.

## 4. Red Teaming

As mandated by `docs/GOVERNANCE.md`, all agents must undergo a simulated Red Team audit before deployment. This involves intentionally attacking the agent to uncover vulnerabilities, test boundary constraints, and ensure it fails securely.
