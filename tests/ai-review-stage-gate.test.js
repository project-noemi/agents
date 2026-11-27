const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    STAGE_GATES, stageCheckKey, isStageCheckName, evaluateStageGate, parseArgs, main,
} = require('../scripts/ai-review-stage-gate.js');

// An automatic merge may proceed only when the per-stage AI review checks for
// the head commit say all four gates passed. Everything else fails closed.

const actions = { slug: 'github-actions' };
let nextId = 1;
const run = (name, conclusion, extra = {}) => ({
    id: nextId++, name, status: conclusion === null ? 'in_progress' : 'completed', conclusion, app: actions, ...extra,
});
const allFour = (conclusion = 'success', prefix = '') => STAGE_GATES.map((g) => run(`${prefix}AI Review (${g})`, conclusion));

test('check names: bare and caller-prefixed per-stage names match; others do not', () => {
    assert.equal(stageCheckKey('AI Review (premise)'), 'premise');
    assert.equal(stageCheckKey('review / AI Review (all gates)'), 'all gates');
    assert.equal(stageCheckKey('AI Review / AI Review (compliance)'), 'compliance');
    for (const name of ['AI Review (advisory)', 'AI Review (fork notice)', 'AI Review (result)', 'AI Review (Premise)', 'AI Review (premise) ', 'xAI Review (code)', 'Cross-Model PR Review']) {
        assert.equal(isStageCheckName(name), false, name);
    }
});

test('all gates success (with four passing stages) is a pass', () => {
    const r = evaluateStageGate([...allFour(), run('AI Review (all gates)', 'success'), run('AI Review (advisory)', 'success')]);
    assert.equal(r.state, 'pass');
    assert.equal(r.pass, true);
});

test('all four stage checks success without the overall check is a pass; under a caller prefix too', () => {
    assert.equal(evaluateStageGate(allFour()).state, 'pass');
    assert.equal(evaluateStageGate([...allFour('success', 'review / '), run('review / AI Review (all gates)', 'success')]).state, 'pass');
});

test('any non-success conclusion fails closed', () => {
    for (const c of ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required', 'stale', '']) {
        const runs = [...allFour(), run('AI Review (all gates)', 'success')];
        runs[2] = run('AI Review (code)', c);
        const r = evaluateStageGate(runs);
        assert.equal(r.state, 'fail', c);
        assert.equal(r.pass, false, c);
        assert.match(r.reason, /AI Review \(code\)=/);
    }
});

test('a halted review (all gate checks failed, advisory green) is not a pass', () => {
    const r = evaluateStageGate([run('AI Review (advisory)', 'success'), ...allFour('failure'), run('AI Review (all gates)', 'failure')]);
    assert.equal(r.state, 'fail');
});

test('running checks are pending; no checks or a partial set is missing', () => {
    assert.equal(evaluateStageGate([...allFour(), run('AI Review (all gates)', null)]).state, 'pending');
    assert.equal(evaluateStageGate([]).state, 'missing');
    assert.equal(evaluateStageGate([run('AI Review (advisory)', 'success')]).state, 'missing');
    assert.equal(evaluateStageGate(allFour().slice(0, 3)).state, 'missing');
    assert.equal(evaluateStageGate(null).state, 'missing');
});

test('the latest run of a check wins (re-runs), in both directions', () => {
    const failedThenPassed = [run('AI Review (all gates)', 'failure'), ...allFour(), run('AI Review (all gates)', 'success')];
    assert.equal(evaluateStageGate(failedThenPassed).state, 'pass');
    const passedThenFailed = [...allFour(), run('AI Review (all gates)', 'success'), run('AI Review (all gates)', 'failure')];
    assert.equal(evaluateStageGate(passedThenFailed).state, 'fail');
});

test('look-alike checks from another app are ignored, so they cannot open the gate', () => {
    const spoof = [...STAGE_GATES, 'all gates'].map((g) => run(`AI Review (${g})`, 'success', { app: { slug: 'some-other-app' } }));
    assert.equal(evaluateStageGate(spoof).state, 'missing');
    assert.equal(evaluateStageGate([...spoof, run('AI Review (all gates)', 'failure')]).state, 'fail');
});

test('parseArgs validates input and rejects unknown flags', () => {
    assert.deepEqual(parseArgs(['--repo', 'o/r', '--pr', '12', '--wait-seconds', '60']),
        { repo: 'o/r', pr: '12', sha: '', waitSeconds: 60, intervalSeconds: 30 });
    assert.throws(() => parseArgs(['--repo', 'o/r']), /exactly one of --pr or --sha/);
    assert.throws(() => parseArgs(['--repo', 'o/r', '--pr', '1', '--sha', 'a'.repeat(40)]), /exactly one/);
    assert.throws(() => parseArgs(['--repo', 'o/r', '--sha', 'abc']), /40-character/);
    assert.throws(() => parseArgs(['--repo', 'bad', '--pr', '1']), /owner\/name/);
    assert.throws(() => parseArgs(['--repo', 'o/r', '--pr', '1', '--merge']), /unknown argument/);
});

