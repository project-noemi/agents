const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseOverrideActors,
    parseOverrideCommands,
    evaluateOverrides,
    runGates,
    recommend,
    renderComment,
    buildRemediationPrompt,
    isContinuedOverride,
    OVERRIDE_CONTINUE_GATES,
    GATES,
} = require('../scripts/review-pr.js');

// Override mode: an allowlisted human's PR comment can override a failed
// premise, framing, or code gate for one head SHA so the later gates still run.
// Compliance is the last gate: its override is recorded, never continued, and
// never turns the result into a pass. Without an override nothing changes.

const HEAD = 'abc1234def5678901234567890abcdef12345678';
const OLD = '0123456789abcdef0123456789abcdef01234567';

/** Fake model: gates listed in `failing` return one critical finding. */
function fakeModel(failing) {
    const calls = [];
    const runGate = async (gate) => {
        calls.push(gate.id);
        return failing.includes(gate.id)
            ? { findings: [{ severity: 'critical', file: `${gate.id}.js`, line: 1, claim: `${gate.id} problem`, evidence: 'ev' }], rationale: `${gate.id} failed` }
            : { findings: [], rationale: `${gate.id} ok` };
    };
    return { runGate, calls };
}

function comment(login, body, extra = {}) {
    const at = extra.created_at || '2026-10-18T10:00:00Z';
    return {
        user: { login },
        body,
        created_at: at,
        updated_at: extra.updated_at || at,
        html_url: extra.html_url || `https://github.com/o/r/pull/1#issuecomment-${login}-${at}`,
    };
}

const ALLOW = 'big-b, @Dep12-Watch';

function overridesFor(comments, opts = {}) {
    return evaluateOverrides(comments, { allowlist: ALLOW, headSha: HEAD, prAuthor: 'noemi-agent', ...opts });
}

function verdicts(gates) {
    return Object.fromEntries(GATES.map((g) => [g.id, gates[g.id].verdict]));
}

async function review(failing, comments, opts) {
    const ov = overridesFor(comments, opts);
    const model = fakeModel(failing);
    const { gates, findings } = await runGates({ runGate: model.runGate, overrides: ov.accepted });
    const rec = recommend(Object.fromEntries(Object.entries(gates).map(([k, v]) => [k, v.verdict])), findings);
    const r = {
        model: 'm', reviewed_at: '2026-10-18T00:00:00Z', pr: 'o/r#1', sentinel_source: 's', compliance_source: 'c',
        gates, findings, recommendation: rec,
        remediation_prompt: buildRemediationPrompt(findings.filter((f) => !isContinuedOverride(f)), { repo: 'o/r', pr: '1' }),
        ...(ov.present ? { overrides: ov } : {}),
    };
    return { ov, gates, findings, rec, calls: model.calls, comment: renderComment(r) };
}

// --- parsing ---------------------------------------------------------------

test('override: allowlist parsing is comma/space separated, case-insensitive, @ optional', () => {
    assert.deepEqual([...parseOverrideActors(' Big-B,@dep12-watch  other ')], ['big-b', 'dep12-watch', 'other']);
    assert.equal(parseOverrideActors('').size, 0);
    assert.equal(parseOverrideActors(undefined).size, 0);
});

