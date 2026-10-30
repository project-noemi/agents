'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getProvider, listProviders, parseRepoRef, registerProvider, unregisterProvider,
} = require('../coding-loop/providers/index.js');
const {
  PROVIDER_METHODS, assertProvider, makeRepoRef, ownerEntryMatches, repoEntryMatches,
} = require('../coding-loop/providers/contract.js');
const template = require('../coding-loop/providers/_template/index.js');
const github = require('../coding-loop/providers/github/index.js');
const { findClient, parseClientRegistry } = require('../coding-loop/client-registry.js');
const { classifyIssue, tenantAllows } = require('../coding-loop/intake.js');
const run = require('../coding-loop/run.js');

function sink() {
  const out = { text: '' };
  out.write = (chunk) => { out.text += chunk; return true; };
  return out;
}

// ---------------------------------------------------------------- parseRepoRef

test('parseRepoRef: bare owner/name stays GitHub; prefixes and URLs resolve', () => {
  const bare = parseRepoRef('project-noemi/agents', { env: {} });
  assert.deepEqual({ ...bare }, {
    provider: 'github',
    host: 'github.com',
    owner: 'project-noemi',
    project: null,
    name: 'agents',
    slug: 'project-noemi/agents',
    key: 'github:project-noemi/agents',
  });
  for (const input of ['github:project-noemi/agents', 'gh:project-noemi/agents', 'GitHub:Project-Noemi/Agents',
    'https://github.com/project-noemi/agents', 'https://github.com/project-noemi/agents.git', 'https://www.github.com/project-noemi/agents/']) {
    assert.equal(parseRepoRef(input, { env: {} }).key, 'github:project-noemi/agents', input);
  }
});

test('parseRepoRef: GHES URLs only when GITHUB_API_URL names that host', () => {
  const env = { GITHUB_API_URL: 'https://ghe.example.com/api/v3' };
  const ref = parseRepoRef('https://ghe.example.com/acme/app', { env });
  assert.equal(ref.host, 'ghe.example.com');
  assert.equal(ref.key, 'github:acme/app');
  assert.equal(parseRepoRef('acme/app', { env }).host, 'ghe.example.com');
  // A github.com URL would be looked up on the GHES host: refused.
  assert.throws(() => parseRepoRef('https://github.com/acme/app', { env }), (err) => err.status === 400);
  assert.throws(() => parseRepoRef('https://ghe.example.com/acme/app', { env: {} }), (err) => err.status === 400);
});

test('parseRepoRef: Azure DevOps shapes in a build without the ADO provider → clear 400 "not available"', () => {
  const adoProvider = getProvider('azure-devops');
  unregisterProvider('azure-devops');
  try {
    for (const input of [
      'azure-devops:contoso/web/api', 'ado:contoso/web/api', 'azdo:contoso/web/api',
      'https://dev.azure.com/contoso/web/_git/api', 'https://contoso.visualstudio.com/web/_git/api',
    ]) {
      assert.throws(
        () => parseRepoRef(input, { env: {} }),
        (err) => err.status === 400 && err.code === 'provider-not-available' && /not available/.test(err.message),
        input,
      );
    }
  } finally {
    registerProvider(adoProvider);
  }
  assert.equal(parseRepoRef('ado:contoso/web/api', { env: {} }).key, 'azure-devops:contoso/web/api');
});

test('parseRepoRef: unknown prefix and malformed slugs are 400', () => {
  assert.throws(() => parseRepoRef('gitlab:o/r', { env: {} }), (err) => err.status === 400 && err.code === 'provider-unknown');
  for (const bad of ['', 'org', 'org/repo/extra', '../etc/passwd', 'org/re po', 'github:org', 'http://github.com/o/r']) {
    assert.throws(() => parseRepoRef(bad, { env: {} }), (err) => err.status === 400 && /owner\/name/.test(err.message), bad);
  }
});

// ---------------------------------------------------------------- registry + contract

test('registry: github registered; aliases resolve; unknown forge is 400', () => {
  assert.deepEqual(listProviders().map((p) => p.id), ['github', 'azure-devops']);
  assert.equal(getProvider('gh').id, 'github');
  assert.equal(getProvider('ado').id, 'azure-devops');
  assert.throws(() => getProvider('gitlab'), (err) => err.status === 400 && /not available/.test(err.message));
  assert.throws(() => registerProvider(github.provider), (err) => err.status === 409);
});

