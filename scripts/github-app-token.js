'use strict';

/**
 * Mint a short-lived GitHub App installation token (RS256 JWT →
 * POST /app/installations/{id}/access_tokens). Never logs the token.
 */

const crypto = require('crypto');

function toBase64Url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function githubAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url({ alg: 'RS256', typ: 'JWT' });
  const payload = toBase64Url({
    iat: now - 60,
    exp: now + 540,
    iss: String(appId),
  });
  const data = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  return `${data}.${signer.sign(privateKeyPem, 'base64url')}`;
}

async function mintGithubAppInstallationToken({
  appId,
  privateKey,
  owner,
  fetchImpl = fetch,
} = {}) {
  if (!appId || !privateKey) {
    const err = new Error('GitHub App mint requires appId and privateKey.');
    err.status = 400;
    throw err;
  }
  const jwt = githubAppJwt(appId, privateKey);
  const headers = {
    Authorization: `Bearer ${jwt}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'noemi-github-app-token',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const list = await fetchImpl('https://api.github.com/app/installations?per_page=100', { headers });
  if (!list.ok) {
    const err = new Error(`GitHub App installations → ${list.status}`);
    err.status = list.status;
    throw err;
  }
  const installations = await list.json();
  if (!Array.isArray(installations) || installations.length === 0) {
    const err = new Error('GitHub App has no installations.');
    err.status = 404;
    throw err;
  }
  let installation = installations[0];
  if (owner) {
    const want = String(owner).toLowerCase();
    const hit = installations.find(
      (item) => item.account && String(item.account.login || '').toLowerCase() === want,
    );
    if (!hit) {
      const err = new Error(`GitHub App is not installed on ${owner}.`);
      err.status = 404;
      throw err;
    }
    installation = hit;
  }
  const minted = await fetchImpl(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    { method: 'POST', headers },
  );
  if (!minted.ok) {
    const err = new Error(`GitHub App access token → ${minted.status}`);
    err.status = minted.status;
    throw err;
  }
  const body = await minted.json();
  if (!body || !body.token) {
    const err = new Error('GitHub App access token response had no token.');
    err.status = 502;
    throw err;
  }
  return body.token;
}

module.exports = { githubAppJwt, mintGithubAppInstallationToken };
