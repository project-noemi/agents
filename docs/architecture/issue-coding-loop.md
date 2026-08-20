# Issue-Coding Loop

Architecture for turning a GitHub issue into a planned, implemented, and
independently reviewed pull request. This repository remains the spec
library. The **Coding Loop** is a section of *this* repository (`coding-loop/`),
not a second GitHub repo and not `newpush/newpush-mastra-orchestration`.

That NewPush Mastra tree is an internal Slack / Autotask / Datto chatbot
(UNLICENSED). Mixing the coding product into it would hide the runtime and
block `noemi-agent` PRs. A new `project-noemi` repo is **not** required: the
fleet reviewer already runs from this tree (`scripts/review-pr.js`). The loop
follows the same pattern.

The **product loop** (verdicts: skip, refuse, needs-info, accepted, carved-out)
lives in `coding-loop/*.js` plus the personas, skills, and
`docs/model-routing.json`. A **host** (CLI, GitHub Actions, later Mastra, n8n,
Temporal) only triggers, persists, and resumes. Mastra is a *candidate* host
for a long-running webhook and Fable tool-use — not a runtime you must deploy
to use the loop (Decision [2026-08-20-0006]). The NewPush Slack/Datto Mastra
tree remains a different product.

Stage A today is `coding-loop/run.js` (intake then fail-closed sufficiency).
Stage B drafts a plan (`coding-loop/plan.js`). Stage B′ is structural
(headings, files, no skip-red-team) and, with `--live-critic`, Gemini Pro.
`accepted` only on B′ pass; fail at `planRedTeam.maxCycles` is `needs-info`.
A critic outage is retried, then re-queued — never treated as a pass.
`--implement --open-pr` drafts with Grok and opens a `noemi-agent` PR.

Organizations run the loop from a private `{company}-agents` copy (NewPush:
`newpush/newpush-agents`) and sync **from** this repo. How to do that is
`coding-loop/README.md` (short path: `docs/examples/build-your-coding-loop.md`).
Do not invert that flow: do not design the general loop only in the private
copy and paste a sanitized tree back later.

Recorded as Decision [2026-08-16-0004]; host split as Decision [2026-08-20-0006];
spec profile as Decision [2026-08-20-0007].
Labs: [`../examples/coding-loop-labs/README.md`](../examples/coding-loop-labs/README.md).

## Spec profile — writing agents and skills

The same loop deploys for **personas and skills**. It is not a second host and
not a second identity. `--profile spec` (default remains `code`) constrains
Stage B/C to `agents/`, `skills/`, and `docs/agents/`.

| | `code` (default) | `spec` |
|---|---|---|
| Stage C persona loaded | coding (Architect / Grok implementer) | **Skill:** `orchestration/spec-author` plus `docs/AGENT_TEMPLATE.md` or `skills/SKILL_TEMPLATE.md` |
| Allowed paths | any except carve-outs | **markdown** under `agents/`, `skills/`, `docs/agents/` |
| Forbidden | `.github/workflows/**`, CODEOWNERS, identity register | those, plus non-markdown under the prefixes (JSON companions), `skills-dist/`, `GEMINI.md`, `CLAUDE.md`, the templates themselves |
| Oracle | the test named in the issue | `audit-repo.js` + `npm test` (placeholders fail) |
| Identities | unchanged: conductor comments, `noemi-agent` opens, reviewer finds, human merges | same |
| Host | CLI / Actions / later Mastra | same |

Pickup stays `code` unless a caller passes `--profile spec`. A spec issue that
names `coding-loop/run.js` is `profile-path` → refused, not a back door into
the runner.

Generated context is still `node scripts/generate_all.js` after the spec
lands — the writer must not emit `GEMINI.md` by hand.

## Product loop vs orchestration host

This repository owns **verdicts**. A host owns **trigger, persistence, and
resume**. The split is the same as the fleet reviewer (`scripts/review-pr.js`
vs `.github/workflows/ai-review.yml`).

| Layer | Owns | Must not |
|---|---|---|
| Product (`coding-loop/*.js`, skills, `docs/model-routing.json`) | skip / refuse / needs-info / accepted / carve-out; identity checks; model family contract | grow a job queue, webhook server, or conversation memory |
| Host (CLI `run.js` `main()`, Actions `coding-loop.yml`, later Mastra/n8n/Temporal) | when the loop starts, where labels are stored, how a run is re-queued | re-encode `classifyIssue`, default a missing scan to `APPROVED`, post as the wrong identity |

**Current host:** Node CLI plus the reusable workflow
`.github/workflows/coding-loop.yml` (callers pin `@main` after CalVer). Pickup
passes `--scan` explicitly; omitting `--scan` and `--scan-status` is `REFUSED`.

**Plug a different host** (preference order):

