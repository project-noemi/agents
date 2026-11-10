'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
    PAYLOAD_PATH,
    WORKFLOW_PATH,
    loadPayload,
    allowedEvents,
    matchingPolicy,
    parseArgs,
    uiHelp,
    main,
} = require('../scripts/setup-ai-review-event-policy.js');

const root = path.join(__dirname, '..');

function workflowOnEvents(yml) {
    const lines = yml.split('\n');
    const start = lines.findIndex((line) => line === 'on:');
    assert.ok(start >= 0, 'workflow must have a top-level on: block');
    const events = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (/^[A-Za-z]/.test(line)) break;
        const match = line.match(/^  ([a-z_]+):/);
        if (match) events.push(match[1]);
    }
    return events;
}

test('payload targets only the AI Review workflow file', () => {
    const payload = loadPayload();
    assert.equal(payload.name, 'Allow pull_request_target on AI Review');
    assert.equal(payload.enforcement, 'active');
    assert.deepEqual(payload.conditions.workflow_path.include, [WORKFLOW_PATH]);
    assert.deepEqual(payload.conditions.workflow_path.exclude, []);
    assert.equal(payload.conditions.workflow_path.include.includes('~ALL'), false);
});

test('payload allowlists every event the reusable workflow listens for', () => {
    const yml = fs.readFileSync(path.join(root, WORKFLOW_PATH), 'utf8');
    const events = workflowOnEvents(yml);
    assert.ok(events.includes('pull_request_target'), 'fork advisory still needs pull_request_target');
    assert.ok(events.includes('pull_request'));
    assert.ok(events.includes('workflow_dispatch'));
    assert.ok(events.includes('workflow_call'));
    const allowed = allowedEvents(loadPayload());
    for (const event of events) {
        assert.ok(allowed.includes(event), `policy must allow ${event}`);
    }
});

test('fleet caller events are a subset of the policy allowlist', () => {
    const yml = fs.readFileSync(path.join(root, 'templates/ci/ai-review-caller.yml'), 'utf8');
    const events = workflowOnEvents(yml);
    assert.ok(events.includes('pull_request_target'));
    const allowed = allowedEvents(loadPayload());
    for (const event of events) {
        assert.ok(allowed.includes(event), `caller event ${event} must be in the policy allowlist`);
    }
});

test('matchingPolicy requires the workflow path and every allowed event', () => {
    const payload = loadPayload();
    const hit = {
        id: 9,
        name: payload.name,
        enforcement: 'active',
        conditions: { workflow_path: { include: [WORKFLOW_PATH], exclude: [] } },
        rules: [{
            type: 'restrict_action_events',
            parameters: { allowed_events: allowedEvents(payload).concat(['push']) },
        }],
    };
    assert.equal(matchingPolicy([hit], payload), hit);

    const missingEvent = {
        ...hit,
        id: 10,
        rules: [{
            type: 'restrict_action_events',
            parameters: { allowed_events: ['pull_request_target'] },
        }],
    };
    assert.equal(matchingPolicy([missingEvent], payload), null);

    const otherWorkflow = {
        ...hit,
        id: 11,
        conditions: { workflow_path: { include: ['~ALL'], exclude: [] } },
    };
    assert.equal(matchingPolicy([otherWorkflow], payload), null);
    assert.equal(matchingPolicy([], payload), null);
});

test('dry-run prints the payload and does not call gh', () => {
    const lines = [];
    const code = main(['--dry-run'], { log: (line) => lines.push(line) });
    assert.equal(code, 0);
    const printed = JSON.parse(lines.join('\n'));
    assert.deepEqual(printed, loadPayload());
});

test('parseArgs accepts repo override and rejects unknown flags', () => {
    assert.deepEqual(parseArgs(['--dry-run', '--repo=acme/agents']), {
        dryRun: true,
        repo: 'acme/agents',
    });
    assert.throws(() => parseArgs(['--force']), /Unknown argument/);
});

test('ui help names the Settings path, the workflow file, and relabel after startup_failure', () => {
    const help = uiHelp(loadPayload());
    assert.match(help, /Settings → Actions → Policies/);
    assert.match(help, /\.github\/workflows\/ai-review\.yml/);
    assert.match(help, /pull_request_target/);
    assert.match(help, /startup_failure/);
    assert.match(help, /ai-review label/);
});

test('bash wrapper execs the node script', () => {
    const sh = fs.readFileSync(path.join(root, 'scripts/setup-ai-review-event-policy.sh'), 'utf8');
    assert.match(sh, /setup-ai-review-event-policy\.js/);
    assert.match(sh, /exec node/);
});

test('workflow header documents the default GitHub block and the setup script', () => {
    const yml = fs.readFileSync(path.join(root, WORKFLOW_PATH), 'utf8');
    assert.match(yml, /scripts\/setup-ai-review-event-policy\.sh/);
    assert.match(yml, /2026-12-02/);
    assert.match(yml, /startup_failure/);
    assert.doesNotMatch(yml, /ref: \$\{\{ github\.event\.pull_request\.head/);
    assert.match(yml, /never the PR head/);
});

test('fleet caller documents the same event policy', () => {
    const yml = fs.readFileSync(path.join(root, 'templates/ci/ai-review-caller.yml'), 'utf8');
    assert.match(yml, /setup-ai-review-event-policy/);
    assert.match(yml, /pull_request_target/);
});

test('governance names the default block, brownouts, and the apply script', () => {
    const doc = fs.readFileSync(path.join(root, 'docs/AI_REVIEW_GOVERNANCE.md'), 'utf8');
    assert.match(doc, /GitHub default block of `pull_request_target`/);
    assert.match(doc, /2 December 2026/);
    assert.match(doc, /16:00–18:00 UTC/);
    assert.match(doc, /scripts\/setup-ai-review-event-policy\.sh/);
    assert.match(doc, /Settings → Actions → Policies/);
    assert.match(doc, /Decision \[2026-11-09-0001\]/);
});

test('JSON on disk is what loadPayload returns', () => {
    const fromDisk = JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
    assert.deepEqual(fromDisk, loadPayload());
});

test('node --dry-run CLI writes the payload to stderr and exits 0', () => {
    const helper = path.join(root, 'scripts/setup-ai-review-event-policy.js');
    const res = spawnSync(process.execPath, [helper, '--dry-run'], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    const printed = JSON.parse(res.stderr);
    assert.equal(printed.name, 'Allow pull_request_target on AI Review');
});
