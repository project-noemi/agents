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
(Decision [2026-08-20-0007]). Only **markdown** under `agents/`, `skills/`,
and `docs/agents/` is in play; `audit-repo.js` is the oracle. Default
`--profile code` is unchanged.

## Build your own (checklist)

### 1. Make the private copy

If you do not already have `{org}/{org}-agents`:

- Copy or fork `project-noemi/agents`.
- Default branch `develop`. Keep the develop-only merge gate.
- Point `scripts/sync-upstream.sh` at `project-noemi/agents` as `upstream`.
- Keep GitHub Packages **private**. Leave org **Settings → Packages → Package creation → Public** unchecked. The Gmail EA publish workflow will fail this copy if `docker manifest inspect` succeeds without credentials. See `docs/UPSTREAM_SYNC.md` (GitHub Packages on a private clone).

NewPush: this is `newpush/newpush-agents`. Sync #423 (or later `develop`)
into that copy before turning pickup on.

### 2. Fill the tenant, not the code

Edit **your** `tenants/internal.json` (or add `tenants/{company}.json`):

- `orgs` — GitHub orgs the loop may touch
- `limits.repos` — empty means all repos in those orgs; otherwise an allowlist
- `limits.concurrent_jobs` and `limits.daily_usd` — set before org-wide pickup

Do not hardcode your org name into `coding-loop/`. The runner reads the
tenant file.

