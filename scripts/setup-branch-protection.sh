#!/usr/bin/env bash
# Apply branch protection rules on GitHub so that:
#   - `develop` is the integration branch (PRs + checks required; work is reviewed here)
#   - `main` is the release branch; promotion is PR-only from `develop`, with no direct
#     pushes and no admin/bot bypass
#
# Main policy (canonical promotion path):
#   1. Require a pull request before merging into main (forces develop → main promotion
#      through a PR that can be armed with `gh pr merge --auto`).
#   2. Block / disallow direct pushes to main for everyone — enforce_admins true, empty
#      bypass allowances (no bot or admin bypass of the PR requirement).
#   3. Keep `check-source-branch` (require-develop-source workflow) as a required status
#      check on main PRs — never remove or weaken it. Guarantees the promotion PR can
#      only originate from `develop`.
#   4. Optionally require 1 approving review on PRs into main (MAIN_REQUIRE_APPROVALS=1).
#      Default is 0 — develop is already the review gate.
#   5. Enable repository "Allow auto-merge" so `gh pr merge --auto` can arm the merge.
#   6. PROMOTE_TOKEN: only needed if you require *privileged re-runs* of status checks on
#      the promotion PR (e.g. a workflow that GITHUB_TOKEN cannot re-dispatch). If main
#      only requires "must be a PR" + checks that fire on `pull_request` (including
#      check-source-branch and the validate suite), no secret is needed — GitHub runs
#      those checks automatically on the promotion PR.
#
# Requires:
#   - gh CLI authenticated with admin rights on the target repo
#   - GitHub Pro / Team / Enterprise plan — classic branch protection is
#     paywalled on private free-tier repos. On the free plan every API call
#     here returns 403. Keep this script in source control so it can be
#     re-run the moment the plan is upgraded.
#
# Usage:
#   bash scripts/setup-branch-protection.sh
#   REPO=owner/repo bash scripts/setup-branch-protection.sh
#   MAIN_REQUIRE_APPROVALS=1 bash scripts/setup-branch-protection.sh   # optional 1 review on main
#
# Env:
#   REPO                      owner/repo override (default: gh repo view)
#   MAIN_REQUIRE_APPROVALS    0 (default) or 1 — approving reviews required on main PRs
#   SKIP_AUTO_MERGE           if set to 1, do not enable repository allow_auto_merge
#
# The status-check `contexts` below must match the check-run names GitHub
# surfaces for each workflow job. If a check name changes, update the
# context list or protection will silently stop waiting for it.
# Do NOT remove `check-source-branch` from main's contexts.

set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)}"

if [[ -z "$REPO" ]]; then
  echo "✖ Could not determine the target repository." >&2
  echo "  Run inside a GitHub checkout with 'gh' authenticated, or set REPO=owner/repo." >&2
  exit 1
fi

MAIN_REQUIRE_APPROVALS="${MAIN_REQUIRE_APPROVALS:-0}"
if [[ "$MAIN_REQUIRE_APPROVALS" != "0" && "$MAIN_REQUIRE_APPROVALS" != "1" ]]; then
  echo "✖ MAIN_REQUIRE_APPROVALS must be 0 or 1 (got: ${MAIN_REQUIRE_APPROVALS})" >&2
  exit 1
fi

# When approvals are required, also dismiss stale reviews. Code-owner reviews stay
# off by default on main (develop is the CODEOWNERS gate for day-to-day work).
if [[ "$MAIN_REQUIRE_APPROVALS" == "1" ]]; then
  MAIN_DISMISS_STALE=true
else
  MAIN_DISMISS_STALE=false
fi

