# Paperclip as Control Plane for NoéMI Agents

[Paperclip](https://paperclip.ing/) (`paperclipai/paperclip`, MIT) is an open-source control plane that runs AI agents as a company: an org chart, tasks, company goals, per-agent and company budgets, heartbeats, and human approvals. It does not replace this repository. Agents still load domain knowledge, skills, and procedures from `project-noemi/agents` or from a private `{company}-agents` copy that syncs **from** this repo. Paperclip supplies the live organizational context for a heartbeat: the company goal, the assigned task, the reporting line, and the remaining budget.

This page is a deployment guide for that split. It is not a runtime contract change, and it does not make Paperclip the host of the issue-coding loop.

## What each side owns

| Layer | Owns | Does not own |
| --- | --- | --- |
| This repository (or the private `{company}-agents` copy) | Personas, skills, MCP protocols, `AGENTS.md` layers, the coding loop | Live task assignment, spend caps, or who is on the clock |
| Paperclip | Org chart, goals, tasks, budgets, heartbeats, board approvals, the run record | Domain truth. A staged skill in a heartbeat workspace is a copy, not the source |
| GitHub on this repo | `noemi-agent` opens pull requests; a human approves and merges into `develop` | Paperclip board approval is not a GitHub review |

Paperclip's own README states the same boundary: it orchestrates work and is not a code-review tool. Bring the existing review process. Producer, conductor, and reviewer stay separate identities (`docs/MACHINE_IDENTITY.md`).

The orchestrator around any of these runtimes still has to meet [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md): identity, secret resolution, approval gates, and observability sit outside the persona file.

## Fit with NoéMI and open-book management

Paperclip does not use these names. This table is how a NoéMI deployment reads its features. The 4D names are Delegation, Description, Discernment, and Diligence.

| Principle | Paperclip feature | NoéMI alignment |
| --- | --- | --- |
| Open the books | Per-agent and company budgets, cost summary | Diligence. Token and compute cost is visible. Recorded usage is not a flat subscription fee |
| Critical Number | Company goal every task should trace to | Line-of-sight from an agent's task to a measurable outcome |
| MiniGames | Projects on the task board | Time-boxed, owned work with a score |
| Keep score | Shared board, activity log, approvals | The human board is the operational Diligence gate |
| Stake in the outcome | Visible budgets, goals, and approvals | Ownership stays with the board. Knowledge stays in the repo |
| Governance | Approval gates for hires and sensitive actions; pause and resume | Discernment and Phase 0. Unknown budget or an unscanned secret is a stop |

Every agent reports to exactly one manager. Map seats onto the completeness chart in [`grok-bot-org-board-guide.md`](grok-bot-org-board-guide.md) when the company must cover those functions. A seat may be a bot, a human, or both. An empty function is still a gap. Hosted Grok Bot swarms and a Paperclip company are different products: Grok Bot is the hosted assistant; `grok_local` is the Grok Build CLI adapter. Do not treat a Paperclip hire as a Grok Bot deploy.

## Adapters

A heartbeat looks up the agent's adapter, passes company and task context, and records the result. Several adapters can sit in one company and share the same goals and board.

| Runtime | Adapter | Notes |
| --- | --- | --- |
| Claude Code | `claude_local` | Session persistence and skills sync |
| Gemini CLI | `gemini_local` | Resume and local skills sync |
| Grok Build | `grok_local` | Resumes with `--resume`. Stages instructions as `Agents.md` and skills under `.claude/skills` |
| Codex, Cursor, OpenCode, Pi, Hermes, Kimi | matching local adapter | See the [adapter overview](https://docs.paperclip.ing/reference/adapters/overview/) |
| Paperclip Runner | `paperclip_runner` | Experimental native lifecycle. Grok Build is one harness. Native Grok usage accounting is not qualified: a missing cost is not zero spend |

The published Docker image pre-installs `claude`, `codex`, `opencode`, and `gemini`. It does not pre-install the Grok CLI. A Grok agent on that image needs the CLI installed and authenticated on the host that runs the adapter.

Budgets are monthly, in cents, at company and agent scope. Adapters report token cost after a heartbeat. At 80% the agent should stay on critical tasks. At 100% Paperclip auto-pauses the agent. Flat vendor subscriptions are not in that total.

## Recommended deployment

Self-host the control plane. For a regulated or security-sensitive environment, prefer a private VM or LXC on infrastructure the organization already controls (Proxmox is the example), then put it behind Cloudflare Tunnel or Cloudflare Access, or an equivalent private path such as the Tailscale setup in Paperclip's own docs. Do not publish the application port.

Use Paperclip's `authenticated` + `private` mode (login required, private network). `local_trusted` is for a single operator on a laptop. `authenticated` + `public` is for an internet-facing hostname and needs an explicit public URL.

**Planning envelope for a pilot**, not a vendor minimum: 2–4 vCPU, 4–8 GB RAM, 40–100 GB SSD. Heartbeats are short, so the control plane itself is modest. Disk grows with workspaces and logs. The team that runs the host should replace these numbers with their standard VM size.

Outbound internet is required for model APIs and git. Heartbeats are scheduled or invoked, so latency from the control plane to a distant user is rarely the limit.

### How to install

Local pilot, Node.js 24.11 or newer:

```bash
npx paperclipai onboard --yes
```

From a source checkout the docs also use `pnpm paperclipai onboard`.

Server, without installing Node on the host: the published image `ghcr.io/paperclipai/paperclip:latest`, or the compose quickstart in the Paperclip repository (`docker/docker-compose.quickstart.yml`). The app listens on port `3100`. Bind the data directory so it survives restarts. Embedded Postgres in that directory is enough for a pilot. Use external Postgres for production ([database](https://docs.paperclip.ing/reference/deploy/database/)).

### Secrets

Two values must exist before a durable start, each from a fresh `openssl rand -hex 32`, and both must stay the same across restarts:

- `BETTER_AUTH_SECRET` signs sessions. Compose and the published image refuse to start without it.
- `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET` signs approval-gated tool actions.

Resolve them from the vault at runtime (`infisical run` or `op run`). Do not commit them, and do not write them into a tracked env file. The data directory also holds the local secrets key. Back up that directory with the two signing secrets. Losing the key makes stored secrets unreadable. Claim the first admin in the browser. The in-container `npx paperclipai auth bootstrap-ceo` hint does not work inside the published image.

## How agents learn

1. Keep skills and instruction layers in this repository, or in the organization's private copy. Sync private copies from upstream. Do not invent the general rules only in the private copy.
2. Point the Paperclip company at that tree. On a heartbeat, Paperclip stages the skills into the agent workspace and injects the current goal, task, reporting line, and remaining budget.
3. Claude, Gemini, and Grok agents in the same company share that board. Each one still runs its own adapter and its own provider credential.

Generated context files (`GEMINI.md`, `CLAUDE.md`) stay generated. Do not hand-edit them into a Paperclip workspace and treat that copy as source.

## Pilot checklist

- [ ] Provision the VM or LXC with the resources above, or with the host team's standard size
- [ ] Deploy with Docker Compose, the published image, or `npx paperclipai onboard --yes` for a local pilot
- [ ] Place the service behind Cloudflare Tunnel or Access, or a private network. Do not expose port 3100
- [ ] Use `authenticated` + `private`. Store both signing secrets and a backup of the data directory
- [ ] Create one company and map a small set of NoéMI roles onto the org chart
- [ ] Point skills and `AGENTS.md` layers at this repository or the private `{company}-agents` copy
- [ ] Set the company goal (the Critical Number for this pilot)
- [ ] Confirm a human board member can approve a hire, pause an agent, and override a run
- [ ] Confirm a Grok run that shows no cost is treated as "cost unknown," not as free

## Open questions for the infrastructure team

- Best method to provision the VM with the required specifications?
- Is automated provisioning available (for example via WHMCS or the team's equivalent)?
- Preferred OS image, storage layout, and firewall rules for a long-running control plane that also spawns agent subprocesses?
- Backup, snapshot, and monitoring expectations for the data directory and the two signing secrets?

## References

- [Paperclip documentation](https://docs.paperclip.ing/)
- [Deployment overview](https://docs.paperclip.ing/reference/deploy/overview/)
- [Docker](https://docs.paperclip.ing/reference/deploy/docker/)
- [Adapters](https://docs.paperclip.ing/reference/adapters/overview/)
- [Grok Local adapter](https://docs.paperclip.ing/reference/adapters/grok-local/)
- [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md)
- [`grok-bot-org-board-guide.md`](grok-bot-org-board-guide.md)