test('assertProvider: GitHub passes; an incomplete object names what is missing', () => {
  assert.doesNotThrow(() => assertProvider(github.provider));
  assert.throws(
    () => assertProvider({ id: 'half', label: 'Half', carveOutHints: [], parseRepo() {} }),
    (err) => err.status === 500 && err.code === 'provider-contract' && /getItem must be a function/.test(err.message)
      && /commitFiles must be a function/.test(err.message),
  );
  assert.throws(() => assertProvider({ ...github.provider, id: 'Bad Id' }), /lowercase/);
  assert.throws(() => assertProvider({ ...github.provider, carveOutHints: 'x' }), /carveOutHints/);
  assert.throws(() => assertProvider(null), /not an object/);
});

test('_template: shape-valid, never registered, every method is 501', async () => {
  assert.doesNotThrow(() => assertProvider(template.provider));
  assert.ok(!listProviders().some((p) => p.id === template.provider.id));
  assert.throws(() => getProvider(template.provider.id), (err) => err.status === 400);
  for (const method of PROVIDER_METHODS) {
    let caught;
    try {
      await template.provider[method]({});
    } catch (err) {
      caught = err;
    }
    assert.equal(caught && caught.status, 501, method);
  }
});

// ---------------------------------------------------------------- tenant / registry matching

test('tenant matching: bare entries are GitHub and exact; prefixed entries are keys', () => {
  const ado = makeRepoRef({
    provider: 'azure-devops', host: 'dev.azure.com', owner: 'Contoso', project: 'Web', name: 'Api',
  });
  const gh = makeRepoRef({ provider: 'github', host: 'github.com', owner: 'newpush', name: 'x' });
  assert.equal(ownerEntryMatches('newpush', gh), true);
  assert.equal(ownerEntryMatches('NewPush', gh), false, 'bare entries stay exact');
  assert.equal(ownerEntryMatches('github:NewPush', gh), true);
  assert.equal(ownerEntryMatches('contoso', ado), false, 'a bare entry never grants another forge');
  assert.equal(ownerEntryMatches('ado:contoso', ado), true);
  assert.equal(repoEntryMatches('newpush/x', gh), true);
  assert.equal(repoEntryMatches('azure-devops:contoso/web/api', ado), true);
  assert.equal(repoEntryMatches('contoso/web/api', ado), false);

  const tenant = { orgs: ['newpush', 'azure-devops:contoso'], limits: { repos: ['newpush/x', 'ado:contoso/web/api'] } };
  assert.equal(tenantAllows({ org: 'newpush', repo: 'x' }, tenant).ok, true);
  assert.equal(tenantAllows({ org: 'newpush', repo: 'y' }, tenant).reason, 'outside-tenant');
  assert.equal(tenantAllows({
    provider: 'azure-devops', org: 'contoso', project: 'web', repo: 'api',
  }, tenant).via, 'tenant');
  assert.equal(tenantAllows({ org: 'contoso', repo: 'api' }, tenant).reason, 'outside-tenant');
});

test('intake: `grant` and legacy `installation` both drive client entitlement', () => {
  const issue = {
    org: 'client-org', repo: 'crm', number: 7, author: { login: 'a', isBot: false }, title: 't', body: 'b', labels: [],
  };
  const tenant = { orgs: ['newpush'] };
  const client = { account_id: 42, status: 'active' };
  assert.equal(tenantAllows(issue, tenant, { grant: { accountId: 42, suspended: false }, client }).via, 'client');
  assert.equal(tenantAllows(issue, tenant, { grant: null, client: null }).reason, 'app-not-installed');
  assert.equal(tenantAllows(issue, tenant, { grant: { suspended: true }, client }).reason, 'installation-suspended');
  assert.equal(tenantAllows(issue, tenant, { installation: { account_id: 42, suspended: false }, client }).via, 'client');
  // A WorkItem author object carries the provider's bot verdict.
  const bot = classifyIssue({ issue: { ...issue, author: { login: 'svc', isBot: true } } });
  assert.deepEqual(bot.reasons, ['bot-author']);
});