apply_protection() {
  local branch="$1"
  local payload="$2"
  echo "→ Applying protection to '${branch}' on ${REPO}"
  local response http_status
  response=$(printf '%s' "$payload" | gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/${REPO}/branches/${branch}/protection" \
    --input - 2>&1) && http_status=0 || http_status=$?
  if [[ $http_status -eq 0 ]]; then
    echo "  ✔ protected: ${branch}"
    return 0
  fi
  echo "  ✖ failed to protect ${branch}"
  printf '    %s\n' "$response" | sed 's/^/    /'
  return 1
}

enable_auto_merge() {
  if [[ "${SKIP_AUTO_MERGE:-0}" == "1" ]]; then
    echo "→ Skipping allow_auto_merge (SKIP_AUTO_MERGE=1)"
    return 0
  fi
  echo "→ Enabling repository allow_auto_merge on ${REPO}"
  local response http_status
  response=$(gh api \
    --method PATCH \
    -H "Accept: application/vnd.github+json" \
    "repos/${REPO}" \
    -f allow_auto_merge=true 2>&1) && http_status=0 || http_status=$?
  if [[ $http_status -eq 0 ]]; then
    echo "  ✔ allow_auto_merge enabled (Settings → General)"
    return 0
  fi
  echo "  ✖ failed to enable allow_auto_merge"
  printf '    %s\n' "$response" | sed 's/^/    /'
  return 1
}

# Main: PR-only promotion, no direct push, no admin/bot bypass.
# check-source-branch is mandatory and must never be dropped (Decision [2026-08-01-0002]).
# Validate suite is also required; it re-runs on pull_request → main automatically
# (no PROMOTE_TOKEN for that path).
MAIN_PAYLOAD=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "check-source-branch",
      "Audit, Generate, and Fast Tests"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": ${MAIN_REQUIRE_APPROVALS},
    "dismiss_stale_reviews": ${MAIN_DISMISS_STALE},
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "bypass_pull_request_allowances": {
      "users": [],
      "teams": [],
      "apps": []
    }
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_linear_history": false,
  "block_creations": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
)

# Develop: integration branch — reviews and checks land here before promotion.
#
# enforce_admins is deliberately FALSE (owner decision 2026-08-17, Decision
# [2026-08-17-0001]): an admin can always drop rules, push, and restore them,
# so enforce_admins is not a real boundary against admins — and removing every
# escape hatch risks a fully-stuck system. The compensating control is the
# daily Admin Override Watch (.github/workflows/admin-override-watch.yml),
# which detects and demands attestation for every admin-capability use. Keep
# this value, EXPECTED_PROTECTION in scripts/audit-admin-overrides.js, and the
# decision record in agreement.
#
# "Cross-Model PR Review" is required-but-advisory: required that it COMPLETES
# (kills the review-posted-after-merge race), while its verdict stays advisory
# — the job exits green on findings and on by-design halts.
DEVELOP_PAYLOAD=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Audit, Generate, and Fast Tests",
      "Cross-Model PR Review"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_linear_history": false
}
JSON
)

failures=0
apply_protection "main" "$MAIN_PAYLOAD" || failures=$((failures + 1))
apply_protection "develop" "$DEVELOP_PAYLOAD" || failures=$((failures + 1))
enable_auto_merge || failures=$((failures + 1))

if [[ $failures -gt 0 ]]; then
  cat <<'MSG'

⚠  One or more protection rules could not be applied.

   Classic branch protection is only available on private repos under the
   GitHub Pro / Team / Enterprise plans. Check the org plan:

     gh api orgs/<your-org> --jq .plan.name

   If it reports "free", upgrade the org (or make this repo public) and
   re-run this script. Nothing else in the toolchain needs to change.
MSG
  exit 1
fi

echo
echo "✅ Branch protection applied to main and develop."
echo "   main:  PR required, enforce_admins=true (no direct push / no bot bypass),"
echo "          required checks: check-source-branch + Audit/Generate/Fast Tests,"
echo "          approving reviews on main: ${MAIN_REQUIRE_APPROVALS} (set MAIN_REQUIRE_APPROVALS=1 to require one)."
echo "   develop: PR + 1 review + validate checks (integration review gate)."
echo "   repo:  allow_auto_merge enabled for gh pr merge --auto on the promotion PR."
echo
echo "   PROMOTE_TOKEN: not required for the default main checks (they run on pull_request)."
echo "   Add a PROMOTE_TOKEN secret only if you later require privileged status-check"
echo "   re-runs that GITHUB_TOKEN cannot perform."
