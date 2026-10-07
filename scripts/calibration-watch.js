#!/usr/bin/env node
/**
 * Calibration auto-log (phase-2 evidence engine).
 *
 * WHY AUTOMATION INSTEAD OF DISCIPLINE
 *   docs/reviews/CALIBRATION.md is the only evidence base on which phase 2
 *   (reviewer approvals) can ever be authorized — and after a week of live
 *   reviews it held ZERO entries while at least two clear overrides happened
 *   (#392 merged 14 minutes after a high premise fail, #399 merged 8 minutes
 *   after a high framing fail). Discipline has empirically failed; the log now
 *   writes itself and humans only confirm.
 *
 * WHAT IT DOES
 *   Given a merged PR whose LATEST review verdict was failing (any gate ❌,
 *   request-changes, or escalate), it opens a small PR — authored by
 *   `noemi-agent`, like all agent work — appending a pre-filled row to the
 *   calibration log with Direction/Reason marked PENDING-HUMAN. The human
 *   edits those two cells in the PR and merges; that edit IS the attestation.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   - Judge the override. Direction ("reviewer too strict" vs "too lenient")
 *     is human judgment; the automation only guarantees the question is asked.
 *   - Log carve-out halts: a halt is an escalation to a human, not a verdict a
 *     human can override.
 *   - Log the reverse case (reviewer too lenient, bug found later) — that
 *     cannot be detected mechanically and stays a manual entry.
 *   - Log a merge whose latest verdict failed only the compliance gate.
 *     Following that guidance is the deploying organization's choice
 *     (Decision [2026-10-06-0002]). Premise, framing, and code still log.
 *
 * USAGE (normally invoked by .github/workflows/calibration-watch.yml)
 *   PR_NUMBER=392 GITHUB_REPOSITORY=owner/repo node scripts/calibration-watch.js
 *   Requires a token able to push a branch and open a PR (the noemi-agent
 *   credential, AGENT_GH_TOKEN, resolved via `infisical run`). A fine-grained
 *   token that cannot see the repository (HTTP 404) falls back to
 *   AGENT_GH_TOKEN_CLASSIC, still as noemi-agent. The other direction is
 *   refused: a requested classic path never falls back to AGENT_GH_TOKEN
 *   (Decision [2026-09-24-0002]).
 *
 * EXIT CODES
 *   0 nothing to log (clean verdict, halt, dedup) or entry PR opened
 *   2 configuration/API error
 */

'use strict';

const { execFileSync } = require('node:child_process');

const REVIEWER_LOGINS = ['noemi-reviewer-bot', 'noemi-reviewer'];
const LOG_PATH = 'docs/reviews/CALIBRATION.md';
const LOG_HEADER = '| Date | PR | Model | Gate | Reviewer said | Human did | Direction | Reason |';

// ---------------------------------------------------------------------------
// Pure logic (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Parse a reviewer comment into a verdict. Returns null for comments that are
 * not reviews (or are carve-out halts, which escalate rather than judge).
 */
function parseReviewVerdict(body) {
  if (!body || !body.includes('AI Review')) return null;
  if (body.includes('governance carve-out')) return null;

  const model = (body.match(/\*\*Model:\*\*\s*`([^`]+)`/) || [])[1] || '(unknown)';
  const failedGates = [...body.matchAll(/^\|\s*(premise|framing|code|compliance)\s*\|[^|]*\|\s*❌\s*fail\s*\|/gim)]
    .map((m) => m[1].toLowerCase());

  // First blocking finding: "- **high** · `file` · _gate_ — claim"
  const finding = (body.match(/^- \*\*(critical|high)\*\*[^—\n]*—\s*(.+)$/im) || [])[2] || '';

  return {
    failing: failedGates.length > 0,
    gates: failedGates,
    model,
    claim: finding.trim().slice(0, 140),
  };
}

/**
 * A calibration entry is owed when a substantive gate failed.
 * Compliance alone is the organization's choice and does not open one.
 */
function requiresCalibration(verdict) {
  if (!verdict || !verdict.failing) return false;
  return verdict.gates.some((gate) => gate !== 'compliance');
}

/** Pick the reviewer's LATEST verdict from a PR's comment stream. */
function latestVerdict(comments) {
  let verdict = null;
  for (const c of comments) {
    const login = (c.login || '').replace(/\[bot\]$/, '');
    if (!REVIEWER_LOGINS.includes(login)) continue;
    const parsed = parseReviewVerdict(c.body);
    if (parsed) verdict = parsed; // stream is chronological; keep the last
  }
  return verdict;
}

function buildCalibrationRow({ date, prNumber, verdict }) {
  const clean = (t) => String(t).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
  const said = verdict.claim
    ? `${verdict.gates.join('+')} fail: ${clean(verdict.claim)}`
    : `${verdict.gates.join('+')} gate failed`;
  return `| ${date} | #${prNumber} | ${clean(verdict.model)} | ${verdict.gates[0] || '?'} `
    + `| ${said} | **merged over** | PENDING-HUMAN | PENDING-HUMAN — a human fills Direction and Reason |`;
}

