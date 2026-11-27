# Git workflow — Mines CSCI 370 Field Session

**Audience:** the student team (Ally Wallace · Jake Galloway · Ryan Clark · Van Nguyen)
**Integration branch:** `feat/tools-blueprint-compiler`
**Last updated:** 11 September 2026

This is the day-to-day Git guide for the Field Session. It covers how to get onto the
project branch, how to keep your work current, and how to land it. For *what* to build see
[REQUIREMENTS.md](REQUIREMENTS.md); for the package contract and secret rules see
[AGENTS.md](AGENTS.md); for repo-wide setup see [CONTRIBUTING.md](../../CONTRIBUTING.md).

---

## 1. The branch map

| Branch | What it is | Do you push to it? |
|---|---|---|
| `main` | Release only. Tagged `YYYY.MM.DD`. | No. |
| `develop` | Fleet integration branch for the whole repository. | No — not directly. |
| `feat/tools-blueprint-compiler` | **Your project branch.** Everything the team builds collects here. | Only by merging a reviewed pull request. |
| `feat/compiler-<topic>` | Your own short-lived task branch. | Yes, this is where you work. |

The project branch reaches `develop` through a pull request at the end of the project, and
`develop` reaches `main` through a release PR. You never need to touch either of those. Your
world is the bottom two rows.

### Protection on the project branch

`feat/tools-blueprint-compiler` is covered by a repository ruleset with two rules:

- **Deletion blocked** — the branch cannot be deleted by anyone, including admins.
- **Non-fast-forward blocked** — the branch cannot be force-pushed or rewritten.

You cannot lose the team's work by mistyping a command. The trade-off is that the project
branch can only ever move *forward*, so it is updated by **merge, never rebase** (§5).

---

## 2. One-time setup

```bash
git clone git@github.com:project-noemi/agents.git
cd agents
git checkout feat/tools-blueprint-compiler
```

Confirm you are on Node.js 24 — it is the repository baseline, and older versions will fail
the tests in ways that look like your bug but are not:

```bash
node --version
```

Install and run the package test suite. It is offline and needs no keys:

```bash
cd tools/blueprint-compiler
npm install
npm test
```

Green tests on a fresh clone mean your environment is correct. If they are red before you
have changed anything, say so in the daily scrum rather than working around it.

---

## 3. Starting a piece of work

Always branch from an up-to-date project branch — never from `main`, `develop`, or from
whatever you happened to have checked out yesterday.

```bash
git checkout feat/tools-blueprint-compiler
git pull --ff-only
git checkout -b feat/compiler-skill-resolver
```

`--ff-only` is deliberate: if it refuses, your local copy has drifted and you want to know
before you branch, not after.

**Branch naming.** `<type>/compiler-<short-topic>`, matching the commit types below:
`feat/compiler-skill-resolver`, `fix/compiler-heading-parse`, `test/compiler-ir-fixtures`,
`docs/compiler-architecture`.

**One concern per branch.** A branch that renames variables *and* adds a provider is two
reviews wearing one coat, and it will sit unmerged for longer than both would have separately.

---

## 4. Keeping *your* branch up to date

Do this at the start of every working session, and again before you open a pull request.
While a branch is yours alone, rebase — it keeps history linear and your diff honest:

```bash
git fetch origin
git rebase origin/feat/tools-blueprint-compiler
```

If you had already pushed the branch, that rewrite has to be published:

```bash
git push --force-with-lease
```

`--force-with-lease` refuses to overwrite commits you have not seen — use it instead of
`--force`, always. On your own task branch this is safe and expected.

**If a teammate is also committing to your task branch, merge instead of rebasing**, so you
are not rewriting commits out from under them:

```bash
git fetch origin
git merge origin/feat/tools-blueprint-compiler
git push
```

Rule of thumb: rebase a branch only you touch; merge a branch someone else has pulled.

### When a rebase hits a conflict

```bash
# 1. Git stops and lists the conflicted files.
git status

# 2. Edit each file. Keep both intentions where you can — do not just
#    delete the other person's side to make the markers go away.

# 3. Stage the resolved files and continue.
git add <file>
git rebase --continue
```

`git rebase --abort` puts everything back exactly as it was. Use it freely; nothing is lost,
and an aborted rebase costs less than a bad resolution.

Re-run `npm test` after any conflict resolution. A conflict that resolves cleanly in the text
can still be wrong in the code.

---

## 5. Keeping the *project* branch up to date with `develop`

Periodically the project branch needs the rest of the repository's changes. Because
force-pushing is blocked, this is a **merge**:

