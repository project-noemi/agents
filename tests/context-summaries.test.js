const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
    extractProhibitionParagraphs,
    extractSectionBody,
    firstSentences,
} = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');

// The summary-injection design (Decision [2026-08-13-0001]) rests on one
// invariant: prose summarizes, prohibitions stay resident. These tests pin the
// extraction behavior that invariant depends on.

test('prohibitions: CRITICAL, "Do not", and "Never" paragraphs are all extracted', () => {
    const md = '#### Overview\nIntro.\n\n#### 1. A\n**CRITICAL:** rule one.\n\n#### 2. B\nDo not overwrite content unless instructed.\n\n#### 3. C\nNever make a file public.\n\n#### 4. D\nPlain guidance with no marker.';
    const rules = extractProhibitionParagraphs(md);
    assert.equal(rules.length, 3);
    assert.match(rules[0], /^\*\*CRITICAL:\*\*/, 'heading line must be stripped');
    assert.match(rules[1], /Do not overwrite/);
    assert.match(rules[2], /Never make a file public/);
});

test('prohibitions: fenced examples are illustration, not rules', () => {
    // A fenced block quoting a CRITICAL phrase must not be re-emitted as a
    // safety rule — it would land mangled in every generated context file.
    const md = '#### 1. Real\n**CRITICAL:** real rule.\n\n```\nexample output\n**CRITICAL:** fake rule inside a fence\n```\n';
    const rules = extractProhibitionParagraphs(md);
    assert.equal(rules.length, 1);
    assert.match(rules[0], /real rule/);
});

test('firstSentences: dotted tokens like YYYY.MM.DD do not truncate or drop text', () => {
    // Regression: a match-based sentence splitter dropped everything before
    // the dotted version token, emitting a summary that began mid-word.
    const text = 'Turn a week of `YYYY.MM.DD` releases into a digest for followers of the project, written in plain benefit language. Second sentence here.';
    const out = firstSentences(text, 60);
    assert.match(out, /^Turn a week/);
    assert.match(out, /YYYY\.MM\.DD/);
});

test('published skills keep every hard gate resident', () => {
    const distDir = path.join(repoRoot, 'skills-dist');
    const dirs = fs.readdirSync(distDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    assert.ok(dirs.length > 0);
    for (const dir of dirs) {
        const skillMd = fs.readFileSync(path.join(distDir, dir.name, 'SKILL.md'), 'utf8');
        assert.match(skillMd, /### Refusal Criteria/, `${dir.name}: Refusal Criteria must travel in SKILL.md`);
        assert.match(skillMd, /Never/, `${dir.name}: Never gate must travel in SKILL.md`);
    }
});

test('AGENTS.md keeps the github protocol on the load path', () => {
    const content = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
    assert.match(content, /mcp-protocols\/github\.md/,
        'machine-identity safety contract must stay reachable from AGENTS.md');
});

test('extractSectionBody stops at the next same-level heading', () => {
    const md = '## Purpose\nFirst.\n\n### Sub\nNested stays.\n\n## Next\nOther.';
    const body = extractSectionBody(md, 'Purpose');
    assert.match(body, /First\./);
    assert.match(body, /Nested stays\./);
    assert.doesNotMatch(body, /Other\./);
});
