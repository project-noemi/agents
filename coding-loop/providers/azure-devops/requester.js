'use strict';

/**
 * Who may trigger a run on Azure DevOps (Decision [2026-10-27-0001] on a
 * forge whose permissions are ACLs, not a role per repository).
 *
 * Azure DevOps has no "permission of user X on repo Y" call a least-
 * privileged identity can make: the Permissions Report API needs
 * vso.security_manage, the ACL query misses rights inherited from groups,
 * and permissionevaluationbatch checks only the CALLER. So the bar is group
 * membership: the requester is entitled iff they are a member of the
 * configured requester group in the item's project (ADO_REQUESTER_GROUP, or
 * the client row's `requester_group`). Member → 'write'; not a member →
 * 'none'; no group configured or any lookup failure → { error } (intake
 * refuses trigger-unverified).
 *
 * Membership check, in order:
 *   1. Identities API with queryMembership=Expanded: transitive, so a
 *      member of a nested group counts [unverified: that memberOf is
 *      transitive and lists identity descriptors].
 *   2. Fallback when (1) fails: Graph memberships/{subject}/{group}. This is
 *      DIRECT membership only; a nested member is then 'none' (denied, never
 *      wrongly allowed).
 */

const { providerError } = require('../contract.js');
const { orgUrl, vsspsUrl } = require('./client.js');
const { isGuid } = require('./auth.js');

const API = '7.1';
const GRAPH_API = '7.1-preview.1';
const MAX_GROUP_PAGES = 20;

/** Identity descriptor (string or `{ identityType, identifier }`) → comparable lowercase string. */
function descriptorKey(descriptor) {
  if (!descriptor) return '';
  if (typeof descriptor === 'string') return descriptor.toLowerCase();
  if (typeof descriptor === 'object' && descriptor.identityType && descriptor.identifier) {
    return `${descriptor.identityType};${descriptor.identifier}`.toLowerCase();
  }
  return '';
}

/** The requester group's name for this run, or null. A client row's group wins. */
function requesterGroupName(env, entitlement) {
  const fromClient = entitlement && entitlement.client && entitlement.client.requester_group;
  if (typeof fromClient === 'string' && fromClient.trim()) return fromClient.trim();
  const fromEnv = env && env.ADO_REQUESTER_GROUP;
  return typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : null;
}

/** Graph group in the project scope whose display name (or `[Project]\Name` principal name) matches. */
async function findProjectGroup(request, ref, cred, env, groupName) {
  const project = await request(`${orgUrl(ref.owner, env)}/_apis/projects/${encodeURIComponent(ref.project)}?api-version=${API}`, { cred });
  if (!project || !isGuid(String(project.id || ''))) throw providerError('project lookup returned no id', 502, 'ado-project-id');
  const vssps = vsspsUrl(ref.owner, env);
  const scope = await request(`${vssps}/_apis/graph/descriptors/${encodeURIComponent(project.id)}?api-version=${GRAPH_API}`, { cred });
  const scopeDescriptor = scope && typeof scope.value === 'string' ? scope.value : '';
  if (!scopeDescriptor) throw providerError('project scope descriptor lookup failed', 502, 'ado-scope-descriptor');

  const wanted = groupName.toLowerCase();
  const principal = `[${ref.project}]\\${groupName}`.toLowerCase();
  const matches = [];
  let continuation = '';
  for (let page = 0; page < MAX_GROUP_PAGES; page += 1) {
    const query = `scopeDescriptor=${encodeURIComponent(scopeDescriptor)}&api-version=${GRAPH_API}`
      + (continuation ? `&continuationToken=${encodeURIComponent(continuation)}` : '');
    const { data, headers } = await request(`${vssps}/_apis/graph/groups?${query}`, { cred, includeHeaders: true });
    for (const group of (data && Array.isArray(data.value) ? data.value : [])) {
      const name = String((group && group.displayName) || '').toLowerCase();
      const principalName = String((group && group.principalName) || '').toLowerCase();
      if (name === wanted || principalName === principal) matches.push(group);
    }
    const next = headers && typeof headers.get === 'function' ? headers.get('x-ms-continuationtoken') : null;
    if (!next) break;
    if (page === MAX_GROUP_PAGES - 1) throw providerError('too many group pages', 502, 'ado-group-pages');
    continuation = next;
  }
  if (matches.length === 0) throw providerError(`requester group "${groupName}" not found in project ${ref.project}`, 404, 'requester-group-not-found');
  if (matches.length > 1) throw providerError(`requester group "${groupName}" is ambiguous in project ${ref.project}`, 409, 'requester-group-ambiguous');
  if (!matches[0].descriptor) throw providerError('requester group has no descriptor', 502, 'ado-group-descriptor');
  return matches[0];
}

