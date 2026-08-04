# Release Process

This document explains how releases work in this repository, why the process is
set up the way it is, and what it gives the teams building on the NoéMI Agent
framework. You should be able to read this without prior context and understand
both *what* happens and *why it matters*.

## The short version

There is no "cut a release" ceremony and no version number to argue about. Two
things run on two separate rhythms:

- **Versions** are minted **whenever real, user-facing change lands** — as often
  as that happens, and not at all on quiet days. Each one is a **calendar date**:
  `YYYY.MM.DD` (e.g. `2026.08.04`).
- **User-facing communication** (the feature digest + social post) is drafted on
  a **separate weekly rhythm**, and only ever posted after a **human approves**.

Nobody hand-picks a version number, and nobody hand-writes a changelog. The date
and the commit history are the source of truth.

## Why date-based versioning (`YYYY.MM.DD`)

The earlier version of this process used SemVer (`0.2.0`, `1.0.0`). For a
**governance and reference framework**, SemVer sends the wrong signal:

- **SemVer invites pinning and sitting still.** "We're on 1.4.0 and it works" is
  a perfectly rational thing to say about a library — and exactly the wrong thing
  to say about a *governance baseline*. A team pinned to an old minor is running
  last season's guardrails, deprecated patterns, and stale threat assumptions,
  while believing they are "stable."
- **A date is an honest currency signal.** `2026.08.04` tells you, at a glance,
  how current your governance posture is. `1.4.0` tells you nothing about *when*
  that posture was last refreshed.

So the scheme is a plain **calendar date: `YYYY.MM.DD`** (four-digit year, month,
day; UTC; no `v` prefix). Because a version is stamped per content-bearing
promotion (below), more than one can land on the same day; the second and later
same-day releases get a numeric suffix — `2026.08.04.1`, `2026.08.04.2`, ….

### "How far behind am I?" reads straight off the dates

The whole point of a date is that the gap is legible without a lookup table.
If you are on `2026.05.30` and the current release is `2026.08.04`, you are
**about two months behind** — you can see it in the numbers. There is no need to
count minor versions or consult a compatibility matrix; subtract the dates.

A rough traffic-light reading anyone can publish to partners and clients:

| Signal | Meaning |
|--------|---------|
| 🟢 **Green** | On (or within days of) the current date. |
| 🟡 **Amber** | Roughly a few weeks to a month behind. Time to look at the upgrade path. |
| 🔴 **Red** | A couple of months or more behind. Running on materially stale governance. |

"Our agent governance is 🟢 current as of `2026.08.04`" is a claim a buyer can
trust and a vendor can be held to.

## Content-gating: no empty releases, no count threshold

A date-based scheme could become theatre — a tag a day with nothing behind it.
It does not, because promotion is **content-gated**:

- A release happens **only when `develop` carries an unreleased user-facing
  change** vs `main` — concretely, **at least one Conventional Commit of type
  `feat` or `fix`** in the `main..develop` range (everything since the last
  promotion). One is enough.
- If there is none, the promotion job **exits cleanly as a no-op** — it logs
  "nothing to release" and does not tag, release, or post. **Quiet days are
  quiet.** No noise, no empty tag.
- The gate is **content, not count.** There is no "promote after N PRs"
  threshold. A single important `feat` releases; a hundred `chore`/`docs`/`ci`
  commits do not. `docs`, `chore`, `refactor`, `test`, `ci`, `build`, and merge
  commits are deliberately not release triggers.

So a date on a tag always means *something user-facing actually shipped that
day* — the currency signal stays honest.

## Auto-promote on green — via an auto-merged `develop → main` PR

