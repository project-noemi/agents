# Grok Build ↔ Claude Code Bridge

Use [Grok Build](https://x.ai) from inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) for independent review, design critique, write-capable delegation, and session handoff.

This guide covers the official Claude Code marketplace plugin:

- **Upstream:** [xai-org/grok-build-plugin-cc](https://github.com/xai-org/grok-build-plugin-cc)
- **Plugin id:** `grok-build@xai-grok-build`
- **Version documented:** `0.2.x` (plugin metadata; re-check upstream after upgrades)

## What It Is

The plugin is a **thin bridge**, not a second orchestrator and not a cloud broker.

| Layer | Owns |
|-------|------|
| Claude Code | Slash commands, subagent routing, user interaction |
| Plugin (`grok-bridge.mjs`) | Launch, PID tracking, run state, logs, stop/show |
| Grok Build CLI (`grok`) | Actual review, critique, and implementation work |

There is **no app-server broker**. The plugin shells out to the real `grok` binary. Run status, results, and cancellation live in plugin-owned state (PID + log files under the Claude plugin data root).

In NoéMI terms, this is the xAI-side peer of the Codex Claude Code plugin: another **native multi-model path** for second-pass review and rescue, while Claude Code remains the human co-work surface.

## Why It Matters For NoéMI

Claude Code is already a first-class local agentic workspace ([`claude-code-local-workspace.md`](claude-code-local-workspace.md)). The Grok bridge adds:

1. **Independent review** — Grok reads local git state under a read-only sandbox, separate from the main Claude thread.
2. **Adversarial design critique** — pressure-test approach, tradeoffs, and failure modes (not just defect hunting).
3. **Write-capable delegation** — hand investigation or implementation to Grok when Claude is stuck or needs a second pass.
4. **Session transfer** — import a Claude transcript into a resumable Grok session (`grok -r <id>`).

Use it when you want a **different model family** to challenge Claude's work, not when you only need another Claude subagent.

## Architecture (Mental Model)

```text
┌──────────────────────────────┐
│  Claude Code session         │
│  /grok-build:* commands      │
│  grok-build:grok-delegate    │
└──────────────┬───────────────┘
               │ node …/grok-bridge.mjs
               ▼
┌──────────────────────────────┐
│  Plugin state                │
│  bridgePid + agentPid        │
│  runs / show / stop          │
└──────────────┬───────────────┘
               │ grok -p / grok -r / grok import
               ▼
┌──────────────────────────────┐
│  Grok Build CLI              │
│  explore / plan / write      │
└──────────────────────────────┘
```

### Write policy layering

| Surface | Default write policy |
|---------|----------------------|
| Bridge `run` CLI | **Read-only** (`--permission-mode plan` + `--sandbox read-only`) unless `--write` is passed |
| `/grok-build:review` and `/grok-build:critique` | Always review-only (no fixes, no patches) |
| `/grok-build:delegate` / `grok-build:grok-delegate` | **Write-capable by policy** (adds `--write`) unless the user asks for read-only / diagnosis-only |

Direct bridge calls stay conservative. The delegate path is intentionally more powerful so Grok can implement fixes.

## Requirements

| Prerequisite | Check |
|--------------|--------|
| Node.js `>= 18.18` | `node -v` |
| Grok Build CLI on `PATH` (or `GROK_BINARY`) | `which grok` |
| Authenticated Grok session | `grok models` succeeds |
| Claude Code with plugin support | `/plugin` works in the session |

**Phase 0 reminder:** do not put Grok API keys or session tokens in the repository. Authenticate through the Grok CLI login flow. If a downstream tool needs secrets, wrap launches with `op run` / `infisical run` as in [`secure-secret-management.md`](secure-secret-management.md).

## Install

### Marketplace install (recommended)

In Claude Code:

```text
/plugin marketplace add xai-org/grok-build-plugin-cc
/plugin install grok-build@xai-grok-build
/reload-plugins
```

### Local install (from a clone)

Paths must be **absolute**:

```bash
claude plugin marketplace add "$(pwd)"   # from a grok-build-plugin-cc clone
claude plugin install grok-build@xai-grok-build
```

Or use `/plugin` in an open Claude Code session and add the absolute marketplace path, then install `grok-build@xai-grok-build`.

## Readiness Check

Always verify before relying on the bridge:

```text
/grok-build:check
```

**Ready** means all of:

1. Node is available  
2. `grok` is available (PATH or `GROK_BINARY`)  
3. Soft auth succeeds (`grok models`)

If the check fails:

- Install or fix the Grok Build CLI; do not invent install paths.
- Complete interactive login via `grok`, then re-run `/grok-build:check`.
- Only after check passes, use review / critique / delegate.

## Command Reference

All commands are namespaced under `/grok-build:`.

### `/grok-build:check`

Probe Node + Grok CLI availability and authentication.

```text
/grok-build:check
```

### `/grok-build:review`

**Read-only** code review of local git state.

```text
/grok-build:review --wait
/grok-build:review --background --scope working-tree
/grok-build:review --base main
/grok-build:review --wait --model grok-build --effort high
```

| Flag | Purpose |
|------|---------|
| `--wait` | Foreground; return full output in this turn |
| `--background` | Detached bridge worker; poll with `/grok-build:runs` |
| `--base <ref>` | Review branch diff against a base ref |
| `--scope auto\|working-tree\|branch` | Target selection |
| `--model <model>` | Optional Grok model override |
| `--effort low\|medium\|high` | Optional reasoning effort |

Under the hood (conceptually):

```bash
grok -p <prompt> --agent explore --permission-mode plan --sandbox read-only --cwd <ws> --output-format plain
```

**Constraints:**

- Review-only: Claude must not fix, patch, or claim it is about to change code.
- No staged-only / unstaged-only split; no free-form focus text on review (use critique for that).
- If neither `--wait` nor `--background` is set, the command estimates size and asks whether to wait or run in the background (tiny diffs → wait; otherwise background).

### `/grok-build:critique`

Same target selection as review, but framed as a **design / risk challenge**:

- Was this the right approach?
- What assumptions does it depend on?
- Where can it fail in production?

```text
/grok-build:critique --wait
/grok-build:critique --base main challenge whether this was the right caching and retry design
/grok-build:critique --wait --model grok-build --effort high focus on failure modes
```

Unlike review, critique accepts extra **focus text** after the flags. Prefer structured JSON-oriented output when the bridge can produce it.

Still review-only: no fixes from the critique command itself.

### `/grok-build:delegate`

Hand investigation or implementation to Grok via the `grok-build:grok-delegate` subagent.

```text
/grok-build:delegate investigate the flaky test in auth
/grok-build:delegate --resume apply the top fix
/grok-build:delegate --model grok-build --effort high fix the race
/grok-build:delegate --background diagnose the memory leak in the ingest worker
```

| Flag | Purpose |
|------|---------|
| `--wait` / `--background` | Claude-side execution control (prefer bridge `--background` for long work) |
| `--resume` | Continue the last stored Grok session (`grok -r <id>`) |
| `--fresh` | Force a new Grok thread |
| `--model` / `--effort` | Runtime selection only; not part of the task text |

**Operating rules for agents:**

- `grok-build:grok-delegate` is a **subagent**, not a skill. Do not call a non-existent skill name that re-enters the slash command (that can hang the session).
- The subagent is a thin forwarder: one bridge `run` call, return stdout **verbatim**.
- Default is write-capable unless the user asked for read-only / research-only.
- Prefer background for long, open-ended, or multi-step work so both `bridgePid` and `agentPid` are tracked.
- If a resumable Grok thread exists for this Claude session and the user did not pass `--resume` / `--fresh`, ask once whether to continue or start new.

### `/grok-build:import`

Import the current Claude transcript into a resumable Grok session.

```text
/grok-build:import
/grok-build:import --source ~/.claude/projects/.../session.jsonl
```

Uses `grok import` and prints a resume hint:

```bash
grok -r <session-id>
```

Useful when the human wants to continue the same problem **outside** Claude Code in the Grok TUI.

### Run lifecycle: `/grok-build:runs`, `:show`, `:stop`

| Command | Purpose |
|---------|---------|
| `/grok-build:runs` | List active and recent plugin-owned runs |
| `/grok-build:runs <run-id> --wait` | Wait on a specific run |
| `/grok-build:show` / `/grok-build:show <run-id>` | Show stored output for a finished run |
| `/grok-build:stop` / `/grok-build:stop <run-id>` | Terminate tracked process trees |

Stop kills every distinct PID among:

- `agentPid` — detached `grok` child  
- `bridgePid` (and legacy `companionPid` / `pid`) — bridge or run-worker  

Terminal status is claimed under a locked compare-and-swap so a finishing worker cannot overwrite `cancelled` with `completed`.

## Recommended Workflows

### 1. Second-opinion review before a PR

```text
/grok-build:check
/grok-build:review --base main --wait
```

For larger diffs:

```text
/grok-build:review --base main --background
# later
/grok-build:runs
/grok-build:show <run-id>
```

### 2. Design challenge (adversarial pass)

```text
/grok-build:critique --base main --effort high challenge auth boundary and retry policy
```

Use when the question is “is this the right design?”, not only “are there bugs?”.

### 3. Rescue / implementation handoff

```text
/grok-build:delegate --background root-cause the flaky CI job and apply the minimal fix
```

Then continue the same Grok thread:

```text
/grok-build:delegate --resume add regression tests for the race
```

### 4. Continue in Grok TUI

```text
/grok-build:import
# then outside Claude:
grok -r <session-id>
```

### 5. Multi-model review (NoéMI pattern)

Pair independent reviewers when the change ships:

| Pass | Tool |
|------|------|
| Primary implementation | Claude Code (host session) |
| Cost-efficient second read | Codex plugin (`/codex:review`) when available — see Orchestrator |
| Independent design challenge | `/grok-build:critique` |
| Final human gate | Accelerator / Explorer acceptance |

Intelligence still beats cost for anything that ships. Use Grok when you want a **non-Claude** challenge pass, not as a cheaper substitute for judgment.

## Agent Usage Guidance

### When the Orchestrator or host agent should call Grok

| Situation | Prefer |
|-----------|--------|
| Claude is stuck on a multi-file bug or needs a second implementation pass | `/grok-build:delegate` |
| Need a read-only quality pass on local git state | `/grok-build:review` |
| Need to challenge design, auth, caching, retry, or failure modes | `/grok-build:critique` |
| Human wants to continue in the Grok TUI | `/grok-build:import` |
| Simple one-shot edit Claude can finish quickly | Stay in Claude; do not delegate |

### Rules agents must follow

1. **Check before rely** — if Grok is missing or unauthenticated, stop and instruct `/grok-build:check`.
2. **Verbatim output** — return bridge stdout as-is for review, critique, and delegate. Do not paraphrase findings into a softer review.
3. **Do not “help” by fixing** after review/critique — those commands are non-mutating by design.
4. **Native mechanisms only** — use `/grok-build:*` and the `grok-build:grok-delegate` subagent; avoid hand-rolled `grok -p ...` wrappers that skip PID tracking and stop.
5. **Background for long work** — so `/grok-build:stop` can kill both process trees.
6. **Secrets** — never log Grok credentials, vault values, or PII into run output summaries.

### Relationship to the Orchestrator persona

The [Orchestrator](../agents/engineering/orchestrator/README.md) routes work across Claude models and (when present) the Codex plugin. The Grok bridge is an **additional native path**:

- **Codex plugin** — strong fit when gpt-class bulk work and Codex review gate are configured.
- **Grok Build plugin** — strong fit for xAI-backed independent review, critique, and write-capable rescue.

Both are peer bridges. Prefer the one that is installed, authenticated, and matches the team’s model access. For dual review on high-risk changes, use both.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GROK_BINARY` | Optional override for the `grok` executable |
| `GROK_CC_SESSION_ID` | Claude session id (set by SessionStart hook) |
| `GROK_CC_TRANSCRIPT_PATH` | Claude transcript path (set by SessionStart hook) |
| `CLAUDE_PLUGIN_ROOT` | Plugin install root (host) |
| `CLAUDE_PLUGIN_DATA` | Plugin data root; state under `.../state` |
| `CLAUDE_ENV_FILE` | Host env file for session hooks |
| `CLAUDE_PROJECT_DIR` | Project directory from the host |

State fallback when `CLAUDE_PLUGIN_DATA` is unset: `$TMPDIR/grok-cc-runs`.

## Strengths

- Real Grok Build CLI under a clear permission model  
- Plugin-owned lifecycle (runs / show / stop) without a broker service  
- Clean separation of review-only vs write-capable paths  
- Session import for Claude → Grok handoff  
- Good fit for multi-model Diligence (independent challenge pass)

## Weaknesses And Failure Modes

- Requires a working local `grok` install and auth; silent unavailability is a common first failure  
- Teams can confuse Claude background tasks with bridge background workers — prefer bridge `--background` for stop ownership  
- Direct `node …/grok-bridge.mjs run` is read-only by default; forgetting `--write` (or the delegate path) yields plan-only behavior  
- Review and critique intentionally refuse to fix; users may misread that as “the bridge cannot edit”  
- Not a replacement for Phase 0 SecretOps or for pinned Gemini 2.5 Flash reference workflows in this repository  

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Plugin commands missing | `/plugin install grok-build@xai-grok-build` then `/reload-plugins` |
| Check fails on `grok` | Install CLI; set `GROK_BINARY` if not on PATH |
| Check fails on auth | Interactive `grok` login; confirm `grok models` |
| Background run with no output | `/grok-build:runs` then `/grok-build:show <run-id>` |
| Run will not die | `/grok-build:stop <run-id>` (kills agent + bridge trees) |
| Delegate seems stuck | Ensure you used the subagent path, not a recursive skill/command re-entry |
| Want Grok outside Claude | `/grok-build:import` then `grok -r <id>` |

## Scope vs. Repository Baselines

| Surface | Model / tool policy |
|---------|---------------------|
| Interactive Claude Code co-work | Claude host models + optional Grok / Codex bridges |
| Orchestrator routing matrix | Claude models + Codex (`gpt-5.5`) when that plugin is present; Grok as peer bridge for review/rescue |
| Pinned lab / example / smoke workflows in this repo | Remain on **Gemini 2.5 Flash** per coding standards — the Grok bridge does not repoint them |

## Recommended Next Docs

- [`claude-code-local-workspace.md`](claude-code-local-workspace.md) — Claude Code as a local agentic workspace  
- [`openai-codex-local-workspace.md`](openai-codex-local-workspace.md) — peer bridge pattern for OpenAI Codex  
- [`agentic-local-workspaces.md`](agentic-local-workspaces.md) — Gemini / Claude / Codex taxonomy  
- [`../agents/engineering/orchestrator/README.md`](../agents/engineering/orchestrator/README.md) — model selection and multi-model delegation  
- [`secure-secret-management.md`](secure-secret-management.md) — Fetch-on-Demand SecretOps  
- [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md) — runtime ownership expectations  

## Official References

- [Grok Build ↔ Claude Code Bridge (upstream)](https://github.com/xai-org/grok-build-plugin-cc)  
- [xAI / Grok Build](https://x.ai)  
- [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code/overview)  
- Agent persona: [`agents/engineering/orchestrator.md`](../../agents/engineering/orchestrator.md)  
