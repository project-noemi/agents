#!/usr/bin/env node
/**
 * Per-gate check results for the cross-model reviewer.
 *
 * The reviewer posts its four gate verdicts (premise, framing, code,
 * compliance) in a PR comment, and the "AI Review (advisory)" check succeeds
 * whenever the run completes, even when a gate failed or the run halted for a
 * human. That check therefore cannot gate a merge on the verdicts. This module
 * turns the machine-readable result that scripts/review-pr.js writes into one
 * pass/non-pass decision per gate, plus an overall decision, which the
 * workflow reports as the checks
 *
 *   AI Review (premise)   AI Review (framing)   AI Review (code)
 *   AI Review (compliance)   AI Review (all gates)
 *
 * The rule, enforced here and covered by tests: a gate check succeeds ONLY
 * when that gate's verdict is exactly `pass` in a completed, non-dry-run
 * review of the head commit the check is reported for. A failed, skipped,
 * overridden or missing verdict is not a pass. So is a review that halted for
 * human review, errored, timed out, was cancelled or reviewed another commit.
 * The overall check succeeds only when all four gate checks succeed.
 *
 * USAGE (CI)
 *   node scripts/review-gate-checks.js --result <file> --halt-file <file> \
 *     --expected-head <sha> --outcome <steps.review.outcome>
 * Prints one line of JSON: { premise: {ok, message}, ..., all: {ok, message} }.
 * It exits 0 whenever it could evaluate, including when every gate is a
 * non-pass, and 2 on a usage error.
 */

'use strict';

const fs = require('fs');

/** Gate ids, in review order. Must match GATES in scripts/review-pr.js. */
const GATE_IDS = ['premise', 'framing', 'code', 'compliance'];
/** Key of the overall decision in the evaluation output. */
const ALL_KEY = 'all';
/** Version of the result file written by review-pr.js. */
const RESULT_SCHEMA = 1;
const SHA_RE = /^[0-9a-f]{40}$/;

/**
 * The record review-pr.js writes to REVIEW_RESULT_FILE after a completed
 * review. Only verdict strings and the reviewed head SHA. It holds no
 * findings text, so nothing model-generated reaches a check message.
 * @param {{ gates: Record<string, {verdict: string}>, headSha: string, dryRun?: boolean }} input
 */
function buildGateResult({ gates, headSha, dryRun = false }) {
  return {
    schema: RESULT_SCHEMA,
    head_sha: String(headSha || ''),
    dry_run: Boolean(dryRun),
    gates: Object.fromEntries(GATE_IDS.map((id) => [id, (gates && gates[id] && gates[id].verdict) || 'missing'])),
  };
}

/** One line, printable, bounded: safe for a check annotation and a summary. */
function clean(text, max = 300) {
  return String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

function allFail(message) {
  const out = {};
  for (const id of GATE_IDS) out[id] = { ok: false, message: `${id}: ${message}` };
  out[ALL_KEY] = { ok: false, message: `not all gates passed: ${message}` };
  return out;
}

/**
 * Decide each gate check. Every path that is not an exact `pass` for the
 * expected head returns ok: false with a reason.
 * @param {{ result: object|null, expectedHeadSha?: string, haltReason?: string, outcome?: string }} input
 */
function evaluateGateChecks({ result, expectedHeadSha = '', haltReason = '', outcome = '' }) {
  const halt = clean(haltReason);
  if (halt) return allFail(`not a pass: the review halted for human review (${halt})`);
  if (outcome && outcome !== 'success') {
    return allFail(`not a pass: the review step ended as '${clean(outcome, 40)}'`);
  }
  if (!result || typeof result !== 'object') {
    return allFail('not a pass: no gate result (the review did not complete, or the reviewer at this tooling ref does not report per-gate results)');
  }
  if (result.schema !== RESULT_SCHEMA) {
    return allFail(`not a pass: unsupported gate result schema '${clean(result.schema, 20)}'`);
  }
  if (result.dry_run) return allFail('not a pass: dry run, no model was invoked');
  const expected = String(expectedHeadSha || '').toLowerCase();
  const reviewed = String(result.head_sha || '').toLowerCase();
  if (!SHA_RE.test(expected)) return allFail('not a pass: the head commit for this check is unknown');
  if (!SHA_RE.test(reviewed)) return allFail('not a pass: the gate result does not name the reviewed commit');
  if (reviewed !== expected) {
    return allFail(`not a pass: the review covered ${reviewed.slice(0, 12)}, not head ${expected.slice(0, 12)}`);
  }

  const out = {};
  const short = expected.slice(0, 12);
  for (const id of GATE_IDS) {
    const verdict = result.gates && typeof result.gates[id] === 'string' ? result.gates[id] : 'missing';
    out[id] = verdict === 'pass'
      ? { ok: true, message: `${id}: pass for ${short}` }
      : { ok: false, message: `${id}: ${clean(verdict, 40)} for ${short}, which is not a pass` };
  }
  const failing = GATE_IDS.filter((id) => !out[id].ok);
  out[ALL_KEY] = failing.length === 0
    ? { ok: true, message: `all four gates passed for ${short}` }
    : { ok: false, message: `not all gates passed for ${short}: ${failing.map((id) => `${id}=${clean(result.gates && result.gates[id], 40) || 'missing'}`).join(', ')}` };
  return out;
}

function readJson(file) {
  if (!file) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function readText(file) {
  if (!file) return '';
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function parseArgs(argv) {
  const args = { result: '', haltFile: '', expectedHead: '', outcome: '' };
  const flags = { '--result': 'result', '--halt-file': 'haltFile', '--expected-head': 'expectedHead', '--outcome': 'outcome' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = flags[argv[i]];
    if (!key) throw new Error(`unknown argument: ${argv[i]}`);
    args[key] = argv[i + 1] || '';
    i += 1;
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const checks = evaluateGateChecks({
    result: readJson(args.result),
    expectedHeadSha: args.expectedHead,
    haltReason: readText(args.haltFile),
    outcome: args.outcome,
  });
  process.stdout.write(`${JSON.stringify(checks)}\n`);
}

module.exports = {
  GATE_IDS, ALL_KEY, RESULT_SCHEMA, buildGateResult, evaluateGateChecks, parseArgs,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`✖ ${err.message}\n`);
    process.exit(2);
  }
}
