# AI TRiSM Alignment in Project NoéMI

## Overview

Project NoéMI maps its governance to AI TRiSM (AI trust, risk and security management), a framework defined by Gartner®, Inc. AI TRiSM provides a structured approach to managing the unique risks of non-deterministic systems, ensuring model governance, fairness, reliability, and robust data protection.

> Attribution: AI TRiSM (AI trust, risk and security management) is a framework defined by Gartner, Inc. Gartner® is a registered trademark and service mark of Gartner, Inc. and/or its affiliates in the U.S. and internationally.

This document maps five governance themes that NoéMI derives from the AI TRiSM framework to specific elements, practices, and examples within the Project NoéMI repository.

---

## Theme 1: Explainability / Interpretability

**NoéMI working definition:** Ensuring that AI decisions can be understood, traced, and audited by humans.

**Application in Project NoéMI:**
*   **The 4D Framework - *Description*:** Project NoéMI enforces strict "Process Description" (chain of reasoning) in prompt templates (`docs/lifecycle/DESCRIPTION.md`). By requiring agents to outline their logical steps before taking action, we create a transparent audit trail of their decision-making process.
*   **Agent Persona Structure:** The standard persona template (`Mission, Core Mandates, Workflow, Boundaries`) explicitly defines the agent's expected behavior, making it easier for human operators (Accelerators) to interpret why an agent took a specific path.
*   **Actionable Next Step:** Implement a standard "Audit Log" requirement in all agent personas, instructing them to output a brief JSON summary of their reasoning alongside their final payload.

## Theme 2: ModelOps

**NoéMI working definition:** Managing the entire lifecycle of an AI model/agent—from development and deployment to monitoring and retirement—to ensure consistent performance and governance.

**Application in Project NoéMI:**
*   **The 4D Framework - *Diligence*:** The `docs/lifecycle/DILIGENCE.md` document covers "Deployment Diligence," including CI/CD integration, rollback procedures, and the transition from prototype ("Walled Garden") to production ("Deep Integration").
*   **Fleet Deployment Infrastructure:** The multi-tenant `docker-compose.yml` (`examples/fleet-deployment/`) provides the standardized infrastructure required to deploy, scale, and monitor multiple agent cohorts consistently.
*   **Configuration as Code:** Utilizing `mcp.config.json` and `.env.template` ensures that agent context and permissions are version-controlled and reproducible across environments.

## Theme 3: Data Anomaly Detection

**NoéMI working definition:** Continuously monitoring for unexpected failures, "data drift," or poisoned inputs that could compromise the model's accuracy.

**Application in Project NoéMI:**
*   **The Guardian Layer (Discernment):** Guardian Agents, such as `PIIGuard` (`agents/guardian/pii-guard.md`), act as the first line of defense against data anomalies. They inspect incoming and outgoing payloads to ensure they match expected classifications (Public, Internal, Confidential).
*   **Red Teaming:** The `examples/red-team-gauntlet/` provides specific test cases to simulate poisoned data (e.g., hidden instructions within seemingly normal text) to verify that the agents can detect and handle anomalous inputs gracefully.

## Theme 4: Adversarial Attack Resistance

**NoéMI working definition:** Implementing defenses against malicious attempts to deceive or manipulate AI models (e.g., prompt injection).

**Application in Project NoéMI:**
*   **PromptShield Agent:** The `prompt-shield.md` Guardian Agent is explicitly designed to detect and block adversarial patterns like "Ignore all previous instructions" or "Developer Mode" overrides.
*   **The Airgap Pattern:** Documented in `docs/agents/guardian/README.md`, this architectural pattern requires all user input to pass through a defensive Guardian Agent *before* reaching the primary execution agent, neutralizing prompt injections before they can be executed.
*   **Red Team Gauntlet:** The prompt injection test cases in the Red Team examples ensure these defenses are continuously validated.

## Theme 5: Data Protection / Privacy

**NoéMI working definition:** Ensuring that AI systems comply with data privacy regulations and that sensitive information is not leaked.

**Application in Project NoéMI:**
*   **Phase 0 Security (Fetch-on-Demand):** As detailed in `docs/tool-usages/secure-secret-management.md`, Project NoéMI uses an Environment Injection CLI (e.g., Infisical) to inject secrets directly into process memory, ensuring API keys and database credentials are never exposed in the LLM's context window or written to disk.
*   **The Refusal Principle (Delegation):** The `DELEGATION.md` guide emphasizes "Data Perimeter" classification, teaching operators to flag PII and confidential data *before* it touches an external LLM.
*   **PIIGuard Agent:** Actively scans for and redacts sensitive information (like SSNs or credit card numbers) from payloads before they cross the network boundary.
