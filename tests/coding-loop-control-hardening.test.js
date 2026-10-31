const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { activeLoopLabel, ...run } = require('../coding-loop/run.js');
const { classifyIssue } = require('../coding-loop/intake.js');
const { openImplementationPr, prepareImplementation } = require('../coding-loop/dispatch.js');
const client = require('../scripts/github-client.js');
const { mintGithubAppInstallationToken } = require('../scripts/github-app-token.js');
const { findRepoInstallation } = require('../coding-loop/entitlement.js');

const REPO = 'project-noemi/agents';
const tenant = {
  tenantId: 'newpush-internal',
  orgs: ['newpush', 'project-noemi'],
  limits: { repos: [] },
};
const writer = { login: 'maintainer', permission: 'write' };
const accepted = { status: 'accepted', plan: '## Goal\nEdit coding-loop/run.js.', files: ['coding-loop/run.js'], label: 'noemi:planned' };
// Passes the structural critic, which --plan-in re-runs on the loaded file.
const acceptedFull = {
  ...accepted,
  plan: [
    '## Goal', 'Edit coding-loop/run.js.', '',
    '## Files', '- coding-loop/run.js', '',
    '## Tests', '- npm test passes', '',
    '## Risks', '- none beyond the issue', '',
    '## Stop conditions', '- the issue changes',
  ].join('\n'),
};

function issue(overrides = {}) {
  return {
    org: 'project-noemi',
    repo: 'agents',
    number: 12,
    author: 'alice',
    author_type: 'user',
    title: 'Validate flags',
    body: 'coding-loop/run.js should refuse bad flags; done when the test passes.',
    labels: [],
    ...overrides,
  };
}

function payload(overrides = {}) {
  return {
    number: 12,
    title: 'Validate flags',
    body: 'coding-loop/run.js should refuse bad flags; done when the test passes.',
    user: { login: 'alice', type: 'User' },
    labels: [],
    updated_at: '2026-10-27T10:00:00Z',
    repository_url: `https://api.github.com/repos/${REPO}`,
    html_url: `https://github.com/${REPO}/issues/12`,
    ...overrides,
  };
}

function sink() {
  const out = { text: '' };
  out.write = (chunk) => { out.text += chunk; return true; };
  return out;
}

function httpError(status) {
  return Object.assign(new Error(`GitHub → ${status}`), { status });
}

// ---------------------------------------------------------------- S8 / S9

test('parseArgs: every value flag refuses a missing or flag-shaped value (status 2, no exit)', () => {
  for (const flag of ['--repo', '--issue', '--tenant', '--requested-by', '--scan-status', '--profile', '--plan-out', '--plan-in']) {
    for (const argv of [[flag], [flag, '--post'], [flag, '']]) {
      assert.throws(() => run.parseArgs(argv), (err) => err.status === 2 && err.message.includes(flag), argv.join(' '));
    }
  }
  assert.throws(() => run.parseArgs(['--nope']), (err) => err.status === 2 && /Unknown flag/.test(err.message));
  assert.equal(run.parseArgs(['--help']).help, true);
  assert.equal(run.exitCodeForError(Object.assign(new Error('usage'), { status: 2 })), 2);
});

test('parseArgs: --scan-status is exactly APPROVED, REDACTED or BLOCKED; --requested-by is a login', () => {
  for (const ok of ['APPROVED', 'REDACTED', 'BLOCKED']) assert.equal(run.parseArgs(['--scan-status', ok]).scanStatus, ok);
  for (const bad of ['approved', 'blocked', 'ERROR', 'APPROVED ']) {
    assert.throws(() => run.parseArgs(['--scan-status', bad]), (err) => err.status === 2, bad);
  }
  assert.equal(run.parseArgs(['--requested-by', '@alice']).requestedBy, 'alice');
  assert.equal(run.parseArgs(['--requested-by', 'renovate[bot]']).requestedBy, 'renovate[bot]');
  for (const bad of ['a b', 'x/y', '-lead', 'x;rm']) {
    assert.throws(() => run.parseArgs(['--requested-by', bad]), (err) => err.status === 2, bad);
  }
});

test('classifyIssue: only exact APPROVED/REDACTED scans proceed; others are refused', () => {
  const base = { issue: issue(), tenant, trigger: writer, budget: { exhausted: false } };
  assert.equal(classifyIssue({ ...base, scan: { status: 'APPROVED' } }).tier, 'PENDING_SUFFICIENCY');
  assert.equal(classifyIssue({ ...base, scan: { status: 'REDACTED' } }).tier, 'PENDING_SUFFICIENCY');
  assert.deepEqual(classifyIssue({ ...base, scan: { status: 'BLOCKED' } }).reasons, ['scan-blocked']);
  for (const status of ['blocked', 'ERROR', 'approved', 'TIMEOUT']) {
    const r = classifyIssue({ ...base, scan: { status } });
    assert.equal(r.tier, 'REFUSED', status);
    assert.deepEqual(r.reasons, ['scan-status-unknown'], status);
  }
});

