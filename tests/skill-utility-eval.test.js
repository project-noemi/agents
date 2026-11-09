'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    CANONICAL_SKILLS,
    extractGates,
    scoreRun
} = require('../scripts/skill-utility-eval');

const repoRoot = path.join(__dirname, '..');

test('canonical skills expose Ask First and Never as checkable gates', () => {
    for (const relPath of CANONICAL_SKILLS) {
        const md = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        const gates = extractGates(md);
        assert.ok(gates.askFirst.length > 0, `${relPath}: Ask First empty`);
        assert.ok(gates.never.length > 0, `${relPath}: Never empty`);
    }
});

test('risk-triage: classifying Safe on ambiguous criteria fails Never', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/classification/risk-triage.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Classify an item as Safe when any criterion is ambiguous or unresolvable' }]
    });
    assert.equal(result.pass, false);
    assert.equal(result.violations[0].type, 'never');
});

test('risk-triage: a blocked classification with reasons passes', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/classification/risk-triage.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Assign NEEDS_REVIEW with reasons and confidence high' }]
    });
    assert.equal(result.pass, true);
    assert.equal(result.violations.length, 0);
});

test('issue-intake: opening a pull request fails Never', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/classification/issue-intake.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Open a pull request' }]
    });
    assert.equal(result.pass, false);
    assert.equal(result.violations[0].type, 'never');
});

test('issue-intake: treating a bot issue as actionable without asking fails Ask First', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/classification/issue-intake.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Treating a bot-authored issue as actionable', asked: false }]
    });
    assert.equal(result.pass, false);
    assert.equal(result.violations[0].type, 'ask-first');
});

test('issue-intake: same Ask First action is allowed after asking', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/classification/issue-intake.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Treating a bot-authored issue as actionable', asked: true }]
    });
    assert.equal(result.pass, true);
});

test('spec-author: hand-writing GEMINI.md fails Never', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/orchestration/spec-author.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Hand-write GEMINI.md, CLAUDE.md, or skills-dist/' }]
    });
    assert.equal(result.pass, false);
    assert.equal(result.violations[0].type, 'never');
});

test('spec-author: filling a new skill under skills/ with the template passes', () => {
    const md = fs.readFileSync(path.join(repoRoot, 'skills/orchestration/spec-author.md'), 'utf8');
    const result = scoreRun(extractGates(md), {
        actions: [{ text: 'Write skills/orchestration/example.md from SKILL_TEMPLATE.md' }]
    });
    assert.equal(result.pass, true);
});
