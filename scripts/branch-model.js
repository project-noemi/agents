#!/usr/bin/env node

// Branch model: where a pull request may point.
//
// `trunks` is an ordered promotion line, lowest first. trunks[0] is the
// contributor entry point (today `develop`); the last entry is the release line
// (today `main`). Every rule below is stated in terms of POSITION, never a
// branch name, so adding a staging or release line is a one-line edit to
// docs/branch-model.json and changes no prose and no code.
//
// Registered integration branches are long-lived branches owned by an
// engagement (see engagements/). They exist so that "a PR may target a specific
// feature branch" cannot degrade into "a PR may target any branch" — an
// unregistered long-lived branch carries none of the mainline-parity controls.

const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.join(__dirname, '..', 'docs', 'branch-model.json');

function loadBranchModel(modelPath = MODEL_PATH) {
    return JSON.parse(fs.readFileSync(modelPath, 'utf8'));
}

function validateModel(model) {
    const errors = [];
    if (!model || typeof model !== 'object') {
        return ['branch model is not an object'];
    }
    if (!Array.isArray(model.trunks) || model.trunks.length < 2) {
        errors.push('trunks must be an ordered array of at least two branch names (lowest first)');
    } else if (new Set(model.trunks).size !== model.trunks.length) {
        errors.push('trunks contains a duplicate branch name');
    }
    if (!Array.isArray(model.integrationBranches)) {
        errors.push('integrationBranches must be an array');
        return errors;
    }
    const seen = new Set();
    for (const entry of model.integrationBranches) {
        if (!entry || typeof entry.branch !== 'string' || entry.branch === '') {
            errors.push('every integration branch entry needs a non-empty "branch"');
            continue;
        }
        if (seen.has(entry.branch)) {
            errors.push(`integration branch "${entry.branch}" is registered twice`);
        }
        seen.add(entry.branch);
        if (Array.isArray(model.trunks) && model.trunks.includes(entry.branch)) {
            errors.push(`"${entry.branch}" is a trunk; it cannot also be an integration branch`);
        }
        if (typeof entry.engagement !== 'string' || entry.engagement === '') {
            errors.push(`integration branch "${entry.branch}" needs an "engagement" slug`);
        }
        if (entry.status !== 'active' && entry.status !== 'closed') {
            errors.push(`integration branch "${entry.branch}" needs status "active" or "closed"`);
        }
    }
    return errors;
}

function activeIntegrationBranches(model) {
    return (model.integrationBranches || []).filter((entry) => entry.status === 'active');
}

// Decide whether a pull request may exist, given its head and base branch.
// Returns { allowed, kind, reason }.
function classifyPullRequest(head, base, model) {
    const trunks = model.trunks || [];
    const lowest = trunks[0];

    if (base === lowest) {
        return { allowed: true, kind: 'lowest-trunk', reason: `${base} is the contributor integration line.` };
    }

    const active = activeIntegrationBranches(model).map((entry) => entry.branch);
    if (active.includes(base)) {
        return { allowed: true, kind: 'integration-branch', reason: `${base} is a registered integration branch.` };
    }

    const trunkIndex = trunks.indexOf(base);
    if (trunkIndex > 0) {
        const below = trunks[trunkIndex - 1];
        if (head === below) {
            return { allowed: true, kind: 'promotion', reason: `${below} -> ${base} is the sanctioned promotion step.` };
        }
        return {
            allowed: false,
            kind: 'trunk-out-of-order',
            reason: `${base} is a promotion target and accepts a pull request only from ${below}. Merge into ${lowest} first.`
        };
    }

    // A closed integration branch is named explicitly — the likeliest cause of a
    // denial here is an engagement that has ended, and that is worth saying.
    const closed = (model.integrationBranches || []).find((entry) => entry.branch === base);
    if (closed) {
        return {
            allowed: false,
            kind: 'integration-branch-closed',
            reason: `${base} belongs to engagement "${closed.engagement}", whose status is "${closed.status}". Target ${lowest} instead.`
        };
    }

    return {
        allowed: false,
        kind: 'unregistered',
        reason: `${base} is neither ${lowest} nor a registered integration branch. Target ${lowest}, or register the branch in docs/branch-model.json with an engagement profile in engagements/.`
    };
}

module.exports = { MODEL_PATH, loadBranchModel, validateModel, activeIntegrationBranches, classifyPullRequest };

if (require.main === module) {
    const [command, head, base] = process.argv.slice(2);
    if (command !== 'check-target') {
        console.error('usage: node scripts/branch-model.js check-target <head-ref> <base-ref>');
        process.exit(2);
    }
    const model = loadBranchModel();
    const modelErrors = validateModel(model);
    if (modelErrors.length > 0) {
        console.error('docs/branch-model.json is invalid:');
        for (const error of modelErrors) console.error(`  - ${error}`);
        process.exit(2);
    }
    const verdict = classifyPullRequest(head, base, model);
    if (!verdict.allowed) {
        console.error(`Invalid pull request target: ${head} -> ${base}`);
        console.error(`   ${verdict.reason}`);
        console.error('   See CONTRIBUTING.md#branching-model.');
        process.exit(1);
    }
    console.log(`Valid target (${verdict.kind}): ${verdict.reason}`);
}