1. Import the functions as tools/steps (`classifyIssue`, `scanIssueBody`,
   `completeThroughStageB`, `draftChanges` with injected `callModel`,
   `openImplementationPr` with injected `ghImpl`).
2. Exec `node coding-loop/run.js` with explicit `--scan` / `--budget-ok`
   (what Actions does).
3. Do **not** copy the gates into the framework. That is lock-in.

If swapping the 40-line host requires editing `intake.js`, the architecture
has failed. Lab 6 in the labs guide is that test.

Adopt Mastra (under `coding-loop/`, not the Slack tree) when you need a
long-running webhook or Fable-with-tools. Do not adopt it to get skip/bot/scan
— those already exist.

## Identities

| Stage | Identity | May do | Must not do |
|---|---|---|---|
| A, B, B′ comments and labels | `noemi-conductor` (planned) | Read issues, comment, apply `noemi:*` labels | Write code, open PRs, review PRs, approve, merge |
| C — implement | `noemi-agent` | Open branches and PRs | Approve or merge |
| D — PR red-team | `noemi-reviewer-bot[bot]` | Post review findings | Author code, approve, merge |
| Merge | Human Accelerator | Approve and merge | Hand those acts to any machine identity |

Producer, conductor, and reviewer are three identities. Sharing the reviewer
App with the conductor would mix issue chatter with review findings and
collapse attribution. Sharing `noemi-agent` with the conductor would make the
coding PR look like it was opened by the same actor that planned it. The
conductor App is **planned, not provisioned** — see `docs/MACHINE_IDENTITY.md`.

## Pickup

Every new issue in `newpush`, `project-noemi`, and `newpush-labs` is a
candidate. That is the product rule. The conductor still **must** stop on:

- label `noemi:skip`
- bot authors (`dependabot`, `renovate`, `github-actions`, other `[bot]` users)
- empty or template-only bodies
- entitlement or budget refusal
- PII / prompt-injection block after scan

Those stops are policy, not a retreat from “every issue.”

## Stages

```
GitHub issue opened
        │
        ▼
  Entitlement + policy gate
        │
        ▼
  Checkout project-noemi/agents@<pinned-ref>
        │
        ▼
  Stage A   Fable 5 Max family     triage + sufficiency     (noemi-conductor)
        │
        ├─ underspecified → questions + noemi:needs-info, STOP
        ├─ out of scope / unsafe → noemi:wont-act, STOP
        └─ actionable
                ▼
  Stage B   Fable 5 Max family     plan comment + noemi:planned
                ▼
  Stage B′  Gemini Pro family      red-team the plan
        │
        ├─ fail, cycles < max → revise plan, repeat B′
        ├─ fail, cycles = max → noemi:needs-info, STOP
        └─ pass
                ▼
  Stage C   Grok latest family     implement as noemi-agent → branch + PR
            (effort: xHigh)
                ▼
  Stage D   Gemini Pro family      PR red-team via existing reviewer App
                ▼
  Human Accelerator approves / merges
```

### Stage A — triage and sufficiency

**Skill:** `classification/issue-intake`

Scan the issue body with `security/pii-scan` and apply PromptShield criteria
from `agents/guardian/prompt-shield.md` before any model sees the raw body.
Classify: skip, refuse, needs-info, or actionable. Actionable issues get
`noemi:queued`, then proceed.

### Stage B — plan

**Skill:** `orchestration/issue-plan`

Post a plan comment (goal, files, tests, risks, stop conditions) and apply
`noemi:planned`. Do not start coding.

### Stage B′ — plan red-team cycle

The red-team family (Gemini Pro, same selection rule as the fleet reviewer)
attacks the plan, not the future diff. Verdicts:

- **pass** — proceed to Stage C
- **fail** and `cycle < planRedTeam.maxCycles` — conductor revises the plan
  (Stage B model family) and repeats B′
- **fail** and `cycle == maxCycles` — apply `noemi:needs-info`, comment the
  unresolved findings, **stop**. Never start Stage C on a rejected plan.

Default `maxCycles` is 3 (`docs/model-routing.json` → `planRedTeam`).

### Stage C — implement

**Skill:** `orchestration/dispatch-coordinate` targeting
`agents/coding/architect/core.md` (or a more specific coding persona) running
as `noemi-agent`. Label `noemi:in-progress`. Open a PR against `develop` (then
`dev`). Never against `main` when an integration branch exists (Decision
[2026-08-16-0003]). `--implement` prepares the envelope (`opened: false`).
`--implement --open-pr` calls Grok (`coding-loop/writer.js`) and opens the
PR with `AGENT_GH_TOKEN` (`coding-loop/dispatch.js`). Pickup does not open
PRs just because the producer token is present.

### Stage D — PR red-team

