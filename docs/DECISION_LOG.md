# Decision Log

## [2026-03-09] - Documentation Audit and Gap Identification
- **Decision**: Conducted a holistic scan of the codebase to identify drifts between implemented code and documented requirements.
- **Context**: Phase 2 Doc workflow requires identifying technical debt and documentation drift.
- **Impact**:
    - **Persona Documentation Mirroring**: Identified that individual persona files in `agents/` are not mirrored in `docs/agents/`. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Template Header Inconsistency**: Discovered widespread use of "Rules & Constraints" instead of the standardized "Core Mandates" in persona files. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Missing External Tooling Dependencies**: Confirmed that no persona files currently document their required external tools. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Audit Log Schema**: Identified that the mandatory "Audit Log" requirement is currently unimplemented. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Python Migration**: Verified presence of deprecated Python scripts in `examples/`. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Clarifications**: Generated 3 new high-priority questions in `CLARIFICATIONS.md` to resolve these gaps.

## [2026-03-08] - Documentation Audit and Requirement Consolidation
- **Decision**: Consolidated implemented features (4D Framework, Guardian Layer, Fleet Infrastructure, ROI Methodology, Casdoor integration) into core requirements in `REQUIREMENTS.md`.
- **Context**: Doc workflow requires identifying drift between code and requirements. The repository has successfully implemented several items previously listed as "Future Enhancements."
- **Impact**:
    - **4D Framework**: Formally adopted as the mandatory development methodology.
    - **Guardian Layer**: Elevated to a core functional requirement.
    - **Fleet Infrastructure**: Standardized multi-tenant deployment templates.
    - **ROI Modeling**: Formally integrated the labor-cost-avoidance methodology.
    - **Python Status**: Clarified that legacy Python scripts in `examples/` are deprecated and slated for conversion.
    - **Strategic Alignment**: Added "Persona Standards Audit" and "Kubernetes Support" as new future enhancements.

## [2026-03-03] - Human Feedback Integration and Phase 1 Cleanup
- **Decision**: Integrated 17 resolved clarification questions into core documentation and archived the Q&A history.
- **Context**: Doc workflow requires processing all answered questions from `CLARIFICATIONS.md`.
- **Impact**:
    - **Branding**: Standardized "Project NoéMI" across all primary documentation.
    - **Persona Template**: Formally adopted "Role, Mission, Core Mandates, Workflow, Boundaries" for all specialized agents.
    - **Python Deprecation**: Removed Python runtime support; Node.js is the official environment for toolkit scripts.
    - **System Dependencies**: Git, Node.js, Docker, and Gemini CLI confirmed as core requirements for pre-flight and examples.
    - **Security & Secrets**: Updated `AGENTS.md` with explicit SecretOps patterns for Infisical and 1Password (Fetch-on-Demand).
    - **Error Handling**: Added mandatory directives for graceful degradation and exponential backoff.
    - **Fleet Deployment**: Mandated Casdoor as the identity management provider for multi-tenant stacks.
    - **ROI Modeling**: Standardized on a Google Sheets-based methodology, documented in `tools/roi/README.md`.
    - **Component Separation**: Clarified that "Support Helper" and "WHMCS MCP" are maintained in separate repositories.
    - **Stateless Execution**: Confirmed stateless model as the core architecture, with persistent memory (pgvector) as an optional enhancement.
    - **Execution Model**: Defined the repository as a definitions library for external orchestrators, not a standalone execution engine.
    - **Logging**: Standardized logging to `stdout`/`stderr` delegated to the orchestrator.
    - **Mirror Sync**: Mandated that `docs/agents/` must strictly mirror the `agents/` hierarchy.

## [2026-02-21] - Pivot to Standalone Agents and MCP
- **Decision**: The repository is strictly for standalone scripts and agents.
- **Context**: Removed PHP legacy code and pivoted to standalone agent definitions.
- **Impact**: REQUIREMENTS.md updated to remove WHMCS dependencies.

## [2026-02-15] - Project Direction Pivot
- **Decision**: The project is no longer being developed as a WHMCS Addon Module.
- **Context**: Removed support ticketing and API timeout requirements from initial scope.