/** Idempotence: an existing row or open entry-branch for this PR means skip. */
function alreadyLogged(logContent, prNumber) {
  return new RegExp(`^\\|[^|]*\\|\\s*#${prNumber}\\s*\\|`, 'm').test(logContent);
}

// ---------------------------------------------------------------------------
// GitHub I/O
// ---------------------------------------------------------------------------

function gh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8', input, timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
}

/** gh reports a hidden or missing repo as "Not Found (HTTP 404)". */
function isRepoNotFound(err) {
  const stderr = err && err.stderr ? String(err.stderr) : '';
  const message = err && err.message ? String(err.message) : '';
  return /HTTP 404\b/.test(`${stderr}\n${message}`);
}

/**
 * Fine-grained PAT stays the default. Classic is only the fallback when that
 * token cannot see the repository. 'fail' means classic is unset.
 */
function tokenAfterRepoProbe({ visible, hasClassic }) {
  if (visible) return 'keep';
  if (hasClassic) return 'classic';
  return 'fail';
}

function repoVisible(repo, call = gh) {
  try {
    call(['api', `repos/${repo}`, '--jq', '.id']);
    return true;
  } catch (err) {
    if (isRepoNotFound(err)) return false;
    throw err;
  }
}

/**
 * Verify that a resolved token login matches the expected agent login.
 * Returns {allowed: boolean, reason: string}.
 */
function verifyTokenLogin(resolvedLogin, expectedLogin) {
  const resolved = String(resolvedLogin || '').trim();
  const expected = String(expectedLogin || 'noemi-agent').trim();
  if (resolved !== expected) {
    return {
      allowed: false,
      reason: `Token resolved to ${resolved}; expected ${expected}. Refusing to open a pull request.`,
    };
  }
  return { allowed: true, reason: '' };
}

/**
 * Point GH_TOKEN at the classic PAT when the fine-grained token 404s.
 * Returns 'fine-grained' or 'classic'. Exits 2 when neither token can see
 * the repo, or when the classic token is not the expected machine user.
 *
 * `io` is the test seam. Production calls use process env, real `gh`, and
 * process.exit. A refused login returns after exit so a stubbed exit cannot
 * fall through into opening a pull request.
 */
