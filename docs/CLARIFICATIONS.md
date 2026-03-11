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

### ❓ Question [2026-03-09] - Enforcement of Persona Documentation Mirroring
**Context:** `REQUIREMENTS.md` (Core Objectives, Item 2) states that "Documentation strictly mirrors these directories in `docs/agents/`." and `DECISION_LOG.md` (2026-03-03) mentions "Mandated that `docs/agents/` must strictly mirror the `agents/` hierarchy."
**Ambiguity / Drift:** While the directory structure is mirrored, individual persona Markdown files (e.g., `agents/coding/bolt/core.md`) are missing their counterparts in `docs/agents/`. Only READMEs and a few select guides exist.
**Question for Product Owner:** Should every individual persona file in `agents/` be mirrored as a documentation file in `docs/agents/`, or is mirroring only required at the directory/README level?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Identify all missing persona documentation files in `docs/agents/` and create mirror Markdown files that provide a technical overview and usage guide for each corresponding persona in `agents/`.*

### ❓ Question [2026-03-09] - Persona Template Standardization (Core Mandates vs Rules & Constraints)
**Context:** `REQUIREMENTS.md` (Functional Requirements, Item 1) specifies the standard format as "Role, Mission, Core Mandates, Workflow, Boundaries."
**Ambiguity / Drift:** A majority of personas in the `agents/` directory (e.g., `ai-architect.md`, `brand-strategist.md`, `pii-guard.md`) utilize a "Rules & Constraints" header instead of "Core Mandates."
**Question for Product Owner:** Should all existing personas be updated to strictly use the "Core Mandates" header to align with the latest standard, or is "Rules & Constraints" considered an acceptable alias?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Perform a bulk update of all persona files in `agents/` to rename the "Rules & Constraints" section to "Core Mandates" for strict adherence to the standardized template.*

### ❓ Question [2026-03-09] - Missing "External Tooling Dependencies" in Personas
**Context:** `REQUIREMENTS.md` (Functional Requirements, Item 1) states that "Agents must also document any expected external tooling dependencies (e.g., pnpm, docker) in their persona files."
**Ambiguity / Drift:** None of the current persona files in the `agents/` directory contain an explicit "External Tooling Dependencies" section, which may lead to environment setup failures during orchestrator preparation.
**Question for Product Owner:** Should a new mandatory section "External Tooling Dependencies" be added to the persona template, and should existing personas be audited to populate it?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *Audit all persona files in `agents/` and add a mandatory "External Tooling Dependencies" section, documenting required tools like `npm`, `docker`, or specific MCP servers for each.*
