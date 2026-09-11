# Mines CSCI 370 Field Session — Fall 2026

## Engagement Metadata

- **Engagement ID:** `mines-csci370-fall-2026`
- **Status:** `active`
- **Kind:** `student-cohort`
- **Runs:** `2026-09-01` → `2026-12-18`
- **Integration Branch:** `feat/tools-blueprint-compiler`
- **Promotes Into:** `develop` (lowest trunk)
- **Scope Of Work:** `tools/blueprint-compiler/`
- **GitHub Team:** `mines2026fall` (`push`)
- **Client:** NewPush — Balázs Nagy (`bnagy@newpush.com`)
- **Advisor:** Kathleen Kelly, Colorado School of Mines
- **Team:** Ally Wallace · Jake Galloway · Ryan Clark · Van Nguyen
- **Engagement Contract:** `tools/blueprint-compiler/REQUIREMENTS.md`
- **Contributor Guide:** `tools/blueprint-compiler/GIT-WORKFLOW.md`

## Purpose

A four-student Colorado School of Mines CSCI 370 Field Session team building the Blueprint
Compiler — an engine that reads a NoéMI Markdown persona and instantiates the agent it
describes — as an isolated package under `tools/blueprint-compiler/`.

The cohort collects a semester of work on one long-lived integration branch and promotes it
to `develop` as a single reviewed unit, rather than merging sprint by sprint. The reasons are
editorial and pedagogical rather than technical: the package is additive and isolated, so
continuous merging would break nothing, but the client wants to review the whole before it
becomes part of a public reference architecture, and a single owned branch is a clearer
model for students new to Git.

That choice is the deviation this profile exists to declare.

## Contribution Deltas

| Default contract | This engagement | Why |
|---|---|---|
| Contributor pull requests target the lowest trunk (`develop`) | Pull requests target `feat/tools-blueprint-compiler` | The semester promotes as one reviewed unit |
| Branches are short-lived and deleted after merge | The integration branch lives the whole engagement and cannot be deleted | Protects a cohort's only working surface |
| Contributors keep their branch current with `develop` | The **team** keeps the integration branch current with `develop`, by merge and never by rebase | Force-push is blocked on the branch, so history can only move forward |
| Work is reviewed before entering the branch it targets | Direct pushes to the integration branch are permitted | The promotion PR into `develop` is reviewed; nothing reaches a trunk unreviewed either way |

## Mainline-Parity Controls

| # | Control | State |
|---|---|---|
| 1 | Same CI gate | **In force.** `feat/tools-blueprint-compiler` is in `validate.yml`'s `push` and `pull_request` filters; verified green 2026-09-11 |
| 2 | Same branch protection | **In force.** Ruleset "Protect Mines Field Session branch" — `deletion` and `non_fast_forward`, no bypass actors, matching the trunks' ruleset |
| 3 | Review requirement | **Relaxed by decision.** Direct pushes permitted; see Contribution Deltas |
| 4 | Merge-source discipline | **Relaxed by decision.** Follows from 3 |
| 5 | Continuous sync from `develop` | **In force, manual.** Owned by the student team, at least once per sprint and after each demo |
| 6 | Permanent open integration PR | **In force.** A draft pull request to `develop` stays open for the engagement's life, running the full gate on every push while remaining unmergeable |

## What Does Not Change

No engagement may relax these. They are not deltas and are not negotiable per-cohort:

- **Fetch-on-Demand secret handling.** Credentials resolve at runtime from Infisical or
  1Password. Never hardcoded, never written to disk, never in logs or fixtures. This
  repository is public, so a pushed credential is exposed at push time — the promotion PR
  cannot catch it, and force-push being blocked means removal requires an admin.
- **Node.js 24 baseline.**
- **Conventional Commits.**
- **Merge into a trunk is a human act.** No agent identity approves or merges.
- **The Refusal Principle** and the persona and skill heading contracts, for any spec work.
- **Commits under the contributor's own name.** No IP assignment; nothing is hidden.

## Exit Criteria

When the Field Session ends:

1. The integration branch's draft PR is marked ready, reviewed, and merged into `develop`.
2. `status` flips to `closed` in [`docs/branch-model.json`](../docs/branch-model.json), which
   makes the branch an invalid pull request target.
3. The branch is removed from `validate.yml`'s filters.
4. The protection ruleset is deleted — it is the only way the branch can then be removed,
   which is deliberate.
5. The outcome is recorded here, and the profile is kept rather than deleted so the next
   cohort starts from it.

## Audit Notes

- `scripts/audit-repo.js` (`checkBranchModel`) fails the audit when an `active` registration
  in the branch model has no profile here, when a profile's declared integration branch is
  missing from `validate.yml`'s `pull_request` filter, or when an `active` engagement's
  `endsOn` date has passed.
- Branch protection is asserted by this profile but lives in GitHub repository settings,
  which CI cannot read without a token. It is verified by hand; last verified 2026-09-11.
- Origin: Decision [2026-09-11-0001]. The engagement itself predates the profile — it ran
  from 2026-09-01 with its deviations undeclared, which is the gap this layer closes.
