#!/bin/bash
set -euo pipefail

# Gatekeeper PR Triage Agent — Entrypoint
# Runs on a configurable interval, triaging PRs across the organization.
# Requires: GH_TOKEN, GATEKEEPER_ORG
# Optional: GATEKEEPER_REPOS, GATEKEEPER_DRY_RUN, GATEKEEPER_INTERVAL_HOURS,
#           SLACK_WEBHOOK_URL, DASHBOARD_API_URL, DASHBOARD_AUTH_TOKEN

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GATEKEEPER_ORG:?GATEKEEPER_ORG is required}"

INTERVAL_SECONDS=$(( ${GATEKEEPER_INTERVAL_HOURS:-4} * 3600 ))
DRY_RUN="${GATEKEEPER_DRY_RUN:-true}"

echo "Gatekeeper starting: org=${GATEKEEPER_ORG} interval=${GATEKEEPER_INTERVAL_HOURS:-4}h dry_run=${DRY_RUN}"

while true; do
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Starting triage cycle..."

  # Authenticate with GitHub CLI
  echo "${GH_TOKEN}" | gh auth login --with-token 2>/dev/null

  # List repos (filtered or all)
  if [ -n "${GATEKEEPER_REPOS:-}" ]; then
    REPOS=$(echo "${GATEKEEPER_REPOS}" | tr ',' '\n')
  else
    REPOS=$(gh repo list "${GATEKEEPER_ORG}" --no-archived --json name -q '.[].name' --limit 200)
  fi

  REPORT="# Gatekeeper Triage Report\n**Cycle:** $(date -u +%Y-%m-%dT%H:%M:%SZ)\n**Org:** ${GATEKEEPER_ORG}\n**Mode:** $([ "${DRY_RUN}" = "true" ] && echo "DRY RUN" || echo "LIVE")\n\n"
  PR_COUNT=0

  for REPO in ${REPOS}; do
    OPEN_PRS=$(gh pr list --repo "${GATEKEEPER_ORG}/${REPO}" --state open --json number,title,author,mergeable,reviewDecision,statusCheckRollup,changedFiles,additions,deletions,labels,updatedAt 2>/dev/null || echo "[]")

    if [ "${OPEN_PRS}" = "[]" ] || [ -z "${OPEN_PRS}" ]; then
      continue
    fi

    REPORT="${REPORT}## ${REPO}\n"

    echo "${OPEN_PRS}" | jq -c '.[]' | while read -r PR; do
      PR_NUM=$(echo "${PR}" | jq -r '.number')
      PR_TITLE=$(echo "${PR}" | jq -r '.title')
      PR_COUNT=$((PR_COUNT + 1))
      REPORT="${REPORT}- #${PR_NUM}: ${PR_TITLE}\n"
      echo "  Triaging ${GATEKEEPER_ORG}/${REPO}#${PR_NUM}: ${PR_TITLE}"
    done
  done

  echo -e "${REPORT}" > /tmp/triage-report.md
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Triage cycle complete. PRs scanned: ${PR_COUNT}"

  # Post report to Fleet Dashboard (InfluxDB) if configured
  if [ -n "${DASHBOARD_API_URL:-}" ] && [ -n "${DASHBOARD_AUTH_TOKEN:-}" ]; then
    curl -sf --max-time 30 "${DASHBOARD_API_URL}" \
      -H "Authorization: Token ${DASHBOARD_AUTH_TOKEN}" \
      -H "Content-Type: text/plain" \
      -d "cycle_report,agent_id=gatekeeper,org=${GATEKEEPER_ORG} pr_count=${PR_COUNT}i $(date +%s%N)" \
      || echo "Warning: Failed to post report to Fleet Dashboard"
  fi

  # Post summary to Slack if configured
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    SLACK_MSG=$(printf '{"text":"Gatekeeper triage complete for %s: %d PRs scanned. Mode: %s"}' \
      "${GATEKEEPER_ORG}" "${PR_COUNT}" "$([ "${DRY_RUN}" = "true" ] && echo "DRY RUN" || echo "LIVE")")
    curl -sf --max-time 30 -X POST "${SLACK_WEBHOOK_URL}" \
      -H 'Content-Type: application/json' \
      -d "${SLACK_MSG}" \
      || echo "Warning: Failed to post to Slack"
  fi

  echo "Sleeping ${INTERVAL_SECONDS}s until next cycle..."
  sleep "${INTERVAL_SECONDS}"
done
