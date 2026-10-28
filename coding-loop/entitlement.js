'use strict';

/**
 * Client entitlement for orgs outside the tenant's static `orgs` list
 * (Decision [2026-10-22-0005]).
 *
 * A client repo is entitled only when BOTH hold:
 *   1. the conductor GitHub App is installed on the repo and not suspended
 *      (GET /repos/{owner}/{repo}/installation), and
 *   2. the installation's account ID has an `active` row in the client
 *      registry.
 * The App is public, so anyone can install it; the registry is the NewPush
 * side of the grant. Rows are keyed by the stable GitHub account ID, never
 * by login (logins can be renamed and re-registered).
 *
 * The registry is NOT committed (this repository is public and the client
 * list is confidential). It is injected at runtime as JSON in
 * NOEMI_CLIENT_REGISTRY, e.g. `infisical run --env=dev -- node coding-loop/run.js …`.
 *
 * Every lookup failure resolves to `{ error }` so intake refuses with
 * `entitlement-unverified` — never allow on an unknown state.
 */

const { githubAppJwt } = require('../scripts/github-app-token.js');

const CLIENT_STATUSES = new Set(['active', 'suspended']);

/** Parse NOEMI_CLIENT_REGISTRY. Malformed input throws; it never means "no clients". */
function parseClientRegistry(text) {
  if (text === undefined || text === null || String(text).trim() === '') {
    return { clients: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    // Never echo the parser message: it quotes the registry contents.
    throw new Error('NOEMI_CLIENT_REGISTRY is not valid JSON.');
  }
  if (!parsed || !Array.isArray(parsed.clients)) {
    throw new Error('NOEMI_CLIENT_REGISTRY must be an object with a clients array.');
  }
  for (const client of parsed.clients) {
    if (!client || !Number.isInteger(client.account_id) || client.account_id <= 0) {
      throw new Error('NOEMI_CLIENT_REGISTRY: every client needs an integer account_id.');
    }
    if (!CLIENT_STATUSES.has(client.status)) {
      throw new Error('NOEMI_CLIENT_REGISTRY: client status must be active or suspended.');
    }
    if (client.repos !== undefined && !Array.isArray(client.repos)) {
      throw new Error('NOEMI_CLIENT_REGISTRY: client repos must be an array when present.');
    }
  }
  return parsed;
}

function appHeaders(appId, privateKey) {
  return {
    Authorization: `Bearer ${githubAppJwt(appId, privateKey)}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'noemi-entitlement',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * The App installation that covers this repo, or null when the App is not
 * installed there (404). Other failures throw.
 */
async function findRepoInstallation({ repo, appId, privateKey, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/installation`, {
    headers: appHeaders(appId, privateKey),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`GitHub App repo installation → ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return {
    id: body && body.id,
    account_id: body && body.account ? body.account.id : undefined,
    suspended: Boolean(body && body.suspended_at),
  };
}

/**
 * Resolve the entitlement input for intake. Returns null for orgs on the
 * tenant's static list (they never need the registry).
 */
async function resolveEntitlement({ repo, tenant, env = process.env, fetchImpl = fetch } = {}) {
  const org = String(repo || '').split('/')[0];
  const orgs = (tenant && Array.isArray(tenant.orgs)) ? tenant.orgs : [];
  if (orgs.includes(org)) return null;

  let registry;
  try {
    registry = parseClientRegistry(env && env.NOEMI_CLIENT_REGISTRY);
  } catch (err) {
    return { error: err.message };
  }
  if (!env || !env.CONDUCTOR_APP_ID || !env.CONDUCTOR_APP_PRIVATE_KEY) {
    return { error: 'client entitlement needs CONDUCTOR_APP_ID and CONDUCTOR_APP_PRIVATE_KEY' };
  }
  let installation;
  try {
    installation = await findRepoInstallation({
      repo,
      appId: env.CONDUCTOR_APP_ID,
      privateKey: env.CONDUCTOR_APP_PRIVATE_KEY,
      fetchImpl,
    });
  } catch (err) {
    return { error: err.message };
  }
  const client = installation
    ? registry.clients.find((row) => row.account_id === installation.account_id) || null
    : null;
  return { installation, client };
}

/**
 * Who asked for this run and their permission on the repo. Intake refuses a
 * client run unless it is write or higher (the bar Copilot, Claude Code
 * Action and Devin use). Lookup failures resolve to { error }.
 */
async function resolveTrigger({ repo, login, token, ghImpl } = {}) {
  if (!login) return null;
  try {
    const res = await ghImpl(
      `/repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`,
      { token },
    );
    return { login, permission: (res && res.permission) || 'none' };
  } catch (err) {
    if (err && err.status === 404) return { login, permission: 'none' };
    return { login, error: err && err.message };
  }
}

module.exports = {
  findRepoInstallation,
  parseClientRegistry,
  resolveEntitlement,
  resolveTrigger,
};
