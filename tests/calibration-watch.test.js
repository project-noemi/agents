const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseReviewVerdict, latestVerdict, buildCalibrationRow, alreadyLogged,
    isRepoNotFound, tokenAfterRepoProbe, verifyTokenLogin, adoptClassicToken,
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

test('recursion guard: entry branches are exempt from generating entries', () => {
    // Observed live: entry PR #418 merged over a failing framing verdict (its
    // row was still PENDING-HUMAN at review time), spawning meta-entry #420.
    // Without exemption each such merge spawns the next — an unbounded chain.
    // The guard is branch-name-based and lives in main(); this pins the
    // convention the guard keys on so a branch-prefix rename breaks loudly.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'calibration-watch.js'), 'utf8');
    assert.match(src, /startsWith\('calibration\/'\)/, 'guard must key on the entry branch prefix');
    assert.match(src, /`calibration\/pr-\$\{prNumber\}`/, 'entry branches must carry that prefix');
});

test('a visible repo keeps the fine-grained token; a 404 falls back to classic', () => {
    assert.equal(tokenAfterRepoProbe({ visible: true, hasClassic: true }), 'keep');
    assert.equal(tokenAfterRepoProbe({ visible: true, hasClassic: false }), 'keep');
    assert.equal(tokenAfterRepoProbe({ visible: false, hasClassic: true }), 'classic');
    assert.equal(tokenAfterRepoProbe({ visible: false, hasClassic: false }), 'fail');
});

test('only an HTTP 404 counts as the repo being hidden from this token', () => {
    const notFound = Object.assign(new Error('Command failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
    assert.equal(isRepoNotFound(notFound), true);
    const forbidden = Object.assign(new Error('Command failed'), { stderr: 'gh: Resource not accessible by integration (HTTP 403)\n' });
    assert.equal(isRepoNotFound(forbidden), false);
});

test('identity verification: the expected agent login is accepted', () => {
    const result = verifyTokenLogin('noemi-agent', 'noemi-agent');
    assert.equal(result.allowed, true);
    assert.equal(result.reason, '');
});

test('identity verification: a non-expected login is refused', () => {
    const result = verifyTokenLogin('some-other-user', 'noemi-agent');
    assert.equal(result.allowed, false);
    assert.match(result.reason, /some-other-user/);
    assert.match(result.reason, /expected noemi-agent/);
    assert.match(result.reason, /Refusing to open a pull request/);
});

test('identity verification: defaults to noemi-agent when expected is empty', () => {
    const goodResult = verifyTokenLogin('noemi-agent', '');
    assert.equal(goodResult.allowed, true);
    const badResult = verifyTokenLogin('wrong-user', '');
    assert.equal(badResult.allowed, false);
});

test('identity verification: handles whitespace and empty values', () => {
    assert.equal(verifyTokenLogin('  noemi-agent  ', 'noemi-agent').allowed, true);
    assert.equal(verifyTokenLogin('', 'noemi-agent').allowed, false);
});

function hiddenRepo() {
    const err = new Error('Command failed: gh api repos/owner/repo');
    err.stderr = 'gh: Not Found (HTTP 404)\n';
    return err;
}

/** Each call consumes one scripted gh response. An Error is thrown. */
function scriptedGh(responses) {
    const calls = [];
    const gh = (args) => {
        calls.push(args.join(' '));
        if (responses.length === 0) throw new Error(`unexpected gh call: ${args.join(' ')}`);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
    };
    return { gh, calls };
}

test('adoptClassicToken keeps the fine-grained token when the repo is visible', () => {
    const { gh, calls } = scriptedGh(['42\n']);
    const env = { GH_TOKEN: 'fine', AGENT_GH_TOKEN_CLASSIC: 'classic' };
    const result = adoptClassicToken('project-noemi/agents', {
        gh, env, exit: () => { throw new Error('exit'); }, write: () => {},
    });
    assert.equal(result, 'fine-grained');
    assert.equal(env.GH_TOKEN, 'fine');
    assert.equal(calls.length, 1);
});

test('adoptClassicToken adopts classic only after verifyTokenLogin accepts the login', () => {
    const { gh, calls } = scriptedGh([hiddenRepo(), 'noemi-agent\n', '99\n']);
    const env = { GH_TOKEN: 'fine', AGENT_GH_TOKEN_CLASSIC: 'classic' };
    const logs = [];
    const result = adoptClassicToken('newpush/newpush-agents', {
        gh, env, exit: () => { throw new Error('exit'); }, write: (msg) => logs.push(msg),
    });
    assert.equal(result, 'classic');
    assert.equal(env.GH_TOKEN, 'classic');
    assert.ok(calls.some((call) => call.includes('api user')));
    assert.match(logs.join(''), /using AGENT_GH_TOKEN_CLASSIC as noemi-agent/);
});

test('adoptClassicToken refuses a non-agent login and does not continue', () => {
    const { gh, calls } = scriptedGh([hiddenRepo(), 'WSwarm\n', '99\n']);
    const env = { GH_TOKEN: 'fine', AGENT_GH_TOKEN_CLASSIC: 'classic', AGENT_GH_EXPECTED_LOGIN: 'noemi-agent' };
    const exits = [];
    const logs = [];
    const result = adoptClassicToken('newpush/newpush-agents', {
        gh, env, exit: (code) => exits.push(code), write: (msg) => logs.push(msg),
    });
    assert.deepEqual(exits, [2]);
    assert.equal(result, undefined);
    assert.equal(calls.length, 2, 'a refused login must not probe the repo again');
    assert.match(logs.join(''), /WSwarm/);
    assert.match(logs.join(''), /Refusing to open a pull request/);
});

test('workflow wiring: the run step passes both producer tokens into the watch', () => {
    const fs = require('fs');
    const path = require('path');
    const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'calibration-watch.yml'), 'utf8');
    const executable = yml.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
    assert.match(executable, /infisical run --projectId="\$INFISICAL_PROJECT_ID" --env=dev --/);
    assert.match(executable, /GH_TOKEN="\$AGENT_GH_TOKEN"/);
    assert.match(executable, /AGENT_GH_TOKEN_CLASSIC="\$AGENT_GH_TOKEN_CLASSIC"/);
    assert.match(executable, /node scripts\/calibration-watch\.js/);
});
