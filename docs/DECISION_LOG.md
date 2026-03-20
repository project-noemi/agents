# Decision Log

## [2026-03-20] - Phase 2 Documentation Audit & Technical Drift Remediation
- **Decision**: Verified and documented specific technical drifts in security policy, localization, and modular context generation.
- **Context**: Doc persona workflow required a deep-dive analysis of the codebase to identify discrepancies between the mandated "Fetch-on-Demand" architecture and live examples.
- **Impact**:
    - **Security Policy Audit**: Confirmed a Phase 0 security breach in `examples/video-automation-pod/dropbox_watcher.py` (explicit use of `load_dotenv()`). Logged remediation requirement in `CLARIFICATIONS.md`.
    - **Localization Drift**: Identified 6 n8n workflow files in `docs/n8n workflows/` using Hungarian naming conventions. Standardized English-first slug requirement added to `CLARIFICATIONS.md`.
    - **Context Generation Verification**: Confirmed that `scripts/generate_gemini.js` still fails to inject "Execution Patterns" and "Coding Standards" from `AGENTS.md`.
    - **Persona Audit**: Verified that "External Tooling Dependencies" and the mandatory "Audit Log" JSON reasoning sections remain missing from all 18 agent personas in `agents/`.
    - **Environment Validation**: Confirmed that `scripts/verify-env.sh` lacks mandatory SecretOps CLI checks (Infisical/1Password).

## [2026-03-19] - Documentation Audit and Technical Gate Formalization
- **Decision**: Formalized the technical gates of the 4D Framework and documented environment-specific routing requirements.
- **Context**: Phase 2 Doc workflow required clarifying the specific roles and gates used during the GMU Boot Camp and identifying drift in the video automation examples.
- **Impact**:
    - **4D Framework Gates**: Updated `REQUIREMENTS.md` to include mandatory gates: Acceptance Criteria (Delegation), Data Inventory (Description), and TRiSM Assessment (Discernment).
    - **Fleet Routing Standards**: Formally documented the use of Traefik labels and host-based routing for multi-tenant fleet deployments.
    - **Security Policy Breach**: Identified and documented a Phase 0 security breach in `video-automation-pod/dropbox_watcher.py` (use of `load_dotenv()` instead of Fetch-on-Demand).
    - **Persona Standard Alignment**: Updated `AGENTS.md` to align the persona header requirement with the "Rules & Constraints" decision from 2026-03-12.
    - **Workflow Localization Drift**: Identified localization drift in `docs/n8n workflows/` and flagged the need for a standardized naming convention.

## [2026-03-17] - Documentation Audit and Verification Update
- **Decision**: Conducted a whole-codebase audit to verify implementation of "Verification Bots" and persona standardization.
- **Context**: Phase 2 Doc workflow required confirming if `verification-bot.js` fulfilled the academic credentialing requirement.
- **Impact**:
    - **Verification Bot**: Formally verified that `examples/gmu-validation/verification-bot.js` implements the mandatory "Feynman Requirement" audit logic. Updated `REQUIREMENTS.md`.
    - **System Dependencies**: Identified that `scripts/verify-env.sh` and `.ps1` are currently missing mandated SecretOps CLI checks. Documented as [PENDING] implementation.
    - **Drift Identification**: Confirmed that `scripts/generate_gemini.js` remains inconsistent with `AGENTS.md` by ignoring "Execution Patterns" and "Coding Standards".

## [2026-03-16] - Documentation Audit and technical Debt Identification
- **Decision**: Conducted a holistic scan of the codebase to identify technical debt in modular context generation and persona standardization.
- **Context**: Phase 2 Doc workflow requires identifying drift between code and requirements.
- **Impact**:
    - **Context Generation Drift**: Identified that `scripts/generate_gemini.js` ignores "Execution Patterns" and "Coding Standards" from `AGENTS.md`. Documented as drift in `REQUIREMENTS.md`.
    - **Persona Standardization**: Confirmed `docs/AGENT_TEMPLATE.md` incorrectly labels "External Tooling Dependencies" as optional.
    - **4D Framework Alignment**: Identified inconsistent application of the 4D framework across the persona library (predominantly "Diligence").
    - **Mirror Verification**: Re-verified that `docs/agents/` strictly mirrors `agents/` via symbolic links.

