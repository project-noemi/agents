# Cross-Model AI Review: Setup Walkthrough

This guide sets up the review system where **one AI writes the code and a
different AI reviews it**, with a human deciding what happens next.

Written for someone who has never created a machine account or a vault secret.
Every step says what you are doing and why it matters. Nothing here assumes you
already understand OIDC, fine-grained tokens, or GitHub branch protection.

Read [`docs/AI_REVIEW_GOVERNANCE.md`](../AI_REVIEW_GOVERNANCE.md) for the
reasoning behind the design. This guide is the hands-on part.

## Why this exists (the two-minute version)

Imagine you ask an AI to write some code. Then you ask the *same* AI whether the
code is good. It will usually say yes — not because it is lying, but because it
made the same assumptions both times. A reviewer that shares your blind spots
cannot find them.

Worse: if the AI submits its work using **your** GitHub account, then *you*
appear to be the author. GitHub will not let anyone approve their own pull
request, so your own review is blocked — and the usual workaround is an admin
override, which means nobody reviewed anything at all.

So the setup below does three things:

1. Gives the writing AI its own identity, separate from yours
2. Gives the reviewing AI a **different** identity *and* a different model family
   (Claude writes, Gemini reviews)
3. Keeps you as the person who decides what to do about the findings

## What you will end up with

| Piece | What it is |
|---|---|
| `noemi-agent` | GitHub account the writing AI uses. Can push code, cannot approve |
| `noemi-reviewer` | GitHub account the reviewing AI uses. **Cannot** push code |
| Google Cloud access via ADC | Lets the reviewing AI run. **No API key** — org policy disallows them |
| Infisical secrets | Where those credentials live. Never in files, never in chat |
| A GitHub workflow | Runs the review automatically on each pull request |

## Before you start

You need:

