# Headless Agent Home

Profiles for agent CLIs that run **without a person at the terminal**. Decision [2026-09-27-0001]; contract in [`docs/tool-usages/orchestrator-runtime-contract.md`](../../docs/tool-usages/orchestrator-runtime-contract.md#10-headless-execution-control).

Today the only such launches in the NoéMI stack are the Grok Build bridge runs (review, critique, and delegate): `grok-bridge.mjs` shelling out to `grok -p` from a Claude Code session, inheriting that session's `GROK_HOME`. The coding loop and CI call models over HTTP and launch no agent CLI. The profile is written for the next launcher as much as for the current one.

## The problem this solves

Desktop tools install agent hooks into the user's profile: dictation apps, notifiers, "keep working until I answer" helpers. Interactively they are useful. In a headless run the agent finishes its work, the hook waits for a person who is not there, and the run reports `running` until the hook's timeout, a watchdog, or an operator ends it. Grok holds a blocking `Stop` gate for 600 s by default (a hook's own timeout can raise it), imports Claude's and Cursor's hook files by default, and discovers Claude plugins from the user's `~/.claude/plugins` in any `GROK_HOME`. One such tool can stall every CLI on the machine.

The fix is a **loop-owned profile with a policy pin**. What it buys over "disable all hooks": it is set once per home instead of per vendor and per invocation, it also covers plugin hooks that no compatibility switch removes, it leaves the interactive profile untouched, and fleet-enforced hooks (root-owned `/etc/grok` files, a console-signed requirements file) still run, which is where a fleet's guardian or audit hooks belong. What it does not buy: hooks of the loop's own inside the home. Under the pin this home runs no hooks at all, and no loop-owned hook exists today; audit and observability for a headless run stay with the orchestrator, per the runtime contract.

## Grok Build

Copy `grok/` to a loop-owned directory and point `GROK_HOME` at it:

```bash
cp -R templates/headless-agent-home/grok "$HOME/.noemi/grok-home"
export GROK_HOME="$HOME/.noemi/grok-home"
```

| File | Purpose |
|------|---------|
| `requirements.toml` | `allow_managed_hooks_only = true` skips every non-enforced hook at dispatch: plugin, project, user, this home's own, and the Claude and Cursor imports. `fail_closed = true` keeps the file: without it grok 1.0.41 removes an unsigned requirements file at session start and the pin lasts one launch. |
| `config.toml` | Switches the Claude and Cursor imports off for skills, rules, instruction files, and MCP servers as well as hooks. |

For the bridge commands (`/grok-build:review`, `:critique`, `:delegate`) the export is a manual step today: set `GROK_HOME` in the shell before starting the interactive `claude` session, because the bridge passes only the environment it inherits and nothing in the plugin or this repository sets it.

**Verify after the first launch.** `grok inspect` run with the new home must list the pin under **Enforced by policy** as "Hooks outside managed policy disabled" with the path of this `requirements.toml`. Its **Hooks** list still shows the discovered plugin hooks with no status marker, and the Claude and Cursor imports appear only under Harness Compatibility as `hooks OFF (config)`; all are skipped at dispatch. The `[disabled]` markers appear only in the `/hooks` panel of an interactive session.

**Auth lives in the home.** A fresh `GROK_HOME` has no session. Either sign in once inside it (`GROK_HOME=... grok login --device-code`), or inject `XAI_API_KEY` at run time with `infisical run` / `op run` per [`docs/tool-usages/secure-secret-management.md`](../../docs/tool-usages/secure-secret-management.md). Do not copy auth files between homes in scripts.

Observed, undocumented: exporting `GROK_MANAGED_CONFIG=false` also stops grok 1.0.41 from removing the policy files. The gate does not accept it in place of `fail_closed`, which is the documented mechanism.

## Claude Code

Two options, by how much of the profile the run needs:

- `claude --bare -p ...` for scripts: skips hooks, plugins, MCP servers, and CLAUDE.md discovery.
- `claude --settings templates/headless-agent-home/claude/settings.headless.json -p ...` when the run still needs plugins, MCP, and CLAUDE.md. `disableAllHooks` takes precedence over user, project, and local settings for that invocation.

Neither mode runs the repository's own `.claude/settings.json` hooks. Neither this repository nor the platform ships a loop-owned Claude hook today; how one would be delivered to a headless run is an open design point and must be verified against the Claude Code documentation for the version in use before it is relied on.

## Before every dispatch

```bash
npm run check:headless -- --grok-home "$GROK_HOME"
```

Add `--claude-settings templates/headless-agent-home/claude/settings.headless.json` (or `--claude-bare`) only when the loop also launches a headless `claude -p`; a bridge run from the interactive host session has no headless Claude side, so the gate runs on Grok alone. The gate exits 1 when the Grok home is the interactive default, when the pin is missing from both policy files, when `fail_closed` is missing, or when the `--claude-settings` file carries hooks, is missing, is invalid JSON, or is not a JSON object; 2 is a usage error and 3 a read fault on a policy file. Nothing invokes it automatically yet: the dispatcher runs it by hand and treats any non-zero exit as a stop. Outside this repository run it from a checkout: `node <agents-checkout>/scripts/check-headless-hooks.js`.

## What this does not do

- It does not choose the sandbox or permission mode. The bridge does (`--sandbox read-only` with `--always-approve`, or `--permission-mode`, in plugin 0.2.1); no loop stage launches a CLI today.
- It does not detect completion. The orchestrator must read the agent's turn-complete event or transcript and end idle runs as `stalled`; see the contract.
- It does not remove plugins from discovery. `grok inspect` still lists them; the pin skips their hooks at dispatch.
- It does not remove hooks from the interactive profile. That profile stays as the person configured it.