Reuse the existing fleet reviewer (`scripts/review-pr.js` /
`noemi-reviewer-bot[bot]`). Do not add a second Gemini reviewer. Label
`noemi:review`. Humans still own approval and merge.
`coding-loop/stage-d.js` only delegates once a PR URL exists.

Pickup is the reusable workflow `.github/workflows/coding-loop.yml` and
`templates/ci/coding-loop-caller.yml`. Budget is fail-closed
(`vars.CODING_LOOP_BUDGET_OK`). Pass `--scan` to run `coding-loop/scan.js`
on the fetched body, or `--scan-status` for a precomputed result. Omitting
both classifies the issue as REFUSED (fail closed).

On `develop`, Cross-Model PR Review is **required to complete** and remains
advisory on the verdict (Decision [2026-08-17-0001]). A GitHub outage that
fails the comment POST is not a review. The runner retries transient GitHub
errors (429 / 5xx) via `scripts/resilience_helpers.js` until the post
succeeds or the retry budget is exhausted; if the budget is exhausted the
host **re-queues the review**, it does not treat the outage as findings or
as a skipped stage.

## GitHub availability

Every GitHub call in this loop — conductor comments and labels, producer
PR open, Stage D review post — uses the same contract as
`scripts/review-pr.js`:

- Retry **only** transient statuses: 429 and 5xx.
- Do **not** retry deterministic 4xx (401, 403, 404, 422).
- Use `scripts/resilience_helpers.js` (`withRetry`) or the host’s equivalent.
- An exhausted retry budget is a **connection failure**, not a product
  decision. Re-queue the stage. Do not apply `noemi:needs-info`,
  `noemi:wont-act`, or a fake review verdict because GitHub was down.

The 2026-08-17 GitHub partial outage failed live reviews at the final
comment POST after Gemini had already finished. That class of failure must
not fail the required-to-complete check or strand an issue.

## Model selection

Same rule as the fleet reviewer (Decision [2026-08-16-0002]), applied per
stage family:

1. If the stage has a `pin`, use that id.
2. Otherwise select the **highest-generation preview** in the stage family.
3. If the catalogue has no preview in that family, select the **highest
   generation stable** member of the family.
4. Fail closed if the family cannot be resolved. Do not silently drop to a
   cheaper, shallower model.

Families and defaults live in `docs/model-routing.json`. Changing models is a
PR to that file, not a host-framework deploy. The Gemini resolver already exists
(`scripts/resolve-gemini-model.js`). The xAI resolver lives in
`coding-loop/writer.js`. An Anthropic resolver for Fable is still missing and
must implement this same selection contract, regardless of host.

## Labels

| Label | Meaning |
|---|---|
| `noemi:queued` | Pickup accepted |
| `noemi:needs-info` | Waiting on the author, or plan cycle hit the limit |
| `noemi:planned` | Plan posted; coding may start only after B′ passes |
| `noemi:in-progress` | Coding session running |
| `noemi:review` | PR open; red team posted |
| `noemi:wont-act` | Refused or not a coding job |
| `noemi:skip` | Escape hatch |

## Spec load rule

Each host run fetches `agents/`, `skills/`, and `docs/model-routing.json`
from a **pinned SHA or tag**. Customer tenants must not track a mutable
branch. The internal MVP may track `develop` until the loop’s first CalVer
tag that contains `coding-loop.yml` exists. Fleet callers that pin `@main`
must wait for that promotion.

## Entitlements

`docs/entitlements.schema.json` is the seam for later billing. The only
committed tenant is `tenants/internal.json`: `source=newpush-pool`,
`plan=internal`, no repo deny. BYO keys, monthly plans, and on-demand
metering are schema fields, not implemented product.

## Cost and safety (required before org-wide pickup)

- Cap `concurrent_jobs` and `daily_usd` on day one. Fable 5 Max on every
  issue in three orgs is otherwise a finance event.
- Pilot one org with Stages A/B/B′ (comments only) before enabling Stage C.
- Scan issue bodies before they enter a model prompt.
- Clarifying questions are the control that keeps “every issue” from becoming
  “every vague thought becomes a PR.”
- Human still owns merge. Reviewer never approves. Conductor never codes.
- GitHub 429/5xx are retried; they are never classified as skip, refuse, or
  a finished review (see **GitHub availability**).

## Out of scope for this spec

- Stripe, invoices, customer self-serve key UI
- Provisioning the `noemi-conductor` GitHub App
- Auto-merge of coding PRs
- A second Gemini reviewer beside `noemi-reviewer-bot`
- Acting on issues in customer orgs we do not operate
- Reimplementing a workflow engine, webhook server, or agent memory (that is
  host software; use Mastra/n8n/Temporal rather than growing `coding-loop/`)
