# Architecture — NoéMI Blueprint Compiler

Status: agreed in Session 1 (1 September 2026). Package-local. Not a fleet Decision Log entry yet.

## Pipeline

```
source  →  load  →  parse  →  validate  →  resolve  →  instantiate  →  supervise
                                                      └─ mock (Sprint 1)
                                                      └─ mastra agent (Sprint 3)
```

| Stage | Sprint | Notes |
|---|---|---|
| Load | 1 | File path only. HTTP + registry in Sprint 3. |
| Parse | 1 | Markdown ATX `##` headings → section map. Extract `**Skill:**` refs. |
| Validate | 1 | Required headings + Refusal Criteria. Fail closed. |
| Resolve | 3 | Map skill slugs to `skills/` or `skills-dist/`. MCP ids to `mcp-protocols/`. |
| Instantiate | 3 | Build a Mastra agent from IR. Sprint 1 returns a mock agent. |
| Supervise | 2–3 | Timeouts, fallback list, structured errors, stderr audit JSON. |

Studio (Sprint 4) and Arena (Sprint 5) sit on top of `supervise`.

## Intermediate representation

See `src/ir.js` and REQUIREMENTS.md §5. `id` is `{domain}/{name}` derived from path (`agents/coding/architect/core.md` → `coding/architect`) or from the H1.

## Provider policy

Configuration, not code. Sprint 1 ships only `mock`. Sprint 2 adds Gemini + Grok (xAI) behind Fetch-on-Demand env vars resolved by `infisical run` / `op run`. Never `dotenv`.

Fallback triggers later: timeout, 429 after backoff, 5xx, missing key. A mock-only environment must still complete `npm test`.

## Non-goals (Sprint 1–5)

- Replacing `coding-loop/` (that is how we *build*; this is what we *build*).
- Replacing `newpush-mastra-orchestration` (Slack/Datto chatbot).
- A design system for Studio.
- Inventing security primitives (Presidio, Casdoor, Infisical already exist).
- YAML-first schemas that do not match the live Markdown contract.
