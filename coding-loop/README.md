# Coding Loop

How an organization builds **its own** issue-coding loop from this blueprint.

`project-noemi/agents` is not your production agents repo. You copy it to a
private `{company}-agents` tree (NewPush’s is `newpush/newpush-agents`),
then sync *from* this upstream. The loop’s general rules live here. Org
names, vaults, App installs, and which repos to pick up live in **your**
copy.

Do not invent the loop only in the private copy and “upload a sanitized
version later.” That inverts `scripts/sync-upstream.sh` (upstream → you).
Private-only design is how the public recipe goes stale. Operate first in
`{company}-agents`; promote back only **lessons** (a skip rule, a cost cap,
a bug), as a PR to this repo.

Do not put this in `newpush/newpush-mastra-orchestration`. That is NewPush’s
Slack / Datto chatbot, a different product.

## What you are building

```
Issue opened in your orgs
        → coding-loop/run.js   (Stage A + Stage B draft)
        → plan red-team        (Stage B′, structural or --live-critic Gemini)
        → noemi-agent PR       (Stage C, --implement [--open-pr])
        → noemi-reviewer-bot   (Stage D, already in this repo)
        → human merge
```

Identities stay split: conductor comments, producer opens PRs, reviewer
never approves. See `docs/architecture/issue-coding-loop.md`
(**Product loop vs orchestration host**, Decision [2026-08-20-0006]).
The CLI and the Actions caller are the current **host**. Mastra is optional
later (webhook / Fable), not a prerequisite. Labs:
`docs/examples/coding-loop-labs/README.md`.

To write **personas and skills** with the same loop, pass `--profile spec`
(Decision [2026-08-20-0007]). Only `agents/`, `skills/`, and `docs/agents/`
are in play; `audit-repo.js` is the oracle. Default `--profile code` is
unchanged.

## Build your own (checklist)

### 1. Make the private copy

If you do not already have `{org}/{org}-agents`:

- Copy or fork `project-noemi/agents`.
- Default branch `develop`. Keep the develop-only merge gate.
- Point `scripts/sync-upstream.sh` at `project-noemi/agents` as `upstream`.

NewPush: this is `newpush/newpush-agents`. Sync #423 (or later `develop`)
into that copy before turning pickup on.

### 2. Fill the tenant, not the code

Edit **your** `tenants/internal.json` (or add `tenants/{company}.json`):

- `orgs` — GitHub orgs the loop may touch
- `limits.repos` — empty means all repos in those orgs; otherwise an allowlist
- `limits.concurrent_jobs` and `limits.daily_usd` — set before org-wide pickup

Do not hardcode your org name into `coding-loop/`. The runner reads the
tenant file.

### 3. Provision three identities (or reuse two)

| Role | Identity | Token / App | May |
|---|---|---|---|
| Conductor | `{company}-conductor` or `noemi-conductor` | `CONDUCTOR_GH_TOKEN` | Issues comment + labels |
| Producer | `{company}-agent` or `noemi-agent` | `AGENT_GH_TOKEN` | Open PRs |
| Reviewer | fleet reviewer App or `{company}-reviewer` | reviewer App / PAT | Post findings |

`--post` on the Stage A runner **requires** `CONDUCTOR_GH_TOKEN`. It
refuses the producer and reviewer tokens. Do not widen the conductor to
Contents write.

### 4. Run Stage A on one issue (dry)

From the repo root, with a read token in the environment:

```bash
node coding-loop/run.js --repo your-org/your-repo --issue N --scan --budget-ok
```

Omitting both `--scan` and `--scan-status`, or omitting the budget
assertion, is `REFUSED` (fail closed). You should see `SKIPPED`,
`NEEDS_INFO`, `REFUSED`, or — when the three sufficiency signals are
present — `ACTIONABLE` from the **heuristic** (`mode: heuristic`). Fable is
not wired yet; the heuristic must not default to `ACTIONABLE`.

To apply the label (and post questions when the body is empty):

```bash
CONDUCTOR_GH_TOKEN=… node coding-loop/run.js --repo your-org/your-repo --issue N --scan --budget-ok --post
```

### 5. Turn on pickup only after the brake exists

Even if the policy is “every new issue”:

- honour `noemi:skip`, bot authors, empty / template bodies
- scan the body before any model sees it
- cap concurrency and daily spend
- start on **one** repo, then one org

Install `templates/ci/coding-loop-caller.yml` (Actions host) after
`project-noemi/agents@main` has `coding-loop.yml`, or pin
`tooling-ref: develop` for an internal MVP. Mastra can host a long-running
webhook **inside this section** later; it is not a second GitHub repository
and it is not required to classify the first issue.

### 6. Keep the private copy honest

- Sync **from** `project-noemi/agents` on a schedule (`docs/UPSTREAM_SYNC.md`).
- When NewPush learns something that every tenant needs, open a PR **here**,
  parameterized, with no vault IDs or customer repo lists.
- Never sync secrets, `tenants/*.json` with real spend caps you do not want
  public, or App private keys upstream.

## Stage A today

Hard gates: `noemi:skip`, bot authors, empty/template body, tenant, scan,
budget (`coding-loop/intake.js`). Then sufficiency (`coding-loop/sufficiency.js`):
observable problem, in-scope path, checkable done condition. All three are
required. The pass is a conservative heuristic until Fable is wired; it
still never defaults to `ACTIONABLE`.

```bash
node coding-loop/run.js --repo owner/name --issue N --scan --budget-ok
# or, if an upstream scanner already produced a result:
node coding-loop/run.js --repo owner/name --issue N --scan-status APPROVED --budget-ok
```

Omitting both `--scan` and `--scan-status` is REFUSED (fail closed). `--scan`
is not implied by leaving `--scan-status` off.

An `ACTIONABLE` issue gets a Stage B plan and Stage B′
(`coding-loop/plan.js`). Structural critique always runs (headings, files,
no skip-red-team). `--live-critic` then calls Gemini Pro (ADC, same
selection rule as the fleet reviewer). Pass → `accepted`. Fail at
`planRedTeam.maxCycles` → `needs-info`. A Gemini 429/5xx is retried, then
thrown so the host re-queues — it is not an `accepted` plan.

`--implement` prepares a Stage C envelope (`coding-loop/dispatch.js`) for
`noemi-agent` on `develop` (then `dev`). `AGENT_GH_TOKEN` is required; the
conductor token is refused.

`--implement --open-pr` drafts files with Grok (`XAI_API_KEY`, Fetch-on-Demand)
and opens the PR as `noemi-agent`. It refuses paths outside the plan,
governance carve-outs, and secret-shaped content. It does not approve or
merge. Tests inject the model and GitHub clients; they do not open live PRs.

Pickup: install `templates/ci/coding-loop-caller.yml` and set
`CODING_LOOP_BUDGET_OK=true` only when the daily cap is real. The reusable
workflow prepares the envelope; opening a PR is a separate producer
invocation with `AGENT_GH_TOKEN` and `XAI_API_KEY`. Stage D delegates to
the fleet reviewer when a PR URL exists (`coding-loop/stage-d.js`).
