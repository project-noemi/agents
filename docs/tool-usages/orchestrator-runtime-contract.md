# Orchestrator Runtime Contract

Project NoeMI defines personas, skills, policies, and reference topologies. The orchestrator is responsible for turning those assets into a governed runtime.

This document describes the canonical runtime contract expected around the repository's agents. It is the missing layer between "the repo says what the agent is" and "a real system runs the agent safely."

## Core Principle

The repository does not verify identity, authorization, secret resolution, observability, and execution control by itself. Those responsibilities belong to the surrounding orchestrator, ingress layer, workflow engine, or runtime platform.

This contract applies equally to n8n, Gemini CLI, Claude Code, Codex, **Grok Build**, and — when used — **Grok Bot**. Grok Bot's shared cloud computer is not a tenant or credential boundary; approval gates still sit in the orchestrator, not in the persona file.

## 1. Identity and Authorization

### What the orchestrator owns

- authenticate the human or system invoking the workflow
- enforce role-based access before a persona is invoked
- decide whether the caller is allowed to use a high-risk agent or MCP
- prevent privilege escalation across agents, tenants, and environments

### What the agent should not assume

- raw Casdoor token parsing
- direct user-session validation
- standalone RBAC enforcement without orchestration support

### Recommended pattern

1. identity is verified at ingress or workflow-entry level
2. the orchestrator maps that identity to an allowed persona and action set
3. the agent receives only the minimal identity context it needs:
   - tenant or workspace identifier
   - user role or policy tier
   - request or trace identifier
4. raw identity tokens remain outside the agent context whenever possible

This keeps the repo aligned with the current decision that identity verification is primarily an orchestrator or ingress concern.

## 2. Secret Resolution

The orchestrator must preserve the repository's Fetch-on-Demand policy:

- use `infisical run` or `op run`
- inject secrets into process memory at runtime
- never hand the agent plaintext secrets through prompts or checked-in files
- keep `.env.template` and `.env.example` as inventories or vault-reference manifests only

## 3. Execution Contract

For a clean runtime boundary, the orchestrator should treat agent execution as having three outputs:

### Primary payload

- the user-facing or downstream-facing answer
- usually written to `stdout` or returned as the workflow's main result

### Technical errors

- operational failures, stack traces, dependency issues, retry exhaustion
- should be written to `stderr`

### Audit log

- the lightweight structured JSON record required by `AGENTS.md`
- must be emitted separately from the primary payload
- must exclude secrets, credentials, and PII

The repository standardizes the minimum audit shape but does not force one transport for every orchestrator. A workflow engine may store it as a side-channel JSON field, a log event, or another machine-readable trace record.

## 4. Observability Contract

At minimum, the orchestrator should capture:

- agent or persona identifier
- task or workflow name
- request or trace id
- tenant or workspace identifier when multi-tenant
- start time and finish time
- success or failure status
- retry count when retries occur
- separate technical error output
- separate audit-log record

### Recommended sinks

- local builder home: container logs plus minimal runtime inspection
- fleet operator home: Loki/Grafana or equivalent centralized observability
- specialist home: service-specific metrics and dashboard plumbing

## 5. Human Approval Boundaries

The orchestrator must enforce the repository's "ask first" and "human-in-the-loop" intent for mutating actions.

Examples:

- sending email
- merging or closing pull requests
- changing infrastructure or permissions
- deleting data
- executing production-impacting workflows

The persona can describe the boundary, but the orchestrator must implement the stop.

## 6. Failure Handling

The orchestrator should implement:

- graceful degradation when MCPs or external services fail
- exponential backoff for transient failures and rate limits
- explicit user-facing explanation when a fallback path is used
- bounded retries rather than infinite loops

Use the repository's reference helper where useful:

- [`../../scripts/retry-with-backoff.sh`](../../scripts/retry-with-backoff.sh)

## 7. Multi-Tenant Safety

For MSP, cohort, or fleet deployments:

- isolate secrets by tenant
- isolate orchestrator config by tenant
- do not reuse write-capable credentials across client boundaries
- carry tenant identity through logging, alerts, and audit records
- ensure one tenant's agent cannot report or act as another tenant's agent

This is especially important for stacks built on:

- [`../examples/msp-deployment.md`](../examples/msp-deployment.md)
- [`../examples/docker-agent-home.md`](../examples/docker-agent-home.md)
- [`../../examples/fleet-deployment/`](../../examples/fleet-deployment/)

## 8. Recommended Runtime Envelope

When an orchestrator invokes an agent, the surrounding envelope should include:

- the resolved persona or context file
- allowed MCP set
- tenant or workspace scope
- request id
- human approval state when relevant
- minimal identity claims

It should not include:

- raw vault secrets in prompt text
- unnecessary PII
- broad cross-tenant credentials
- raw identity tokens unless absolutely required

