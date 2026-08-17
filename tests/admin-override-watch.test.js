const test = require('node:test');
const assert = require('node:assert/strict');

const {
    classifyCommit,
    classifyMergedPR,
    diffProtection,
    renderFindings,
    EXPECTED_PROTECTION,
} = require('../scripts/audit-admin-overrides.js');

// The watch is the compensating control for a deliberately-kept admin override
// (Decision [2026-08-17-0001]). These tests pin its judgment to the two REAL
// incidents of 2026-08-14, so the detector is known to catch the exact class
// of event it was built for.

test('direct push: the ff66bdc incident classifies as a finding EVEN AFTER promotion sweeps it', () => {
    // Real event, real shape: pushed straight to protected develop, then swept
    // into promotion PR #397 (base main) minutes later. An "any associated PR"
    // test is laundered by that sweep; branch-aware association is not.
    const f = classifyCommit({
        oid: 'ff66bdc0000000000000000000000000000000000',
        headline: 'docs: Grok bridge documentation',
        committedDate: '2026-08-14T13:53:47Z',
        actor: 'thakivagyok',
        associatedPRs: [{ number: 397, baseRefName: 'main', state: 'MERGED' }],
    }, 'develop');
    assert.ok(f, 'a develop commit with no develop-based merged PR must be a finding');
    assert.equal(f.kind, 'direct-push');
    assert.equal(f.severity, 'high');
    assert.match(f.detail, /ff66bdc/);
    assert.match(f.detail, /swept later into: #397/);
});

test('direct push: ordinary PR merge commits classify clean', () => {
    assert.equal(classifyCommit({
        oid: 'abc123', headline: 'Merge pull request #408', committedDate: 'now',
        actor: 'WSwarm',
        associatedPRs: [{ number: 408, baseRefName: 'develop', state: 'MERGED' }],
    }, 'develop'), null);
});

test('direct push: develop-originated commits are legitimate on main via promotion', () => {
    // Promotion sweeps develop history into main; a commit whose develop-based
    // PR merged must not re-flag when scanned on main.
    assert.equal(classifyCommit({
        oid: 'def456', headline: 'feat: something reviewed', committedDate: 'now',
        actor: 'noemi-agent',
        associatedPRs: [{ number: 390, baseRefName: 'develop', state: 'MERGED' }],
    }, 'main'), null);
});

test('direct push: an open PR containing the commit does not legitimize it', () => {
    const f = classifyCommit({
        oid: 'aaa111', headline: 'sneak', committedDate: 'now', actor: 'x',
        associatedPRs: [{ number: 999, baseRefName: 'develop', state: 'OPEN' }],
    }, 'develop');
    assert.ok(f, 'only MERGED PRs explain a commit being on the branch');
});

test('manual promotion: the #397 incident classifies as a finding', () => {
    // Real event: human-authored, self-merged develop→main promotion.
    const findings = classifyMergedPR({
        number: 397, title: 'promote develop into main', baseRefName: 'main',
        mergedAt: '2026-08-14T14:02:37Z',
        author: 'thakivagyok', mergedBy: 'thakivagyok', approvedReviewCount: 0,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'manual-promotion');
    assert.match(findings[0].detail, /#397/);
});

test('manual promotion: the release App\'s scoped exception is allowlisted', () => {
    for (const login of ['noemi-release-bot', 'noemi-release-bot[bot]', 'app/noemi-release-bot']) {
        const findings = classifyMergedPR({
            number: 411, title: 'chore(release): promote develop into main',
            baseRefName: 'main', mergedAt: '2026-08-17T06:12:00Z',
            author: login, mergedBy: login, approvedReviewCount: 0,
        });
        assert.deepEqual(findings, [], `${login} promotions must not alert`);
    }
});

test('unreviewed merge into develop is a finding; approved merges are clean', () => {
    const bad = classifyMergedPR({
        number: 500, title: 'x', baseRefName: 'develop', mergedAt: 'now',
        author: 'someone', mergedBy: 'admin-user', approvedReviewCount: 0,
    });
    assert.equal(bad.length, 1);
    assert.equal(bad[0].kind, 'unreviewed-merge');

    const good = classifyMergedPR({
        number: 501, title: 'y', baseRefName: 'develop', mergedAt: 'now',
        author: 'noemi-agent', mergedBy: 'WSwarm', approvedReviewCount: 1,
    });
    assert.deepEqual(good, []);
});

test('self-merge into develop is a finding even when approved', () => {
    const findings = classifyMergedPR({
        number: 502, title: 'z', baseRefName: 'develop', mergedAt: 'now',
        author: 'WSwarm', mergedBy: 'WSwarm', approvedReviewCount: 1,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, 'self-merge');
    assert.equal(findings[0].severity, 'medium');
});

test('protection drift: deviation from the decided policy is a finding', () => {
    // develop's DECIDED state is enforce_admins:false — the override stays,
    // monitored. So enforce_admins:true on develop is ALSO drift: the live
    // rules no longer match what the decision record says they are.
    assert.equal(EXPECTED_PROTECTION.develop.enforce_admins, false,
        'the decided develop policy keeps the admin override');
    const drift = diffProtection('develop', {
        enforce_admins: false, required_approving_review_count: 0,
        require_code_owner_reviews: true,
        contexts: ['Audit, Generate, and Fast Tests'],
    });
    assert.equal(drift.length, 2, 'approvals + missing required check');
    assert.match(drift.map((d) => d.detail).join(' '), /approvals is 0/);
    assert.match(drift.map((d) => d.detail).join(' '), /Cross-Model PR Review/);
});

test('protection drift: matching policy yields no findings', () => {
    assert.deepEqual(diffProtection('develop', {
        enforce_admins: false, required_approving_review_count: 1,
        require_code_owner_reviews: true,
        contexts: ['Audit, Generate, and Fast Tests', 'Cross-Model PR Review'],
    }), []);
});

test('rendering: findings produce an attestation demand; a clean window renders empty', () => {
    const md = renderFindings('o/r', [{ kind: 'direct-push', severity: 'high', branch: 'develop', detail: 'd' }], 2);
    assert.match(md, /Attestation required/);
    assert.match(md, /not the actor/);
    assert.equal(renderFindings('o/r', [], 2), '');
});
