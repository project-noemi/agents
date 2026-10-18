# AI Review — override mode

The advisory reviewer (`scripts/review-pr.js`, posting as `noemi-reviewer-bot`)
runs four gates in order: **premise** (Delegation), **framing** (Description),
**code** (Diligence), **compliance** (Discernment). A failed gate stops the
review and the later gates are reported as *skipped, not passed*.

Override mode lets a human record that a failed gate's finding has been
considered and accepted, so the reviewer can still evaluate the remaining
gates instead of leaving them unreviewed. It never turns a failure into a pass.

**Without an override comment, behavior and output are unchanged.** The early
stop stays, and the posted comment is identical to the pre-override output (a
golden test in `tests/review-override.test.js` pins this).

## Policy

- An override happens **only at the owner's direction, relayed through the
  Dep 12 PR Watch Bot** (or posted by the owner directly).
- **The coding bot never overrides its own work.** A coding agent that receives
  a failing gate fixes the finding or reports why it disagrees; it does not post
  an override command, and it must never add itself to the allowlist.
- The allowlist is empty by default. Nobody is added to it by this change; the
  owner sets the variable.

## Trigger — a PR comment command

```
/ai-review override <gate> sha:<head-sha> reason: <why this finding is accepted>
```

- `<gate>` is one of `premise`, `framing`, `code`, `compliance`. Findings do
  not carry stable rule IDs, so the gate is the narrowest stable unit.
- `sha:` is the PR head commit the override was decided on — at least 7 hex
  characters, matched as a prefix of the current head.
- `reason:` is required and is reproduced verbatim in the review output.
- The command must **start a line**. Several commands may appear in one comment
  (one per line), or across several comments.

### Why a comment, not a label

A comment alone carries everything the audit needs in one immutable-by-policy
record: who (`user.login`), when (`created_at`), why (the reason), which gate,
which commit, and a permalink. A label carries none of the reason, can be added
by anyone with triage access, and splitting the decision across a label and a
comment creates two things that can disagree. Edited comments are ignored, so
the record cannot be rewritten after the fact — post a new comment instead.

### Why SHA-bound

An override is a judgement about a specific diff. Binding it to the head SHA
means a new push makes it **stale**: the next review reports it as ignored and
the early stop applies again until the override is renewed for the new head.
Naming the SHA explicitly (instead of inferring "the head at comment time")
makes the binding visible in the comment itself and impossible to misattribute
when a push races the comment.

## Who can override — `NOEMI_REVIEW_OVERRIDE_ACTORS`

An Actions **variable** (org or repo level; the reusable workflow resolves it in
the caller's context) holding GitHub logins separated by commas or spaces,
case-insensitive, optional leading `@`.

- Empty or unset: no override is honored; any command is listed as ignored.
- A command from a login not on the list is ignored and the output says so.
- The PR author is treated like anyone else: not allowlisted, not honored.
- The workflow passes the value as `--override-actors`, not as an environment
  variable, so the Infisical vault that `infisical run` injects cannot supply
  or widen it.

## What happens on a re-review

Post the override comment, then re-run the latest **AI Review (advisory)** run
for the PR (Actions → the run → *Re-run jobs*, or `gh run rerun <run-id>`). The
reviewer reads the PR's comments fresh on every run.

| Overridden gate | Effect |
|---|---|
| premise (layer 1) | framing, code, compliance run |
| framing (layer 2) | code, compliance run |
| code (layer 3) | compliance runs |
| compliance (layer 4) | **recorded only** — last gate, no continuation, verdict stays `request-changes` |

A later gate that genuinely fails still stops the run unless it too is
overridden. An override for a gate that passed, or was never reached, is listed
as *not applied*.

## What the output shows

- Gate table: `⚠️ **OVERRIDDEN** (fail)` — never `pass`.
- A banner: **Overall: OVERRIDDEN — not a clean pass**, naming the gates.
- An *Overrides* section: gate, actor, timestamp, head SHA, reason, comment link;
  plus every ignored command and why (not allowlisted, PR author, stale SHA,
  edited, malformed, superseded).
- The original findings, unchanged, each tagged `**OVERRIDDEN**`.
- Recommendation `overridden` when the only blocking findings sit on overridden
  premise/framing/code gates. Compliance findings stay live.
- Overridden findings still count as blocking for the approval-dismissal step:
  the decision is a human's, and a human re-approves.

Override text is never sent to the reviewing model; the gates are evaluated on
the diff exactly as before.
