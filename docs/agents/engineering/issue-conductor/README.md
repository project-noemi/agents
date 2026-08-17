# Issue Conductor — Fleet Loop Guide

The Issue Conductor owns the **fleet issue-coding loop**: every new issue in
the operated orgs is triaged, specified, planned, and independently
red-teamed before `noemi-agent` is allowed to open a PR.

This repository holds the **spec**. The first host is Mastra
(`newpush/newpush-mastra-orchestration`). The `noemi-conductor` GitHub
identity is **planned, not provisioned**.

| Item | Location |
|---|---|
| Persona | `agents/engineering/issue-conductor.md` |
| Architecture | `docs/architecture/issue-coding-loop.md` |
| Model contract | `docs/model-routing.json` |
| Entitlements schema | `docs/entitlements.schema.json` |
| Internal tenant | `tenants/internal.json` |
| Intake skill | `skills/classification/issue-intake.md` |
| Plan skill | `skills/orchestration/issue-plan.md` |
| Decision | [2026-08-16-0004] |

## What it is not

- Not the session Orchestrator (`agents/engineering/orchestrator.md`), which
  routes models inside Claude Code.
- Not the PR Reviewer. Stage D reuses `noemi-reviewer-bot[bot]`.
- Not a coding agent. Stage C is `noemi-agent`.

## Enablement order (host, after this spec)

1. Provision `noemi-conductor` with Issues read/write only (no Contents write,
   no Pull-request review).
2. Run Stages A / B / B′ on one pilot org with budget caps live.
3. Turn on Stage C (`noemi-agent` PRs) and Stage D (existing reviewer App).
4. Expand to the remaining operated orgs once skip and budget rules have a
   week of evidence.

Do not enable org-wide pickup without `limits.concurrent_jobs` and
`limits.daily_usd`.

## GitHub outages

Every GitHub write this persona asks the host to make (issue comments,
labels, dispatching Stage D) retries 429/5xx via
`scripts/resilience_helpers.js` until GitHub accepts, then re-queues.
See `docs/architecture/issue-coding-loop.md` (**GitHub availability**)
and Decision [2026-08-17-0002]. A 503 is not a product stop.

