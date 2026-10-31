'use strict';

/**
 * In-memory Azure DevOps fake at the fetch() level, so the provider runs
 * through its real client (retry, throttle and error rules included). It
 * covers only the endpoints the coding-loop provider calls: one org with one
 * project and one repository, work items, comments, tags, refs, items,
 * trees, commits, pushes, pull requests, Graph and Identities, work item
 * update history, build definitions, the Entra token endpoint and the org's
 * tenant header.
 *
 * Git objects use real git blob ids (sha1 "blob <n>\0<content>"), so the
 * provider's resume check compares the same values the real service would.
 * Behaviour that Microsoft does not document (the tenant header, the push
 * conflict code, auto-complete by default) is modelled as the provider
 * assumes it, with switches to make each assumption fail.
 */

const crypto = require('crypto');

const ZERO_SHA = '0000000000000000000000000000000000000000';
const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

function guid(seed) {
  const hex = crypto.createHash('sha1').update(String(seed)).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function blobSha(content) {
  const bytes = Buffer.from(String(content), 'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function objectSha(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function respond(status, body, headers = {}) {
  if (status === 204 || body === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body === undefined ? {} : body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function createFakeAzureDevOps({
  org = 'contoso', project = 'Web', repo = 'api', tenantId = guid('tenant-home'), orgId = guid('org-contoso'),
} = {}) {
  const projectId = guid(`project-${project}`);
  const repoId = guid(`repo-${repo}`);
  const pipelines = []; // build definitions' process.yamlFilename
  const identities = new Map(); // token → identity
  const servicePrincipals = new Map(); // clientId → { secret, assertion, identity, tenants }
  const workItems = new Map();
  const comments = [];
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const refs = new Map();
  const pulls = [];
  const groups = [];
  const failures = new Map();
  const attempts = new Map();
  const requests = [];
  const pending = { hints: [], limits: [] };
  const flags = {
    tenantHeader: true,
    autoCompleteByDefault: false,
    clearFails: false,
    identitiesDown: false,
    updatesDown: false,
    definitionsDown: false,
    updatesPageCap: 200,
    tagConflicts: 0,
    groupPageSize: 50,
  };
  let mintCount = 0;

  // ------------------------------------------------------------------ git

  function writeTree(flat) {
    const dirs = new Map([['', []]]);
    const ensureDir = (dir) => {
      if (dirs.has(dir)) return;
      const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      ensureDir(parent);
      dirs.set(dir, []);
      dirs.get(parent).push(dir);
    };
    for (const filePath of Object.keys(flat)) {
      ensureDir(filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '');
    }
    const build = (dir) => {
      const entries = [];
      for (const child of dirs.get(dir)) {
        entries.push({
          relativePath: child.split('/').pop(), mode: '40000', gitObjectType: 'tree', objectId: build(child),
        });
      }
      for (const [filePath, file] of Object.entries(flat)) {
        const fileDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
        if (fileDir !== dir) continue;
        const sha = blobSha(file.content);
        blobs.set(sha, file.content);
        entries.push({
          relativePath: filePath.split('/').pop(), mode: file.mode, gitObjectType: 'blob', objectId: sha,
        });
      }
      entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      const id = objectSha(['tree', entries]);
      trees.set(id, entries);
      return id;
    };
    return build('');
  }

  function flatten(treeId, prefix = '', out = {}) {
    for (const entry of trees.get(treeId) || []) {
      const full = prefix ? `${prefix}/${entry.relativePath}` : entry.relativePath;
      if (entry.gitObjectType === 'tree') flatten(entry.objectId, full, out);
      else out[full] = { mode: entry.mode, content: blobs.get(entry.objectId) };
    }
    return out;
  }

  function makeCommit(flat, comment, parents, changes = []) {
    const treeId = writeTree(flat);
    const commitId = objectSha(['commit', treeId, parents, comment, changes.length]);
    commits.set(commitId, {
      commitId, treeId, parents, comment, changes,
    });
    return commitId;
  }

  function filesAt(branch) {
    const head = refs.get(branch);
    return head ? flatten(commits.get(head).treeId) : null;
  }

  refs.set('develop', makeCommit({ 'README.md': { mode: '100644', content: '# api\n' } }, 'seed', []));

  // ------------------------------------------------------------------ helpers

  function identityFor(headers) {
    const auth = String((headers && (headers.Authorization || headers.authorization)) || '');
    if (auth.startsWith('Bearer ')) return identities.get(auth.slice(7)) || null;
    if (auth.startsWith('Basic ')) {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      return identities.get(decoded.replace(/^:/, '')) || null;
    }
    return null;
  }

  function bump(op) {
    attempts.set(op, (attempts.get(op) || 0) + 1);
  }

  function injected(op) {
    const status = failures.get(op);
    return status ? respond(status, { message: `injected ${status}` }) : null;
  }

  function tenantHeaders() {
    return flags.tenantHeader ? { 'x-vss-resourcetenant': tenantId } : {};
  }

  function withHint(res) {
    const seconds = pending.hints.shift();
    if (seconds === undefined || !res.ok) return res;
    const headers = new Headers(res.headers);
    headers.set('Retry-After', String(seconds));
    headers.set('X-RateLimit-Resource', 'Core');
    headers.set('X-RateLimit-Delay', String(seconds));
    return new Response(res.body, { status: res.status, headers });
  }

  function itemPayload(item) {
    return { id: item.id, rev: item.rev, fields: { ...item.fields }, ...(item.formats ? { multilineFieldsFormat: item.formats } : {}) };
  }

  function prPayload(pr) {
    return {
      pullRequestId: pr.id,
      status: pr.status,
      sourceRefName: pr.sourceRefName,
      targetRefName: pr.targetRefName,
      title: pr.title,
      description: pr.description,
      ...(pr.autoCompleteSetBy ? { autoCompleteSetBy: pr.autoCompleteSetBy } : {}),
    };
  }

  function groupIdentityDescriptor(group) {
    return `Microsoft.TeamFoundation.Identity;${group.sid}`;
  }

  /** Every group descriptor the identity is a member of, transitively. */
  function memberOf(identityId) {
    const out = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const group of groups) {
        if (out.has(group)) continue;
        const direct = group.members.has(identityId);
        const nested = [...group.memberGroups].some((name) => [...out].some((g) => g.displayName === name));
        if (direct || nested) {
          out.add(group);
          changed = true;
        }
      }
    }
    return [...out];
  }

  // ------------------------------------------------------------------ routes

  async function devAzure(method, segments, url, init, body) {
    if (segments[0] !== org) return respond(404, { message: 'org not found' });
    const rest = segments.slice(1);
    const who = identityFor(init.headers);

    if (rest.length === 0) return respond(401, { message: 'unauthenticated' }, tenantHeaders());
    if (rest[0] === '_apis' && rest[1] === 'connectionData') {
      bump('connectionData');
      const failed = injected('connectionData');
      if (failed) return failed;
      if (!who || who.inOrg === false) return respond(401, { message: 'TF400813: not authorized' }, tenantHeaders());
      return respond(200, {
        authenticatedUser: { id: who.id, providerDisplayName: who.displayName, descriptor: who.descriptor },
        instanceId: orgId,
      });
    }
    if (!who || who.inOrg === false) return respond(401, { message: 'TF400813: not authorized' });
    if (rest[0] === '_apis' && rest[1] === 'projects' && rest.length === 3) {
      const failed = injected('permission');
      if (failed) return failed;
      return rest[2].toLowerCase() === project.toLowerCase()
        ? respond(200, { id: projectId, name: project })
        : respond(404, { message: 'project not found' });
    }
    if (String(rest[0]).toLowerCase() !== project.toLowerCase() || rest[1] !== '_apis') {
      return respond(404, { message: 'project not found' });
    }
    const api = rest.slice(2);

    if (api[0] === 'wit' && /^workitems$/i.test(api[1])) {
      const item = workItems.get(api[2]);
      if (api.length === 3 && method === 'GET') {
        bump('getItem');
        return item ? respond(200, itemPayload(item)) : respond(404, { message: 'TF401232: Work item does not exist' });
      }
      if (api.length === 3 && method === 'PATCH') {
        bump('patchItem');
        if (!item) return respond(404, { message: 'no item' });
        const type = String(init.headers['Content-Type'] || '');
        if (type !== 'application/json-patch+json') return respond(415, { message: 'json-patch required' });
        if (flags.tagConflicts > 0) {
          flags.tagConflicts -= 1;
          item.rev += 1;
          return respond(412, { message: 'TF26071: rev mismatch' });
        }
        for (const op of body) {
          if (op.op === 'test' && op.path === '/rev' && op.value !== item.rev) return respond(412, { message: 'TF26071: rev mismatch' });
        }
        for (const op of body) {
          if (op.path !== '/fields/System.Tags') continue;
          if (op.op === 'replace') item.fields['System.Tags'] = op.value;
          if (op.op === 'add') {
            // Azure DevOps merges tags on `add`.
            const merged = new Set(String(item.fields['System.Tags'] || '').split(';').map((t) => t.trim()).filter(Boolean));
            for (const tag of String(op.value).split(';').map((t) => t.trim()).filter(Boolean)) merged.add(tag);
            item.fields['System.Tags'] = [...merged].join('; ');
          }
        }
        item.rev += 1;
        item.patches.push(body);
        return respond(200, itemPayload(item));
      }
      if (api.length === 4 && api[3] === 'updates' && method === 'GET') {
        bump('updates');
        if (flags.updatesDown) return respond(500, { message: 'updates down' });
        if (!item) return respond(404, { message: 'no item' });
        const top = Math.min(Number(url.searchParams.get('$top') || 200), flags.updatesPageCap);
        const skip = Number(url.searchParams.get('$skip') || 0);
        const value = item.updates.slice(skip, skip + top);
        return respond(200, { value, count: value.length });
      }
      if (api.length === 4 && api[3] === 'comments' && method === 'POST') {
        bump('comment');
        const failed = injected('comment');
        if (failed) return failed;
        if (!item) return respond(404, { message: 'no item' });
        comments.push({ item: api[2], text: body.text, format: url.searchParams.get('format'), by: who.id });
        item.rev += 1;
        return respond(200, { id: comments.length });
      }
    }

    if (api[0] === 'build' && api[1] === 'definitions' && api.length === 2 && method === 'GET') {
      bump('definitions');
      if (flags.definitionsDown) return respond(403, { message: 'TF400813: no build read' });
      if (url.searchParams.get('repositoryId') !== repoId || url.searchParams.get('repositoryType') !== 'TfsGit') {
        return respond(200, { value: [], count: 0 });
      }
      const value = pipelines.map((yamlFilename, i) => ({ id: i + 1, name: `pipeline-${i + 1}`, process: { type: 2, yamlFilename } }));
      return respond(200, { value, count: value.length });
    }
    if (api[0] !== 'git' || api[1] !== 'repositories' || String(api[2]).toLowerCase() !== repo.toLowerCase()) {
      return respond(404, { message: `fake has no route for ${method} ${url.pathname}` });
    }
    const git = api.slice(3);
    if (git.length === 0 && method === 'GET') return respond(200, { id: repoId, name: repo, project: { id: projectId, name: project } });

    if (git[0] === 'refs' && method === 'GET') {
      const filter = url.searchParams.get('filter') || '';
      const value = [...refs.entries()]
        .filter(([name]) => `heads/${name}`.startsWith(filter))
        .map(([name, objectId]) => ({ name: `refs/heads/${name}`, objectId }));
      return respond(200, { value, count: value.length });
    }
    if (git[0] === 'items' && method === 'GET') {
      const files = filesAt(url.searchParams.get('versionDescriptor.version'));
      if (!files) return respond(404, { message: 'TF401175: branch not found' });
      const target = String(url.searchParams.get('path') || '').replace(/^\//, '');
      if (files[target]) {
        return respond(200, {
          objectId: blobSha(files[target].content),
          gitObjectType: 'blob',
          commitId: refs.get(url.searchParams.get('versionDescriptor.version')),
          path: `/${target}`,
          content: files[target].content,
        });
      }
      if (Object.keys(files).some((p) => p.startsWith(`${target}/`))) {
        return respond(200, { path: `/${target}`, isFolder: true, gitObjectType: 'tree' });
      }
      return respond(404, { message: 'TF401174: item not found' });
    }
    if (git[0] === 'commits' && git.length === 2 && method === 'GET') {
      const commit = commits.get(git[1]);
      return commit ? respond(200, { commitId: commit.commitId, treeId: commit.treeId, parents: commit.parents, comment: commit.comment })
        : respond(404, { message: 'no commit' });
    }
    if (git[0] === 'commits' && git[2] === 'changes' && method === 'GET') {
      const commit = commits.get(git[1]);
      if (!commit) return respond(404, { message: 'no commit' });
      const counts = {};
      for (const change of commit.changes) {
        if (change.item.isFolder) continue;
        const key = change.changeType === 'add' ? 'Add' : 'Edit';
        counts[key] = (counts[key] || 0) + 1;
      }
      return respond(200, { changes: commit.changes, changeCounts: counts });
    }
    if (git[0] === 'trees' && method === 'GET') {
      const entries = trees.get(git[1]);
      return entries ? respond(200, { objectId: git[1], treeEntries: entries }) : respond(404, { message: 'no tree' });
    }
    if (git[0] === 'pushes' && method === 'POST') {
      bump('push');
      const failed = injected('push');
      if (failed) return failed;
      const update = body.refUpdates[0];
      const branch = update.name.replace(/^refs\/heads\//, '');
      if (update.oldObjectId === ZERO_SHA && refs.has(branch)) {
        return respond(409, { message: `TF401028: The reference '${update.name}' has already been updated by another client.` });
      }
      const commit = body.commits[0];
      if (!Array.isArray(commit.parents) || commit.parents.length !== 1 || !commits.has(commit.parents[0])) {
        return respond(400, { message: 'fake: a push must name its parent (or it is an orphan root commit)' });
      }
      const flat = flatten(commits.get(commit.parents[0]).treeId);
      const changes = [];
      const newDirs = new Set();
      for (const change of commit.changes) {
        const filePath = change.item.path.replace(/^\//, '');
        const content = Buffer.from(change.newContent.content, 'base64').toString('utf8');
        if (change.changeType === 'add' && flat[filePath]) return respond(400, { message: 'TF402455: add on an existing path' });
        if (change.changeType === 'edit' && !flat[filePath]) return respond(400, { message: 'TF401174: edit on a missing path' });
        const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
        if (dir && !Object.keys(flat).some((p) => p.startsWith(`${dir}/`))) newDirs.add(dir);
        // Edits keep the file's mode; adds are regular files.
        flat[filePath] = { mode: flat[filePath] ? flat[filePath].mode : '100644', content };
        changes.push({ changeType: change.changeType, item: { path: change.item.path, objectId: blobSha(content), gitObjectType: 'blob' } });
      }
      for (const dir of newDirs) changes.push({ changeType: 'add', item: { path: `/${dir}`, isFolder: true, gitObjectType: 'tree' } });
      const commitId = makeCommit(flat, commit.comment, commit.parents, changes);
      refs.set(branch, commitId);
      return respond(201, { pushId: commits.size, commits: [{ commitId }], refUpdates: [{ name: update.name, newObjectId: commitId }] });
    }
    if (git[0] === 'pullrequests' && git.length === 1 && method === 'POST') {
      bump('pr');
      if (pulls.some((pr) => pr.status === 'active' && pr.sourceRefName === body.sourceRefName && pr.targetRefName === body.targetRefName)) {
        return respond(409, { message: 'TF401179: An active pull request for the source and target branch already exists.' });
      }
      const pr = {
        id: 100 + pulls.length,
        status: 'active',
        sourceRefName: body.sourceRefName,
        targetRefName: body.targetRefName,
        title: body.title,
        description: body.description,
        workItemRefs: body.workItemRefs,
        createdBy: who.id,
        autoCompleteSetBy: flags.autoCompleteByDefault ? { id: who.id } : null,
      };
      pulls.push(pr);
      return respond(201, prPayload(pr));
    }
    if (git[0] === 'pullrequests' && git.length === 1 && method === 'GET') {
      const source = url.searchParams.get('searchCriteria.sourceRefName');
      const target = url.searchParams.get('searchCriteria.targetRefName');
      const status = url.searchParams.get('searchCriteria.status');
      const value = pulls.filter((pr) => pr.sourceRefName === source && (!target || pr.targetRefName === target)
        && (!status || pr.status === status)).map(prPayload);
      return respond(200, { value, count: value.length });
    }
    if (git[0] === 'pullrequests' && git.length === 2) {
      const pr = pulls.find((p) => String(p.id) === git[1]);
      if (!pr) return respond(404, { message: 'no pr' });
      if (method === 'GET') return respond(200, prPayload(pr));
      if (method === 'PATCH') {
        bump('prPatch');
        if (flags.clearFails) return respond(403, { message: 'TF401027: not allowed' });
        if (body.autoCompleteSetBy && body.autoCompleteSetBy.id === ZERO_GUID) pr.autoCompleteSetBy = null;
        return respond(200, prPayload(pr));
      }
    }
    return respond(404, { message: `fake has no route for ${method} ${url.pathname}` });
  }

  async function vssps(method, segments, url, init) {
    if (segments[0] !== org || segments[1] !== '_apis') return respond(404, { message: 'not found' });
    const who = identityFor(init.headers);
    if (!who || who.inOrg === false) return respond(401, { message: 'unauthorized' });
    const api = segments.slice(2);
    if (api[0] === 'graph' && api[1] === 'descriptors') {
      if (api[2] === projectId) return respond(200, { value: `scp.${Buffer.from(projectId).toString('base64url')}` });
      const known = [...identities.values()].find((i) => i.id === api[2]);
      return known ? respond(200, { value: known.subjectDescriptor }) : respond(404, { message: 'no descriptor' });
    }
    if (api[0] === 'graph' && api[1] === 'groups' && api.length === 2) {
      const scope = url.searchParams.get('scopeDescriptor');
      if (scope !== `scp.${Buffer.from(projectId).toString('base64url')}`) return respond(400, { message: 'bad scope' });
      const start = Number(url.searchParams.get('continuationToken') || 0);
      const page = groups.slice(start, start + flags.groupPageSize).map((g) => ({
        displayName: g.displayName, principalName: `[${project}]\\${g.displayName}`, descriptor: g.descriptor,
      }));
      const next = start + flags.groupPageSize < groups.length ? { 'x-ms-continuationtoken': String(start + flags.groupPageSize) } : {};
      return respond(200, { value: page, count: page.length }, next);
    }
    if (api[0] === 'graph' && api[1] === 'memberships' && api.length === 4) {
      const subject = [...identities.values()].find((i) => i.subjectDescriptor === api[2]);
      const group = groups.find((g) => g.descriptor === api[3]);
      return subject && group && group.members.has(subject.id)
        ? respond(200, { memberDescriptor: api[2], containerDescriptor: api[3] })
        : respond(404, { message: 'not a member' });
    }
    if (api[0] === 'identities' && api.length === 1) {
      bump('identities');
      if (flags.identitiesDown) return respond(500, { message: 'identities down' });
      const subjects = url.searchParams.get('subjectDescriptors');
      if (subjects) {
        const group = groups.find((g) => g.descriptor === subjects);
        return respond(200, { value: group ? [{ id: group.id, descriptor: groupIdentityDescriptor(group) }] : [] });
      }
      const ids = url.searchParams.get('identityIds');
      const identity = [...identities.values()].find((i) => i.id === ids);
      if (!identity) return respond(200, { value: [] });
      const expanded = url.searchParams.get('queryMembership') === 'Expanded';
      return respond(200, {
        value: [{
          id: identity.id,
          descriptor: `Microsoft.IdentityModel.Claims.ClaimsIdentity;${identity.uniqueName}`,
          memberOf: expanded ? memberOf(identity.id).map(groupIdentityDescriptor) : [],
        }],
      });
    }
    return respond(404, { message: `fake has no route for ${method} ${url.pathname}` });
  }

  async function entra(method, segments, init) {
    const tenant = segments[0];
    const form = new URLSearchParams(String(init.body || ''));
    const sp = servicePrincipals.get(form.get('client_id'));
    const secretOk = sp && ((form.get('client_secret') && form.get('client_secret') === sp.secret)
      || (form.get('client_assertion') && form.get('client_assertion') === sp.assertion));
    if (!sp || !secretOk || !sp.tenants.has(tenant) || form.get('scope') !== '499b84ac-1321-427f-aa17-267ca6975798/.default') {
      return respond(401, { error: 'invalid_client', error_codes: [7000215], error_description: 'secret-ish text that must not leak' });
    }
    mintCount += 1;
    const token = `entra-${tenant}-${form.get('client_id')}-${mintCount}`;
    identities.set(token, { ...sp.identity, inOrg: sp.inOrgTenants.has(tenant) });
    return respond(200, { access_token: token, expires_in: 3599, token_type: 'Bearer' });
  }

  async function fetchImpl(input, init = {}) {
    const method = String(init.method || 'GET').toUpperCase();
    const url = new URL(String(input));
    const headers = init.headers || {};
    requests.push({ method, url: url.toString(), headers });
    if (pending.limits.length > 0) {
      const seconds = pending.limits.shift();
      return respond(429, { message: 'TF400733: request was blocked' }, { 'Retry-After': String(seconds) });
    }
    const segments = url.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
    let body;
    if (init.body && String(headers['Content-Type'] || '').includes('json')) body = JSON.parse(init.body);
    let res;
    if (url.host === 'dev.azure.com') res = await devAzure(method, segments, url, { ...init, headers }, body);
    else if (url.host === 'vssps.dev.azure.com') res = await vssps(method, segments, url, { ...init, headers });
    else if (url.host === 'login.microsoftonline.com') res = await entra(method, segments, init);
    else res = respond(404, { message: 'unknown host' });
    return withHint(res);
  }

  function addIdentity({
    token, name, kind = 'user', inOrg = true, id,
  }) {
    const identityId = id || guid(`identity-${name}`);
    const descriptorPrefix = { user: 'aad', sp: 'aadsp', svc: 'svc' }[kind] || 'aad';
    const identity = {
      id: identityId,
      displayName: name,
      uniqueName: kind === 'user' ? `${name}@contoso.example` : name,
      descriptor: `${descriptorPrefix}.${Buffer.from(identityId).toString('base64url')}`,
      subjectDescriptor: `${descriptorPrefix}.${Buffer.from(identityId).toString('base64url')}`,
      inOrg,
    };
    if (token) identities.set(token, identity);
    else identities.set(`__${identityId}`, identity);
    return identity;
  }

  return {
    org,
    project,
    repo,
    tenantId,
    orgId,
    projectId,
    repoId,
    fetchImpl,
    requests,
    comments,
    pulls,
    attempts,
    flags,
    blobSha,
    guid,
    addIdentity,
    /** An Entra app: minting works in `tenants`; the token reaches the org only in `inOrgTenants`. */
    addServicePrincipal({
      clientId, secret, assertion, name, tenants = [tenantId], inOrgTenants = tenants,
    }) {
      const identity = addIdentity({ name, kind: 'sp', inOrg: false });
      servicePrincipals.set(clientId, {
        secret, assertion, identity, tenants: new Set(tenants), inOrgTenants: new Set(inOrgTenants),
      });
      return identity;
    },
    seedWorkItem(id, {
      title = 'Fix the API', description = '<div>src/api.js returns 500.</div>', createdBy, tags, project: itemProject = project,
      extra = {}, formats,
    } = {}) {
      const fields = {
        'System.Title': title,
        'System.TeamProject': itemProject,
        'System.WorkItemType': 'Bug',
        'System.ChangedDate': '2026-10-27T10:00:00Z',
        'System.CreatedBy': createdBy || {
          id: guid('identity-alice'), displayName: 'Alice', uniqueName: 'alice@contoso.example', descriptor: 'aad.YWxpY2U',
        },
        ...extra,
      };
      if (description !== undefined) fields['System.Description'] = description;
      if (tags !== undefined) fields['System.Tags'] = tags;
      const creator = fields['System.CreatedBy'];
      const firstFields = {};
      for (const [name, value] of Object.entries(fields)) firstFields[name] = { newValue: value };
      workItems.set(String(id), {
        id: Number(id),
        rev: 1,
        fields,
        formats,
        patches: [],
        updates: [{
          id: 1, rev: 1, revisedBy: creator && typeof creator === 'object' ? { id: creator.id, displayName: creator.displayName } : {}, fields: firstFields,
        }],
      });
    },
    /** A later edit by `by` (an IdentityRef): changes fields and appends to the update history. */
    editWorkItem(id, { by, fields: changes }) {
      const item = workItems.get(String(id));
      const delta = {};
      for (const [name, value] of Object.entries(changes)) {
        delta[name] = { oldValue: item.fields[name], newValue: value };
        item.fields[name] = value;
      }
      item.rev += 1;
      item.updates.push({
        id: item.updates.length + 1, rev: item.rev, revisedBy: by ? { id: by.id, displayName: by.displayName } : {}, fields: delta,
      });
    },
    /** Register a build definition whose YAML is at `yamlFilename` (`/ci/build.yml`). */
    addPipeline(yamlFilename) {
      pipelines.push(yamlFilename);
    },
    workItem(id) {
      return workItems.get(String(id));
    },
    itemTags(id) {
      const raw = workItems.get(String(id)).fields['System.Tags'];
      return String(raw || '').split(';').map((t) => t.trim()).filter(Boolean);
    },
    seedBase(files) {
      const flat = { ...filesAt('develop') };
      for (const [p, f] of Object.entries(files)) {
        flat[p] = { mode: f.mode || (f.executable ? '100755' : '100644'), content: f.content };
      }
      refs.set('develop', makeCommit(flat, 'seed', [refs.get('develop')]));
    },
    seedBranch(branch, files, { from = 'develop' } = {}) {
      const flat = { ...filesAt(from) };
      for (const [p, content] of Object.entries(files)) flat[p] = { mode: '100644', content };
      refs.set(branch, makeCommit(flat, `seed ${branch}`, [refs.get(from)]));
    },
    setRef(branch, sha) {
      refs.set(branch, sha);
    },
    deleteRef(branch) {
      refs.delete(branch);
    },
    refOf(branch) {
      return refs.get(branch) || null;
    },
    commit(sha) {
      return commits.get(sha) || null;
    },
    branchExists(branch) {
      return refs.has(branch);
    },
    filesAt,
    addGroup(displayName, { members = [], memberGroups = [] } = {}) {
      const group = {
        displayName,
        id: guid(`group-${displayName}`),
        sid: `S-1-9-${parseInt(guid(displayName).slice(0, 8), 16)}`,
        descriptor: `vssgp.${Buffer.from(displayName).toString('base64url')}`,
        members: new Set(members),
        memberGroups: new Set(memberGroups),
      };
      groups.push(group);
      return group;
    },
    fail(op, status) {
      failures.set(op, status);
    },
    clearFailures() {
      failures.clear();
    },
    /** The next response (if 2xx) carries Retry-After: seconds. */
    throttleNext(seconds) {
      pending.hints.push(seconds);
    },
    /** The next `count` requests are 429 with Retry-After: seconds. */
    rateLimitNext(count = 1, seconds = 0) {
      for (let i = 0; i < count; i += 1) pending.limits.push(seconds);
    },
  };
}

module.exports = {
  ZERO_GUID,
  blobSha,
  createFakeAzureDevOps,
  guid,
};
