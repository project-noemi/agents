const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    REQUIRED_CORE_RULES,
    buildComplianceReport,
    evaluateLayerCompliance,
    parseBaselineRules,
    parseOverrides,
    parseWaivers,
    scanHeuristics
} = require('../scripts/layer_compliance');

const repoRoot = path.join(__dirname, '..');
const BASELINE = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
const TODAY = '2026-10-18';

function fixtureRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noemi-compliance-'));
    const all = { 'AGENTS.md': BASELINE, ...files };
    for (const [rel, content] of Object.entries(all)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), content, 'utf8');
    }
    return dir;
}

function evaluate(files, today = TODAY) {
    const dir = fixtureRepo(files);
    try {
        return evaluateLayerCompliance({ repoRoot: dir, env: {}, today });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const levels = (result) => result.findings.map((finding) => finding.level);

test('baseline AGENTS.md tags every core rule with a stable ID', () => {
    const { rules, errors } = parseBaselineRules(BASELINE);
    assert.deepEqual(errors, []);
    for (const id of REQUIRED_CORE_RULES) {
        assert.equal(rules.get(id)?.tier, 'core', `missing core rule marker ${id}`);
    }
    assert.equal(rules.get('coding.branch-naming')?.tier, 'preference');
});

test('upstream repository evaluates clean (no live layers, no waivers)', () => {
    const result = evaluateLayerCompliance({ repoRoot, env: {}, today: TODAY });
    assert.deepEqual(result.findings, []);
});

test('the layer template parses, uses valid IDs, and trips no heuristic', () => {
    const template = fs.readFileSync(path.join(repoRoot, 'org/example/AGENTS.md'), 'utf8');
    const overrides = parseOverrides(template);
    assert.ok(overrides.length >= 1);
    const { rules } = parseBaselineRules(BASELINE);
    for (const override of overrides) {
        assert.ok(rules.has(override.rule), override.rule);
    }
    assert.deepEqual(scanHeuristics(template), []);
});

test('unwaived relaxation of a core secret rule is FAIL', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '- Test fixtures embed dummy keys. <!-- override: secrets.no-hardcode relax -->\n'
    });
    assert.deepEqual(levels(result), ['FAIL']);
    assert.match(result.findings[0].message, /org\/acme\/AGENTS\.md:1: relaxes core rule secrets\.no-hardcode without an active waiver/);
});

test('unwaived relaxation of the Refusal Principle is FAIL', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '<!-- override: refusal.principle relax -->\n- Lab personas run without identity lock.\n'
    });
    assert.deepEqual(levels(result), ['FAIL']);
});

test('an active waiver turns a core relaxation into WARN and is listed', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '- Dummy keys in fixtures. <!-- override: secrets.no-hardcode relax -->\n',
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'Fixture-only dummy values', owner: 'sec@example.com', expires: '2026-12-31' }] })
    });
    assert.deepEqual(levels(result), ['WARN']);
    assert.equal(result.findings[0].waived, true);
    assert.equal(result.waivers.length, 1);
    assert.equal(result.waivers[0].status, 'active');
    assert.equal(result.waivers[0].used, true);
});

test('an expired waiver no longer counts: back to FAIL, waiver still listed', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '- Dummy keys. <!-- override: secrets.no-hardcode relax -->\n',
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o', expires: '2026-10-17' }] })
    });
    assert.deepEqual(levels(result), ['FAIL']);
    assert.match(result.findings[0].message, /waiver expired 2026-10-17/);
    assert.equal(result.waivers[0].status, 'expired');
});

test('a waiver is valid through the end of its expiry day', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '<!-- override: secrets.no-hardcode relax -->\n',
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o', expires: TODAY }] })
    });
    assert.deepEqual(levels(result), ['WARN']);
});

test('a layer-scoped waiver does not cover another layer', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/msp/AGENTS.md\norg/acme/AGENTS.md\n',
        'org/msp/AGENTS.md': '# MSP\n',
        'org/acme/AGENTS.md': '<!-- override: secrets.no-hardcode relax -->\n',
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o', layer: 'org/msp/AGENTS.md' }] })
    });
    assert.deepEqual(levels(result), ['FAIL']);
});

