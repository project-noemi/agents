# Grok Custom Agents — Gems And Custom GPT Equivalent

Grok has several hosted capabilities that serve the same core purposes as ChatGPT Custom GPTs and Gemini Gems: specialized, persistent assistants with custom instructions, personalities, and knowledge.

Use this guide when a cohort or client asks "does Grok have Gems / Custom GPTs?" or when you want to load a NoéMI persona onto grok.com without treating Grok as a new runtime or a new model baseline.

This is a **vendor-surface mapping**. It does not add Grok as a required beginner client, does not change the dual-track AI Model Baseline (Gemini 2.5 Flash cloud + DeepSeek/Llama sovereign), and does not generate a `GROK.md`. Generated context in this repository remains `GEMINI.md` and `CLAUDE.md`.

## What This Path Is

- hosted personas, projects, and reusable skills on [grok.com](https://grok.com) and the Grok apps
- a way to carry a NoéMI `agents/{domain}/{name}.md` spec into Grok's instruction budget
- complementary layers (agent + project + skill + optional Bot), not one feature that does everything

## What This Path Is Not

- not a replacement for n8n, Gemini CLI, Claude Code, Codex, or Grok Build as orchestrators
- not the beginner local-client path — that is [`grok-build-local-workspace.md`](grok-build-local-workspace.md) and [`../examples/zero-to-first-agent.md`](../examples/zero-to-first-agent.md)
- not a generated context file and not a public marketplace of one-click NoéMI agents
- not an excuse to paste vault secrets, OAuth tokens, or tenant data into agent instructions

For local, repository-adjacent Grok work (the analogue of Claude Code / Gemini CLI / Codex), use **Grok Build**. That is a different surface from grok.com Custom Agents. Install and operate it from [`grok-build-local-workspace.md`](grok-build-local-workspace.md).

## Feature Map

| Need | ChatGPT | Gemini | Grok |
| --- | --- | --- | --- |
| Named specialist persona | Custom GPT | Gem | **Custom Agents** ("Your Agents") |
| Persistent files + project instructions | Projects | Gem files / Gem instructions | **Projects / Workspaces** |
| Reusable workflow remembered across chats | GPT instructions / Actions | Gem instructions | **Skills** |
| Account-wide defaults | Custom instructions | Saved info / instructions | **Custom Instructions** |
| Always-on teammate with its own computer | (no direct equivalent on a standard plan) | (no direct equivalent) | **Grok Bot** (limited tiers) |

## Custom Agents ("Your Agents")

Closest parallel to creating a custom GPT or a Gem persona.

- Create a small number of named specialist agents (typically **up to four** slots per account).
- Give each a name, role/personality, and detailed instructions. Instruction space is tight — secondary write-ups commonly cite a **~4,000-character** budget. Confirm the live limit in the current grok.com UI; do not treat that number as a contract.
- Invoke by name or select the agent in a chat. Grok's native multi-agent architecture can coordinate specialists the same way internal Grok teams do.
- Access: Profile / Settings → Customize → Create Agent / Your Agents on [grok.com](https://grok.com) or the apps.

Custom Agents rolled out around **4 March 2026** on SuperGrok and X Premium+ plans. Slot counts and plan gates change; verify in the product before promising a cohort they can install a whole fleet.

## Projects / Workspaces

Dedicated spaces for ongoing work:

- group related chats
- upload files that stay as persistent context / knowledge
- apply project-specific custom instructions

This is the closest match to Claude Projects and to the knowledge + instructions side of Gems. On grok.com it lives in the sidebar. The web surface is currently the most complete for Projects; the apps expose a subset.

Use a Project when the NoéMI spec (or supporting docs) will not fit in the Custom Agent instruction budget.

## Skills

Reusable, persistent expertise and workflows. Official launch: **18 May 2026** ([Skills in web, iOS, and Android](https://x.ai/news/grok-skills)).

- Teach Grok a process once — describe it in chat, upload a reference, or use the Skill Creator.
- It remembers across conversations and can be invoked (including slash-style `/skill-name`) or auto-applied when the task matches.
- Every account ships with built-in skills (Word documents, presentations, spreadsheets, PDFs, Skill Creator). A custom skill with the same job **takes priority** over the built-in one.
- Skills are also the persistence layer inside Grok Build (repo-local `SKILL.md` files, `/skillify`, marketplaces). Hosted grok.com Skills and Grok Build Skills are related products, not the same install path.

This repository's `skills/` directory is the **governed NoéMI skill contract**. Do not assume a Grok Skill automatically inherits Refusal Criteria, Data Inventory, or audit-log shape. If you port a NoéMI skill, copy those sections explicitly.

## Custom Instructions

A single account-wide instruction block that applies across conversations. Keep it short and non-secret: tone, citation habits, and "never write secrets to disk." Put role-specific rules on the Custom Agent or in a Project, not in the global block.

## How To Load A NoéMI Persona

NoéMI agent specs are longer than a typical Gem/GPT/Grok instruction box. Do not paste the entire file and hope.

1. Pick the spec under `agents/{domain}/{name}.md` (canonical template: [`../AGENT_TEMPLATE.md`](../AGENT_TEMPLATE.md)).
2. Put these sections in the Custom Agent instructions, in this order:
   - `Role`
   - `Tone`
   - `Mission`
   - `Rules & Constraints`, including the mandatory `### Refusal Criteria` subsection
   - `Boundaries` (`Always` / `Ask First` / `Never`)
3. Put the rest of the spec — `Workflow`, `Data Inventory`, `External Tooling Dependencies`, full `Audit Log` shape, and any `**Skill:**` files — in a **Project** as attached markdown.
4. Tell the agent to **read the attached spec before acting** (same Dynamic Persona Protocol used by `CLAUDE.md` / `GEMINI.md`: summaries in memory, full spec on demand).
5. Never paste Infisical/1Password values, `GH_TOKEN`, or Workspace refresh tokens into instructions or Project files. Fetch-on-Demand still applies: wrap any credentialed command in `infisical run` or `op run`.

If you need more than four specialists, do not try to cram the fleet into the four slots. Keep a small standing set (for example Architect, Sentinel, Doc, Gatekeeper) and rotate Project attachments for the rest.

## Key Differences From GPTs / Gems

- Agent slots are limited (typically ~4) rather than unlimited.
- There is no public marketplace for one-click community agents. Share prompts and markdown specs; do not expect a Gem-store install of `agents/guardian/pii-guard.md`.
- Multi-agent collaboration and real-time X data are first-class on Grok; Google Workspace and n8n remain first-class on the Labs / Gemini path.
- The features are complementary layers. A Custom Agent without a Project has no durable knowledge files. A Skill without Refusal Criteria is a workflow, not a governed persona.

## Grok Bot (Advanced, Limited Tiers)

[Grok Bot](https://x.ai/news/introducing-grok-bot) (early beta, **11 August 2026**) goes further than a chat persona: durable AI teammates with a persistent cloud computer, app/website operation, learned routines, schedules/triggers, and Bot-to-Bot handoff.

At launch it is available to **SuperGrok Heavy**, **Cursor Ultra**, and **Cursor Teams Premium** (desktop and iOS). SuperGrok / SuperGrokPro does **not** automatically include it.

Phase 0 constraints that matter here:

- Official wording: Bots **share a computer of their own in the cloud**. Do not treat separate Bots as a tenant or credential boundary.
- Computer-use against signed-in apps is a mutating orchestrator. Approval gates, audit logs, and least privilege still apply. See [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md) and [`secure-secret-management.md`](secure-secret-management.md).
- Do not put production IdP sessions, vault CLIs, or machine-identity tokens on a shared Bot VM without an Accelerator sign-off.

Grok Bot is not the Intensive "build a Gem" lab path. It is an optional later-stage teammate surface.

## Getting Started

On [grok.com](https://grok.com):

1. Open the sidebar for **Projects / Workspaces**.
2. Go to **Settings → Customize** for Custom Instructions and **Your Agents**.
3. Optionally open [grok.com/skills](https://grok.com/skills) to inspect built-in Skills and create one.

The same options appear in the apps; web is currently the most complete for Projects.

## Related Docs

- [`grok-build-local-workspace.md`](grok-build-local-workspace.md) — Grok Build CLI / TUI install and local workspace
- [`agentic-local-workspaces.md`](agentic-local-workspaces.md) — Gemini CLI, Claude Code, Codex, and Grok Build as local workspaces
- [`../AGENT_TEMPLATE.md`](../AGENT_TEMPLATE.md) — canonical persona sections to copy
- [`../PROJECT_REFERENCE.md`](../PROJECT_REFERENCE.md) — stack table (Gems and this Grok mapping)
- [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md) — what any external executor, including Grok Bot, must enforce
- [`secure-secret-management.md`](secure-secret-management.md) — Fetch-on-Demand

## Sources

Vendor pages (authoritative for Skills and Grok Bot):

- [Skills in web, iOS, and Android](https://x.ai/news/grok-skills) — 18 May 2026
- [Introducing Grok Bot](https://x.ai/news/introducing-grok-bot) — 11 August 2026
- [Grok Build](https://x.ai/build)

Custom Agents / Projects UI paths and the four-slot / ~4,000-character figures are **product-UI facts**. Confirm them in the current grok.com Customize screen before teaching a cohort; they are not pinned in this repository's requirements.
