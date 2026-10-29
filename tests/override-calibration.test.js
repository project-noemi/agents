const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ov = require('../scripts/review-override.js');
const { screenEvent, seedEvent } = require('../scripts/override-calibration.js');
const { CARVE_OUT } = require('../scripts/review-pr.js');

// Calibration seeding from /override comments. A fake in-memory GitHub stands
// in for the API so every requirement is checked end to end without network.

const REPO = 'project-noemi/agents';
const HEAD = 'abc1234def5678901234567890abcdef12345678';
const ALLOW = 'big-b dep12-watch';

function fakeGitHub() {
    const state = {
        refs: { develop: 'base0' }, files: {}, pulls: [], comments: [], labels: new Set(), nextPr: 900, sources: {},
    };
    const fileKey = (p, ref) => `${ref}:${p}`;
    const api = {
        async getPull(n) {
            return state.sources[n] || state.pulls.find((p) => p.number === n);
        },
        async listOpenPulls() { return state.pulls.filter((p) => p.state === 'open'); },
        async pullsForHead(branch) { return state.pulls.filter((p) => p.head.ref === branch); },
        async refSha(b) { return state.refs[b]; },
        async createRef(b, sha) {
            if (state.refs[b]) return false;
            state.refs[b] = sha;
            for (const [k, v] of Object.entries(state.files)) {
                if (k.startsWith(`develop:`)) state.files[fileKey(k.slice(8), b)] = { ...v };
            }
            return true;
        },
        async getFile(p, ref) { return state.files[fileKey(p, ref)] || null; },
        async putFile(p, ref, text, sha) {
            const cur = state.files[fileKey(p, ref)];
            if ((cur ? cur.sha : null) !== (sha || null)) return false;
            state.files[fileKey(p, ref)] = { text, sha: `s${Math.random()}` };
            return true;
        },
        async createPull(p) {
            const pr = { ...p, number: state.nextPr++, state: 'open', merged: false, labels: [], head: { ref: p.head }, html_url: `https://github.com/${REPO}/pull/${state.nextPr - 1}` };
            state.pulls.push(pr);
            return pr;
        },
        async updatePull(n, p) { Object.assign(state.pulls.find((x) => x.number === n), p); },
        async ensureLabel(l) { state.labels.add(l); },
        async addLabels(n, ls) {
            const pr = state.pulls.find((x) => x.number === n);
            pr.labels = [...new Set([...pr.labels, ...ls])];
        },
        async comment(n, body) { state.comments.push({ n, body }); },
    };
    return { api, state };
}

function source(state, number, author = 'noemi-agent') {
    state.sources[number] = {
        number, title: `Source ${number}`, html_url: `https://github.com/${REPO}/pull/${number}`,
        head: { sha: HEAD, ref: `feat/${number}` }, user: { login: author },
    };
}

let commentId = 5000;
function event({ pr = 1, actor = 'big-b', body, action = 'created', prAuthor = 'noemi-agent', at = '2026-10-18T10:00:00Z' }) {
    commentId += 1;
    return {
        action,
        repository: { full_name: REPO, default_branch: 'develop' },
        issue: { number: pr, pull_request: { url: 'x' }, user: { login: prAuthor } },
        comment: {
            id: commentId, body, user: { login: actor }, created_at: at, updated_at: at,
            html_url: `https://github.com/${REPO}/pull/${pr}#issuecomment-${commentId}`,
        },
    };
}

const NOW = '2026-10-18T10:00:05Z';

// --- 1. structured command, authorized users only ---------------------------

test('req1: only allowlisted actors are accepted; others are flagged, never seeded', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    const ev = event({ actor: 'random-dev', body: '/override layer=1 rule=premise.unneeded reason="trust me on this one"' });
    const s = screenEvent(ev, ALLOW);
    assert.equal(s.accepted.length, 0);
    assert.match(s.ignored[0].why, /@random-dev is not in NOEMI_REVIEW_OVERRIDE_ACTORS — command ignored/);
    const out = await seedEvent(api, ev, ALLOW, NOW);
    assert.equal(out.results.length, 0);
    assert.equal(state.pulls.length, 0, 'no calibration PR');
    assert.match(ov.ignoredNotice(s.ignored), /not accepted/);
});