test('relaxing a preference rule is WARN; clarify and tighten are PASS', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': [
            '- Use our gateway models. <!-- override: coding.model-baseline relax -->',
            '- Vault project is named in the README. <!-- override: secrets.fetch-on-demand clarify -->',
            '- Also never log secret names. <!-- override: secrets.no-hardcode tighten -->'
        ].join('\n')
    });
    assert.deepEqual(levels(result), ['WARN', 'PASS', 'PASS']);
});

test('unknown rule IDs and actions are WARN', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '<!-- override: secrets.no-such-rule relax -->\n<!-- override: secrets.no-hardcode loosen -->\n'
    });
    assert.deepEqual(levels(result), ['WARN', 'WARN']);
});

test('keyword heuristic reports possible unmarked relaxations as WARN only', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': [
            '- Developers may hardcode test credentials in fixtures.',
            '- You can ask the user to paste the API key when the vault is down.',
            '- Never hardcode secrets.',
            '- Agents must not write secrets to disk.'
        ].join('\n')
    });
    assert.deepEqual(levels(result), ['WARN', 'WARN']);
    assert.ok(result.findings.every((finding) => finding.heuristic));
});

test('a marked relaxation suppresses the duplicate heuristic hit for that rule', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '<!-- override: secrets.no-hardcode relax -->\n- Developers may hardcode test credentials in fixtures.\n',
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o' }] })
    });
    assert.deepEqual(levels(result), ['WARN']);
    assert.equal(result.findings[0].waived, true);
});

test('AGENTS.local.md is evaluated too (last layer)', () => {
    const result = evaluate({ 'AGENTS.local.md': '<!-- override: secrets.no-ask-user relax -->\n' });
    assert.deepEqual(levels(result), ['FAIL']);
    assert.equal(result.findings[0].layer, 'AGENTS.local.md');
});

test('malformed waivers FAIL; the example waiver file is well-formed', () => {
    const parsed = parseWaivers(JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode' }, { rule: 'x.y', reason: 'r', owner: 'o', expires: '31/12/2026' }] }), 'AGENTS.waivers.json');
    assert.equal(parsed.errors.length, 2);
    assert.match(parsed.errors[0], /"reason" is required; "owner" is required/);
    assert.match(parsed.errors[1], /YYYY-MM-DD/);
    const example = parseWaivers(fs.readFileSync(path.join(repoRoot, 'AGENTS.waivers.example.json'), 'utf8'), 'example');
    assert.deepEqual(example.errors, []);
    assert.equal(example.waivers.length, 1);
});

test('removing a core rule ID from the baseline is FAIL', () => {
    const result = evaluate({ 'AGENTS.md': BASELINE.replace('<!-- rule: secrets.no-hardcode -->', '') });
    assert.deepEqual(levels(result), ['FAIL']);
    assert.match(result.findings[0].message, /secrets\.no-hardcode/);
});

test('report: summary line, status, and exit codes (PASS 0, WARN 0 / 2 with fail-on-warn, FAIL 1)', () => {
    const checkNames = ['a', 'b', 'c'];
    const pass = buildComplianceReport({ checkNames, findings: [] });
    assert.equal(pass.summary, 'Compliance: 0 FAIL, 0 WARN, 3 PASS (status: PASS)');
    assert.equal(pass.exitCode, 0);

    const warnFindings = [{ level: 'WARN', check: 'b', message: 'w' }, { level: 'PASS', check: 'c', message: 'clarify' }];
    const warn = buildComplianceReport({ checkNames, findings: warnFindings });
    assert.equal(warn.summary, 'Compliance: 0 FAIL, 1 WARN, 3 PASS (status: WARN)');
    assert.equal(warn.exitCode, 0);
    assert.equal(buildComplianceReport({ checkNames, findings: warnFindings, failOnWarn: true }).exitCode, 2);

    const fail = buildComplianceReport({ checkNames, findings: [{ level: 'FAIL', check: 'a', message: 'f' }, ...warnFindings] });
    assert.equal(fail.summary, 'Compliance: 1 FAIL, 1 WARN, 2 PASS (status: FAIL)');
    assert.equal(fail.exitCode, 1);
    assert.deepEqual(fail.checks.map((check) => check.level), ['FAIL', 'WARN', 'PASS']);
});

test('audit CLI: summary is the first line; --json is machine-readable; flags parse', () => {
    const env = { ...process.env, COMPLIANCE_FAIL_ON_WARN: '1' };
    delete env.NOEMI_ORG_LAYERS;
    const text = spawnSync('node', ['scripts/audit-repo.js'], { cwd: repoRoot, encoding: 'utf8', env });
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout.split('\n')[0], /^Compliance: 0 FAIL, 0 WARN, \d+ PASS \(status: PASS\)$/);
    assert.match(text.stdout, /\nWaivers \(0\)\n/);

    const json = spawnSync('node', ['scripts/audit-repo.js', '--json', '--fail-on-warn'], { cwd: repoRoot, encoding: 'utf8', env });
    assert.equal(json.status, 0, json.stderr);
    const report = JSON.parse(json.stdout);
    assert.equal(report.status, 'PASS');
    assert.equal(report.failOnWarn, true);
    assert.ok(report.checks.some((check) => check.name === 'checkLayerCompliance'));
    assert.ok(Array.isArray(report.waivers));

    const bad = spawnSync('node', ['scripts/audit-repo.js', '--nope'], { cwd: repoRoot, encoding: 'utf8', env });
    assert.equal(bad.status, 64);
});

