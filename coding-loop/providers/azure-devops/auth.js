'use strict';

/**
 * Azure DevOps credentials for the coding loop.
 *
 * Global PATs stop working on 2026-12-01 and org PATs are a person's
 * credential, so the loop's identities are Microsoft Entra service
 * principals: one for the conductor (reads, comments, tags), a DIFFERENT one
 * for the producer (branch, push, pull request). Per role, first match wins:
 *
 *   <P>_TOKEN                     a pre-minted Entra access token (a pipeline's
 *                                 workload identity: `az account get-access-token
 *                                 --resource 499b84ac-1321-427f-aa17-267ca6975798`)
 *   <P>_CLIENT_ID + tenant + one of
 *     <P>_CLIENT_SECRET           client-credentials grant
 *     <P>_FEDERATED_TOKEN_FILE    client-assertion grant (workload identity file)
 *   <P>_PAT                       organization-scoped PAT, Basic auth. Dev only;
 *                                 the credential carries a `risk` note.
 *
 * P is ADO_CONDUCTOR or ADO_AGENT. The reader is the conductor, else
 * ADO_READ_TOKEN / ADO_READ_PAT. A half-configured service principal (a
 * client id without a secret or token file) is an error, never a silent
 * fall-through to a PAT.
 *
 * Tenant for a client-credentials mint: `<P>_TENANT_ID` (the home tenant),
 * unless the org is backed by another tenant that NOEMI_CLIENT_REGISTRY
 * lists for an Azure DevOps row (a client org that added our multi-tenant
 * app). The org's tenant is learned through the `orgTenant` seam
 * (entitlement.js). A tenant nobody registered is never minted for.
 */

const fs = require('fs');
const { parseClientRegistry } = require('../../client-registry.js');
const { canonicalProviderId, providerError } = require('../contract.js');

const ID = 'azure-devops';
/** Azure DevOps resource (application) id; `.default` = the identity's own grants. */
const ADO_RESOURCE_ID = '499b84ac-1321-427f-aa17-267ca6975798';
const ADO_SCOPE = `${ADO_RESOURCE_ID}/.default`;
const ENTRA_AUTHORITY = 'https://login.microsoftonline.com';
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)$/i;
/** Re-mint this long before expiry. */
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

const ROLE_PREFIX = Object.freeze({ conductor: 'ADO_CONDUCTOR', producer: 'ADO_AGENT' });

function isGuid(value) {
  return typeof value === 'string' && GUID_RE.test(value);
}

/**
 * Opaque credential. `token` is NOT enumerable, so JSON.stringify,
 * util.inspect and `{ ...cred }` never carry it. `identity` (a client id or
 * a token's object id) and `identities` (every id the credential is known
 * by: the configured client id plus the token's oid / appid / azp claims)
 * are not secret and let the identity split compare service principals.
 */
function adoCredential(token, {
  role, source, scheme = 'bearer', identity = null, identities = [], tenantId = null, risk = null,
}) {
  if (typeof token !== 'string' || token === '') return null;
  const ids = [...new Set([identity, ...identities].filter(Boolean).map((id) => String(id).toLowerCase()))];
  const cred = {
    provider: ID,
    role,
    source,
    scheme,
    identity: ids[0] || null,
    identities: Object.freeze(ids),
    tenantId,
  };
  if (risk) cred.risk = risk;
  Object.defineProperty(cred, 'token', { value: token, enumerable: false });
  return Object.freeze(cred);
}

/**
 * Every identity claim of a JWT (`oid`: the service principal object id;
 * `appid` / `azp`: the application (client) id), lowercase, decoded WITHOUT
 * verification. Used only to compare credentials for the identity split;
 * never to grant anything. One service principal reached two ways (a
 * pre-minted token on one side, a client id on the other) shares the appid,
 * so both claims are compared, not just the first one present.
 */
function jwtIdentities(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return [];
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object') return [];
    return [...new Set(['oid', 'appid', 'azp']
      .map((claim) => claims[claim])
      .filter((id) => typeof id === 'string' && id)
      .map((id) => id.toLowerCase()))];
  } catch {
    return [];
  }
}