test('override: command must start a line and name layer and rule', () => {
    const ok = parseOverrideCommands(`Context first.\n/override layer=1 rule=premise.unneeded sha=${HEAD.slice(0, 7)} reason="needed for the release"`);
    assert.equal(ok.length, 1);
    assert.deepEqual(
        { layer: ok[0].layer, gate: ok[0].gate, rule: ok[0].rule, sha: ok[0].sha, reason: ok[0].reason, oneOff: ok[0].oneOff },
        { layer: 1, gate: 'premise', rule: 'premise.unneeded', sha: HEAD.slice(0, 7), reason: 'needed for the release', oneOff: false },
    );
    assert.deepEqual(parseOverrideCommands('please run `/override layer=1 rule=x` later'), [], 'mid-line mention is not a command');
    assert.deepEqual(parseOverrideCommands('/overrides layer=1 rule=x'), [], 'prefix must be the exact word');
    assert.match(parseOverrideCommands('/override rule=x')[0].error, /layer= is required/);
    assert.match(parseOverrideCommands('/override layer=5 rule=x')[0].error, /layer must be 1-4/);
    assert.match(parseOverrideCommands('/override layer=2')[0].error, /rule= is required/);
    assert.match(parseOverrideCommands('/override layer=2 rule=x sha=zz')[0].error, /sha= must be/);
    assert.match(parseOverrideCommands('/override layer=2 rule=x bogus')[0].error, /unexpected token/);
    assert.match(parseOverrideCommands('/override layer=2 layer=3 rule=x')[0].error, /duplicate layer/);
});

test('override: gate names are accepted for layer, one-off flag anywhere, quoted and unquoted reasons', () => {
    const [a] = parseOverrideCommands('/override one-off layer=code rule=code.tests reason=\'single "quoted" text\'');
    assert.equal(a.layer, 3); assert.equal(a.oneOff, true); assert.equal(a.reason, 'single "quoted" text');
    const [b] = parseOverrideCommands('/override layer=4 rule=c reason=rest of the line is the reason one-off');
    assert.equal(b.reason, 'rest of the line is the reason'); assert.equal(b.oneOff, true);
    const [c] = parseOverrideCommands('/override layer=1 rule=p reason="escaped \\"inner\\" quote"');
    assert.equal(c.reason, 'escaped "inner" quote');
    const [d] = parseOverrideCommands('/override layer=1 rule=p');
    assert.equal(d.reason, null, 'missing reason is null, never invented');
    const [e] = parseOverrideCommands('/override layer=1 rule=p reason=""');
    assert.equal(e.reason, null, 'empty reason counts as missing');
});

// --- 1. no override: unchanged early stop -----------------------------------

test('no override: layer 1 failure stops the run, later gates skipped and never called', async () => {
    const r = await review(['premise'], []);
    assert.deepEqual(r.calls, ['premise']);
    assert.deepEqual(verdicts(r.gates), { premise: 'fail', framing: 'skipped', code: 'skipped', compliance: 'skipped' });
    assert.equal(r.rec, 'escalate');
    assert.equal(r.ov.present, false);
});

test('no override: rendered comment is byte-for-byte the pre-override output', async () => {
    // Golden string captured from the renderer before override mode existed.
    const r = await review(['premise'], [comment('someone', 'LGTM, nothing to see')]);
    const expected = '## AI Review — advisory (phase 1)\n\n**Model:** `m` · **Reviewed:** 2026-10-18T00:00:00Z\n\n**Sentinel spec:** `s`\n\n**Compliance guidance:** `c`\n\n| Gate | 4D | Verdict |\n|---|---|---|\n| premise | Delegation | ❌ fail |\n| framing | Description | ⏭️ skipped |\n| code | Diligence | ⏭️ skipped |\n| compliance | Discernment | ⏭️ skipped |\n\n### Findings (1)\n\n- **critical** · `premise.js:1` · _premise_ — premise problem\n  - ev\n\n> Gates not run: framing, code, compliance. A failed gate stops the review — later gates are skipped, not passed.\n\n> **Premise gate failed.** "This should not be merged at all" is the most consequential and most subjective verdict available, so it routes to a human unconditionally and is never auto-actioned.\n\n<details><summary><b>Draft remediation prompt</b> — edit before dispatching</summary>\n\n```\nAddress the following review findings on o/r#1.\n\n1. [critical] premise.js:1 — premise problem\n   Evidence: ev\n\nConstraints:\n- Fix the root cause, not the symptom that reported it.\n- Do NOT resolve a finding by deleting or weakening the test, assertion, or check\n  that detected it. If a check is genuinely wrong, say so and escalate instead.\n- One finding per change. Do not bundle unrelated improvements.\n- If you believe a finding is incorrect, say so with reasoning rather than\n  implementing a change you disagree with.\n\nDRAFT — awaiting human review before dispatch.\n```\n\n</details>\n\n---\n\n_Advisory only. This review does not approve, merge, or block. A human decides what happens next._';
    assert.equal(r.comment, expected);
    assert.doesNotMatch(r.comment, /OVERRIDDEN|Overrides/);
});

