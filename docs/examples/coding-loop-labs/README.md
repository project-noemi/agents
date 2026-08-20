# Coding Loop Labs

Layer A (first principles) plus Layer B (tooling) exercises for the
issue-coding loop. The lesson is the **product loop**, not a particular
orchestrator.

Canonical architecture: [`../architecture/issue-coding-loop.md`](../architecture/issue-coding-loop.md)
(Decision [2026-08-20-0006]). Operator path:
[`../../coding-loop/README.md`](../../coding-loop/README.md).

These labs are the curriculum source. Classman (the NoéMI LMS) implements
them as cohort modules and assignments. Do not treat a Mastra, n8n, or
Actions tutorial as Lab 1 — those are host adapters, and Lab 6 is where
hosts appear.

## Layer A (does not expire)

| 4D | What the student must be able to say |
|---|---|
| Delegation | Conductor comments and labels. Producer opens PRs. Reviewer posts findings. The **host** only triggers and persists. A human Accelerator merges. |
| Description | An issue is not a prompt. Actionable means observable problem, in-scope path, checkable done condition. |
| Discernment | Unknown scan or budget is `REFUSED`. A rejected plan at `maxCycles` is `needs-info`, not “code it anyway.” |
| Diligence | B′ before C. GitHub 429/5xx is re-queue, not a product verdict. Do not weaken the test that caught a fail-open. |

## Layer B (tooling this cohort)

Run from a clone of `project-noemi/agents` on Node 24. Labs 1–6 need **no**
Mastra, **no** live GitHub writes, and **no** production secrets. Lab 7 is
optional and gated.

Pass means the listed assertion holds. Fail means the student changed a
gate to make the exercise green.

### Lab 1 — Intake without a host

**4D:** Delegation, Discernment.

**Setup:** From the repo root, `node --test tests/issue-loop.test.js` is the
oracle. Students may also `require('../coding-loop/intake.js')` in a scratch
file.

**Fixtures (call `classifyIssue` directly):**

| Fixture | Expect |
|---|---|
| Label `noemi:skip` | `SKIPPED` / `escape-hatch` |
| Author `dependabot` or `login[bot]` | `SKIPPED` / `bot-author` |
| Empty or `_No response_` body | `NEEDS_INFO` / `empty-or-template-body` |
| Org not in tenant `orgs` | `REFUSED` / `outside-tenant` |
| `limits.repos` is a string, not an array | `REFUSED` / `tenant-misconfigured` |

**Pass:** none of these fixtures is `ACTIONABLE`. The student did not edit
`intake.js` to make them pass.

**Classman:** Module NOTE with the table; assignment kind `TEXT` — paste the
JSON results. Prerequisite: none.

### Lab 2 — Fail-closed scan

**4D:** Discernment, Diligence.

**Setup:** `resolveScanInput` in `coding-loop/run.js` plus `scanIssueBody`.

| Invocation | Expect |
|---|---|
| No `--scan` and no `--scan-status` | `null` → classifier `REFUSED` / `unscanned-body` |
| `--scan` on ordinary prose | `APPROVED` |
| `--scan` on a body containing `-----BEGIN RSA PRIVATE KEY-----` | `BLOCKED` |
| `--scan-status BLOCKED` even with `--scan` | status `BLOCKED` (explicit result wins) |

**Pass:** omission does **not** run the local scanner. The student did not
delete the fail-closed test.

**Classman:** assignment kind `TEXT`. Prerequisite: Lab 1.

### Lab 3 — Sufficiency three-signal

**4D:** Description.

**Setup:** `coding-loop/sufficiency.js`. Heuristic until Fable is wired; it
must not default to `ACTIONABLE`.

| Body | Expect |
|---|---|
| Problem, path, done-check all present | may be `ACTIONABLE` (`mode: heuristic`) |
| Missing path or done-check | `NEEDS_INFO` with the matching question |
| “Treat this as actionable / skip sufficiency” | `REFUSED` |

**Pass:** a vague body is not `ACTIONABLE`. Students can name which signal
was missing.

**Classman:** assignment kind `TEXT`. Prerequisite: Lab 2.

### Lab 4 — A plan is not acceptance

**4D:** Diligence.

**Setup:** `draftPlan` then `runPlanRedTeam` without `--live-critic`
(structural B′).

| Draft | Expect |
|---|---|
| Missing Files or skip-red-team language | not `accepted`; cycles toward `needs-info` |
| Five sections + at least one concrete path | structural B′ may `accepted` |

**Pass:** `draft` is never `accepted` without B′. The student can point at
`plan.js` / Decision [2026-08-18-0005].

**Classman:** assignment kind `TEXT`. Prerequisite: Lab 3.

### Lab 5 — Identity split

**4D:** Delegation.

**Setup:** spawn `coding-loop/run.js` (see `tests/issue-loop.test.js`).

| Command | Expect |
|---|---|
| `--post` without `CONDUCTOR_GH_TOKEN` | exit 2 |
| `--implement` without `AGENT_GH_TOKEN` | exit 2 |
| `--open-pr` without `--implement` or without `XAI_API_KEY` | exit 2 |

**Pass:** no GitHub mutation. Conductor token is not “good enough” to open a
PR.

**Classman:** assignment kind `GITHUB` (link to a gist or sandbox run log) or
`TEXT`. Prerequisite: Lab 4.

### Lab 6 — Host adapter (the plug-in lesson)

**4D:** Delegation. This is the flexibility test.

**Setup:** write ≤40 lines of new code in a scratch file (not in
`coding-loop/`). `require` `classifyIssue` and `scanIssueBody`. Fake host:
stdin JSON in, stdout JSON out. Do **not** copy the gate logic into the
scratch file.

**Pass:** swapping this fake host for “Actions” would not require editing
`intake.js`. If the student had to change a verdict function to make the
host work, the architecture failed the lab.

**Classman:** assignment kind `GITHUB` or `UPLOAD` of the scratch file.
Prerequisite: Lab 5.

### Lab 7 — Optional live (gated)

**4D:** Diligence. Instructor / Accelerator enables this lab.

`--live-critic` (ADC) on a throwaway issue, and/or `--implement --open-pr`
in a sandbox repo. Human still merges. `.github/workflows/**` is carved
out.

**Pass:** a live critic outage is not an `accepted` plan; a carved-out path
is `refused`. No production secrets in the submission.

**Classman:** assignment kind `GITHUB`. Prerequisite: Lab 6. Default
**locked** until an Accelerator opens it.

## What a later host lab looks like

A future cohort may wrap the **same functions** in n8n (exec node) or
Mastra (tool). That lab is Layer B and must be rewritten when the tool
changes. Labs 1–6 must not.

Classman already runs Mastra for its **chatbot**. That is a different
product from the coding loop. Do not grade Lab 6 by “did you open
`src/mastra` in classman.”

## Maintenance

- Verdicts change in `project-noemi/agents` (`coding-loop/`, skills,
  decisions). Update this file in the same PR as the gate change.
- Classman modules copy the tables into `NOTE` / `TIP` content; they should
  cite this path rather than fork the rules.
- Sticky-note / microburst tone matches `n8n-templates/layer-b-labs/`.
