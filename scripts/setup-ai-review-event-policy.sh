#!/usr/bin/env bash
# Apply the repository Actions event policy that allowlists pull_request_target
# for .github/workflows/ai-review.yml only (Decision [2026-11-09-0001]).
#
# Requires a repository administrator. See
# docs/AI_REVIEW_GOVERNANCE.md § GitHub default block of pull_request_target.
#
# Usage:
#   bash scripts/setup-ai-review-event-policy.sh
#   bash scripts/setup-ai-review-event-policy.sh --dry-run
#   REPO=owner/repo bash scripts/setup-ai-review-event-policy.sh

set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$root/scripts/setup-ai-review-event-policy.js" "$@"
