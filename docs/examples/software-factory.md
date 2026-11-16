# Software Factory: Specialized Agents and Recurring Work

A software factory is the step after one person working with one agent: several specialized, long-lived agents each own one part of the work, routines start that work on a schedule or an event, and verification and review gates keep quality steady as volume rises. A kitchen brigade is a useful picture: each station has one job, a written recipe, and a pass where every plate is checked before it leaves.

The talk this guide draws on, Lauren Tan's (@poteto) ["All Code Is Slop (Except Mine)"](https://ai.engineer/code/2026/talks/lauren-tan) (AI Engineer CODE 2026), puts the order plainly: improve the code agents learn from, make constraints executable, give agents a strong way to test behaviour, and only then expand the automation that runs them repeatedly. This guide follows that order.

## Order of Construction

1. **Verification inner loop first.** Each kind of work needs a written done bar and a verification skill before it is automated. See [verification skills](verification-skills.md).
2. **Specialized roles.** Split work so each agent has one job, one identity per system, and an escalation path. A generalist agent with every permission is the opposite of a factory.
3. **Recurring triggers.** Turn repeated manual starts into routines: on a schedule, or on an event such as a new issue.
4. **Gates between stations.** Work passes from producer to reviewer to a human decision. No station approves its own output.
5. **Quality metrics.** Watch the signals that show quality is slipping, and slow the line when they move.

## How This Repository's Issue Loop Is Built

The [issue coding loop](../architecture/issue-coding-loop.md) in [`coding-loop/`](../../coding-loop/) is a small factory with separate stations and identities:

| Station | Identity | Does | Does not |
|---|---|---|---|
| Stage A–B′: intake, plan, plan red-team | `noemi-conductor` | Reads the issue, checks it is sufficient, drafts and critiques a plan, comments and labels | Write code or open PRs |
| Stage C: implement | `noemi-agent` | Opens a branch and a PR | Approve or merge |
| Stage D: review | `noemi-reviewer-bot[bot]` | Posts premise, framing, code, and compliance findings | Author code, approve, or merge |
| Merge | Human | Approves and merges | Hand that act to a machine identity |

Every run names a requester with write access, and untrusted input (issue text, paths, plans) fails closed. Passing `--profile spec` points the same loop at personas and skills, with [`scripts/audit-repo.js`](../../scripts/audit-repo.js) as the oracle. To build your own copy, start with [`build-your-coding-loop.md`](build-your-coding-loop.md) and the [labs](coding-loop-labs/README.md).

## Hosted Bot Teams

The same structure applies to hosted bots that handle operations rather than code. The [Grok Bot swarm deploy playbook](../tool-usages/grok-bot-swarm-deploy-agent.md) and [organization chart guide](../tool-usages/grok-bot-org-board-guide.md) assign one function per bot, and the [autonomous operations guide](../tool-usages/grok-bot-autonomous-operations.md) describes the skills, done bars, and stop rules that keep each station reliable.

## Signals to Watch

Pick a few signals you can read from the systems you already have, and review them on a fixed cadence:

- **Override rate:** how often humans merge over a failing review, from the [calibration log](../reviews/CALIBRATION.md).
- **Reverts:** PRs reverted after merge, linked to the station that produced them.
- **Repeat findings:** the same review finding on different PRs, which signals a missing control (see [agent gardeners](../governance/agent-gardeners.md)).
- **Stalls:** runs that waited on a person or timed out, which signals a missing stop rule.

When a signal moves the wrong way, reduce volume on that path and fix the cause before scaling back up. That is the reverse of [trust scaling](trust-scaling.md).

## Done Bar

A path is ready for factory-style automation when it has a verification skill that fails on bad samples, a separate producer and reviewer identity, a human decision point that cannot be bypassed, and at least one quality signal with a named owner who reviews it.

## What This Guide Does Not Cover

It does not set volume targets or claim throughput figures. It does not authorize removing human approval from merges, deploys, spending, or external messages.

Related: [trust scaling](trust-scaling.md), [verification skills](verification-skills.md), [agent-friendly architecture](agent-friendly-architecture.md).
