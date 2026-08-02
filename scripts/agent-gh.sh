#!/usr/bin/env bash
# Run `gh` as the NoéMI machine identity instead of the signed-in human.
#
# WHY THIS EXISTS
#   GitHub blocks a pull request's author from approving it. When an agent
#   opens a PR using a human's `gh` credentials, the PR is authored by that
#   human — who then cannot review it, collapsing the human-reviews-AI control
#   into either self-approval (impossible) or an admin bypass (no control at
#   all). Routing agent-initiated writes through a distinct machine identity
#   keeps the producer and the reviewer separate, which is what makes the
#   approval gate a real 4D Diligence control rather than a formality.
#
#   Note that commit metadata is NOT sufficient. `git config user.email` and
#   `Co-Authored-By:` trailers change who *wrote the commits*; GitHub's
#   self-approval check looks only at who *opened the PR* — i.e. the identity
#   of the token used here.
#
# USAGE
#   bash scripts/agent-gh.sh pr create --base develop --title "..." --body "..."
#   bash scripts/agent-gh.sh api repos/:owner/:repo/pulls
#   bash scripts/agent-gh.sh whoami          # verify which identity resolves
#
# TOKEN RESOLUTION (first hit wins)
#   1. $AGENT_GH_TOKEN already in the environment (e.g. inside `infisical run`)
#   2. Infisical:  secret named $AGENT_GH_TOKEN_SECRET (default AGENT_GH_TOKEN)
#   3. 1Password:  reference in $AGENT_GH_TOKEN_REF
#
#   The token is never written to disk, never echoed, and is passed to `gh`
#   only through the process environment, per the repository's
#   Fetch-on-Demand rule (AGENTS.md).
#
# See docs/MACHINE_IDENTITY.md for provisioning and least-privilege scoping.

set -euo pipefail

SECRET_NAME="${AGENT_GH_TOKEN_SECRET:-AGENT_GH_TOKEN}"
INFISICAL_ENVIRONMENT="${INFISICAL_ENV:-dev}"
OP_REF="${AGENT_GH_TOKEN_REF:-op://noemi/github-agent/token}"

log() { printf '%s\n' "$*" >&2; }

resolve_token() {
  if [[ -n "${AGENT_GH_TOKEN:-}" ]]; then
    printf '%s' "$AGENT_GH_TOKEN"
    return 0
  fi

  if command -v infisical >/dev/null 2>&1; then
    local val
    if val=$(infisical secrets get "$SECRET_NAME" \
               --env="$INFISICAL_ENVIRONMENT" --plain 2>/dev/null) \
       && [[ -n "$val" ]]; then
      printf '%s' "$val"
      return 0
    fi
  fi

  if command -v op >/dev/null 2>&1; then
    local val
    if val=$(op read "$OP_REF" 2>/dev/null) && [[ -n "$val" ]]; then
      printf '%s' "$val"
      return 0
    fi
  fi

  return 1
}

if ! token=$(resolve_token); then
  log "✖ Could not resolve the machine-identity token."
  log "  Tried: \$AGENT_GH_TOKEN, Infisical secret '${SECRET_NAME}' (env=${INFISICAL_ENVIRONMENT}), 1Password '${OP_REF}'."
  log "  Provision it per docs/MACHINE_IDENTITY.md, then re-run."
  log "  Do NOT paste the token into a chat session or commit it to the repo."
  exit 1
fi

# `whoami` is a local convenience verb, not a gh subcommand.
if [[ "${1:-}" == "whoami" ]]; then
  GH_TOKEN="$token" gh api user --jq '"\(.login) (\(.type))"'
  exit 0
fi

if [[ $# -eq 0 ]]; then
  log "✖ No gh command given. Example:"
  log "    bash scripts/agent-gh.sh pr create --base develop --title ... --body ..."
  exit 1
fi

# Guard against the failure this script exists to prevent: if the machine
# token silently falls back to a human account, the resulting PR would again
# be unreviewable by that human. Fail loudly instead.
actor=$(GH_TOKEN="$token" gh api user --jq '.login' 2>/dev/null || true)
if [[ -z "$actor" ]]; then
  log "✖ Machine token was rejected by GitHub (expired, revoked, or wrong scopes)."
  exit 1
fi
if [[ -n "${AGENT_GH_EXPECTED_LOGIN:-}" && "$actor" != "$AGENT_GH_EXPECTED_LOGIN" ]]; then
  log "✖ Token resolves to '${actor}', expected '${AGENT_GH_EXPECTED_LOGIN}'."
  log "  Refusing to act — this would author agent work under the wrong identity."
  exit 1
fi

log "→ acting as: ${actor}"
GH_TOKEN="$token" exec gh "$@"