## 9. Relationship to the Docker Examples

Use the examples as reference homes:

- [`../examples/docker-agent-home.md`](../examples/docker-agent-home.md) for local builder shape
- [`../examples/docker-runtime-verification.md`](../examples/docker-runtime-verification.md) for boot verification
- [`../examples/msp-deployment.md`](../examples/msp-deployment.md) for multi-tenant operator framing

The examples show topology. This contract explains the responsibilities the topology must uphold.

## 10. Headless Execution Control

When the orchestrator runs an agent CLI without a person at the terminal, the CLI must not be able to wait for that person. The failure is quiet: the agent finishes its work, a hook or prompt waits for input that never comes, and the run reports `running` until the hook's timeout, a watchdog, or an operator ends it. Decision [2026-09-27-0001].

Today the only such launches in the NoéMI stack are the Grok Build bridge runs: review, critique, and delegate, all `grok-bridge.mjs` shelling out to `grok -p` from a Claude Code session and inheriting that session's `GROK_HOME`. The coding loop and CI call models over HTTP (`coding-loop/writer.js`, `coding-loop/critic.js`, `scripts/review-pr.js`) and launch no agent CLI. This section binds the bridge now and every future launcher.

### What the orchestrator owns

- **Profile isolation.** A headless agent never runs under the interactive user's profile. Grok Build: `GROK_HOME` at a loop-owned home. Claude Code: `--bare`, or `--settings` with `disableAllHooks`.
- **Hooks outside the profile are off by policy, not by convention.** Grok Build: `allow_managed_hooks_only = true` in the loop home's `requirements.toml`, kept in place by `fail_closed = true`. At dispatch the pin skips `$GROK_HOME/hooks`, the home's own `config.toml` and `managed_config.toml` hooks, project hooks, plugin hooks (including Claude plugins Grok discovers from `~/.claude/plugins`), and the Claude and Cursor compatibility imports; only fleet-enforced hooks from root-owned `/etc/grok` files or a console-signed requirements file still run, plus hooks an ACP client registers in-session (none on the bridge path, which runs `grok -p`). Claude Code: `--bare` for pure headless work, otherwise `disableAllHooks: true` through `--settings`; both also disable the repository's `.claude/settings.json` hooks.
- **Completion is detected from the agent's output, not from process exit.** The launcher must treat the turn-complete event, or the final assistant message in the session transcript, as completion: capture the payload, then terminate the process tree after a short grace period. Not implemented anywhere yet: the upstream bridge (`0.2.1`) marks a job finished on process exit only, and no loop stage launches a CLI. Owner: the bridge upstream, and any future loop launcher in this repository.
- **An idle watchdog.** No events and no output for a bounded interval ends the run as `stalled`, with whatever was captured, never as `completed`. Same owners, same status.
- **A readiness gate.** Before dispatch, run `scripts/check-headless-hooks.js` (`npm run check:headless`) against the profile the run will use. It exits 1 when the Grok home is the interactive default, when the pin is missing from both policy files, when `fail_closed` is missing, or when a `--claude-settings` file carries hooks, is missing, is invalid JSON, or is not a JSON object; 2 is a usage error and 3 a read fault on a policy file. Nothing invokes it automatically yet, so the dispatcher runs it by hand and treats any non-zero exit as a stop.

### What loop-owned hooks must do

No loop-owned hook exists today in this repository or in the platform. When one is written:

- it exits immediately when `NOEMI_HEADLESS=1` is set; the launcher exports that variable into the environment of every headless CLI and hooks inherit it. Neither stdin nor a terminal check can serve as the signal: both vendors deliver the hook event as JSON on a pipe, interactive or not
- it never blocks `Stop`, `SubagentStop`, or `UserPromptSubmit` waiting for a person
- it keeps its timeout to seconds; Grok's stop gate defaults to 600 s, so a blocked gate is a ten-minute stall per turn at the default
- it is delivered through an enforced layer for Grok (root-owned `/etc/grok`); for Claude Code the delivery path is an open design point, because both shipped modes (`--bare` and `disableAllHooks`) drop settings hooks, so the profile and the launcher must change together before a loop-owned Claude hook is relied on

### Why not "disable all hooks"

As shipped, the isolated profile runs no hooks at all, and no loop-owned hook exists to lose. What the pin buys over a per-run "disable everything" is structural: it is set once per home instead of per vendor and per invocation; it also covers plugin hooks that no compatibility switch removes; it leaves the interactive profile untouched; and fleet-enforced hooks still run, which is where a fleet's guardian and audit hooks belong. Audit and observability for a headless run stay with the orchestrator (sections 3 and 4), not with hooks inside the agent.

Reference profile: [`../../templates/headless-agent-home/`](../../templates/headless-agent-home/). Bridge-specific detail: [`grok-build-claude-code.md`](grok-build-claude-code.md#headless-profile).
