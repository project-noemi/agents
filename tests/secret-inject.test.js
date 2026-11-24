'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ManifestError,
  parseManifest,
  resolveEntries,
  buildChildEnv,
  readSecretManager,
  readKeyVault,
  parseArgs,
} = require('../scripts/secret-inject');

test('parses one Secret Manager manifest and defaults the version to latest', () => {
  const entries = parseManifest(`
# workflow inbox
MAIL_API_TOKEN=sm://noemi-prod/inbox-triage-mail-token
`);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    name: 'MAIL_API_TOKEN',
    cloud: 'sm',
    project: 'noemi-prod',
    secret: 'inbox-triage-mail-token',
    version: 'latest',
  });
});

test('parses a pinned Key Vault secret version', () => {
  const entries = parseManifest('CRM_API_TOKEN=kv://inbox-triage/crm-token/0123456789abcdef0123456789abcdef\n');
  assert.equal(entries[0].cloud, 'kv');
  assert.equal(entries[0].vault, 'inbox-triage');
  assert.equal(entries[0].version, '0123456789abcdef0123456789abcdef');
});

test('refuses a raw secret value, a mixed cloud, and a repeated name', () => {
  assert.throws(() => parseManifest('TOKEN=super-secret-value\n'), (err) => err.code === 'bad-resource');
  assert.throws(
    () => parseManifest('A=sm://noemi-prod/a\nB=kv://inbox-triage/b\n'),
    (err) => err.code === 'mixed-cloud',
  );
  assert.throws(
    () => parseManifest('A=sm://noemi-prod/a\nA=sm://noemi-prod/b\n'),
    (err) => err.code === 'duplicate-name',
  );
  assert.throws(() => parseManifest('# only a comment\n'), (err) => err.code === 'empty');
});

test('resolves through the stub reader and puts values only in the child env', () => {
  const entries = parseManifest('MAIL_API_TOKEN=sm://noemi-prod/inbox-triage-mail-token/3\n');
  const seen = [];
  const resolved = resolveEntries(entries, {
    sm(entry) {
      seen.push(entry.secret);
      return 'value-from-vault\n';
    },
  });
  assert.deepEqual(seen, ['inbox-triage-mail-token']);
  const env = buildChildEnv({ PATH: '/usr/bin' }, resolved);
  assert.equal(env.MAIL_API_TOKEN, 'value-from-vault\n');
  assert.equal(env.PATH, '/usr/bin');
});

test('an empty read and a reader failure name the resource and not the value', () => {
  const entries = parseManifest('MAIL_API_TOKEN=kv://inbox-triage/mail-token\n');
  assert.throws(
    () => resolveEntries(entries, { kv: () => '' }),
    (err) => err.code === 'empty-secret' && !String(err.message).includes('hunter2'),
  );
  assert.throws(
    () => resolveEntries(entries, {
      kv: () => {
        throw new Error('backend said hunter2');
      },
    }),
    (err) => err instanceof ManifestError && err.code === 'secret-read' && !err.message.includes('hunter2'),
  );
});

test('gcloud and az are invoked with the resource id and the value stays on stdout capture', () => {
  const sm = readSecretManager(
    { project: 'noemi-prod', secret: 'inbox-triage-mail-token', version: 'latest' },
    (cmd, args) => {
      assert.equal(cmd, 'gcloud');
      assert.deepEqual(args, [
        'secrets', 'versions', 'access', 'latest',
        '--secret=inbox-triage-mail-token',
        '--project=noemi-prod',
      ]);
      return { status: 0, stdout: 'from-gcp\n' };
    },
  );
  assert.equal(sm, 'from-gcp');

  const kv = readKeyVault(
    { vault: 'inbox-triage', secret: 'mail-token', version: 'latest' },
    (cmd, args) => {
      assert.equal(cmd, 'az');
      assert.ok(!args.includes('--value'));
      assert.deepEqual(args.slice(0, 4), ['keyvault', 'secret', 'show', '--vault-name']);
      return { status: 0, stdout: 'from-azure\n' };
    },
  );
  assert.equal(kv, 'from-azure');

  assert.throws(
    () => readSecretManager(
      { project: 'noemi-prod', secret: 'missing', version: 'latest' },
      () => ({ status: 1, stdout: '', stderr: 'secret payload leaked' }),
    ),
    (err) => err.code === 'secret-read' && !err.message.includes('leaked'),
  );
});

test('parseArgs keeps the command after --', () => {
  const parsed = parseArgs(['node', 'secret-inject.js', '--manifest', 'workflows/inbox.secrets', '--', 'gemini', '--prompt', 'hi']);
  assert.equal(parsed.manifest, 'workflows/inbox.secrets');
  assert.deepEqual(parsed.command, ['gemini', '--prompt', 'hi']);
  assert.throws(() => parseArgs(['node', 'secret-inject.js']), (err) => err.code === 'usage');
});
