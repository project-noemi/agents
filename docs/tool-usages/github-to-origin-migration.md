# Moving From GitHub To Origin

> Also available as a Google Doc; the GitHub markdown is the source of truth.

Origin is Cursor's git forge. It is in **early beta**, so features and UI change often. This guide only describes what Origin's public docs state as of October 2026. Each section is marked:

- **Supported**: documented by Origin.
- **Partial**: possible, with limits or extra work.
- **Missing**: no Origin equivalent is documented. Keep this on GitHub or use another tool.
- **Unverified**: not confirmed in the docs. Test it before you rely on it.

Sources: [Origin overview](https://cursor.com/docs/origin), [Clone, Push & Pull](https://cursor.com/docs/origin/git), [Mirror a GitHub repository](https://cursor.com/docs/origin/mirror-github), [Pull requests](https://cursor.com/docs/origin/pull-requests), [Settings](https://cursor.com/docs/origin/settings), [Apps](https://cursor.com/docs/origin/apps), [CloneKit in CI](https://cursor.com/docs/origin/clonekit-ci), [Agents and automations](https://cursor.com/docs/origin/agents), [CLI commands](https://cursor.com/docs/origin/cli/reference/commands), [Migration API](https://cursor.com/docs/api/origin/migrations), [Origin API (OpenAPI)](https://cursor.com/docs/api/origin/openapi.yaml).

## Requirements

- A paid Cursor plan (Pro, Teams, or Enterprise) with Origin turned on. A team admin claims the codebase name (the namespace). Teams on legacy privacy mode cannot turn Origin on.
- **No GitHub account is needed** for repositories created on Origin. GitHub is needed only to mirror a GitHub repository: you need the Cursor GitHub app installed and admin rights on that repository.

## Two Ways To Move

| Approach | What happens | Source of truth | When to use it |
|---|---|---|---|
| **Mirror (sync)** | Origin copies the GitHub repository and keeps it up to date. Pushes to the Origin URL go to GitHub first. | GitHub | Evaluation, or a gradual move |
| **Mirror, then detach** | You mirror first, then select **Settings → General → Detach from GitHub**. The Origin copy becomes a standalone repository, and the GitHub repository is not changed. | Origin | Full move with all git history |
| **Re-create and push** | You create an empty Origin repository and push your branches and tags to it. | Origin | Simple repositories, or when you can't use the GitHub app |

**Detaching is permanent** ([Migration API](https://cursor.com/docs/api/origin/migrations)). You cannot re-attach the same repository as a mirror. To roll back, keep the GitHub repository (see [Rollback Plan](#rollback-plan)).

Re-create and push:

```bash
origin auth login
origin repo create <namespace>/<repo>          # or "New" at cursor.com/codebase
git remote add origin-new https://origin.cursor.com/<namespace>/<repo>.git
git push origin-new --all
git push origin-new --tags
```

**Git LFS: Unverified.** Origin's docs mention LFS only to say it has no fallback while GitHub is down on mirrors. Test LFS objects before you move.

## Issues And Pull Requests

- **Issues: Missing.** Origin has no issue tracker and no issues API. Issues can't be moved to Origin. **Workaround:** keep the GitHub repository archived and read-only so the issue history stays available, or export issues to a separate tracker before you detach.
- **Pull requests on a mirror: Partial.** Origin shows GitHub's pull requests, but those pull requests stay on GitHub, and cloud agents on a mirror open new pull requests on GitHub.
- **Pull requests after detach: Unverified.** The docs don't say whether GitHub pull request history stays visible after you detach. Assume it doesn't move: merge or close open pull requests first, and keep the GitHub repository archived so you can still look up old review threads.
- **New pull requests on Origin: Supported.** Origin supports drafts, reviews (comment, approve, or request changes), line and range comments, threads you can resolve, requested reviewers (users or groups), labels, merge-conflict detection, merge commits and squash merges, rulesets, and **stacked pull requests**.

## Update Git Remotes

Origin uses HTTPS clone URLs: `https://origin.cursor.com/<namespace>/<repo>.git`. Sign in with `origin auth login`, or run `origin auth setup-git` to install the credential helper.

```bash
git remote set-url origin https://origin.cursor.com/<namespace>/<repo>.git
git remote -v
```

To push to both GitHub and Origin while you evaluate (from Origin's docs):

```bash
git remote set-url --add --push origin https://github.com/<org>/<repo>.git
git remote set-url --add --push origin https://origin.cursor.com/<namespace>/<repo>.git
```

**SSH: Partial or Unverified.** You can add SSH keys with `origin ssh-key add`, and namespaces can register SSH certificate authorities, but the docs don't publish an SSH clone URL. Treat HTTPS as the supported path.

**Tokens: Partial.** Use `origin auth login` for people. Automation uses an **Origin App** that signs an app JWT and exchanges it for an installation token. Those tokens last at most 15 minutes and can't be refreshed. A long-lived token like a GitHub personal access token is **not documented**.

## Re-point CI/CD

- **Native runners: Missing.** Origin has no equivalent of GitHub Actions. Origin stores and shows **check runs** that external systems report through its API.
- **Supported external CI:** Buildkite and Depot (Origin-hosted repositories only, not mirrors), and Vercel for deploys and previews. Install them from **Codebase settings → Apps**.
- **Other CI, including GitHub Actions:** create an Origin App, keep its private key in the CI's secret store, mint a short-lived token in the job, and clone with `git` or `origin repo clone-fast`. CloneKit, the fast-clone feature, is available on Enterprise only and is turned on per repository by Cursor. For examples, see [CloneKit in CI](https://cursor.com/docs/origin/clonekit-ci).
- **Mirrors keep CI on GitHub.** If you mirror without detaching, your CI doesn't change.

Before you detach, list every workflow in `.github/workflows/` and choose where each one will run: external CI, a Cursor Automation, or nothing.

## Webhooks And Integrations

- **Webhooks: Partial.** An Origin App receives webhooks for pull request events (opened, published, head pushed, merged, closed, reopened, comments, reviews, reviewers, labels, base changes), repository events (created, deleted, pushed, check runs), and installation events. Repository-level webhooks that aren't tied to an app are **not documented**. For each GitHub webhook, rebuild it as an Origin App subscription.
- **Bots and app identities: Supported.** Apps act with their own `app_…` identity. Some review actions, such as approving or dismissing a review, require a verified bot identity.
- **Slack: Supported.** Origin can send pull request notifications and reminders as DMs, and post subscriptions to channels.
- **Automations and cloud agents: Supported.** Triggers include push to a branch and pull request events.
- **Third-party GitHub Apps** (for example code scanners or project boards): **Missing** unless the vendor has an Origin App.

## Collaborators, Teams, And Access

- **Team repositories: Supported.** Visibility is **Internal** (everyone on the Cursor team with codebase access) or **Private** (only people with direct or codebase-level grants). Access is managed per repository under **Settings → Access**, and team-wide permissions such as who can create repositories are managed under **Codebase settings → Permissions**.
- **Personal repositories:** always private. Use **Collaborators** to invite people.
- **Groups: Supported.** Groups (`grp_…`) can be requested as reviewers, and a grants API manages access.
- **Membership comes from Cursor**, not GitHub. Everyone needs a Cursor seat on the team. GitHub teams aren't imported, so rebuild them as Origin groups and grants.
- **Branch protection: Partial.** Rules and protections (rulesets) exist, but the controls are still growing during the beta. Check that each protection you depend on is available.
- **Forks: Missing.** Origin has no fork model. Contributors work on branches in the same repository.
- **Dependabot-style updates and security alerts: Missing.** Use an external dependency or security scanner that works with any git remote, or a scheduled Cursor Automation.

## Pre-Migration Checklist

- [ ] Every person who needs access has a Cursor seat with Origin on the team.
- [ ] Inventory everything on GitHub: workflows, webhooks, installed apps, branch protections, deploy keys, secrets, open issues, and open pull requests.
- [ ] Issues: decide whether to archive them on GitHub or export them.
- [ ] Merge or close open pull requests.
- [ ] Choose and test where CI will run, and confirm that check runs appear on an Origin pull request.
- [ ] Rebuild webhooks as Origin App subscriptions.
- [ ] Recreate access as groups and grants, and protections as rulesets.
- [ ] Test LFS, submodules, and any SSH-only tooling.
- [ ] Choose a cutover time and announce a short freeze on pushes to GitHub.
- [ ] Mirror the repository first and confirm Origin's branch and tag tips match GitHub's.

## Cutover

1. Freeze pushes to GitHub.
2. Confirm the mirror is in sync. If you use automation, call the sync endpoint and wait for the latest commit.
3. Detach from GitHub, or run the re-create-and-push steps above.
4. Update remotes everywhere: developers, CI, deploy tooling, and agents.
5. Make the GitHub repository read-only (archive it). Don't delete it.

## Rollback Plan

- **Before detach:** stop the mirror. GitHub has stayed the source of truth the whole time, so you don't lose anything.
- **After detach:** unarchive the GitHub repository, then push the work done on Origin back to it:

  ```bash
  git clone --bare https://origin.cursor.com/<namespace>/<repo>.git repo.git
  cd repo.git
  git push https://github.com/<org>/<repo>.git --all
  git push https://github.com/<org>/<repo>.git --tags
  ```

  Then point remotes and CI back to GitHub. Pull request discussions that took place on Origin don't move back. Export them, or link to them, before you roll back.
- Keep the GitHub repository archived and the old CI configuration in place until Origin has been stable for an agreed period.
