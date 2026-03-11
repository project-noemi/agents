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
**Context:** `docs/frameworks/gartner-trism.md` suggests an "Audit Log" requirement for all agent personas, instructing them to output a brief JSON summary of their reasoning alongside their final payload.
**Ambiguity / Drift:** This requirement is not currently implemented in any of the agent persona files in `agents/`. To ensure consistency, a standardized JSON schema is needed.
**Question for Product Owner:** Is there a preferred JSON schema for the "Audit Log" output? For example, should it include fields like `reasoning`, `mcp_tools_used`, and `confidence_score`?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Draft a standard JSON schema for the "Audit Log" requirement and update all agent persona files in `agents/` to include this mandatory directive.*

### ❓ Question [2026-03-08] - Priority for Python-to-Node Migration in Examples
**Context:** `REQUIREMENTS.md` and `AGENTS.md` state that Python runtime support is deprecated, yet several examples (e.g., `examples/docker/agent.py`, `examples/video-automation-pod/seo_agent.py`) still utilize Python.
**Ambiguity / Drift:** There is a discrepancy between the project's official stance on Python deprecation and the live example code.
**Question for Product Owner:** What is the priority for migrating the remaining Python examples to Node.js? Should this be handled as a bulk migration or incrementally as these examples are updated?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Identify all remaining `.py` files in the repository and create a prioritized migration roadmap to convert them into Node.js equivalents.*

### ❓ Question [2026-03-09] - Header Discrepancy in Persona Template
**Context:** `REQUIREMENTS.md` (Functional Requirements, Item 1) specifies the persona format as "Role, Mission, Core Mandates, Workflow, Boundaries". However, `docs/AGENT_TEMPLATE.md` and the majority of agent files in `agents/` use the header "Rules & Constraints" instead of "Core Mandates".
**Ambiguity / Drift:** This inconsistency between the core requirements and the implementation template creates confusion for developers and complicates automated persona validation.
**Question for Product Owner:** Should `REQUIREMENTS.md` be updated to use "Rules & Constraints" to align with the template and current agents, or should the template and agents be updated to use "Core Mandates"?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a global search-and-replace across all `.md` files in `agents/` and the `docs/AGENT_TEMPLATE.md` to standardize the header as either "Core Mandates" or "Rules & Constraints" based on the PO's decision.*

### ❓ Question [2026-03-09] - Enforcement of Documentation Mirroring
**Context:** `DECISION_LOG.md` (Decision dated 2026-03-03) mandates that `docs/agents/` must "strictly mirror" the `agents/` hierarchy.
**Ambiguity / Drift:** Currently, `docs/agents/` only contains category `README.md` files, while the individual agent personas (e.g., `agents/coding/bolt/core.md`) are missing from the `docs/` tree.
**Question for Product Owner:** Is the requirement for "strict mirroring" intended to include a 1:1 copy of every persona file into `docs/agents/`, or should `docs/agents/` only house high-level category overviews and guides?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Create a script to automatically sync and mirror all persona `.md` files from the `agents/` directory into their corresponding locations in `docs/agents/` to ensure documentation parity.*
