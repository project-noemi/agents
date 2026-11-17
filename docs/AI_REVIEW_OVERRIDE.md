# AI Review — override mode and calibration seeding

The advisory reviewer (`scripts/review-pr.js`, posting as `noemi-reviewer-bot`)
runs four gates (layers) in order: **1 premise** (Delegation), **2 framing**
(Description), **3 code** (Diligence), **4 compliance** (Discernment). A failed
gate stops the review and the later gates are reported as *skipped, not passed*.

Override mode lets an authorized human record that a failed gate's finding was
considered and accepted. That has two effects:

1. **Review:** for layers 1–3 the reviewer runs the remaining layers instead of
   stopping. Layer 4 is last: its override is recorded and shown but continues
   nothing and never turns the result into a pass.
2. **Calibration:** the override is snapshotted as evidence on a **draft**
   calibration PR for its rule ID, so recurring overrides become reviewer
   tuning a human can act on.

**Without an override comment, behavior and output are unchanged.** The early
stop stays, and the posted review is identical to the pre-override output (a
golden test in `tests/review-override.test.js` pins this).

## Policy

- An override happens **only at the owner's direction, relayed through the
  Dep 12 PR Watch Bot** (or posted by the owner directly).
- **The coding bot never overrides its own work.** A coding agent that receives
  a failing gate fixes the finding or reports why it disagrees. It never posts
  an override command, and it never adds itself to the allowlist.
- The allowlist is empty by default. This change adds nobody to it; the owner
  sets the variable.
- Calibration PRs are always drafts. A human reviews, edits, and merges them.
  Nothing is applied to the reviewer automatically.

## The command (the single override trigger)

```
/override layer=<1-4> rule=<rule-id> sha=<head-sha> reason="<why>" [one-off]
```

| Field | Required | Meaning |
|---|---|---|
| `layer` | yes | `1` premise · `2` framing · `3` code · `4` compliance (gate names also accepted) |
| `rule` | yes | the finding's rule ID: letters, digits, `. _ : / -`, max 80. The calibration dedupe key, compared case-insensitively. |
| `sha` | for the review | the PR head the decision was made on (7–40 hex). Without it the review does not apply the override; calibration still records it. |
| `reason` | for the review | quoted (`"..."` or `'...'`, `\"` escapes) or the rest of the line. Without it the review does not apply the override; calibration opens the draft flagged **incomplete — no reason provided**. |
| `one-off` | no | the overrider considers this a legitimate exception, not a reviewer error. Recorded on the evidence and the calibration PR. |

The command must **start a line** of a PR comment. Several commands may appear
in one comment (one per line) or across comments. Mentions mid-sentence are not
commands. Bot output never begins a line with `/override`.

### Why a comment

One comment holds everything the audit needs: who, when, why, which layer and
rule, which commit, and a permalink. A label carries no reason, anyone with
triage access can add one, and a label plus a comment gives two records that
can disagree.

### Why SHA-bound

An override is a judgement about one diff. The review applies it only while
`sha=` is a prefix of the current head. A new push makes it **stale**: the next
review lists it as ignored and the early stop applies until someone renews it.
Naming the SHA in the comment makes the binding visible and avoids a push
racing the comment.

## Who can override: `NOEMI_REVIEW_OVERRIDE_ACTORS`

An Actions **variable** (org or repo level) holding GitHub logins separated by
commas or spaces, case-insensitive, optional `@`. Both the reviewer and the
calibration seeder use the same check (`scripts/review-override.js`).

- Empty or unset: nobody can override. Commands are listed or flagged as ignored.
- Logins not on the list are ignored, and the output says so.
- The PR author is treated like anyone else: not listed, not honored.
- Workflows pass the value as a command-line argument (`--override-actors`),
  never as an environment variable, so the Infisical vault that
  `infisical run` injects cannot supply or widen it.
- Teams/roles are not resolved: the workflow token cannot read team membership.
  List logins explicitly.

## Review behavior

Post the override, then re-run the latest **AI Review (advisory)** run for the
PR (*Re-run jobs*, or `gh run rerun <run-id>`). The reviewer reads comments
fresh each run and ignores edited comments.

| Overridden layer | Effect |
|---|---|
| 1 premise | layers 2, 3, 4 run |
| 2 framing | layers 3, 4 run |
| 3 code | layer 4 runs |
| 4 compliance | **recorded only** — no continuation; recommendation stays `request-changes` |

A later layer that genuinely fails still stops the run unless it is overridden
too. The output shows:

- Gate table `⚠️ **OVERRIDDEN** (fail)`, never `pass`, and a banner
  **Overall: OVERRIDDEN — not a clean pass**.
- An *Overrides* section: layer, rule, actor, timestamp, head SHA, reason,
  one-off, comment link; and every ignored command with why (not allowlisted,
  PR author, stale, edited, malformed, no reason, no sha).
- The original findings, unchanged, each tagged `**OVERRIDDEN**`.
- Recommendation `overridden` when the only blocking findings sit on overridden
  layers 1–3. Layer-4 findings stay live.
- Overridden findings still count as blocking for approval dismissal.
- Override text is never sent to the reviewing model.
- `scripts/calibration-watch.js` counts only `❌ fail` rows, so a merge over an
  OVERRIDDEN gate is logged by the override seeder rather than twice.

## Calibration seeding (`.github/workflows/override-calibration.yml`)

Runs on **new** PR comments that contain `/override`:

1. **screen** (`contents: read`, no secrets): parses and authorizes.
2. **flag** (`pull-requests: write`, `GITHUB_TOKEN`): runs only when something
   was not accepted. Posts a notice on the source PR. Nothing is seeded.
3. **seed** (`id-token: write` → Infisical → `noemi-agent`, verified by login):
   re-authorizes, then for each accepted command:
   - **Snapshot** from the event payload: full comment text, author, timestamp,
     rule, layer, one-off, reason (verbatim or none), source PR and comment
     URL, head SHA at acceptance, and a sha256 of the body. Edits never
     re-trigger, so a later edit or deletion cannot change the evidence.
   - **One open draft per rule ID.** Branch `calibration/override/<rule-slug>`.
     If a draft is open, the evidence is appended and the PR body refreshed. If
     the previous one was merged or closed, a new branch and draft are opened.
     Re-runs for the same comment add nothing.
   - **Links both ways:** the calibration PR lists every source PR and comment.
     The source PR gets a comment linking the calibration PR, and the
     calibration PR gets a comment for each new source.
   - **Reasons:** missing → `incomplete — no reason provided` (title prefix
     `[incomplete]`, label `incomplete-override-reason`); never invented.
     Vague → quoted verbatim with a request for more detail.
   - **`security-review-required`** label for layer-4 overrides and for rules
     whose ID names security, secrets, credentials, tokens, keys, auth,
     injection, privacy/PII, crypto, or the refusal principle. The bot never
     proposes weakening those rules, or any rule: it writes evidence files under
     `docs/reviews/overrides/` only.
   - **`one-off-override`** label and a note that a reviewer may close the
     draft as a one-off.

Safety for an `issue_comment` workflow: every job checks out the **default
branch** with `persist-credentials: false`, never the PR head. The comment body
is read from `$GITHUB_EVENT_PATH` as data and never interpolated into a shell
script.

Scope: the seeder runs where the comment is posted and writes the calibration
PR in that same repository. Fleet repositories do not have it yet; seeding
calibration PRs into `project-noemi/agents` from other repositories needs a
cross-repository credential, which is a separate decision.
