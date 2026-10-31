'use strict';

/**
 * Azure DevOps client entitlement (Decision [2026-10-22-0005], applied to a
 * forge without App installations).
 *
 * Own orgs come from the tenant file (`orgs: ["azure-devops:<org>"]`) and
 * need nothing here. A client onboards by adding our multi-tenant Entra
 * app's service principal to their organization; the operator adds a
 * NOEMI_CLIENT_REGISTRY row `{ provider: 'azure-devops', account_id: <org
 * GUID>, tenant_id: <client tenant GUID>, status }`. A client org is
 * entitled only when ALL of these hold:
 *   1. the org's backing Entra tenant (learned unauthenticated) is the
 *      tenant_id of some Azure DevOps row: we never mint a token for a
 *      tenant nobody registered;
 *   2. the conductor, minted in that tenant, can read connectionData (the
 *      service principal is a member of the org; 401/403 = not added);
 *   3. connectionData's instanceId (the org GUID, stable across renames) is
 *      that row's account_id.
 * Every other failure is `{ error }` → intake refuses entitlement-unverified.
 *
 * [unverified] Two inputs are not in Microsoft's REST reference and sit
 * behind seams: the `x-vss-resourcetenant` response header on an
 * unauthenticated request to the org URL, and the `_apis/connectionData`
 * endpoint (used by the Azure DevOps CLI and SDKs). If either changes shape,
 * the lookup fails and the run is refused; nothing is allowed by default.
 */

const { findClient, parseClientRegistry } = require('../../client-registry.js');
const { canonicalProviderId, ownerEntryMatches, providerError } = require('../contract.js');
const { headerOf, orgUrl } = require('./client.js');
const { isGuid } = require('./auth.js');

const ID = 'azure-devops';
const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

/** Owner on the tenant's static `orgs` list (`azure-devops:<org>` / `ado:<org>`). */
function tenantListsOwner(tenant, ref) {
  const orgs = (tenant && Array.isArray(tenant.orgs)) ? tenant.orgs : [];
  return orgs.some((entry) => ownerEntryMatches(entry, ref));
}

/**
 * The Entra tenant that backs an organization, from the
 * `x-vss-resourcetenant` header Azure DevOps returns even to an
 * unauthenticated request [unverified]. Tries the org URL (HEAD), then
 * connectionData (GET). No header, a malformed one, or the all-zero GUID (an
 * MSA-backed org, no Entra tenant) throws.
 */
async function discoverOrgTenant(org, env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const base = orgUrl(org, env);
  const probes = [['HEAD', base], ['GET', `${base}/_apis/connectionData`]];
  for (const [method, url] of probes) {
    let res;
    try {
      res = await fetchImpl(url, { method, redirect: 'manual', headers: { 'X-TFS-FedAuthRedirect': 'Suppress' } });
    } catch {
      continue;
    }
    const tenant = String(headerOf(res, 'x-vss-resourcetenant') || '').trim();
    if (isGuid(tenant) && tenant !== ZERO_GUID) return tenant.toLowerCase();
  }
  throw providerError(`could not learn the Entra tenant of Azure DevOps organization ${org}.`, 502, 'ado-org-tenant-unknown');
}

/**
 * GET {org}/_apis/connectionData as `cred` [unverified endpoint]. Returns
 * `{ userId, displayName, instanceId }`; any other shape throws 502 so the
 * caller fails closed.
 */
async function connectionData(request, org, cred, env = process.env) {
  const data = await request(`${orgUrl(org, env)}/_apis/connectionData`, { cred });
  const user = data && data.authenticatedUser;
  const userId = user && typeof user.id === 'string' ? user.id.toLowerCase() : '';
  const instanceId = data && typeof data.instanceId === 'string' ? data.instanceId.toLowerCase() : '';
  if (!isGuid(userId) || userId === ZERO_GUID) {
    throw providerError('Azure DevOps connectionData named no authenticated identity.', 502, 'ado-connection-data');
  }
  return {
    userId,
    displayName: String((user && (user.providerDisplayName || user.customDisplayName)) || ''),
    instanceId: isGuid(instanceId) ? instanceId : '',
  };
}

/**
 * @returns null (tenant org) | { grant, client } | { error }
 *   grant: { accountId, tenantId, suspended: false } when the conductor can
 *   read the org; null when it cannot (service principal not added →
 *   intake's `app-not-installed`). An org whose tenant no row names gets a
 *   grant with accountId null and client null (`unregistered-client`)
 *   WITHOUT any token being minted.
 */
async function resolveAdoEntitlement({
  ref, tenant, env = process.env, orgTenant, resolveCredential, request,
} = {}) {
  if (tenantListsOwner(tenant, ref)) return null;

  let registry;
  try {
    registry = parseClientRegistry(env && env.NOEMI_CLIENT_REGISTRY);
  } catch (err) {
    return { error: err.message };
  }
  let tenantId;
  try {
    tenantId = String(await orgTenant(ref.owner, env)).toLowerCase();
  } catch (err) {
    return { error: (err && err.message) || 'organization tenant lookup failed' };
  }
  const rows = registry.clients.filter((row) => canonicalProviderId(row.provider || 'github') === ID
    && String(row.tenant_id || '').toLowerCase() === tenantId);
  if (rows.length === 0) {
    return { grant: { accountId: null, tenantId, suspended: false }, client: null };
  }

  let cred;
  try {
    cred = await resolveCredential({
      role: 'conductor', ref, env, deps: { tenantId },
    });
  } catch (err) {
    return { error: (err && err.message) || 'conductor credential failed' };
  }
  if (!cred) {
    return { error: 'Azure DevOps client entitlement needs a conductor credential (ADO_CONDUCTOR_CLIENT_ID with a secret or federated token).' };
  }
  let data;
  try {
    data = await connectionData(request, ref.owner, cred, env);
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) return { grant: null, client: null };
    return { error: (err && err.message) || 'connectionData failed' };
  }
  if (!data.instanceId) return { error: 'Azure DevOps connectionData named no organization id.' };
  const match = findClient({ clients: rows }, { provider: ID, accountId: data.instanceId });
  return {
    grant: { accountId: data.instanceId, tenantId, suspended: false },
    client: match || null,
  };
}

module.exports = {
  ZERO_GUID,
  connectionData,
  discoverOrgTenant,
  resolveAdoEntitlement,
  tenantListsOwner,
};
