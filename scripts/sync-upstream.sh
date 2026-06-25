#!/usr/bin/env bash
# sync-upstream.sh — Pull non-conflicting changes from the upstream NoéMI agents
# repository into your organization's local fork (default branch: develop).
#
# Usage:  ./scripts/sync-upstream.sh [--dry-run]
#
# Environment overrides (Decision [2026-06-25-0004]):
#   NOEMI_UPSTREAM_REMOTE  Git remote name for upstream (default: upstream)
#   NOEMI_UPSTREAM_URL     Upstream repository URL  (default: https://github.com/project-noemi/agents.git)
#   NOEMI_LOCAL_BRANCH     Local branch to sync into (default: develop)
#   NOEMI_ORG_NAME         Display label for the success message (default: [MyOrganization])
#
# Conflict policy: if a merge conflict occurs, the script aborts the merge
# so you can resolve manually (favour your organization's version).

set -euo pipefail

UPSTREAM_REMOTE="${NOEMI_UPSTREAM_REMOTE:-upstream}"
UPSTREAM_URL="${NOEMI_UPSTREAM_URL:-https://github.com/project-noemi/agents.git}"
LOCAL_BRANCH="${NOEMI_LOCAL_BRANCH:-develop}"
MY_ORGANIZATION="${NOEMI_ORG_NAME:-[MyOrganization]}"

# --- Helpers ---------------------------------------------------------------
info()  { printf "\033[1;34m▸ %s\033[0m\n" "$*"; }
ok()    { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
warn()  { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()   { printf "\033[1;31m✘ %s\033[0m\n" "$*"; }

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true && info "Dry-run mode — no merges will be performed"

# --- Preflight -------------------------------------------------------------
if [[ "$(git branch --show-current)" != "$LOCAL_BRANCH" ]]; then
  err "You must be on the '$LOCAL_BRANCH' branch. Currently on '$(git branch --show-current)'."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  err "Working tree is dirty. Commit or stash your changes first."
  exit 1
fi

# Ensure upstream remote exists
if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
  info "Adding upstream remote: $UPSTREAM_URL"
  git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi

# --- Fetch -----------------------------------------------------------------
info "Fetching from $UPSTREAM_REMOTE..."
git fetch "$UPSTREAM_REMOTE"

# --- Drift report ----------------------------------------------------------
echo ""
info "New commits in $UPSTREAM_REMOTE/develop not yet in $LOCAL_BRANCH:"
DEVELOP_DRIFT=$(git log --oneline "$LOCAL_BRANCH..$UPSTREAM_REMOTE/develop" 2>/dev/null || true)
if [[ -z "$DEVELOP_DRIFT" ]]; then
  ok "$UPSTREAM_REMOTE/develop — already up to date"
else
  echo "$DEVELOP_DRIFT"
fi

echo ""
info "New commits in $UPSTREAM_REMOTE/main not yet in $LOCAL_BRANCH:"
MAIN_DRIFT=$(git log --oneline "$LOCAL_BRANCH..$UPSTREAM_REMOTE/main" 2>/dev/null || true)
if [[ -z "$MAIN_DRIFT" ]]; then
  ok "$UPSTREAM_REMOTE/main — already up to date"
else
  echo "$MAIN_DRIFT"
fi

# --- Exit early if nothing to do -------------------------------------------
if [[ -z "$DEVELOP_DRIFT" && -z "$MAIN_DRIFT" ]]; then
  echo ""
  ok "Everything is up to date. Nothing to merge."
  exit 0
fi

if $DRY_RUN; then
  echo ""
  warn "Dry-run complete. Run without --dry-run to merge."
  exit 0
fi

# --- Merge upstream/develop ------------------------------------------------
if [[ -n "$DEVELOP_DRIFT" ]]; then
  echo ""
  info "Merging $UPSTREAM_REMOTE/develop..."
  if git merge "$UPSTREAM_REMOTE/develop" --no-edit; then
    ok "$UPSTREAM_REMOTE/develop merged cleanly"
  else
    err "Merge conflict with $UPSTREAM_REMOTE/develop!"
    warn "Resolve conflicts (favour your organization's version), then: git add . && git commit"
    warn "After resolving, re-run this script to continue with $UPSTREAM_REMOTE/main."
    exit 1
  fi
fi

# --- Merge upstream/main --------------------------------------------------
if [[ -n "$MAIN_DRIFT" ]]; then
  echo ""
  info "Merging $UPSTREAM_REMOTE/main..."
  if git merge "$UPSTREAM_REMOTE/main" --no-edit; then
    ok "$UPSTREAM_REMOTE/main merged cleanly"
  else
    err "Merge conflict with $UPSTREAM_REMOTE/main!"
    warn "Resolve conflicts (favour your organization's version), then: git add . && git commit"
    exit 1
  fi
fi

# --- Push ------------------------------------------------------------------
echo ""
info "Pushing $LOCAL_BRANCH to origin..."
git push origin "$LOCAL_BRANCH"
ok "Sync complete. $MY_ORGANIZATION/agents is up to date with the upstream NoéMI agents repository."
