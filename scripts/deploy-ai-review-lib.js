#!/usr/bin/env node
/**
 * Pure helpers for scripts/deploy-ai-review.sh. Kept in Node so the
 * issue-URL and branch-preference rules are unit-tested, not just grepped.
 *
 * CLI:
 *   node deploy-ai-review-lib.js pick-branch [names...]
 *     → integration branch (develop, else dev, else empty)
 *   node deploy-ai-review-lib.js   <  gh-issue-list.json
 *     → first http(s) issue URL, or empty. Never prints the JSON
 *       literal `null` — that is how `jq '.[0].url'` lies when the list is empty.
 */
'use strict';

function pickIntegrationBranch(names) {
  const set = new Set(Array.isArray(names) ? names : []);
  if (set.has('develop')) return 'develop';
  if (set.has('dev')) return 'dev';
  return '';
}

/**
 * First usable issue URL from `gh issue list --json url` (or jq's `.[0].url`).
 * Empty list, missing url, JSON `null`, and the literal string "null" are
 * all "no existing issue" — not a URL.
 */
function firstIssueUrl(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed || trimmed === 'null') return '';
    if (/^https?:\/\//.test(trimmed) && !trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return trimmed;
    }
    try {
      payload = JSON.parse(trimmed);
    } catch {
      return '';
    }
  }
  if (payload === null) return '';
  const url = Array.isArray(payload) ? payload[0] && payload[0].url : payload.url;
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || !/^https?:\/\//.test(trimmed)) return '';
  return trimmed;
}

module.exports = { firstIssueUrl, pickIntegrationBranch };

if (require.main === module) {
  const fs = require('fs');
  if (process.argv[2] === 'pick-branch') {
    process.stdout.write(pickIntegrationBranch(process.argv.slice(3)));
  } else {
    process.stdout.write(firstIssueUrl(fs.readFileSync(0, 'utf8')));
  }
}
