# Engagements

An **engagement profile** records a scoped, time-boxed deviation from the default
contribution contract, and the controls that make the deviation safe.

The default contract in [`CONTRIBUTING.md`](../CONTRIBUTING.md) and
[`docs/REQUIREMENTS.md`](../docs/REQUIREMENTS.md) applies to every contributor. An
engagement profile names the specific rules that differ for one group — a student cohort, a
client team, a partner — and everything it does not name still applies unchanged.

## Why this exists

[`CONTRIBUTING.md`](../CONTRIBUTING.md) says contributor work targets the lowest trunk.
Some groups instead collect their work on a **long-lived integration branch** and promote it
as one unit. That is a legitimate pattern for ring-fenced or external teams, and a dangerous
one left undeclared: an unregistered long-lived branch carries none of the controls the
trunk it will eventually merge into carries, and nobody notices until the merge.

So the rule "a pull request may target the lowest trunk **or a registered integration
branch**" needs a registry, or "a specific branch" quietly means "any branch". This directory
is the human-readable half of that registry;
[`docs/branch-model.json`](../docs/branch-model.json) is the machine-readable half, and
`scripts/audit-repo.js` fails the audit when the two disagree.

## Mainline-parity controls

A long-lived integration branch is governed as a mainline, not as a feature branch.
Every profile states these six and their status:

| # | Control | What it means |
|---|---|---|
| 1 | Same CI gate | The branch appears in `.github/workflows/validate.yml`'s `push` and `pull_request` filters |
| 2 | Same branch protection | A ruleset blocking deletion and non-fast-forward, matching the trunks' |
| 3 | Review requirement | Whether work entering the branch needs a reviewed pull request |
| 4 | Merge-source discipline | What may enter the branch |
| 5 | Continuous sync from the lowest trunk | How the branch avoids divergence, and who owns doing it |
| 6 | Permanent open integration PR | A draft PR to the lowest trunk, open for the engagement's life |

Control 6 is the one most often skipped and the one that does the most work: a draft PR
cannot be merged by anyone, yet still runs the full gate on every push. It gives continuous
validation of the *merge* — which branch-level CI never checks — plus a stable review
surface and early warning of divergence.

Controls 3 and 4 may legitimately be relaxed when the branch's own promotion PR is reviewed:
nothing reaches the trunk unreviewed either way. Control 2 and the secret-handling rules may
not be relaxed — on a public repository a leaked credential is exposed at push time, so no
gate at the promotion boundary can catch it.

## Adding a profile

1. Copy the structure of an existing profile. Required sections:
   `Engagement Metadata`, `Purpose`, `Contribution Deltas`, `Mainline-Parity Controls`,
   `What Does Not Change`, `Exit Criteria`, `Audit Notes`.
2. Register the branch in [`docs/branch-model.json`](../docs/branch-model.json) with a
   matching `engagement` slug and `status: "active"`.
3. Add the branch to `validate.yml`'s `push` and `pull_request` filters.
4. Create the protection ruleset.
5. Run `npm run audit` — it fails if the profile, the branch model, and the CI filters
   disagree.

## Closing a profile

When the work merges, set `status` to `closed` in the branch model and record the outcome
under `Exit Criteria`. Profiles are kept, not deleted: the next cohort starts from the last
one rather than from scratch.
