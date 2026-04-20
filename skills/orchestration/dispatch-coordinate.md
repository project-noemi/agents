# Dispatch & Coordinate — Orchestration Skill

## Purpose
Delegate work to one or more sub-agents and aggregate their outputs into a unified result. This skill standardizes the pattern used by coordinator agents (like Video Content Manager) that decompose a task, dispatch it to specialists, monitor for cross-agent consistency, and compile the final deliverable.

## Inputs
- **task_context** — Shared context document that all sub-agents need (e.g., project brief, source material analysis)
- **dispatches** — List of sub-agent assignments, each with:
  - `agent` — Path to the agent spec (e.g., `agents/marketing/seo-strategist.md`)
  - `task` — Specific instructions for this sub-agent
  - `depends_on` — Optional list of other dispatch IDs whose output this agent needs
- **consistency_checks** — Optional list of cross-agent validation rules (e.g., "thumbnail hook text must align with title")

## Procedure
1. **Prepare shared context** — Compile the task_context document that all sub-agents will receive.
2. **Resolve dependencies** — Determine execution order from `depends_on` declarations. Independent dispatches can run in parallel.
3. **Dispatch** — For each sub-agent (in dependency order):
   a. Load the agent spec to understand its Role, Tone, and expected Output Format.
   b. Provide the shared context + agent-specific task instructions.
   c. If the agent depends on prior outputs, include those in the task instructions.
   d. Collect the sub-agent's output.
4. **Validate consistency** — Run each consistency check across the collected outputs. Flag conflicts.
5. **Aggregate** — Compile all sub-agent outputs into a unified deliverable, organized by agent contribution.
6. **Return** — Provide the aggregated result with consistency check outcomes.

## Outputs
- **deliverable** — Unified output combining all sub-agent contributions
- **agent_outputs** — Individual outputs keyed by agent ID (for traceability)
- **consistency_results** — Pass/fail for each consistency check
- **conflicts** — List of cross-agent inconsistencies requiring human resolution

```json
{
  "deliverable": { "titles": [...], "thumbnails": [...], "description": "..." },
  "agent_outputs": {
    "seo-strategist": { "titles": [...], "tags": [...] },
    "thumbnail-specialist": { "variants": [...] }
  },
  "consistency_results": [
    { "check": "Title-thumbnail hook alignment", "status": "pass" }
  ],
  "conflicts": []
}
```


## Rules & Constraints (4D Diligence)
1. **Atomic Logic:** This skill must perform exactly one logical task.
2. **Standard Output:** Always return data in the mandated structured format.
3. **Safety Gating:** Adhere to all defined Boundaries and never exceed authorized tool usage.
## Boundaries
- **Always:** Provide the shared context to every sub-agent. Validate consistency before returning the final deliverable. Preserve individual agent outputs for traceability.
- **Ask First:** Overriding a sub-agent's output to resolve a conflict. Re-dispatching to a sub-agent after a consistency failure.
- **Never:** Modify a sub-agent's output without flagging it. Dispatch to an agent spec that doesn't exist. Skip consistency checks.

## Audit Log
{
  "task": "...",
  "inputs": [],
  "actions": [],
  "risks": [],
  "result": "..."
}
