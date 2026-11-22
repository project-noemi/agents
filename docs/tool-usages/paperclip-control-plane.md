# Portable Org Board for a Multi-Provider Workforce

The [Grok Bot swarm playbook](grok-bot-swarm-deploy-agent.md) deploys a company on the hosted Grok Bot product: one vendor, one hosted swarm, bots created by a first bot after the owner approves the chart.

This page is the other deployment. One organization board seats agents from more than one provider. The control plane for that board runs in the organization's own environment, including a private cloud. Domain knowledge stays in this repository.

[Paperclip](https://paperclip.ing/) (`paperclipai/paperclip`, MIT) is the control plane this guide uses. The pattern is portable: another board that can hold the same chart, the same skills, and a mixed roster can replace it. Paperclip is not a new model baseline, and it is not the host of the issue-coding loop.

## Two ways to staff the same chart

Both deployments use the completeness chart in [`grok-bot-org-board-guide.md`](grok-bot-org-board-guide.md). A seat may be a bot, a human, or both. An empty function is still a gap. Starter skills stay generic. Company-specific procedures are added after bootstrap. Neither deployment creates external accounts or spends money on its own.

| | Hosted Grok Bot swarm | Portable org board |
| --- | --- | --- |
| Where the board runs | Grok's hosted product | A control plane the organization runs, including a private cloud |
| Who can sit on it | Grok Bots, plus human owners | Claude, Gemini, Grok Build, Grok Bot, Codex, Cursor, and other adapters on one board |
| How a new seat appears | The first bot creates the rest after the owner approves the chart | A human board hires or invites each seat and assigns its adapter |
| What moves if you change vendors | The swarm is tied to that host | The chart, goals, and skills move with the repository. Swap the adapter, keep the seat |
| What you operate | Bot instructions and connectors on the host | The control plane, its data directory, and each provider credential |

Use the swarm playbook when the company wants the hosted Grok Bot product and a single-vendor roster. Use this page when the company wants one board for several providers, or wants the board's data on infrastructure it controls.

## What each side owns

| Layer | Owns |
| --- | --- |
| This repository, or a private `{company}-agents` copy that syncs from it | Personas, skills, MCP protocols, `AGENTS.md` layers |
| The control plane | Org chart, company goal, tasks, budgets, heartbeats, board approvals, the run record |
| GitHub on this repo | `noemi-agent` opens pull requests. A human approves and merges into `develop` |

A staged skill in a heartbeat workspace is a copy. The repository remains the source. A board approval hires, pauses, or overrides an agent. It does not approve a pull request on this repo. Producer, conductor, and reviewer stay separate identities (`docs/MACHINE_IDENTITY.md`).

Any runtime on the board still has to meet [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md): identity, secret resolution, approval gates, and observability sit outside the persona file.

## Fit with NoéMI and open-book management

The control plane does not use these names. This is how a NoéMI deployment reads a board. The 4D names are Delegation, Description, Discernment, and Diligence.

| Principle | On the board | NoéMI alignment |
| --- | --- | --- |
| Open the books | Per-agent and company budgets, cost summary | Diligence. Recorded usage is visible. A flat subscription fee may not appear in that total |
| Critical Number | Company goal every task traces to | Line-of-sight from a seat's work to a measurable outcome |
| MiniGames | Projects on the task board | Time-boxed, owned work with a score |
| Keep score | Shared board, activity log, approvals | The human board is the operational Diligence gate |
| Stake in the outcome | Visible budgets, goals, and approvals | The board owns the outcome. The repository owns the knowledge |
| Governance | Approval before a hire or a sensitive action. Pause and resume | Discernment and Phase 0 |

Every agent reports to exactly one manager. Map the seats onto the completeness chart. Combined seats are allowed.

## Who can sit on the board

One company, several adapters. Each seat has its own runtime and its own provider credential. They share the goal, the tasks, and the reporting lines.

| Seat | How Paperclip runs it |
| --- | --- |
| Claude Code | `claude_local` |
| Gemini CLI | `gemini_local` |
| Grok Build | `grok_local`. Resumes with `--resume`. Stages `Agents.md` and skills under `.claude/skills` |
| Grok Bot | Experimental external agent. Needs assistant connections (MCP) and Paperclip Runner. This is an existing hosted bot invited onto the board, separate from `grok_local` |
| Codex, Cursor, OpenCode, Pi, Hermes, Kimi | The matching local adapter. See the [adapter overview](https://docs.paperclip.ing/reference/adapters/overview/) |

Paperclip Runner (`paperclip_runner`) is the experimental native lifecycle. Grok Build is one of its harnesses. Its Grok usage accounting is not qualified: a run with no recorded cost is unknown spend.

The published Docker image pre-installs `claude`, `codex`, `opencode`, and `gemini`. It does not pre-install the Grok CLI. A Grok Build seat on that image needs the CLI installed on the host that runs the adapter.

Budgets are monthly, in cents, at company and agent scope. At 80% the seat should stay on critical tasks. At 100% Paperclip auto-pauses it.

## Run the control plane in a private cloud

Run one control plane per organization, on infrastructure that organization controls. A private cloud, a VM, or an LXC in a facility the organization already operates (Proxmox is the example) keeps the org chart, tasks, secrets, and run record inside that boundary. Put it behind Cloudflare Tunnel or Cloudflare Access, or a private network such as Tailscale. Do not publish the application port.

Paperclip calls this `authenticated` + `private`: login required, private network. `local_trusted` is a single operator on a laptop. `authenticated` + `public` is an internet-facing hostname and needs an explicit public URL.

**Planning envelope for a pilot**, not a vendor minimum: 2–4 vCPU, 4–8 GB RAM, 40–100 GB SSD. Heartbeats are short. Disk grows with workspaces and logs. The team that runs the host should replace these numbers with their standard size.

Outbound internet is required for model APIs and git.

### Install

Local pilot, Node.js 24.11 or newer:

```bash
npx paperclipai onboard --yes
```

From a source checkout the docs also use `pnpm paperclipai onboard`.

Private-cloud server, without installing Node on the host: the published image `ghcr.io/paperclipai/paperclip:latest`, or the compose quickstart in the Paperclip repository (`docker/docker-compose.quickstart.yml`). The app listens on port `3100`. Bind the data directory so it survives restarts. Embedded Postgres in that directory is enough for a pilot. Use external Postgres for production ([database](https://docs.paperclip.ing/reference/deploy/database/)).

### Secrets

Two values must exist before a durable start, each from a fresh `openssl rand -hex 32`, and both must stay the same across restarts:

- `BETTER_AUTH_SECRET` signs sessions. Compose and the published image refuse to start without it.
- `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET` signs approval-gated tool actions.

Resolve them from the vault at runtime (`infisical run` or `op run`). Do not commit them. The data directory also holds the local secrets key. Back up that directory with the two signing secrets. Claim the first admin in the browser. The in-container `npx paperclipai auth bootstrap-ceo` hint does not work inside the published image.

## How agents learn

1. Keep skills and instruction layers in this repository, or in the organization's private copy. Sync that copy from upstream.
2. Point the company at that tree. On each heartbeat the control plane stages the skills into the seat's workspace and injects the current goal, task, reporting line, and remaining budget.
3. A Claude seat, a Gemini seat, a Grok Build seat, and an invited Grok Bot share that board. Each keeps its own adapter.

`GEMINI.md` and `CLAUDE.md` stay generated. A copy staged into a workspace is not a new source.

## Pilot checklist

- [ ] Choose this path because the roster is mixed, or because the board must run in the organization's private cloud
- [ ] Provision the VM or LXC with the envelope above, or with the host team's standard size
- [ ] Deploy with Docker Compose, the published image, or `npx paperclipai onboard --yes` for a local pilot
- [ ] Place the service on a private network. Do not expose port 3100
- [ ] Use `authenticated` + `private`. Store both signing secrets and a backup of the data directory
- [ ] Create one company and map a small set of functions from the completeness chart
- [ ] Hire at least two seats on different adapters (for example Claude and Gemini, or Grok Build and Claude)
- [ ] Point skills and `AGENTS.md` layers at this repository or the private `{company}-agents` copy
- [ ] Set the company goal (the Critical Number for this pilot)
- [ ] Confirm a human can approve a hire, pause a seat, and override a run
- [ ] Treat a Grok run with no recorded cost as unknown spend

## Open questions for the infrastructure team

- Best method to provision the VM with the required specifications?
- Is automated provisioning available (for example via WHMCS or the team's equivalent)?
- Preferred OS image, storage layout, and firewall rules for a long-running control plane that also spawns agent subprocesses?
- Backup, snapshot, and monitoring expectations for the data directory and the two signing secrets?

## References

- [Grok Bot swarm playbook](grok-bot-swarm-deploy-agent.md) — the hosted, single-vendor deployment
- [Organization chart](grok-bot-org-board-guide.md) — the completeness chart both deployments staff
- [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md)
- [Paperclip documentation](https://docs.paperclip.ing/)
- [Deployment overview](https://docs.paperclip.ing/reference/deploy/overview/)
- [Docker](https://docs.paperclip.ing/reference/deploy/docker/)
- [Adapters](https://docs.paperclip.ing/reference/adapters/overview/)
- [Grok Local adapter](https://docs.paperclip.ing/reference/adapters/grok-local/)
- [External agents, including Grok Bot](https://docs.paperclip.ing/experimental/external-agents/)
