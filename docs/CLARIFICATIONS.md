# Pending Clarifications

<!-- Add new questions below this line using the required format -->

### Question 2026-03-01 - Missing ROI Calculator Scripts
*   **Context:** `REQUIREMENTS.md` Strategic Alignment #5 specifies that the toolkit must include "Python/Excel-based ROI calculator scripts to ensure agents deliver measurable business value before deployment."
*   **Ambiguity:** These scripts are not present in the repository, although they are listed as a core pedagogical requirement.
*   **Question:** Are these ROI calculator scripts being developed in a separate repository, or should they be implemented within the `scripts/` or `examples/` directory of this repository?
*   **Answer:** [WRITE YOUR ANSWER HERE]

### Question 2026-03-01 - Implementation of Casdoor in Fleet Deployment
*   **Context:** `REQUIREMENTS.md` Strategic Alignment #4 lists "Casdoor (identity)" as a required component for the fleet-ready orchestration infrastructure. However, the current `examples/fleet-deployment/docker-compose.yml` only includes Traefik, Loki, Grafana, and n8n instances.
*   **Ambiguity:** There is a gap between the documented multi-tenant infrastructure requirement and the provided implementation example.
*   **Question:** Is the addition of Casdoor to the `fleet-deployment` example planned for a near-term update, or is identity management currently considered out of scope for the public repository?
*   **Answer:** [WRITE YOUR ANSWER HERE]

### Question 2026-03-01 - Automated AGENTS.md Mandate Injection
*   **Context:** Updated requirements in `REQUIREMENTS.md` specify that the context generation mechanism must "automatically inject global security mandates and execution patterns defined in AGENTS.md." The current `scripts/generate_gemini.js` only handles modular MCP protocol injections.
*   **Ambiguity:** The current script implementation does not meet the security requirement of ensuring agents are always aware of global mandates.
*   **Question:** Should `scripts/generate_gemini.js` be updated to automatically prepend the content of `AGENTS.md` to the `GEMINI.md` file, or is there a preferred method for ensuring this global context is included?
*   **Answer:** [WRITE YOUR ANSWER HERE]