- **Admin access** to the GitHub repository
- **An Infisical account** with a project created ([infisical.com](https://infisical.com))
- **The `gh` CLI** installed and logged in (`gh auth login`)
- **The `infisical` CLI** installed and logged in (`infisical login`)
- **Google Cloud access** to `project-noemi`, and the `gcloud` CLI installed

Check the CLIs are working:

```bash
gh auth status
infisical user get
```

---

# Part 1 — Google Cloud access (no API key)

If your Google Cloud organization allows API keys, you have choices here. **If it
does not, this section is not a decision — it is the only path.**

`project-noemi` is in the second category. The console reports:

> API Keys are Disallowed — Your organization's security policy disallows API
> keys. Please use Application Default Credentials (ADC) instead.

Service-account **key** creation is disallowed too. So both of the usual
static-credential mechanisms are unavailable, and every option that begins
"create a key and store it" is off the table.

## Why this is good news

The mechanism you are forced onto is the one a security review would have asked
for anyway:

| | Static key in a vault | ADC / federation |
|---|---|---|
| Credential lifetime | months | minutes |
| Can leak in a log | yes | expires before it matters |
| Rotation burden | yours, forever | none |
| Audit attribution | "the key" | the identity that used it |

There is nothing durable to steal, so there is nothing to rotate.

**And it simplifies the vault story.** Infisical stores *nothing* for Gemini,
because there is no secret to store. That is the correct reading of "use the
vault wherever possible" — a vault protects static secrets, and federation
removes them.

## The two authentication paths

They are different, and a common mistake is assuming the first covers the
second. It does not.

### Local development — user ADC

One command, opens a browser:

```bash
gcloud auth application-default login
```

The `setup_adc.sh` helper the console offers is a wrapper around this.

Confirm it worked without printing the credential:

```bash
node scripts/gcp-token.js        # expect: ADC token obtained via gcloud-adc
```

This credential expires and needs re-running periodically. When it lapses, the
tooling tells you exactly that rather than failing obscurely.

### GitHub Actions — Workload Identity Federation

**`gcloud auth application-default login` cannot work in CI.** There is no
browser and no user. And you cannot fall back to a service-account key, because
those are disallowed.

So GitHub proves its own identity to Google and receives a short-lived token.

#### Decide the scope first

Federation can be scoped to one repository or to whole organizations. Widening it
is a real decision: **anyone who can push a workflow file to an included
repository can mint a token for the service account.** The blast radius is
bounded by the service account's roles — with `roles/aiplatform.user` the
realistic worst case is unauthorized Vertex usage billed to your project.

Forks are excluded either way: a fork's `repository_owner` is the forker, and
fork pull requests do not receive `id-token` permission by default.

Project NoéMI's own deployment covers three organizations:

| Organization | Login | Immutable ID |
|---|---|---|
| NewPush | `newpush` | `6222293` |
| Project NoéMI | `project-noemi` | `271349740` |
| NewPush Labs | `newpush-labs` | `183727677` |

⚠️ **Bind on the numeric ID, not the name.** Organization logins are mutable: if
one were renamed or deleted, someone could register the freed name and inherit
impersonation rights. IDs cannot be reassigned.

⚠️ **Logins are case-normalized and comparison is case-sensitive.** `newpush-Labs`
is really `newpush-labs`. A condition written with the wrong casing never matches
and authentication fails with nothing pointing at capitalization as the cause.
Confirm the canonical login and ID before writing either:

```bash
gh api orgs/<org> --jq '"login=\(.login) id=\(.id)"'
```

#### One-time setup

```bash
# 0. Prerequisite API. Missing, token exchange fails without mentioning STS.
gcloud services enable sts.googleapis.com --project=project-noemi

# 1. A pool to hold external identities
gcloud iam workload-identity-pools create github \
  --location=global --project=project-noemi \
  --display-name="GitHub Actions"

# 2. A provider that trusts GitHub's OIDC issuer
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github --project=project-noemi \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.repository_owner_id=assertion.repository_owner_id" \
  --attribute-condition="assertion.repository_owner_id in ['6222293','271349740','183727677']"

# 3. A service account for the workflow to act as
gcloud iam service-accounts create noemi-reviewer \
  --project=project-noemi --display-name="NoeMI AI reviewer"

# 4. Vertex access, and nothing else. Not aiplatform.admin.
gcloud projects add-iam-policy-binding project-noemi \
  --member="serviceAccount:noemi-reviewer@project-noemi.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 5. Let each organization impersonate it — one binding per org ID
PROJECT_NUMBER=$(gcloud projects describe project-noemi --format='value(projectNumber)')
for ORG_ID in 6222293 271349740 183727677; do
  gcloud iam service-accounts add-iam-policy-binding \
    noemi-reviewer@project-noemi.iam.gserviceaccount.com --project=project-noemi \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository_owner_id/${ORG_ID}"
done
```

#### The two halves must agree

Step 2's **attribute mapping and condition** and step 5's **bindings** are a
matched pair, and a mismatch fails closed in a way that is hard to read:

- The condition controls who may enter the pool. Leave it scoped to one
  repository and no other repo can authenticate, regardless of the bindings.
- The bindings reference a mapped attribute. Bind on
  `attribute.repository_owner_id` without mapping it in step 2 and **the
  attribute does not exist on any token, so no principal matches any binding** —
  nothing authenticates at all, including the repository you intended to allow.

This exact combination broke the first rollout. Verify both after setup:

```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github --project=project-noemi \
  --format='value(attributeCondition,attributeMapping)'

gcloud iam service-accounts get-iam-policy \
  noemi-reviewer@project-noemi.iam.gserviceaccount.com --project=project-noemi
```

#### Repository Variables

Settings → Secrets and variables → Actions → **Variables** tab. None is a
secret, and the tab matters: Secrets are masked and write-only, which makes
non-secrets harder to audit.

| Variable | Value |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `noemi-reviewer@project-noemi.iam.gserviceaccount.com` |
| `GOOGLE_CLOUD_PROJECT` | `project-noemi` |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` |
| `INFISICAL_PROJECT_ID` | your Infisical workspace ID |
| `INFISICAL_IDENTITY_ID` | your Infisical machine identity ID |

⚠️ `GCP_WIF_PROVIDER` takes the project **number**, not the project ID. Using the
ID fails with a message that does not mention which field is wrong.

The workflow requires **all six** and skips with a notice naming the missing
ones — so a partial rollout is safe, but a green job does not mean a review ran.

## Enable the API

```bash
gcloud services enable aiplatform.googleapis.com --project=project-noemi
```

Vertex AI requires billing to be linked to the project.

## Which model gets chosen

Not a name in a config file — names go stale. The resolver asks Google what
exists and applies this rule:

> Prefer the newest **stable** model of the highest available generation. Pro is
> elevated only when a stable Pro exists in that generation; otherwise take the
> best stable model of the latest generation.

Generation dominates; tier orders *within* a generation. That matters because a
hard tier preference looks sensible and quietly does the wrong thing: at the time
of writing, every 3.x Pro is preview-only, so "always prefer Pro" would select a
2.5-generation model while a stable 3.6 was available.

Also filtered out: image, speech, embedding, robotics, and computer-use variants.
Their names still contain "pro" and "flash", so a naive rank will cheerfully
choose an *image* model to review your code. Most published Gemini models are
wrong for this job.

### The Pro floor (required)

Flash is not an adequate review model (Decision [2026-08-15-0003]). The
runner and the workflow default to `--floor pro`. A catalogue with no Pro
halts the review. `--prefer-pro` is also on by default.

```bash
node scripts/resolve-gemini-model.js --floor pro --prefer-pro
```

When the toggle costs you a generation, it tells you:

```
⚠ prefer_pro_tier selected gemini-2.5-pro (gen 2.5); without it the newest
  stable choice is gemini-3.6-flash (gen 3.6).
```

Combine with `--allow-preview` to reach a newer Pro that is still in preview —
accepting an unstable model inside a governance control.

## Which backend

`GEMINI_BACKEND` selects between two Google surfaces:

- **`vertex`** (default) — `aiplatform.googleapis.com`. **The only one that
  works here.** Verified: an ADC bearer token against
  `generativelanguage.googleapis.com` returns
  `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`, because that surface expects an API key
  — which your org policy disallows.
- **`generativelanguage`** — retained for organizations that permit API keys.

So on `project-noemi` this is not a choice. Leave it at `vertex`.

---

# Part 2 — Link the repository to Infisical

Infisical holds the **GitHub** credentials. It holds nothing for Gemini — there
is no Gemini secret to hold.

`.infisical.json` is gitignored because a workspace ID is organization-specific
and would follow forks that cannot use it. So each clone creates its own:

```bash
infisical init
```

For CI and non-interactive runs, where `init` is impractical, set the ID
directly instead:

```bash
export INFISICAL_PROJECT_ID=<your-workspace-id>
```

A project ID is not a secret.

---

# Part 3 — The two machine identities

If you have already followed [`docs/MACHINE_IDENTITY.md`](../MACHINE_IDENTITY.md),
these exist and you can skip ahead.

The critical rule: **create each token while signed in as that account.** A token
minted from your own account carries *your* identity, which recreates the exact
problem this setup solves.

## The writing identity — `noemi-agent`

Register the GitHub account (2FA on, an address you control, a clearly non-human
profile name). Then, **signed in as `noemi-agent`**, create a fine-grained token:
Settings → Developer settings → Personal access tokens → Fine-grained tokens.

| Setting | Value |
|---|---|
| Repository access | Only select repositories → your repo |
| Contents | Read and write |
| Pull requests | Read and write |
| Metadata | Read |
| Expiration | 90 days |

Leave **Workflows** unchecked, so the AI cannot edit your CI configuration.

## The reviewing identity — `noemi-reviewer`

Same process, different permissions — and this difference is the whole point:

| Setting | Value |
|---|---|
| Contents | **Read** ← not write |
| Pull requests | Read and write |
| Metadata | Read |

`Contents: read` means the reviewer **physically cannot change code**. It is not
a rule we ask it to follow; it is a wall. A reviewer that could edit code could
quietly fix what it was supposed to report.

## Store both tokens

```bash
infisical secrets set AGENT_GH_TOKEN="ghp_..." --env=dev
infisical secrets set REVIEWER_GH_TOKEN="ghp_..." --env=dev
```

## Grant repository access

```bash
gh api --method PUT repos/OWNER/REPO/collaborators/noemi-agent   -f permission=push
gh api --method PUT repos/OWNER/REPO/collaborators/noemi-reviewer -f permission=pull
```

## ⚠️ The organization approval trap

If your repository belongs to a GitHub **organization**, a new fine-grained token
often sits in a *pending* state. While pending it silently behaves as read-only —
reads succeed, writes fail with `403`, and nothing tells you why.

This will cost you an hour if you do not know about it. Check here:

`https://github.com/organizations/YOUR-ORG/settings/personal-access-token-requests`

## Verify both identities

```bash
AGENT_GH_TOKEN_SECRET=AGENT_GH_TOKEN \
AGENT_GH_EXPECTED_LOGIN=noemi-agent \
bash scripts/agent-gh.sh whoami        # expect: noemi-agent (User)

AGENT_GH_TOKEN_SECRET=REVIEWER_GH_TOKEN \
AGENT_GH_EXPECTED_LOGIN=noemi-reviewer \
bash scripts/agent-gh.sh whoami        # expect: noemi-reviewer (User)
```

Always set `AGENT_GH_EXPECTED_LOGIN`. It makes the wrapper refuse to act if the
token turns out to belong to someone else — which is what stops a misconfigured
run from quietly authoring work under your name.

### Confirm the reviewer really cannot write

Worth doing once, because a wall you have not tested is a hope:

```bash
AGENT_GH_TOKEN_SECRET=REVIEWER_GH_TOKEN \
AGENT_GH_EXPECTED_LOGIN=noemi-reviewer \
bash scripts/agent-gh.sh api --method POST repos/OWNER/REPO/git/refs \
  -f ref="refs/heads/probe" -f sha="$(git rev-parse HEAD)"
```

You want this to **fail** with `403 Resource not accessible`. A success means the
token is over-scoped — go back and fix the permissions.

---

# Part 4 — Let GitHub Actions read Infisical (no stored secrets)

The workflow needs the Gemini key and the reviewer token. The naive approach is
copying them into GitHub repository secrets — but then every secret lives in two
places and must be rotated in both. People forget the second one.

Instead, GitHub proves its identity to Infisical and receives temporary access.
**No secret is stored in GitHub at all.**

## Create an Infisical machine identity

In Infisical: **Organization Settings** → *Identities* → *Create identity*, then
add **OIDC Auth** as its authentication method and grant the identity read access
to your project.

Verified settings for GitHub Actions:

| Field | Value |
|---|---|
| Issuer / Discovery URL | `https://token.actions.githubusercontent.com` |
| **Audience** | must equal what the workflow requests — `infisical` by default |
| Subject / claim filter | scope to your repositories, e.g. `repo:project-noemi/agents:*` |

⚠️ **The audience is the field that fails first.** A mismatch produces:

```
401 Access denied: OIDC audience not allowed.
```

That names the cause but not which side to change. Either set the identity's
allowed audience to `infisical`, or set the `INFISICAL_OIDC_AUDIENCE` repository
variable to whatever the identity expects. They must match exactly.

The identity's ID goes in the `INFISICAL_IDENTITY_ID` variable.

## In the workflow

```yaml
permissions:
  contents: read
  pull-requests: write
  id-token: write        # lets the job request an identity token

steps:
  - name: Authenticate to Infisical
    run: |
      JWT=$(curl -sH "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
        "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=infisical" | jq -r .value)
      TOKEN=$(infisical login --method=oidc-auth --jwt="$JWT" --plain --silent)
      echo "INFISICAL_TOKEN=$TOKEN" >> "$GITHUB_ENV"

  - name: Run the review
    run: infisical run --projectId="${{ vars.INFISICAL_PROJECT_ID }}" --env=dev -- node scripts/review-pr.js
```

`INFISICAL_PROJECT_ID` goes in **Variables**, not Secrets — a project ID is not
a secret, and putting non-secrets in Secrets makes it harder to see what actually
needs protecting.

> Infisical also publishes an official `Infisical/secrets-action`. A maintained
> action is one less thing for you to keep correct — compare it against the CLI
> approach above.

---

# Part 5 — Which model does the reviewing?

You might expect a model name in a config file. There isn't one, deliberately.

Model names go stale. A file pinned to a 2.5-era model keeps using it long after
better models exist, and nobody notices because nothing breaks.

So [`scripts/resolve-gemini-model.js`](../../scripts/resolve-gemini-model.js)
asks Google what is available and picks the strongest, preferring Pro over Flash
and reasoning variants over standard ones.

Try it:

```bash
node scripts/resolve-gemini-model.js --dry-run          # ranking logic, no API needed
infisical run --env=dev -- node scripts/resolve-gemini-model.js
```

If nothing meets the minimum capability level, it **fails instead of quietly
using a weaker model**. A shallow review that looks like a thorough one is worse
than no review, because you would trust it.

> This does **not** change the `gemini-3.6-flash` pin elsewhere in the
> repository. That pin exists so smoke tests behave identically every run.
> Reproducibility is right for tests and wrong for review.

---

# Part 6 — How a review actually goes

The reviewer works in three gates, **in order**, and stops at the first failure.

### Gate 1 — Premise: *should this change exist?*

Before reading a single line of implementation: is the problem real? Already
solved? Worth doing now?

This gate exists because the most common failure of a capable coding AI is not
broken code — it is **well-written code that should never have been written.** A
reviewer starting at the diff approves that every time, because at the diff level
it looks like good work.

Premise failures always come to a human. "This should not be merged at all" is
too consequential and too debatable for automation.

### Gate 2 — Framing: *does the description match the change?*

Does the title reflect the diff? Is extra scope hidden under a narrow heading?
Are risks disclosed?

### Gate 3 — Code: *is it correct and safe?*

Only now: correctness, security, tests, maintainability.

## What you do with the findings

Findings arrive with severities (`critical`, `high`, `medium`, `low`) defined in
the governance document — **not** by the reviewing AI, which could otherwise
downgrade its way to a clean result.

The reviewer also drafts a fix-request for the writing AI. **That draft does not
send automatically.** It waits for you to edit it: add context, drop findings you
disagree with, or redirect the approach.

This is the highest-leverage place for your attention. You are shaping the
instruction rather than inspecting the output.

Read **both** the raw findings and the drafted request. Reading only the draft
means reading a summary of a summary, with no way to notice where it drifted from
what was actually found.

---

# Part 7 — What the AI is never allowed to touch

Some files are excluded from AI review entirely:

- branch protection settings
- `.github/CODEOWNERS`
- the branch-source merge gate
- the machine identity register
- the review governance document itself

Not because the AI is not capable enough. Because these are the files that
*constrain* the AI. An agent approving changes to its own constraints is grading
its own homework, and a second AI does not fix that — it just adds another party
with the same interest.

This is not theoretical. This repository's `CODEOWNERS` records automation
editing the merge gate to unblock its own pull requests.

---

# Fleet deployment — every repository, one reviewer

One repository proves the loop; the fleet is where it pays. The design keeps
review logic in exactly one place:

- **`.github/workflows/ai-review.yml` in the tooling repo** is a *reusable
  workflow* (`workflow_call`). All logic, auth, and honesty rules live here.
- **Every other repo** gets a ~15-line caller
  (`templates/ci/ai-review-caller.yml`) that delegates to it. Callers should
  almost never change.
- **Reviewer scripts are always checked out from the tooling repo at a pinned
  ref, never from the PR under review.** A pull request must not be able to
  rewrite the reviewer that judges it. For the same reason,
  `.github/workflows/ai-review.yml` is itself in the carve-out: a PR editing
  the review workflow halts and goes to a human, in every repo.

## One-time prerequisites (human)

**1. Organization-level Actions variables** — set once per org so member repos
need no configuration of their own (Org Settings → Secrets and variables →
Actions → Variables, or `gh variable set NAME --org ORG --visibility all`,
which requires `admin:org` scope):

`GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GOOGLE_CLOUD_PROJECT`,
`INFISICAL_PROJECT_ID`, `INFISICAL_IDENTITY_ID` — same values as the
repository-level ones documented above. (`GOOGLE_CLOUD_LOCATION` defaults to
`global` and can be omitted.) Optional: `GEMINI_REVIEW_MODEL` (default
`gemini-3.1-pro-preview`; set `auto` to restore catalogue discovery) and
`REVIEWER_APP_ID`.

**2. Widen the Infisical identity's claim filter.** If its OIDC subject filter
is scoped to one repository, workflows in other repos will authenticate to
GitHub fine and then fail Infisical login. Widen it to the organizations, e.g.
`repo:newpush/*`, `repo:project-noemi/*`, `repo:newpush-labs/*`.

**3. The reviewer GitHub App.** A fine-grained PAT is scoped to a single
resource owner, so a multi-org fleet on PATs means one token per org, each on
its own 90-day rotation. Don't. Create a **GitHub App** instead — one identity,
installed everywhere, minting its own short-lived token per run:

1. Create the App at the **enterprise** (*Enterprise settings → GitHub Apps →
   New GitHub App*), or **transfer** an existing org-owned App there
   (App settings → Advanced → Transfer ownership → the **Enterprise**
   account). The live App slugs as `noemi-reviewer-bot` (comments as
   `noemi-reviewer-bot[bot]`, verified on PR #403).
   No webhook. Do not create a second App if one already exists.
   Transferred to the enterprise 2026-08-15 (Decision [2026-08-15-0004]).
2. Repository permissions — same least-privilege shape as the PAT:
   **Contents: Read-only**, **Pull requests: Read and write**, Metadata: read.
   The reviewer must stay structurally unable to author code.
3. Generate a **private key** only if this is a new App (a transfer keeps
   the existing key). Store it in Infisical and record the **App ID**:

   ```bash
   infisical secrets set REVIEWER_APP_PRIVATE_KEY="$(cat noemi-reviewer.*.pem)" --env=dev
   infisical secrets set REVIEWER_APP_ID="<app-id>" --env=dev
   gh variable set REVIEWER_APP_ID --org <each-org> --visibility all --body "<app-id>"
   ```

   The vault project is **noemi-agents** (same `INFISICAL_PROJECT_ID` the
   review workflow already uses). CI reads `vars.REVIEWER_APP_ID` first, then
   the Infisical `REVIEWER_APP_ID` if the variable is empty. Then delete the
   downloaded `.pem` — the vault copy is the only one that should exist.
   After a transfer, do **not** rotate the key.
4. **Install the app** on each enterprise organization (Install App →
   All repositories) for `newpush`, `project-noemi`, and `newpush-labs`.
   Transfer does not add those installs.

The workflow mints a one-hour installation token per run and the runner prefers
it over any PAT. When `REVIEWER_APP_ID` is unset the whole path no-ops and the
runner falls back to `REVIEWER_GH_TOKEN_<ORG>` / `REVIEWER_GH_TOKEN` PATs — so
the app can be provisioned without breaking anything, and once it works the
PATs should be revoked rather than left as a dormant credential.

## Rolling out

```bash
bash scripts/deploy-ai-review.sh --dry-run   # preview: who gets a PR, who is skipped
gh auth refresh -s workflow                  # pushing workflow files needs this scope
bash scripts/deploy-ai-review.sh             # open one PR per repository
```

The script is deliberately **PR-based**: it never pushes to a default branch.
Each repository's maintainers accept the reviewer by merging — the merge is the
consent step. It is idempotent: re-running skips repos that already have the
workflow, so partial rollouts recover cleanly.

## Cost note

Every deployed repo sends up to three model calls per PR update to Vertex,
billed to the shared project. Set a budget alert before, not after, the fleet
merge wave.

---

# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `403 Resource not accessible` on writes | Org approval pending, or permission not set to Read **and write** | Check the org PAT-requests page (Part 3) |
| `Token resolves to 'yourname', expected 'noemi-agent'` | Your own token is in the environment | The guard is working — unset `AGENT_GH_TOKEN` |
| `Could not resolve the machine-identity token` | Secret missing from the vault | Re-store it (Part 2 / Part 3) |
| `Infisical is installed but no project link was found` | `.infisical.json` is gitignored, so a fresh clone has none | `infisical init`, or set `INFISICAL_PROJECT_ID` for CI |
| Workflow skips with a notice | A required repository Variable is unset — the notice names it | Complete Part 1 and Part 4 |
| `Application Default Credentials are missing or expired` | Local ADC lapsed | `gcloud auth application-default login` |
| `GOOGLE_CLOUD_PROJECT is required` | Vertex backend without a project set | Set the variable, or use `GEMINI_BACKEND=generativelanguage` |
| `No available model meets the floor` | Your key lacks access to strong models | Check your tier; the failure is intentional |
| Reviewer's write probe **succeeds** | Token over-scoped | Set Contents to Read-only and re-probe |

---

# Where to go next

- [`docs/AI_REVIEW_GOVERNANCE.md`](../AI_REVIEW_GOVERNANCE.md) — the reasoning,
  the severity rubric, and the phased rollout
- [`docs/MACHINE_IDENTITY.md`](../MACHINE_IDENTITY.md) — identity register and
  rotation
- [`agents/engineering/pr-reviewer.md`](../../agents/engineering/pr-reviewer.md) —
  the reviewer persona
- [`agents/coding/mender/core.md`](../../agents/coding/mender/core.md) — the
  agent that applies the fixes

Do not enable autonomous AI-to-AI iteration until you have run the
human-in-the-loop version long enough to know how often you disagree with the
reviewer. That disagreement rate is the evidence for whether the loop can be
trusted with more.
