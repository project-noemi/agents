const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    loadBranchModel,
    validateModel,
    activeIntegrationBranches,
    classifyPullRequest
} = require('../scripts/branch-model.js');

// The branch model states PR-target rules by POSITION in the promotion line, so
// inserting a staging trunk later must change behavior without changing code
// (Decision [2026-09-11-0001]).

const TODAY = { trunks: ['develop', 'main'], integrationBranches: [{ branch: 'feat/x', engagement: 'e', status: 'active' }] };
const FUTURE = { trunks: ['develop', 'staging', 'main'], integrationBranches: [{ branch: 'feat/x', engagement: 'e', status: 'active' }] };

test('the shipped model is structurally valid', () => {
    assert.deepEqual(validateModel(loadBranchModel()), []);
});

test('contributor work may target the lowest trunk or a registered integration branch', () => {
    assert.equal(classifyPullRequest('task', 'develop', TODAY).allowed, true);
    assert.equal(classifyPullRequest('task', 'feat/x', TODAY).allowed, true);
});

test('an unregistered branch is not a valid target — "a specific branch" must not mean "any branch"', () => {
    const v = classifyPullRequest('task', 'feat/undeclared', TODAY);
    assert.equal(v.allowed, false);
    assert.equal(v.kind, 'unregistered');
    assert.match(v.reason, /branch-model\.json/);
});

test('a contributor may not target a trunk above the lowest', () => {
    const v = classifyPullRequest('task', 'main', TODAY);
    assert.equal(v.allowed, false);
    assert.equal(v.kind, 'trunk-out-of-order');
});

test('the promotion step is allowed — the release train must not be blocked', () => {
    const v = classifyPullRequest('develop', 'main', TODAY);
    assert.equal(v.allowed, true);
    assert.equal(v.kind, 'promotion');
});

test('inserting a staging trunk changes the rules with no code change', () => {
    // Each step of the new line is sanctioned...
    assert.equal(classifyPullRequest('develop', 'staging', FUTURE).allowed, true);
    assert.equal(classifyPullRequest('staging', 'main', FUTURE).allowed, true);
    // ...and skipping a trunk stops being allowed, without rewording a rule.
    assert.equal(classifyPullRequest('develop', 'main', FUTURE).allowed, false);
    assert.equal(classifyPullRequest('task', 'staging', FUTURE).allowed, false);
    assert.equal(classifyPullRequest('task', 'main', FUTURE).allowed, false);
    // The integration branch is unaffected by the topology change.
    assert.equal(classifyPullRequest('task', 'feat/x', FUTURE).allowed, true);
});

test('a closed engagement stops accepting pull requests and says why', () => {
    const closed = { trunks: ['develop', 'main'], integrationBranches: [{ branch: 'feat/x', engagement: 'e', status: 'closed' }] };
    const v = classifyPullRequest('task', 'feat/x', closed);
    assert.equal(v.allowed, false);
    assert.equal(v.kind, 'integration-branch-closed');
    assert.match(v.reason, /"e"/);
    assert.deepEqual(activeIntegrationBranches(closed), []);
});

test('validateModel rejects the shapes that would silently widen the gate', () => {
    assert.match(validateModel({ trunks: ['develop'], integrationBranches: [] }).join(), /at least two/);
    assert.match(validateModel({ trunks: ['develop', 'develop', 'main'], integrationBranches: [] }).join(), /duplicate/);
    // A trunk registered as an integration branch would make it targetable by anyone.
    assert.match(validateModel({ trunks: ['develop', 'main'], integrationBranches: [{ branch: 'main', engagement: 'e', status: 'active' }] }).join(), /cannot also be an integration branch/);
    assert.match(validateModel({ trunks: ['develop', 'main'], integrationBranches: [{ branch: 'feat/x', status: 'active' }] }).join(), /engagement/);
    assert.match(validateModel({ trunks: ['develop', 'main'], integrationBranches: [{ branch: 'feat/x', engagement: 'e' }] }).join(), /status/);
});

test('every active registration has a profile, and the profile names its own branch', () => {
    const model = loadBranchModel();
    for (const entry of activeIntegrationBranches(model)) {
        const profilePath = path.join(__dirname, '..', 'engagements', `${entry.engagement}.md`);
        assert.ok(fs.existsSync(profilePath), `missing engagements/${entry.engagement}.md`);
        assert.ok(fs.readFileSync(profilePath, 'utf8').includes(entry.branch), `profile does not name ${entry.branch}`);
    }
});

test('every active integration branch carries the validation gate', () => {
    const validateYml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/validate.yml'), 'utf8');
    for (const entry of activeIntegrationBranches(loadBranchModel())) {
        assert.ok(validateYml.includes(entry.branch), `${entry.branch} is not in validate.yml's filters`);
    }
});