// ---------------------------------------------------------------- S6

test('classifyIssue: tenant runs need a verified writer, checked before the empty-body question', () => {
  const base = { tenant, scan: { status: 'APPROVED' }, budget: { exhausted: false } };
  assert.deepEqual(classifyIssue({ ...base, issue: issue() }).reasons, ['trigger-unverified']);
  assert.deepEqual(classifyIssue({ ...base, issue: issue(), trigger: { login: 'x', permission: 'read' } }).reasons, ['trigger-not-writer']);
  // An outsider's empty issue must not draw the NEEDS_INFO conductor question.
  const outsiderEmpty = classifyIssue({ ...base, issue: issue({ body: '' }), trigger: { login: 'x', permission: 'none' } });
  assert.equal(outsiderEmpty.tier, 'REFUSED');
  assert.equal(classifyIssue({ ...base, issue: issue({ body: '' }), trigger: writer }).tier, 'NEEDS_INFO');
  // A requester refusal leaves no label on the issue.
  assert.equal(activeLoopLabel({ post: true, intake: { tier: 'REFUSED', reasons: ['trigger-not-writer'], label: 'noemi:wont-act' }, plan: { status: 'refused' } }), '');
  assert.equal(activeLoopLabel({ post: true, intake: { tier: 'REFUSED', reasons: ['budget'], label: 'noemi:wont-act' }, plan: { status: 'refused' } }), 'noemi:wont-act');
});

// ---------------------------------------------------------------- R1a github-client

async function withFetch(responses, fn) {
  const realFetch = global.fetch;
  const realBase = process.env.GITHUB_RETRY_BASE_MS;
  process.env.GITHUB_RETRY_BASE_MS = '1';
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: { get: (name) => (next.headers || {})[name.toLowerCase()] ?? null },
      text: async () => next.text || '{}',
      json: async () => next.json || {},
    };
  };
  try {
    return await fn(calls);
  } finally {
    global.fetch = realFetch;
    if (realBase === undefined) delete process.env.GITHUB_RETRY_BASE_MS;
    else process.env.GITHUB_RETRY_BASE_MS = realBase;
  }
}

test('gh(): a POST is not retried on 5xx (no duplicate comment); GET is; idempotent opts in', async () => {
  await withFetch([{ status: 503 }, { status: 201 }], async (calls) => {
    await assert.rejects(() => client.gh('/repos/o/r/issues/1/comments', { token: 't', method: 'POST', body: { body: 'x' } }), /503/);
    assert.equal(calls.length, 1);
  });
  await withFetch([{ status: 502 }, { status: 200, json: { ok: 1 } }], async (calls) => {
    assert.deepEqual(await client.gh('/repos/o/r', { token: 't' }), { ok: 1 });
    assert.equal(calls.length, 2);
  });
  await withFetch([{ status: 500 }, { status: 201, json: { sha: 'x' } }], async (calls) => {
    assert.deepEqual(await client.gh('/repos/o/r/git/trees', { token: 't', method: 'POST', body: {}, idempotent: true }), { sha: 'x' });
    assert.equal(calls.length, 2);
  });
  assert.equal(client.shouldRetryGitHubError(httpError(503), { method: 'DELETE' }), false);
  assert.equal(client.shouldRetryGitHubError(new TypeError('fetch failed'), { method: 'POST' }), false);
  assert.equal(client.shouldRetryGitHubError(new TypeError('fetch failed'), { method: 'GET' }), true);
});

