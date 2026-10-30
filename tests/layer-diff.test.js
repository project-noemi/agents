const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    APPETITE_EXAMPLE,
    RULE_CATALOG,
    applyAppetite,
    auditAppetiteExample,
    auditRuleCatalog,
    evaluateLayerDiff,
    loadAppetite,
    parseBaselineRules,
    parseOverrides,
    runCli
} = require('../scripts/layer_diff');

const repoRoot = path.join(__dirname, '..');
const BASELINE = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');

function fixtureRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noemi-layer-diff-'));
    const all = { 'AGENTS.md': BASELINE, ...files };
    for (const [rel, content] of Object.entries(all)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), content, 'utf8');
    }
    return dir;
}

function evaluate(files) {
    const dir = fixtureRepo(files);
    try {
        return evaluateLayerDiff({ repoRoot: dir, env: {} });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function acmeLayer(lines) {
    return { 'AGENTS.layers': 'org/acme/AGENTS.md\n', 'org/acme/AGENTS.md': `${lines.join('\n')}\n` };
}

function captureCli(dir, argv, extraEnv = {}) {
    let stdout = '';
    let stderr = '';
    const status = runCli({
        repoRoot: dir,
        env: { ...extraEnv },
        argv,
        stdout: { write: (chunk) => { stdout += chunk; return true; } },
        stderr: { write: (chunk) => { stderr += chunk; return true; } }
    });
    return { status, stdout, stderr };
}

test('baseline AGENTS.md tags every catalogued rule ID', () => {
    const { rules, errors } = parseBaselineRules(BASELINE);
    assert.deepEqual(errors, []);
    for (const id of Object.keys(RULE_CATALOG)) {
        assert.ok(rules.has(id), `missing rule marker ${id}`);
    }
    assert.deepEqual(auditRuleCatalog(repoRoot), []);
});

test('AGENTS.md states later-wins and names the appetite file', () => {
    assert.match(BASELINE, /the later source wins/);
    assert.match(BASELINE, /AGENTS\.appetite\.example\.json/);
    assert.match(BASELINE, /npm run layers:diff/);
    assert.doesNotMatch(BASELINE, /Core rules cannot be relaxed/);
    assert.doesNotMatch(BASELINE, /There is no waiver or exception mechanism/);
    assert.doesNotMatch(BASELINE, /AGENTS\.waivers/);
});

test('upstream repository reports no tagged overrides', () => {
    const result = evaluateLayerDiff({ repoRoot, env: {} });
    assert.deepEqual(result.differences, []);
    assert.deepEqual(result.malformed, []);
    assert.deepEqual(result.resolveErrors, []);
    assert.deepEqual(auditAppetiteExample(repoRoot), []);
});

test('the layer template parses and uses catalogued IDs', () => {
    const template = fs.readFileSync(path.join(repoRoot, 'org/example/AGENTS.md'), 'utf8');
    const overrides = parseOverrides(template);
    assert.ok(overrides.length >= 1);
    for (const override of overrides) {
        assert.equal(override.malformed, undefined, override.raw);
        assert.ok(RULE_CATALOG[override.rule], override.rule);
    }
});

test('relaxing a secrets rule is a named difference, not an audit FAIL', () => {
    const result = evaluate(acmeLayer(['- Dummy keys in fixtures. <!-- override: secrets.no-hardcode relax -->']));
    assert.equal(result.differences.length, 1);
    assert.equal(result.differences[0].rule, 'secrets.no-hardcode');
    assert.equal(result.differences[0].action, 'relax');
    assert.equal(result.differences[0].class, 'credentials-in-repo');
    assert.equal(result.differences[0].wins, true);
});

test('a committed AGENTS.waivers.json is ignored', () => {
    const result = evaluate({
        ...acmeLayer(['- Dummy keys in fixtures. <!-- override: secrets.no-hardcode relax -->']),
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o' }] })
    });
    assert.equal(result.differences.length, 1);
    assert.equal(result.differences[0].action, 'relax');
});

test('later layer wins when two layers override the same rule', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/msp/AGENTS.md\norg/acme/AGENTS.md\n',
        'org/msp/AGENTS.md': '- MSP pin. <!-- override: coding.model-baseline relax -->\n',
        'org/acme/AGENTS.md': '- Customer pin. <!-- override: coding.model-baseline tighten -->\n'
    });
    assert.equal(result.differences.length, 2);
    const msp = result.differences.find((diff) => diff.layer === 'org/msp/AGENTS.md');
    const acme = result.differences.find((diff) => diff.layer === 'org/acme/AGENTS.md');
    assert.equal(msp.wins, false);
    assert.equal(acme.wins, true);
    assert.equal(acme.action, 'tighten');
    assert.equal(acme.class, 'spend');
});

test('clarify, tighten, and unknown actions are reported with classes', () => {
    const result = evaluate(acmeLayer([
        '- Vault project is named in the README. <!-- override: secrets.fetch-on-demand clarify -->',
        '- Also never log secret names. <!-- override: secrets.no-hardcode tighten -->',
        '- Use our gateway. <!-- override: coding.model-baseline loosen -->'
    ]));
    assert.deepEqual(result.differences.map((diff) => [diff.rule, diff.action, diff.class, diff.knownAction]), [
        ['secrets.fetch-on-demand', 'clarify', 'credentials-in-repo', true],
        ['secrets.no-hardcode', 'tighten', 'credentials-in-repo', true],
        ['coding.model-baseline', 'loosen', 'spend', false]
    ]);
});

