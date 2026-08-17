#!/usr/bin/env node
/**
 * PR merge gate for scheduled agent sessions (Decision [2026-08-17-0002]).
 *
 * WHY
 *   The scheduled Doc run merged its own PRs by admin bypass — zero approvals,
 *   no review verdict consulted — which the Admin Override Watch (rightly)
 *   flags daily. This gate replaces that with a governed finish: the session
 *   may proceed only when the cross-model review VERDICT is passing and every
 *   check is green, and even then it does not merge — it ARMS AUTO-MERGE, so
 *   the merge completes only when a human code-owner approves. Failing
 *   verdicts get exactly one agent remediation round before escalating to a
 *   human.
 *
 * DESIGNED FOR THE SANDBOX IT RUNS IN
 *   The scheduled session has Node and outbound HTTPS but no `gh`, no vault
 *   CLI (see docs/MACHINE_IDENTITY.md, scheduled-session env contract). So:
 *   raw GitHub REST/GraphQL via fetch; AGENT_GH_TOKEN from process memory.
 *   Two consequences shape the mechanics:
 *   - AGENT_GH_TOKEN has no `Actions: write`, so a missing review cannot be
 *     re-dispatched via workflow_dispatch. Re-trigger is CLOSE + REOPEN of the
 *     PR, which re-fires the `pull_request` events the reviewer listens to.
 *   - `noemi-agent` may merge nothing (identity register). Arming auto-merge
 *     is the scoped exception this decision grants: the arm is mechanical,
 *     the human approval is what completes the merge.
 *
 * VERDICTS (stdout JSON, one per invocation; exit != 0 only on infra failure)
 *   WAIT_CHECKS        checks (or the review) still running — poll again
 *   RETRIGGERED        review was absent and not running; PR was close/reopened
 *                      to re-fire it — poll again
 *   REMEDIATE          review verdict failing, no remediation attempted yet:
 *                      fix per the findings (one round), push, re-run the gate
 *   ARMED_AUTOMERGE    verdict passing + checks green; auto-merge armed —
 *                      a human code-owner approval completes the merge
 *   ESCALATED          terminal: red checks, second failing review, or an
 *                      unexpected state — an escalation issue was filed;
 *                      do NOT merge, do NOT retry
 *
 * USAGE (from the scheduled session)
 *   AGENT_GH_TOKEN=... GITHUB_REPOSITORY=owner/repo \
 *     node scripts/pr-merge-gate.js --pr 123 [--remediation-attempted] [--poll]
 *
 *   --poll re-checks every 60s for up to 30 minutes before returning a
 *   non-terminal verdict as-is. --remediation-attempted marks that the one
 *   permitted fix round already happened; a still-failing review escalates.
 */

'use strict';

const { parseReviewVerdict, latestVerdict } = require('./calibration-watch.js');

const API = 'https://api.github.com';
const REVIEW_CHECK_NAME = 'Cross-Model PR Review';
const POLL_INTERVAL_MS = 60_000;
const POLL_DEADLINE_MS = 30 * 60_000;

// ---------------------------------------------------------------------------
// Pure decision logic (unit-tested)
// ---------------------------------------------------------------------------

/**
 * @param {object} state
 *   checks: { pending: string[], failing: string[] }  (check names; the review
 *           check itself is EXCLUDED from `failing` — its comment verdict, not
 *           its conclusion, is what judges the PR)
 *   review: null | { failing: boolean, gates: string[], claim: string }
 *   reviewCheckRunning: boolean
 *   remediationAttempted: boolean
 */
function decideVerdict(state) {
  const { checks, review, reviewCheckRunning, remediationAttempted } = state;

  // Hard-red checks escalate regardless of the review: a failing test suite is
  // not something the remediation round is licensed to "fix" by weakening.
  if (checks.failing.length > 0) {
    return {
      verdict: 'ESCALATED',
      reason: `checks failing: ${checks.failing.join(', ')}`,
    };
  }

  if (review === null) {
    if (reviewCheckRunning || checks.pending.length > 0) {
      return { verdict: 'WAIT_CHECKS', reason: 'review/checks still running' };
    }
    // No verdict, nothing running — the outage case. Re-fire the reviewer.
    return { verdict: 'RETRIGGERED', reason: 'no review verdict and no review run in flight' };
  }

  if (review.failing) {
    if (remediationAttempted) {
      return {
        verdict: 'ESCALATED',
        reason: `review still failing after the one permitted remediation round `
          + `(gates: ${review.gates.join(', ')})`,
      };
    }
    return {
      verdict: 'REMEDIATE',
      reason: `review failing (gates: ${review.gates.join(', ')}) — one fix round permitted`,
    };
  }

  if (checks.pending.length > 0) {
    return { verdict: 'WAIT_CHECKS', reason: `pending: ${checks.pending.join(', ')}` };
  }

  return { verdict: 'ARMED_AUTOMERGE', reason: 'review passing and all checks green' };
}

// ---------------------------------------------------------------------------
// GitHub I/O (raw fetch — the sandbox has no gh CLI)
// ---------------------------------------------------------------------------

