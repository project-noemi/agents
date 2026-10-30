'use strict';

/**
 * Reusable conformance suite for coding-loop forge providers.
 *
 * Every provider runs the same cases against a fake of its own forge. The
 * suite knows nothing about any forge's API: the provider's test file
 * supplies a harness that wires the provider to its fake and exposes a
 * small, forge-neutral control surface (seed an item, seed a file, inject a
 * failure, inspect what became visible). See tests/providers-conformance.test.js
 * for the GitHub harness; an Azure DevOps harness implements the same shape.
 *
 * Harness (returned fresh by makeHarness() for every case):
 *   provider                     the provider under test, bound to the fake
 *   ref                          RepoRef of the fake repository
 *   parseCases                   { valid: [[input, expectedKey]], invalid: [input] }
 *   env                          { conductor, producer, conductorAsProducer, reader, none }
 *   secrets                      token values that must never serialize
 *   humanItem, botItem           seeded item ids (human author / bot author)
 *   labelledItem                 seeded item id carrying labels noemi:queued + bug
 *   seedFile(path, content, { executable })
 *   seedForeignBranch(head)      a branch at `head` holding different content
 *   fail(op, status)             op: 'comment' | 'commit' | 'permission'; persistent
 *   attempts(op)                 write attempts the fake saw for op ('comment')
 *   branchExists(name)
 *   fileAt(branch, path)         → { content, executable } | null
 *   itemLabels(id)               → string[] as stored by the fake
 *   grantPermission(login, permission)
 *   tenantOwnerEntry             a tenant `orgs` entry that lists ref.owner
 *   capabilities                 { executableBit: boolean }
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSIONS, assertProvider } = require('../../coding-loop/providers/contract.js');
const { isSafeRepoPath } = require('../../coding-loop/paths.js');

const WORK_ITEM_KEYS = [
  'provider', 'id', 'number', 'org', 'repo', 'title', 'body', 'bodyFormat', 'hiddenText',
  'author', 'labels', 'updatedAt', 'version', 'url', 'repoKey',
];

function runConformance({ name, makeHarness }) {
  const t = (title, fn) => test(`conformance[${name}]: ${title}`, async () => fn(await makeHarness()));

  t('shape: assertProvider passes; id/label/carveOutHints present', (h) => {
    assert.doesNotThrow(() => assertProvider(h.provider));
    assert.equal(typeof h.provider.label, 'string');
    assert.ok(Array.isArray(h.provider.carveOutHints));
  });

  t('parseRepo: valid inputs give a RepoRef with the expected key; others are null', (h) => {
    for (const [input, key] of h.parseCases.valid) {
      const ref = h.provider.parseRepo(input, { env: h.env.none });
      assert.ok(ref, input);
      assert.equal(ref.key, key, input);
      assert.equal(ref.provider, h.provider.id);
      assert.equal(ref.key, `${ref.provider}:${ref.slug}`.toLowerCase());
      for (const field of ['host', 'owner', 'name', 'slug']) assert.equal(typeof ref[field], 'string', field);
    }
    for (const input of h.parseCases.invalid) {
      assert.equal(h.provider.parseRepo(input, { env: h.env.none }), null, String(input));
    }
  });

  t('parseItemId / itemDisplay / closingLine / branchForItem', (h) => {
    assert.equal(h.provider.parseItemId('12'), '12');
    for (const bad of ['0', '-1', '12abc', '1.5', '', '01', '../1', '1/2']) {
      assert.throws(() => h.provider.parseItemId(bad), (err) => err.status === 400, bad);
    }
    assert.match(h.provider.itemDisplay(h.ref, '12'), /12/);
    const closes = h.provider.closingLine('12', { closes: true });
    const partOf = h.provider.closingLine('12', { closes: false });
    assert.match(closes, /12/);
    assert.match(partOf, /12/);
    assert.notEqual(closes, partOf);
    assert.ok(isSafeRepoPath(h.provider.branchForItem('12')));
  });

  t('getItem: normalized WorkItem; bot author detected; repoKey from the forge', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'reader', ref: h.ref, env: h.env.reader });
    const human = await h.provider.getItem(h.ref, h.humanItem, cred);
    for (const key of WORK_ITEM_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(human, key), key);
    assert.equal(human.provider, h.provider.id);
    assert.equal(human.id, String(h.humanItem));
    assert.equal(human.number, Number(h.humanItem));
    assert.equal(human.bodyFormat, 'markdown');
    assert.equal(typeof human.hiddenText, 'string');
    assert.equal(typeof human.title, 'string');
    assert.equal(typeof human.body, 'string');
    assert.equal(human.author.isBot, false);
    assert.equal(typeof human.author.login, 'string');
    assert.ok(human.labels.every((l) => typeof l === 'string'));
    assert.equal(human.repoKey, h.ref.key);
    assert.equal(h.provider.isBotIdentity(human.author), false);

    const bot = await h.provider.getItem(h.ref, h.botItem, cred);
    assert.equal(bot.author.isBot, true);
    assert.equal(h.provider.isBotIdentity(bot.author), true);
  });

  t('postComment: posts once; a 5xx is NOT retried (the write may have landed)', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'conductor', ref: h.ref, env: h.env.conductor });
    await h.provider.postComment(h.ref, h.humanItem, 'hello', cred);
    assert.equal(h.attempts('comment'), 1);
    h.fail('comment', 502);
    await assert.rejects(() => h.provider.postComment(h.ref, h.humanItem, 'again', cred), (err) => err.status === 502);
    assert.equal(h.attempts('comment'), 2, 'exactly one attempt for the failed post');
  });

  t('syncLoopLabel: one noemi:* label left; other labels kept', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'conductor', ref: h.ref, env: h.env.conductor });
    const item = await h.provider.getItem(h.ref, h.labelledItem, cred);
    await h.provider.syncLoopLabel(h.ref, item, 'noemi:planned', cred);
    const labels = h.itemLabels(h.labelledItem);
    assert.ok(labels.includes('noemi:planned'));
    assert.ok(labels.includes('bug'));
    assert.deepEqual(labels.filter((l) => l.startsWith('noemi:')), ['noemi:planned']);
  });

  t('requesterPermission: granted → permission; unknown → none; failure → { error }', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'reader', ref: h.ref, env: h.env.reader });
    h.grantPermission('maintainer', 'write');
    const ok = await h.provider.requesterPermission(h.ref, 'maintainer', cred);
    assert.equal(ok.login, 'maintainer');
    assert.ok(PERMISSIONS.includes(ok.permission));
    assert.equal(ok.permission, 'write');
    assert.equal((await h.provider.requesterPermission(h.ref, 'stranger', cred)).permission, 'none');
    h.fail('permission', 502);
    const down = await h.provider.requesterPermission(h.ref, 'maintainer', cred);
    assert.equal(down.login, 'maintainer');
    assert.ok(down.error);
    assert.equal(down.permission, undefined);
  });

  t('listIntegrationBranches / readFile: content, missing, not-a-file', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'producer', ref: h.ref, env: h.env.producer });
    assert.deepEqual(await h.provider.listIntegrationBranches(h.ref, cred), ['develop']);
    h.seedFile('src/app.js', 'old\n');
    const read = await h.provider.readFile(h.ref, 'src/app.js', 'develop', cred);
    assert.equal(read.content, 'old\n');
    assert.ok(Object.prototype.hasOwnProperty.call(read, 'mode'));
    assert.deepEqual(await h.provider.readFile(h.ref, 'src/missing.js', 'develop', cred), { missing: true });
    assert.deepEqual(await h.provider.readFile(h.ref, 'src', 'develop', cred), { notFile: true });
    await assert.rejects(() => h.provider.readFile(h.ref, '../etc/passwd', 'develop', cred), (err) => err.status === 400);
  });

  t('commitFiles: atomic — a mid-way failure leaves no branch', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'producer', ref: h.ref, env: h.env.producer });
    h.fail('commit', 500);
    await assert.rejects(() => h.provider.commitFiles(h.ref, {
      base: 'develop', head: 'noemi/issue-12', files: [{ path: 'src/new.js', content: 'x\n' }], message: 'm',
    }, cred));
    assert.equal(h.branchExists('noemi/issue-12'), false);
  });

  t('commitFiles: created → resumed on the same tree → head-exists on another; mode preserved', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'producer', ref: h.ref, env: h.env.producer });
    h.seedFile('bin/run.sh', '#!/bin/sh\necho old\n', { executable: true });
    const change = {
      base: 'develop',
      head: 'noemi/issue-12',
      files: [{ path: 'bin/run.sh', content: '#!/bin/sh\necho new\n' }, { path: 'src/new.js', content: 'x\n' }],
      message: 'feat: change',
    };
    const first = await h.provider.commitFiles(h.ref, change, cred);
    assert.equal(first.status, 'created');
    assert.equal(typeof first.sha, 'string');
    assert.equal(h.fileAt('noemi/issue-12', 'bin/run.sh').content, '#!/bin/sh\necho new\n');
    if (h.capabilities.executableBit) {
      assert.equal(h.fileAt('noemi/issue-12', 'bin/run.sh').executable, true, 'executable bit kept');
      assert.equal(h.fileAt('noemi/issue-12', 'src/new.js').executable, false);
    }
    assert.equal((await h.provider.commitFiles(h.ref, change, cred)).status, 'resumed');

    h.seedForeignBranch('noemi/issue-13');
    const foreign = await h.provider.commitFiles(h.ref, { ...change, head: 'noemi/issue-13' }, cred);
    assert.equal(foreign.status, 'head-exists');
    assert.equal(h.fileAt('noemi/issue-13', 'src/new.js'), null, 'never overwritten');
  });

  t('commitFiles: refuses unsafe and carved-out paths before any write', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'producer', ref: h.ref, env: h.env.producer });
    for (const bad of ['../x.js', '.github/workflows/ci.yml', 'CODEOWNERS', '%2e%2e/x']) {
      await assert.rejects(() => h.provider.commitFiles(h.ref, {
        base: 'develop', head: 'noemi/issue-9', files: [{ path: bad, content: 'x' }], message: 'm',
      }, cred), (err) => err.status === 400, bad);
    }
    assert.equal(h.branchExists('noemi/issue-9'), false);
  });

  t('openChangeRequest: created, then the existing one on conflict', async (h) => {
    const cred = await h.provider.resolveCredential({ role: 'producer', ref: h.ref, env: h.env.producer });
    await h.provider.commitFiles(h.ref, {
      base: 'develop', head: 'noemi/issue-12', files: [{ path: 'src/new.js', content: 'x\n' }], message: 'm',
    }, cred);
    const input = {
      base: 'develop', head: 'noemi/issue-12', title: 't', body: 'b', itemId: '12',
    };
    const first = await h.provider.openChangeRequest(h.ref, input, cred);
    assert.equal(first.existing, false);
    assert.equal(typeof first.url, 'string');
    const again = await h.provider.openChangeRequest(h.ref, input, cred);
    assert.equal(again.existing, true);
    assert.equal(again.number, first.number);
  });

  t('resolveCredential: identity split; secrets never serialize', async (h) => {
    const { provider, ref, env } = h;
    const conductor = await provider.resolveCredential({ role: 'conductor', ref, env: env.conductor });
    assert.equal(conductor.role, 'conductor');
    assert.equal(conductor.provider, provider.id);
    assert.equal(await provider.resolveCredential({ role: 'conductor', ref, env: env.none }), null);
    assert.equal(await provider.resolveCredential({ role: 'reader', ref, env: env.none }), null);
    await assert.rejects(() => provider.resolveCredential({ role: 'producer', ref, env: env.conductor }), (err) => err.status === 400);
    await assert.rejects(
      () => provider.resolveCredential({ role: 'producer', ref, env: env.conductorAsProducer }),
      (err) => err.status === 400,
      'the conductor credential is refused as the producer',
    );
    const producer = await provider.resolveCredential({ role: 'producer', ref, env: env.producer });
    assert.equal(producer.role, 'producer');
    for (const cred of [conductor, producer]) {
      const text = JSON.stringify(cred) + JSON.stringify({ ...cred });
      for (const secret of h.secrets) assert.ok(!text.includes(secret), 'credential serialized a secret');
    }
    const me = await provider.whoAmI(ref, producer);
    assert.equal(me.login, provider.expectedProducerLogin(env.producer));
  });

  t('resolveEntitlement: tenant-listed owner → null; malformed registry → { error }', async (h) => {
    assert.equal(await h.provider.resolveEntitlement({
      ref: h.ref, tenant: { orgs: [h.tenantOwnerEntry] }, env: h.env.none,
    }), null);
    const bad = await h.provider.resolveEntitlement({
      ref: h.ref, tenant: { orgs: [] }, env: { NOEMI_CLIENT_REGISTRY: '{' },
    });
    assert.ok(bad && bad.error);
  });
}

module.exports = { WORK_ITEM_KEYS, runConformance };
