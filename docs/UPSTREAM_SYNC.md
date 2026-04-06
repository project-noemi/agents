# Upstream Sync Guide

## Overview

PerformiaHungary/agents is derived from [project-noemi/agents](https://github.com/project-noemi/agents), the open-source Project NoéMI agent library. This guide describes the process for keeping the Performia fork in sync with upstream improvements while preserving Performia-specific intellectual property.

**Source of truth:**

| Remote     | Repository                                     | Purpose                        |
|------------|-------------------------------------------------|--------------------------------|
| `origin`   | `github.com/PerformiaHungary/agents`           | Performia's private fork       |
| `upstream` | `github.com/project-noemi/agents`              | NoéMI open-source original     |

**Working branch:** `develop`

---

## Conflict Policy

- **Always resolve conflicts in favour of Performia's own changes** where they diverge from upstream.
- Never force-push upstream changes over local work.
- Both `upstream/develop` and `upstream/main` should be merged (they may contain different commits).

---

## Weekly Sync Process

This should be performed **every Monday** by the repository admin. Budget 5–10 minutes.

### Option 1: Automated Script (Recommended)

A sync script is included in the repository at `scripts/sync-upstream.sh`.

```bash
cd /path/to/performia/agents

# Step 1: Check what's new (dry run, no changes made)
./scripts/sync-upstream.sh --dry-run

# Step 2: If the drift looks good, merge and push
./scripts/sync-upstream.sh
```

The script will:
1. Ensure you are on the `develop` branch with a clean working tree
2. Add the `upstream` remote if it doesn't exist
3. Fetch the latest from upstream
4. Show all new commits on both `upstream/develop` and `upstream/main`
5. Merge both branches (if `--dry-run` is not set)
6. Abort on conflict so you can resolve manually
7. Push to `origin/develop`

### Option 2: Manual Git Commands

```bash
cd /path/to/performia/agents
git checkout develop

# 1. Fetch upstream
git fetch upstream

# 2. Review new commits
git log develop..upstream/develop --oneline
git log develop..upstream/main --oneline

# 3. Merge (develop first, then main)
git merge upstream/develop --no-edit
git merge upstream/main --no-edit

# 4. If conflicts occur:
#    - Open conflicting files
#    - Keep Performia's version where they diverge
#    - git add <resolved-files>
#    - git commit

# 5. Push
git push origin develop
```

### Option 3: Using Claude Code (CLI)

If the admin has Claude Code installed, simply open a terminal in the repository and say:

```
sync upstream
```

Claude will recognise the workflow from project memory and execute the full sync process interactively.

### Option 4: Using Google Antigravity

[Google Antigravity](https://antigravity.google/) is Google's agentic IDE with built-in AI agents and terminal access. If the admin uses Antigravity as their primary development environment, the sync can be performed entirely within it.

#### Setup (First Time Only)

1. Open the cloned `PerformiaHungary/agents` repository as a workspace in Antigravity.
2. Create a **Workflow** (saved prompt) for reuse. In Antigravity, workflows are saved prompts you trigger with `/`. Create one called `sync-upstream`:

   **Workflow name:** `sync-upstream`
   **Prompt:**
   ```
   Sync this repository with the upstream open-source source (project-noemi/agents).

   Steps:
   1. Run: git remote add upstream https://github.com/project-noemi/agents.git 2>/dev/null || true
   2. Run: git fetch upstream
   3. Show drift: git log develop..upstream/develop --oneline && git log develop..upstream/main --oneline
   4. If there are new commits, ask me whether to merge.
   5. If I confirm, run: git merge upstream/develop --no-edit && git merge upstream/main --no-edit
   6. If conflicts occur, stop and list the conflicting files. Our policy: keep Performia's version.
   7. If merge succeeded, run: git push origin develop

   Always show me what changed before merging. Never force-push.
   ```

3. Optionally, add a **Rule** to Antigravity that applies to this workspace:

   **Rule:**
   ```
   This repository (PerformiaHungary/agents) tracks project-noemi/agents as its
   upstream source. When resolving merge conflicts between upstream and local changes,
   always preserve Performia's version. The upstream remote URL is:
   https://github.com/project-noemi/agents.git
   ```

#### Weekly Sync with Antigravity

Once the workflow is saved, run the sync any Monday by typing:

```
/sync-upstream
```

The Antigravity agent will execute the steps, show you the drift, ask for confirmation, and handle the merge — all within the IDE.

#### Alternative: Direct Terminal Prompt

If you prefer not to create a workflow, open the Antigravity agent panel and paste:

```
Run ./scripts/sync-upstream.sh --dry-run to check for upstream drift, then show me the results.
If there are changes available, ask me whether to proceed with the full sync via ./scripts/sync-upstream.sh
```

The agent has full terminal access and will execute the script directly.

---

## Using Gemini CLI for Upstream Sync

For admins on Google Workspace using the [Gemini CLI](https://github.com/google-gemini/gemini-cli), the sync can also be performed through Gemini. The underlying git commands are identical.

### Setup (First Time Only)

1. Install Gemini CLI:
   ```bash
   npm install -g @anthropic-ai/gemini-cli  # or follow https://github.com/google-gemini/gemini-cli
   ```

2. Navigate to the repository:
   ```bash
   cd /path/to/performia/agents
   ```

3. Ensure Gemini can read the project context by checking that `GEMINI.md` exists in the repository root (it should — it's generated by `scripts/generate_gemini.js`).

### Weekly Sync with Gemini

Open Gemini CLI in the repository directory and use this prompt:

```
I need to sync this repository with its upstream source. This repo
(PerformiaHungary/agents) tracks project-noemi/agents as upstream.

Please perform the following steps:
1. Ensure the upstream remote is set: git remote add upstream https://github.com/project-noemi/agents.git (ignore error if it already exists)
2. Fetch upstream: git fetch upstream
3. Show me new commits: git log develop..upstream/develop --oneline && git log develop..upstream/main --oneline
4. If there are new commits, merge them: git merge upstream/develop --no-edit && git merge upstream/main --no-edit
5. If there are conflicts, stop and show me which files conflict. Our policy is to keep Performia's version.
6. Push the result: git push origin develop
```

Alternatively, use the sync script directly:

```
Run ./scripts/sync-upstream.sh --dry-run first to check for drift,
then run ./scripts/sync-upstream.sh to merge and push.
```

### Automating with Google Apps Script (Optional)

For fully automated weekly checks within Google Workspace, you can create a Google Apps Script trigger that sends a Monday morning reminder to the admin:

```javascript
// Google Apps Script — Weekly upstream sync reminder
// Deploy: Extensions > Apps Script in any Google Sheet or standalone

function sendSyncReminder() {
  var admin = 'admin@performiahungary.com'; // change to admin's email
  var subject = '[Agents Repo] Weekly upstream sync due';
  var body = [
    'It\'s time for the weekly upstream sync of PerformiaHungary/agents.',
    '',
    'Steps:',
    '1. Open a terminal in the agents repository',
    '2. Run: ./scripts/sync-upstream.sh --dry-run',
    '3. Review the drift report',
    '4. If it looks good, run: ./scripts/sync-upstream.sh',
    '',
    'Upstream: https://github.com/project-noemi/agents',
    'Our repo: https://github.com/PerformiaHungary/agents',
    '',
    'If using Gemini CLI, just paste the sync prompt from docs/UPSTREAM_SYNC.md.'
  ].join('\n');

  MailApp.sendEmail(admin, subject, body);
}

// Set up a weekly trigger (run this function once to install):
function installWeeklyTrigger() {
  ScriptApp.newTrigger('sendSyncReminder')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
}
```

### Automating with GitHub Actions (Optional)

For a fully automated drift check that runs in CI:

```yaml
# .github/workflows/upstream-sync-check.yml
name: Weekly Upstream Sync Check

on:
  schedule:
    - cron: '0 7 * * 1'  # Every Monday at 7:00 UTC (9:00 AM Budapest)
  workflow_dispatch:       # Allow manual trigger

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: develop
          fetch-depth: 0

      - name: Add upstream remote
        run: git remote add upstream https://github.com/project-noemi/agents.git

      - name: Fetch upstream
        run: git fetch upstream

      - name: Check drift
        id: drift
        run: |
          DEVELOP_DRIFT=$(git log --oneline develop..upstream/develop 2>/dev/null || true)
          MAIN_DRIFT=$(git log --oneline develop..upstream/main 2>/dev/null || true)

          if [ -z "$DEVELOP_DRIFT" ] && [ -z "$MAIN_DRIFT" ]; then
            echo "status=up-to-date" >> $GITHUB_OUTPUT
            echo "✅ No upstream drift detected."
          else
            echo "status=drift-detected" >> $GITHUB_OUTPUT
            echo "⚠️ Upstream drift detected!"
            echo ""
            echo "New in upstream/develop:"
            echo "$DEVELOP_DRIFT"
            echo ""
            echo "New in upstream/main:"
            echo "$MAIN_DRIFT"
            echo ""
            echo "Files changed:"
            git diff --stat develop..upstream/develop 2>/dev/null || true
          fi

      - name: Create issue if drift detected
        if: steps.drift.outputs.status == 'drift-detected'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[Upstream Sync] New changes available from project-noemi/agents`,
              body: `The weekly drift check found new commits in the upstream repository.\n\nPlease run \`./scripts/sync-upstream.sh\` to merge them.\n\nSee [docs/UPSTREAM_SYNC.md](docs/UPSTREAM_SYNC.md) for the full process.`,
              labels: ['upstream-sync']
            });
```

---

## First-Time Setup

If cloning the repository fresh, the `upstream` remote won't exist yet. Set it up:

```bash
git clone git@github.com:PerformiaHungary/agents.git
cd agents
git remote add upstream https://github.com/project-noemi/agents.git
git fetch upstream
```

The sync script (`scripts/sync-upstream.sh`) will also add the remote automatically if it's missing.

---

## Troubleshooting

### "Repository not found" when fetching upstream
The upstream URL is `https://github.com/project-noemi/agents.git` (public, no auth needed). Make sure you're not behind a corporate proxy that blocks GitHub.

### Merge conflicts
Conflicts mean Performia has modified a file that upstream also changed. Policy: **keep Performia's version**. Open the conflicting file, look for `<<<<<<<` markers, keep the code under `HEAD`, remove the upstream version, then:
```bash
git add <file>
git commit
```

### "Not on develop branch"
The script requires you to be on `develop`. Switch first:
```bash
git checkout develop
```

---

## Sync History

| Date       | Upstream Commits | Notes                          |
|------------|------------------|--------------------------------|
| 2026-03-31 | `f8c34ab` (develop), `90fc85f` (main) | Initial full sync, no conflicts |
