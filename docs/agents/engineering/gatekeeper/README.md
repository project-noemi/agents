# Gatekeeper — Deployment & Operations Guide

## What is Gatekeeper?

Gatekeeper is an automated PR triage agent that runs on a schedule (default: every 4 hours), scans all open pull requests across your GitHub organization, and takes one of three actions:

| Classification | Action | Criteria |
|---------------|--------|----------|
| **Safe** | Auto-approve and squash-merge | All CI green, small diff, low-risk files only, org member author |
| **Needs Review** | Label and notify reviewers | Any safety criteria fails but no stale conflict |
| **Stale Conflict** | Close PR and delete branch | Conflicted > 48h with no author activity |

Every action is logged with a comment on the PR and reported to Slack and the Fleet Dashboard.

---

## Prerequisites

| Requirement | Purpose |
|-------------|---------|
| GitHub CLI (`gh`) ≥ 2.40 | API interaction and PR management |
| A GitHub PAT or App token | Scoped to `repo`, `read:org`, `write:discussion` |
| 1Password CLI or Infisical CLI | Secrets injection at runtime |
| Node.js 24.x LTS or newer (optional) | For n8n orchestration |
| Docker + Compose (optional) | For containerized deployment |

## Secrets Setup

All secrets are injected at runtime. **Never hardcode tokens.**

```bash
# 1Password: store your GitHub PAT
op item create --category=login --title="Gatekeeper GitHub Token" \
  --field="credential=ghp_xxxxxxxxxxxx"

# .env.template entry
GH_TOKEN=op://Vault/Gatekeeper GitHub Token/credential
SLACK_WEBHOOK_URL=op://Vault/Slack Webhook/url
GATEKEEPER_ORG=your-github-org
DASHBOARD_API_URL=http://dashboard.noemi.local/api/v1/reports
```

---

## Deployment Options

### Option A: Cron + Gemini CLI (Simplest)

Best for single-machine setups or testing.

**1. Install dependencies:**

```bash
# Ensure gh is authenticated
op run --env-file=.env.template -- gh auth status

# Verify the agent spec is accessible
cat agents/engineering/gatekeeper.md
```

**2. Create the runner script:**

```bash
#!/usr/bin/env bash
# scripts/run-gatekeeper.sh
set -euo pipefail

LOG_DIR="${HOME}/.gatekeeper/logs"
mkdir -p "$LOG_DIR"
LOGFILE="${LOG_DIR}/$(date +%Y%m%d-%H%M%S).log"

echo "[$(date -u +%FT%TZ)] Gatekeeper cycle starting" | tee "$LOGFILE"

op run --env-file=.env.template -- \
  gemini -p agents/engineering/gatekeeper.md \
  --tool gh \
  2>&1 | tee -a "$LOGFILE"

echo "[$(date -u +%FT%TZ)] Gatekeeper cycle complete" | tee -a "$LOGFILE"
```

**3. Install the cron job:**

```bash
chmod +x scripts/run-gatekeeper.sh

# Run every 4 hours at minute 0
crontab -e
# Add this line:
0 */4 * * * /path/to/noemi/agents/scripts/run-gatekeeper.sh >> /var/log/gatekeeper-cron.log 2>&1
```

**4. Verify:**

```bash
# List active cron jobs
crontab -l

# Test a manual run
./scripts/run-gatekeeper.sh
```

---

### Option B: GitHub Actions (Recommended for Teams)

Best for teams already on GitHub — no infrastructure to manage.

Create `.github/workflows/gatekeeper.yml` in your **org-level `.github` repository** (or any central repo):

```yaml
name: Gatekeeper PR Triage

on:
  schedule:
    # Every 4 hours
    - cron: '0 */4 * * *'
  workflow_dispatch: # Allow manual triggers

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout agent specs
        uses: actions/checkout@v4

      - name: Setup GitHub CLI
        run: gh auth status
        env:
          GH_TOKEN: ${{ secrets.GATEKEEPER_GH_TOKEN }}

      - name: Discover open PRs across org
        id: discover
        run: |
          gh api --paginate /orgs/${{ vars.GATEKEEPER_ORG }}/repos \
            --jq '.[].full_name' > /tmp/repos.txt
          echo "repo_count=$(wc -l < /tmp/repos.txt)" >> "$GITHUB_OUTPUT"
        env:
          GH_TOKEN: ${{ secrets.GATEKEEPER_GH_TOKEN }}

      - name: Run Gatekeeper triage
        run: |
          # For each repo, evaluate open PRs
          while IFS= read -r repo; do
            echo "::group::Scanning $repo"
            gh pr list --repo "$repo" --state open --json number,title,mergeable,statusCheckRollup,files,additions,deletions,author,labels,updatedAt \
              | node scripts/gatekeeper-classify.js "$repo"
            echo "::endgroup::"
          done < /tmp/repos.txt
        env:
          GH_TOKEN: ${{ secrets.GATEKEEPER_GH_TOKEN }}

      - name: Post report to Slack
        if: always()
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" \
            -H 'Content-Type: application/json' \
            -d @/tmp/gatekeeper-report.json
```

**Setup steps:**

1. Create a GitHub PAT (or GitHub App installation token) with `repo` and `read:org` scopes.
2. Add it as a repository secret: `GATEKEEPER_GH_TOKEN`.
3. Add `SLACK_WEBHOOK_URL` as a repository secret.
4. Add `GATEKEEPER_ORG` as a repository variable.

---

### Option C: n8n Workflow (Best for Complex Orchestration)

Best when you need visual workflow editing, conditional logic, and integration with other NoéMI agents.

**Workflow structure:**

