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
