'use strict';

/**
 * Client entitlement and requester checks (Decision [2026-10-22-0005]).
 *
 * The forge-specific halves moved behind the provider seam:
 *   - GitHub App installation lookup → providers/github/entitlement.js
 *   - registry parsing (all forges)   → coding-loop/client-registry.js
 * This module keeps the exported names hosts and the labs import. Each
 * wrapper takes `repo` as `owner/name` (GitHub, as before) or a RepoRef
 * plus a provider.
 *
 * Every lookup failure resolves to `{ error }` so intake refuses with
 * `entitlement-unverified` — never allow on an unknown state.
 */

const { githubApiBase } = require('../scripts/github-client.js');
const { parseClientRegistry } = require('./client-registry.js');
const { createGithubProvider, findRepoInstallation } = require('./providers/github/index.js');
const { parseRepoRef } = require('./providers/index.js');

function refOf(repo, ref, env) {
  if (ref) return ref;
  try {
    return parseRepoRef(repo, { env });
  } catch {
    return null;
  }
}

/**
 * Resolve the entitlement input for intake. Returns null for owners on the
 * tenant's static list (they never need the registry); otherwise
 * `{ grant, client }` or `{ error }`. GitHub results also carry the old
 * `installation` field (`{ id, account_id, suspended }`) for hosts that
 * read it.
 */
async function resolveEntitlement({
  repo, ref, provider, tenant, env = process.env, fetchImpl = globalThis.fetch, apiBase = githubApiBase(env),
} = {}) {
  const target = refOf(repo, ref, env);
  if (!target) return { error: 'entitlement needs a valid repository reference' };
  const forge = provider || createGithubProvider({ fetchImpl });
  const result = await forge.resolveEntitlement({
    ref: target, tenant, env, deps: { fetchImpl, apiBase },
  });
  if (result && target.provider === 'github' && !result.error && result.installation === undefined) {
    const { grant } = result;
    return {
      ...result,
      installation: grant ? { id: grant.id, account_id: grant.accountId, suspended: grant.suspended } : null,
    };
  }
  return result;
}

/**
 * Who asked for this run and their permission on the repo. Intake refuses
 * EVERY run (tenant and client) unless it is write or higher (the bar
 * Copilot, Claude Code Action and Devin use): on a public tenant repo an
 * outsider opening an issue must not spend the pool or draw a conductor
 * comment. No login resolves to null, which intake refuses as
 * `trigger-unverified`. Lookup failures resolve to { error }.
 */
async function resolveTrigger({
  repo, ref, provider, login, token, cred, ghImpl,
} = {}) {
  if (!login) return null;
  const target = refOf(repo, ref);
  if (!target) return { login, error: 'requester check needs a valid repository reference' };
  const forge = provider || createGithubProvider({ gh: ghImpl });
  return forge.requesterPermission(target, login, cred || token);
}

module.exports = {
  findRepoInstallation,
  parseClientRegistry,
  resolveEntitlement,
  resolveTrigger,
};
