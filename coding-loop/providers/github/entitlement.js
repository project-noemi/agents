'use strict';

/**
 * GitHub client entitlement (Decision [2026-10-22-0005]), moved here from
 * coding-loop/entitlement.js, which re-exports it.
 *
 * A client repo is entitled only when BOTH hold:
 *   1. the conductor GitHub App is installed on the repo and not suspended
 *      (GET /repos/{owner}/{repo}/installation), and
 *   2. the installation's account ID has an `active` github row in
 *      NOEMI_CLIENT_REGISTRY.
 * The App is public, so anyone can install it; the registry is the operator
 * side of the grant. Every lookup failure resolves to `{ error }` so intake
 * refuses `entitlement-unverified` — never allow on an unknown state.
 */

const { githubAppJwt } = require('../../../scripts/github-app-token.js');
const { githubApiBase } = require('../../../scripts/github-client.js');
const { findClient, parseClientRegistry } = require('../../client-registry.js');
const { ownerEntryMatches } = require('../contract.js');

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
 * installed there (404). Other failures throw. `repo` is `owner/name`.
 */
async function findRepoInstallation({
  repo, appId, privateKey, fetchImpl = fetch, apiBase = githubApiBase(process.env),
} = {}) {
  const res = await fetchImpl(`${apiBase}/repos/${repo}/installation`, {
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

/** Owner on the tenant's static `orgs` list (bare or `github:` entries). */
function tenantListsOwner(tenant, ref) {
  const orgs = (tenant && Array.isArray(tenant.orgs)) ? tenant.orgs : [];
  return orgs.some((entry) => ownerEntryMatches(entry, ref));
}

/**
 * null for an owner on the tenant's static list (no registry needed);
 * otherwise `{ grant, client }` or `{ error }`. `grant` is the normalized
 * installation: `{ id, accountId, suspended }`, or null when not installed.
 */
async function resolveGithubEntitlement({
  ref, tenant, env = process.env, fetchImpl = fetch, apiBase = githubApiBase(env),
} = {}) {
  if (tenantListsOwner(tenant, ref)) return null;

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
      repo: ref.slug,
      appId: env.CONDUCTOR_APP_ID,
      privateKey: env.CONDUCTOR_APP_PRIVATE_KEY,
      fetchImpl,
      apiBase,
    });
  } catch (err) {
    return { error: err.message };
  }
  const grant = installation
    ? { id: installation.id, accountId: installation.account_id, suspended: installation.suspended }
    : null;
  const client = grant ? findClient(registry, { provider: 'github', accountId: grant.accountId }) : null;
  return { grant, client };
}

module.exports = {
  findRepoInstallation,
  resolveGithubEntitlement,
  tenantListsOwner,
};