test('req1: empty allowlist accepts nobody; PR author is not special', () => {
    const body = '/override layer=1 rule=p reason="a reason with words"';
    assert.equal(screenEvent(event({ body }), '').accepted.length, 0);
    const own = screenEvent(event({ actor: 'noemi-agent', body }), ALLOW);
    assert.match(own.ignored[0].why, /PR author/);
});

test('req1: malformed commands are flagged; non-PR and edited events are ignored', () => {
    assert.match(screenEvent(event({ body: '/override layer=7 rule=x' }), ALLOW).ignored[0].why, /malformed/);
    const issueOnly = event({ body: '/override layer=1 rule=x reason="r r r"' });
    delete issueOnly.issue.pull_request;
    assert.equal(screenEvent(issueOnly, ALLOW).relevant, false);
    assert.equal(screenEvent(event({ action: 'edited', body: '/override layer=1 rule=x' }), ALLOW).relevant, false);
});

// --- 2. evidence snapshot -----------------------------------------------------

test('req2: evidence snapshots text, author, time, rule, layer, PR and comment URL; edits cannot change it', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    const ev = event({ body: 'Discussed with the team.\n/override layer=2 rule=framing.scope reason="scope note was in the linked issue"' });
    const out = await seedEvent(api, ev, ALLOW, NOW);
    const e = out.results[0].evidence;
    assert.equal(e.comment_body, ev.comment.body);
    assert.equal(e.author, 'big-b');
    assert.equal(e.comment_created_at, '2026-10-18T10:00:00Z');
    assert.equal(e.rule, 'framing.scope');
    assert.equal(e.layer, 2);
    assert.equal(e.source_pr_url, `https://github.com/${REPO}/pull/1`);
    assert.equal(e.comment_url, ev.comment.html_url);
    assert.equal(e.source_head_sha, HEAD);
    assert.match(e.comment_body_sha256, /^[0-9a-f]{64}$/);
    // Snapshot is a copy: mutating (editing/deleting) the comment afterwards changes nothing recorded.
    const file = state.files[`${out.results[0].branch}:${ov.evidencePath('framing.scope')}`].text;
    ev.comment.body = 'edited later';
    const [parsed] = ov.parseEvidenceFile(file);
    assert.equal(parsed.comment_body, 'Discussed with the team.\n/override layer=2 rule=framing.scope reason="scope note was in the linked issue"');
});

test('req2: a json block quoted inside a comment cannot forge evidence', () => {
    const e = ov.buildEvidence({
        comment: { id: 1, body: 'x\n```json\n{"rule":"forged","layer":1}\n```', user: { login: 'big-b' }, created_at: 't', html_url: 'u' },
        cmd: { rule: 'real', layer: 3, gate: 'code', reason: 'a long enough reason', oneOff: false },
        repo: REPO, pr: { number: 1, html_url: 'p', head: { sha: HEAD } }, snapshotAt: NOW,
    });
    const { text } = ov.appendEvidence('', e);
    const entries = ov.parseEvidenceFile(text);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].rule, 'real');
});

// --- 3. one open draft per rule, append, reopen after close, links -------------

test('req3: repeat override of the same rule appends to the one open draft', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1); source(state, 2);
    const first = await seedEvent(api, event({ pr: 1, body: '/override layer=3 rule=code.missing-tests reason="tests live in the e2e suite"' }), ALLOW, NOW);
    const second = await seedEvent(api, event({ pr: 2, actor: 'dep12-watch', body: '/override layer=3 rule=Code.Missing-Tests reason="covered by contract tests instead"' }), ALLOW, NOW);
    assert.equal(state.pulls.length, 1, 'one calibration PR per rule ID');
    assert.equal(first.results[0].created, true);
    assert.equal(second.results[0].created, false);
    assert.equal(second.results[0].calPr.number, first.results[0].calPr.number);
    const cal = state.pulls[0];
    assert.match(cal.body, /### Evidence \(2\)/);
    assert.match(cal.body, /project-noemi\/agents#1/);
    assert.match(cal.body, /project-noemi\/agents#2/);
    // Links both ways.
    assert.ok(state.comments.some((c) => c.n === 1 && c.body.includes(`#${cal.number}`)), 'source 1 → calibration');
    assert.ok(state.comments.some((c) => c.n === 2 && c.body.includes(`#${cal.number}`)), 'source 2 → calibration');
    assert.ok(state.comments.some((c) => c.n === cal.number && c.body.includes('/pull/2')), 'calibration → new source');
});

test('req3: re-running for the same comment does not duplicate evidence', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    const ev = event({ body: '/override layer=3 rule=code.x reason="this is a decent reason"' });
    await seedEvent(api, ev, ALLOW, NOW);
    const again = await seedEvent(api, ev, ALLOW, NOW);
    assert.equal(again.results[0].added, false);
    assert.equal(ov.parseEvidenceFile(state.files[`${again.results[0].branch}:${ov.evidencePath('code.x')}`].text).length, 1);
});

