const test = require('node:test');
const assert = require('node:assert/strict');

const { decideVerdict } = require('../scripts/pr-merge-gate.js');

// The gate governs the scheduled session's finish (Decision [2026-08-17-0002]):
// verdict-first, one remediation round, arm-don't-merge, escalate otherwise.

const GREEN = { pending: [], failing: [] };
const PASS = { failing: false, gates: [], claim: '' };
const FAIL = { failing: true, gates: ['code'], claim: 'cache key collision' };

test('red checks escalate even with a passing review — remediation is not licensed to fix CI', () => {
    const v = decideVerdict({
        checks: { pending: [], failing: ['Audit, Generate, and Fast Tests'] },
        review: PASS, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(v.verdict, 'ESCALATED');
    assert.match(v.reason, /Audit/);
});

test('no verdict + review still running → wait, not retrigger', () => {
    const v = decideVerdict({ checks: GREEN, review: null, reviewCheckRunning: true, remediationAttempted: false });
    assert.equal(v.verdict, 'WAIT_CHECKS');
});

test('no verdict + nothing running → retrigger (the outage case)', () => {
    const v = decideVerdict({ checks: GREEN, review: null, reviewCheckRunning: false, remediationAttempted: false });
    assert.equal(v.verdict, 'RETRIGGERED');
});

test('failing verdict → exactly one remediation round', () => {
    const first = decideVerdict({ checks: GREEN, review: FAIL, reviewCheckRunning: false, remediationAttempted: false });
    assert.equal(first.verdict, 'REMEDIATE');
    const second = decideVerdict({ checks: GREEN, review: FAIL, reviewCheckRunning: false, remediationAttempted: true });
    assert.equal(second.verdict, 'ESCALATED');
    assert.match(second.reason, /one permitted remediation round/);
});

test('passing verdict but checks pending → wait; all green → arm auto-merge', () => {
    const waiting = decideVerdict({
        checks: { pending: ['Docker Smoke Validation'], failing: [] },
        review: PASS, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(waiting.verdict, 'WAIT_CHECKS');
    const done = decideVerdict({ checks: GREEN, review: PASS, reviewCheckRunning: false, remediationAttempted: false });
    assert.equal(done.verdict, 'ARMED_AUTOMERGE');
});
