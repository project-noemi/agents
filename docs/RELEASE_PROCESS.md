# Release Process

This document explains how releases work in this repository, why the process is
set up the way it is, and what it gives the teams building on the NoéMI Agent
framework. You should be able to read this without prior context and understand
both *what* happens on each release and *why it matters*.

## The short version

There is no "cut a release" ceremony and no version number to argue about. The
framework runs on a **continuous, date-versioned governance cycle**:

- Work merges into `develop` the normal way (feature branch → `develop`).
- On a regular cadence, `develop` is **promoted into `main`** automatically.
- Each promotion is **stamped with a CalVer version** — `YYYY.0M`, e.g.
  `2026.08` — and gets a CHANGELOG entry and a GitHub Release.

The version *is* the calendar month of the governance cycle. Nobody hand-writes
a changelog and nobody decides a version number. The date and the commit history
are the source of truth.

## Why CalVer instead of SemVer

The earlier version of this process used SemVer (`0.2.0`, `1.0.0`) with a manual
release. We deliberately moved away from that, because for a **governance and
reference framework** SemVer sends the wrong signal:

- **SemVer invites pinning and sitting still.** "We're on 1.4.0 and it works" is
  a perfectly rational thing to say about a library — and exactly the wrong thing
  to say about a *governance baseline*. A team pinned to an old minor is a team
  running on last season's guardrails, deprecated patterns, and stale threat
  assumptions, while believing they are "stable."
- **A date is an honest currency signal.** `2026.08` tells you, at a glance, how
  current your governance posture is. `1.4.0` tells you nothing about *when* that
  posture was last refreshed.
- **The framework is time-sensitive by nature.** Guardrails, provenance sources,
  and recommended patterns change with the outside world (new regulation, new
  attack classes, new analyst guidance). A calendar version matches the thing
  being versioned.

So the scheme is **CalVer `YYYY.0M`** (four-digit year, dot, zero-padded month).
One cycle per month is the default granularity; the promotion cadence (below) can
run more often, but the version reflects the governance cycle.

## The currency / freshness model

The point of dated cycles is to make **currency** — how fresh your governance
posture is — a first-class, partner-facing signal.

### A simple traffic-light signal

Anyone building on the framework can see, and publish, a currency status:

| Signal | Meaning |
|--------|---------|
| 🟢 **Green** | On the current cycle (this month's `YYYY.0M`). |
| 🟡 **Amber** | 1–2 cycles behind. Time to look at the upgrade path. |
| 🔴 **Red** | 3+ cycles behind. Running on materially stale governance. |

This is intended to be shown to partners and clients: "our agent governance is
🟢 current as of `2026.08`" is a claim a buyer can trust, and a claim a vendor
can be held to.

### "Behind" is measured in cycles *and* substance — not lines of code

A dated version alone could become theatre (a tag a month with nothing behind
it). So currency is judged on **cycles plus substance**. Being "behind" means you
have missed cycles that actually carried:

- **New guardrails** — added safety gates, refusal criteria, boundary rules.
- **Deprecated patterns** — approaches the framework has since moved away from.
- **New capabilities** — new agents, skills, MCP protocols, or lenses.
- **Governance provenance** — where the cycle's guidance came from: academic
  research, analyst-firm guidance (e.g., Gartner AI TRiSM), and MSP field input.
  A cycle's authority is part of its substance.

Currency is explicitly **NOT** measured in lines of code, number of commits, or
raw diff size. A small cycle that adds one important guardrail can matter more
than a large cycle that only shuffles files. The changelog and the release notes
exist to make that substance legible, so a team can tell *what* they are behind
on, not just *how many* cycles.

### Near-zero-friction upgrading is the real incentive

A currency signal only changes behavior if acting on it is easy. The freshness
model is therefore paired with a **near-zero-friction upgrade path**: each cycle
ships with a diff/upgrade path — what changed, what was deprecated, and what (if
anything) an adopter must do to move onto the current cycle. The incentive to
stay 🟢 is not fear; it is that upgrading is cheap and the diff tells you exactly
what you gain. Low friction is what turns "you're behind" into "so let's not be."

## What actually runs

The moving parts:

- **`.release-it.json`** — the configuration. It sets the tag/commit/release
  naming to plain CalVer (`${version}` → `YYYY.0M`, no `v` prefix), disables npm
  entirely (`"npm": false`), and keeps the `@release-it/conventional-changelog`
  plugin **only** to maintain `CHANGELOG.md`. That plugin runs with
  `ignoreRecommendedBump: true`, so it does **not** compute a SemVer bump — CalVer
  owns the version. An `after:release` hook stubs (echo only) the release-herald
  seam — no real poster.
- **`scripts/release-it-calver.mjs`** — a tiny local release-it plugin that
  supplies the version as `YYYY.0M`. This exists because release-it is
  SemVer-centric and cannot natively emit a zero-padded calendar month:
  `semver.valid('2026.08')` is `null` (leading-zero month, two segments), which
  is the exact failure recorded in [release-it#754](https://github.com/release-it/release-it/issues/754).
  Supplying the version from a plugin sidesteps the SemVer increment path
  entirely; disabling the npm plugin (`"npm": false`) means the non-SemVer
  version is never written into `package.json` (npm would reject it). The tag,
  the GitHub Release, and the changelog header all end up carrying a clean
  `YYYY.0M`.
- **`.github/workflows/release.yml`** — the trigger and the promotion. It runs on
  a **daily `schedule:` cron** and also supports **manual `workflow_dispatch`**
  with a `dry_run` input. Each run **promotes `develop` into `main`** (fast-forward
  when possible, otherwise a merge commit) and then runs release-it **on `main`**
  to stamp the CalVer tag, update the changelog, and publish the GitHub Release.
  release-it and its plugins are installed on demand (`npm install --no-save`) so
  the root `package.json` stays dependency-free and the working tree stays clean.

## The promotion cadence (and the open reviewable decision)

This repository uses a two-branch flow: feature branches merge into `develop`,
and only `develop` is promoted into `main` (enforced by
`require-develop-source.yml`; see
[CONTRIBUTING.md](../CONTRIBUTING.md#branching-model)). Promotion **from
`develop`** is exactly the move that policy exists to allow.

The release workflow performs that promotion **automatically** on its cadence.
Because auto-merging into `main` is a significant action, two aspects are
deliberately left open for review:

> **Reviewable decision.** (1) **Cadence** — is once daily right, or should the
> governance cycle promote more/less often? (2) **Auto-merge vs. promotion PR** —
> should the workflow **push** `develop` into `main` directly (as it does now), or
> should it instead **open a `develop → main` promotion PR** for a human to merge?
> If branch protection on `main` requires pull requests, the direct push will
> (correctly) fail and the promotion-PR variant is the right choice. Decide this
> before treating the cadence as routine; do not weaken branch protection to make
> the push succeed.

The workflow is written so this decision is easy to flip: the promotion is a
clearly marked, self-contained step.

## Why this helps teams building on the NoéMI Agent framework

Releases are not just an internal chore — they are a signal to everyone building
on top of this framework. A continuous, dated governance cycle pays off for
consumers in concrete ways:

- **Currency you can see and trust.** A dated version and a green/amber/red
  signal let an adopter — or their client — know at a glance how fresh their
  governance posture is. "🟢 current as of `2026.08`" is a claim a buyer can rely
  on, which a SemVer number can never make.
- **No incentive to sit still.** SemVer quietly rewards pinning to an old
  "stable" version. A dated cycle makes staleness visible instead of comfortable,
  so teams stay on current guardrails rather than last season's.
- **A changelog that tells you *what* you're behind on.** Because the changelog
  is derived from Conventional Commits, every cycle ships an honest, structured
  list of new guardrails, deprecations, and capabilities. A team can read it in
  seconds and decide whether this cycle matters to them.
- **Substance over volume.** Currency is judged on real change — guardrails,
  deprecated patterns, new capabilities, and the governance provenance behind
  them (academia + analyst firms + MSP field input) — not on lines of code. Small
  cycles that add one important guardrail are treated as important.
- **Upgrading is cheap.** Each cycle ships a diff/upgrade path, so moving onto the
  current cycle is near-zero-friction. Low friction is the real incentive to stay
  current.
- **Each cycle becomes user-facing communication.** The `after:release` hook in
  `.release-it.json` is the seam where the
  [release-herald skill](../skills/reporting/release-herald.md) takes over: it
  consumes the cycle's changelog delta, filters out internal plumbing, and drafts
  a **currency digest** — benefit-language highlights, the governance provenance,
  and a LinkedIn/social post — always as a **draft for human approval**, never
  auto-posted. That turns raw release notes into something an adopting team, or a
  prospective one, actually reads.

In short: dated cycles keep the mechanics honest and effortless, the currency
signal keeps adopters on fresh governance, and the communication layer turns each
cycle into a reason for teams to keep building on the framework with confidence.

## How a cycle flows (walkthrough)

1. Contributors merge their work into `develop` as usual (Conventional Commits).
2. On cadence (daily by default, or a manual `workflow_dispatch` run), the release
   workflow promotes `develop` into `main`.
3. On `main`, release-it computes the CalVer version for the current governance
   cycle (`YYYY.0M`), updates `CHANGELOG.md`, creates the annotated `YYYY.0M`
   tag, pushes, and publishes the GitHub Release.
4. The release-herald seam drafts the cycle's currency digest (highlights +
   governance provenance + a social post) for a human to review and publish
   through the normal approved channel.

## Previewing a cycle (dry run)

Run the **Release (CalVer promotion)** workflow from the **Actions** tab with
`dry_run` enabled to see the promotion plan, the computed CalVer version, and the
changelog delta **without** pushing to `main`, tagging, or publishing anything.
Use it whenever you want to confirm what the next cycle would do before it runs
for real.