test('gh(): any method retries a rate limit (429, or 403 marked as one) after the capped wait', async () => {
  await withFetch([{ status: 429, headers: { 'retry-after': '1' } }, { status: 201, json: { id: 1 } }], async (calls) => {
    const started = Date.now();
    const out = await client.gh('/repos/o/r/issues/1/comments', {
      token: 't', method: 'POST', body: { body: 'x' }, maxWaitMs: 5,
    });
    assert.deepEqual(out, { id: 1 });
    assert.equal(calls.length, 2);
    assert.ok(Date.now() - started < 1000, 'Retry-After is capped by maxWaitMs');
  });
  await withFetch([
    { status: 403, text: '{"message":"You have exceeded a secondary rate limit. Please wait."}' },
    { status: 201, json: { id: 2 } },
  ], async (calls) => {
    assert.deepEqual(await client.gh('/x', { token: 't', method: 'POST', body: {}, maxWaitMs: 5 }), { id: 2 });
    assert.equal(calls.length, 2);
  });
  await withFetch([{ status: 403, text: '{"message":"Resource not accessible by integration"}' }], async (calls) => {
    await assert.rejects(() => client.gh('/x', { token: 't' }), (err) => err.status === 403);
    assert.equal(calls.length, 1, 'a permission 403 is not a rate limit');
  });
  const reset = { get: (n) => ({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) })[n] ?? null };
  assert.equal(client.rateLimitWaitMs({ headers: reset }), client.MAX_RATE_LIMIT_WAIT_MS, 'reset an hour out is capped');
});

test('gh(): apiBase is opt-in; GH_API stays github.com for the fleet reviewer', async () => {
  assert.equal(client.GH_API, 'https://api.github.com');
  assert.equal(client.GITHUB_DOTCOM_API, 'https://api.github.com');
  assert.equal(client.githubApiBase({ GITHUB_API_URL: 'https://ghe.example.com/api/v3/' }), 'https://ghe.example.com/api/v3');
  assert.equal(client.githubApiBase({ GITHUB_API_URL: 'http://ghe.example.com/api/v3' }), 'https://api.github.com');
  assert.equal(client.githubApiBase({ GITHUB_API_URL: 'https://u:p@ghe.example.com' }), 'https://api.github.com');
  assert.equal(client.githubApiBase({}), 'https://api.github.com');
  await withFetch([{ status: 200, json: {} }], async (calls) => {
    await client.gh('/repos/o/r', { token: 't', apiBase: 'https://ghe.example.com/api/v3' });
    await client.gh('/repos/o/r', { token: 't' });
    assert.equal(calls[0].url, 'https://ghe.example.com/api/v3/repos/o/r');
    assert.equal(calls[1].url, 'https://api.github.com/repos/o/r');
  });
});

test('GitHub App mint and repo installation lookup honour apiBase', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    if (url.includes('/app/installations?')) return { ok: true, json: async () => [{ id: 5, account: { login: 'o' } }] };
    if (url.endsWith('/access_tokens')) return { ok: true, json: async () => ({ token: 'ghs_x' }) };
    return { ok: true, status: 200, json: async () => ({ id: 5, account: { id: 9 } }) };
  };
  const base = 'https://ghe.example.com/api/v3';
  assert.equal(await mintGithubAppInstallationToken({ appId: '1', privateKey: pem, owner: 'o', fetchImpl, apiBase: base }), 'ghs_x');
  await findRepoInstallation({ repo: 'o/r', appId: '1', privateKey: pem, fetchImpl, apiBase: base });
  assert.ok(urls.every((u) => u.startsWith(base)), urls.join(' '));
});

// ---------------------------------------------------------------- S1a / S11 / R1b dispatch

function gitHost({ refExists = null, prExists = null, failRef = null } = {}) {
  const calls = [];
  const ghImpl = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body, idempotent: opts.idempotent });
    if (url === '/user') return { login: 'noemi-agent' };
    if (url.endsWith('/git/ref/heads/develop')) return { ref: 'refs/heads/develop', object: { sha: 'base' } };
    if (url.endsWith('/git/commits/base')) return { tree: { sha: 'basetree' } };
    // Base-tree read for file modes (an existing 100755 file stays executable).
    if (url.endsWith('/git/trees/basetree') && method === 'GET') return { tree: [] };
    if (url.endsWith('/git/trees')) return { sha: 'newtree' };
    if (url.endsWith('/git/commits') && method === 'POST') return { sha: 'newcommit' };
    if (url.endsWith('/git/refs') && method === 'POST') {
      if (failRef) throw httpError(failRef);
      if (refExists) throw httpError(422);
      return { ref: opts.body.ref };
    }
    if (url.endsWith('/git/ref/heads/noemi/issue-12')) return { object: { sha: 'oldcommit' } };
    if (url.endsWith('/git/commits/oldcommit')) return { tree: { sha: refExists } };
    if (url.endsWith('/pulls') && method === 'POST') {
      if (prExists) throw httpError(422);
      return { html_url: 'https://github.com/o/r/pull/5', number: 5 };
    }
    if (url.includes('/pulls?state=open&head=')) return prExists ? [prExists] : [];
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { ghImpl, calls };
}

