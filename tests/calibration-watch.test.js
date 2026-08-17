const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseReviewVerdict, latestVerdict, buildCalibrationRow, alreadyLogged,
} = require('../scripts/calibration-watch.js');

// Real comment shapes from renderComment() in scripts/review-pr.js.
const FAILING = `## AI Review — advisory (phase 1)

**Model:** \`publishers/google/models/gemini-3.7-flash\` · **Reviewed:** 2026-08-14T22:21:00Z

| Gate | 4D | Verdict |
|---|---|---|
| premise | Delegation | ❌ fail |
| framing | Description | ⏭️ skipped |
| code | Diligence | ⏭️ skipped |

### Findings (1)

- **high** · \`README.md:180\` · _premise_ — The PR modifies 43 files while the description claims one doc file.

_Advisory only._`;

const PASSING = `## AI Review — advisory (phase 1)

**Model:** \`publishers/google/models/gemini-3.1-pro-preview\` · **Reviewed:** now

| Gate | 4D | Verdict |
|---|---|---|
| premise | Delegation | ✅ pass |
| framing | Description | ✅ pass |
| code | Diligence | ✅ pass |

**No findings.**`;

const HALT = `### AI review halted — governance carve-out

This pull request touches controls that constrain agents:
- \`docs/MACHINE_IDENTITY.md\``;

test('a failing review parses with gate, model, and the finding claim', () => {
    const v = parseReviewVerdict(FAILING);
    assert.ok(v && v.failing);
    assert.deepEqual(v.gates, ['premise']);
    assert.match(v.model, /gemini-3\.7-flash/);
    assert.match(v.claim, /43 files/);
});

test('a passing review parses as non-failing; a halt is not a verdict at all', () => {
    assert.equal(parseReviewVerdict(PASSING).failing, false);
    // A carve-out halt escalates to a human — there is no verdict to override,
    // so merging after a halt is not a calibration event.
    assert.equal(parseReviewVerdict(HALT), null);
});

test('the LATEST verdict wins: fail-then-pass is agreement, not override', () => {
    // #408's real shape: early rounds failed, the final round passed before
    // merge. Logging that as an override would poison the evidence base.
    const v = latestVerdict([
        { login: 'noemi-reviewer-bot[bot]', body: FAILING },
        { login: 'noemi-reviewer-bot[bot]', body: PASSING },
    ]);
    assert.equal(v.failing, false);
});

test('legacy user-PAT comments (noemi-reviewer) still count', () => {
    const v = latestVerdict([{ login: 'noemi-reviewer', body: FAILING }]);
    assert.ok(v && v.failing);
});

test('non-reviewer comments are ignored even if they quote a review', () => {
    assert.equal(latestVerdict([{ login: 'WSwarm', body: FAILING }]), null);
});

test('the pre-filled row escapes pipes and demands human editing', () => {
    const row = buildCalibrationRow({
        date: '2026-08-14', prNumber: 392,
        verdict: { gates: ['premise'], model: 'gemini-3.7-flash', claim: 'a | b claims' },
    });
    assert.match(row, /^\| 2026-08-14 \| #392 \| gemini-3\.7-flash \| premise \|/);
    assert.match(row, /a \\\| b/);
    assert.match(row, /\*\*merged over\*\*/);
    assert.match(row, /PENDING-HUMAN/);
});

test('dedup: an existing row for the PR is detected', () => {
    const log = '## Log\n\n| Date | PR | ... |\n|---|---|---|\n| 2026-08-14 | #392 | m | g | s | h | d | r |\n';
    assert.equal(alreadyLogged(log, 392), true);
    assert.equal(alreadyLogged(log, 393), false);
    assert.equal(alreadyLogged(log, 39), false, 'must not prefix-match #392');
});
