# Orchestrator — Model Selection & Delegation Guide

## What is the Orchestrator?

The Orchestrator is the model-selection and delegation authority for Claude Code workflows and subagents. It does not perform domain work itself — it routes each unit of work to the model whose intelligence, taste, and cost profile best fits the task, then delegates through the correct native mechanism.

| Work category | Default model | Why |
|---------------|---------------|-----|
| Bulk / mechanical (clear-spec implementation, data analysis, migrations) | `gpt-5.5`, or Gemini Flash / `sonnet-5` (`docs/model-routing.json` stage `bulk`) | Cheap; Flash is not the fleet PR-review model |
| User-facing (UI, copy, API design) | Any model with **taste ≥ 7** (`sonnet-5`, `opus-4.8`, `fable-5`) | Taste is the binding constraint |
| Review / verification | `fable-5` or `opus-4.8` (optionally `gpt-5.5` **or Grok Build** as a second perspective) | High intelligence for adversarial review |

**Never use Haiku.**

## Model Selection Matrix

Higher = better. Cost reflects actual paid cost, not list price.

| model    | cost | intelligence | taste |
|----------|------|--------------|-------|
| gpt-5.5  | 9    | 8            | 5     |
| sonnet-5 | 6    | 5            | 7     |
| opus-4.8 | 4    | 8            | 8     |
| fable-5  | 2    | 9            | 9     |

Grok Build is **not** scored in the matrix above. It is a separate **peer bridge** into the xAI Grok Build CLI (see [Grok Build ↔ Claude Code](../../../tool-usages/grok-build-claude-code.md)). Treat it as an independent second-family reviewer and rescue path, not as a row that replaces Claude or Codex defaults.

## Core Rules

1. **Defaults, not limits.** If a cheaper model's output misses the bar, rerun with a smarter one without asking. Judge the output, not the price tag.
2. **Conflict ordering:** for anything that ships, **intelligence > taste > cost**. Cost is a tie-breaker only.
3. **Native mechanisms only.** No custom bash wrappers around model calls. Use Agent/Workflow model parameters, the Codex plugin, or the Grok Build plugin — not hand-rolled CLI glue that skips lifecycle tracking.

## Issue-coding loop (interactive)

Claude Code may host the loop without Mastra (Decision [2026-08-20-0008]). Fable 5 or Opus 4.8 orchestrates; Grok is triggered with `/grok-build:delegate` after `/grok-build:check` ([Grok Build ↔ Claude Code](../../../tool-usages/grok-build-claude-code.md)). Cheap steps may use Gemini Flash (highest 3.x Flash) or `sonnet-5`. Unattended pickup remains `coding-loop/run.js` + Actions.

## Delegation Mechanisms

### Claude models

Set the Agent/Workflow `model` parameter to `sonnet-5`, `opus-4.8`, or `fable-5`.

### gpt-5.5 via the Codex plugin

`gpt-5.5` is handled natively through the `openai/codex-plugin-cc` plugin, which adopts user-level configuration from `~/.codex/config.toml`:

| Command | Purpose |
|---------|---------|
| `/codex:review` | Non-destructive, read-only code quality assessment. Supports `--base <ref>`. |
| `/codex:adversarial-review` | Skeptical design review of tradeoffs, auth, and reliability. Append focus text to steer it. |
| `/codex:rescue` | Subcontract debugging, multi-file refactoring, or implementation loops. |
| `/codex:status` / `/codex:result` / `/codex:cancel` | Check, fetch, or abort async jobs launched with `--background`. |
| `/codex:setup --enable-review-gate` | Enable the closed-loop review gate (a stop hook that challenges outputs before finalizing). |

Subagents and automated workflows should call these slash commands or the exposed `codex-cli-runtime` skills directly.

### Grok Build via the xAI Claude Code plugin

Independent review, design critique, and write-capable rescue through [xai-org/grok-build-plugin-cc](https://github.com/xai-org/grok-build-plugin-cc). Full operator guide: [`docs/tool-usages/grok-build-claude-code.md`](../../../tool-usages/grok-build-claude-code.md).

| Command | Purpose |
|---------|---------|
| `/grok-build:check` | Verify Node + `grok` CLI + auth before any other Grok command. |
| `/grok-build:review` | Read-only review of local git state (`--base`, `--scope`, `--wait` / `--background`). |
| `/grok-build:critique` | Design/risk challenge pass; accepts focus text. Still non-mutating. |
| `/grok-build:delegate` | Investigation or implementation via `grok-build:grok-delegate` (write-capable by default). |
| `/grok-build:import` | Import the Claude transcript into a resumable Grok session (`grok -r <id>`). |
| `/grok-build:runs` / `:show` / `:stop` | List, fetch output, or kill plugin-owned run process trees. |

**When to choose Grok vs Codex**

| Need | Prefer |
|------|--------|
| Bulk mechanical work scored on the matrix | Codex / `gpt-5.5` when that plugin is available |
| Closed-loop review gate on Claude stop | Codex (`/codex:setup --enable-review-gate`) |
| Independent non-Claude design challenge | Grok (`/grok-build:critique`) |
| Write-capable rescue with Grok session resume | Grok (`/grok-build:delegate`, `--resume`) |
| High-risk change needs two independent families | Use both Codex review **and** Grok critique when both are ready |

Always run `/grok-build:check` (or the Codex equivalent readiness path) before routing. If a bridge is missing, fall back to Claude models rather than inventing CLI wrappers.

## Scope vs. the Gemini Baseline

This persona governs **interactive Claude Code orchestration only**. Reference lab workflows, examples, and smoke tests remain pinned to **Gemini 2.5 Flash** per the AI Model Baseline in the repository coding standards. The Orchestrator does not repoint pinned reference examples, and neither the Codex nor Grok bridges change that pin.

## Related Specs

- Agent spec: `agents/engineering/orchestrator.md`
- Skills used: `skills/verification/pre-flight-check.md`, `skills/classification/risk-triage.md`
- Sibling design authority: `agents/engineering/ai-architect.md` (architecture/governance, distinct from model routing)
- Grok Build operator guide: [`docs/tool-usages/grok-build-claude-code.md`](../../../tool-usages/grok-build-claude-code.md)
- Claude Code workspace: [`docs/tool-usages/claude-code-local-workspace.md`](../../../tool-usages/claude-code-local-workspace.md)
- Codex workspace: [`docs/tool-usages/openai-codex-local-workspace.md`](../../../tool-usages/openai-codex-local-workspace.md)