const openArgs = (extra) => ({
  repo: REPO,
  issue: issue(),
  plan: accepted,
  branches: ['develop'],
  token: 'agent',
  files: [{ path: 'coding-loop/run.js', content: 'ok\n' }],
  env: { AGENT_GH_EXPECTED_LOGIN: 'noemi-agent' },
  stderr: sink(),
  ...extra,
});

test('openImplementationPr: encoded traversal and unsafe paths are refused before any network call', async () => {
  for (const bad of ['%2e%2e/contents/.github/workflows/ci.yml', '../x.js', '/etc/passwd', 'a\\b.js', 'a/./b.js', '.git/config']) {
    const { ghImpl, calls } = gitHost();
    const r = await openImplementationPr(openArgs({ ghImpl, files: [{ path: 'ok.js', content: '' }, { path: bad, content: 'x' }] }));
    assert.equal(r.status, 'refused', bad);
    assert.equal(r.reason, 'writer-bad-path', bad);
    assert.equal(calls.length, 0, bad);
  }
  const { ghImpl, calls } = gitHost();
  const carved = await openImplementationPr(openArgs({ ghImpl, files: [{ path: '.github/CODEOWNERS', content: 'x' }] }));
  assert.equal(carved.reason, 'writer-carve-out');
  assert.equal(calls.length, 0);
});

test('openImplementationPr: one atomic commit; the branch ref is created last', async () => {
  const { ghImpl, calls } = gitHost();
  const r = await openImplementationPr(openArgs({ ghImpl }));
  assert.equal(r.opened, true);
  assert.equal(r.resumed, false);
  assert.equal(r.url, 'https://github.com/o/r/pull/5');
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
    'GET /user',
    `GET /repos/${REPO}/git/ref/heads/develop`,
    `GET /repos/${REPO}/git/commits/base`,
    `GET /repos/${REPO}/git/trees/basetree`,
    `POST /repos/${REPO}/git/trees`,
    `POST /repos/${REPO}/git/commits`,
    `POST /repos/${REPO}/git/refs`,
    `POST /repos/${REPO}/pulls`,
  ]);
  assert.equal(calls[4].body.base_tree, 'basetree');
  assert.deepEqual(calls[5].body.parents, ['base']);
  assert.doesNotMatch(calls[5].body.message, /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b/i);
  assert.deepEqual(calls[6].body, { ref: 'refs/heads/noemi/issue-12', sha: 'newcommit' });
  assert.equal(calls.filter((c) => c.method === 'PUT').length, 0, 'no per-file contents PUTs');
});

test('openImplementationPr: a failure before the ref leaves nothing visible; 422 resumes or refuses', async () => {
  const failed = gitHost({ failRef: 500 });
  await assert.rejects(() => openImplementationPr(openArgs({ ghImpl: failed.ghImpl })), (err) => err.status === 500);
  assert.equal(failed.calls.some((c) => c.url.endsWith('/pulls')), false);

  // Same tree already on the branch: an earlier run got this far. Resume.
  const resumed = gitHost({ refExists: 'newtree' });
  const r = await openImplementationPr(openArgs({ ghImpl: resumed.ghImpl }));
  assert.equal(r.opened, true);
  assert.equal(r.resumed, true);

  // Different tree: someone else's branch. Refuse, do not overwrite.
  const other = gitHost({ refExists: 'othertree' });
  const refused = await openImplementationPr(openArgs({ ghImpl: other.ghImpl }));
  assert.equal(refused.reason, 'head-exists');
  assert.equal(other.calls.some((c) => c.url.endsWith('/pulls')), false);

  // PR already open for this head: return it.
  const existing = gitHost({ refExists: 'newtree', prExists: { html_url: 'https://github.com/o/r/pull/4', number: 4 } });
  const again = await openImplementationPr(openArgs({ ghImpl: existing.ghImpl }));
  assert.equal(again.number, 4);
  assert.ok(existing.calls.some((c) => c.url.includes(`head=${encodeURIComponent('project-noemi:noemi/issue-12')}`)));
});