/** Transitive membership via the Identities API. true / false, or throws. */
async function memberViaIdentities(request, ref, cred, env, group, identityId) {
  const vssps = vsspsUrl(ref.owner, env);
  const groupIdentity = await request(
    `${vssps}/_apis/identities?subjectDescriptors=${encodeURIComponent(group.descriptor)}&queryMembership=None&api-version=${API}`,
    { cred },
  );
  const groupRow = groupIdentity && Array.isArray(groupIdentity.value) ? groupIdentity.value[0] : null;
  const groupKey = descriptorKey(groupRow && groupRow.descriptor);
  if (!groupKey) throw providerError('requester group identity lookup failed', 502, 'ado-group-identity');
  const requester = await request(
    `${vssps}/_apis/identities?identityIds=${encodeURIComponent(identityId)}&queryMembership=Expanded&api-version=${API}`,
    { cred },
  );
  const row = requester && Array.isArray(requester.value) ? requester.value[0] : null;
  if (!row) return false;
  if (!Array.isArray(row.memberOf)) throw providerError('identity lookup returned no membership', 502, 'ado-identity-membership');
  return row.memberOf.some((entry) => descriptorKey(entry) === groupKey);
}

/** DIRECT membership via Graph. true / false, or throws. */
async function memberViaGraph(request, ref, cred, env, group, identityId) {
  const vssps = vsspsUrl(ref.owner, env);
  let subject;
  try {
    subject = await request(`${vssps}/_apis/graph/descriptors/${encodeURIComponent(identityId)}?api-version=${GRAPH_API}`, { cred });
  } catch (err) {
    if (err && err.status === 404) return false;
    throw err;
  }
  const subjectDescriptor = subject && typeof subject.value === 'string' ? subject.value : '';
  if (!subjectDescriptor) return false;
  try {
    await request(
      `${vssps}/_apis/graph/memberships/${encodeURIComponent(subjectDescriptor)}/${encodeURIComponent(group.descriptor)}?api-version=${GRAPH_API}`,
      { cred },
    );
    return true;
  } catch (err) {
    if (err && err.status === 404) return false;
    throw err;
  }
}

/**
 * @returns {{ login, permission: 'write'|'none', via }} | {{ login, error }}
 *   `login` is the requester's identity id (GUID), the id the work item's
 *   System.CreatedBy and connectionData report.
 */
async function adoRequesterPermission({
  request, ref, login, cred, env = process.env, entitlement,
} = {}) {
  if (!login) return null;
  if (!isGuid(String(login))) {
    return { login, error: 'an Azure DevOps requester is an identity id (GUID).' };
  }
  const identityId = String(login).toLowerCase();
  const groupName = requesterGroupName(env, entitlement);
  if (!groupName) return { login, error: 'requester-group-unset' };
  let group;
  try {
    group = await findProjectGroup(request, ref, cred, env, groupName);
  } catch (err) {
    return { login, error: (err && err.message) || 'requester group lookup failed' };
  }
  try {
    const member = await memberViaIdentities(request, ref, cred, env, group, identityId);
    return { login, permission: member ? 'write' : 'none', via: 'identities' };
  } catch {
    // Fall through: the Graph check is narrower (direct only) and can only
    // deny a nested member, never allow a non-member.
  }
  try {
    const member = await memberViaGraph(request, ref, cred, env, group, identityId);
    return { login, permission: member ? 'write' : 'none', via: 'graph' };
  } catch (err) {
    return { login, error: (err && err.message) || 'requester membership lookup failed' };
  }
}

module.exports = {
  adoRequesterPermission,
  descriptorKey,
  requesterGroupName,
};