test('client registry: provider rows; GitHub ids stay integers; no cross-forge match', () => {
  const registry = parseClientRegistry(JSON.stringify({
    clients: [
      { account_id: 42, status: 'active' },
      { provider: 'ado', account_id: 'A1B2C3D4-0000-0000-0000-000000000000', tenant_id: 'b1b2c3d4-0000-0000-0000-000000000000', status: 'active' },
      { provider: 'example-forge', account_id: 42, status: 'suspended' },
    ],
  }));
  assert.equal(findClient(registry, { provider: 'github', accountId: 42 }).status, 'active');
  assert.equal(findClient(registry, { provider: 'example-forge', accountId: 42 }).status, 'suspended');
  assert.ok(findClient(registry, { provider: 'azure-devops', accountId: 'a1b2c3d4-0000-0000-0000-000000000000' }));
  assert.equal(findClient(registry, { provider: 'github', accountId: 'A1B2C3D4-0000-0000-0000-000000000000' }), null);
  assert.throws(() => parseClientRegistry('{"clients":[{"provider":"github","account_id":"42","status":"active"}]}'), /integer account_id/);
  assert.throws(() => parseClientRegistry('{"clients":[{"provider":"ado","account_id":"","status":"active"}]}'), /account_id/);
  assert.throws(() => parseClientRegistry('{"clients":[{"provider":"example-forge","account_id":"","status":"active"}]}'), /account_id/);
  assert.throws(() => parseClientRegistry('{"clients":[{"provider":"Not A Forge","account_id":1,"status":"active"}]}'), /provider/);
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'client-registry.schema.json'), 'utf8'));
  const row = schema.properties.clients.items.properties;
  assert.equal(row.provider.default, 'github');
  assert.deepEqual(row.account_id.oneOf.map((s) => s.type), ['integer', 'string']);
});

// ---------------------------------------------------------------- run.js seam