test('malformed override markers are reported (WARN), never silently ignored', () => {
    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '<!-- override: secrets.no-hardcode -->\n<!--override:Bad_ID relax-->\n<!-- override: secrets.no-hardcode relax-->\n'
    });
    assert.deepEqual(levels(result), ['WARN', 'WARN', 'FAIL']);
    assert.match(result.findings[0].message, /malformed override marker/);
});

test('waiver expiry must be a real calendar date', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '']) {
        const parsed = parseWaivers(JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o', expires: bad }] }), 'w');
        assert.equal(parsed.errors.length, 1, `expected rejection of expires=${JSON.stringify(bad)}`);
    }
    assert.deepEqual(parseWaivers(JSON.stringify({ waivers: [{ rule: 'x.y', reason: 'r', owner: 'o', expires: '2028-02-29' }] }), 'w').errors, []);
});

test('waiver layer paths are validated and normalized', () => {
    const bad = parseWaivers(JSON.stringify({ waivers: [{ rule: 'x.y', reason: 'r', owner: 'o', layer: '../outside.md' }] }), 'w');
    assert.equal(bad.errors.length, 1);
    assert.match(bad.errors[0], /"layer"/);
    const local = parseWaivers(JSON.stringify({ waivers: [{ rule: 'x.y', reason: 'r', owner: 'o', layer: 'AGENTS.local.md' }] }), 'w');
    assert.deepEqual(local.errors, []);

    const result = evaluate({
        'AGENTS.layers': 'org/acme/AGENTS.md\n',
        'org/acme/AGENTS.md': '<!-- override: secrets.no-hardcode relax -->\n',
        'AGENTS.waivers.json': JSON.stringify({ waivers: [{ rule: 'secrets.no-hardcode', reason: 'r', owner: 'o', layer: './org/acme/AGENTS.md' }] })
    });
    assert.deepEqual(levels(result), ['WARN'], 'a ./-prefixed layer path must still match');
});

test('a malformed live waivers file is FAIL', () => {
    const result = evaluate({ 'AGENTS.waivers.json': '{ not json' });
    assert.deepEqual(levels(result), ['FAIL']);
    assert.match(result.findings[0].message, /invalid JSON/);
});