```bash
git checkout feat/tools-blueprint-compiler
git pull --ff-only
git fetch origin
git merge origin/develop
# resolve any conflicts, then:
cd tools/blueprint-compiler && npm test && cd ../..
git push origin feat/tools-blueprint-compiler
```

**This is the team's job, not the client's.** The project branch has to keep tracking
`develop` for the whole semester — if it is left alone it silently falls behind the rest of
the repository, and the longer that runs the worse the eventual conflict gets. Do it at least
once a sprint, and always right after a sprint demo. Announce it in the daily scrum first so
nobody is mid-push, then everyone re-syncs their task branch with §4.

Never run `git rebase` on `feat/tools-blueprint-compiler`. The ruleset will reject the push,
and you will have rewritten your local history for nothing.

---

## 6. Committing

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

```bash
git add tools/blueprint-compiler/src/validate.js
git commit -m "feat(compiler): fail closed on missing Refusal Criteria"
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `test`.
Scopes used in this package: `compiler`, `parse`, `validate`, `ir`, `cli`.

Commits land under **your own name** — there is no IP assignment on this project, and your
contribution history is yours.

---

## 7. Opening a pull request

Target the **project branch**, not `develop`:

```bash
git push -u origin feat/compiler-skill-resolver
gh pr create \
  --base feat/tools-blueprint-compiler \
  --title "feat(compiler): resolve skill slugs to skills/" \
  --body "Closes #NNN"
```

If you use the web UI, change the base branch manually — GitHub defaults it to `develop`,
which is not what you want.

A pull request is ready for review when:

- [ ] `npm test` passes in `tools/blueprint-compiler/`
- [ ] The branch is rebased on the current project branch (§4)
- [ ] It addresses one concern
- [ ] It links the issue it closes
- [ ] It adds no secrets, no `.env` values, no `node_modules/`

CI must be green before a human merges. Merging is a human act — do not expect or ask for an
automated merge.

After it merges, clean up your local copy. Your task branch is disposable; the project branch
is not:

```bash
git checkout feat/tools-blueprint-compiler
git pull --ff-only
git branch -d feat/compiler-skill-resolver
```

---

## 8. Things not to do

| Don't | Why |
|---|---|
| `git push --force` to `feat/tools-blueprint-compiler` | Blocked by the ruleset. Use a pull request. |
| `git push origin --delete feat/tools-blueprint-compiler` | Blocked by the ruleset. The branch is permanent for the semester. |
| `git rebase` the project branch | Same rejection, plus a rewritten local history to clean up. |
| Commit an API key, token, or `.env` value | This repository is **public**, so a pushed key is exposed the moment it lands — assume it is compromised and rotate it. Nothing scans for you automatically today. Credentials are injected at runtime — see [AGENTS.md](AGENTS.md). |
| Commit `node_modules/` or coverage output | Bloats the repository and conflicts constantly. |
| Open a PR against `develop` | Your work collects on the project branch first. |
| Work directly on `feat/tools-blueprint-compiler` | Nobody can review it, and you will collide with teammates. |

---

## 9. Troubleshooting

| Symptom | What happened | Fix |
|---|---|---|
| `! [rejected] ... (non-fast-forward)` pushing your task branch | Someone else pushed to it | `git fetch origin && git rebase origin/<your-branch>`, then push |
| `! [remote rejected] ... cannot force-push` | You aimed a force-push at the protected project branch | You want a pull request, not a push |
| `git pull --ff-only` refuses | Your local branch has commits the remote does not | Rebase (§4), or check you are on the branch you think you are |
| `npm test` red on a clean clone | Environment, not your code | Check `node --version` is 24; raise it in scrum |
| Conflict markers left in a file | A resolution was committed half-finished | `grep -rn '<<<<<<<' tools/blueprint-compiler/` and fix |
| Committed to the wrong branch | Easy to undo, nothing is lost | `git branch <right-branch>`, then `git reset --hard origin/<wrong-branch>` |
| Lost a commit | It is almost certainly still there | `git reflog` — find the SHA, then `git cherry-pick <sha>` |

When something looks unrecoverable, stop and ask before running another command. Git keeps
almost everything for 90 days; the usual way work is actually lost is a second command typed
in a hurry to fix the first.

**One exception to "nothing is lost":** a secret pushed to the project branch cannot be
scrubbed by the usual force-push, because force-push is blocked there. Removing it needs a
repository admin to lift the ruleset first. Tell the client immediately rather than trying to
fix it yourself — and rotate the credential, since it is public from the moment it lands.

---

## 10. Where to ask

- **Build questions** (what should this do?) — client, in the weekly demo and planning session
- **Process questions** (how do we ship this?) — this file, then the team lead
- **Blocked more than an hour** — say so in the daily scrum; it is not a failure state