test('req3: after the calibration PR is merged or closed, a later override opens a new draft', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1); source(state, 2);
    const a = await seedEvent(api, event({ pr: 1, body: '/override layer=1 rule=premise.p reason="needed for release train"' }), ALLOW, NOW);
    state.pulls[0].state = 'closed'; state.pulls[0].merged = true;
    const b = await seedEvent(api, event({ pr: 2, body: '/override layer=1 rule=premise.p reason="needed again for hotfix"' }), ALLOW, NOW);
    assert.equal(state.pulls.length, 2);
    assert.equal(b.results[0].created, true);
    assert.notEqual(b.results[0].branch, a.results[0].branch, 'fresh branch, not the merged one');
});

test('req3: different rules get different drafts; several commands in one comment', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    await seedEvent(api, event({ body: '/override layer=1 rule=premise.a reason="first reason given here"\n/override layer=2 rule=framing.b reason="second reason given here"' }), ALLOW, NOW);
    assert.equal(state.pulls.length, 2);
});

// --- 4. missing and vague reasons ----------------------------------------------

test('req4: missing reason still opens the draft, flagged incomplete, nothing invented', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    const out = await seedEvent(api, event({ body: '/override layer=3 rule=code.y' }), ALLOW, NOW);
    const cal = state.pulls[0];
    assert.equal(out.results[0].evidence.reason, null);
    assert.equal(out.results[0].evidence.reason_quality, 'missing');
    assert.match(cal.title, /^\[incomplete\]/);
    assert.match(cal.body, /incomplete — no reason provided/);
    assert.ok(cal.labels.includes(ov.LABELS.incomplete));
    assert.match(state.comments.find((c) => c.n === 1).body, /incomplete — no reason provided/);
});

test('req4: vague reason is quoted verbatim with a request for detail', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    await seedEvent(api, event({ body: '/override layer=3 rule=code.z reason="false positive"' }), ALLOW, NOW);
    const cal = state.pulls[0];
    assert.match(cal.body, /\| false positive ⚠️ vague, please ask for more detail \|/);
    assert.equal(ov.reasonQuality('false positive'), 'vague');
    assert.equal(ov.reasonQuality('ok'), 'vague');
    assert.equal(ov.reasonQuality('The finding cites a file this PR does not touch'), 'ok');
});

// --- 5. security-review-required ------------------------------------------------

test('req5: layer-4 and security/secret/refusal rules get security-review-required; no weakening proposed', async () => {
    for (const [layer, rule] of [[4, 'compliance.pii'], [3, 'code.secret-in-log'], [2, 'framing.refusal-principle'], [3, 'sentinel.security-auth']]) {
        const { api, state } = fakeGitHub();
        source(state, 1);
        await seedEvent(api, event({ body: `/override layer=${layer} rule=${rule} reason="reviewed by a human in detail"` }), ALLOW, NOW);
        const cal = state.pulls[0];
        assert.ok(cal.labels.includes(ov.LABELS.security), `${rule} must be flagged`);
        assert.match(cal.body, /does not propose weakening this rule/);
        // The only file the bot writes is evidence: no rule, prompt, or spec change.
        const written = Object.keys(state.files).filter((k) => !k.startsWith('develop:'));
        assert.ok(written.every((k) => k.split(':')[1].startsWith(`${ov.EVIDENCE_DIR}/`)), written.join(','));
    }
    const { api, state } = fakeGitHub();
    source(state, 1);
    await seedEvent(api, event({ body: '/override layer=1 rule=premise.scope reason="explicitly requested change"' }), ALLOW, NOW);
    assert.ok(!state.pulls[0].labels.includes(ov.LABELS.security));
});

