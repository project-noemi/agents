#!/bin/sh
set -eu

if [ "$#" -eq 0 ]; then
  echo "Usage: scripts/retry-with-backoff.sh <command> [args...]" >&2
  exit 64
fi

attempt=1
max_attempts="${RETRY_MAX_ATTEMPTS:-5}"
delay_seconds="${RETRY_INITIAL_DELAY_SECONDS:-1}"
max_delay_seconds="${RETRY_MAX_DELAY_SECONDS:-16}"

while true; do
  if "$@"; then
    exit 0
  fi

  exit_code=$?
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Command failed after ${attempt} attempt(s): $*" >&2
    exit "$exit_code"
  fi

  echo "Transient failure (exit ${exit_code}). Retrying in ${delay_seconds}s: $*" >&2
  sleep "$delay_seconds"

  attempt=$((attempt + 1))
  delay_seconds=$((delay_seconds * 2))
  if [ "$delay_seconds" -gt "$max_delay_seconds" ]; then
    delay_seconds="$max_delay_seconds"
  fi
done