test('malformed markers are listed separately from differences', () => {
    const result = evaluate(acmeLayer([
        '<!-- override: secrets.no-hardcode -->',
        '<!--override:Bad_ID relax-->'
    ]));
    assert.equal(result.differences.length, 0);
    assert.equal(result.malformed.length, 2);
});

test('AGENTS.local.md is evaluated last', () => {
    const result = evaluate({ 'AGENTS.local.md': '<!-- override: secrets.no-ask-user relax -->\n' });
    assert.equal(result.differences[0].layer, 'AGENTS.local.md');
    assert.equal(result.differences[0].class, 'credentials-in-repo');
});

test('NOEMI_ORG_LAYERS layers are evaluated', () => {
    const dir = fixtureRepo({ 'org/ci/AGENTS.md': '<!-- override: refusal.principle relax -->\n' });
    try {
        const result = evaluateLayerDiff({ repoRoot: dir, env: { NOEMI_ORG_LAYERS: 'org/ci/AGENTS.md' } });
        assert.equal(result.differences[0].rule, 'refusal.principle');
        assert.equal(result.differences[0].class, 'identity');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('removing a catalogued rule ID from the baseline is an audit-catalog failure', () => {
    const dir = fixtureRepo({ 'AGENTS.md': BASELINE.replace('<!-- rule: secrets.no-hardcode -->', '') });
    try {
        const failures = auditRuleCatalog(dir);
        assert.equal(failures.length, 1);
        assert.match(failures[0], /secrets\.no-hardcode/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('example appetite fails on credentials-in-repo relax and ignores attestations for exit', () => {
    const appetite = loadAppetite(path.join(repoRoot, APPETITE_EXAMPLE));
    const evaluation = evaluate({
        ...acmeLayer([
            '- Dummy keys in fixtures. <!-- override: secrets.no-hardcode relax -->',
            '- Use our gateway. <!-- override: coding.model-baseline relax -->'
        ])
    });
    const applied = applyAppetite(evaluation, appetite, APPETITE_EXAMPLE);
    assert.equal(applied.matches.length, 1);
    assert.equal(applied.matches[0].rule, 'secrets.no-hardcode');
    assert.equal(applied.attestations.length, 1);
    assert.equal(applied.attestations[0].rule, 'coding.model-baseline');
});

test('CLI default exit is 0 when a secrets rule is relaxed', () => {
    const dir = fixtureRepo(acmeLayer(['- x <!-- override: secrets.no-hardcode relax -->']));
    try {
        const result = captureCli(dir, []);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /secrets\.no-hardcode/);
        assert.match(result.stdout, /credentials-in-repo/);
        assert.match(result.stdout, /Exit 0 \(default\)/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('CLI --fail-on-appetite exits 1 on a credentials-in-repo relax and 0 on a spend relax', () => {
    const exampleAppetite = path.join(repoRoot, APPETITE_EXAMPLE);
    const failDir = fixtureRepo(acmeLayer(['- x <!-- override: secrets.no-hardcode relax -->']));
    const spendDir = fixtureRepo(acmeLayer(['- x <!-- override: coding.model-baseline relax -->']));
    try {
        const failing = captureCli(failDir, ['--fail-on-appetite', `--appetite=${exampleAppetite}`]);
        assert.equal(failing.status, 1, failing.stderr);
        assert.match(failing.stdout, /MATCH/);
        const spending = captureCli(spendDir, ['--fail-on-appetite', `--appetite=${exampleAppetite}`]);
        assert.equal(spending.status, 0, spending.stderr);
        assert.match(spending.stdout, /No winning override matches this appetite/);
        assert.match(spending.stdout, /attestations/i);
    } finally {
        fs.rmSync(failDir, { recursive: true, force: true });
        fs.rmSync(spendDir, { recursive: true, force: true });
    }
});

test('CLI --fail-on-appetite without an appetite file exits 2', () => {
    const dir = fixtureRepo(acmeLayer(['- x <!-- override: secrets.no-hardcode relax -->']));
    try {
        const result = captureCli(dir, ['--fail-on-appetite']);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /No appetite file found/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('audit CLI stays on repository invariants and does not score layer relaxations', () => {
    const env = { ...process.env };
    delete env.NOEMI_ORG_LAYERS;
    const auditSrc = fs.readFileSync(path.join(repoRoot, 'scripts/audit-repo.js'), 'utf8');
    assert.doesNotMatch(auditSrc, /evaluateLayerDiff|evaluateLayerCompliance|layer_compliance/);
    assert.match(auditSrc, /auditRuleCatalog/);
    assert.match(auditSrc, /auditAppetiteExample/);

    const clean = spawnSync('node', ['scripts/audit-repo.js'], { cwd: repoRoot, encoding: 'utf8', env });
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /Auditing configuration layers hook/);
    assert.doesNotMatch(clean.stdout, /Auditing layer compliance/);
    assert.match(clean.stdout, /Repository audit passed\./);

    const layer = path.join(repoRoot, 'test-artifacts', 'layer-diff-cli.md');
    fs.mkdirSync(path.dirname(layer), { recursive: true });
    fs.writeFileSync(layer, '- x <!-- override: secrets.no-hardcode relax -->\n', 'utf8');
    try {
        const reported = spawnSync('node', ['scripts/layer_diff.js', '--fail-on-appetite', `--appetite=${APPETITE_EXAMPLE}`], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: { ...env, NOEMI_ORG_LAYERS: 'test-artifacts/layer-diff-cli.md' }
        });
        assert.equal(reported.status, 1, reported.stderr);
        assert.match(reported.stdout, /secrets\.no-hardcode/);
    } finally {
        fs.rmSync(layer, { force: true });
    }
});