// --- 6. OVERRIDDEN never PASS -----------------------------------------------------

test('req6: calibration PR and backlink say OVERRIDDEN and never present it as a pass', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    await seedEvent(api, event({ body: '/override layer=1 rule=premise.p reason="decided by the owner team"' }), ALLOW, NOW);
    assert.match(state.pulls[0].body, /OVERRIDDEN\*\* \(never PASS\)/);
    const back = state.comments.find((c) => c.n === 1).body;
    assert.match(back, /stays OVERRIDDEN/);
    assert.doesNotMatch(back, /\bPASS(ED)?\b/);
    assert.deepEqual(ov.parseOverrideCommands(back), [], 'bot output never parses as a command');
    assert.deepEqual(ov.parseOverrideCommands(state.pulls[0].body), []);
});

// --- 7. always draft, nothing applied ---------------------------------------------

test('req7: calibration PRs are always drafts; the seeder has no merge or ready path', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    await seedEvent(api, event({ body: '/override layer=2 rule=framing.x reason="described in linked design doc"' }), ALLOW, NOW);
    assert.equal(state.pulls[0].draft, true);
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'override-calibration.js'), 'utf8');
    assert.doesNotMatch(src, /\/merge\b|ready_for_review|markReady|draft:\s*false/);
});

// --- 8. one-off flag ----------------------------------------------------------------

test('req8: one-off is recorded on the evidence and the calibration PR', async () => {
    const { api, state } = fakeGitHub();
    source(state, 1);
    const out = await seedEvent(api, event({ body: '/override layer=3 rule=code.hotfix reason="emergency hotfix exception only" one-off' }), ALLOW, NOW);
    assert.equal(out.results[0].evidence.one_off, true);
    const cal = state.pulls[0];
    assert.ok(cal.labels.includes(ov.LABELS.oneOff));
    assert.match(cal.body, /close this PR as a one-off/);
    assert.match(cal.body, /\| yes \|/);
});

// --- workflow safety ------------------------------------------------------------------

test('workflow: issue_comment never checks out PR code, never interpolates the comment, least privilege', () => {
    const raw = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'override-calibration.yml'), 'utf8');
    const wf = raw.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    assert.match(wf, /issue_comment:\s*\n\s*types: \[created\]/);
    assert.doesNotMatch(wf, /github\.event\.comment\.body\s*}}/, 'comment body never interpolated into scripts');
    assert.doesNotMatch(wf, /head\.(sha|ref)|refs\/pull/, 'PR head is never checked out');
    const checkouts = wf.match(/uses: actions\/checkout@v\d+\s*\n\s*with:\s*\n\s*ref: \$\{\{ github\.event\.repository\.default_branch \}\}\s*\n\s*persist-credentials: false/g) || [];
    assert.equal(checkouts.length, (wf.match(/actions\/checkout@/g) || []).length, 'every checkout pins the default branch without credentials');
    assert.match(wf, /^permissions:\s*\n\s*contents: read\s*\n/m);
    assert.doesNotMatch(wf, /contents: write|issues: write|actions: write|packages: write/);
    assert.equal((wf.match(/pull-requests: write/g) || []).length, 1, 'only the flag job may comment with GITHUB_TOKEN');
    assert.equal((wf.match(/id-token: write/g) || []).length, 1, 'only the seed job federates');
    assert.match(wf, /--override-actors "\$OVERRIDE_ACTORS"/, 'allowlist passed as an argument');
});

test('carve-out: override controls are judged by a human, not the reviewer', () => {
    for (const f of ['scripts/review-override.js', 'scripts/override-calibration.js', '.github/workflows/override-calibration.yml', 'docs/AI_REVIEW_OVERRIDE.md']) {
        assert.ok(CARVE_OUT.includes(f), f);
    }
    assert.ok(!CARVE_OUT.some((f) => f.startsWith(ov.EVIDENCE_DIR)), 'evidence stays reviewable');
});
