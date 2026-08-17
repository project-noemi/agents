const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  classifyIssue,
  isBotAuthor,
  isEmptyOrTemplate,
  issueFromGitHub,
  tenantAllows,
} = require('../coding-loop/intake.js');

const tenant = {
  tenantId: 'newpush-internal',
  orgs: ['newpush', 'project-noemi', 'newpush-labs'],
  limits: { repos: [], concurrent_jobs: 3 },
};

function issue(overrides = {}) {
  return {
    org: 'project-noemi',
    repo: 'agents',
    number: 1,
    author: 'WSwarm',
    author_type: 'user',
    title: 'Add an issue-loop runner',
    body: 'Stage A should classify skip, bot, and empty bodies without calling a model.',
    labels: [],
    ...overrides,
  };
}

test('intake: noemi:skip is an escape hatch and does not inspect the body', () => {
  const result = classifyIssue({
    issue: issue({ labels: ['noemi:skip'], body: '' }),
    tenant,
    scan: { status: 'BLOCKED' },
  });
  assert.equal(result.tier, 'SKIPPED');
  assert.deepEqual(result.reasons, ['escape-hatch']);
});

test('intake: bot authors are skipped', () => {
  for (const author of ['dependabot', 'renovate', 'github-actions', 'noemi-reviewer-bot[bot]']) {
    const result = classifyIssue({
      issue: issue({ author, author_type: author.includes('[bot]') ? 'bot' : 'user' }),
      tenant,
      scan: { status: 'APPROVED' },
    });
    assert.equal(result.tier, 'SKIPPED', author);
    assert.ok(result.reasons.includes('bot-author'), author);
  }
  assert.equal(isBotAuthor(issue({ author_type: 'bot' })), true);
  assert.equal(isBotAuthor(issue({ author: 'WSwarm' })), false);
});

test('intake: empty and template-only bodies need info', () => {
  assert.equal(isEmptyOrTemplate(issue({ title: '', body: '' })), true);
  assert.equal(isEmptyOrTemplate(issue({ body: '   ' })), true);
  assert.equal(isEmptyOrTemplate(issue({ body: '## Describe the bug\n\n_No response_\n' })), true);
  assert.equal(isEmptyOrTemplate(issue({ body: 'Stage A should classify skip.' })), false);

  const result = classifyIssue({
    issue: issue({ body: '' }),
    tenant,
    scan: { status: 'APPROVED' },
  });
  assert.equal(result.tier, 'NEEDS_INFO');
  assert.equal(result.label, 'noemi:needs-info');
  assert.ok(result.questions.length >= 1);
});

test('intake: outside tenant and exhausted budget are refused', () => {
  const foreign = classifyIssue({
    issue: issue({ org: 'someone-else' }),
    tenant,
    scan: { status: 'APPROVED' },
  });
  assert.equal(foreign.tier, 'REFUSED');
  assert.deepEqual(foreign.reasons, ['outside-tenant']);

  const allow = classifyIssue({
    issue: issue({ org: 'newpush', repo: 'platform' }),
    tenant: { ...tenant, limits: { repos: ['newpush/other'] } },
    scan: { status: 'APPROVED' },
  });
  assert.equal(allow.tier, 'REFUSED');

  const budget = classifyIssue({
    issue: issue(),
    tenant,
    scan: { status: 'APPROVED' },
    budget: { exhausted: true },
  });
  assert.equal(budget.tier, 'REFUSED');
  assert.deepEqual(budget.reasons, ['budget']);
});

test('intake: unscanned or blocked bodies are refused, never actionable', () => {
  const missing = classifyIssue({ issue: issue(), tenant });
  assert.equal(missing.tier, 'REFUSED');
  assert.deepEqual(missing.reasons, ['unscanned-body']);

  const blocked = classifyIssue({
    issue: issue(),
    tenant,
    scan: { status: 'BLOCKED' },
  });
  assert.equal(blocked.tier, 'REFUSED');
  assert.deepEqual(blocked.reasons, ['scan-blocked']);
});

test('intake: passing hard gates is PENDING_SUFFICIENCY, never ACTIONABLE', () => {
  const result = classifyIssue({
    issue: issue(),
    tenant,
    scan: { status: 'APPROVED' },
  });
  assert.equal(result.tier, 'PENDING_SUFFICIENCY');
  assert.equal(result.label, 'noemi:queued');
  assert.notEqual(result.tier, 'ACTIONABLE');
});

test('issueFromGitHub maps a REST payload onto the intake shape', () => {
  const mapped = issueFromGitHub('project-noemi/agents', {
    number: 9,
    title: 'Hello',
    body: 'World',
    user: { login: 'WSwarm', type: 'User' },
    labels: [{ name: 'bug' }],
  });
  assert.equal(mapped.org, 'project-noemi');
  assert.equal(mapped.repo, 'agents');
  assert.equal(mapped.author_type, 'user');
  assert.deepEqual(mapped.labels, [{ name: 'bug' }]);
  assert.equal(tenantAllows(mapped, tenant).ok, true);
});

test('CLI --post without CONDUCTOR_GH_TOKEN is refused (identity split)', () => {
  const script = path.join(__dirname, '..', 'coding-loop', 'run.js');
  const env = { ...process.env };
  delete env.CONDUCTOR_GH_TOKEN;
  const result = spawnSync(process.execPath, [script, '--repo', 'project-noemi/agents', '--issue', '1', '--post'], {
    env,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONDUCTOR_GH_TOKEN/);
  assert.doesNotMatch(result.stderr, /AGENT_GH_TOKEN is enough/);
});
