# Build Your Own Coding Loop

This is the **coder quick start**: you already ship software, and you want
an issue → plan → PR loop on **your** GitHub orgs — not a first chat with a
local model.

If you have never run an AI client against this repo, start with
[`zero-to-first-agent.md`](zero-to-first-agent.md) instead. Come back here
after that first read-only win.

The operator checklist (tenant file, identities, pickup brakes) lives with
the runtime: **[`coding-loop/README.md`](../../coding-loop/README.md)**.
This page is the path from “I clone the blueprint” to “Stage A classified a
real issue.”

## Decision Point: Are You In The Right Guide?

| You are… | Use |
|---|---|
| New to the repo, want one local read-only success | [`zero-to-first-agent.md`](zero-to-first-agent.md) |
| Ready for a Docker agent home | [`builder-first-30-minutes.md`](builder-first-30-minutes.md) |
| A coder who wants issues to become PRs | **This guide** |

## What You Will Have At The End

- a private `{company}-agents` copy of this blueprint
- `tenants/` filled with **your** orgs and spend caps
- a dry Stage A run: `node coding-loop/run.js --repo org/name --issue N --scan --budget-ok`
- a clear next step for labels (`--post`), Gemini B′ (`--live-critic`), and
  opening a producer PR (`--implement --open-pr`)

You will **not** yet have org-wide pickup, Fable sufficiency, or a
provisioned conductor App. The heuristic may return `ACTIONABLE`. Those
stay later on purpose. You do **not** need Mastra for this dry run.

## What You Are Not Doing

- Designing the loop only in the private copy and “uploading it later”
  (that inverts [`../UPSTREAM_SYNC.md`](../UPSTREAM_SYNC.md))
- Commenting as `noemi-agent` or the reviewer (`--post` refuses those tokens)
- Pointing the loop at `newpush/newpush-mastra-orchestration` (Slack / Datto
  chatbot, different product)
- Enabling every issue in three orgs before skip / budget / scan exist

## Step 1: Copy The Blueprint

```bash
# example names — use your org
gh repo create your-org/your-org-agents --private --clone
# or copy this tree into an existing {company}-agents develop branch
```

NewPush’s live copy is `newpush/newpush-agents`. Sync **from**
`project-noemi/agents` (`develop`) into that copy; do not invent Stage A
there and paste back.

Keep `develop` as the integration branch. Same merge gate as this repo.

## Step 2: Verify The Tooling

From the copy’s root (macOS / Linux / ChromeOS Linux):

```bash
bash scripts/verify-env.sh --mode=builder
node -v   # 24
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode builder
```

You need Node 24 and `gh` (or a token in the environment) to read an issue.

## Step 3: Fill The Tenant, Not The Runner

Copy or edit `tenants/internal.json` in **your** tree:

- `orgs` — GitHub organizations the loop may touch
- `limits.repos` — empty = all repos in those orgs; otherwise an allowlist
- `limits.concurrent_jobs` and `limits.daily_usd` — set before org-wide pickup

Do not hardcode your org name into `coding-loop/`.

## Step 4: Dry-Run Stage A On One Issue

```bash
export GH_TOKEN=…   # read is enough for a dry run
node coding-loop/run.js --repo your-org/your-repo --issue N --scan --budget-ok
```

Expect one of `SKIPPED`, `NEEDS_INFO`, `REFUSED`, or heuristic
`ACTIONABLE`. Omitting `--scan` / `--scan-status` or the budget assertion
is `REFUSED`. Fable is not wired; the heuristic still must not default to
`ACTIONABLE`.

## Step 5: Post Only With A Conductor Token

```bash
export CONDUCTOR_GH_TOKEN=…   # issues: write; no Contents write
node coding-loop/run.js --repo your-org/your-repo --issue N --scan --budget-ok --post
```

If `CONDUCTOR_GH_TOKEN` is missing, the command exits. Producer and
reviewer tokens are the wrong identity.

## Step 6: Turn On Pickup Later

After skip / bot / empty-body / budget / scan are understood on **one**
repo:

- wire `issues: opened` (Actions or a webhook) to `coding-loop/run.js`
- then one org, then the rest
- keep Stage D on the existing fleet reviewer

Gemini B′ (`--live-critic`) needs ADC (`GCP_ACCESS_TOKEN` or
`gcloud auth application-default login`). Opening the implementation PR
is a **producer** act, not pickup:

```bash
infisical run --env=dev -- node coding-loop/run.js \
  --repo your-org/your-repo --issue N \
  --scan-status APPROVED --budget-ok \
  --implement --open-pr
```

That requires `AGENT_GH_TOKEN` and `XAI_API_KEY`. Do not open PRs with
the conductor token.

Architecture: [`../architecture/issue-coding-loop.md`](../architecture/issue-coding-loop.md)
(product loop vs host). Labs:
[`coding-loop-labs/README.md`](coding-loop-labs/README.md).

## What To Read Next

1. [`../../coding-loop/README.md`](../../coding-loop/README.md) — full operator checklist
2. [`coding-loop-labs/README.md`](coding-loop-labs/README.md) — Layer A / Layer B exercises
3. [`../UPSTREAM_SYNC.md`](../UPSTREAM_SYNC.md) — keep the private copy honest
4. [`../MACHINE_IDENTITY.md`](../MACHINE_IDENTITY.md) — conductor / producer / reviewer
5. [`builder-first-30-minutes.md`](builder-first-30-minutes.md) — only if you also want a Docker home
