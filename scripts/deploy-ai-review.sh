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
# Integration-branch rule (Decision [2026-08-16-0003]):
#   1. Prefer `develop` when that branch exists.
#   2. Else prefer `dev`.
#   3. Never open a caller PR against `main` / `master`. If neither `develop`
#      nor `dev` exists, open a Phase 0 issue instead: create `develop`,
#      install require-develop-source, and protect `main` so only `develop`
#      may merge into it (see scripts/setup-branch-protection.sh).
#
# Usage:
#   bash scripts/deploy-ai-review.sh --dry-run     # list what would happen
#   bash scripts/deploy-ai-review.sh               # open the PRs / issues
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
# the integration branch (idempotent — safe to re-run after partial rollouts).

set -euo pipefail

ORGS="${ORGS:-newpush project-noemi newpush-labs}"
TOOLING_REPO="${TOOLING_REPO:-project-noemi/agents}"
BRANCH="${BRANCH:-chore/ai-review-caller}"
TEMPLATE="templates/ci/ai-review-caller.yml"
WORKFLOW_PATH=".github/workflows/ai-review.yml"
PHASE0_TITLE="Adopt Phase 0 develop-only merge before enabling AI review"
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

# Discover which well-known refs exist; preference is decided only in
# scripts/deploy-ai-review-lib.js (pickIntegrationBranch) so the unit tests
# cover the production rule.
DEPLOY_LIB="${BASH_SOURCE[0]%/*}/deploy-ai-review-lib.js"

integration_branch() {
  local repo="$1"
  local names=()
  gh api "repos/${repo}/git/ref/heads/develop" >/dev/null 2>&1 && names+=(develop)
  gh api "repos/${repo}/git/ref/heads/dev" >/dev/null 2>&1 && names+=(dev)
  gh api "repos/${repo}/git/ref/heads/main" >/dev/null 2>&1 && names+=(main)
  gh api "repos/${repo}/git/ref/heads/master" >/dev/null 2>&1 && names+=(master)
  node "$DEPLOY_LIB" pick-branch "${names[@]}"
}

PHASE0_BODY="This repository has no \`develop\` or \`dev\` branch, so the fleet AI-review caller will **not** open a PR against \`main\` / \`master\`.

Project NoéMI's Phase 0 git baseline (Decisions [2026-07-03-0001] and [2026-08-01-0002], \`CONTRIBUTING.md\` branching model):

