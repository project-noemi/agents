# Release Process

This document explains how releases work in this repository, why the process is
set up the way it is, and what it gives the teams building on the NoéMI Agent
framework. You should be able to read this without prior context and understand
both *what* happens when we cut a release and *why it matters*.

## The short version

You write [Conventional Commits](https://www.conventionalcommits.org/) as you
normally would. When it is time to release, a maintainer runs one workflow. From
there everything is automatic:

- the next version number is **derived** from the commits since the last release,
- the **CHANGELOG** is written for you,
- an annotated **git tag** (`v<version>`) is created,
- a **GitHub Release** is published with notes taken from the changelog.

Nobody hand-edits a version number, and nobody hand-writes a changelog. The
commit history *is* the source of truth.

## How the version number is decided

Because commits follow Conventional Commits, the release tool can read intent
directly from the history:

| Commit type in the range | Effect on the version |
|--------------------------|-----------------------|
| `fix:` (and user-visible patches) | patch bump — `0.2.0` → `0.2.1` |
| `feat:` | minor bump — `0.2.0` → `0.3.0` |
| any commit with a `BREAKING CHANGE:` footer or `!` | major bump — `0.2.0` → `1.0.0` |
| `chore:`, `ci:`, `test:`, `docs:`, `refactor:` only | no release-worthy change |

This is why the commit convention is enforced across the repo: it is not
bureaucracy, it is the input that makes automated versioning and changelogs
possible.

## What actually runs

The moving parts:

- **`.release-it.json`** — the configuration. It tells the tool to commit the
  version bump with a Conventional message (`chore(release): v${version}`),
  create the annotated `v${version}` tag, push, and publish a GitHub Release.
  `npm.publish` is `false` because this is a private repository — we tag and
  release, we do not publish a package. The `@release-it/conventional-changelog`
  plugin (with the `conventionalcommits` preset) is what reads the commits,
  computes the bump, and maintains `CHANGELOG.md`.
- **`.github/workflows/release.yml`** — the trigger. It is a **manual**
  (`workflow_dispatch`) workflow. It checks out the full history and tags, sets
  up Node 24, and runs release-it via `npx` so that nothing needs to be added to
  the intentionally dependency-free root `package.json`. It supports a
  `dry_run` input so you can preview a release without changing anything.

A release is therefore a deliberate act: someone opens the Actions tab, picks
the release workflow, and runs it. It never fires on a push or a schedule.

## Fit with the `develop → main` model

This repository uses a two-branch flow: feature branches merge into `develop`,
and only `develop` is promoted into `main` (enforced by
`require-develop-source.yml`; see
[CONTRIBUTING.md](../CONTRIBUTING.md#branching-model)).

The release workflow is deliberately **conservative** so it does not fight that
policy: it operates on the branch it is dispatched *from* and pushes the bump
commit and tag back to that same branch. It does **not** push into `main`. The
`develop → main` promotion stays a separate, maintainer-owned step.

> **Open decision.** Exactly which branch a release should be cut from under
> this model — tag on `develop`, tag on `main` after promotion, or use a
> short-lived `release/*` branch — is still open. The workflow is intentionally
> written to avoid guessing; resolve this before treating releases as routine.

## First run: reconciling the version

The root `package.json` version is currently `0.0.0`, while the repository
already has a `v0.1.0` git tag. **Do not hand-edit `package.json` to fix this.**
The first release-it run reconciles it automatically: release-it treats the
existing `v0.1.0` tag as the last released version, computes the next version
from the commits made since it, and writes that number into `package.json` as
part of the release commit. The `0.0.0` placeholder is expected to disappear on
the first real release, not before.

## Why this helps teams building on the NoéMI Agent framework

Releases are not just an internal chore — they are a signal to everyone building
on top of this framework. A disciplined release process pays off for consumers
in concrete ways:

- **Predictable, frequent cadence is a trust signal.** A project that releases
  regularly, in small increments, tells adopters it is alive and maintained.
  Automation removes the friction that makes teams batch up scary "big bang"
  releases, so cadence stays steady and consumers can plan around it.
- **A readable changelog tells consumers what changed — and whether to adopt.**
  Because the changelog is derived from Conventional Commits, every release
  ships with an honest, structured list of features and fixes. A team can read
  it in seconds and decide whether a given release is relevant to them, rather
  than diffing tags by hand or asking in a channel.
- **Semantic versions make upgrade risk legible.** A patch bump says "safe to
  take"; a minor bump says "new capabilities, still compatible"; a major bump
  says "read before you upgrade." That shared vocabulary lets downstream teams
  automate their own dependency decisions.
- **Feature discovery.** Highlights surfaced from each release help adopters
  notice capabilities they would otherwise miss buried in the diff — which means
  the work actually gets used.
- **Each release becomes user-facing communication.** The `after:release` hook
  in `.release-it.json` is the seam where the
  [release-herald skill](../skills/reporting/release-herald.md) takes over: it
  consumes the changelog (or, for continuously-deployed apps, a weekly commit
  range), filters out the internal plumbing, and drafts benefit-language
  highlights plus a LinkedIn/social post — always as a **draft for human
  approval**, never auto-posted. That turns raw release notes into something an
  adopting team, or a prospective one, actually reads.

In short: the automation keeps the mechanics honest and effortless, and the
communication layer turns each release into a reason for teams to keep building
on the framework with confidence.

## Doing a release (checklist)

1. Make sure the changes you want to release are merged and the branch is green.
2. Open the **Actions** tab and run the **Release (manual)** workflow from the
   intended branch. Run it once with `dry_run` enabled to preview the version
   bump and changelog.
3. Re-run with `dry_run` off to cut the release: the bump commit, the tag, and
   the GitHub Release are created automatically.
4. Review the draft highlights and social post produced via the release-herald
   seam, then publish them through the normal human-approved channel.
