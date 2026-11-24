#!/usr/bin/env node
/**
 * AI review stage gate for automatic merge paths.
 *
 * WHY
 *   Automatic merges (the daily develop -> main promotion, the scheduled-session
 *   merge gate, fleet sync and Dependabot auto-merge) used to proceed on green
 *   CI alone. The "AI Review (advisory)" check is green whenever the review run
 *   completes, including when a gate failed or the reviewer halted for a human,
 *   so green CI let unreviewed changes merge (2026-11-24 audit: promotions #771,
 *   #783 and #788; newpush/crm-private#5).
 *
 *   The shared reviewer now reports one check per gate (project-noemi/agents
 *   #805): "AI Review (premise)", "(framing)", "(code)", "(compliance)" and
 *   "AI Review (all gates)". Each succeeds only on an exact `pass` for the
 *   head commit. This module is the single place where an automatic merge path
 *   asks "may this head commit merge?"
 *
 * RULE (fail closed)
 *   PASS only when, among check runs created by GitHub Actions for the head
 *   commit, the latest "AI Review (all gates)" run concluded `success` (or, if
 *   that check is absent, the latest run of each of the four gate checks
 *   concluded `success`), and no latest per-gate run concluded anything else.
 *   Every other state is not a pass:
 *     FAIL     a gate check concluded failure, cancelled, timed_out, skipped,
 *              neutral, action_required, stale or anything other than success
 *     PENDING  a gate check is queued or in progress
 *     MISSING  no gate checks for this commit (reviewer not run, or a tooling
 *              ref older than #805)
 *   Names may carry a reusable-workflow caller prefix ("review / AI Review
 *   (code)"). Only check runs from the `github-actions` app count, so a check
 *   with a look-alike name from another integration cannot open the gate.
 *
 * USAGE (CI)
 *   GH_TOKEN=... node scripts/ai-review-stage-gate.js --repo owner/name \
 *     (--pr N | --sha SHA) [--wait-seconds 600] [--interval-seconds 30]
 *   Prints one line of JSON {state, pass, sha, reason}. Exit 0 = PASS,
 *   1 = not a pass (FAIL, PENDING after the wait, MISSING), 2 = usage or API
 *   error (also not a pass). Callers merge only on exit 0.
 */

'use strict';

const API = 'https://api.github.com';
const STAGE_GATES = ['premise', 'framing', 'code', 'compliance'];
const ALL_GATES = 'all gates';
const STAGE_CHECK_RE = /^(?:.+ \/ )?AI Review \((premise|framing|code|compliance|all gates)\)$/;
const ACTIONS_APP_SLUG = 'github-actions';
const SHA_RE = /^[0-9a-f]{40}$/;

/** @returns {string|null} the gate key ('premise' … 'all gates') or null. */
function stageCheckKey(name) {
  const m = STAGE_CHECK_RE.exec(String(name || ''));
  return m ? m[1] : null;
}

function isStageCheckName(name) {
  return stageCheckKey(name) !== null;
}

/**
 * Decide the gate from the check runs of ONE commit (the head SHA).
 * @param {Array<{id?: number, name: string, status: string, conclusion: string|null, app?: {slug?: string}}>} checkRuns
 * @returns {{state: 'pass'|'fail'|'pending'|'missing', pass: boolean, reason: string, failing: string[], pending: string[]}}
 */
