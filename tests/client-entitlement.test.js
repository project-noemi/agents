const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { classifyIssue, entitlementGate, tenantAllows } = require('../coding-loop/intake.js');
const {
  findRepoInstallation, parseClientRegistry, resolveEntitlement, resolveTrigger,
} = require('../coding-loop/entitlement.js');
const { assertStillEntitled } = require('../coding-loop/run.js');

const tenant = {
  tenantId: 'newpush-internal',
  orgs: ['newpush', 'project-noemi', 'newpush-labs'],
  limits: { repos: [], concurrent_jobs: 3 },
};

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function clientIssue(overrides = {}) {
  return {
    org: 'client-org',
    repo: 'crm',
    number: 7,
    author: 'someone',
    author_type: 'user',
    title: 'Add timestamps to notes',
    body: 'coding-loop/run.js should stamp notes; done when the test passes.',
    labels: [],
    ...overrides,
  };
}

const installed = { installation: { id: 1, account_id: 42, suspended: false }, client: { account_id: 42, status: 'active' } };
const writer = { login: 'maintainer', permission: 'write' };

function fetchReturning(status, body) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

test('tenantAllows: a static org passes without the registry', () => {
  const r = tenantAllows(clientIssue({ org: 'newpush' }), tenant);
  assert.equal(r.ok, true);
  assert.equal(r.via, 'tenant');
});

test('tenantAllows: a client org with no entitlement stays outside-tenant', () => {
  assert.deepEqual(tenantAllows(clientIssue(), tenant), { ok: false, reason: 'outside-tenant' });
});

test('tenantAllows: each missing half of installed-AND-registered refuses with its own reason', () => {
  const cases = [
    [{ error: 'boom' }, 'entitlement-unverified'],
    [{ installation: null, client: null }, 'app-not-installed'],
    [{ installation: { account_id: 42, suspended: true }, client: installed.client }, 'installation-suspended'],
    [{ installation: installed.installation, client: null }, 'unregistered-client'],
    [{ installation: installed.installation, client: { account_id: 42, status: 'suspended' } }, 'client-suspended'],
    [{ ...installed, client: { ...installed.client, repos: ['client-org/other'] } }, 'outside-tenant'],
  ];
  for (const [entitlement, reason] of cases) {
    assert.deepEqual(tenantAllows(clientIssue(), tenant, entitlement), { ok: false, reason }, reason);
  }
  const ok = tenantAllows(clientIssue(), tenant, installed);
  assert.equal(ok.ok, true);
  assert.equal(ok.via, 'client');
});

test('entitlementGate: a client run needs a requester with write access', () => {
  const base = { issue: clientIssue(), tenant, entitlement: installed };
  assert.equal(entitlementGate({ ...base, trigger: null }).reason, 'trigger-unverified');
  assert.equal(entitlementGate({ ...base, trigger: { login: 'x', error: 'net' } }).reason, 'trigger-unverified');
  assert.equal(entitlementGate({ ...base, trigger: { login: 'x', permission: 'read' } }).reason, 'trigger-not-writer');
  assert.equal(entitlementGate({ ...base, trigger: { login: 'x', permission: 'none' } }).reason, 'trigger-not-writer');
  for (const permission of ['write', 'maintain', 'admin']) {
    assert.equal(entitlementGate({ ...base, trigger: { login: 'x', permission } }).ok, true, permission);
  }
  // Static tenant orgs keep their existing behaviour: no requester needed.
  assert.equal(entitlementGate({ issue: clientIssue({ org: 'newpush' }), tenant }).ok, true);
});

test('classifyIssue: a fully entitled client run reaches PENDING_SUFFICIENCY; a reader is refused', () => {
  const input = {
    issue: clientIssue(), tenant, entitlement: installed, scan: { status: 'APPROVED' }, budget: { exhausted: false },
  };
  assert.equal(classifyIssue({ ...input, trigger: writer }).tier, 'PENDING_SUFFICIENCY');
  const reader = classifyIssue({ ...input, trigger: { login: 'outsider', permission: 'read' } });
  assert.equal(reader.tier, 'REFUSED');
  assert.deepEqual(reader.reasons, ['trigger-not-writer']);
});

test('parseClientRegistry: empty means no clients; malformed input throws without echoing it', () => {
  assert.deepEqual(parseClientRegistry(undefined), { clients: [] });
  assert.deepEqual(parseClientRegistry('  '), { clients: [] });
  assert.throws(() => parseClientRegistry('{"clients": [secret-ish'), (err) => !err.message.includes('secret-ish'));
  assert.throws(() => parseClientRegistry('{"clients": {}}'), /clients array/);
  assert.throws(() => parseClientRegistry('{"clients": [{"account_id": "42", "status": "active"}]}'), /account_id/);
  assert.throws(() => parseClientRegistry('{"clients": [{"account_id": 42, "status": "on"}]}'), /status/);
  assert.throws(() => parseClientRegistry('{"clients": [{"account_id": 42, "status": "active", "repos": "a/b"}]}'), /repos/);
});

