const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { githubAppJwt, mintGithubAppInstallationToken } = require('../scripts/github-app-token.js');

test('githubAppJwt is a three-part RS256 token whose iss is the App id', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = githubAppJwt('4490886', pem);
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.equal(payload.iss, '4490886');
});

test('mintGithubAppInstallationToken picks the owner install and POSTs for a token', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET' });
    if (String(url).includes('/app/installations?')) {
      return {
        ok: true,
        json: async () => [
          { id: 1, account: { login: 'other' } },
          { id: 99, account: { login: 'newpush' } },
        ],
      };
    }
    if (String(url).endsWith('/app/installations/99/access_tokens')) {
      return { ok: true, json: async () => ({ token: 'ghs_test' }) };
    }
    throw new Error(`unexpected ${url}`);
  };
  const token = await mintGithubAppInstallationToken({
    appId: '1',
    privateKey: pem,
    owner: 'newpush',
    fetchImpl,
  });
  assert.equal(token, 'ghs_test');
  assert.equal(calls[1].method, 'POST');
});

test('mintGithubAppInstallationToken allows no owner when exactly one installation', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const fetchImpl = async (url, opts = {}) => {
    if (String(url).includes('/app/installations?')) {
      return {
        ok: true,
        json: async () => [{ id: 50, account: { login: 'solo' } }],
      };
    }
    if (String(url).endsWith('/app/installations/50/access_tokens')) {
      return { ok: true, json: async () => ({ token: 'ghs_solo' }) };
    }
    throw new Error(`unexpected ${url}`);
  };
  const token = await mintGithubAppInstallationToken({
    appId: '1',
    privateKey: pem,
    fetchImpl,
  });
  assert.equal(token, 'ghs_solo');
});

test('mintGithubAppInstallationToken refuses no owner when multiple installations', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const fetchImpl = async (url, opts = {}) => {
    if (String(url).includes('/app/installations?')) {
      return {
        ok: true,
        json: async () => [
          { id: 1, account: { login: 'org1' } },
          { id: 2, account: { login: 'org2' } },
        ],
      };
    }
    throw new Error(`unexpected ${url}`);
  };
  await assert.rejects(
    async () => {
      await mintGithubAppInstallationToken({
        appId: '1',
        privateKey: pem,
        fetchImpl,
      });
    },
    {
      message: 'GitHub App has 2 installations. Specify owner to select one.',
      status: 400,
    },
  );
});

test('mintGithubAppInstallationToken paginates beyond 100 installations', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET' });
    if (String(url).includes('/app/installations?')) {
      const urlObj = new URL(url);
      const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
      if (page === 1) {
        // First page: 100 installs
        const batch = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          account: { login: `org${i + 1}` },
        }));
        return { ok: true, json: async () => batch };
      } else if (page === 2) {
        // Second page: 50 more installs, including target
        const batch = Array.from({ length: 50 }, (_, i) => ({
          id: 100 + i + 1,
          account: { login: `org${100 + i + 1}` },
        }));
        return { ok: true, json: async () => batch };
      }
      return { ok: true, json: async () => [] };
    }
    if (String(url).endsWith('/app/installations/125/access_tokens')) {
      return { ok: true, json: async () => ({ token: 'ghs_paginated' }) };
    }
    throw new Error(`unexpected ${url}`);
  };
  const token = await mintGithubAppInstallationToken({
    appId: '1',
    privateKey: pem,
    owner: 'org125',
    fetchImpl,
  });
  assert.equal(token, 'ghs_paginated');
  // Verify two pages were fetched
  const listCalls = calls.filter((c) => c.url.includes('/app/installations?'));
  assert.equal(listCalls.length, 2);
});