test('run: --item is an alias for --issue; plan files are v3 and v1/v2 still read', () => {
  assert.equal(run.parseArgs(['--repo', 'o/r', '--item', '7']).issue, '7');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-v3-'));
  try {
    const accepted = { status: 'accepted', plan: '## Goal\nx', files: [] };
    const file = path.join(dir, 'plan.json');
    run.writePlanFile(file, {
      repo: 'O/R', issue: '1', fingerprint: 'f', intake: {}, plan: accepted,
    });
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(record.version, 3);
    assert.equal(record.provider, 'github');
    assert.equal(record.repoKey, 'github:o/r');
    assert.equal(run.readPlanFile(file, {
      repo: 'o/r', issue: '1', fingerprint: 'f', profile: 'code',
    }).plan.status, 'accepted', 'v3 compares the normalized key');
    assert.throws(() => run.readPlanFile(file, {
      repo: 'o/other', issue: '1', fingerprint: 'f', profile: 'code',
    }), /plan is for/);

    const v2 = path.join(dir, 'v2.json');
    fs.writeFileSync(v2, JSON.stringify({
      version: 2, repo: 'o/r', issue: 1, issueFingerprint: 'f', profile: 'code', intake: {}, plan: accepted,
    }));
    assert.equal(run.readPlanFile(v2, {
      repo: 'o/r', issue: '1', fingerprint: 'f', profile: 'code',
    }).plan.status, 'accepted');
    assert.throws(() => run.readPlanFile(v2, {
      repo: 'O/R', issue: '1', fingerprint: 'f', profile: 'code',
    }), /plan is for/, 'v2 keeps its exact slug comparison');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('run: hiddenText joins the scan and the fingerprint only when present', () => {
  const issue = { title: 'T', body: 'B' };
  assert.equal(run.scanText(issue), 'T\nB');
  assert.equal(run.issueFingerprint(issue), run.issueFingerprint({ ...issue, hiddenText: '' }));
  assert.notEqual(run.issueFingerprint(issue), run.issueFingerprint({ ...issue, hiddenText: 'h' }));
  const scanned = run.resolveScanInput({ scan: true }, { ...issue, hiddenText: 'key AKIAIOSFODNN7EXAMPLE' });
  assert.equal(scanned.status, 'BLOCKED');
});

/**
 * A second forge, in memory, registered for one test: proves a provider
 * plugs into runLoop without touching intake.js or run.js.
 */
function memoryForge() {
  const state = { comments: [], labels: ['bug'] };
  const ID = 'memforge';
  const forge = {
    id: ID,
    label: 'Memory forge',
    carveOutHints: [],
    parseRepo(input) {
      const m = /^memforge:([a-z]+)\/([a-z]+)\/([a-z]+)$/.exec(String(input));
      return m ? makeRepoRef({
        provider: ID, host: 'mem', owner: m[1], project: m[2], name: m[3],
      }) : null;
    },
    parseItemId: github.provider.parseItemId,
    itemDisplay: (ref, id) => `${ref.slug}#${id}`,
    closingLine: (id, { closes } = {}) => `${closes ? 'Fixes' : 'Related'} AB#${id}`,
    branchForItem: (id) => `noemi/item-${id}`,
    async resolveCredential({ role }) { return role === 'producer' ? null : { provider: ID, role, source: 'mem' }; },
    async whoAmI() { return { id: 1, login: 'noemi-agent' }; },
    expectedProducerLogin: () => 'noemi-agent',
    async getItem(ref, id) {
      return {
        provider: ID,
        id: String(id),
        number: Number(id),
        org: ref.owner,
        project: ref.project,
        repo: ref.name,
        title: 'Fix the API',
        body: 'src/api.js returns 500; done when the test passes.',
        bodyFormat: 'markdown',
        hiddenText: state.hidden || '',
        author: { id: 'u1', login: 'alice', isBot: false },
        labels: [...state.labels],
        updatedAt: null,
        version: 3,
        url: null,
        repoKey: ref.key,
      };
    },
    async postComment(ref, id, markdown) { state.comments.push(markdown); },
    async syncLoopLabel(ref, item, label) { state.labels = [...state.labels.filter((l) => !l.startsWith('noemi:')), label]; },
    async resolveEntitlement() { return null; },
    async requesterPermission(ref, login) { return { login, permission: 'write' }; },
    async listIntegrationBranches() { return ['develop']; },
    async readFile() { return { missing: true }; },
    async commitFiles() { return { status: 'created', sha: 'x' }; },
    async openChangeRequest() { return { url: 'mem://1', number: 1, existing: false }; },
    isBotIdentity: (author) => Boolean(author && author.isBot),
  };
  return { forge, state };
}

test('runLoop: a registered forge drives Stage A end to end; hiddenText is scanned', async () => {
  const { forge, state } = memoryForge();
  registerProvider(forge);
  try {
    const tenant = { orgs: ['memforge:contoso'], limits: { repos: [] } };
    const argv = ['--repo', 'memforge:contoso/web/api', '--item', '5', '--scan', '--budget-ok', '--post', '--requested-by', 'alice'];
    const stderr = sink();
    const stageB = async ({ issue }) => {
      assert.equal(issue.project, 'web');
      return { intake: { tier: 'ACTIONABLE', reasons: [], label: 'noemi:queued' }, plan: { status: 'needs-info', label: 'noemi:needs-info', findings: [] } };
    };
    await run.runLoop({
      args: run.parseArgs(argv), env: {}, stderr, deps: { loadTenant: () => tenant, completeThroughStageB: stageB },
    });
    assert.match(stderr.text, /"provider=memforge"/);
    assert.match(stderr.text, /issue=contoso\/web\/api#5/);
    assert.equal(state.comments.length, 1);
    assert.ok(state.labels.includes('noemi:needs-info'));

    // Hidden text a human cannot see is scanned with the body.
    state.hidden = 'password: AKIAIOSFODNN7EXAMPLE';
    const blocked = await run.runLoop({
      args: run.parseArgs(argv), env: {}, stderr: sink(), deps: { loadTenant: () => tenant },
    });
    assert.deepEqual(blocked.intake.reasons, ['scan-blocked']);

    // A bare entry never entitles another forge.
    const refused = await run.runLoop({
      args: run.parseArgs(argv), env: {}, stderr: sink(), deps: { loadTenant: () => ({ orgs: ['contoso'] }) },
    });
    assert.deepEqual(refused.intake.reasons, ['outside-tenant']);
  } finally {
    unregisterProvider('memforge');
  }
  assert.deepEqual(listProviders().map((p) => p.id), ['github', 'azure-devops']);
});