test('no override: findings carry no override flag', async () => {
    const r = await review(['code'], []);
    assert.equal(r.findings[0].overridden, undefined);
    assert.deepEqual(verdicts(r.gates), { premise: 'pass', framing: 'pass', code: 'fail', compliance: 'skipped' });
});

// --- 2. continuation per layer ---------------------------------------------

test('L1 override: premise failure overridden runs framing, code, compliance', async () => {
    const r = await review(['premise'], [comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD.slice(0, 7)} reason="owner wants this shipped"`)]);
    assert.deepEqual(r.calls, ['premise', 'framing', 'code', 'compliance']);
    assert.deepEqual(verdicts(r.gates), { premise: 'overridden', framing: 'pass', code: 'pass', compliance: 'pass' });
    assert.equal(r.rec, 'overridden', 'never no-findings');
    assert.notEqual(r.gates.premise.verdict, 'pass');
    assert.equal(r.findings.length, 1, 'original finding is kept');
    assert.equal(r.findings[0].overridden, true);
    // Rendering: OVERRIDDEN, who, when, why, link, and the original finding.
    assert.match(r.comment, /Overall: OVERRIDDEN — not a clean pass/);
    assert.match(r.comment, /\| premise \| Delegation \| ⚠️ \*\*OVERRIDDEN\*\* \(fail\) \|/);
    assert.doesNotMatch(r.comment, /\| premise \| Delegation \| ✅/);
    assert.match(r.comment, /@big-b at 2026-10-18T10:00:00Z/);
    assert.match(r.comment, /reason: "owner wants this shipped"/);
    assert.match(r.comment, /rule `premise\.r1`/);
    assert.match(r.comment, /\(\[comment\]\(https:\/\/github\.com\/o\/r\/pull\/1#issuecomment-/);
    assert.match(r.comment, /premise problem · \*\*OVERRIDDEN\*\*/);
    assert.doesNotMatch(r.comment, /Gates not run/);
    assert.doesNotMatch(r.comment, /No findings/);
});

test('L1 override: a later real failure still stops and still requests changes', async () => {
    const r = await review(['premise', 'framing'], [comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="r"`)]);
    assert.deepEqual(r.calls, ['premise', 'framing']);
    assert.deepEqual(verdicts(r.gates), { premise: 'overridden', framing: 'fail', code: 'skipped', compliance: 'skipped' });
    assert.equal(r.rec, 'request-changes');
});

test('L2 override: framing failure overridden runs code and compliance', async () => {
    const r = await review(['framing'], [comment('big-b', `/override layer=2 rule=framing.r1 sha=${HEAD} reason="description fixed out of band"`)]);
    assert.deepEqual(r.calls, ['premise', 'framing', 'code', 'compliance']);
    assert.deepEqual(verdicts(r.gates), { premise: 'pass', framing: 'overridden', code: 'pass', compliance: 'pass' });
    assert.equal(r.rec, 'overridden');
});

test('L3 override: code failure overridden runs compliance', async () => {
    const r = await review(['code'], [comment('dep12-watch', `/override layer=3 rule=code.r1 sha=${HEAD} reason="false positive, see thread"`)]);
    assert.deepEqual(r.calls, ['premise', 'framing', 'code', 'compliance']);
    assert.deepEqual(verdicts(r.gates), { premise: 'pass', framing: 'pass', code: 'overridden', compliance: 'pass' });
    assert.equal(r.rec, 'overridden');
});