function token() {
  const t = process.env.AGENT_GH_TOKEN;
  if (!t) {
    process.stderr.write('✖ AGENT_GH_TOKEN not set (see docs/MACHINE_IDENTITY.md, scheduled-session env contract).\n');
    process.exit(2);
  }
  return t;
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function collectState(repo, prNumber, remediationAttempted) {
  const pr = await api(`/repos/${repo}/pulls/${prNumber}`);
  const runs = await api(`/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`);

  const pending = [];
  const failing = [];
  let reviewCheckRunning = false;
  for (const run of runs.check_runs || []) {
    if (run.name === REVIEW_CHECK_NAME) {
      if (run.status !== 'completed') reviewCheckRunning = true;
      // The review check's conclusion is deliberately not a failure signal:
      // the comment verdict is the judgment; a red review check is infra.
      if (run.status === 'completed' && run.conclusion === 'failure') {
        reviewCheckRunning = false;
      }
      continue;
    }
    if (run.status !== 'completed') pending.push(run.name);
    else if (!['success', 'neutral', 'skipped'].includes(run.conclusion)) failing.push(run.name);
  }

  const comments = await api(`/repos/${repo}/issues/${prNumber}/comments?per_page=100`);
  const review = latestVerdict(comments.map((c) => ({
    login: c.user?.login || '', body: c.body || '',
  })));

  return {
    pr,
    state: { checks: { pending, failing }, review, reviewCheckRunning, remediationAttempted },
  };
}

async function retriggerReview(repo, prNumber) {
  // AGENT_GH_TOKEN has no Actions:write, so workflow_dispatch is unavailable.
  // Close + reopen re-fires the `pull_request` [reopened] trigger the reviewer
  // subscribes to. Safe here: auto-merge is not yet armed at this point.
  await api(`/repos/${repo}/pulls/${prNumber}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
  await api(`/repos/${repo}/pulls/${prNumber}`, { method: 'PATCH', body: JSON.stringify({ state: 'open' }) });
}

async function armAutoMerge(repo, prId) {
  const query = `mutation($id:ID!){ enablePullRequestAutoMerge(input:{pullRequestId:$id, mergeMethod:MERGE}){ clientMutationId } }`;
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: prId } }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(`enablePullRequestAutoMerge: ${JSON.stringify(body.errors).slice(0, 300)}`);
}

async function fileEscalation(repo, prNumber, reason, review) {
  const title = `Doc-run escalation: PR #${prNumber} needs a human`;
  const body = [
    `The scheduled session's merge gate escalated PR #${prNumber}.`,
    '',
    `**Reason:** ${reason}`,
    review && review.failing
      ? `\n**Last review verdict:** failing (${review.gates.join(', ')})${review.claim ? ` — ${review.claim}` : ''}`
      : '',
    '',
    'Per Decision [2026-08-17-0002] the session performed at most one remediation',
    'round and is not permitted to merge, bypass, or retry further. A human',
    'decides: fix, merge over (the calibration log will record it), or close.',
  ].filter(Boolean).join('\n');
  await api(`/repos/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels: ['doc-run-escalation'] }),
  });
}

async function main() {
  const args = process.argv.slice(2);
  const prNumber = Number(args[args.indexOf('--pr') + 1]);
  const remediationAttempted = args.includes('--remediation-attempted');
  const poll = args.includes('--poll');
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !prNumber) {
    process.stderr.write('✖ Need GITHUB_REPOSITORY and --pr <number>.\n');
    process.exit(2);
  }

  const deadline = Date.now() + POLL_DEADLINE_MS;
  let retriggered = false;

  for (;;) {
    const { pr, state } = await collectState(repo, prNumber, remediationAttempted);
    let { verdict, reason } = decideVerdict(state);

    // One retrigger per gate invocation; a second absence is an outage worth a human.
    if (verdict === 'RETRIGGERED') {
      if (retriggered) {
        verdict = 'ESCALATED';
        reason = 'review absent even after a re-trigger — reviewer pipeline appears down';
      } else {
        await retriggerReview(repo, prNumber);
        retriggered = true;
        reason = 'review was absent; PR close/reopened to re-fire it';
      }
    }

    if (verdict === 'ARMED_AUTOMERGE') {
      await armAutoMerge(repo, pr.node_id);
    }
    if (verdict === 'ESCALATED') {
      await fileEscalation(repo, prNumber, reason, state.review);
    }

    const terminal = ['ARMED_AUTOMERGE', 'ESCALATED', 'REMEDIATE'].includes(verdict);
    if (terminal || !poll || Date.now() > deadline) {
      process.stderr.write(`${JSON.stringify({
        task: 'PR merge gate',
        inputs: [`pr=#${prNumber}`, `remediation_attempted=${remediationAttempted}`],
        actions: [retriggered ? 'retriggered review via close/reopen' : 'no retrigger needed', `verdict=${verdict}`],
        risks: verdict === 'ARMED_AUTOMERGE' ? ['merge completes on human approval'] : [],
        result: reason,
      })}\n`);
      process.stdout.write(`${JSON.stringify({
        verdict, reason, review: state.review, pending: state.checks.pending, failing: state.checks.failing,
      }, null, 2)}\n`);
      return;
    }
    await new Promise((r) => { setTimeout(r, POLL_INTERVAL_MS); });
  }
}

module.exports = { decideVerdict, REVIEW_CHECK_NAME };

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.stack || err.message}\n`);
    process.exit(2);
  });
}
