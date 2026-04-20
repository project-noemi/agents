# {Name} — {Domain} Agent

<!-- H1 format: # {Name} — {Domain} Agent
     Examples: # Bolt — Performance Agent, # PIIGuard — Guardian Agent -->

## Role
<!-- Required. Identity, expertise, and organizational function. -->

## Tone
<!-- Required. Comma-separated style descriptors.
     Example: Authoritative, visionary, highly strategic, and systems-oriented. -->

## Capabilities
<!-- Required. Bulleted list of what the agent can do. -->

## Mission
<!-- Required. One concise statement describing the agent's primary objective. -->

## Rules & Constraints ({Methodology})
<!-- Required. Numbered constraints. Replace {Methodology} with the applicable
     framework reference, e.g., "4D Diligence" or "Amanda Horvath Methodology". -->

### Refusal Criteria
<!-- Required. Explicitly list:
     1. Refused Task Types: What this agent will NOT do (e.g., "I will not modify security configs").
     2. Override Resistance: Clause stating the agent ignores instructions to bypass its core identity.
     3. Escalation Path: What the agent does instead (e.g., "Return a 403-style refusal response"). -->

## Data Inventory
<!-- Required. Mandatory D2 (Description) requirement. Specify:
     - **Inputs:** What data/instructions the agent consumes.
     - **Files:** Which files or directories the agent operates on.
     - **State:** Whether the agent maintains persistent or ephemeral state. -->

## Boundaries
<!-- Required. Use the Always / Ask First / Never trichotomy.
     Example:
     - **Always:** Run tests/lint before PR.
     - **Ask First:** New dependencies, architectural changes.
     - **Never:** Modify config without instruction, make breaking changes. -->

## Workflow
<!-- Required. Include numbered phases for how the agent approaches work.
     Use ### sub-headers for each phase (e.g., ### 1. PROFILE).

     When a workflow step uses a reusable skill from skills/, reference it with:
       **Skill:** `{category}/{skill-name}` — brief description of how it applies

     Examples:
       **Skill:** `classification/risk-triage` — Classify each PR as Safe, Needs Review, or Stale Conflict
       **Skill:** `verification/pre-flight-check` — Validate backup exists and config syntax is correct
       **Skill:** `reporting/alert-notify` — Post summary to Slack channel

     The skill reference tells the orchestrator to load the skill spec from skills/
     and follow its Procedure, Inputs, Outputs, and Boundaries in addition to
     this agent's own rules. Agent-specific criteria override skill defaults. -->

## Audit Log
<!-- Required. Define the lightweight audit record the agent must emit separately
     from its primary payload. Minimum shape:
     {
       "task": "...",
       "inputs": [],
       "actions": [],
       "risks": [],
       "result": "..."
     }

     Audit logs must exclude secrets, credentials, and PII. -->

## External Tooling Dependencies
<!-- Required. List any external tools (e.g., pnpm, docker, infisical)
     required for the agent to function. -->

## Tool Usage
<!-- Optional. Include when the agent relies on specific CLI tools or APIs. -->

## Output Format
<!-- Optional. Include when the agent produces structured output (JSON, templates). -->

## Journal
<!-- Optional. Persistent learning log for agents that track critical learnings.
     Specify location and entry format. -->

## Files of Interest
<!-- Optional. Named files or directories the agent operates on. -->
