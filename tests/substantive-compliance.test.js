'use strict';

// Substantive Compliance placeholder gate (Decision [2026-08-18-0002]).
//
// CLAUDE.md · Coding Standards: "The use of 'TBD', 'placeholder', or identical
// boilerplate across the fleet is a substantive drift and is prohibited.
// scripts/audit-repo.js must fail if such placeholders are detected in
// mandatory sections." The seven skills completed in #431 carried TBD for
// months because this check never existed — publication (the skills-dist
// withhold) caught it, the audit did not. These tests pin the gate shut.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
    findPlaceholderViolations,
    discoverAgents,
    discoverSkills
} = require('../scripts/context_helpers');

const repoRoot = path.join(__dirname, '..');

const SKILL_SECTIONS = [
    'Purpose', 'Inputs', 'Procedure', 'Outputs', 'Data Inventory',
    'Rules & Constraints (4D Diligence)', 'Boundaries', 'Audit Log'
];

test('flags TBD in a mandatory section and names the section', () => {
    const md = '# X — Skill\n\n## Purpose\nReal content.\n\n## Data Inventory\n- **Inputs:** TBD\n';
    const violations = findPlaceholderViolations(md, ['Purpose', 'Data Inventory']);
    assert.deepStrictEqual(violations, [{ section: 'Data Inventory', marker: 'TBD' }]);
});

test('scans subsections nested under a mandatory H2 (Refusal Criteria)', () => {
    const md = '## Rules & Constraints (4D Diligence)\n1. Real rule.\n### Refusal Criteria\n- **Task Refusal:** TBD\n\n## Boundaries\n- Real.\n';
    const violations = findPlaceholderViolations(md, ['Rules & Constraints (4D Diligence)']);
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].marker, 'TBD');
});

test('ignores TBD inside fenced code blocks (the Audit Log JSON skeleton is mandated shape)', () => {
    const md = '## Audit Log\n\n```json\n{\n  "task": "TBD",\n  "inputs": []\n}\n```\n';
    assert.deepStrictEqual(findPlaceholderViolations(md, ['Audit Log']), []);
});

test('ignores TBD outside mandatory sections (the standard scopes to mandatory)', () => {
    const md = '## Purpose\nReal.\n\n## Journal\nTBD — optional notes.\n';
    assert.deepStrictEqual(findPlaceholderViolations(md, ['Purpose']), []);
});

test('flags whole-line filler values that avoid the literal TBD', () => {
    for (const filler of ['placeholder', 'TODO', 'FIXME']) {
        const md = `## Data Inventory\n- **Outputs:** ${filler}\n`;
        const violations = findPlaceholderViolations(md, ['Data Inventory']);
        assert.strictEqual(violations.length, 1, `expected '${filler}' to be flagged`);
        assert.strictEqual(violations[0].marker, filler);
    }
});

test('does not flag prose that mentions placeholders as a real concept', () => {
    // Live example: pii-scan's Boundaries mandate "typed placeholders that
    // indicate what was redacted" — legitimate content, not filler.
    const md = '## Boundaries\n- **Always:** Use typed placeholders that indicate what was redacted.\n';
    assert.deepStrictEqual(findPlaceholderViolations(md, ['Boundaries']), []);
});

test('matches headings case-insensitively and tolerates the (4D Diligence) suffix', () => {
    const md = '## RULES & CONSTRAINTS (4D Diligence)\n- **Task Refusal:** TBD\n';
    const violations = findPlaceholderViolations(md, ['Rules & Constraints']);
    assert.strictEqual(violations.length, 1);
});

test('live fleet carries zero placeholder violations in mandatory sections', () => {
    const offenders = [];
    for (const agent of discoverAgents(path.join(repoRoot, 'agents'))) {
        const content = fs.readFileSync(path.join(repoRoot, agent.path), 'utf8');
        for (const v of findPlaceholderViolations(content, ['Role', 'Rules & Constraints', 'Boundaries', 'Workflow', 'Audit Log'])) {
            offenders.push(`${agent.path} · ${v.section} (${v.marker})`);
        }
    }
    for (const skill of discoverSkills(path.join(repoRoot, 'skills'))) {
        const content = fs.readFileSync(skill.path, 'utf8');
        for (const v of findPlaceholderViolations(content, SKILL_SECTIONS)) {
            offenders.push(`${path.relative(repoRoot, skill.path)} · ${v.section} (${v.marker})`);
        }
    }
    assert.deepStrictEqual(offenders, [], `placeholder content in mandatory sections:\n${offenders.join('\n')}`);
});

test('audit gate fails end-to-end when a skill carries a placeholder', () => {
    // Plant a spec that is complete in structure but placeholder in content,
    // so the ONLY new failure mode is the Substantive Compliance gate. The
    // planted file carries TBD, so the skills-dist builder withholds it and
    // the determinism check stays green — isolating the gate under test.
    const planted = path.join(repoRoot, 'skills', 'verification', 'zz-substantive-selftest.md');
    const donor = fs.readFileSync(path.join(repoRoot, 'skills', 'classification', 'risk-triage.md'), 'utf8');
    const spec = donor.replace(
        '- **Inputs:** `item` (entity under classification), `criteria` (calling agent\'s tier rules), `tiers` (tier set, default Safe / Needs Review / Blocked), `escape_hatch` (optional skip flag)',
        '- **Inputs:** TBD'
    );
    assert.ok(spec.includes('- **Inputs:** TBD'), 'fixture surgery failed — donor text moved');
    try {
        fs.writeFileSync(planted, spec);
        const result = spawnSync('node', ['scripts/audit-repo.js'], { cwd: repoRoot, encoding: 'utf8' });
        assert.strictEqual(result.status, 1, 'audit must exit 1 on a planted placeholder');
        assert.match(result.stderr, /zz-substantive-selftest\.md 'Data Inventory' contains placeholder content \('TBD'\)/);
    } finally {
        fs.rmSync(planted, { force: true });
    }
});
