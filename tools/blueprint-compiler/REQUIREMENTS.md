# Mines CSCI 370 — Blueprint Compiler requirements

**Status:** Session 1 agreed, 1 September 2026  
**Course:** Colorado School of Mines CSCI 370 Field Session, Fall 2026  
**Client:** NewPush (Balázs Nagy, `bnagy@newpush.com`)  
**Student team:** Ally Wallace · Jake Galloway · Ryan Clark · Van Nguyen  
**Advisor:** Kathleen Kelly  
**Working repository:** [`project-noemi/agents`](https://github.com/project-noemi/agents), package `tools/blueprint-compiler/`  
**Source brief:** Drive doc `NewPush_NoeMI_Fall2026_Mines_FieldSession_Proposal_v3` (5 August 2026)

This file is the implementation requirements for the Field Session. It is **not** a rewrite of the 5 August proposal and it is **not** an edit of the fleet document `docs/REQUIREMENTS.md`. The proposal stays the historical brief. Fleet `docs/REQUIREMENTS.md` stays the reference-architecture contract for personas, Phase 0, and the merge gate.

---

## 1. Problem

`project-noemi/agents` is a public Fair Source library of AI-agent blueprints. The repository README is explicit: *this is not a runtime — it is the blueprint that orchestrators execute.*

Today those blueprints are executed by hand-wired hosts (n8n, Gemini CLI, Claude Code, Codex, the in-repo `coding-loop/`). There is no single engine that reads a NoéMI specification and instantiates the Virtual Coworker it describes, on whichever model provider is configured.

The team is building that engine, plus two thin faces on top of it.

---

## 2. MVP

Three deliverables. Stretch work waits until these are merged.

### 2.1 Blueprint Compiler & Runtime

Load a NoéMI blueprint, validate it, resolve skill and MCP references, and instantiate a running agent with **no blueprint-specific code**.

| Capability | Sprint | Done when |
|---|---|---|
| Load from a local file | 1 | CLI reads `agents/{domain}/{name}/core.md` or a fixture |
| Parse Markdown headings into a Blueprint IR | 1 | `##` sections become `ir.sections`; `**Skill:** \`slug\`` becomes `ir.skills` |
| Validate required headings + Refusal Criteria | 1 | Missing heading or missing `### Refusal Criteria` fails closed with a structured error |
| Mock provider Hello World | 1 | `node src/cli.js compile <file> --provider mock` prints IR + mock completion; no network |
| Configuration-driven model selection | 2 | Preferred + fallbacks from env / config, not hardcoded per blueprint |
| Two live providers after mock | 2 | Gemini + Grok (xAI). Keys via Fetch-on-Demand only |
| Resolve skills and MCP refs | 3 | Slugs map to `skills/` or `skills-dist/` and `mcp-protocols/` |
| Instantiate on Mastra | 3 | IR becomes a Mastra agent. Mastra is the runtime target, not the Sprint 1 host |
| HTTP URL + versioned registry loaders | 3 | Same validate/resolve path as local files |
| Fallback, timeout, structured errors | 2–3 | 429 / 5xx / missing key trigger the next provider. Mock-only `npm test` still passes |

### 2.2 NoéMI Studio

Lean browser playground on a pre-styled React + Tailwind starter: author, save, run a blueprint, stream the result. Form + table + stream view only. No design system. Sprint 4.

### 2.3 LLM Arena

One blueprint + one prompt, fanned to the configured providers. Side-by-side responses with tokens, latency, and cost. Simple scoreboard. Persist runs. Sprint 5.

### 2.4 Stretch (only after the core is merged)

Autonomous Guardian review agent · Presidio PII sidecar · observability dashboard · MCP server for compiled agents · NewPush Labs wiring (n8n / Casdoor / Grafana / Infisical) · multi-agent delegation with loop protection.

---

## 3. What stayed true from the 5 August proposal

- Public target is `project-noemi/agents` under FSL-1.1-Apache-2.0 (auto-converts to Apache-2.0 after two years). No IP assignment. Commits under the student’s own name.
- Node.js 24 baseline.
- PRs target `develop`. `main` is release-only. Green pipeline or no merge. Gitleaks on every PR.
- Personas keep the headings in `docs/AGENT_TEMPLATE.md`.
- Client sets priorities. Team estimates. Two-week sprints. Weekly demo + planning with the client. Daily scrum and retrospective without the client.
- Sprint 1 is small: environment green and one passing PR.
- No NDA. Nothing the team writes for this project is hidden.

---

## 4. Amendments agreed 1 September 2026

Copying the proposal verbatim would send the team after a schema and a calendar that do not exist. These lines replace the stale ones.

| # | Proposal said | Requirement now |
|---|---|---|
| A1 | Blueprints are structured YAML/JSON domain schemas | Blueprints are **Markdown personas** (`agents/{domain}/{name}/core.md`) plus the heading contract already enforced by `scripts/audit-repo.js`. Skills use YAML frontmatter + Markdown body. |
| A2 | Clone a published Day 1 boilerplate sibling repo; Hello World is a Mastra mock run | No sibling `blueprint-compiler` repo exists. Home is **`tools/blueprint-compiler/`**, an isolated package next to `tools/executive-assistant`. Sprint 1 Hello World is parse + validate + mock. |
| A3 | Mastra is the Sprint 1 host | Mastra is the **Sprint 2–3 runtime target**. It is not `newpush/newpush-mastra-orchestration` (Slack/Datto chatbot). |
| A4 | First live providers: Gemini, Claude, Llama via Groq | After mock: **Gemini + Grok (xAI)**. Matches `docs/model-routing.json` (`provider: xai`, `family: grok-latest` on the code stage). Third provider later. |
| A5 | Secrets in env vars or an ignored secrets file | **Fetch-on-Demand only** (Infisical / 1Password). `infisical run` / `op run`. No local `.env` parser. |
| A6 | Seven sprints + week-15 wrap by 18 December | Course calendar is **six sprints (24 Aug – 29 Nov) + Innovation Fair 8 December**. Same three MVP pieces, remapped. |
| A7 | Invent the working method as you go | Use the existing **`coding-loop/`**. Do not invent a second agentic workflow. |
| A8 | Students might work on a private NewPush copy | Working tree is public `project-noemi/agents`. `newpush/newpush-agents` is a sync target, not the student tree. |

---

## 5. Blueprint IR (Sprint 1–3)

```ts
type SourceRef =
  | { kind: "file"; ref: string }
  | { kind: "http"; ref: string }
  | { kind: "registry"; ref: string; version?: string };

type BlueprintIR = {
  id: string;            // e.g. "coding/architect"
  name: string;
  domain: string;
  title: string;
  sections: Record<string, string>;
  skills: string[];
  mcp: string[];
  modelPolicy: { preferred: string; fallbacks: string[] };
  source: SourceRef;
};
```

Validator fails closed if any of these headings are absent (case-insensitive; a parenthetical suffix is allowed):

Role · Tone · Capabilities · Mission · Rules & Constraints · Data Inventory · Boundaries · Workflow · Audit Log · External Tooling Dependencies

`### Refusal Criteria` must appear under Rules & Constraints.

---

## 6. Package rules

`tools/blueprint-compiler/` is a self-contained Node.js 24 ESM package.

- Own `package.json`. Do not add Mastra or provider SDKs to the **root** package.
- Package tests live here (`npm test` inside this directory). Do not add them to root `tests/`.
- Root `npm run validate` must keep passing on a spec-only clone.
- Audit records emit to `stderr` as JSON `{task, inputs, actions, risks, result}`.
- Refusal Criteria from the persona are copied onto the running agent. The runtime must honor them, not strip them.
- Extract later to `project-noemi/blueprint-compiler` only if Studio + Arena + Mastra outgrow `tools/`. Isolation now makes that a move, not a rewrite.

---

## 7. Course sprint map

| Course sprint | Dates | Product focus |
|---|---|---|
| 1 | 24 Aug – 6 Sep | Env green, mock Hello World, first PR, architecture agreed |
| 2 | 7 – 20 Sep | Multi-provider routing (Gemini + Grok + mock), unit tests |
| 3 | 28 Sep – 11 Oct | Compiler core: resolve skills, instantiate on Mastra |
| 4 | 12 – 25 Oct | Studio: author / save / run / stream. Mid-project demo |
| 5 | 2 – 15 Nov | Arena + persistence + security review. Core merged |
| 6 | 16 – 29 Nov | One stretch goal (Guardian or Presidio) + docs |
| Fair | 8 Dec | Live Arena demo |

---

## 8. Working agreements

- Async channel: Slack. Same-business-day answers from NewPush.
- First student PR reviewers: `@WSwarm` (Balázs) or `@thakivagyok` (Kristóf). CODEOWNERS already lists both.
- Producer opens the PR. Reviewer does not approve their own work. Humans merge.
- GitHub access is Team `Mines2026fall` on `project-noemi/agents`.
- Course artifacts (team contract, elevator pitch, bookclub) are the students’ Canvas work. They are not product deliverables.

---

## 9. Sprint 1 acceptance

This package is accepted for Sprint 1 when all of the following hold:

1. `npm test` inside `tools/blueprint-compiler` is green with no network and no API keys.
2. `node src/cli.js compile fixtures/architect.core.md --provider mock` prints a normalized IR and a mock completion.
3. A persona missing `### Refusal Criteria` fails with `MISSING_REFUSAL`.
4. `**Skill:** \`verification/pre-flight-check\`` is extracted onto `ir.skills`.
5. This requirements file is in the same package, so the course document and the working tree cannot drift from each other.