test('PR body: issue/model text cannot close other issues or page people; blocked body is not pushed', async () => {
  const plan = { ...accepted, plan: 'Fixes #7 and closes o/r#9. Ping @someone.' };
  const prepared = prepareImplementation({ issue: issue({ title: 'Resolves #3 for @boss' }), plan, branches: ['develop'] });
  const keywordRefs = prepared.body.match(/(?<![`\w])(close[sd]?|fix(e[sd])?|resolve[sd]?)\s*:?\s+[\w./-]*#\d+(?!`)/gi) || [];
  assert.deepEqual(keywordRefs, ['Closes #12']);
  assert.match(prepared.body, /^Closes #12\n/);
  assert.match(prepared.body, /`@someone`/);
  assert.match(prepared.title, /`Resolves #3`/);
  assert.match(prepared.title, /`@boss`/);

  const { ghImpl, calls } = gitHost();
  const stderr = sink();
  const leaked = await openImplementationPr(openArgs({
    ghImpl, stderr, plan: { ...accepted, plan: 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789' },
  }));
  assert.equal(leaked.reason, 'pr-body-blocked');
  assert.equal(calls.length, 0);
  assert.doesNotMatch(stderr.text, /ghp_/);
});

// ---------------------------------------------------------------- R3 implementFromPlan

test('implementFromPlan: looks up the real integration branch before any paid draft', async () => {
  const refs = (present) => async (url) => {
    const name = url.split('/git/ref/heads/')[1];
    if (present.includes(name)) return { ref: `refs/heads/${name}`, object: { sha: 's' } };
    throw httpError(404);
  };
  let drafts = 0;
  const draft = async () => { drafts += 1; return { status: 'refused', reason: 'stub' }; };
  const args = { repo: REPO, openPr: true, profile: 'code' };
  const env = { AGENT_GH_TOKEN: 'agent' };

  const devOnly = await implementFromPlanWith(refs(['dev']));
  assert.equal(devOnly.base, 'dev');
  const both = await implementFromPlanWith(refs(['dev', 'develop']));
  assert.equal(both.base, 'develop');
  const none = await run.implementFromPlan({ args, issue: issue(), plan: accepted, env, ghImpl: refs(['main']), draft });
  assert.equal(none.reason, 'no-integration-branch');
  assert.equal(drafts, 2, 'no draft when there is no integration branch');

  const notAccepted = await run.implementFromPlan({
    args, issue: issue(), plan: { status: 'needs-info' }, env, ghImpl: async () => { throw new Error('no network'); }, draft,
  });
  assert.equal(notAccepted.reason, 'plan-not-accepted');

  async function implementFromPlanWith(ghImpl) {
    let base;
    await run.implementFromPlan({
      args, issue: issue(), plan: accepted, env, ghImpl,
      draft: async (input) => { base = input.base; return draft(input); },
    });
    return { base };
  }
});

// ---------------------------------------------------------------- tokens / labels

test('resolveConductorToken: PAT wins; App mint gets owner and apiBase; nothing is empty', async () => {
  assert.equal(await run.resolveConductorToken({ CONDUCTOR_GH_TOKEN: 'pat', CONDUCTOR_APP_ID: '1', CONDUCTOR_APP_PRIVATE_KEY: 'k' }), 'pat');
  let seen;
  const minted = await run.resolveConductorToken(
    { CONDUCTOR_APP_ID: '1', CONDUCTOR_APP_PRIVATE_KEY: 'k', GITHUB_API_URL: 'https://ghe.example.com/api/v3' },
    { owner: 'o', mint: async (opts) => { seen = opts; return 'ghs'; } },
  );
  assert.equal(minted, 'ghs');
  assert.equal(seen.owner, 'o');
  assert.equal(seen.apiBase, 'https://ghe.example.com/api/v3');
  assert.equal(await run.resolveConductorToken({}), '');
});

test('syncNoemiLabel: a DELETE 404 is ignored; a mid-sync failure keeps the new label applied', async () => {
  const calls = [];
  await run.syncNoemiLabel({
    repo: 'o/r', number: 1, label: 'noemi:review', current: ['noemi:planned'], token: 't',
    ghImpl: async (url, opts) => { calls.push(`${opts.method} ${url}`); if (opts.method === 'DELETE') throw httpError(404); return null; },
  });
  assert.deepEqual(calls, ['POST /repos/o/r/issues/1/labels', 'DELETE /repos/o/r/issues/1/labels/noemi%3Aplanned']);

  const partial = [];
  await assert.rejects(() => run.syncNoemiLabel({
    repo: 'o/r', number: 1, label: 'noemi:review', current: ['noemi:planned', 'noemi:queued'], token: 't',
    ghImpl: async (url, opts) => {
      partial.push(`${opts.method} ${url}`);
      assert.equal(opts.idempotent, true);
      if (opts.method === 'DELETE') throw httpError(502);
      return null;
    },
  }), (err) => err.status === 502);
  assert.equal(partial[0], 'POST /repos/o/r/issues/1/labels', 'the current label went on before the failure');
});

// ---------------------------------------------------------------- R9 plan file

test('writePlanFile: 0600 even over an existing file; refuses a symlink target', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-hard-'));
  try {
    const file = path.join(dir, 'plan.json');
    fs.writeFileSync(file, 'old', { mode: 0o644 });
    run.writePlanFile(file, { repo: 'o/r', issue: '1', fingerprint: 'f', intake: {}, plan: accepted });
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).version, run.PLAN_FILE_VERSION);

    const victim = path.join(dir, 'victim');
    fs.writeFileSync(victim, 'keep', { mode: 0o644 });
    const link = path.join(dir, 'link.json');
    fs.symlinkSync(victim, link);
    assert.throws(() => run.writePlanFile(link, { repo: 'o/r', issue: '1', fingerprint: 'f', intake: {}, plan: accepted }), /symbolic link/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'keep');
    assert.deepEqual(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readPlanFile: version 1 files still compare updated_at', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-v1-'));
  try {
    const file = path.join(dir, 'plan.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, repo: 'o/r', issue: 1, issueUpdatedAt: 'T1', profile: 'code', intake: {}, plan: accepted }));
    assert.equal(run.readPlanFile(file, { repo: 'o/r', issue: '1', updatedAt: 'T1', profile: 'code' }).plan.status, 'accepted');
    assert.throws(() => run.readPlanFile(file, { repo: 'o/r', issue: '1', updatedAt: 'T2', profile: 'code' }), /changed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- runLoop wiring

function loopHost({ issuePayload = payload(), permission = 'write' } = {}) {
  const calls = [];
  const ghImpl = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body, token: opts.token });
    if (url === `/repos/${REPO}/issues/12` && method === 'GET') return issuePayload;
    if (url.includes('/collaborators/')) return { permission };
    if (url.endsWith('/comments') && method === 'POST') return { id: 1 };
    if (url.includes('/labels')) return null;
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { ghImpl, calls };
}

const loopEnv = { CONDUCTOR_GH_TOKEN: 'conductor' };
const stubStageB = async () => ({
  intake: { tier: 'ACTIONABLE', reasons: [], label: 'noemi:queued' },
  plan: { ...acceptedFull },
});

async function loop(argv, { host = loopHost(), deps = {}, env = loopEnv } = {}) {
  const stderr = sink();
  const result = await run.runLoop({
    args: run.parseArgs(argv),
    env,
    stderr,
    deps: { gh: host.ghImpl, loadTenant: () => tenant, ...deps },
  });
  return { result, stderr: stderr.text, calls: host.calls };
}

const baseArgv = ['--repo', REPO, '--issue', '12', '--scan', '--budget-ok', '--post'];

test('runLoop: issue fetch → requester check → comment → label, all as the conductor', async () => {
  const { result, calls, stderr } = await loop([...baseArgv, '--requested-by', 'alice'], { deps: { completeThroughStageB: stubStageB } });
  assert.equal(result.plan.status, 'accepted');
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
    `GET /repos/${REPO}/issues/12`,
    `GET /repos/${REPO}/collaborators/alice/permission`,
    `POST /repos/${REPO}/issues/12/comments`,
    `POST /repos/${REPO}/issues/12/labels`,
  ]);
  assert.ok(calls.every((c) => c.token === 'conductor'));
  assert.deepEqual(calls[3].body, { labels: ['noemi:planned'] });
  assert.doesNotMatch(stderr, /alice/, 'audit log carries the permission, not the login');
});

test('runLoop: no requester, or a reader, is refused and leaves no comment or label', async () => {
  for (const [argv, permission, reason] of [
    [baseArgv, 'write', 'trigger-unverified'],
    [[...baseArgv, '--requested-by', 'mallory'], 'read', 'trigger-not-writer'],
  ]) {
    const { result, calls } = await loop(argv, { host: loopHost({ permission }) });
    assert.equal(result.intake.tier, 'REFUSED');
    assert.deepEqual(result.intake.reasons, [reason]);
    assert.equal(calls.filter((c) => c.method !== 'GET').length, 0, reason);
  }
});

test('runLoop: a conductor comment that fails the outbound scan is not posted', async () => {
  const leaky = async () => ({
    intake: { tier: 'ACTIONABLE', reasons: [], label: 'noemi:queued' },
    plan: { ...accepted, plan: 'use AKIAIOSFODNN7EXAMPLE' },
  });
  const { calls, stderr } = await loop([...baseArgv, '--requested-by', 'alice'], { deps: { completeThroughStageB: leaky } });
  assert.equal(calls.some((c) => c.url.endsWith('/comments')), false);
  assert.match(stderr, /comment-not-posted/);
  assert.doesNotMatch(stderr, /AKIA/);
});

test('runLoop: a renamed or transferred repository is refused', async () => {
  const host = loopHost({ issuePayload: payload({ repository_url: 'https://api.github.com/repos/someone-else/agents' }) });
  await assert.rejects(() => loop([...baseArgv, '--requested-by', 'alice'], { host }), (err) => err.reason === 'repo-moved');
  assert.equal(host.calls.length, 1);
  // Case differs only: same repository.
  const same = loopHost({ issuePayload: payload({ repository_url: 'https://api.github.com/repos/Project-Noemi/Agents' }) });
  await loop([...baseArgv, '--requested-by', 'alice'], { host: same, deps: { completeThroughStageB: stubStageB } });
});

test('runLoop: --plan-out with --post stays usable; --plan-in re-runs every Stage A gate', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-loop-'));
  const file = path.join(dir, 'plan.json');
  try {
    await loop([...baseArgv, '--requested-by', 'alice', '--plan-out', file], { deps: { completeThroughStageB: stubStageB } });

    // The conductor's own comment and label bumped updated_at; the plan still applies.
    const bumped = payload({ updated_at: '2026-10-27T10:05:00Z', labels: [{ name: 'noemi:planned' }] });
    let implemented = 0;
    const implement = async () => { implemented += 1; return { status: 'ready', reason: 'not-opened', opened: false }; };
    const env = { ...loopEnv, AGENT_GH_TOKEN: 'agent' };
    const planIn = ['--repo', REPO, '--issue', '12', '--scan', '--budget-ok', '--requested-by', 'alice', '--implement', '--plan-in', file];
    await loop(planIn, { host: loopHost({ issuePayload: bumped }), env, deps: { implementFromPlan: implement } });
    assert.equal(implemented, 1);

    const refusedBy = async (argv, issuePayload, permission = 'write') => {
      await assert.rejects(
        () => loop(argv, { host: loopHost({ issuePayload, permission }), env, deps: { implementFromPlan: implement } }),
        (err) => err.status === 403 || err.status === 409,
      );
    };
    await refusedBy(planIn, payload({ labels: [{ name: 'noemi:skip' }] }));
    await refusedBy(planIn, payload({ user: { login: 'renovate[bot]', type: 'Bot' } }));
    await refusedBy(planIn.map((a) => (a === '--budget-ok' ? '--budget-exhausted' : a)), payload());
    await refusedBy(planIn, payload({ body: 'leak -----BEGIN RSA PRIVATE KEY-----' }));
    await refusedBy(planIn, payload(), 'read');
    await refusedBy(planIn.filter((a, i, all) => a !== '--requested-by' && all[i - 1] !== '--requested-by'), payload());
    await refusedBy(planIn, payload({ body: 'coding-loop/run.js changed after planning; done when tests pass.' }));
    // A plan file edited after approval to name a carve-out is refused.
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    record.plan.plan = record.plan.plan.replace('- coding-loop/run.js', '- .github/workflows/ci.yml');
    record.plan.files = ['.github/workflows/ci.yml'];
    fs.writeFileSync(file, JSON.stringify(record));
    await refusedBy(planIn, bumped);
    assert.equal(implemented, 1, 'no refused run reached implementation');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main(): --help prints usage and returns 0 without touching GitHub', async () => {
  const stdout = sink();
  assert.equal(await run.main(['--help'], { stdout, stderr: sink(), env: {} }), 0);
  assert.match(stdout.text, /--requested-by/);
});

// ---------------------------------------------------------------- workflows

test('coding-loop workflows: named secrets, requester from env, id-token granted, concurrency, profile', () => {
  const root = path.join(__dirname, '..');
  const yml = fs.readFileSync(path.join(root, '.github/workflows/coding-loop.yml'), 'utf8');
  const caller = fs.readFileSync(path.join(root, 'templates/ci/coding-loop-caller.yml'), 'utf8');
  assert.doesNotMatch(caller, /^\s*secrets:\s*inherit\s*$/m);
  for (const name of [
    'CONDUCTOR_GH_TOKEN', 'CONDUCTOR_APP_ID', 'CONDUCTOR_APP_PRIVATE_KEY', 'AGENT_GH_TOKEN',
    'NOEMI_CLIENT_REGISTRY', 'AI_GW_API_TOKEN', 'AI_GW_API_KEY', 'XAI_API_KEY',
  ]) {
    assert.match(caller, new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`), name);
    assert.match(yml, new RegExp(`\\n      ${name}:\\n(?:        description: [^\\n]+\\n)?        required: false`), name);
  }
  assert.match(caller, /id-token: write/);
  assert.match(caller, /profile: \$\{\{ inputs\.profile/);
  assert.match(yml, /REQUESTED_BY: \$\{\{ github\.event_name == 'issues' && github\.event\.sender\.login \|\| github\.actor \}\}/);
  assert.match(yml, /--requested-by "\$REQUESTED_BY"/);
  assert.doesNotMatch(yml, /run:[^\n]*\$\{\{[^}]*(sender|actor)/, 'the login is never interpolated into the script');
  assert.match(yml, /concurrency:\n\s+group: coding-loop-/);
  // id-token only at job level in the reusable workflow.
  const topLevel = yml.slice(0, yml.indexOf('\njobs:'));
  assert.doesNotMatch(topLevel, /id-token/);
});

// ---------------------------------------------------------------- review follow-ups

test('implementFromPlan: passes the apiBase-bound ghImpl through to draftChanges (GHES base files)', async () => {
  const urls = [];
  const ghImpl = async (url) => {
    urls.push(url);
    if (url.includes('/git/ref/heads/develop')) return { ref: 'refs/heads/develop', object: { sha: 's' } };
    if (url.includes('/git/ref/heads/')) throw httpError(404);
    // writer.loadBaseFiles reads plan files through the same client.
    return { type: 'file', encoding: 'base64', content: Buffer.from('ok\n').toString('base64') };
  };
  let seen;
  await run.implementFromPlan({
    args: { repo: REPO, openPr: true, profile: 'code' },
    issue: issue(),
    plan: accepted,
    env: { AGENT_GH_TOKEN: 'agent' },
    ghImpl,
    draft: async (input) => { seen = input; return { status: 'refused', reason: 'stub' }; },
  });
  assert.equal(seen.ghImpl, ghImpl);

  // And the real draftChanges hands it to loadBaseFiles.
  const writerModule = require('../coding-loop/writer.js');
  urls.length = 0;
  await writerModule.draftChanges({
    issue: issue(), plan: accepted, env: {}, repo: REPO, base: 'develop', token: 'agent', ghImpl,
  }).catch(() => {});
  assert.ok(urls.some((u) => u.includes('/contents/coding-loop/run.js')), JSON.stringify(urls));
});

test('gh(): a spent quota resetting past the cap fails fast; a secondary 403 without Retry-After waits the floor', async () => {
  const hourOut = String(Math.floor(Date.now() / 1000) + 3600);
  await withFetch([
    { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': hourOut }, text: '{"message":"API rate limit exceeded"}' },
    { status: 200, json: {} },
  ], async (calls) => {
    await assert.rejects(
      () => client.gh('/repos/o/r', { token: 't' }),
      (err) => err.status === 403 && err.rateLimitExhausted === true
        && err.message.includes(`rate-limited until ${new Date(Number(hourOut) * 1000).toISOString()}`),
    );
    assert.equal(calls.length, 1, 'no retries against a reset an hour out');
  });
  // Reset within the cap still waits and retries.
  const soon = String(Math.floor(Date.now() / 1000));
  await withFetch([
    { status: 429, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': soon } },
    { status: 200, json: { ok: 1 } },
  ], async (calls) => {
    assert.deepEqual(await client.gh('/repos/o/r', { token: 't', maxWaitMs: 5 }), { ok: 1 });
    assert.equal(calls.length, 2);
  });
  // Secondary limit, no Retry-After: the floor, not the 1ms exponential base.
  await withFetch([
    { status: 403, text: '{"message":"You have exceeded a secondary rate limit."}' },
    { status: 201, json: { id: 1 } },
  ], async (calls) => {
    const started = Date.now();
    await client.gh('/x', { token: 't', method: 'POST', body: {}, secondaryFloorMs: 40, maxWaitMs: 1000 });
    assert.equal(calls.length, 2);
    assert.ok(Date.now() - started >= 35, 'waited the secondary floor');
  });
  // The env floor is the default (60s in production).
  const real = process.env.GITHUB_SECONDARY_RATE_FLOOR_MS;
  process.env.GITHUB_SECONDARY_RATE_FLOOR_MS = '30';
  try {
    await withFetch([
      { status: 403, text: '{"message":"You have exceeded a secondary rate limit."}' },
      { status: 200, json: {} },
    ], async (calls) => {
      const started = Date.now();
      await client.gh('/x', { token: 't', maxWaitMs: 1000 });
      assert.equal(calls.length, 2);
      assert.ok(Date.now() - started >= 25);
    });
  } finally {
    if (real === undefined) delete process.env.GITHUB_SECONDARY_RATE_FLOOR_MS;
    else process.env.GITHUB_SECONDARY_RATE_FLOOR_MS = real;
  }
});