function adoptClassicToken(repo, io = {}) {
  const call = io.gh || gh;
  const env = io.env || process.env;
  const exit = io.exit || ((code) => process.exit(code));
  const write = io.write || ((msg) => process.stderr.write(msg));

  const classic = env.AGENT_GH_TOKEN_CLASSIC || '';
  const choice = tokenAfterRepoProbe({ visible: repoVisible(repo, call), hasClassic: classic.length > 0 });
  if (choice === 'keep') return 'fine-grained';
  if (choice === 'fail') {
    write(`✖ Fine-grained token cannot see ${repo} (HTTP 404) and AGENT_GH_TOKEN_CLASSIC is unset.\n`);
    exit(2);
    return;
  }
  if (env.GH_TOKEN === classic) {
    write(`✖ Token cannot see ${repo} (HTTP 404).\n`);
    exit(2);
    return;
  }
  env.GH_TOKEN = classic;
  const login = call(['api', 'user', '--jq', '.login']).trim();
  const expected = String(env.AGENT_GH_EXPECTED_LOGIN || 'noemi-agent').trim();
  const verification = verifyTokenLogin(login, expected);
  if (!verification.allowed) {
    write(`✖ ${verification.reason}\n`);
    exit(2);
    return;
  }
  if (!repoVisible(repo, call)) {
    write(`✖ AGENT_GH_TOKEN_CLASSIC also cannot see ${repo} (HTTP 404).\n`);
    exit(2);
    return;
  }
  write(`Fine-grained token cannot see ${repo}; using AGENT_GH_TOKEN_CLASSIC as ${login}.\n`);
  return 'classic';
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = Number(process.env.PR_NUMBER);
  if (!repo || !prNumber) {
    process.stderr.write('✖ Need GITHUB_REPOSITORY and PR_NUMBER.\n');
    process.exit(2);
  }

  const tokenSource = adoptClassicToken(repo);

  const pr = JSON.parse(gh(['api', `repos/${repo}/pulls/${prNumber}`]));
  if (!pr.merged_at) {
    process.stderr.write(`PR #${prNumber} is not merged — nothing to calibrate.\n`);
    return;
  }

  // Recursion guard: entry PRs are themselves reviewable and CAN legitimately
  // merge over a failing verdict (observed live: #418 merged while the
  // reviewer's framing gate flagged its then-unfilled PENDING-HUMAN row, which
  // spawned meta-entry #420). An entry about an entry records nothing the
  // underlying row does not already record, and each such merge would spawn
  // the next — an unbounded chain. Entries are exempt from generating entries.
  if ((pr.head?.ref || '').startsWith('calibration/')) {
    process.stderr.write(`PR #${prNumber} is itself a calibration entry — entries do not generate entries.\n`);
    return;
  }

  const raw = JSON.parse(gh(['api', `repos/${repo}/issues/${prNumber}/comments?per_page=100`]));
  const verdict = latestVerdict(raw.map((c) => ({ login: c.user?.login || '', body: c.body || '' })));

  if (!verdict) {
    process.stderr.write(`PR #${prNumber}: no reviewer verdict found (halt or no review) — nothing to log.\n`);
    return;
  }
  if (!requiresCalibration(verdict)) {
    const why = verdict.failing
      ? 'only the compliance gate failed — the organization decides whether to comply. No calibration entry.'
      : 'latest verdict passed — merge agrees with the reviewer.';
    process.stderr.write(`PR #${prNumber}: ${why}\n`);
    return;
  }

  // The interesting case: merged over a failing verdict. Log it.
  const branch = `calibration/pr-${prNumber}`;
  const existingLog = JSON.parse(gh(['api', `repos/${repo}/contents/${LOG_PATH}`]));
  const logContent = Buffer.from(existingLog.content, 'base64').toString('utf8');

  if (alreadyLogged(logContent, prNumber)) {
    process.stderr.write(`PR #${prNumber}: calibration row already present — skipping.\n`);
    return;
  }
  try {
    gh(['api', `repos/${repo}/git/ref/heads/${branch}`]);
    process.stderr.write(`PR #${prNumber}: entry branch already open — skipping.\n`);
    return;
  } catch { /* branch absent — proceed */ }

  const date = (pr.merged_at || '').slice(0, 10);
  const row = buildCalibrationRow({ date, prNumber, verdict });

  // Append the row directly under the Log-table header.
  const headerAt = logContent.indexOf(LOG_HEADER, logContent.indexOf('## Log'));
  if (headerAt === -1) {
    process.stderr.write('✖ CALIBRATION.md Log table header not found — format changed?\n');
    process.exit(2);
  }
  const insertAt = logContent.indexOf('\n', logContent.indexOf('\n', headerAt) + 1) + 1;
  const updated = `${logContent.slice(0, insertAt)}${row}\n${logContent.slice(insertAt)}`;

  const baseSha = gh(['api', `repos/${repo}/git/ref/heads/develop`, '--jq', '.object.sha']).trim();
  gh(['api', '--method', 'POST', `repos/${repo}/git/refs`,
    '-f', `ref=refs/heads/${branch}`, '-f', `sha=${baseSha}`]);
  gh(['api', '--method', 'PUT', `repos/${repo}/contents/${LOG_PATH}`,
    '-f', `message=docs(reviews): calibration entry for #${prNumber} (merged over a failing review)`,
    '-f', `content=${Buffer.from(updated).toString('base64')}`,
    '-f', `branch=${branch}`, '-f', `sha=${existingLog.sha}`]);

  const body = [
    `PR #${prNumber} was **merged over a failing review** `
      + `(${verdict.gates.join(', ')} ❌, model \`${verdict.model}\`).`,
    '',
    'This entry is the phase-2 evidence the governance framework requires. To complete the entry:',
    '',
    '1. Edit the row\'s **Direction** cell: `reviewer too strict` / `reviewer too lenient` / `reviewer wrong domain` / `reviewer misinterpreted`.',
    '2. Replace the **Reason** cell with one concrete sentence.',
    '',
    'Merging with PENDING-HUMAN still in the row defeats the log\'s purpose — the edit *is* the attestation.',
  ].join('\n');

  gh(['pr', 'create', '--repo', repo, '--base', 'develop', '--head', branch,
    '--title', `docs(reviews): calibration entry — #${prNumber} merged over a failing review`,
    '--body', body]);

  process.stderr.write(`${JSON.stringify({
    task: 'Calibration auto-log',
    inputs: [`pr=#${prNumber}`, `gates=${verdict.gates.join('+')}`, `model=${verdict.model}`, `token=${tokenSource}`],
    actions: ['detected merge over failing verdict', 'opened calibration entry PR'],
    risks: ['entry awaits human Direction/Reason before it counts as evidence'],
    result: `calibration/pr-${prNumber} opened`,
  })}\n`);
}

module.exports = {
  parseReviewVerdict, latestVerdict, buildCalibrationRow, alreadyLogged, requiresCalibration, REVIEWER_LOGINS,
  isRepoNotFound, tokenAfterRepoProbe, verifyTokenLogin, adoptClassicToken,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`✖ ${err.stack || err.message}\n`);
    process.exit(2);
  });
}
