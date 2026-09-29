const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { CONTEXT_POINTER } = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');
const geminiPath = path.join(repoRoot, 'GEMINI.md');
const claudePath = path.join(repoRoot, 'CLAUDE.md');

function read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function runNode(args) {
    const result = spawnSync('node', args, {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    assert.equal(
        result.status,
        0,
        `Command failed: node ${args.join(' ')}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
}

test('generate_all is deterministic against committed outputs', () => {
    const beforeGemini = read(geminiPath);
    const beforeClaude = read(claudePath);

    runNode(['scripts/generate_all.js']);

    assert.equal(read(geminiPath), beforeGemini, 'GEMINI.md changed after regeneration');
    assert.equal(read(claudePath), beforeClaude, 'CLAUDE.md changed after regeneration');
});

test('config override rewrites context outputs and can be restored', () => {
    const baselineGemini = read(geminiPath);
    const baselineClaude = read(claudePath);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noemi-config-'));
    const tempConfigPath = path.join(tempDir, 'mcp.config.json');

    fs.writeFileSync(tempConfigPath, JSON.stringify({
        active_mcps: ['github'],
        active_skills: ['classification/risk-triage']
    }, null, 2));

    try {
        runNode(['scripts/generate_all.js', `--config=${tempConfigPath}`]);

        assert.equal(read(geminiPath), CONTEXT_POINTER, 'config override must not fatten GEMINI.md');
        assert.equal(read(claudePath), CONTEXT_POINTER, 'config override must not fatten CLAUDE.md');
    } finally {
        runNode(['scripts/generate_all.js']);
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    assert.equal(read(geminiPath), baselineGemini, 'GEMINI.md was not restored after override test');
    assert.equal(read(claudePath), baselineClaude, 'CLAUDE.md was not restored after override test');
});
