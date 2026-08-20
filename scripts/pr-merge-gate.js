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
 *   PR_CLOSED          terminal: a human closed the PR. Their closure is a
 *                      decision, not an outage — the gate never reopens it and
 *                      files no escalation (the human already decided)
 *   ALREADY_MERGED     terminal: nothing left to gate
 *   WAIT_CHECKS        checks (or the review) still running — poll again
 *   RETRIGGERED        review was absent and not running; PR was close/reopened
 *                      to re-fire it — poll again
 *   REMEDIATE          review verdict failing, no remediation attempted yet:
 *                      fix per the findings (one round), push, re-run the gate
 *   ARMED_AUTOMERGE    verdict passing + checks green; auto-merge armed —
 *                      a human code-owner approval completes the merge
 *   DRAFT_HELD         terminal: the PR is a draft the machine identity did not
 *                      author, so the gate takes NO action on it — no reopen,
 *                      no remediation order, no escalation issue, no un-drafting.
 *                      A human's not-ready signal outranks automation entirely;
 *                      the author marks it ready when they choose
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

const { latestVerdict, REVIEWER_LOGINS } = require('./calibration-watch.js');

const API = 'https://api.github.com';
const REVIEW_CHECK_NAME = 'Cross-Model PR Review';
/** Verdicts that end the run: --poll must not spin on any of these. */
const TERMINAL_VERDICTS = [
  'ARMED_AUTOMERGE', 'ESCALATED', 'REMEDIATE', 'PR_CLOSED', 'ALREADY_MERGED', 'DRAFT_HELD',
];

const POLL_INTERVAL_MS = 60_000;
const POLL_DEADLINE_MS = 30 * 60_000;

/**
 * The machine identity whose drafts this gate may ready, pinned to the identity
 * register (docs/MACHINE_IDENTITY.md — `noemi-agent`, user id 311935378).
 *
 * DELIBERATELY NOT CONFIGURABLE. Reading these from AGENT_GH_EXPECTED_LOGIN
 * (plus a new AGENT_GH_EXPECTED_ID) was considered and rejected: that variable
 * already means something else — it asserts which account a *token* must
 * resolve to, and the repository documents setting it to `noemi-reviewer` for
 * reviewer flows (docs/MACHINE_IDENTITY.md:141, docs/examples/cross-model-
 * review-setup.md) — so a reviewer-configured session would have silently
 * retargeted, or with a mismatched id wholly disabled, this rule. An
 * environment variable that widens who may override a human's draft signal is
 * a privilege switch, not configuration: changing the identity is a reviewed
 * code change alongside the register.
 *
 * Both the login and the immutable numeric id must agree: logins can be renamed
 * and the freed name reclaimed, so the id is what actually pins the identity
 * (the same reasoning that binds the WIF pool to immutable org ids), while
 * requiring the login too means a stale pin fails closed to DRAFT_HELD rather
 * than silently widening the rule.
 */
const AGENT_LOGIN = 'noemi-agent';
const AGENT_USER_ID = 311935378;

/** @param {{login?: string, id?: number}} user PR author from the REST payload. */
function isAgentAuthored(user) {
  // Number.isInteger is applied to the RAW value, so it rejects string
  // look-alikes on its own ("311935378 " would survive a Number() coercion but
  // fails here) — no separate type check is needed, and none is implied.
  const login = (user?.login || '').toLowerCase();
  return login === AGENT_LOGIN && Number.isInteger(user?.id) && user.id === AGENT_USER_ID;
}

// ---------------------------------------------------------------------------
// Pure decision logic (unit-tested)
// ---------------------------------------------------------------------------

/**
 * @param {object} state
 *   prState: 'open' | 'closed'   merged: boolean
 *   checks: { pending: string[], failing: string[] }  (check names; the review
 *           check itself is EXCLUDED from `failing` — its comment verdict, not
 *           its conclusion, is what judges the PR)
 *   review: null | { failing: boolean, gates: string[], claim: string }
 *   reviewHalted: boolean — the reviewer posted a HALT (carve-out /
 *           sentinel-missing), which is an escalation, not a verdict
 *   reviewCheckRunning: boolean — a review run for the CURRENT head SHA is in
 *           flight
 *   reviewCheckConcluded: 'success' | 'failure' | null — the review run's
 *           conclusion FOR THE CURRENT HEAD SHA (null = no run exists yet)
 *   remediationAttempted: boolean
 *
 * Verdict freshness is SHA-anchored: comments are not tied to commits, so
 * after any push an old verdict still sits on the PR while the new review
 * runs. Judging on it breaks both ways — escalating a remediation before its
 * re-review finishes, or arming auto-merge on unreviewed code from a stale
 * pass. The comment verdict is only trusted when the review check for the
 * current head SHA concluded 'success' (its comment cannot post before that
 * run completes, and a successful run has posted it).
 */
