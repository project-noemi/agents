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
        → plan red-team        (Stage B′, later)
        → noemi-agent PR       (Stage C)
        → noemi-reviewer-bot   (Stage D, already in this repo)
        → human merge
```

Identities stay split: conductor comments, producer opens PRs, reviewer
never approves. See `docs/architecture/issue-coding-loop.md`.

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
node coding-loop/run.js --repo your-org/your-repo --issue N
```

You should see `SKIPPED`, `NEEDS_INFO`, `REFUSED`, or
`PENDING_SUFFICIENCY` — never `ACTIONABLE`. Sufficiency (the model call)
is not in this slice yet.

To apply the label (and post questions when the body is empty):

```bash
CONDUCTOR_GH_TOKEN=… node coding-loop/run.js --repo your-org/your-repo --issue N --post
```

### 5. Turn on pickup only after the brake exists

Even if the policy is “every new issue”:

- honour `noemi:skip`, bot authors, empty / template bodies
- scan the body before any model sees it
- cap concurrency and daily spend
- start on **one** repo, then one org

Wire the GitHub issue webhook (or an Actions `issues: opened` job) to
`coding-loop/run.js`. Mastra can host that webhook **inside this section**
later; it is not a second GitHub repository.

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
node coding-loop/run.js --repo owner/name --issue N --scan-status APPROVED --budget-ok
```

An `ACTIONABLE` issue gets a Stage B plan and a structural Stage B′
(`coding-loop/plan.js`): missing sections, no files, or skip-red-team
language fail. Pass → `accepted`. Fail at `planRedTeam.maxCycles` →
`needs-info`. Gemini is not called yet.

`--implement` prepares a Stage C envelope (`coding-loop/dispatch.js`) for
`noemi-agent` on `develop` (then `dev`). It does not write code or open a
PR until Grok is wired. `AGENT_GH_TOKEN` is required; the conductor token
is refused.

## Next in this section

Grok writer for Stage C, Gemini critic for B′, fleet reviewer for Stage D
(already exists). Optional Mastra webhook stays in this section.
