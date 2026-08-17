# Coding Loop

In-repo runtime for the issue-coding loop. Specs stay in `agents/`, `skills/`,
and `docs/architecture/issue-coding-loop.md`. This directory is the host,
the same way `scripts/review-pr.js` hosts fleet review.

There is no second GitHub repository. Do not implement this in
`newpush/newpush-mastra-orchestration` (that is NewPush’s Slack / Datto
chatbot).

## Stage A

```bash
node coding-loop/run.js --repo owner/name --issue N
```

`--post` applies conductor labels and requires `CONDUCTOR_GH_TOKEN`. The
producer and reviewer tokens are refused.

Hard gates (skip, bot, empty body, tenant, scan, budget) never return
`ACTIONABLE`. Sufficiency is a later model call.

## Next

Mastra webhook and Stages B / B′ land in this directory, not in a new repo.
