'use strict';

// Agent Skills spec conformance (agentskills.io).
//
// The skills-dist catalogue targets the open Agent Skills standard so any
// spec-implementing agent (Claude, Codex, Copilot, Cursor, Gemini CLI, ...)
// and any directory (skills.sh, agentskills.io) can consume it. Conformance
// is proven two ways: our own frontmatter assertions (fast, precise) and the
// OFFICIAL reference validator `skills-ref` (third-party judgment, so the
// claim "spec-conformant" is not self-attested). skills-ref is ESM-only with
// no require() export, so tests spawn its CLI — the interface the spec itself
// documents (`skills-ref validate <dir>`).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { buildSkillsDist } = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');
const distDir = path.join(repoRoot, 'skills-dist');
const validatorCli = path.join(repoRoot, 'node_modules', 'skills-ref', 'dist', 'cli.js');

function builtFiles() {
    return buildSkillsDist({
        skillsDir: path.join(repoRoot, 'skills'),
        agentsMdPath: path.join(repoRoot, 'AGENTS.md'),
        repoRoot
    }).files;
}

test('frontmatter carries the spec license field, verified against LICENSE at build time', () => {
    for (const file of builtFiles()) {
        assert.match(file.content, /^license: FSL-1\.1-Apache-2\.0$/m, `${file.slug}: license field`);
    }
});

test('frontmatter carries spec metadata (string-to-string map) with provenance keys', () => {
    for (const file of builtFiles()) {
        assert.match(
            file.content,
            /^metadata:\n {2}author: project-noemi\n {2}governance: "NoéMI 4D"$/m,
            `${file.slug}: metadata map`
        );
    }
});

test('artifact names satisfy the spec charset and match their directory', () => {
    // The validator enforces this too; this assertion keeps the rule visible
    // and failing locally even before skills-ref is installed.
    for (const file of builtFiles()) {
        assert.match(file.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${file.slug}: spec name charset`);
        assert.ok(file.slug.length <= 64, `${file.slug}: name must be at most 64 characters`);
        assert.strictEqual(path.dirname(file.relPath).split(path.sep).pop(), file.slug,
            `${file.slug}: name must match the parent directory`);
    }
});

test('every published artifact passes the official skills-ref validator', () => {
    assert.ok(
        fs.existsSync(validatorCli),
        'skills-ref is not installed — run `npm install` (CI runs `npm ci`). ' +
        'This gate must fail loudly rather than skip: a silently missing validator reads as conformance.'
    );
    const dirs = fs.readdirSync(distDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    assert.ok(dirs.length > 0, 'skills-dist/ has no artifacts to validate');
    for (const dir of dirs) {
        const result = spawnSync(process.execPath, [validatorCli, 'validate', path.join(distDir, dir)], {
            cwd: repoRoot,
            encoding: 'utf8',
            timeout: 30_000
        });
        assert.strictEqual(
            result.status, 0,
            `skills-ref rejected skills-dist/${dir}:\n${result.stdout}${result.stderr}`
        );
    }
});
