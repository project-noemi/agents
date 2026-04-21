#!/usr/bin/env bash
# Apply branch protection rules on GitHub so that:
#   - `develop` is the integration branch (no direct pushes, PRs + checks required)
#   - `main` is the release branch, and only PRs whose source is `develop`
#     can merge into it (enforced by the `require-develop-source` workflow)
#
# Requires:
#   - gh CLI authenticated with admin rights on the target repo
#   - GitHub Pro / Team / Enterprise plan — classic branch protection is
#     paywalled on private free-tier repos. On the free plan every API call
#     here returns 403. Keep this script in source control so it can be
#     re-run the moment the plan is upgraded.
#
# Usage:
#   REPO=owner/repo bash scripts/setup-branch-protection.sh
#
# The status-check `contexts` below must match the check-run names GitHub
# surfaces for each workflow job. If a check name changes, update the
# context list or protection will silently stop waiting for it.

set -euo pipefail

REPO="${REPO:-owner/repo}"

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

MAIN_PAYLOAD=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "check-source-branch",
      "Audit, Generate, and Fast Tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_linear_history": false
}
JSON
)

DEVELOP_PAYLOAD=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Audit, Generate, and Fast Tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
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