test('L4 override: compliance override is recorded and shown, but no continuation and not a pass', async () => {
    assert.ok(!OVERRIDE_CONTINUE_GATES.includes('compliance'));
    const r = await review(['compliance'], [comment('big-b', `/override layer=4 rule=compliance.r1 sha=${HEAD} reason="accepted risk"`)]);
    assert.deepEqual(r.calls, ['premise', 'framing', 'code', 'compliance']);
    assert.equal(r.gates.compliance.verdict, 'overridden');
    assert.equal(r.gates.compliance.overrides[0].actor, 'big-b');
    assert.equal(r.rec, 'request-changes', 'a compliance override never becomes a pass');
    assert.equal(r.findings[0].overridden, true);
    assert.equal(isContinuedOverride(r.findings[0]), false);
    assert.match(r.comment, /\| compliance \| Discernment \| ⚠️ \*\*OVERRIDDEN\*\* \(fail\) \|/);
    assert.match(r.comment, /recorded; last gate, no continuation, verdict not a pass/);
    assert.match(r.comment, /does not make this a pass/);
    assert.match(r.comment, /Draft remediation prompt/, 'compliance findings stay actionable');
});

test('L4 override: compliance is not a continuation gate inside runGates either', async () => {
    // Even with a later gate hypothetically present, compliance sets the stop.
    const model = fakeModel(['compliance']);
    const ov = overridesFor([comment('big-b', `/override layer=4 rule=compliance.r1 sha=${HEAD} reason="x"`)]);
    const { gates } = await runGates({ runGate: model.runGate, overrides: ov.accepted });
    assert.equal(gates.compliance.verdict, 'overridden');
    assert.equal(Object.keys(gates).length, GATES.length);
});

// --- 3. non-allowlisted actor ----------------------------------------------

test('non-allowlisted actor: override ignored, early stop kept, output says so', async () => {
    const r = await review(['premise'], [comment('random-dev', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="trust me"`)]);
    assert.deepEqual(r.calls, ['premise']);
    assert.equal(r.gates.premise.verdict, 'fail');
    assert.equal(r.rec, 'escalate');
    assert.match(r.comment, /Ignored override for \*\*layer 1 premise\*\* rule `premise\.r1` from @random-dev .*: @random-dev is not in NOEMI_REVIEW_OVERRIDE_ACTORS/);
    assert.doesNotMatch(r.comment, /Overall: OVERRIDDEN/);
});

test('PR author cannot override their own PR unless allowlisted', async () => {
    const own = [comment('noemi-agent', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="self"`)];
    const r = await review(['premise'], own);
    assert.equal(r.gates.premise.verdict, 'fail');
    assert.match(r.comment, /@noemi-agent is the PR author and is not in NOEMI_REVIEW_OVERRIDE_ACTORS/);
    const allowed = overridesFor(own, { allowlist: 'noemi-agent' });
    assert.ok(allowed.accepted.premise, 'allowlist is the only authority');
});

test('empty allowlist: nobody can override', async () => {
    const r = await review(['premise'], [comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="r"`)], { allowlist: '' });
    assert.equal(r.gates.premise.verdict, 'fail');
    assert.match(r.comment, /NOEMI_REVIEW_OVERRIDE_ACTORS is not set, so no override is honored/);
});

test('edited override comment is ignored', async () => {
    const r = await review(['premise'], [comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="r"`, { updated_at: '2026-10-18T11:00:00Z' })]);
    assert.equal(r.gates.premise.verdict, 'fail');
    assert.match(r.comment, /edited after posting/);
});

// --- 4. stale override after a new push ------------------------------------

test('stale override: SHA of an earlier head is ignored after a new push', async () => {
    const r = await review(['premise'], [comment('big-b', `/override layer=1 rule=premise.r1 sha=${OLD.slice(0, 7)} reason="was fine before"`)]);
    assert.deepEqual(r.calls, ['premise']);
    assert.equal(r.gates.premise.verdict, 'fail');
    assert.match(r.comment, /stale — given for `0123456`, current head is `abc1234def56`/);
});

