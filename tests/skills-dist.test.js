const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
    buildSkillsDist,
    buildSkillDistFile,
    rewriteRelativeLinks,
} = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');
const skillsDir = path.join(repoRoot, 'skills');
const agentsMdPath = path.join(repoRoot, 'AGENTS.md');

// skills-dist/ is the public skills.sh distribution surface. Its contract:
// byte-deterministic, frontmatter a strict registry can parse, hard gates and
// mandates travelling IN the artifact, and no relative link left to dangle in
// a stranger's agent config.

test('link rewriting: repo-relative links become main-pinned GitHub URLs', () => {
    const src = 'skills/classification/risk-triage.md';
    const base = 'https://github.com/project-noemi/agents/blob/main';
    assert.equal(
        rewriteRelativeLinks('see [x](../../docs/GOVERNANCE.md)', src),
        `see [x](${base}/docs/GOVERNANCE.md)`,
    );
    assert.equal(
        rewriteRelativeLinks('see [x](./issue-intake.md#inputs)', src),
        `see [x](${base}/skills/classification/issue-intake.md#inputs)`,
    );
    assert.equal(
        rewriteRelativeLinks('see [x](/LICENSE)', src),
        `see [x](${base}/LICENSE)`,
    );
    // Titles survive the rewrite.
    assert.equal(
        rewriteRelativeLinks('see [x](../security/pii-scan.md "PII")', src),
        `see [x](${base}/skills/security/pii-scan.md "PII")`,
    );
});

test('link rewriting: external, anchor, mailto, and root-escaping targets are untouched', () => {
    const src = 'skills/security/pii-scan.md';
    for (const line of [
        '[a](https://example.com/x.md)',
        '[b](#audit-log)',
        '[c](mailto:x@y.z)',
        '[d](../../../outside/repo.md)',
    ]) {
        assert.equal(rewriteRelativeLinks(line, src), line, `${line} must not change`);
    }
});

test('frontmatter: quotes in the Purpose lead are YAML-escaped', () => {
    const content = '# Quoted Skill\n\n## Purpose\n\nSay "hello" safely.\n';
    const out = buildSkillDistFile({
        slug: 'quoted-skill',
        content,
        sourceRelPath: 'skills/test/quoted-skill.md',
        mandateSections: [{ title: 'T', body: 'rule' }],
    });
    const descLine = out.split('\n').find((l) => l.startsWith('description:'));
    assert.equal(descLine, 'description: "Say \\"hello\\" safely."');
    assert.ok(out.startsWith('---\nname: quoted-skill\n'), 'frontmatter must open the file');
});

test('artifact shape: provenance, license, mandates, and a single H1', () => {
    const files = buildSkillsDist({ skillsDir, agentsMdPath, repoRoot });
    for (const file of files) {
        const c = file.content;
        assert.match(c, /^---\nname: [a-z0-9-]+\ndescription: "/, `${file.slug}: frontmatter`);
        assert.match(c, /Generated file — do not edit/, `${file.slug}: provenance`);
        assert.match(c, /FSL-1\.1-Apache-2\.0/, `${file.slug}: license marker`);
        assert.match(c, /## Global Mandates/, `${file.slug}: mandates section`);
        assert.match(c, /### 🔐 Secrets & Configuration/, `${file.slug}: SecretOps mandate`);
        assert.match(c, /### 🛡 Error Handling and Resilience/, `${file.slug}: resilience mandate`);
        assert.match(c, /#### Mandatory Security Rules/, `${file.slug}: mandate subsections nest as children`);
        const h1s = c.match(/^# /gm) || [];
        assert.equal(h1s.length, 1, `${file.slug}: exactly one H1`);
        // The gates that make these skills worth installing travel verbatim.
        assert.match(c, /### Refusal Criteria/, `${file.slug}: refusal criteria travel`);
    }
});

test('determinism: two in-memory builds are byte-identical, slugs unique and sorted', () => {
    const a = buildSkillsDist({ skillsDir, agentsMdPath, repoRoot });
    const b = buildSkillsDist({ skillsDir, agentsMdPath, repoRoot });
    assert.deepEqual(a, b, 'the builder must be a pure function of its inputs');
    const slugs = a.map((f) => f.slug);
    assert.deepEqual(slugs, [...new Set(slugs)].sort(), 'slugs unique and sorted');
});

test('committed artifacts match the builder byte-for-byte (the audit contract)', () => {
    for (const file of buildSkillsDist({ skillsDir, agentsMdPath, repoRoot })) {
        const onDisk = fs.readFileSync(path.join(repoRoot, file.relPath), 'utf8');
        assert.equal(onDisk, file.content,
            `${file.relPath} drifted — run npm run generate; skills-dist/ is a build artifact`);
    }
});