## [2026-03-14] - Documentation Audit and Requirement Verification
- **Decision**: Verified implementation status of persona mirroring and documented SecretOps validation gaps.
- **Context**: Phase 2 Doc workflow requires continuous cross-referencing against the codebase.
- **Impact**:
    - **Persona Mirroring**: Verified that all 18 agent personas in `agents/` are successfully mirrored to `docs/agents/` using symbolic links. Removed `[PENDING]` status from `REQUIREMENTS.md`.
    - **SecretOps Verification**: Confirmed that `scripts/verify-env.sh` still lacks mandatory SecretOps CLI checks (Infisical/1Password). Updated `REQUIREMENTS.md` with specific implementation debt.
    - **Audit Log Status**: Confirmed that the "Audit Log" requirement remains unimplemented across the persona library.

## [2026-03-12] - Codebase Audit and Requirement Alignment
- **Decision**: Conducted a Phase 2 holistic scan of the codebase to align documentation with reality and resolve persona template discrepancies.
- **Context**: Discovered through automated audit that all 18 agent personas use "Rules & Constraints" instead of "Core Mandates," and that mirroring between `agents/` and `docs/agents/` is actually complete.
- **Impact**:
    - **Requirement Alignment**: Updated `REQUIREMENTS.md` and `AGENTS.md` to formally recognize "Rules & Constraints" as the standard persona header, resolving a recurring ambiguity.
    - **Mirroring Verification**: Confirmed that persona file mirroring to `docs/agents/` is complete, removing the associated `[PENDING]` marker.
    - **Python Debt Tracking**: Quantified the Python deprecation debt to exactly 6 files to provide better visibility for the migration roadmap.
    - **ROI Status**: Updated requirements to reflect the existing implementation of the `roi-auditor` agent persona.
    - **Clarifications**: Consolidated existing questions and added a new high-priority question regarding the bulk addition of missing mandatory sections (External Tooling Dependencies).

## [2026-03-15] - Documentation Audit and MCP Configuration Drift Analysis
- **Decision**: Verified documentation mirroring and identified drift in MCP configuration requirements.
- **Context**: Phase 2 Doc workflow requires identifying technical debt and documentation drift.
- **Impact**:
    - **Mirroring Verification**: Confirmed that `docs/agents/` strictly mirrors `agents/` via symbolic links, fulfilling the 2026-03-03 mandate. Removed related `[PENDING]` marker from `REQUIREMENTS.md`.
    - **MCP Configuration Drift**: Identified that `agents/guardian/roi-auditor.md` requires a `logging-mcp` (or webhook) which is currently absent from `mcp.config.json`.
    - **SecretOps Pre-flight Gap**: Documented the absence of SecretOps CLI (Infisical/1Password) verification in `scripts/verify-env.sh`.
    - **Persona Inconsistencies**: Re-confirmed that "External Tooling Dependencies" are missing from all persona files and "Rules & Constraints" remains the dominant header over "Core Mandates".
    - **Clarifications**: Drafted 2 new high-priority questions in `CLARIFICATIONS.md` regarding MCP drift and retry logic standards.

## [2026-03-10] - Documentation Audit and Pre-Flight Gap Identification
- **Decision**: Conducted a follow-up holistic scan focusing on environment setup and toolchain dependencies.
- **Context**: Phase 2 Doc workflow requires continuous identification of drift. Discovered that mandatory SecretOps patterns in `AGENTS.md` are not validated by pre-flight scripts.
- **Impact**:
    - **SecretOps Verification**: Identified that `scripts/verify-env.sh` and `verify-env.ps1` lack checks for Infisical and 1Password CLIs. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Undocumented Dependency**: Noted that `gemini` CLI is a required but undocumented dependency. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **ROI Link Gap**: Confirmed `tools/roi/README.md` contains placeholder links. Flagged as `[PENDING]` in `REQUIREMENTS.md`.
    - **Clarifications**: Drafted 3 new high-priority questions in `CLARIFICATIONS.md`.

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
