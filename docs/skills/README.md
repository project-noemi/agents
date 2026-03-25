# Skills Documentation

Skills are **reusable task definitions** that agents compose into their workflows. They represent the "what" layer in the NoéMI architecture:

```
Agents (who)  →  compose  →  Skills (what)  →  use  →  MCP Protocols (how)
```

## Skill Categories

| Category | Skills | Purpose |
|----------|--------|---------|
| [Classification](classification/) | Risk Triage | Multi-tier categorization (Safe / Needs Review / Blocked) |
| [Verification](verification/) | Pre-Flight Check, Cross-Reference | Validate preconditions; verify claims against source of truth |
| [Reporting](reporting/) | Structured Report, Alert & Notify | Standardized report generation; Slack/email delivery |
| [Security](security/) | HMAC Sign & Submit, PII Scan | Cryptographic payload signing; data privacy scanning |
| [Orchestration](orchestration/) | Dispatch & Coordinate | Sub-agent delegation and output aggregation |

## How Skills Work

1. An agent's **Workflow** section references a skill with `**Skill:** \`category/name\``
2. The orchestrator loads the skill spec from `skills/category/name.md`
3. The skill's **Procedure** is followed using the agent's context as input
4. The skill's **Outputs** are returned to the agent's workflow for the next step
5. The skill's **Boundaries** apply in addition to the agent's own boundaries

## Creating a New Skill

1. Copy [`skills/SKILL_TEMPLATE.md`](../../skills/SKILL_TEMPLATE.md) as a starting point
2. Place the spec in `skills/{category}/{name}.md`
3. Create matching documentation in `docs/skills/{category}/`
4. Add the skill path to `active_skills` in `mcp.config.json`
5. Regenerate context files: `node scripts/generate_all.js`
6. Reference the skill in agent Workflow sections

## When to Extract a Skill

Extract a workflow step into a skill when:
- **3+ agents** duplicate the same procedural logic
- The step is **agent-agnostic** — it works the same regardless of which agent calls it
- The step has **clear inputs and outputs** that can be standardized
- The step has **its own safety boundaries** worth enforcing consistently

Do **not** extract a skill when:
- The logic is specific to a single agent's domain
- The step is trivial (fewer than 3 substeps)
- Extracting it would obscure the agent's workflow rather than clarify it
