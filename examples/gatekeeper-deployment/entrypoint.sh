#!/bin/bash
set -euo pipefail

# Gatekeeper PR Triage Agent — Entrypoint
# Runs on a configurable interval, triaging PRs across the organization.
# Requires: GH_TOKEN, GATEKEEPER_ORG
# Optional: GATEKEEPER_REPOS, GATEKEEPER_DRY_RUN, GATEKEEPER_INTERVAL_HOURS,
#           SLACK_WEBHOOK_URL, DASHBOARD_API_URL, DASHBOARD_AUTH_TOKEN

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GATEKEEPER_ORG:?GATEKEEPER_ORG is required}"

INTERVAL_HOURS="${GATEKEEPER_INTERVAL_HOURS:-4}"
INTERVAL_SECONDS=$(( INTERVAL_HOURS * 3600 ))
DRY_RUN="${GATEKEEPER_DRY_RUN:-true}"

log_info() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

log_warn() {
  printf '%s WARNING: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

log_error() {
  printf '%s ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

retry_with_backoff() {
  local attempt=1
  local max_attempts="${RETRY_MAX_ATTEMPTS:-5}"
  local delay_seconds="${RETRY_INITIAL_DELAY_SECONDS:-1}"
  local max_delay_seconds="${RETRY_MAX_DELAY_SECONDS:-16}"

  while true; do
    if "$@"; then
      return 0
    fi

    local status=$?
    if [ "$status" -eq 2 ]; then
      return 2
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      return "$status"
    fi

    log_warn "Transient failure (exit ${status}). Retrying in ${delay_seconds}s: $*"
    sleep "$delay_seconds"
    attempt=$((attempt + 1))
    delay_seconds=$((delay_seconds * 2))
    if [ "$delay_seconds" -gt "$max_delay_seconds" ]; then
      delay_seconds="$max_delay_seconds"
    fi
  done
}

authenticate_github() {
  printf '%s\n' "${GH_TOKEN}" | gh auth login --with-token >/dev/null 2>&1
}

sign_report() {
  printf '%s' "${REPORT_JSON}" | openssl dgst -sha256 -hmac "${GATEKEEPER_HMAC_SECRET}" -hex | awk '{print $NF}'
}

post_dashboard_report() {
  local signature
  local http_code

  signature="$(sign_report)"
  http_code="$(curl -sS -o /tmp/dashboard-response.txt -w '%{http_code}' \
    -X POST "${DASHBOARD_API_URL}" \
    -H "Authorization: Bearer ${DASHBOARD_AUTH_TOKEN}" \
    -H "X-Signature-256: sha256=${signature}" \
    -H "Content-Type: application/json" \
    --data "${REPORT_JSON}" || echo '000')"

  case "${http_code}" in
    200|201|202|204)
      return 0
      ;;
    401)
      log_error "Dashboard rejected the Gatekeeper report with HTTP 401."
      return 2
      ;;
    429|5??|000)
      log_warn "Dashboard submission failed with HTTP ${http_code}."
      return 1
      ;;
    *)
      log_warn "Dashboard submission failed with HTTP ${http_code}."
      return 1
      ;;
  esac
}

post_slack_summary() {
  local slack_payload
  local http_code

  slack_payload="$(jq -n \
    --arg org "${GATEKEEPER_ORG}" \
    --arg mode "$([ "${DRY_RUN}" = "true" ] && echo "DRY RUN" || echo "LIVE")" \
    --argjson pr_count "${PR_COUNT}" \
    '{text: ("Gatekeeper triage complete for " + $org + ": " + ($pr_count | tostring) + " PRs scanned. Mode: " + $mode)}')"

  http_code="$(curl -sS -o /tmp/slack-response.txt -w '%{http_code}' \
    -X POST "${SLACK_WEBHOOK_URL}" \
    -H 'Content-Type: application/json' \
    --data "${slack_payload}" || echo '000')"

  case "${http_code}" in
    200|201|202|204)
      return 0
      ;;
    429|5??|000)
      log_warn "Slack webhook submission failed with HTTP ${http_code}."
      return 1
      ;;
    *)
      log_warn "Slack webhook submission failed with HTTP ${http_code}."
      return 1
      ;;
  esac
}

log_info "Gatekeeper starting: org=${GATEKEEPER_ORG} interval=${INTERVAL_HOURS}h dry_run=${DRY_RUN}"

