# {Name} — {Category} Skill

<!-- H1 format: # {Name} — {Category} Skill
     Examples: # Risk Triage — Classification Skill, # Pre-Flight Check — Verification Skill -->

## Purpose
<!-- Required. One-paragraph description of what this skill does and why it exists
     as a reusable component rather than embedded in a single agent. -->

## Inputs
<!-- Required. What the skill expects to receive from the calling agent.
     Use a bulleted list with types and descriptions. -->

## Procedure
<!-- Required. The step-by-step process the skill executes.
     Use numbered steps. Each step should be atomic and testable.
     Reference MCP protocols by name where applicable (e.g., "via `slack` MCP"). -->

## Outputs
<!-- Required. What the skill returns to the calling agent.
     Use a bulleted list with types and descriptions.
     Include structured output format (JSON/YAML) where applicable. -->

## MCP Dependencies
<!-- Optional. List MCP protocols this skill requires.
     Omit if the skill is tool-agnostic. -->


## Rules & Constraints (4D Diligence)
1. **Atomic Logic:** This skill must perform exactly one logical task.
2. **Standard Output:** Always return data in the mandated structured format.
3. **Safety Gating:** Adhere to all defined Boundaries and never exceed authorized tool usage.
## Boundaries
<!-- Required. Safety constraints for this skill.
     Use the Always / Ask First / Never trichotomy. -->


## Audit Log
{
  "task": "...",
  "inputs": [],
  "actions": [],
  "risks": [],
  "result": "..."
}
## Examples
<!-- Optional. One or two concrete examples showing the skill in use,
     including sample inputs and expected outputs. -->