/** The `oid` (else `appid`, else `azp`) claim of a JWT; see jwtIdentities. */
function jwtIdentity(token) {
  return jwtIdentities(token)[0] || null;
}

/**
 * Default Entra mint: client-credentials (secret) or client-assertion
 * (federated token). The error names the client id and the AADSTS code
 * only; the response body can echo request details and is never included.
 */
async function mintEntraToken({
  tenantId, clientId, clientSecret, clientAssertion, fetchImpl = globalThis.fetch,
} = {}) {
  if (!TENANT_RE.test(String(tenantId || ''))) {
    throw providerError('Entra mint needs a tenant id (GUID) or a verified domain.', 400, 'ado-bad-tenant');
  }
  if (!isGuid(clientId)) throw providerError('Entra mint needs a client id (GUID).', 400, 'ado-bad-client-id');
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    scope: ADO_SCOPE,
  });
  if (clientAssertion) {
    form.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    form.set('client_assertion', clientAssertion);
  } else if (clientSecret) {
    form.set('client_secret', clientSecret);
  } else {
    throw providerError('Entra mint needs a client secret or a federated token.', 400, 'ado-no-client-secret');
  }
  const res = await fetchImpl(`${ENTRA_AUTHORITY}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok || !payload || typeof payload.access_token !== 'string') {
    const codes = payload && Array.isArray(payload.error_codes) ? ` AADSTS${payload.error_codes[0]}` : '';
    const kind = payload && typeof payload.error === 'string' ? ` ${payload.error.replace(/[^a-z_]/gi, '')}` : '';
    throw providerError(
      `Entra token request for client ${clientId} in tenant ${tenantId} failed (${res.status}${kind}${codes}).`,
      res.status === 400 || res.status === 401 ? 401 : 502,
      'ado-entra-mint-failed',
    );
  }
  return {
    token: payload.access_token,
    expiresInMs: Number.isFinite(Number(payload.expires_in)) ? Number(payload.expires_in) * 1000 : 3600 * 1000,
  };
}

/** Tenant ids of Azure DevOps rows in NOEMI_CLIENT_REGISTRY (lowercase). A malformed registry lists none. */
function registeredTenants(env) {
  try {
    const registry = parseClientRegistry(env && env.NOEMI_CLIENT_REGISTRY);
    return new Set(registry.clients
      .filter((row) => canonicalProviderId(row.provider || 'github') === ID)
      .map((row) => String(row.tenant_id || '').toLowerCase())
      .filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * @param {object} seams
 * @param {Function} seams.mintEntraToken  ({ tenantId, clientId, clientSecret, clientAssertion }) → { token, expiresInMs } | string
 * @param {Function} seams.orgTenant       (org, env) → tenant GUID | null (entitlement.js)
 * @param {Function} [seams.readTokenFile] (path) → string
 * @param {Function} [seams.now]
 */
function createCredentialResolver({
  mintEntraToken: mint = mintEntraToken, orgTenant, readTokenFile, now = Date.now,
} = {}) {
  const cache = new Map();
  const readFile = readTokenFile || ((file) => fs.readFileSync(file, 'utf8'));

  async function mintCached({
    tenantId, clientId, clientSecret, tokenFile, source,
  }) {
    const key = `${String(tenantId).toLowerCase()}|${clientId.toLowerCase()}|${source}`;
    const hit = cache.get(key);
    if (hit && hit.expiresAt - EXPIRY_SKEW_MS > now()) return hit.token;
    let clientAssertion;
    if (tokenFile) {
      try {
        clientAssertion = String(readFile(tokenFile)).trim();
      } catch (err) {
        throw providerError(`cannot read the federated token file (${(err && err.code) || 'read error'}).`, 400, 'ado-federated-token-unreadable');
      }
      if (!clientAssertion) throw providerError('the federated token file is empty.', 400, 'ado-federated-token-unreadable');
    }
    const minted = await mint({
      tenantId, clientId, clientSecret, clientAssertion,
    });
    const token = typeof minted === 'string' ? minted : minted && minted.token;
    if (typeof token !== 'string' || token === '') {
      throw providerError(`Entra returned no token for client ${clientId}.`, 502, 'ado-entra-mint-failed');
    }
    const ttl = minted && Number.isFinite(minted.expiresInMs) ? minted.expiresInMs : 3600 * 1000;
    cache.set(key, { token, expiresAt: now() + ttl });
    return token;
  }

  /**
   * The tenant to mint in. `hint` (from resolveEntitlement, which already
   * matched a registry row) wins; otherwise the org's own tenant when the
   * registry lists it; otherwise the configured home tenant.
   */
  async function tenantFor(ref, env, prefix, hint) {
    if (hint) return hint;
    const home = env[`${prefix}_TENANT_ID`] ? String(env[`${prefix}_TENANT_ID`]).trim() : '';
    let discovered = null;
    if (typeof orgTenant === 'function' && ref && ref.owner) {
      try {
        discovered = await orgTenant(ref.owner, env);
      } catch {
        discovered = null;
      }
    }
    if (discovered) {
      const lower = String(discovered).toLowerCase();
      if (home && home.toLowerCase() === lower) return home;
      if (registeredTenants(env).has(lower)) return lower;
    }
    if (home) return home;
    throw providerError(
      `${prefix}_CLIENT_ID is set but no tenant is: set ${prefix}_TENANT_ID, or register the organization's tenant in NOEMI_CLIENT_REGISTRY.`,
      400,
      'ado-tenant-unset',
    );
  }

  /** One role's credential from its env prefix, or null when nothing is configured. */
  async function fromPrefix(prefix, role, { ref, env, tenantHint }) {
    if (env[`${prefix}_TOKEN`]) {
      const token = String(env[`${prefix}_TOKEN`]);
      return adoCredential(token, {
        role, source: `${prefix}_TOKEN`, identities: jwtIdentities(token),
      });
    }
    const clientId = env[`${prefix}_CLIENT_ID`] ? String(env[`${prefix}_CLIENT_ID`]).trim() : '';
    if (clientId) {
      const clientSecret = env[`${prefix}_CLIENT_SECRET`] ? String(env[`${prefix}_CLIENT_SECRET`]) : '';
      const tokenFile = env[`${prefix}_FEDERATED_TOKEN_FILE`] ? String(env[`${prefix}_FEDERATED_TOKEN_FILE`]) : '';
      if (!clientSecret && !tokenFile) {
        throw providerError(
          `${prefix}_CLIENT_ID needs ${prefix}_CLIENT_SECRET or ${prefix}_FEDERATED_TOKEN_FILE.`,
          400,
          'ado-no-client-secret',
        );
      }
      if (!isGuid(clientId)) throw providerError(`${prefix}_CLIENT_ID must be a GUID.`, 400, 'ado-bad-client-id');
      const tenantId = await tenantFor(ref, env, prefix, tenantHint);
      const source = tokenFile ? `${prefix}_FEDERATED_TOKEN_FILE` : `${prefix}_CLIENT_SECRET`;
      const token = await mintCached({
        tenantId, clientId, clientSecret: tokenFile ? '' : clientSecret, tokenFile, source,
      });
      return adoCredential(token, {
        role, source, identity: clientId, identities: jwtIdentities(token), tenantId,
      });
    }
    if (env[`${prefix}_PAT`]) {
      return adoCredential(String(env[`${prefix}_PAT`]), {
        role,
        source: `${prefix}_PAT`,
        scheme: 'basic',
        risk: 'personal access token: a person\'s credential, for local development only; use an Entra service principal in pipelines',
      });
    }
    return null;
  }

  /**
   * Identity split (docs/MACHINE_IDENTITY.md). The producer is refused when
   * any of its secrets IS a conductor secret, or when the two sides share
   * ANY identity id. Each side contributes its configured client id and the
   * oid, appid and azp claims of its token (pre-minted, or for the producer
   * the one just minted): the same service principal behind a pre-minted
   * token on one side and a client id on the other shares the appid. The
   * conductor's own mint is not repeated here; dispatch compares the two
   * live identities (whoAmI) before the first producer write.
   */
  function assertNotConductor(env, producer) {
    const P = ROLE_PREFIX.producer;
    const C = ROLE_PREFIX.conductor;
    const conductorSecrets = [env[`${C}_TOKEN`], env[`${C}_PAT`], env[`${C}_CLIENT_SECRET`]].filter(Boolean).map(String);
    const producerSecrets = [env[`${P}_TOKEN`], env[`${P}_PAT`], env[`${P}_CLIENT_SECRET`]].filter(Boolean).map(String);
    const clientIdOf = (prefix) => (env[`${prefix}_CLIENT_ID`] ? String(env[`${prefix}_CLIENT_ID`]).trim().toLowerCase() : null);
    const conductorIds = new Set([clientIdOf(C), ...jwtIdentities(env[`${C}_TOKEN`])].filter(Boolean));
    const producerIds = new Set([
      clientIdOf(P),
      ...jwtIdentities(env[`${P}_TOKEN`]),
      ...((producer && producer.identities) || []),
      producer && producer.identity,
    ].filter(Boolean));
    const sameSecret = producerSecrets.some((secret) => conductorSecrets.includes(secret))
      || (producer && conductorSecrets.includes(producer.token));
    const sameIdentity = [...producerIds].some((id) => conductorIds.has(id));
    if (sameSecret || sameIdentity) {
      throw providerError(
        'Stage C refuses the conductor credential as the producer (identity split). Configure ADO_AGENT_* for the noemi-agent service principal.',
        400,
        'producer-is-conductor',
      );
    }
  }

  async function resolveCredential({
    role, ref, env = process.env, deps = {},
  } = {}) {
    const source = env || {};
    const tenantHint = deps && deps.tenantId ? String(deps.tenantId) : null;
    if (role === 'conductor') {
      return fromPrefix(ROLE_PREFIX.conductor, 'conductor', { ref, env: source, tenantHint });
    }
    if (role === 'producer') {
      // dispatch compares whoAmI with this id before any write; without it
      // there is nothing to compare against, so no producer exists.
      if (!isGuid(String(source.ADO_AGENT_EXPECTED_ID || ''))) {
        throw providerError(
          'Azure DevOps producer writes need ADO_AGENT_EXPECTED_ID (the noemi-agent service principal\'s identity id, a GUID).',
          400,
          'producer-identity-unset',
        );
      }
      const producer = await fromPrefix(ROLE_PREFIX.producer, 'producer', { ref, env: source, tenantHint });
      if (!producer) {
        throw providerError(
          'Azure DevOps Stage C needs ADO_AGENT_TOKEN, ADO_AGENT_CLIENT_ID with a secret or federated token file, or ADO_AGENT_PAT.',
          400,
          'producer-missing',
        );
      }
      assertNotConductor(source, producer);
      return producer;
    }
    if (role === 'reader') {
      const viaConductor = await fromPrefix(ROLE_PREFIX.conductor, 'conductor', { ref, env: source, tenantHint });
      if (viaConductor) return viaConductor;
      if (source.ADO_READ_TOKEN) return adoCredential(String(source.ADO_READ_TOKEN), { role: 'reader', source: 'ADO_READ_TOKEN' });
      if (source.ADO_READ_PAT) {
        return adoCredential(String(source.ADO_READ_PAT), {
          role: 'reader', source: 'ADO_READ_PAT', scheme: 'basic', risk: 'personal access token: local development only',
        });
      }
      return null;
    }
    throw providerError(`unknown credential role: ${role}`, 400, 'bad-role');
  }

  return { resolveCredential, cache };
}

module.exports = {
  ADO_RESOURCE_ID,
  ADO_SCOPE,
  ENTRA_AUTHORITY,
  GUID_RE,
  adoCredential,
  createCredentialResolver,
  isGuid,
  jwtIdentities,
  jwtIdentity,
  mintEntraToken,
  registeredTenants,
};
