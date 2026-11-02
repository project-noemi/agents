const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateLayerCompliance } = require('../scripts/layer_compliance');
const {
    APPETITE_EXAMPLE,
    evaluatePreferenceOverrides,
    loadAppetite,
    matchAppetite,
    preferenceRules,
    runCli
} = require('../scripts/layer_diff');

const repoRoot = path.join(__dirname, '..');
const BASELINE = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
const EXAMPLE_APPETITE = path.join(repoRoot, APPETITE_EXAMPLE);

function withRepo(files, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noemi-layer-diff-'));
    const all = { 'AGENTS.md': BASELINE, ...files };
    try {
        for (const [rel, content] of Object.entries(all)) {
            fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), content, 'utf8');
        }
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function twoLayers(msp, acme) {
    return {
        'AGENTS.layers': 'org/msp/AGENTS.md\norg/acme/AGENTS.md\n',
        'org/msp/AGENTS.md': `${msp.join('\n')}\n`,
        'org/acme/AGENTS.md': `${acme.join('\n')}\n`
    };
}

function cli(dir, argv, env = {}) {
    let stdout = '';
    let stderr = '';
    const status = runCli({
        repoRoot: dir,
        env,
        argv,
        stdout: { write: (chunk) => { stdout += chunk; return true; } },
        stderr: { write: (chunk) => { stderr += chunk; return true; } }
    });
    return { status, stdout, stderr };
}

test('preference rules come from the baseline tags and exclude core rules', () => {
    const ids = [...preferenceRules(repoRoot)].sort();
    assert.deepEqual(ids, ['coding.branch-naming', 'coding.model-baseline', 'coding.naming-conventions']);
});

test('upstream checkout has no preference overrides and the example appetite loads', () => {
    const result = evaluatePreferenceOverrides({ repoRoot, env: {} });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.overrides, []);
    const appetite = loadAppetite(EXAMPLE_APPETITE, repoRoot);
    assert.deepEqual(appetite.failOn, [{ rule: 'coding.branch-naming', action: 'relax' }]);
});

test('the later layer wins and the earlier override is marked superseded', () => {
    withRepo(twoLayers(
        ['- MSP gateway. <!-- override: coding.model-baseline relax -->'],
        ['- Keep the pin. <!-- override: coding.model-baseline tighten -->']
    ), (dir) => {
        const { overrides } = evaluatePreferenceOverrides({ repoRoot: dir, env: {} });
        assert.deepEqual(overrides.map((o) => [o.where, o.action, o.wins, o.supersededBy]), [
            ['org/msp/AGENTS.md:1', 'relax', false, 'org/acme/AGENTS.md:1'],
            ['org/acme/AGENTS.md:1', 'tighten', true, null]
        ]);
    });
});

test('AGENTS.local.md is evaluated last and NOEMI_ORG_LAYERS replaces the manifest', () => {
    withRepo({
        ...twoLayers(['<!-- override: coding.branch-naming relax -->'], []),
        'org/ci/AGENTS.md': '<!-- override: coding.naming-conventions relax -->\n',
        'AGENTS.local.md': '<!-- override: coding.branch-naming tighten -->\n'
    }, (dir) => {
        const manifest = evaluatePreferenceOverrides({ repoRoot: dir, env: {} });
        assert.equal(manifest.overrides.find((o) => o.wins).layer, 'AGENTS.local.md');
        const session = evaluatePreferenceOverrides({ repoRoot: dir, env: { NOEMI_ORG_LAYERS: 'org/ci/AGENTS.md' } });
        assert.deepEqual(session.overrides.map((o) => o.layer), ['org/ci/AGENTS.md', 'AGENTS.local.md']);
    });
});