This repository runs a two-branch flow: feature branches merge into `develop`,
and only `develop` may reach `main` (enforced by `require-develop-source.yml`;
see [CONTRIBUTING.md](../CONTRIBUTING.md#branching-model)).

`develop` **is the reviewed integration line** — every change reaches it through
a human-reviewed feature-branch PR. So promoting `develop → main` is not a new
review surface; it is a promotion of work that has *already* been reviewed. For
that reason **no second human approval is required at the promotion step by
default** (it can be added — see below).

Promotion happens through an **auto-merged pull request**, not a direct push.
When the content gate opens and **CI on develop is green**, the promotion job
opens (or reuses) a `develop → main` PR and enables **GitHub native auto-merge**
(`gh pr merge --auto --merge`); the PR merges the instant `main`'s required
checks pass. Only *after* the PR merges does release-it stamp the CalVer date on
`main`.

Why a PR instead of `git push origin main`? So `main` can stay **fully protected
against direct pushes** with **no bot bypass**. Promotion is the one thing that
moves `develop`'s content into `main`, and it now travels the same protected path
as any other change: through a PR. `require-develop-source.yml` still runs on that
PR and **guarantees its only possible source is `develop`** — the existing
develop-source rule is exactly what makes an auto-merged promotion PR safe.

### Why auto-merge (not poll-then-merge)

GitHub's branch protection on `main` is the single source of truth for whether a
merge is allowed. `--auto` **delegates the gate to protection** and merges as
soon as required checks pass, rather than re-implementing that logic in the
workflow. It is also **durable**: it is not bound by the promotion job's timeout,
so a slow check does not abandon a green PR. The job polls afterward only to learn
*when* the merge landed, so it can stamp the release on the freshly-merged `main`
in the same run. (If auto-merge cannot be enabled — the repo's "Allow auto-merge"
setting is off, or `main` has no required checks to wait on — the job falls back
to an immediate merge, which succeeds when `main` only requires "must be a PR".)

### The `GITHUB_TOKEN` nuance (and when `PROMOTE_TOKEN` is required)

A pull request opened with the default `GITHUB_TOKEN` **does not trigger
`on: pull_request` workflows** — GitHub suppresses that to avoid recursive runs.
This matters for the promotion PR:

- **If `main` requires status-check *re-runs* on the PR:** a GITHUB_TOKEN-opened
  PR would never get those checks, so auto-merge would stall forever. In this
  configuration you **must** provide a **`PROMOTE_TOKEN`** secret — a PAT or the
  `noemi-agent` app token — and the job opens the PR with it so the checks run.
- **If `main` requires only "must be a PR"** (relying on the checks develop
  *already* passed, not a re-run): **no secret is needed.** The PR is immediately
  mergeable and auto-merge completes at once with `GITHUB_TOKEN`.

The job prefers `PROMOTE_TOKEN` when the secret is present and falls back to
`GITHUB_TOKEN` otherwise. If the PR does not merge within the polling window
(the usual cause being "re-runs required but `PROMOTE_TOKEN` not set"), the job
stamps **nothing** — a safe no-op — and the next scheduled run re-checks the
still-open PR.

### Where the human gate actually sits

The human-approval gate in this model is **not** on the merge — develop was
already reviewed. It sits on the **weekly digest**: nothing is communicated to
the outside world until a human has read and approved it (see below). Merging
reviewed work forward is automatic; *speaking on the framework's behalf* is not.
An admin **may** additionally require one approval on the promotion PR (see the
branch-protection section); by default none is required because develop is
already reviewed.

## `main` branch-protection settings to apply

To make this model safe, a repository admin should configure branch protection
on `main` as follows:

- **Require a pull request before merging** into `main`. This is what forces the
  promotion to travel through the auto-merged PR instead of a direct push.
- **Block / disallow direct pushes to `main`** for everyone, and **do not grant
  the automation a bypass** ("no bot bypass"). Promotion goes through the PR like
  any other change.
- **Keep the `require-develop-source` status check** required on `main` PRs. It
  guarantees the promotion PR (and any PR into `main`) can only originate from
  `develop`. Never weaken or add exceptions to it.
- **Optionally require 1 approval** on PRs into `main`. Not required by default —
  develop is already reviewed — but supported if a second sign-off on the
  promotion is desired. (If you require approvals, ensure the automation can still
  satisfy them, e.g. via a reviewer or an approval step.)
- **Only if you require status-check *re-runs* on the promotion PR:** add a
  **`PROMOTE_TOKEN`** repository secret (a PAT or the `noemi-agent` app token) so
  the PR is opened with a non-default token and its `on: pull_request` checks
  actually run. If `main` requires only "must be a PR", **no secret is needed**.
- **Enable "Allow auto-merge"** in the repository's General settings so
  `gh pr merge --auto` can arm the merge. (Without it, the job falls back to an
  immediate merge, which works only in the "must be a PR" configuration.)

### A note on release-it's changelog commit

After the promotion PR merges, release-it stamps the release on `main`. The
annotated tag and the GitHub Release are **tag/release refs**, which
branch-protection rules do **not** govern — they land regardless of how
locked-down `main` is. The one write release-it makes to the `main` *branch* is
the `chore(release): <version>` **CHANGELOG.md commit**. If your protection is
strict enough to block even that automation write (consistent with the "no bot
bypass" posture), move `CHANGELOG.md` generation onto `develop` so it flows
through the promotion PR — **do not** grant the bot a protection bypass.

## Decoupled cadences: versions per promotion, social weekly

The two rhythms are deliberately separate:

| | Cadence | What it does | Human gate |
|---|---|---|---|
| **Tagging / release** | Per content-bearing promotion (daily check; fires only when there's a feat/fix) | Auto-merge a `develop → main` PR, then stamp `YYYY.MM.DD` tag + CHANGELOG + GitHub Release on main | On develop review (upstream); green-CI gate |
| **Digest / social** | Weekly (Monday) | Draft the week's feature highlights + LinkedIn/social post | **Yes — human approves before any post** |

Why decouple them? Versions should track *reality*: mint one whenever real change
lands, which may be several times a week or not at all. Social communication
should be *curated*: a single coherent weekly digest, not a stream of per-tag
posts. Folding them together would either spam followers on busy weeks or
withhold a version until the weekly beat — both wrong. Keeping them apart lets
each run at its natural rhythm.

## What actually runs

The moving parts:

- **`.release-it.json`** — the release configuration. It sets the
  tag/commit/release naming to plain date CalVer (`${version}` → `YYYY.MM.DD`,
  no `v` prefix), disables npm entirely (`"npm": false`), and keeps the
  `@release-it/conventional-changelog` plugin **only** to maintain `CHANGELOG.md`.
  That plugin runs with `ignoreRecommendedBump: true`, so it does **not** compute
  a SemVer bump — CalVer owns the version. The `after:release` hook is an `echo`
  stub for the release-herald seam — no real poster, and it re-states that social
  is the weekly job's job, never the release job's.
- **`scripts/release-it-calver.mjs`** — a tiny local release-it plugin that
  supplies the version as `YYYY.MM.DD` (UTC), checking existing tags to add a
  `.N` suffix for same-day releases. It exists because release-it is
  SemVer-centric and cannot natively emit a zero-padded calendar date:
  `semver.valid('2026.08.04')` is `null` (leading-zero month), the exact failure
  recorded in [release-it#754](https://github.com/release-it/release-it/issues/754).
  Supplying the version from a plugin sidesteps the SemVer increment path
  entirely; `"npm": false` means the non-SemVer version is never written into
  `package.json` (npm would reject it). The tag, the GitHub Release, and the
  changelog header all end up carrying a clean `YYYY.MM.DD`.
- **`.github/workflows/release.yml`** — the two jobs:
  - **`promote-and-release`** runs on a **daily `schedule:` cron** and on manual
    `workflow_dispatch` (with a `dry_run` input). It applies the **content gate**
    (≥1 unreleased feat/fix), checks develop's CI is **green**, opens (or reuses)
    an **auto-merged `develop → main` PR**, and — once that PR merges — runs
    release-it **on `main`** to stamp the CalVer tag, update the changelog, and
    publish the GitHub Release. The PR is opened with `PROMOTE_TOKEN` when that
    secret is present (so `on: pull_request` checks run), falling back to
    `GITHUB_TOKEN`. It **never** drafts or posts social content.
  - **`weekly-digest`** runs on a **weekly `schedule:` cron (Monday)** and on
    manual `workflow_dispatch`. It collects the week's user-facing changes and
    produces the release-herald digest **as a draft** — a workflow artifact **and**
    an auto-created issue — then **stops**. A human reviews, approves, and only
    then posts.
  - release-it and its plugins are installed on demand (`npm install --no-save`)
    so the root `package.json` stays dependency-free and the working tree stays
    clean.

## Why this helps teams building on the NoéMI Agent framework

Releases are not just an internal chore — they are a signal to everyone building
on top of this framework. Date-based versioning with content-gating and a curated
weekly digest pays off for consumers in concrete ways:

- **Currency you can read at a glance.** A dated version lets an adopter — or
  their client — subtract two dates and know exactly how fresh their governance
  posture is. "🟢 current as of `2026.08.04`" is a claim a SemVer number can never
  make, and `2026.05.30 → 2026.08.04 ≈ two months behind` needs no compatibility
  table.
- **No incentive to sit still.** SemVer quietly rewards pinning to an old
  "stable" version. A dated cycle makes staleness visible instead of comfortable,
  so teams stay on current guardrails rather than last season's.
- **Every tag means something shipped.** Because promotion is content-gated,
  a date on a tag always corresponds to a real user-facing change (a `feat` or
  `fix`), never an empty ceremony. Quiet weeks produce no noise, so the signal
  stays trustworthy.
- **A changelog that tells you *what* you're behind on.** The changelog is
  derived from Conventional Commits, so every release ships an honest, structured
  list of new guardrails, deprecations, and capabilities. A team can read it in
  seconds and decide whether this release matters to them.
- **A single, curated weekly update — not a firehose.** Communication is
  decoupled from tagging: however many versions land in a week, followers get one
  coherent, human-approved digest — benefit-language highlights, the governance
  provenance behind them (academia + analyst firms + MSP field input), and a
  social post — always reviewed by a human before it goes out. That turns raw
  release notes into something an adopting team, or a prospective one, actually
  reads.

In short: dated versions keep currency honest and legible, content-gating keeps
every tag meaningful, auto-promotion keeps already-reviewed work moving without
ceremony, and the weekly human-approved digest turns the framework's progress
into communication teams can trust.

## How it flows (walkthrough)

1. Contributors merge their work into `develop` as usual, through reviewed
   feature-branch PRs, using Conventional Commits.
2. **Daily** (or via a manual `workflow_dispatch`), the promotion job checks the
   content gate. If there is **no** unreleased `feat`/`fix`, it exits as a no-op —
   nothing happens, and that is fine.
3. If there **is** unreleased user-facing change and develop's CI is green, the
   job opens (or reuses) a `develop → main` pull request and enables auto-merge;
   once `main`'s required checks pass, the PR merges. release-it then runs on the
   merged `main`: it computes the CalVer date (`YYYY.MM.DD`, with `.N` if the date
   is already taken), updates `CHANGELOG.md`, creates the annotated tag, pushes,
   and publishes the GitHub Release.
4. **Weekly** (Monday, or via manual dispatch), the separate digest job collects
   the week's changes and drafts the release-herald digest (highlights + a social
   post) as an artifact and an issue — for a human to review, approve, and post.

## Previewing a promotion (dry run)

Run the **Release (CalVer date-versioned)** workflow from the **Actions** tab,
choose the `promote` job, and enable `dry_run` to see the content-gate decision
and the promotion plan **without** opening a PR, merging into `main`, tagging, or
publishing anything. Use it whenever you want to confirm what the next promotion
would do before it runs for real.
