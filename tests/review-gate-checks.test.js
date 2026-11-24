const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
    GATE_IDS, ALL_KEY, RESULT_SCHEMA, buildGateResult, evaluateGateChecks, parseArgs,
} = require('../scripts/review-gate-checks.js');
const { GATES, CARVE_OUT, writeGateResult, detectCarveOut } = require('../scripts/review-pr.js');

// A gate check may succeed ONLY on an exact `pass` for the expected head
// commit. Every other path must be ok: false. These tests pin that rule.

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const verdicts = (v) => Object.fromEntries(GATE_IDS.map((id) => [id, { verdict: v[id] }]));
const allPass = () => buildGateResult({ gates: verdicts({ premise: 'pass', framing: 'pass', code: 'pass', compliance: 'pass' }), headSha: HEAD });
const ok = (checks) => Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v.ok]));

test('gate ids match the reviewer GATES, in order', () => {
    assert.deepEqual(GATE_IDS, GATES.map((g) => g.id));
});

test('buildGateResult keeps only verdicts and the head SHA', () => {
    const r = buildGateResult({
        gates: { premise: { verdict: 'pass', rationale: 'secret-looking text' }, framing: { verdict: 'fail' } },
        headSha: HEAD,
    });
    assert.deepEqual(r, {
        schema: RESULT_SCHEMA, head_sha: HEAD, dry_run: false,
        gates: { premise: 'pass', framing: 'fail', code: 'missing', compliance: 'missing' },
    });
    assert.doesNotMatch(JSON.stringify(r), /secret-looking/);
});

test('all four pass on the expected head: every check succeeds', () => {
    const c = evaluateGateChecks({ result: allPass(), expectedHeadSha: HEAD, outcome: 'success' });
    assert.deepEqual(ok(c), { premise: true, framing: true, code: true, compliance: true, [ALL_KEY]: true });
});

test('fail, skipped, overridden and missing verdicts are not a pass; all gates fails', () => {
    const result = buildGateResult({
        gates: verdicts({ premise: 'pass', framing: 'overridden', code: 'fail', compliance: 'skipped' }), headSha: HEAD,
    });
    const c = evaluateGateChecks({ result, expectedHeadSha: HEAD, outcome: 'success' });
    assert.deepEqual(ok(c), { premise: true, framing: false, code: false, compliance: false, [ALL_KEY]: false });
    assert.match(c.code.message, /fail .*not a pass/);
    assert.match(c[ALL_KEY].message, /framing=overridden, code=fail, compliance=skipped/);
    const missing = evaluateGateChecks({ result: { ...allPass(), gates: { premise: 'pass' } }, expectedHeadSha: HEAD });
    assert.equal(missing.framing.ok, false);
    assert.equal(missing[ALL_KEY].ok, false);
});

test('only the exact string pass counts', () => {
    for (const v of ['PASS', 'passed', ' pass', 'ok', true, 1, null]) {
        const result = { ...allPass(), gates: { ...allPass().gates, premise: v } };
        const c = evaluateGateChecks({ result, expectedHeadSha: HEAD });
        assert.equal(c.premise.ok, false, String(v));
        assert.equal(c[ALL_KEY].ok, false, String(v));
    }
});

test('halt for human review, even after all-pass verdicts, is a non-pass for every gate', () => {
    const c = evaluateGateChecks({
        result: allPass(), expectedHeadSha: HEAD, outcome: 'success', haltReason: 'carve-out: .github/workflows/ai-review.yml\n',
    });
    assert.ok(Object.values(c).every((x) => x.ok === false));
    assert.match(c.premise.message, /halted for human review \(carve-out: \.github\/workflows\/ai-review\.yml\)/);
});

test('error, timeout and cancellation of the review step are non-passes', () => {
    for (const outcome of ['failure', 'cancelled', 'skipped']) {
        const c = evaluateGateChecks({ result: allPass(), expectedHeadSha: HEAD, outcome });
        assert.ok(Object.values(c).every((x) => x.ok === false), outcome);
        assert.match(c.code.message, new RegExp(`ended as '${outcome}'`));
    }
});

test('no result, a bad schema or a dry run is a non-pass', () => {
    for (const result of [null, undefined, 'x', { ...allPass(), schema: 2 }, { ...allPass(), dry_run: true }]) {
        const c = evaluateGateChecks({ result, expectedHeadSha: HEAD, outcome: 'success' });
        assert.ok(Object.values(c).every((x) => x.ok === false), JSON.stringify(result));
    }
});

test('a review of another commit, or an unknown head, is a non-pass', () => {
    const stale = evaluateGateChecks({ result: allPass(), expectedHeadSha: OTHER, outcome: 'success' });
    assert.ok(Object.values(stale).every((x) => x.ok === false));
    assert.match(stale.premise.message, /covered aaaaaaaaaaaa, not head bbbbbbbbbbbb/);
    for (const expectedHeadSha of ['', 'abc123', undefined]) {
        const c = evaluateGateChecks({ result: allPass(), expectedHeadSha });
        assert.ok(Object.values(c).every((x) => x.ok === false));
    }
    const noSha = evaluateGateChecks({ result: { ...allPass(), head_sha: '' }, expectedHeadSha: HEAD });
    assert.ok(Object.values(noSha).every((x) => x.ok === false));
});

test('messages are single-line and bounded', () => {
    const c = evaluateGateChecks({ result: null, haltReason: `x\n::error::y\r${'z'.repeat(1000)}` });
    for (const v of Object.values(c)) {
        assert.doesNotMatch(v.message, /[\r\n]/);
        assert.ok(v.message.length < 400);
    }
});

