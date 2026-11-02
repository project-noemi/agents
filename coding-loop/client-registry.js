'use strict';

/**
 * NOEMI_CLIENT_REGISTRY parsing (Decision [2026-10-22-0005]), shared by
 * every forge provider. Shape: docs/client-registry.schema.json.
 *
 * A row belongs to one forge (`provider`, default `github` so every
 * registry written before providers existed keeps its meaning). The grant
 * key is the forge's stable account ID: a positive integer on GitHub, a
 * non-empty string elsewhere. Azure DevOps rows are stricter: account_id is
 * the organization GUID and tenant_id the client's Entra tenant GUID, and
 * requester_group optionally names the group whose members may trigger a
 * run. The key is never a login or display name, which can be renamed and
 * re-registered.
 */

const { PROVIDER_ID_RE, canonicalProviderId } = require('./providers/contract.js');

const CLIENT_STATUSES = new Set(['active', 'suspended']);
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!client || typeof client !== 'object') {
      throw new Error('NOEMI_CLIENT_REGISTRY: every client needs an integer account_id.');
    }
    if (client.provider !== undefined
      && (typeof client.provider !== 'string' || !PROVIDER_ID_RE.test(canonicalProviderId(client.provider)))) {
      throw new Error('NOEMI_CLIENT_REGISTRY: client provider must be a provider id such as github or azure-devops.');
    }
    const provider = canonicalProviderId(client.provider || 'github');
    if (provider === 'azure-devops') {
      // The org GUID (connectionData instanceId) is the grant key, and the
      // client's Entra tenant is what the conductor mints a token for. A row
      // without the tenant could never be checked, so it is refused here
      // rather than at run time.
      if (typeof client.account_id !== 'string' || !GUID_RE.test(client.account_id)) {
        throw new Error('NOEMI_CLIENT_REGISTRY: an azure-devops client needs account_id = the organization GUID.');
      }
      if (typeof client.tenant_id !== 'string' || !GUID_RE.test(client.tenant_id)) {
        throw new Error('NOEMI_CLIENT_REGISTRY: an azure-devops client needs tenant_id = the client\'s Entra tenant GUID.');
      }
      if (client.requester_group !== undefined
        && (typeof client.requester_group !== 'string' || client.requester_group.trim() === '')) {
        throw new Error('NOEMI_CLIENT_REGISTRY: requester_group must be a non-empty group name when present.');
      }
    } else if (provider === 'github') {
      if (!Number.isInteger(client.account_id) || client.account_id <= 0) {
        throw new Error('NOEMI_CLIENT_REGISTRY: every client needs an integer account_id.');
      }
    } else {
      const ok = (Number.isInteger(client.account_id) && client.account_id > 0)
        || (typeof client.account_id === 'string' && client.account_id.trim() !== '');
      if (!ok) {
        throw new Error('NOEMI_CLIENT_REGISTRY: every client needs an account_id (the forge account or organization ID).');
      }
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

/**
 * The registry row for this forge account, or null. String IDs (GUIDs)
 * compare case-insensitively; integer IDs compare exactly. A row for another
 * forge never matches, even when the numbers collide.
 */
function findClient(registry, { provider, accountId }) {
  if (accountId === undefined || accountId === null) return null;
  const want = canonicalProviderId(provider);
  const clients = (registry && Array.isArray(registry.clients)) ? registry.clients : [];
  return clients.find((row) => {
    if (canonicalProviderId(row.provider || 'github') !== want) return false;
    if (typeof row.account_id === 'string' && typeof accountId === 'string') {
      return row.account_id.toLowerCase() === accountId.toLowerCase();
    }
    return row.account_id === accountId;
  }) || null;
}

module.exports = {
  CLIENT_STATUSES,
  findClient,
  parseClientRegistry,
};
