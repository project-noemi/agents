#!/usr/bin/env bash
# Roll the cross-model AI reviewer out across the fleet.
#
# For every active, non-fork repository in the target organizations, this opens
# a pull request adding the thin caller workflow
# (templates/ci/ai-review-caller.yml → .github/workflows/ai-review.yml), which
# delegates to the reusable reviewer in the tooling repository.
#
# DELIBERATELY PR-BASED. This script never pushes to a default branch: each
# repository's humans accept the reviewer by merging, which is itself the
# consent step. A reviewer imposed silently would be a strange way to deploy a
# governance control.
#
# Usage:
#   bash scripts/deploy-ai-review.sh --dry-run     # list what would happen
#   bash scripts/deploy-ai-review.sh               # open the PRs
#   ORGS="newpush-labs" bash scripts/deploy-ai-review.sh   # subset
#
# Env (all optional):
#   ORGS          space-separated organizations
#                 (default: "newpush project-noemi newpush-labs")
#   TOOLING_REPO  repository hosting the reusable workflow
#                 (default: project-noemi/agents)
#   BRANCH        branch name to open PRs from (default: chore/ai-review-caller)
#
# Requires:
#   - gh authenticated with `repo` AND `workflow` scope. Pushing workflow files
#     is rejected without `workflow`; grant it with:  gh auth refresh -s workflow
#   - the caller template at templates/ci/ai-review-caller.yml
#
# Per-repo behaviour: skip if archived, a fork, a `.github` meta-repo, the
# tooling repo itself, or if .github/workflows/ai-review.yml already exists on
# the default branch (idempotent — safe to re-run after partial rollouts).

set -euo pipefail

ORGS="${ORGS:-newpush project-noemi newpush-labs}"
TOOLING_REPO="${TOOLING_REPO:-project-noemi/agents}"
BRANCH="${BRANCH:-chore/ai-review-caller}"
TEMPLATE="templates/ci/ai-review-caller.yml"
WORKFLOW_PATH=".github/workflows/ai-review.yml"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

log() { printf '%s\n' "$*" >&2; }

if [[ ! -f "$TEMPLATE" ]]; then
  log "✖ Caller template not found at ${TEMPLATE}. Run from the tooling repo root."
  exit 1
fi

# Fail before doing anything if the token cannot push workflow files: without
# the `workflow` scope every push below is rejected, one repo at a time.
# A dry run pushes nothing, so it is exempt — previewing must not require scopes.
if [[ $DRY_RUN -eq 0 ]] && ! gh auth status 2>&1 | grep -q "workflow"; then
  log "✖ The gh token lacks the 'workflow' scope, which pushing ${WORKFLOW_PATH} requires."
  log "  Fix:  gh auth refresh -s workflow"
  exit 1
fi

CONTENT_B64=$(base64 < "$TEMPLATE" | tr -d '\n')
PR_BODY="Adds the cross-model AI reviewer as a thin caller of the reusable workflow in ${TOOLING_REPO}.

**Advisory only.** It posts three-gate findings (premise → framing → code) as a PR comment. It never approves, merges, or blocks, and it must not be added to required status checks.

Merging this PR is the consent step: it enables the reviewer for this repository. Configuration comes from organization-level Actions variables — this repo needs no secrets and no further setup.

Framework: ${TOOLING_REPO} \`docs/AI_REVIEW_GOVERNANCE.md\`. Deployed by \`scripts/deploy-ai-review.sh\`."

created=0; skipped=0; failed=0

for org in $ORGS; do
  log "── ${org} ──"
  repos=$(gh repo list "$org" --limit 200 \
    --json name,isArchived,isFork,defaultBranchRef \
    --jq '.[] | select(.isArchived|not) | select(.isFork|not) | "\(.name)\t\(.defaultBranchRef.name)"')

  while IFS=$'\t' read -r name default_branch; do
    [[ -z "$name" ]] && continue
    repo="${org}/${name}"

    if [[ "$name" == ".github" || "$repo" == "$TOOLING_REPO" ]]; then
      log "  ⏭  ${repo} (meta or tooling repo)"; skipped=$((skipped+1)); continue
    fi
    if [[ -z "$default_branch" || "$default_branch" == "null" ]]; then
      log "  ⏭  ${repo} (empty repository)"; skipped=$((skipped+1)); continue
    fi
    if gh api "repos/${repo}/contents/${WORKFLOW_PATH}?ref=${default_branch}" >/dev/null 2>&1; then
      log "  ⏭  ${repo} (already has ${WORKFLOW_PATH})"; skipped=$((skipped+1)); continue
    fi

    if [[ $DRY_RUN -eq 1 ]]; then
      log "  ▶  would deploy to ${repo} (default: ${default_branch})"
      created=$((created+1)); continue
    fi

    if head_sha=$(gh api "repos/${repo}/git/ref/heads/${default_branch}" --jq .object.sha 2>/dev/null) \
       && gh api --method POST "repos/${repo}/git/refs" \
            -f ref="refs/heads/${BRANCH}" -f sha="$head_sha" >/dev/null 2>&1 \
       && gh api --method PUT "repos/${repo}/contents/${WORKFLOW_PATH}" \
            -f message="ci: add cross-model AI review (advisory)" \
            -f content="$CONTENT_B64" -f branch="$BRANCH" >/dev/null 2>&1 \
       && url=$(gh pr create --repo "$repo" --base "$default_branch" --head "$BRANCH" \
            --title "ci: add cross-model AI review (advisory)" --body "$PR_BODY" 2>/dev/null); then
      log "  ✔  ${repo} → ${url}"
      created=$((created+1))
    else
      log "  ✖  ${repo} — failed (permissions, or branch ${BRANCH} already exists)"
      failed=$((failed+1))
    fi
  done <<< "$repos"
done

# Structured audit log to stderr, per CLAUDE.md.
printf '%s\n' "{\"task\":\"Deploy AI reviewer caller workflow across fleet\",\"inputs\":[\"orgs: ${ORGS}\",\"dry_run: ${DRY_RUN}\"],\"actions\":[\"opened ${created} PRs\",\"skipped ${skipped}\"],\"risks\":[\"each PR enables Gemini review costs for that repo\"],\"result\":\"created=${created} skipped=${skipped} failed=${failed}\"}" >&2

log ""
log "Done: ${created} PR(s) opened, ${skipped} skipped, ${failed} failed."
[[ $failed -gt 0 ]] && exit 1 || exit 0
