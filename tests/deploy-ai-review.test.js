const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
    firstIssueUrl, pickIntegrationBranch,
} = require('../scripts/deploy-ai-review-lib.js');

const script = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'deploy-ai-review.sh'),
    'utf8',
);

test('deploy: prefers develop, then dev, and never opens a caller PR against main', () => {
    assert.match(script, /integration_branch\(\)/);
    assert.match(script, /git\/ref\/heads\/develop/);
    assert.match(script, /git\/ref\/heads\/dev/);
    assert.match(script, /PHASE0_TITLE=/);
    assert.match(script, /require-develop-source/);
    assert.match(script, /--base "\$target"/);
    assert.doesNotMatch(script, /--base "\$default_branch"/);
    assert.match(script, /deploy-ai-review-lib\.js/);
});

test('pickIntegrationBranch: develop wins over dev and main', () => {
    assert.equal(pickIntegrationBranch(['main', 'develop', 'dev']), 'develop');
    assert.equal(pickIntegrationBranch(['main', 'dev']), 'dev');
    assert.equal(pickIntegrationBranch(['main', 'master']), '');
    assert.equal(pickIntegrationBranch([]), '');
});

test('firstIssueUrl: empty list is not an existing issue (jq null trap)', () => {
    // This is the live `gh issue list --json url` payload when nothing matches.
    assert.equal(firstIssueUrl('[]'), '');
    // `jq .[0].url` on that payload prints the literal word null.
    assert.equal(firstIssueUrl('null'), '');
    assert.equal(firstIssueUrl('[{"url":null}]'), '');
    assert.equal(firstIssueUrl(null), '');
    assert.equal(firstIssueUrl(''), '');
});

test('firstIssueUrl: a real issue URL is returned', () => {
    const url = 'https://github.com/newpush/crm/issues/4';
    assert.equal(firstIssueUrl([{ url }]), url);
    assert.equal(firstIssueUrl(JSON.stringify([{ url }])), url);
    assert.equal(firstIssueUrl(`${url}\n`), url);
});

test('firstIssueUrl CLI: empty gh list must not print null', () => {
    const helper = path.join(__dirname, '..', 'scripts', 'deploy-ai-review-lib.js');
    const empty = spawnSync(process.execPath, [helper], { input: '[]', encoding: 'utf8' });
    assert.equal(empty.status, 0);
    assert.equal(empty.stdout, '');
    const jqNull = spawnSync(process.execPath, [helper], { input: 'null\n', encoding: 'utf8' });
    assert.equal(jqNull.status, 0);
    assert.equal(jqNull.stdout, '');
    const hit = spawnSync(process.execPath, [helper], {
        input: '[{"url":"https://github.com/newpush/crm/issues/4"}]',
        encoding: 'utf8',
    });
    assert.equal(hit.status, 0);
    assert.equal(hit.stdout, 'https://github.com/newpush/crm/issues/4');
});