while true; do
  CYCLE_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log_info "Starting triage cycle..."

  if ! retry_with_backoff authenticate_github; then
    log_error "GitHub authentication failed."
    sleep "${INTERVAL_SECONDS}"
    continue
  fi

  if [ -n "${GATEKEEPER_REPOS:-}" ]; then
    REPOS="$(printf '%s' "${GATEKEEPER_REPOS}" | tr ',' '\n')"
  else
    if ! REPOS="$(retry_with_backoff gh repo list "${GATEKEEPER_ORG}" --no-archived --json name --jq '.[].name' --limit 200 2>/tmp/gatekeeper-repos.err)"; then
      log_error "Failed to enumerate repositories for ${GATEKEEPER_ORG}: $(tr '\n' ' ' </tmp/gatekeeper-repos.err)"
      sleep "${INTERVAL_SECONDS}"
      continue
    fi
  fi

  PR_COUNT=0
  REPOS_SCANNED=0
  FLAGGED_COUNT=0
  ERROR_COUNT=0
  REPORT_ERRORS=""
  FLAGGED_ITEMS=""
  ITEMS_JSON='[]'

  while IFS= read -r REPO; do
    [ -z "${REPO}" ] && continue
    REPOS_SCANNED=$((REPOS_SCANNED + 1))

    if ! OPEN_PRS="$(retry_with_backoff gh pr list --repo "${GATEKEEPER_ORG}/${REPO}" --state open --json number,title,url,author,mergeable,reviewDecision,statusCheckRollup,changedFiles,additions,deletions,labels,updatedAt 2>/tmp/gatekeeper-prs.err)"; then
      ERROR_COUNT=$((ERROR_COUNT + 1))
      REPORT_ERRORS="${REPORT_ERRORS}- ${REPO}: $(tr '\n' ' ' </tmp/gatekeeper-prs.err)\n"
      continue
    fi

    if [ "${OPEN_PRS}" = "[]" ] || [ -z "${OPEN_PRS}" ]; then
      continue
    fi

    while IFS= read -r PR; do
      [ -z "${PR}" ] && continue
      PR_NUM="$(printf '%s' "${PR}" | jq -r '.number')"
      PR_TITLE="$(printf '%s' "${PR}" | jq -r '.title')"
      PR_URL="$(printf '%s' "${PR}" | jq -r '.url')"
      PR_COUNT=$((PR_COUNT + 1))
      FLAGGED_COUNT=$((FLAGGED_COUNT + 1))
      FLAGGED_ITEMS="${FLAGGED_ITEMS}- [${REPO}#${PR_NUM}](${PR_URL}) — ${PR_TITLE}\n"
      ITEMS_JSON="$(printf '%s' "${ITEMS_JSON}" | jq \
        --arg repo "${REPO}" \
        --arg url "${PR_URL}" \
        --arg title "${PR_TITLE}" \
        --argjson number "${PR_NUM}" \
        '. + [{repo: $repo, number: $number, title: $title, url: $url, classification: "needs-review"}]')"
      log_info "Triaged ${GATEKEEPER_ORG}/${REPO}#${PR_NUM}: ${PR_TITLE}"
    done < <(printf '%s' "${OPEN_PRS}" | jq -c '.[]')
  done < <(printf '%s\n' "${REPOS}")

  CYCLE_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  REPORT="## Gatekeeper Triage — ${CYCLE_COMPLETED_AT}\n"
  REPORT="${REPORT}**Org:** ${GATEKEEPER_ORG} | **Repos scanned:** ${REPOS_SCANNED} | **PRs evaluated:** ${PR_COUNT}\n\n"
  REPORT="${REPORT}| Action | Count |\n|--------|-------|\n| Auto-merged | 0 |\n| Flagged for review | ${FLAGGED_COUNT} |\n| Closed (stale conflict) | 0 |\n| Skipped (escape hatch) | 0 |\n| Errors | ${ERROR_COUNT} |\n\n"
  REPORT="${REPORT}### Flagged for Review\n"
  if [ "${FLAGGED_COUNT}" -eq 0 ]; then
    REPORT="${REPORT}- None\n"
  else
    REPORT="${REPORT}${FLAGGED_ITEMS}"
  fi
  if [ "${ERROR_COUNT}" -gt 0 ]; then
    REPORT="${REPORT}\n### Errors\n${REPORT_ERRORS}"
  fi

  printf '%b' "${REPORT}" > /tmp/triage-report.md
  log_info "Triage cycle complete. PRs scanned: ${PR_COUNT}"

  REPORT_JSON="$(jq -n \
    --arg agent_id "gatekeeper" \
    --arg org "${GATEKEEPER_ORG}" \
    --arg mode "$([ "${DRY_RUN}" = "true" ] && echo "DRY RUN" || echo "LIVE")" \
    --arg cycle_started_at "${CYCLE_STARTED_AT}" \
    --arg cycle_completed_at "${CYCLE_COMPLETED_AT}" \
    --arg markdown_report "$(printf '%b' "${REPORT}")" \
    --argjson repos_scanned "${REPOS_SCANNED}" \
    --argjson prs_evaluated "${PR_COUNT}" \
    --argjson flagged_for_review "${FLAGGED_COUNT}" \
    --argjson errors "${ERROR_COUNT}" \
    --argjson items "${ITEMS_JSON}" \
    '{
      agent_id: $agent_id,
      org: $org,
      mode: $mode,
      cycle_started_at: $cycle_started_at,
      cycle_completed_at: $cycle_completed_at,
      repos_scanned: $repos_scanned,
      prs_evaluated: $prs_evaluated,
      summary: {
        auto_merged: 0,
        flagged_for_review: $flagged_for_review,
        closed_stale_conflict: 0,
        skipped: 0,
        errors: $errors
      },
      items: $items,
      markdown_report: $markdown_report
    }')"

  if [ -n "${DASHBOARD_API_URL:-}" ] && [ -n "${DASHBOARD_AUTH_TOKEN:-}" ] && [ -n "${GATEKEEPER_HMAC_SECRET:-}" ]; then
    if ! retry_with_backoff post_dashboard_report; then
      log_warn "Failed to post report to Fleet Dashboard after retries."
    fi
  elif [ -n "${DASHBOARD_API_URL:-}" ]; then
    log_warn "Dashboard reporting is configured but DASHBOARD_AUTH_TOKEN or GATEKEEPER_HMAC_SECRET is missing."
  fi

  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    if ! retry_with_backoff post_slack_summary; then
      log_warn "Failed to post triage summary to Slack."
    fi
  fi

  log_info "Sleeping ${INTERVAL_SECONDS}s until next cycle..."
  sleep "${INTERVAL_SECONDS}"
done
