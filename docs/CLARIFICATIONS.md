# Pending Clarifications

<!-- Add new questions below this line using the required format -->

### ❓ Question [2026-03-03] - Python Runtime Dependency Contradiction
**Context:** The `REQUIREMENTS.md` explicitly states that "Python runtime support is officially deprecated," yet the `scripts/verify-env.sh` pre-flight check still mandates the presence of `python3` (line 19).
**Ambiguity / Drift:** This creates confusion for new users and automated CI/CD pipelines. It is unclear if Python is required for specific examples or if the pre-flight check is simply outdated.
**Question for Product Owner:** Should the `python3` check be removed from `verify-env.sh`, or are there specific components (e.g., in `examples/`) that still strictly require a Python environment?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *[If Python is truly deprecated, please command me to remove the `python3` check from `scripts/verify-env.sh` and `verify-env.ps1` to align with the core requirements.]*

### ❓ Question [2026-03-03] - Missing Casdoor Integration in Fleet Deployment
**Context:** The `REQUIREMENTS.md` (Strategic Alignment, Item 4) specifies that Fleet Deployment infrastructure requires "Casdoor (identity)" as part of the multi-tenant stack. However, `examples/fleet-deployment/docker-compose.yml` does not implement a Casdoor service.
**Ambiguity / Drift:** The core requirement for identity management is documented but not present in the provided reference architecture, preventing a complete "Fleet" demonstration.
**Question for Product Owner:** Is there a preferred Casdoor configuration or Docker image we should use to complete this example, or is identity management currently being handled by another component not shown in the compose file?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *[Please provide the Casdoor configuration details so I can update `examples/fleet-deployment/docker-compose.yml` to satisfy the Strategic Alignment requirement for identity management.]*

### ❓ Question [2026-03-03] - Status of ROI Calculator Scripts
**Context:** `REQUIREMENTS.md` states the toolkit must include "Python/Excel-based ROI calculator scripts" (Strategic Alignment, Item 5). These files are not present in the repository.
**Ambiguity / Drift:** A high-priority "Feynman Requirement" for automated validation and ROI modeling is documented as a core deliverable but has no implementation or placeholder.
**Question for Product Owner:** Are the ROI calculator scripts intended to be part of this repository, and if so, can you provide the logic or templates that should be implemented?
**Answer:** [LEAVE BLANK FOR HUMAN TO FILL]
**🤖 Jules Action Prompt:** *[Once the ROI logic is clarified, please command me to create the missing ROI calculator scripts in a new `tools/roi/` directory as specified in the strategic alignment.]*
