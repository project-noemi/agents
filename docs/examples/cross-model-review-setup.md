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
| A Gemini API key | Lets the reviewing AI actually run |
| Infisical secrets | Where those credentials live. Never in files, never in chat |
| A GitHub workflow | Runs the review automatically on each pull request |

## Before you start

You need:

- **Admin access** to the GitHub repository
- **An Infisical account** with a project created ([infisical.com](https://infisical.com))
- **The `gh` CLI** installed and logged in (`gh auth login`)
- **The `infisical` CLI** installed and logged in (`infisical login`)
- **A Google account** for the Gemini key

Check the CLIs are working:

```bash
gh auth status
infisical user get
```

---

# Part 1 — Choosing your Gemini key

This is the decision most people get wrong, so it comes first.

There are three ways to get Gemini access. They differ in setup effort, and — the
part that matters — in **whether Google may use your code to train their
models**.

| | Setup time | Long-lived key? | Your code used for training? | Code changes needed |
|---|---|---|---|---|
| **A. AI Studio, free tier** | 5 minutes | Yes | **Likely yes** | None |
| **B. Gemini API, billed project** | ~30 minutes | Yes | No | None |
| **C. Vertex AI + federation** | Half a day | **No** | No | Yes |

## Option A — AI Studio free key

**How:** Go to [aistudio.google.com](https://aistudio.google.com) → *Get API
key* → *Create API key*. Done in about a minute.

**Good:** Fastest possible start. Works immediately with this repository's code.

**Bad:** Free-tier terms have historically allowed Google to use your prompts to
improve their products. **Your reviewer reads entire code diffs.** For a public
repository that is tolerable. The moment you point this at a private or client
repository, it is a data-governance problem. Free quotas are also low, and a
thorough review uses the expensive models.

**Use it for:** proving the pipeline works. Not for real operation.

## Option B — Gemini API key on a billed Google Cloud project

**Recommended starting point.**

**How:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (name it something like `noemi-ai-review`)
3. Link a billing account: **Billing** → *Link a billing account*
4. Enable the API: **APIs & Services** → *Enable APIs* → search
   "Generative Language API" → **Enable**
5. Create the key: **APIs & Services** → *Credentials* → *Create Credentials* →
   *API key*
6. **Restrict it** — click the new key → *API restrictions* → *Restrict key* →
   select only **Generative Language API** → *Save*

Step 6 matters. An unrestricted key works for every Google API your project can
reach; a restricted one only does the job you created it for.

**Good:** Paid tier means your code is not used for training. Real quotas. Usage
and cost visible in Cloud Billing, so you can see what review costs per pull
request. No code changes — the repository already targets this API.

**Bad:** Still a long-lived key, so it must live in a vault and be rotated.

> **Note on IP restrictions:** you may be tempted to lock the key to an IP
> address. GitHub's hosted runners use changing IPs, so this will break. API
> restriction is the meaningful control here.

## Option C — Vertex AI with Workload Identity Federation

**The eventual target, not the starting point.**

GitHub proves its identity to Google directly, and Google hands back a
short-lived token. **No key exists anywhere** — nothing to leak, nothing to
rotate.

**Good:** No long-lived credential. Full Google Cloud IAM, audit logs, data
residency controls, and per-identity attribution of every review call. This is
what a regulated environment will ask for.

**Bad:** Vertex uses a different API endpoint than options A and B, so
[`scripts/resolve-gemini-model.js`](../../scripts/resolve-gemini-model.js) needs
a new code path. Also requires configuring workload identity pools and pinning a
region.

> **A note that sounds contradictory but isn't:** this project's rule is "use
> Infisical wherever possible." With Option C, Infisical stores *nothing* for
> Gemini — because there is no secret to store. That is the stronger version of
> the rule, not an exception to it. A vault protects static secrets; federation
> removes them.

## Recommendation

**Start with B. Move to C before pointing this at any client repository.**

⚠️ **Verify the current terms yourself.** Google revises Gemini API tiers and
data-use policy often, and the free-versus-paid training distinction is the
single fact this recommendation depends on. Read the current terms before
choosing A.

---

# Part 2 — Store the key in Infisical

Never paste a secret into a chat window, a file, or a commit. Type it in your own
terminal only.

Link the repository to your Infisical project (creates `.infisical.json`):

```bash
infisical init
```

Store the key:

```bash
infisical secrets set GEMINI_API_KEY="paste-your-key-here" --env=dev
```

Confirm it is retrievable without printing it:

```bash
infisical secrets get GEMINI_API_KEY --env=dev >/dev/null && echo "stored OK"
```

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

In Infisical: **Organization Settings** → *Identities* → *Create identity*. Give
it OIDC auth configured to trust GitHub Actions, then grant it read access to
your project. Follow Infisical's current OIDC documentation for the exact trust
fields — they are specific to your organization and repository.

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

> This does **not** change the `gemini-2.5-flash` pin elsewhere in the
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

# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `403 Resource not accessible` on writes | Org approval pending, or permission not set to Read **and write** | Check the org PAT-requests page (Part 3) |
| `Token resolves to 'yourname', expected 'noemi-agent'` | Your own token is in the environment | The guard is working — unset `AGENT_GH_TOKEN` |
| `Could not resolve the machine-identity token` | Secret missing, or repo not linked to Infisical | Run `infisical init`, then re-store the secret |
| Workflow skips with a notice | `GEMINI_API_KEY` not reachable | Complete Part 4 |
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
