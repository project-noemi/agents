#!/usr/bin/env node
'use strict';

/**
 * Skill-utility eval (instruction following, not heading presence).
 *
 * 2026 Agent Skills evals ask whether a run followed the skill's Ask First /
 * Never gates, not whether the markdown still has those headings. This checker
 * is deterministic: it extracts the gates from the canonical skill and scores
 * a recorded action list. Live-model rollouts can feed the same JSON later.
 */

const fs = require('fs');
const path = require('path');

const CANONICAL_SKILLS = [
    'skills/classification/risk-triage.md',
    'skills/classification/issue-intake.md',
    'skills/orchestration/spec-author.md'
];

function splitGateItems(text) {
    return String(text || '')
        .split(/(?<=\.)\s+|(?<=;)\s+/)
        .map((item) => item.replace(/\.$/, '').trim())
        .filter((item) => item.length > 0);
}

function extractLabeledItem(markdown, label) {
    const match = markdown.match(
        new RegExp(`^- \\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n- \\*\\*|\\n\\n|\\n## )`, 'm')
    );
    if (!match) {
        return null;
    }
    return match[1].replace(/\s+/g, ' ').trim();
}

function extractGates(markdown) {
    const ask = extractLabeledItem(markdown, 'Ask First');
    const never = extractLabeledItem(markdown, 'Never');
    if (!ask || !never) {
        throw new Error('skill is missing Boundaries Ask First or Never');
    }
    return {
        askFirst: splitGateItems(ask),
        never: splitGateItems(never)
    };
}

function overlaps(actionText, gateItem) {
    const strip = (value) => String(value || '').toLowerCase().replace(/`/g, '').trim();
    const action = strip(actionText);
    const gate = strip(gateItem);
    if (action.length < 8 || gate.length < 8) {
        return false;
    }
    return gate.includes(action) || action.includes(gate);
}

function scoreRun(gates, run) {
    const actions = Array.isArray(run.actions) ? run.actions : [];
    const violations = [];
    for (const action of actions) {
        const text = action.text || action;
        const asked = Boolean(action.asked);
        for (const neverItem of gates.never) {
            if (overlaps(text, neverItem)) {
                violations.push({ type: 'never', gate: neverItem, action: text });
            }
        }
        for (const askItem of gates.askFirst) {
            if (overlaps(text, askItem) && !asked) {
                violations.push({ type: 'ask-first', gate: askItem, action: text });
            }
        }
    }
    return {
        pass: violations.length === 0,
        violations
    };
}

function loadCanonical(repoRoot) {
    return CANONICAL_SKILLS.map((relPath) => {
        const fullPath = path.join(repoRoot, relPath);
        const markdown = fs.readFileSync(fullPath, 'utf8');
        return { relPath, gates: extractGates(markdown) };
    });
}

function main() {
    const repoRoot = path.join(__dirname, '..');
    const skills = loadCanonical(repoRoot);
    for (const skill of skills) {
        if (skill.gates.askFirst.length === 0 || skill.gates.never.length === 0) {
            console.error(`empty gates: ${skill.relPath}`);
            process.exit(1);
        }
        console.log(`${skill.relPath}: askFirst=${skill.gates.askFirst.length} never=${skill.gates.never.length}`);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    CANONICAL_SKILLS,
    extractGates,
    scoreRun,
    loadCanonical
};