// --- 5. multiple overrides --------------------------------------------------

test('multiple overrides: premise and code both overridden, all four gates run', async () => {
    const r = await review(['premise', 'code'], [
        comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="premise ok"`, { created_at: '2026-10-18T10:00:00Z' }),
        comment('dep12-watch', `/override layer=3 rule=code.r1 sha=${HEAD} reason="code ok"`, { created_at: '2026-10-18T10:05:00Z' }),
    ]);
    assert.deepEqual(r.calls, ['premise', 'framing', 'code', 'compliance']);
    assert.deepEqual(verdicts(r.gates), { premise: 'overridden', framing: 'pass', code: 'overridden', compliance: 'pass' });
    assert.equal(r.findings.length, 2);
    assert.equal(r.rec, 'overridden');
    assert.match(r.comment, /Failed gate\(s\) overridden by a human: premise, code/);
});

test('multiple overrides in one comment, mixed with an ignored one', async () => {
    const r = await review(['premise', 'framing'], [
        comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="a"\n/override layer=2 rule=framing.r1 sha=${HEAD} reason="b"`),
        comment('random-dev', `/override layer=3 rule=code.r1 sha=${HEAD} reason="c"`, { created_at: '2026-10-18T10:01:00Z' }),
    ]);
    assert.deepEqual(verdicts(r.gates), { premise: 'overridden', framing: 'overridden', code: 'pass', compliance: 'pass' });
    assert.match(r.comment, /Ignored override for \*\*layer 3 code\*\* rule `code\.r1` from @random-dev/);
});

test('multiple overrides for the same gate (different rules) are all recorded', async () => {
    const r = await review(['premise'], [
        comment('big-b', `/override layer=1 rule=premise.a sha=${HEAD} reason="first rule"`, { created_at: '2026-10-18T10:00:00Z' }),
        comment('dep12-watch', `/override layer=1 rule=premise.b sha=${HEAD} reason="second rule"`, { created_at: '2026-10-18T10:09:00Z' }),
    ]);
    assert.equal(r.gates.premise.overrides.length, 2);
    assert.match(r.comment, /rule `premise\.a`/);
    assert.match(r.comment, /rule `premise\.b`/);
});

test('reviewer: missing reason or missing sha is not applied, and says why', async () => {
    const noReason = await review(['premise'], [comment('big-b', `/override layer=1 rule=p sha=${HEAD}`)]);
    assert.equal(noReason.gates.premise.verdict, 'fail');
    assert.match(noReason.comment, /incomplete — no reason provided/);
    const noSha = await review(['premise'], [comment('big-b', '/override layer=1 rule=p reason="a real reason here"')]);
    assert.equal(noSha.gates.premise.verdict, 'fail');
    assert.match(noSha.comment, /no sha= given/);
});

test('reviewer: one-off flag is shown on the applied override', async () => {
    const r = await review(['code'], [comment('big-b', `/override layer=3 rule=code.x sha=${HEAD} reason="exception for this hotfix only" one-off`)]);
    assert.equal(r.gates.code.verdict, 'overridden');
    assert.match(r.comment, /\*\*one-off\*\*/);
});

test('override for a gate that passed is reported as not applied', async () => {
    const r = await review(['code'], [
        comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="pre-emptive"`),
    ]);
    assert.deepEqual(verdicts(r.gates), { premise: 'pass', framing: 'pass', code: 'fail', compliance: 'skipped' });
    assert.match(r.comment, /\*\*layer 1 premise\*\* — override by @big-b .* not applied: the gate passed/);
    assert.doesNotMatch(r.comment, /Overall: OVERRIDDEN/);
    assert.equal(r.rec, 'request-changes');
});

test('reviewer output never contains a line that parses as an override command', async () => {
    const r = await review(['premise'], [comment('big-b', `/override layer=1 rule=premise.r1 sha=${HEAD} reason="r"`)]);
    assert.deepEqual(parseOverrideCommands(r.comment), []);
});