test('CLI prints the evaluation and rejects unknown arguments', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-checks-'));
    const resultFile = path.join(dir, 'result.json');
    fs.writeFileSync(resultFile, JSON.stringify(allPass()));
    const script = path.join(__dirname, '..', 'scripts', 'review-gate-checks.js');
    const run = spawnSync(process.execPath, [script, '--result', resultFile, '--halt-file', path.join(dir, 'none'), '--expected-head', HEAD, '--outcome', 'success'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout)[ALL_KEY].ok, true);
    const haltFile = path.join(dir, 'halt');
    fs.writeFileSync(haltFile, 'carve-out: scripts/review-pr.js\n');
    const halted = spawnSync(process.execPath, [script, '--result', resultFile, '--halt-file', haltFile, '--expected-head', HEAD, '--outcome', 'success'], { encoding: 'utf8' });
    assert.equal(JSON.parse(halted.stdout)[ALL_KEY].ok, false);
    const missing = spawnSync(process.execPath, [script, '--result', path.join(dir, 'absent.json'), '--expected-head', HEAD], { encoding: 'utf8' });
    assert.equal(JSON.parse(missing.stdout).premise.ok, false);
    const bad = spawnSync(process.execPath, [script, '--nope'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.throws(() => parseArgs(['--approve']), /unknown argument/);
});

test('review-pr.js writes the gate result only when REVIEW_RESULT_FILE is set', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-result-'));
    const dest = path.join(dir, 'result.json');
    const saved = process.env.REVIEW_RESULT_FILE;
    try {
        delete process.env.REVIEW_RESULT_FILE;
        assert.equal(writeGateResult({ gates: verdicts({ premise: 'pass' }), headSha: HEAD }), false);
        process.env.REVIEW_RESULT_FILE = dest;
        assert.equal(writeGateResult({ gates: verdicts({ premise: 'pass', framing: 'pass', code: 'pass', compliance: 'fail' }), headSha: HEAD }), true);
        const written = JSON.parse(fs.readFileSync(dest, 'utf8'));
        assert.equal(written.head_sha, HEAD);
        assert.equal(written.gates.compliance, 'fail');
        assert.equal(evaluateGateChecks({ result: written, expectedHeadSha: HEAD })[ALL_KEY].ok, false);
    } finally {
        if (saved === undefined) delete process.env.REVIEW_RESULT_FILE; else process.env.REVIEW_RESULT_FILE = saved;
    }
});

test('the gate decision logic is a governance file (carve-out)', () => {
    assert.ok(CARVE_OUT.includes('scripts/review-gate-checks.js'));
    assert.deepEqual(detectCarveOut(['scripts/review-gate-checks.js']), ['scripts/review-gate-checks.js']);
});

test('workflow: per-gate jobs always run, report exact names, and hold no token permissions', () => {
    const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/ai-review.yml'), 'utf8');
    // Existing check names are unchanged (backward compatibility for required checks).
    assert.match(yml, /\n {4}name: AI Review \(advisory\)\n/);
    assert.match(yml, /\n {4}name: AI Review \(fork notice\)\n/);
    const advisory = yml.slice(yml.indexOf('\n  advisory:'), yml.indexOf('\n  gate:'));
    assert.match(advisory, /gate_checks: \$\{\{ steps\.gatecheck\.outputs\.checks \}\}/);
    assert.match(advisory, /export REVIEW_RESULT_FILE="\$RUNNER_TEMP\/ai-review-result\.json"/);
    assert.match(advisory, /name: Evaluate per-gate results\n\s+id: gatecheck\n\s+if: always\(\)/);
    assert.match(advisory, /EVENT_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    // An older tooling ref without the script yields non-passes, never passes.
    assert.match(advisory, /\[\[ -f scripts\/review-gate-checks\.js \]\]/);
    assert.match(advisory, /checks='\{\}'/);

    const gate = yml.slice(yml.indexOf('\n  gate:'), yml.indexOf('\n  all-gates:'));
    assert.match(gate, /name: AI Review \(\$\{\{ matrix\.gate \}\}\)/);
    assert.match(gate, /gate: \[premise, framing, code, compliance\]/);
    assert.match(gate, /needs: advisory\n\s+if: always\(\)/);
    assert.match(gate, /permissions: \{\}/);
    assert.match(gate, /fail-fast: false/);
    assert.match(gate, /"\$ok" == true && "\$ADVISORY_RESULT" == success/);

    const all = yml.slice(yml.indexOf('\n  all-gates:'));
    assert.match(all, /name: AI Review \(all gates\)/);
    assert.match(all, /needs: \[advisory, gate\]\n\s+if: always\(\)/);
    assert.match(all, /permissions: \{\}/);
    assert.match(all, /"\$ok" == true && "\$ADVISORY_RESULT" == success && "\$GATE_RESULT" == success/);
    // No new trigger was added.
    assert.doesNotMatch(yml.slice(yml.indexOf('\non:'), yml.indexOf('\npermissions:')), /schedule|push:/);
});

test('caller template and governance doc name the new checks', () => {
    const caller = fs.readFileSync(path.join(__dirname, '..', 'templates/ci/ai-review-caller.yml'), 'utf8');
    const gov = fs.readFileSync(path.join(__dirname, '..', 'docs/AI_REVIEW_GOVERNANCE.md'), 'utf8');
    for (const name of [...GATE_IDS, 'all gates']) {
        assert.ok(caller.includes(`review / AI Review (${name})`), name);
        assert.ok(gov.includes(`"AI Review (${name})"`), name);
    }
    // The caller grants no new permission: the gate jobs need none.
    assert.match(caller, /permissions:\n\s+contents: read\n\s+pull-requests: write\n\s+id-token: write\n?$/);
});