test('findRepoInstallation: 404 is not installed; other failures throw', async () => {
  assert.equal(await findRepoInstallation({ repo: 'o/r', appId: '1', privateKey: pem, fetchImpl: fetchReturning(404) }), null);
  await assert.rejects(
    findRepoInstallation({ repo: 'o/r', appId: '1', privateKey: pem, fetchImpl: fetchReturning(500) }),
    (err) => err.status === 500,
  );
  const hit = await findRepoInstallation({
    repo: 'o/r', appId: '1', privateKey: pem,
    fetchImpl: fetchReturning(200, { id: 9, account: { id: 42, login: 'o' }, suspended_at: '2026-10-01T00:00:00Z' }),
  });
  assert.deepEqual(hit, { id: 9, account_id: 42, suspended: true });
});

test('resolveEntitlement: static orgs skip the lookup; clients match the registry by account ID, not login', async () => {
  const none = fetchReturning(200, {});
  assert.equal(await resolveEntitlement({ repo: 'newpush/x', tenant, env: {}, fetchImpl: none }), null);
  assert.equal(none.calls.length, 0);

  const env = {
    CONDUCTOR_APP_ID: '1',
    CONDUCTOR_APP_PRIVATE_KEY: pem,
    NOEMI_CLIENT_REGISTRY: JSON.stringify({ clients: [{ account_id: 42, login: 'renamed-org', status: 'active' }] }),
  };
  const fetchImpl = fetchReturning(200, { id: 9, account: { id: 42, login: 'client-org' }, suspended_at: null });
  const r = await resolveEntitlement({ repo: 'client-org/crm', tenant, env, fetchImpl });
  assert.equal(r.client.account_id, 42);
  assert.match(fetchImpl.calls[0].url, /\/repos\/client-org\/crm\/installation$/);

  const other = fetchReturning(200, { id: 9, account: { id: 43, login: 'renamed-org' }, suspended_at: null });
  assert.equal((await resolveEntitlement({ repo: 'renamed-org/crm', tenant, env, fetchImpl: other })).client, null);
});

test('resolveEntitlement: missing App credentials, a bad registry or a lookup failure fail closed', async () => {
  const bad = await resolveEntitlement({ repo: 'client-org/crm', tenant, env: { NOEMI_CLIENT_REGISTRY: '{' } });
  assert.ok(bad.error);
  const noApp = await resolveEntitlement({ repo: 'client-org/crm', tenant, env: {} });
  assert.match(noApp.error, /CONDUCTOR_APP_ID/);
  const down = await resolveEntitlement({
    repo: 'client-org/crm', tenant, env: { CONDUCTOR_APP_ID: '1', CONDUCTOR_APP_PRIVATE_KEY: pem }, fetchImpl: fetchReturning(502),
  });
  assert.ok(down.error);
  assert.equal(tenantAllows(clientIssue(), tenant, down).reason, 'entitlement-unverified');
});

test('resolveTrigger: reads the collaborator permission; 404 is none; other errors are unverified', async () => {
  assert.equal(await resolveTrigger({ repo: 'o/r', login: '' }), null);
  const seen = [];
  const ok = await resolveTrigger({
    repo: 'o/r', login: 'a b', token: 't',
    ghImpl: async (path) => { seen.push(path); return { permission: 'admin' }; },
  });
  assert.deepEqual(ok, { login: 'a b', permission: 'admin' });
  assert.equal(seen[0], '/repos/o/r/collaborators/a%20b/permission');
  const missing = await resolveTrigger({
    repo: 'o/r', login: 'x', ghImpl: async () => { const e = new Error('nf'); e.status = 404; throw e; },
  });
  assert.equal(missing.permission, 'none');
  const down = await resolveTrigger({
    repo: 'o/r', login: 'x', ghImpl: async () => { const e = new Error('down'); e.status = 502; throw e; },
  });
  assert.ok(down.error);
});

test('assertStillEntitled: --plan-in stops after an uninstall or a lost write permission', () => {
  const issue = clientIssue();
  assert.doesNotThrow(() => assertStillEntitled({ issue, tenant, entitlement: installed, trigger: writer }));
  assert.throws(
    () => assertStillEntitled({ issue, tenant, entitlement: { installation: null, client: null }, trigger: writer }),
    (err) => err.status === 403 && /app-not-installed/.test(err.message),
  );
  assert.throws(
    () => assertStillEntitled({ issue, tenant, entitlement: installed, trigger: { login: 'm', permission: 'read' } }),
    /trigger-not-writer/,
  );
});