1. Create an integration branch named **\`develop\`** from the current default branch.
2. Add \`.github/workflows/require-develop-source.yml\` so the only valid PR into \`main\` has head \`develop\`.
3. Protect \`main\`: pull request required, \`enforce_admins\`, required check \`check-source-branch\`. The tooling repo's \`scripts/setup-branch-protection.sh\` is the reference applicator (\`REPO=${TOOLING_REPO%%/*}/<this-repo> bash scripts/setup-branch-protection.sh\` from a checkout of \`${TOOLING_REPO}\`).
4. Re-run \`bash scripts/deploy-ai-review.sh\` so the AI-review caller PR targets \`develop\`.

Do not merge AI-review (or any other feature work) directly into \`main\`."

open_phase0_issue() {
  local repo="$1"
  local existing
  # `jq '.[0].url'` prints the literal string "null" on an empty list — that
  # is not a URL. Parse through the tested helper so we never skip create.
  existing=$(gh issue list --repo "$repo" --search "in:title ${PHASE0_TITLE}" \
    --state open --json url 2>/dev/null | node "$DEPLOY_LIB" || true)
  if [[ -n "$existing" ]]; then
    printf '%s' "$existing"
    return 0
  fi
  gh issue create --repo "$repo" --title "$PHASE0_TITLE" --body "$PHASE0_BODY"
}

CONTENT_B64=$(base64 < "$TEMPLATE" | tr -d '\n')
PR_BODY="Adds the cross-model AI reviewer as a thin caller of the reusable workflow in ${TOOLING_REPO}.

**Advisory only.** It posts three-gate findings (premise → framing → code) as a PR comment. It never approves, merges, or blocks, and it must not be added to required status checks.

Merging this PR is the consent step: it enables the reviewer for this repository. Configuration comes from organization-level Actions variables — this repo needs no secrets and no further setup.

The PR targets the integration branch (\`develop\`, or \`dev\` if \`develop\` is absent) — never \`main\`. See Decision [2026-08-16-0003].

Framework: ${TOOLING_REPO} \`docs/AI_REVIEW_GOVERNANCE.md\`. Deployed by \`scripts/deploy-ai-review.sh\`."

created=0; skipped=0; failed=0; issues=0

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

    target=$(integration_branch "$repo")
    if [[ -z "$target" ]]; then
      if [[ $DRY_RUN -eq 1 ]]; then
        log "  ▶  would open Phase 0 issue on ${repo} (no develop/dev; default is ${default_branch})"
        issues=$((issues+1)); continue
      fi
      if url=$(open_phase0_issue "$repo"); then
        log "  ℹ  ${repo} → Phase 0 issue ${url}"
        issues=$((issues+1))
      else
        log "  ✖  ${repo} — failed to open Phase 0 issue"
        failed=$((failed+1))
      fi
      continue
    fi

    # Existing file: skip when identical to the template, UPDATE when it
    # differs — that is how template changes (e.g. the @main pin) roll out,
    # and how a divergent fork of the reviewer gets replaced by the standard
    # caller. The update is still a PR: each repo's humans accept it by merge.
    existing_json=$(gh api "repos/${repo}/contents/${WORKFLOW_PATH}?ref=${target}" 2>/dev/null || true)
    if [[ -n "$existing_json" ]]; then
      existing_b64=$(jq -r '.content' <<<"$existing_json" | tr -d '\n')
      if [[ "$existing_b64" == "$CONTENT_B64" ]]; then
        log "  ⏭  ${repo} (caller already current on ${target})"; skipped=$((skipped+1)); continue
      fi
      MODE="update"
      # Updating an existing file requires its current blob sha.
      FILE_SHA=$(jq -r '.sha' <<<"$existing_json")
      WORK_BRANCH="${BRANCH}-update"
      COMMIT_MSG="ci: update cross-model AI review caller to the current template"
    else
      MODE="add"
      FILE_SHA=""
      WORK_BRANCH="$BRANCH"
      COMMIT_MSG="ci: add cross-model AI review (advisory)"
    fi

    if [[ $DRY_RUN -eq 1 ]]; then
      log "  ▶  would ${MODE} on ${repo} (base: ${target})"
      created=$((created+1)); continue
    fi

    put_args=(-f message="$COMMIT_MSG" -f content="$CONTENT_B64" -f branch="$WORK_BRANCH")
    [[ -n "$FILE_SHA" ]] && put_args+=(-f sha="$FILE_SHA")
    if head_sha=$(gh api "repos/${repo}/git/ref/heads/${target}" --jq .object.sha 2>/dev/null) \
       && gh api --method POST "repos/${repo}/git/refs" \
            -f ref="refs/heads/${WORK_BRANCH}" -f sha="$head_sha" >/dev/null 2>&1 \
       && gh api --method PUT "repos/${repo}/contents/${WORKFLOW_PATH}" \
            "${put_args[@]}" >/dev/null 2>&1 \
       && url=$(gh pr create --repo "$repo" --base "$target" --head "$WORK_BRANCH" \
            --title "$COMMIT_MSG" --body "$PR_BODY" 2>/dev/null); then
      log "  ✔  ${repo} → ${url}"
      created=$((created+1))
    else
      log "  ✖  ${repo} — failed (permissions, or branch ${WORK_BRANCH} already exists)"
      failed=$((failed+1))
    fi
  done <<< "$repos"
done

# Structured audit log to stderr, per CLAUDE.md.
printf '%s\n' "{\"task\":\"Deploy AI reviewer caller workflow across fleet\",\"inputs\":[\"orgs: ${ORGS}\",\"dry_run: ${DRY_RUN}\"],\"actions\":[\"opened ${created} PRs\",\"opened ${issues} Phase 0 issues\",\"skipped ${skipped}\"],\"risks\":[\"each PR enables Gemini review costs for that repo\"],\"result\":\"created=${created} issues=${issues} skipped=${skipped} failed=${failed}\"}" >&2

log ""
log "Done: ${created} PR(s) opened, ${issues} Phase 0 issue(s), ${skipped} skipped, ${failed} failed."
[[ $failed -gt 0 ]] && exit 1 || exit 0