function evaluateStageGate(checkRuns) {
  const latest = new Map();
  for (const run of Array.isArray(checkRuns) ? checkRuns : []) {
    if (!run || !isStageCheckName(run.name)) continue;
    if ((run.app && run.app.slug) !== ACTIONS_APP_SLUG) continue;
    const prev = latest.get(run.name);
    if (!prev || Number(run.id || 0) > Number(prev.id || 0)) latest.set(run.name, run);
  }

  const failing = [];
  const pending = [];
  const passed = new Set();
  for (const [name, run] of latest) {
    if (run.status !== 'completed') pending.push(name);
    else if (run.conclusion !== 'success') failing.push(`${name}=${run.conclusion || 'none'}`);
    else passed.add(stageCheckKey(name));
  }
  failing.sort();
  pending.sort();

  if (failing.length) {
    return { state: 'fail', pass: false, reason: `AI review stage checks not passing: ${failing.join(', ')}`, failing, pending };
  }
  if (pending.length) {
    return { state: 'pending', pass: false, reason: `AI review stage checks still running: ${pending.join(', ')}`, failing, pending };
  }
  if (latest.size === 0) {
    return { state: 'missing', pass: false, reason: 'no AI review stage checks for this commit (the reviewer did not run, or it predates per-stage checks)', failing, pending };
  }
  if (passed.has(ALL_GATES) || STAGE_GATES.every((g) => passed.has(g))) {
    return { state: 'pass', pass: true, reason: 'AI Review (all gates) passed for this commit', failing, pending };
  }
  const absent = [ALL_GATES, ...STAGE_GATES].filter((g) => !passed.has(g));
  return { state: 'missing', pass: false, reason: `incomplete AI review stage checks; absent: ${absent.join(', ')}`, failing, pending };
}

// ---------------------------------------------------------------------------
// GitHub I/O (raw fetch; no gh dependency)
// ---------------------------------------------------------------------------

async function api(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function listCheckRuns(repo, sha, token) {
  const runs = [];
  for (let page = 1; page <= 20; page += 1) {
    const body = await api(`/repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}`, token);
    const batch = body.check_runs || [];
    runs.push(...batch);
    if (batch.length < 100) break;
  }
  return runs;
}

function parseArgs(argv) {
  const args = { repo: '', pr: '', sha: '', waitSeconds: 0, intervalSeconds: 30 };
  const flags = { '--repo': 'repo', '--pr': 'pr', '--sha': 'sha', '--wait-seconds': 'waitSeconds', '--interval-seconds': 'intervalSeconds' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = flags[argv[i]];
    if (!key) throw new Error(`unknown argument: ${argv[i]}`);
    const value = argv[i + 1] || '';
    args[key] = ['waitSeconds', 'intervalSeconds'].includes(key) ? Number(value) : value;
    i += 1;
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(args.repo)) throw new Error('--repo owner/name is required');
  if (!args.pr === !args.sha) throw new Error('give exactly one of --pr or --sha');
  if (args.pr && !/^\d+$/.test(args.pr)) throw new Error('--pr must be a number');
  if (args.sha && !SHA_RE.test(args.sha)) throw new Error('--sha must be a full 40-character commit SHA');
  if (!Number.isFinite(args.waitSeconds) || args.waitSeconds < 0) throw new Error('--wait-seconds must be >= 0');
  if (!Number.isFinite(args.intervalSeconds) || args.intervalSeconds < 1) throw new Error('--interval-seconds must be >= 1');
  return args;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN (or GITHUB_TOKEN) is required');
  const deadline = Date.now() + args.waitSeconds * 1000;
  let result;
  let sha = args.sha;
  for (;;) {
    if (args.pr) {
      // Re-read the head each round: a push during the wait moves the gate to
      // the new commit, never lets an older commit's pass stand for it.
      const pr = await api(`/repos/${args.repo}/pulls/${args.pr}`, token);
      sha = pr.head && pr.head.sha;
      if (!SHA_RE.test(String(sha || ''))) throw new Error('could not resolve the pull request head commit');
    }
    result = evaluateStageGate(await listCheckRuns(args.repo, sha, token));
    const waitable = result.state === 'pending' || result.state === 'missing';
    if (!waitable || Date.now() + args.intervalSeconds * 1000 > deadline) break;
    await new Promise((r) => { setTimeout(r, args.intervalSeconds * 1000); });
  }
  process.stdout.write(`${JSON.stringify({ state: result.state, pass: result.pass, sha, reason: result.reason })}\n`);
  return result.pass ? 0 : 1;
}

module.exports = {
  STAGE_GATES, ALL_GATES, ACTIONS_APP_SLUG, stageCheckKey, isStageCheckName, evaluateStageGate, parseArgs, main,
};

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((err) => {
    // Message only: no stack, no token. Any error is "not a pass".
    process.stdout.write(`${JSON.stringify({ state: 'error', pass: false, reason: String(err.message).slice(0, 300) })}\n`);
    process.exit(2);
  });
}