async function withFetch(responder, fn) {
    const savedFetch = global.fetch;
    const savedToken = process.env.GH_TOKEN;
    const savedWrite = process.stdout.write;
    const out = [];
    process.env.GH_TOKEN = 'test-token';
    global.fetch = async (url) => {
        const body = responder(String(url));
        return { ok: true, status: 200, json: async () => body };
    };
    process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
    try {
        const code = await fn();
        return { code, out: JSON.parse(out.join('').trim()) };
    } finally {
        process.stdout.write = savedWrite;
        global.fetch = savedFetch;
        if (savedToken === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = savedToken;
    }
}

test('main: exit 0 only on pass, judged on the PR head commit', async () => {
    const head = 'd'.repeat(40);
    const seen = [];
    const pass = await withFetch((url) => {
        seen.push(url);
        if (url.endsWith('/pulls/7')) return { head: { sha: head } };
        return { check_runs: [...allFour(), run('AI Review (all gates)', 'success')] };
    }, () => main(['--repo', 'o/r', '--pr', '7']));
    assert.equal(pass.code, 0);
    assert.equal(pass.out.sha, head);
    assert.ok(seen.some((u) => u.includes(`/commits/${head}/check-runs`)));

    const fail = await withFetch((url) => (url.endsWith('/pulls/7')
        ? { head: { sha: head } }
        : { check_runs: [run('AI Review (advisory)', 'success'), ...allFour('failure')] }), () => main(['--repo', 'o/r', '--pr', '7']));
    assert.equal(fail.code, 1);
    assert.equal(fail.out.pass, false);

    const missing = await withFetch(() => ({ check_runs: [] }), () => main(['--repo', 'o/r', '--sha', head]));
    assert.equal(missing.code, 1);
    assert.equal(missing.out.state, 'missing');
});

test('release workflow gates the promotion merge on the stage gate and fails closed', () => {
    const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/release.yml'), 'utf8');
    const promote = yml.slice(yml.indexOf('- name: Open promotion PR'), yml.indexOf('STEP 3b'));
    // The gate script comes from develop (the same line as this workflow), and its absence fails closed.
    assert.match(promote, /git show origin\/develop:scripts\/ai-review-stage-gate\.js/);
    assert.match(promote, /node "\$GATE_JS" --repo "\$GITHUB_REPOSITORY" --pr "\$PR_NUM"/);
    // The merge is bound to the head commit the gate judged.
    const mergeLines = promote.split('\n').filter((l) => /gh pr merge "\$PR_NUM"/.test(l) && !/--disable-auto/.test(l));
    assert.ok(mergeLines.length > 0);
    for (const l of mergeLines) assert.match(l, /--match-head-commit "\$GATE_SHA"/, l);
    // Every merge call comes after the gate.
    assert.ok(promote.indexOf('node "$GATE_JS"') < promote.indexOf('gh pr merge "$PR_NUM" --repo "$GITHUB_REPOSITORY" --merge'));
    // Not met: disarm any earlier auto-merge, leave the PR open, say why.
    assert.match(promote, /--disable-auto/);
    assert.match(promote, /gh pr comment "\$PR_NUM"/);
    assert.doesNotMatch(promote, /gh pr close/);
    // The schedule is unchanged.
    assert.match(yml, /- cron: "0 6 \* \* \*"/);
});

test('fleet gated-merge template runs the gate before any merge', () => {
    const tpl = fs.readFileSync(path.join(__dirname, '..', 'templates/ci/ai-review-gated-merge.yml'), 'utf8');
    assert.match(tpl, /node ai-review-stage-gate\.js --repo "\$GITHUB_REPOSITORY" --pr "\$PR_NUMBER"/);
    assert.match(tpl, /--match-head-commit "\$GATE_SHA"/);
    assert.ok(tpl.indexOf('ai-review-stage-gate.js --repo') < tpl.indexOf('gh pr merge "$PR_NUMBER" --auto'));
    assert.doesNotMatch(tpl.replace(/#.*$/gm, ''), /secrets: inherit|workflow_dispatch/);
});

test('the stage gate is a governance file (carve-out)', () => {
    const { CARVE_OUT, detectCarveOut } = require('../scripts/review-pr.js');
    assert.ok(CARVE_OUT.includes('scripts/ai-review-stage-gate.js'));
    assert.deepEqual(detectCarveOut(['scripts/ai-review-stage-gate.js']), ['scripts/ai-review-stage-gate.js']);
});