```
┌─────────────────┐
│ Schedule Trigger │  (every 4 hours)
│ (Cron: 0 */4)   │
└───────┬─────────┘
        ▼
┌─────────────────┐
│ GitHub Node      │  GET /orgs/{org}/repos
│ (List Repos)     │
└───────┬─────────┘
        ▼
┌─────────────────┐
│ Loop Over Repos  │
│ (SplitInBatches) │
└───────┬─────────┘
        ▼
┌─────────────────┐
│ GitHub Node      │  GET /repos/{repo}/pulls?state=open
│ (List Open PRs)  │
└───────┬─────────┘
        ▼
┌─────────────────────────────────────────────┐
│ AI Agent Node (LLM)                          │
│ System prompt: agents/engineering/gatekeeper │
│ Input: PR data (diff stats, CI, conflicts)   │
│ Output: classification + reasoning           │
└───────┬─────────────────────────────────────┘
        ▼
┌─────────────────┐
│ Switch Node      │  Route by classification
│ (safe/review/    │
│  conflict/skip)  │
└──┬──────┬─────┬─┘
   ▼      ▼     ▼
┌──────┐┌─────┐┌──────┐
│Merge ││Label││Close │
│ Node ││Node ││ Node │
└──┬───┘└──┬──┘└──┬───┘
   └───────┼──────┘
           ▼
   ┌──────────────┐
   │ Aggregate     │
   │ Results Node  │
   └───────┬──────┘
           ▼
   ┌──────────────┐     ┌──────────────┐
   │ Slack Node    │     │ HTTP Request  │
   │ (Post Report) │     │ (Dashboard)   │
   └──────────────┘     └──────────────┘
```

Import the workflow skeleton from `examples/workflows/gatekeeper.json` (if generated) or build it manually following the node structure above.

---

### Option D: Docker (Containerized)

See `examples/gatekeeper-deployment/docker-compose.yml` for a full containerized deployment including the Fleet Dashboard.

```bash
# Start Gatekeeper + Dashboard
op run --env-file=.env.template -- docker compose -f examples/gatekeeper-deployment/docker-compose.yml up -d

# View logs
docker logs -f gatekeeper-agent

# Stop
docker compose -f examples/gatekeeper-deployment/docker-compose.yml down
```

---

## Configuration

### Per-Repo Overrides

Drop a `.gatekeeper/config.yml` in any repo to customize behavior:

```yaml
# .gatekeeper/config.yml
enabled: true

# Override the default 300-line threshold
max_safe_lines: 500

# Additional file patterns considered low-risk for this repo
safe_file_patterns:
  - "*.stories.tsx"
  - "fixtures/**"
  - "testdata/**"

# Override the 48-hour conflict grace period
conflict_grace_hours: 72

# Designated reviewers (supplements CODEOWNERS)
reviewers:
  - "@backend-team"
  - "@security-team"
```

### Escape Hatch

Add the `gatekeeper:skip` label to any PR to exclude it from automated triage. Gatekeeper will log the PR as "Skipped" and take no action.

---

## Monitoring & Notifications

### Slack Notifications

Each triage cycle posts a summary to the configured Slack channel. The message uses Block Kit formatting per `mcp-protocols/slack.md`:

- **Header:** Cycle timestamp and org name
- **Summary stats:** Merged / Flagged / Closed / Errors
- **Details:** Expandable sections with links to each PR

### Fleet Dashboard

If the Fleet Dashboard is deployed, Gatekeeper POSTs its report to the dashboard API after each cycle. See `docs/agents/operations/dashboard/` for dashboard setup.

### Health Monitoring

The Fleet Dashboard tracks Gatekeeper's cycle regularity. If Gatekeeper fails to report within 6 hours (1.5× the 4-hour interval), the dashboard raises a `stale` alert via Slack.

---

## Dry-Run Mode

**Strongly recommended for the first 1–2 weeks.**

In dry-run mode, Gatekeeper classifies all PRs and generates the full report, but takes no mutating actions (no merges, no closes, no labels). This lets you review its judgment before enabling auto-actions.

Enable dry-run:

```yaml
# .gatekeeper/config.yml (org-level or per-repo)
dry_run: true
```

Or via environment variable:

```bash
GATEKEEPER_DRY_RUN=true
```

When dry-run is active, the triage report marks all actions as `[DRY RUN]` and posts them as "would have done" entries.

---

## Security Considerations

1. **Token scope minimization:** Use the narrowest PAT scope possible. If using a GitHub App, request only `pull_requests:write`, `contents:read`, `issues:write`, `members:read`.
2. **Branch protection:** Gatekeeper respects branch protection rules. It cannot merge if rules require specific reviewers or passing checks that haven't run.
3. **Allowlisting:** Start with a small set of repos and expand gradually. Set `GATEKEEPER_REPOS=repo1,repo2` to restrict scope.
4. **Audit trail:** Every action is logged as a PR comment and in the triage report. The journal at `.gatekeeper/journal.md` captures edge cases and learnings.
5. **No force operations:** Gatekeeper never force-pushes, never overrides branch protection, and never deletes branches from forks.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "API rate limit exceeded" | Too many repos or PRs in one cycle | Reduce repo scope or increase cycle interval |
| PR not being auto-merged | Branch protection requires additional reviewers | Add Gatekeeper's token user as an allowed bypass actor |
| "Mergeable state unknown" | GitHub hasn't computed mergeability yet | Gatekeeper retries once after 30s; if still unknown, flags for review |
| Stale conflict PR not closed | PR has a linked critical issue | By design — Gatekeeper won't close PRs linked to critical issues |
| Dashboard shows "stale" status | Cron job failed or network issue | Check cron logs and `gh auth status` |
