# Pending Clarifications

<!-- Add new questions below this line using the required format -->

### Question 2026-03-03 - Implementation of Casdoor in Fleet Deployment
*   **Context:** `REQUIREMENTS.md` lists Casdoor as a required component for the multi-tenant "Fleet" stack to handle identity. However, `examples/fleet-deployment/docker-compose.yml` does not include a Casdoor service.
*   **Ambiguity:** The example stack is currently incomplete regarding the identity and access management requirements for multi-tenancy.
*   **Question:** Is there a preferred configuration or Docker image for Casdoor that should be integrated into the fleet-deployment example, or is this implementation deferred?
*   **Answer:** [WRITE YOUR ANSWER HERE]

### Question 2026-03-03 - Location and Format of ROI Calculators
*   **Context:** `REQUIREMENTS.md` specifies that the toolkit must include "Python/Excel-based ROI calculator scripts" as part of the Feynman Requirement for automated validation.
*   **Ambiguity:** These scripts are missing from the repository, and their intended location (e.g., `scripts/` or a new `tools/` directory) is not defined.
*   **Question:** Where should the ROI calculator scripts be located, and are there specific metrics or formulas that must be included in the initial version?
*   **Answer:** [WRITE YOUR ANSWER HERE]

### Question 2026-03-03 - Automated Injection of AGENTS.md Mandates
*   **Context:** A previous clarification (2026-02-26) confirmed that global security mandates from `AGENTS.md` should be injected into `GEMINI.md`. The current `scripts/generate_gemini.js` only handles MCP injections.
*   **Ambiguity:** There is a functional gap between the requirement to provide agents with global security context and the automated assembly script.
*   **Question:** Should `scripts/generate_gemini.js` be updated to automatically prepend the contents of `AGENTS.md` to the generated `GEMINI.md`, or should a new placeholder be added to `GEMINI.template.md` for this purpose?
*   **Answer:** [WRITE YOUR ANSWER HERE]