test('core-rule, unknown, and malformed markers are left to layer_compliance.js', () => {
    withRepo(twoLayers([
        '- x <!-- override: secrets.no-hardcode relax -->',
        '- x <!-- override: refusal.principle clarify -->',
        '- x <!-- override: coding.unknown-rule relax -->',
        '<!-- override: coding.branch-naming -->',
        '- x <!-- override: coding.branch-naming loosen -->'
    ], []), (dir) => {
        assert.deepEqual(evaluatePreferenceOverrides({ repoRoot: dir, env: {} }).overrides, []);
        const levels = evaluateLayerCompliance({ repoRoot: dir, env: {} }).findings.map((f) => f.level);
        assert.ok(levels.includes('FAIL'), 'the audit still FAILs the core relaxation');
    });
});

test('appetite file rejects core rules and untagged rule IDs', () => {
    withRepo({
        'core.json': JSON.stringify({ version: 1, failOn: [{ rule: 'secrets.no-hardcode', action: 'relax' }] }),
        'unknown.json': JSON.stringify({ version: 1, failOn: [{ rule: 'coding.unknown-rule' }] }),
        'action.json': JSON.stringify({ version: 1, failOn: [{ rule: 'coding.branch-naming', action: 'loosen' }] })
    }, (dir) => {
        assert.throws(() => loadAppetite(path.join(dir, 'core.json'), dir), /core rule.*npm run audit/);
        assert.throws(() => loadAppetite(path.join(dir, 'unknown.json'), dir), /not a preference rule/);
        assert.throws(() => loadAppetite(path.join(dir, 'action.json'), dir), /unknown action/);
        assert.equal(cli(dir, ['--appetite=core.json']).status, 2);
    });
});

test('appetite matches only the winning override', () => {
    const appetite = { failOn: [{ rule: 'coding.branch-naming', action: 'relax' }] };
    withRepo(twoLayers(
        ['<!-- override: coding.branch-naming relax -->'],
        ['<!-- override: coding.branch-naming tighten -->']
    ), (dir) => {
        assert.deepEqual(matchAppetite(evaluatePreferenceOverrides({ repoRoot: dir, env: {} }), appetite), []);
    });
    withRepo(twoLayers(
        ['<!-- override: coding.branch-naming tighten -->'],
        ['<!-- override: coding.branch-naming relax -->']
    ), (dir) => {
        const matches = matchAppetite(evaluatePreferenceOverrides({ repoRoot: dir, env: {} }), appetite);
        assert.deepEqual(matches.map((m) => m.where), ['org/acme/AGENTS.md:1']);
    });
});

test('CLI: default exit 0; --fail-on-appetite exits 1 on a match, 0 otherwise, 2 without a file', () => {
    withRepo(twoLayers([], ['- Free-form branches. <!-- override: coding.branch-naming relax -->']), (dir) => {
        const report = cli(dir, []);
        assert.equal(report.status, 0, report.stderr);
        assert.match(report.stdout, /org\/acme\/AGENTS\.md:1 {2}coding\.branch-naming {2}relax {2}\(wins\)/);
        assert.match(report.stdout, /npm run audit/);

        const failing = cli(dir, ['--fail-on-appetite', `--appetite=${EXAMPLE_APPETITE}`]);
        assert.equal(failing.status, 1, failing.stderr);
        assert.match(failing.stdout, /MATCH {2}org\/acme\/AGENTS\.md:1 {2}coding\.branch-naming relax/);

        assert.equal(cli(dir, ['--fail-on-appetite']).status, 2);
        fs.copyFileSync(EXAMPLE_APPETITE, path.join(dir, 'AGENTS.appetite.json'));
        assert.equal(cli(dir, ['--fail-on-appetite']).status, 1, 'AGENTS.appetite.json is the default path');
    });
    withRepo(twoLayers([], ['<!-- override: coding.model-baseline relax -->']), (dir) => {
        const passing = cli(dir, ['--fail-on-appetite', `--appetite=${EXAMPLE_APPETITE}`]);
        assert.equal(passing.status, 0, passing.stderr);
        assert.match(passing.stdout, /No winning override matches failOn/);
    });
});

test('CLI exits 2 on a malformed manifest or an unknown argument', () => {
    withRepo({ 'AGENTS.layers': '../outside.md\n' }, (dir) => {
        assert.equal(cli(dir, []).status, 2);
    });
    assert.equal(cli(repoRoot, ['--nope']).status, 2);
});
