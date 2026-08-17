const test = require('node:test');
const assert = require('node:assert/strict');

const { decideVerdict } = require('../scripts/pr-merge-gate.js');

// The gate governs the scheduled session's finish (Decision [2026-08-17-0002]):
// verdict-first, one remediation round, arm-don't-merge, escalate otherwise.

const GREEN = { pending: [], failing: [] };
const OPEN = { prState: 'open', merged: false };
const PASS = { failing: false, gates: [], claim: '' };
const FAIL = { failing: true, gates: ['code'], claim: 'cache key collision' };

test('red checks escalate even with a passing review — remediation is not licensed to fix CI', () => {
    const v = decideVerdict({
        ...OPEN,
        checks: { pending: [], failing: ['Audit, Generate, and Fast Tests'] },
        review: PASS, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(v.verdict, 'ESCALATED');
    assert.match(v.reason, /Audit/);
});

test('no verdict + review still running → wait, not retrigger', () => {
    const v = decideVerdict({ ...OPEN, checks: GREEN, review: null, reviewCheckRunning: true, remediationAttempted: false });
    assert.equal(v.verdict, 'WAIT_CHECKS');
});

test('no verdict + nothing running → retrigger (the outage case)', () => {
    const v = decideVerdict({ ...OPEN, checks: GREEN, review: null, reviewCheckRunning: false, remediationAttempted: false });
    assert.equal(v.verdict, 'RETRIGGERED');
});

test('failing verdict → exactly one remediation round', () => {
    const first = decideVerdict({ ...OPEN, checks: GREEN, review: FAIL, reviewCheckRunning: false, remediationAttempted: false });
    assert.equal(first.verdict, 'REMEDIATE');
    const second = decideVerdict({ ...OPEN, checks: GREEN, review: FAIL, reviewCheckRunning: false, remediationAttempted: true });
    assert.equal(second.verdict, 'ESCALATED');
    assert.match(second.reason, /one permitted remediation round/);
});

test('passing verdict but checks pending → wait; all green → arm auto-merge', () => {
    const waiting = decideVerdict({
        ...OPEN,
        checks: { pending: ['Docker Smoke Validation'], failing: [] },
        review: PASS, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(waiting.verdict, 'WAIT_CHECKS');
    const done = decideVerdict({ ...OPEN, checks: GREEN, review: PASS, reviewCheckRunning: false, remediationAttempted: false });
    assert.equal(done.verdict, 'ARMED_AUTOMERGE');
});

test('a human-closed PR is terminal: never reopened, never escalated (the finding scenario)', () => {
    // Exact shape from the review finding: human closes the PR, its checks are
    // cancelled, so review === null and nothing is running — which is also
    // exactly what an outage looks like. Without the state check the gate
    // answers RETRIGGERED and its close/REOPEN overrides the human's decision.
    const v = decideVerdict({
        prState: 'closed', merged: false,
        checks: GREEN, review: null, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(v.verdict, 'PR_CLOSED');
    assert.match(v.reason, /never reopens/);
});

test('PR state precedes every other heuristic, even a passing review with green checks', () => {
    const v = decideVerdict({
        prState: 'closed', merged: false,
        checks: GREEN, review: PASS, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(v.verdict, 'PR_CLOSED', 'a closed PR must never be armed for auto-merge');
});

test('an already-merged PR is terminal with nothing to do', () => {
    const v = decideVerdict({
        prState: 'closed', merged: true,
        checks: GREEN, review: PASS, reviewCheckRunning: false, remediationAttempted: false,
    });
    assert.equal(v.verdict, 'ALREADY_MERGED');
});

test('pagination: the latest verdict beyond page 1 is not silently dropped (the finding scenario)', async () => {
    // Issue comments return OLDEST-first: with >100 comments, an unpaginated
    // fetch keeps only the stale early pages and the gate judges on a missing
    // or outdated verdict. apiAll must walk every page.
    const { apiAll } = require('../scripts/pr-merge-gate.js');
    process.env.AGENT_GH_TOKEN = process.env.AGENT_GH_TOKEN || 'test-token';
    const realFetch = global.fetch;
    const pageOf = (n, from) => Array.from({ length: n }, (_, i) => ({ id: from + i }));
    global.fetch = async (url) => {
        const page = Number(new URL(url).searchParams.get('page'));
        const body = page === 1 ? pageOf(100, 0) : page === 2 ? pageOf(3, 100) : [];
        return { ok: true, status: 200, json: async () => body, text: async () => '' };
    };
    try {
        const all = await apiAll('/repos/o/r/issues/1/comments', (b) => b);
        assert.equal(all.length, 103, 'both pages must be collected');
        assert.equal(all[102].id, 102, 'the newest items live on the last page');
    } finally {
        global.fetch = realFetch;
    }
});

test('pagination: a short first page stops after one request', async () => {
    const { apiAll } = require('../scripts/pr-merge-gate.js');
    process.env.AGENT_GH_TOKEN = process.env.AGENT_GH_TOKEN || 'test-token';
    const realFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
        calls += 1;
        return { ok: true, status: 200, json: async () => [{ id: 1 }], text: async () => '' };
    };
    try {
        const all = await apiAll('/repos/o/r/issues/1/comments', (b) => b);
        assert.equal(all.length, 1);
        assert.equal(calls, 1, 'no needless second page');
    } finally {
        global.fetch = realFetch;
    }
});