function decideVerdict(state) {
  const {
    prState, merged, checks, review, reviewHalted,
    reviewCheckRunning, reviewCheckConcluded, remediationAttempted,
    draft, agentAuthored,
  } = state;

  // PR state precedes every heuristic. A human-closed PR looks exactly like an
  // outage to the retrigger logic (checks cancelled → no review, nothing
  // running), and "re-fire the reviewer" is implemented as close/REOPEN — so
  // without this check the gate would reopen a PR a human deliberately
  // rejected. A human's closure is a decision, not an outage: terminal, no
  // reopen, no escalation issue (the human already decided).
  if (merged) {
    return { verdict: 'ALREADY_MERGED', reason: 'PR is already merged — nothing to gate' };
  }
  if (prState !== 'open') {
    return { verdict: 'PR_CLOSED', reason: 'a human closed this PR; the gate stops and never reopens it' };
  }

  // Someone else's draft is hands-off ENTIRELY, which is why this sits with the
  // PR-state checks rather than beside the arming step: draft is the author's
  // "not ready" declaration, and every downstream branch of this function
  // authorizes an intrusive act on the pull request — RETRIGGERED close/reopens
  // it, REMEDIATE orders an agent to push commits onto it, ESCALATED files a
  // public issue against it, ARMED_AUTOMERGE takes it out of draft. Guarding
  // only the last of those would still leave automation editing and publicly
  // escalating a person's work in progress. The machine identity's own drafts
  // are process artifacts and continue through every branch as before (the
  // scheduled Doc run opens its PRs as drafts, though those are owner-authored
  // until the machine token is injected — docs/REQUIREMENTS.md, §7 gap).
  if (draft && !agentAuthored) {
    return {
      verdict: 'DRAFT_HELD',
      reason: 'PR is a draft authored by someone other than the machine identity — '
        + 'the author\'s not-ready signal stands; the gate takes no action on it at all',
    };
  }

  // Hard-red checks escalate regardless of the review: a failing test suite is
  // not something the remediation round is licensed to "fix" by weakening.
  if (checks.failing.length > 0) {
    return {
      verdict: 'ESCALATED',
      reason: `checks failing: ${checks.failing.join(', ')}`,
    };
  }

  // A review in flight for THIS SHA suspends all verdict reading: whatever
  // comment exists belongs to an older commit.
  if (reviewCheckRunning) {
    return { verdict: 'WAIT_CHECKS', reason: 'review for the current commit still running' };
  }

  // No successful review run for THIS SHA means the comment channel is stale
  // or empty for it: either no run exists yet, or the run died before posting
  // (the outage class). Never judge on a stale verdict — re-fire instead.
  if (reviewCheckConcluded !== 'success') {
    return {
      verdict: 'RETRIGGERED',
      reason: reviewCheckConcluded === 'failure'
        ? 'the review run for this commit failed before posting a verdict'
        : 'no review run exists for this commit',
    };
  }

  // A halt is the reviewer escalating to a human (carve-out, missing Sentinel
  // brief) — retriggering would loop forever, and merging would bypass the
  // escalation. Terminal.
  if (reviewHalted) {
    return { verdict: 'ESCALATED', reason: 'the reviewer halted (carve-out or missing brief) — human review required' };
  }

  if (review === null) {
    // Successful run, no halt, yet no parseable verdict — a contract change in
    // the comment format. A human should look rather than the gate guessing.
    return { verdict: 'ESCALATED', reason: 'review run succeeded but no verdict could be parsed — comment format drift?' };
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

/**
 * EXACT origin validation for reviewer comments, sharing the canonical login
 * list with the calibration watch — one source of truth, because two copies
 * drift. A substring test here was a critical review finding: any user whose
 * login merely CONTAINED "noemi-reviewer" (fake-noemi-reviewer-bot) could
 * spoof authoritative halts and grief every PR into permanent escalation.
 */
function isReviewerLogin(login) {
  return REVIEWER_LOGINS.includes(String(login || '').replace(/\[bot\]$/, ''));
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

/**
 * Fetch every page of a collection. The repository's GitHub protocol mandates
 * pagination on all API responses, and this gate is a case study in why: issue
 * comments return OLDEST-first, so past 100 comments an unpaginated fetch
 * silently drops the LATEST review verdict — and the gate judges the PR on a
 * stale or missing verdict.
 */
async function apiAll(pathBase, pick) {
  const items = [];
  for (let page = 1; page <= 50; page += 1) {
    const sep = pathBase.includes('?') ? '&' : '?';
    const batch = pick(await api(`${pathBase}${sep}per_page=100&page=${page}`));
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

async function collectState(repo, prNumber, remediationAttempted) {
  const pr = await api(`/repos/${repo}/pulls/${prNumber}`);
  const checkRuns = await apiAll(
    `/repos/${repo}/commits/${pr.head.sha}/check-runs`,
    (body) => body.check_runs || [],
  );

  const pending = [];
  const failing = [];
  let reviewCheckRunning = false;
  let reviewCheckConcluded = null;
  for (const run of checkRuns) {
    if (run.name === REVIEW_CHECK_NAME) {
      // Check-runs are fetched for pr.head.sha, so these signals are anchored
      // to the CURRENT commit — the freshness anchor the comments lack.
      if (run.status !== 'completed') reviewCheckRunning = true;
      else reviewCheckConcluded = run.conclusion === 'success' ? 'success' : 'failure';
      continue;
    }
    if (run.status !== 'completed') pending.push(run.name);
    else if (!['success', 'neutral', 'skipped'].includes(run.conclusion)) failing.push(run.name);
  }

  const comments = await apiAll(`/repos/${repo}/issues/${prNumber}/comments`, (body) => body);
  const normalized = comments.map((c) => ({ login: c.user?.login || '', body: c.body || '' }));
  const review = latestVerdict(normalized);
  // The reviewer's LATEST comment being a halt means the newest judgment is
  // "a human must look" — verdicts from earlier rounds do not override it.
  const reviewerComments = normalized.filter((c) => isReviewerLogin(c.login));
  const last = reviewerComments[reviewerComments.length - 1];
  const reviewHalted = Boolean(last && last.body.includes('AI review halted'));

  return {
    pr,
    state: {
      prState: pr.state,
      merged: Boolean(pr.merged),
      checks: { pending, failing },
      review,
      reviewHalted,
      reviewCheckRunning,
      reviewCheckConcluded,
      remediationAttempted,
      draft: Boolean(pr.draft),
      agentAuthored: isAgentAuthored(pr.user),
    },
  };
}

async function retriggerReview(repo, prNumber) {
  // AGENT_GH_TOKEN has no Actions:write, so workflow_dispatch is unavailable.
  // Close + reopen re-fires the `pull_request` [reopened] trigger the reviewer
  // subscribes to. Safe here: auto-merge is not yet armed at this point.
  await api(`/repos/${repo}/pulls/${prNumber}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
  await api(`/repos/${repo}/pulls/${prNumber}`, { method: 'PATCH', body: JSON.stringify({ state: 'open' }) });
}

async function graphql(query, variables, label) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(`${label}: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return body.data;
}

async function armAutoMerge(repo, pr) {
  // GraphQL refuses to arm auto-merge on a draft ("Pull request is a draft",
  // hit live on PR #435 — scheduled Doc-run PRs open as drafts). For the
  // machine identity's OWN drafts, a passing verdict plus green checks is
  // exactly the state "ready for review" claims, so the gate readies it rather
  // than escalating a solved state.
  //
  // The authorship condition is re-checked HERE, at the mutation itself, and
  // not merely upstream in decideVerdict: this function is exported, so the
  // guarantee "automation never un-drafts someone else's pull request" must
  // hold for any caller, not only for one that happens to consult the verdict
  // first. Refusing loudly beats silently readying a person's work in progress.
  const isDraft = Boolean(pr.draft);
  if (isDraft && !isAgentAuthored(pr.user)) {
    throw new Error(
      `refusing to ready draft PR #${pr.number} for auto-merge: authored by `
      + `'${pr.user?.login || '(unknown)'}', not the machine identity — draft is the author's signal`
    );
  }
  if (isDraft) {
    await graphql(
      'mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ clientMutationId } }',
      { id: pr.node_id },
      'markPullRequestReadyForReview'
    );
  }
  await graphql(
    'mutation($id:ID!){ enablePullRequestAutoMerge(input:{pullRequestId:$id, mergeMethod:MERGE}){ clientMutationId } }',
    { id: pr.node_id },
    'enablePullRequestAutoMerge'
  );
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
      // A draft reaching ARMED is agent-authored (DRAFT_HELD intercepts every
      // other draft), and armAutoMerge re-verifies that for itself.
      await armAutoMerge(repo, pr);
    }
    if (verdict === 'ESCALATED') {
      await fileEscalation(repo, prNumber, reason, state.review);
    }

    const terminal = TERMINAL_VERDICTS.includes(verdict);
    if (terminal || !poll || Date.now() > deadline) {
      process.stderr.write(`${JSON.stringify({
        task: 'PR merge gate',
        inputs: [`pr=#${prNumber}`, `remediation_attempted=${remediationAttempted}`],
        actions: [retriggered ? 'retriggered review via close/reopen' : 'no retrigger needed', `verdict=${verdict}`],
        risks: verdict === 'ARMED_AUTOMERGE' ? ['merge completes on human approval']
          : verdict === 'DRAFT_HELD' ? ['a green PR waits indefinitely until its author marks it ready']
            : [],
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

module.exports = {
  decideVerdict, apiAll, isReviewerLogin, isAgentAuthored, armAutoMerge, collectState,
  REVIEW_CHECK_NAME, TERMINAL_VERDICTS,
};

if (require.main === module) {
  main().catch((err) => {
    // Message only, never the stack: fail securely (Sentinel brief). Stacks
    // leak runner paths and internal state into public CI logs, and the
    // message already carries the actionable part (method, path, status).
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(2);
  });
}
