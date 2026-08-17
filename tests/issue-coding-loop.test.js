const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const REQUIRED_STAGES = ['triage', 'plan', 'code', 'redteam'];
const SKILL_REF_RE = /\*\*Skill:\*\*\s+`([^`]+)`/g;

test('model-routing.json declares reviewer-style selection and a plan cycle limit', () => {
  const routing = readJson('docs/model-routing.json');

  assert.equal(routing.version, 1);
  assert.equal(routing.selectionDefault, 'highest-preview-then-stable');
  assert.equal(routing.planRedTeam.maxCycles, 3);
  assert.equal(routing.planRedTeam.onLimit, 'needs-info');
  assert.ok(routing.planRedTeam.maxCycles >= 1);

  for (const stage of REQUIRED_STAGES) {
    const entry = routing.stages[stage];
    assert.ok(entry, `missing stage ${stage}`);
    assert.equal(typeof entry.provider, 'string');
    assert.equal(typeof entry.family, 'string');
    assert.equal(entry.selection, 'highest-preview-then-stable');
    assert.ok(!('model' in entry), `${stage} must not hardcode a stale model slug`);
  }

  assert.equal(routing.stages.triage.provider, 'anthropic');
  assert.equal(routing.stages.plan.provider, 'anthropic');
  assert.equal(routing.stages.code.provider, 'xai');
  assert.equal(routing.stages.code.effort, 'xhigh');
  assert.equal(routing.stages.redteam.provider, 'google');
  assert.equal(routing.stages.redteam.family, 'gemini-pro');
});

test('internal tenant fixture matches the entitlements schema shape', () => {
  const schema = readJson('docs/entitlements.schema.json');
  const tenant = readJson('tenants/internal.json');

  assert.equal(schema.type, 'object');
  for (const key of ['tenantId', 'source', 'plan', 'limits']) {
    assert.ok(schema.required.includes(key), `schema must require ${key}`);
    assert.ok(key in tenant, `internal tenant missing ${key}`);
  }

  assert.equal(tenant.source, 'newpush-pool');
  assert.equal(tenant.plan, 'internal');
  assert.ok(Array.isArray(tenant.orgs));
  assert.deepEqual(tenant.orgs, ['newpush', 'project-noemi', 'newpush-labs']);
  assert.equal(typeof tenant.limits.concurrent_jobs, 'number');
  assert.ok(tenant.limits.concurrent_jobs >= 1);
  assert.ok(tenant.limits.daily_usd === null || typeof tenant.limits.daily_usd === 'number');
  assert.ok(Array.isArray(tenant.limits.repos));
  assert.equal(tenant.limits.repos.length, 0, 'internal tenant has no repo deny-list');
  assert.equal(schema.properties.source.enum.includes(tenant.source), true);
  assert.equal(schema.properties.plan.enum.includes(tenant.plan), true);
});

test('issue-conductor skill references resolve to files on disk', () => {
  const content = read('agents/engineering/issue-conductor.md');
  const refs = [...content.matchAll(SKILL_REF_RE)].map((match) => match[1]);
  assert.ok(refs.length >= 3, 'conductor must compose intake, plan, and dispatch skills');

  const expected = [
    'classification/issue-intake',
    'orchestration/issue-plan',
    'orchestration/dispatch-coordinate',
    'security/pii-scan',
  ];
  for (const ref of expected) {
    assert.ok(refs.includes(ref), `conductor workflow missing **Skill:** \`${ref}\``);
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'skills', `${ref}.md`)),
      `broken skill reference: ${ref}`,
    );
  }
});

test('architecture doc names the three identities and the plan cycle stop', () => {
  const doc = read('docs/architecture/issue-coding-loop.md');
  assert.match(doc, /noemi-conductor/);
  assert.match(doc, /noemi-agent/);
  assert.match(doc, /noemi-reviewer-bot/);
  assert.match(doc, /planRedTeam\.maxCycles/);
  assert.match(doc, /Never start Stage C on a rejected plan/);
  assert.match(doc, /highest-generation preview/);
});

test('architecture keeps the loop in this repo under coding-loop/', () => {
  const doc = read('docs/architecture/issue-coding-loop.md');
  assert.match(doc, /newpush\/newpush-mastra-orchestration/);
  assert.match(doc, /not a second GitHub repo/);
  assert.match(doc, /coding-loop\//);
  assert.ok(require('fs').existsSync(require('path').join(__dirname, '..', 'coding-loop', 'run.js')));
});

test('architecture and conductor treat GitHub 429/5xx as retries, not verdicts', () => {
  const doc = read('docs/architecture/issue-coding-loop.md');
  const conductor = read('agents/engineering/issue-conductor.md');
  assert.match(doc, /GitHub availability/);
  assert.match(doc, /scripts\/resilience_helpers\.js/);
  assert.match(doc, /re-queues the review/);
  assert.match(doc, /required to complete/);
  assert.match(conductor, /scripts\/resilience_helpers\.js/);
  assert.match(conductor, /GitHub outage is not a decision/);
  assert.match(conductor, /429 and 5xx/);
});
