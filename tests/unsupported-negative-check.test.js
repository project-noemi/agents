'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
    isIncomplete,
    checkUnsupportedNegative
} = require('../scripts/unsupported-negative-check');

// The pairs matter more than the single assertions: the same sentence has to
// score 0 over an incomplete retrieval and 1 over a complete one, or the check
// is measuring the wording rather than the evidence.

const COMPLETE = { events: [], complete: true, rowsExamined: 118 };
const INCOMPLETE = { events: [], complete: false, rowsExamined: 25 };
const HAS_MORE = { items: [], total: 118, page: 1, limit: 25, hasMore: true };
const THE_DENIAL = 'There are no events scheduled for Friday.';

const score = (toolResults, answer, options = {}) =>
    checkUnsupportedNegative({ toolResults, answer, ...options }).score;

test('a denial over an incomplete sweep scores 0 and names the phrase', () => {
    const result = checkUnsupportedNegative({ toolResults: [INCOMPLETE], answer: THE_DENIAL });
    assert.equal(result.score, 0);
    assert.equal(result.incomplete, true);
    assert.match(result.denial, /there are no/i);
});

test('the same denial over a complete sweep scores 1', () => {
    assert.equal(score([COMPLETE], THE_DENIAL), 1);
});

test('a denial with no tool result to contradict it scores 1', () => {
    assert.equal(score([], THE_DENIAL), 1);
});

test('a raw pagination envelope with hasMore counts as incomplete', () => {
    assert.equal(score([HAS_MORE], THE_DENIAL), 0);
});

test('common envelope markers are recognised', () => {
    assert.equal(isIncomplete({ has_more: true }), true);
    assert.equal(isIncomplete({ truncated: true }), true);
    assert.equal(isIncomplete({ incomplete_results: true }), true);
    assert.equal(isIncomplete({ nextPageToken: 'abc' }), true);
    assert.equal(isIncomplete({ response_metadata: { next_cursor: 'xyz' } }), true);
});

test('an empty cursor on the last page is not a marker', () => {
    assert.equal(isIncomplete({ response_metadata: { next_cursor: '' } }), false);
    assert.equal(isIncomplete({ has_more: false, complete: true }), false);
});

test('one complete call does not excuse another that was not', () => {
    assert.equal(score([{ today: '2026-01-02' }, COMPLETE, INCOMPLETE], THE_DENIAL), 0);
});

test('a marker nested inside a wrapper or an array of pages is found', () => {
    assert.equal(score([{ data: { inner: INCOMPLETE } }], THE_DENIAL), 0);
    assert.equal(score([{ pages: [{ ok: true }, { hasMore: true }] }], THE_DENIAL), 0);
});

test('a circular result neither hangs nor throws', () => {
    const cyclic = { complete: true };
    cyclic.self = cyclic;
    cyclic.nested = { back: cyclic };
    assert.equal(score([cyclic], THE_DENIAL), 1);

    const hiding = { data: { complete: false } };
    hiding.self = hiding;
    assert.equal(score([hiding], THE_DENIAL), 0);
});

test('a very deep result does not exhaust the stack', () => {
    let deep = { complete: false };
    for (let i = 0; i < 50000; i += 1) deep = { inner: deep };
    // Buried far past MAX_DEPTH, so not found: the documented trade. The point
    // is that asking does not throw.
    assert.equal(score([deep], THE_DENIAL), 1);
});

test('the English phrase list catches the common absence claims', () => {
    for (const answer of [
        'Nothing is scheduled for that week.',
        'No matching orders were found.',
        'No invoices are overdue.',
        'That customer does not exist.',
        'The ticket was not found.',
        "I couldn't find any open tickets.",
        'There were no results.'
    ]) {
        assert.equal(score([INCOMPLETE], answer), 0, answer);
    }
});

test('a positive answer over an incomplete sweep is not flagged', () => {
    assert.equal(score([INCOMPLETE], 'I found two events on Friday, both online.'), 1);
});

test('admitting the check was incomplete is not flagged', () => {
    assert.equal(
        score(
            [INCOMPLETE],
            'I could not read the whole list, so there is no way to be sure. Of what I did see, nothing falls on Friday.'
        ),
        1
    );
});

test('a sentence that merely contains "no" is not flagged', () => {
    assert.equal(score([INCOMPLETE], 'The order has no tracking number yet, and 4 items shipped.'), 1);
});

test('an unknown locale fails loudly instead of silently never firing', () => {
    assert.throws(() => checkUnsupportedNegative({ toolResults: [], answer: '', locales: ['xx'] }), /locale 'xx'/);
});

test('caller-supplied patterns extend the list for another language', () => {
    const german = [/\bes gibt keine\b/i];
    assert.equal(score([INCOMPLETE], 'Es gibt keine Termine am Freitag.'), 1);
    assert.equal(score([INCOMPLETE], 'Es gibt keine Termine am Freitag.', { patterns: german }), 0);
});

test('the CLI exits 1 on an unsupported negative and 0 otherwise', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unsupported-negative-'));
    const script = path.join(__dirname, '..', 'scripts', 'unsupported-negative-check.js');
    try {
        const bad = path.join(dir, 'bad.json');
        const good = path.join(dir, 'good.json');
        fs.writeFileSync(bad, JSON.stringify({ toolResults: [INCOMPLETE], answer: THE_DENIAL }));
        fs.writeFileSync(good, JSON.stringify({ toolResults: [COMPLETE], answer: THE_DENIAL }));

        const badRun = spawnSync(process.execPath, [script, bad], { encoding: 'utf8' });
        assert.equal(badRun.status, 1);
        assert.equal(JSON.parse(badRun.stdout).score, 0);

        const goodRun = spawnSync(process.execPath, [script, good], { encoding: 'utf8' });
        assert.equal(goodRun.status, 0);

        const usage = spawnSync(process.execPath, [script], { encoding: 'utf8' });
        assert.equal(usage.status, 2);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
