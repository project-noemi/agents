# Grok Build ↔ Claude Code Bridge

Use [Grok Build](https://x.ai) from inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) for independent review, design critique, write-capable delegation, and session handoff.

This guide covers the official Claude Code marketplace plugin:

- **Upstream:** [xai-org/grok-build-plugin-cc](https://github.com/xai-org/grok-build-plugin-cc)
- **Plugin id:** `grok-build@xai-grok-build`
- **Version documented:** `0.2.1` (plugin metadata; re-check [upstream](https://github.com/xai-org/grok-build-plugin-cc) after upgrades)

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
| Bridge `run` CLI | **Read-only sandbox** (`--sandbox read-only` + `--always-approve`) unless `--write` is passed |
| `/grok-build:review` and `/grok-build:critique` | Always review-only (no fixes, no patches). Safety is the read-only sandbox, not an interactive Approve click |
| `/grok-build:delegate` / `grok-build:grok-delegate` | **Write-capable by policy** (adds `--write`, no sandbox) unless the user asks for read-only / diagnosis-only |

Headless runs have no human to click Approve. Upstream 0.2.1 therefore auto-approves tool calls and relies on `--sandbox read-only` for the read-only paths (see [xai-org/grok-build-plugin-cc#12](https://github.com/xai-org/grok-build-plugin-cc/issues/12)).

Direct bridge calls stay conservative. The delegate path is intentionally more powerful so Grok can implement fixes.

## Requirements

| Prerequisite | Check |
|--------------|--------|
| Node.js `>= 18.18` | `node -v` |
| Grok Build CLI on `PATH` (or `GROK_BINARY`) | `which grok` |
| Authenticated Grok session | `grok models` succeeds |
| Claude Code with plugin support | `/plugin` works in the session |

**Phase 0 reminder:** do not put Grok API keys or session tokens in the repository. Prefer interactive `grok` login so `grok models` succeeds. If you need an `XAI_API_KEY` for headless or CI, inject it with `op run` / `infisical run` ([`secure-secret-management.md`](secure-secret-management.md)). Project NoéMI can issue a **starter xAI API key from USD 1** — inquire at [noemi.newpush.com](https://noemi.newpush.com). Do not paste the key into chat.

## Paste this into Claude Code

If you want Claude to ask the right questions and install the plugin for you, copy the fence in [`../examples/grok-claude-plugin-prompt.md`](../examples/grok-claude-plugin-prompt.md) into a new Claude Code session.

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

**Hook sources are part of readiness.** `check` verifies Node, the CLI, and auth; it does not verify that the run is isolated from hooks that wait for a person. Before any bridge run (review, critique, or delegate; all three launch `grok -p` headlessly), also run the repository gate against the loop-owned home:

```bash
npm run check:headless -- --grok-home "$GROK_HOME"
```

Add `--claude-settings <file>` or `--claude-bare` only when the loop also launches a headless `claude -p`; a bridge run from the interactive host session has no headless Claude side, so the gate runs on Grok alone. It exits 1 when `GROK_HOME` is the interactive default `~/.grok`, when the `allow_managed_hooks_only` pin is missing from both policy files, when `fail_closed` is missing (so the pin would not survive the first run), or when the `--claude-settings` file still carries hooks, is missing, is invalid JSON, or is not a JSON object. Exit 2 is a usage error and exit 3 a read fault on a policy file. Nothing invokes it automatically yet; run it by hand and treat any non-zero exit as a stop. See [Headless Profile](#headless-profile).

## Headless Profile

A bridge run has no person at the terminal, but the `grok` it launches inherits the interactive user's profile: plugins (Grok discovers Claude plugins from `~/.claude/plugins` in any `GROK_HOME`), `~/.grok/hooks`, and, by default, the hooks in `~/.claude/settings.json` and `~/.cursor/hooks.json` through Grok's compatibility scan. A desktop tool's "keep working until I answer" hook then fires at the end of Grok's turn and waits. Grok holds a blocking `Stop` gate for 600 s by default (a hook's own timeout can raise it), the bridge only watches process exit, and the run shows `running` with a three-line log long after the work is done. Decision [2026-09-27-0001].

The fix is a loop-owned profile with a policy pin, not "disable all hooks" (see the [runtime contract, section 10](orchestrator-runtime-contract.md#10-headless-execution-control) for why):

1. Copy [`templates/headless-agent-home/grok/`](../../templates/headless-agent-home/grok/) to a loop-owned directory and export `GROK_HOME` to it. Its `requirements.toml` pins `allow_managed_hooks_only = true` and sets `fail_closed = true` so grok 1.0.41 does not remove the unsigned file at session start; its `config.toml` switches the Claude and Cursor imports off. Under the pin the home runs no hooks of its own: only fleet-enforced hooks (root-owned `/etc/grok` files, a console-signed requirements file) still dispatch.
2. For `/grok-build:delegate` the export is a manual step today: set `GROK_HOME` in the shell before starting the interactive `claude` session. The bridge passes only the environment it inherits; nothing in the plugin or this repository sets it.
3. Give the home an identity: sign in once inside it (`GROK_HOME=... grok login --device-code`), or inject `XAI_API_KEY` with `infisical run` / `op run`. Never copy auth files between homes.
4. After the first launch, `grok inspect` with that home must list the pin under **Enforced by policy** ("Hooks outside managed policy disabled" with the path of the requirements file). Discovered plugin hooks still appear in its Hooks list without a marker, and the Claude and Cursor imports show only under Harness Compatibility as `hooks OFF (config)`; all are skipped at dispatch.
5. Run `npm run check:headless -- --grok-home "$GROK_HOME"` before dispatch and treat any non-zero exit as a stop (see [Readiness Check](#readiness-check)); add `--claude-settings <file>` or `--claude-bare` only when the loop also launches a headless `claude -p`.
6. For the Claude Code side of the loop use `--bare`, or `--settings templates/headless-agent-home/claude/settings.headless.json` when plugins and `CLAUDE.md` are still needed. Both also disable repository `.claude/settings.json` hooks; no loop-owned Claude hook exists today.

The pin is tighten-only: no lower config layer can release it (`fail_closed` is a plain boolean, not a pin), but the unsigned file is the loop's own, and editing or removing it does. Never place that file in `~/.grok`: it would bind the interactive TUI as well.

What the bridge (upstream `0.2.1`) still lacks: detecting completion from Grok's turn-complete event or session transcript instead of process exit, and an idle watchdog that ends a silent run as `stalled` rather than leaving it `running`. Raised upstream as [xai-org/grok-build-plugin-cc#45](https://github.com/xai-org/grok-build-plugin-cc/issues/45), next to the existing exit-tracking reports (#30, #40, #3). Until then, a run that is finished but not exited is recovered by reading `$GROK_HOME/sessions/<url-encoded cwd>/<threadId>/updates.jsonl` (the conversation log; `chat_history.jsonl` beside it holds the raw model messages; the `threadId` is the Grok session id shown by `/grok-build:runs`) and then `/grok-build:stop <run-id>`.

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

Under the hood (conceptually, plugin `0.2.1`):

```bash
grok -p <prompt> --agent explore --always-approve --sandbox read-only --cwd <ws> --output-format plain
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
| `--resume` / `--resume-last` | Continue the last stored Grok session (`grok -r <id>`) |
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
7. **Headless profile** — every bridge run (review, critique, delegate) uses the loop-owned `GROK_HOME` (exported before the Claude session starts) and passes `npm run check:headless -- --grok-home "$GROK_HOME"` first; add `--claude-settings <file>` or `--claude-bare` only when the loop also launches a headless `claude -p`. Never the interactive `~/.grok` ([Headless Profile](#headless-profile)).

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
| `GROK_HOME` | Grok config home. Point it at a loop-owned copy of `templates/headless-agent-home/grok/` for headless runs; the bridge inherits it, nothing sets it |
| `GROK_MANAGED_CONFIG` | Observed with grok 1.0.41, undocumented: `false` also stops the removal of unsigned policy files at session start. The gate does not accept it as a substitute for `fail_closed = true` |
| `NOEMI_HEADLESS` | Contract, not yet wired: a launcher exports `1` before it starts a headless CLI, and loop-owned hooks exit at once when it is set ([contract section 10](orchestrator-runtime-contract.md#10-headless-execution-control)). Nothing sets or reads it today |

State fallback when `CLAUDE_PLUGIN_DATA` is unset: `$TMPDIR/grok-cc-runs`.

## Strengths

- Real Grok Build CLI under a clear permission model  
- Plugin-owned lifecycle (runs / show / stop) without a broker service  
- Clean separation of review-only vs write-capable paths  
- Session import for Claude → Grok handoff  
- Good fit for multi-model Diligence (independent challenge pass)

## Weaknesses And Failure Modes

- Requires a working local `grok` install and auth; silent unavailability is a common first failure  
- Inherits the interactive profile unless `GROK_HOME` is redirected; an interactive hook stalls a finished run for 600 s per turn at Grok's default gate timeout and the bridge cannot tell ([Headless Profile](#headless-profile))  
- Teams can confuse Claude background tasks with bridge background workers — prefer bridge `--background` for stop ownership  
- Direct `node …/grok-bridge.mjs run` is read-only by default; forgetting `--write` (or the delegate path) yields plan-only behavior  
- Review and critique intentionally refuse to fix; users may misread that as “the bridge cannot edit”  
- Not a replacement for Phase 0 SecretOps or for pinned Gemini 3.6 Flash reference workflows in this repository  

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Plugin commands missing | `/plugin install grok-build@xai-grok-build` then `/reload-plugins` |
| Check fails on `grok` | Install CLI; set `GROK_BINARY` if not on PATH |
| Check fails on auth | Interactive `grok` login; confirm `grok models`. Need an API key? xAI console, or a Project NoéMI starter key from USD 1 ([noemi.newpush.com](https://noemi.newpush.com)); inject with `infisical run` / `op run`, never paste into chat |
| Background run with no output | `/grok-build:runs` then `/grok-build:show <run-id>` |
| Run will not die | `/grok-build:stop <run-id>` (kills agent + bridge trees) |
| Delegate seems stuck | Ensure you used the subagent path, not a recursive skill/command re-entry |
| Run stays `running` after Grok finished; log ends at `Running grok`; `show` says no run | An interactive hook is holding the `Stop` gate. Read the result from `$GROK_HOME/sessions/<url-encoded cwd>/<threadId>/updates.jsonl`, `/grok-build:stop <run-id>`, then run under a loop-owned `GROK_HOME` ([Headless Profile](#headless-profile)) |
| `npm run check:headless` exits non-zero | 1: `GROK_HOME` is `~/.grok`, the pin or `fail_closed` is missing, or the `--claude-settings` file carries hooks, is missing, is invalid JSON, or is not a JSON object. 2: usage error. 3: a policy file could not be read. Fix the profile, do not disable the check |
| Pin was there yesterday, gone today | grok 1.0.41 removes an unsigned `requirements.toml` at session start unless it sets `fail_closed = true`; re-copy the template and verify with `grok inspect` |
| Want Grok outside Claude | `/grok-build:import` then `grok -r <id>` |

## Scope vs. Repository Baselines

| Surface | Model / tool policy |
|---------|---------------------|
| Interactive Claude Code co-work | Claude host models + optional Grok / Codex bridges |
| Orchestrator routing matrix | Claude models + Codex (`gpt-5.5`) when that plugin is present; Grok as peer bridge for review/rescue |
| Pinned lab / example / smoke workflows in this repo | Remain on **Gemini 3.6 Flash** per coding standards — the Grok bridge does not repoint them |

## Recommended Next Docs

- [`../examples/grok-claude-plugin-prompt.md`](../examples/grok-claude-plugin-prompt.md) — copy-paste prompt for Claude to install the plugin  
- [`claude-code-local-workspace.md`](claude-code-local-workspace.md) — Claude Code as a local agentic workspace  
- [`openai-codex-local-workspace.md`](openai-codex-local-workspace.md) — peer bridge pattern for OpenAI Codex  
- [`agentic-local-workspaces.md`](agentic-local-workspaces.md) — Gemini / Claude / Codex taxonomy  
- [`../agents/engineering/orchestrator/README.md`](../agents/engineering/orchestrator/README.md) — model selection and multi-model delegation  
- [`secure-secret-management.md`](secure-secret-management.md) — Fetch-on-Demand SecretOps  
- [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md) — runtime ownership expectations  

## Official References

- [Grok Build ↔ Claude Code Bridge (upstream, 0.2.1)](https://github.com/xai-org/grok-build-plugin-cc)  
- [xAI / Grok Build](https://x.ai)  
- [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code/overview)  
- Agent persona: [`agents/engineering/orchestrator.md`](../../agents/engineering/orchestrator.md)  
