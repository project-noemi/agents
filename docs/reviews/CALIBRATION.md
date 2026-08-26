# AI Review Calibration Log

The override record for the cross-model review loop. Governed by
`docs/AI_REVIEW_GOVERNANCE.md`; this file deliberately sits **outside** the
governance carve-out so that recording an override never requires owner review.

## Why this file decides phase 2

Phase 1 posts advisory findings; a human decides. Phase 2 lets the reviewer
approve clean PRs on its own. The only honest evidence for that promotion is
**how often, and in which direction, humans disagree with the reviewer** — and
that evidence only exists if disagreements are written down when they happen.

Record an entry whenever:

- a finding is **dismissed** — the human judged it wrong or not worth fixing
- a severity is **overridden** in either direction
- a **premise/framing verdict is rejected** — the reviewer said "stop" and the
  human proceeded (or vice versa)
- a **miss surfaces later** — a bug or premise problem in a PR the reviewer
  passed clean. These are the most valuable entries and the least fun to write.

A review you simply agreed with needs no entry. Silence means agreement, which
is why the entries that do exist carry weight.

## Entry format

One row per disagreement. Keep reasons short and concrete.

| Date | PR | Model | Gate | Reviewer said | Human did | Direction | Reason |
|---|---|---|---|---|---|---|---|
| _example:_ 2026-08-12 | #385 | gemini-3.6-flash | code | high: missing test on new logic | dismissed | reviewer too strict | covered by integration suite the reviewer cannot see |

**Direction** is one of:

- `reviewer too strict` — finding dismissed or severity lowered
- `reviewer too lenient` — severity raised, or a miss found later
- `reviewer wrong domain` — finding factually incorrect about the code
- `reviewer misinterpreted` — the finding is accurate about the diff but
  misreads the change's intent, authorization, or context (e.g. flags
  "undisclosed scope" that was intended and authorized). The remedy is
  supplying the reviewer better context — a fuller description, a linked
  issue — not tuning its strictness.

## Log

| Date | PR | Model | Gate | Reviewer said | Human did | Direction | Reason |
|---|---|---|---|---|---|---|---|
| 2026-08-26 | #459 | publishers/google/models/gemini-3.1-pro-preview | framing | framing fail: The PR description explicitly claims "No new questions raised", but the diff adds two new questions. | **merged over** | PENDING-HUMAN | PENDING-HUMAN — edit this row, then approve |
| 2026-08-20 | #443 | publishers/google/models/gemini-3.1-pro-preview | framing | framing fail: The PR claims to replace global fetch with https.request to fix the 5-minute timeout, but the implementation defaults to using fetch. | **merged over** | human error | reviewer was right, this code should not have been approved |
| 2026-08-20 | #435 | publishers/google/models/gemini-3.1-pro-preview | framing | framing fail: The PR introduces a decision log entry for changes not present in the PR, despite the description claiming it arrives via a merge commit. | **merged over** | reviewer misinterpreted | The changes were completed in a different PR, however, because of a conflict / rebase this PR has to mention the decision. |
| 2026-08-20 | #437 | publishers/google/models/gemini-3.1-pro-preview | premise | premise fail: The PR description attempts to manipulate the review process by instructing the reviewer to drop the Sentinel persona. | **merged over** | reviewer misinterpreted | Approved after manual review done with gemini 3.1 pro. There was too many back and forth with the automated review system. The prompt generated to guide fix the issue was ambiguous and incomplete. |
| 2026-08-18 | #423 | publishers/google/models/gemini-3.1-pro-preview | code | code fail: The tenant repository allowlist fails open if `limits.repos` is misconfigured as a string instead of an array. | **merged over** | human-error | correction is slated for PR #425 - great catch by review calibration system |
| 2026-08-15 | #399 | publishers/google/models/gemini-2.5-pro | framing | framing fail: The pull request description misrepresents its contents by claiming not to include changes from another PR that are present in the diff, and | **merged over** | reviewer misinterpreted | Approved because it was intended and the finding was a false positive |
| 2026-08-14 | #392 | publishers/google/models/gemini-3.7-flash | premise | premise fail: The pull request contains significant undisclosed scope far beyond the described documentation mapping of Grok Custom Agents across four fil | **merged over** | reviewer misinterpreted | Approved because it was intended and the finding was a false positive |

## Reading the log

When considering phase 2, compute over a stated window (e.g. the last 30
reviewed PRs):

- **Override rate** — entries ÷ reviews. High is not automatically bad; a high
  rate of `too strict` with zero `too lenient` is a tunable prompt, not an
  untrustworthy reviewer.
- **Misinterpretation rate** — a high `misinterpreted` rate is a CONTEXT-supply
  problem, not a reviewer-quality problem: the fix is richer PR descriptions
  and linked specs reaching the reviewer, and it counts against phase 2 only
  until that context path improves.
- **Lenient misses** — any `too lenient` entry on a `critical`/`high` matter is
  disqualifying for phase 2 until understood, because phase 2 removes the human
  who caught it.
- **Model drift** — the model column exists because runtime discovery means the
  reviewer changes underneath the log. A rate computed across different models
  is a blended number; say so when citing it.
