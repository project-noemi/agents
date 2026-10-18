const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CONTEXT_POINTER } = require('../scripts/context_helpers');
const {
    BLOCK_BEGIN,
    BLOCK_END,
    auditConfigLayers,
    buildContextFile,
    parseLayersEnv,
    parseLayersManifest,
    resolveLayers,
    validateLayerEntries,
    validateLayerPath
} = require('../scripts/context_layers');

const repoRoot = path.join(__dirname, '..');

function fixtureRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noemi-layers-'));
    for (const [rel, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), content, 'utf8');
    }
    return dir;
}

test('the upstream repository passes the configuration layers contract', () => {
    assert.deepEqual(auditConfigLayers(repoRoot), []);
});

test('upstream ships no live AGENTS.layers and the example lists well-formed paths', () => {
    assert.equal(fs.existsSync(path.join(repoRoot, 'AGENTS.layers')), false,
        'upstream must not commit a live AGENTS.layers');
    const entries = parseLayersManifest(fs.readFileSync(path.join(repoRoot, 'AGENTS.layers.example'), 'utf8'));
    assert.ok(entries.length >= 2, 'example manifest should show an MSP and a customer layer');
    assert.deepEqual(validateLayerEntries(entries), []);
});

test('AGENTS.md hook carries no @-imports of its own', () => {
    // `@AGENTS.layers` would import only the list of paths; the generator owns
    // the imports instead. Every path in the hook must stay inside backticks.
    const agentsMd = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
    const hook = agentsMd.slice(agentsMd.lastIndexOf('# Configuration layers'));
    const outsideCode = hook.replace(/`[^`]*`/g, '');
    assert.doesNotMatch(outsideCode, /(^|\s)@[\w./-]/m);
    assert.doesNotMatch(agentsMd, /\.agents\/org\.md/);
});

test('manifest parsing: comments, blanks, inline comments, order kept', () => {
    const entries = parseLayersManifest('# header\n\norg/msp/AGENTS.md\n  org/cust/AGENTS.md  # customer\n#org/off/AGENTS.md\n');
    assert.deepEqual(entries, [
        { path: 'org/msp/AGENTS.md', line: 3 },
        { path: 'org/cust/AGENTS.md', line: 4 }
    ]);
});

test('NOEMI_ORG_LAYERS parsing: unset or blank means use the manifest', () => {
    assert.equal(parseLayersEnv(undefined), null);
    assert.equal(parseLayersEnv('  '), null);
    assert.deepEqual(parseLayersEnv('a/A.md, b/B.md,').map((entry) => entry.path), ['a/A.md', 'b/B.md']);
});

test('path validation rejects absolute, escaping, and reserved paths', () => {
    for (const ok of ['org/msp/AGENTS.md', 'org/a/b/x.md', 'layers/team.md']) {
        assert.equal(validateLayerPath(ok), null, ok);
    }
    for (const bad of ['/etc/x.md', 'C:\\x.md', 'C:/x.md', '~/x.md', '../x.md', 'org/../../x.md', 'org/a/../b.md',
        'org\\x.md', 'org/x y.md', '@org/x.md', 'org/x.txt', 'AGENTS.md', 'AGENTS.local.md', 'AGENTS.override.md', '']) {
        assert.ok(validateLayerPath(bad), `expected rejection: ${JSON.stringify(bad)}`);
    }
    const dupes = validateLayerEntries([{ path: 'a/x.md', line: 1 }, { path: 'a/x.md', line: 2 }]);
    assert.equal(dupes.length, 1);
    assert.equal(dupes[0].line, 2);
});

test('no layers: context file is exactly the AGENTS.md pointer', () => {
    const dir = fixtureRepo({ 'AGENTS.md': '# Base\n' });
    try {
        assert.equal(buildContextFile({ repoRoot: dir, env: {}, pointer: CONTEXT_POINTER }).content, CONTEXT_POINTER);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('manifest layers expand in order, missing files skipped, local last', () => {
    const dir = fixtureRepo({
        'AGENTS.md': '# Base\n',
        'AGENTS.layers': 'org/msp/AGENTS.md\norg/absent/AGENTS.md\norg/cust/AGENTS.md\n',
        'org/msp/AGENTS.md': '# MSP\n',
        'org/cust/AGENTS.md': '# Customer\n',
        'AGENTS.local.md': '# Local\n'
    });
    try {
        const { content, resolved } = buildContextFile({ repoRoot: dir, env: {}, pointer: CONTEXT_POINTER });
        assert.deepEqual(resolved.missing, ['org/absent/AGENTS.md']);
        assert.equal(content, [
            '@AGENTS.md',
            '',
            BLOCK_BEGIN,
            '@org/msp/AGENTS.md',
            '@org/cust/AGENTS.md',
            '@AGENTS.local.md',
            BLOCK_END,
            ''
        ].join('\n'));
        // Idempotent: same inputs, same bytes.
        assert.equal(buildContextFile({ repoRoot: dir, env: {}, pointer: CONTEXT_POINTER }).content, content);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('NOEMI_ORG_LAYERS replaces the manifest', () => {
    const dir = fixtureRepo({
        'AGENTS.md': '# Base\n',
        'AGENTS.layers': 'org/msp/AGENTS.md\n',
        'org/msp/AGENTS.md': '# MSP\n',
        'org/ci/AGENTS.md': '# CI\n'
    });
    try {
        const resolved = resolveLayers({ repoRoot: dir, env: { NOEMI_ORG_LAYERS: 'org/ci/AGENTS.md' } });
        assert.equal(resolved.source, 'NOEMI_ORG_LAYERS');
        assert.deepEqual(resolved.present, ['org/ci/AGENTS.md']);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('malformed manifest fails the build; missing optional layers do not', () => {
    const base = {
        'AGENTS.md': fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8'),
        'org/example/AGENTS.md': '# Example\n',
        '.gitignore': 'AGENTS.local.md\n'
    };
    const good = fixtureRepo({ ...base, 'AGENTS.layers': 'org/not-vendored-yet/AGENTS.md\n' });
    const bad = fixtureRepo({ ...base, 'AGENTS.layers.example': '../outside.md\n/abs.md\n' });
    try {
        assert.deepEqual(auditConfigLayers(good), []);
        const failures = auditConfigLayers(bad);
        assert.equal(failures.length, 2);
        assert.match(failures[0], /AGENTS\.layers\.example:1/);
        assert.throws(() => buildContextFile({ repoRoot: bad, env: { NOEMI_ORG_LAYERS: '../x.md' }, pointer: CONTEXT_POINTER }),
            /Malformed configuration layer/);
    } finally {
        fs.rmSync(good, { recursive: true, force: true });
        fs.rmSync(bad, { recursive: true, force: true });
    }
});

test('audit flags a missing hook, template, or gitignore entry', () => {
    const dir = fixtureRepo({ 'AGENTS.md': '# Base\n' });
    try {
        const failures = auditConfigLayers(dir).join('\n');
        assert.match(failures, /missing the top-level "# Configuration layers"/);
        assert.match(failures, /org\/example\/AGENTS\.md/);
        assert.match(failures, /\.gitignore must ignore AGENTS\.local\.md/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