`orgs` is for the operator's **own** orgs. Client orgs do not go in a tenant
file. A client repo is entitled when your conductor App is installed there
(not suspended) **and** `NOEMI_CLIENT_REGISTRY` has an `active` row for that
installation's GitHub account ID, and the run names a requester with write
access (`--requested-by`). The registry is JSON injected from the vault
(`infisical run`), shaped by `docs/client-registry.schema.json`; never
commit it, because it lists who your clients are. See
[Client entitlement](../docs/architecture/issue-coding-loop.md#client-entitlement).

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

## Operate one issue

Run this on one repository before pickup. The issue names a file that already
exists on that repository's `develop` branch, and it has a `Done when` section
a person can check. It does not contain secrets, and it does not ask the agent
to edit the review workflow, `CODEOWNERS`, or the identity register.

From the copy's root, with Node 24. Inject credentials with your vault
(`infisical run` or `op run`). Do not write them into a file.

```bash
node coding-loop/run.js \
  --repo your-org/your-repo --issue N \
  --scan --budget-ok --live-critic --implement --open-pr
```

The environment holds:

- a conductor credential to read the issue and set labels (`CONDUCTOR_APP_ID`
  plus `CONDUCTOR_APP_PRIVATE_KEY`, or `CONDUCTOR_GH_TOKEN`)
- a producer token to open the pull request (`AGENT_GH_TOKEN`). The conductor
  token is refused for that step
- a model credential. One config (`scripts/model-config.js`) picks the route
  for the writer and the critic:
  - **NewPush AI gateway (main route):** `AI_GW_API_TOKEN` (alias
    `AI_GW_API_KEY`). `AI_GW_BASE_URL` is optional and defaults to
    `https://ai-gw.newpush.com`. With this key set, `--live-critic` uses the
    gateway and does not need `gcloud`, and the writer uses the gateway even
    when `XAI_API_KEY` is also set
  - **Direct provider access (no gateway key):** `XAI_API_KEY` for the writer,
    and for `--live-critic` application-default credentials on a laptop, or
    Workload Identity Federation in Actions (`CODING_LOOP_LIVE_CRITIC=true` and
    the same `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, and
    `GOOGLE_CLOUD_PROJECT` variables as the fleet reviewer). There is no Gemini
    API key
  - a gateway 403, or a refusal whose body says the budget is spent, stops the
    run. It is not an outage and is not re-queued

To approve the plan before anything is written, run it in two steps. The first
run plans only and saves the result; the second implements exactly that plan
and does not plan again:

```bash
node coding-loop/run.js --repo your-org/your-repo --issue N \
  --scan --budget-ok --live-critic --plan-out plan.json
# read plan.json, then:
node coding-loop/run.js --repo your-org/your-repo --issue N \
  --scan --budget-ok --plan-in plan.json --post --implement --open-pr
```

`--plan-in` is refused when the plan was not accepted, names another issue or
profile, or the issue changed on GitHub after it was planned. NoéMi Code's
`/issue` command uses these two steps.

A successful run opens a pull request as the producer, with base `develop`.
The body starts with `Closes #N`, or with `Part of #N` when the accepted plan
says the agent does not finish the work. With a conductor token, the issue
keeps one `noemi:*` label. An opened pull request is `noemi:review`.

Stage D is the review workflow installed on the target repository.
`coding-loop/stage-d.js` records the handoff. It does not call a second
reviewer. The review runs premise, then framing, then code, then compliance.
Compliance reads `agents/coding/sentinel/compliance.md` from this blueprint.
That file is the shared EU AI Act and GDPR baseline. It is guidance, not a
legal opinion. The deploying organization chooses whether to follow it.
Merging a pull request that failed only the compliance gate does not open a
calibration entry. A premise, framing, or code failure still does. A duty
that applies only to one organization is recorded in that organization's
agents repository, and promoted here when every tenant needs it.

A second `--open-pr` for the same issue is refused while `noemi/issue-N`
exists. A person still approves and merges.

Leave pickup off until `limits.daily_usd` is a real cap and this command has
succeeded on one repository. Stage A stays the heuristic until its model is
wired.

## Stage A today

Hard gates: `noemi:skip`, bot authors, empty/template body, tenant or
client entitlement plus a write-access requester (`coding-loop/entitlement.js`),
scan, budget (`coding-loop/intake.js`). Then sufficiency (`coding-loop/sufficiency.js`):
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
(`coding-loop/plan.js`). Plan **Files** are PATH_RE hits that look like
repository files: hostnames (`ghcr.io/…`), URLs, `dist` / `coverage`
segments, `../` / absolute paths, and directories are dropped. A source
file the issue names is kept even when this checkout does not contain it,
because this repo is the loop blueprint and the issue may target another
clone. Other paths are kept only when they exist as files inside the clone. Structural critique always runs (headings, files, no
skip-red-team, no leftover registry or escaping paths). `--live-critic` then calls
Gemini Pro: the gateway critic pin (`google/gemini-3.1-pro-preview`, override
`GEMINI_CRITIC_MODEL`) with a gateway key, else Vertex through ADC with the same
selection rule as the fleet reviewer. On a fail with
cycles remaining, B′ writes a revision prompt and the plan writer (gateway pin
`google/gemini-4-argon`, override `PLAN_MODEL`, any gateway provider; not the red-team model)
executes it on the plan before the next pass. A revision that does not
change the plan, drops the skip-red-team record, or adds a path the issue
did not name stops the cycle. Without `--live-critic`, B′ may still drop
invalid files and re-format; it does not resubmit an unchanged draft, and
it never invents replacements. Pass → `accepted`. Fail at
`planRedTeam.maxCycles`, or a revision that does not change the plan →
`needs-info`. A Gemini 429/5xx is retried, then thrown so the host
re-queues — it is not an `accepted` plan.

`--implement` prepares a Stage C envelope (`coding-loop/dispatch.js`) for
`noemi-agent` on `develop` (then `dev`). `AGENT_GH_TOKEN` is required; the
conductor token is refused.

`--implement --open-pr` drafts files with Grok. Auth is Fetch-on-Demand:
NewPush gateway `AI_GW_API_TOKEN` / `AI_GW_API_KEY` at
`https://ai-gw.newpush.com/v1` (override `AI_GW_BASE_URL`), which wins when set,
**else** `XAI_API_KEY` against `https://api.x.ai/v1`. Gateway model ids are
`provider/id`; the writer pins `xai/grok-4.6` unless `XAI_CODE_MODEL` is set
(a bare id gets the `xai/` prefix). On the gateway the pin is the model: no
catalogue pick and no substitute. The request sets
`max_completion_tokens` (default 65536, override `XAI_MAX_TOKENS`) so thinking
tokens are not taken from the file JSON. The NewPush gateway is LiteLLM and
rejects that field for `grok-4.6` unless the body also sends
`allowed_openai_params: ["max_completion_tokens", "response_format"]`. Native
`api.x.ai` does not get that proxy flag. The request also sets
`response_format: { "type": "json_object" }`. Before that call, the writer reads
each allow-listed file from the target repo at the base branch and puts the
text in the prompt. Grok has no tools; a sentence about reading files is not
a diff. A non-OK reply includes a short redacted body: the key sent on the
request is removed before `sk-` and `Bearer` redaction and before the
400-character slice. A reply whose visible answer has no JSON object fails
closed and includes a short redacted preview. That failure is not retried.
`reasoning_content` is not parsed. The virtual key is never sent to api.x.ai. See
[`docs/tool-usages/newpush-ai-gateway.md`](../docs/tool-usages/newpush-ai-gateway.md).
It opens the PR as `noemi-agent`. It refuses paths outside the plan,
governance carve-outs, and secret-shaped content. It does not approve or
merge. Tests inject the model and GitHub clients; they do not open live PRs.

Pickup: install `templates/ci/coding-loop-caller.yml` and set
`CODING_LOOP_BUDGET_OK=true` only when the daily cap is real. Optional
`CODING_LOOP_LIVE_CRITIC=true` plus org WIF (same vars as the fleet
reviewer) passes `--live-critic`; unset, Stage B′ stays structural. The
reusable workflow prepares the envelope; opening a PR is a separate
producer invocation with `AGENT_GH_TOKEN` (or `AGENT_GH_TOKEN_CLASSIC` +
`AGENT_GH_USE_CLASSIC=1`) and `AI_GW_API_TOKEN` or `XAI_API_KEY`.
Stage D delegates to the fleet reviewer when a PR URL exists
(`coding-loop/stage-d.js`). The reviewer reads
`agents/coding/sentinel/compliance.md` from this blueprint, next to the
Sentinel persona, and applies it as the compliance gate after premise,
framing, and code. The file is guidance for the EU AI Act and the GDPR, not
a legal opinion. The deploying organization chooses whether to follow it: a
merge that fails only that gate does not open a calibration entry. A duty
that applies only to one organization is recorded in that organization's
agents repository.
Issue reads and `--post` use the same conductor
token: `CONDUCTOR_APP_ID` + `CONDUCTOR_APP_PRIVATE_KEY` (or
`CONDUCTOR_GH_TOKEN`). `--post` posts the conductor comment. The label is
separate: when a conductor token is present the loop keeps one `noemi:*`
label, and an opened pull request is `noemi:review` even without `--post`.
See
[`docs/MACHINE_IDENTITY.md`](../docs/MACHINE_IDENTITY.md) for the App.

## Gemini B′: gateway key, laptop ADC, or Actions WIF

With `AI_GW_API_TOKEN` in the environment, `--live-critic` goes through the
NewPush AI gateway and nothing below is needed. The virtual key is not a Gemini
API key; Google credentials stay on the gateway (Decision [2026-10-22-0001]).

Without a gateway key, `--live-critic` calls Vertex directly and never uses a
Gemini API key. Org policy on `project-noemi` disallows API keys and
service-account key files.

**Laptop (this is what local live-fire needs):**

```bash
gcloud auth application-default login
node scripts/gcp-token.js
# expect: ADC token obtained via gcloud-adc  (it must not print the token)
```

`gcloud auth login` is not enough. `gcloud auth list` can show an account
while ADC is still missing.

**GitHub Actions pickup:** do not put a WIF token in Infisical. Reuse the
fleet-reviewer org **variables**: `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`,
`GOOGLE_CLOUD_PROJECT`. Set `CODING_LOOP_LIVE_CRITIC=true`. The reusable
workflow mints `GCP_ACCESS_TOKEN` via `google-github-actions/auth`. One-time
pool/provider setup: [`docs/examples/cross-model-review-setup.md`](../docs/examples/cross-model-review-setup.md)
Part 1.

## Graphite stacked PRs

1. Detecting a stack: PR descriptions mention "Stack:" or "Base PR", or sequential PRs are based on each other's branches.
2. Never merge a child PR into its parent branch. The merge target is always `develop`. Never change a PR's base by hand.
3. Merge from the bottom up into `develop`, in one Graphite stack merge or through the Graphite merge queue.
4. If an upper PR is ready first, leave it open until everything below it has landed.
5. After anything lands on `develop`, run `gt sync`, `gt restack`, then `gt submit --stack`.
6. To fix a lower PR, use `gt modify` on that branch, then `gt restack` and `gt submit --stack`. Force-pushing is expected on stacked branches. Do not use "merge develop in, no rebase, no force-push" on stacked branches; that rule applies only to non-stacked branches.
7. Keep stacks to 3–5 PRs of about 500 changed lines each. Split larger plans into several short stacks.
8. Ship-together notes must say "Ship together with #N. Merge from the bottom up into develop", never "Merge with #N".
9. Run the AI reviewer once per revision (or on demand), not on every push.
