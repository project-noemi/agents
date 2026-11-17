'use strict';

/**
 * Azure DevOps forge provider (dev.azure.com; Azure DevOps Server through
 * ADO_BASE_URL).
 *
 * Shape of the forge, and what the loop does about it:
 *   - A repository is `org/project/repo`; a work item belongs to the
 *     PROJECT, not the repo, and its id is unique per ORG. getItem reports
 *     `scopeKey` = org/project from System.TeamProject, and run.js refuses
 *     an item that the forge says lives in another project (repo-moved).
 *   - Description, Repro Steps and Acceptance Criteria are HTML (unless the
 *     field is markdown-format). They are converted to markdown; text a
 *     person cannot see goes to hiddenText and is scanned.
 *   - The loop label is a tag. The whole tag string is rewritten in one
 *     rev-guarded JSON Patch, so it is never left with no `noemi:*` tag.
 *   - One push = one commit + one ref create, with `parents` set (without
 *     them Azure DevOps makes an orphan root commit) [unverified: a push is
 *     atomic]. The push API has no file mode [unverified], so this provider
 *     cannot keep an executable bit: it REFUSES to edit an executable file
 *     (capabilities.preservesMode false) and never writes a symlink.
 *   - A pull request can complete itself when the repo sets "auto-complete
 *     by default"; the loop's PR must wait for the reviewer, so auto-complete
 *     is cleared after create and the run stops if it cannot be.
 *
 * API versions are pinned: 7.1 everywhere, 7.1-preview.4 for comments.
 * Every network call goes through the injectable `fetchImpl` (client.js);
 * the Entra mint, the org-tenant probe and the token file read are seams.
 */

const crypto = require('crypto');
const path = require('path');
const {
  encodeRepoPath, foldForCarveOut, isCarvedOut, isSafeRepoPath,
} = require('../../paths.js');
const { hiddenInMarkdown, htmlToMarkdown, isLikelyHtml } = require('../../markup/html-to-markdown.js');
const { makeRepoRef, providerError, splitProviderPrefix } = require('../contract.js');
const { baseHost, createAdoClient, orgUrl } = require('./client.js');
const { createCredentialResolver, isGuid, mintEntraToken } = require('./auth.js');
const {
  ZERO_GUID, connectionData, discoverOrgTenant, resolveAdoEntitlement,
} = require('./entitlement.js');
const { adoRequesterPermission } = require('./requester.js');

const ID = 'azure-devops';
const API = '7.1';
const COMMENTS_API = '7.1-preview.4';
const ITEM_ID_RE = /^[1-9][0-9]*$/;
const MAX_ITEM_ID = 2147483647;
const ZERO_SHA = '0000000000000000000000000000000000000000';
const PR_DESCRIPTION_LIMIT = 4000;
const TRUNCATION_NOTE = '\n\n_(Truncated: Azure DevOps limits a pull request description to 4000 characters.)_';
const MAX_CHANGES = 1000;
const UPDATES_PAGE = 200;
const MAX_UPDATE_PAGES = 50;
const MAX_DEFINITION_PAGES = 20;
/** Same-repo pipeline YAML files (definitions + nested templates) we will walk. */
const MAX_PIPELINE_YAML = 200;
const YAML_RE = /\.ya?ml$/i;

// Organization: letters, digits, hyphens; starts and ends alphanumeric.
const ORG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?$/;
// Project / repository: a conservative subset of what Azure DevOps allows.
// Spaces are allowed (project names often have them) and are encoded per
// segment in every URL. No `%`, `/`, `\`, control characters or `..`; no
// trailing dot or space (Windows-style folding).
const NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9 ._()-]{0,62}[A-Za-z0-9_()-])?$/;

/** Fields that may carry HTML, in the order they join the body. */
const BODY_FIELDS = [
  { field: 'System.Description', heading: null },
  { field: 'Microsoft.VSTS.TCM.ReproSteps', heading: '## Repro steps' },
  { field: 'Microsoft.VSTS.Common.AcceptanceCriteria', heading: '## Acceptance criteria' },
];

/** Fields whose change is a change to what the plan is made from. */
const BODY_EDIT_FIELDS = ['System.Title', ...BODY_FIELDS.map(({ field }) => field)].map((f) => f.toLowerCase());

/** A build definition's yamlFilename (`/ci/x.yml`, `ci\\x.yml`) → repo path as written, or ''. */
function pipelinePathOf(raw) {
  const text = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!text) return '';
  const normalized = path.posix.normalize(text);
  return normalized.startsWith('..') ? '' : normalized;
}

/**
 * `template:` references in a pipeline YAML that live in the same
 * repository, resolved like Azure Pipelines does (relative to the including
 * file; a leading `/` is the repo root). `file@alias` (another repository)
 * and expressions (`${{ }}`, `$( )`) are skipped; only .yml/.yaml.
 */
function templateRefs(text, fromPath) {
  const out = [];
  const dir = path.posix.dirname(fromPath);
  for (const line of String(text || '').split('\n')) {
    const m = /^\s*(?:-\s*)?template\s*:\s*(['"]?)([^'"#\s]+)\1\s*(?:#.*)?$/.exec(line);
    if (!m) continue;
    const ref = m[2];
    if (ref.includes('@') || ref.includes('$') || !YAML_RE.test(ref)) continue;
    const resolved = ref.startsWith('/') ? pipelinePathOf(ref) : pipelinePathOf(path.posix.join(dir === '.' ? '' : dir, ref));
    if (resolved) out.push(resolved);
  }
  return out;
}

function validSegments(org, project, name) {
  if (!ORG_RE.test(org)) return false;
  return [project, name].every((segment) => NAME_RE.test(segment) && !segment.includes('..'));
}

/** git's blob id for text content: sha1("blob <bytes>\0<content>"). */
function gitBlobSha(content) {
  const bytes = Buffer.from(String(content), 'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/** `100644`-style mode from Azure DevOps' tree entry (string or number). */
function normalizeMode(mode) {
  const text = String(mode === undefined || mode === null ? '' : mode).trim();
  if (/^[0-7]{5,6}$/.test(text)) return text.padStart(6, '0');
  return text;
}

function splitTags(raw) {
  if (typeof raw !== 'string') return [];
  return raw.split(';').map((tag) => tag.trim()).filter(Boolean);
}

function sameTags(a, b) {
  const left = a.map((t) => t.toLowerCase()).sort();
  const right = b.map((t) => t.toLowerCase()).sort();
  return left.length === right.length && left.every((t, i) => t === right[i]);
}

/**
 * HTML field → { markdown, hidden }. `format` is the field's
 * multilineFieldsFormat when the response has one (7.2-preview adds it);
 * without it, text with no recognisable HTML tag is passed through as
 * markdown. Either way, inline HTML in markdown has its hidden part copied
 * out (the markdown is not changed).
 */
function fieldToMarkdown(value, format) {
  const text = value === undefined || value === null ? '' : String(value);
  if (!text.trim()) return { markdown: '', hidden: '' };
  const declared = typeof format === 'string' ? format.toLowerCase() : null;
  if (declared === 'markdown' || (declared === null && !isLikelyHtml(text))) {
    return { markdown: text.trim(), hidden: hiddenInMarkdown(text) };
  }
  const converted = htmlToMarkdown(text);
  return { markdown: converted.markdown.trim(), hidden: converted.hidden };
}

/**
 * Service identities never file real requests:
 *   - descriptor `aadsp.` (Entra service principal / managed identity)
 *     [unverified prefix], `svc.` (service identity, e.g. a Build Service),
 *     `s2s.` (service-to-service);
 *   - a name containing "Build Service" (Project Collection Build Service
 *     and per-project build identities).
 * Accepts an IdentityRef, a WorkItem author, or a "Name <mail>" string.
 */
function isBotIdentity(author) {
  if (!author) return false;
  if (typeof author === 'object' && author.isBot === true) return true;
  const descriptor = typeof author === 'object' ? String(author.descriptor || '') : '';
  if (/^(?:aadsp|svc|s2s)\./i.test(descriptor)) return true;
  const names = typeof author === 'string'
    ? [author]
    : [author.uniqueName, author.displayName, author.login, author.name];
  return names.some((name) => /build service/i.test(String(name || '')));
}

/** System.CreatedBy (IdentityRef, or a legacy "Name <mail>" string) → WorkItem author. */
function authorOf(createdBy) {
  if (createdBy && typeof createdBy === 'object') {
    const id = typeof createdBy.id === 'string' ? createdBy.id.toLowerCase() : null;
    return {
      id,
      login: String(createdBy.uniqueName || createdBy.displayName || id || ''),
      displayName: String(createdBy.displayName || ''),
      descriptor: String(createdBy.descriptor || ''),
      isBot: isBotIdentity(createdBy),
    };
  }
  const text = String(createdBy || '');
  return {
    id: null, login: text, displayName: text, descriptor: '', isBot: isBotIdentity(text),
  };
}

/** Work item REST payload → WorkItem. */
function normalizeWorkItem(ref, payload, id, { webUrl } = {}) {
  const fields = (payload && payload.fields) || {};
  const formats = (payload && payload.multilineFieldsFormat) || {};
  const parts = [];
  const hidden = [];
  for (const { field, heading } of BODY_FIELDS) {
    const converted = fieldToMarkdown(fields[field], formats[field]);
    if (converted.hidden) hidden.push(converted.hidden);
    if (!converted.markdown) continue;
    parts.push(heading ? `${heading}\n\n${converted.markdown}` : converted.markdown);
  }
  const teamProject = typeof fields['System.TeamProject'] === 'string' ? fields['System.TeamProject'] : '';
  // The forge's own answer: the item's id must be the one we asked for and
  // its project is what the scope check compares. Missing either → an empty
  // key, which run.js refuses.
  const sameId = payload && String(payload.id) === String(id);
  const scopeKey = sameId && teamProject ? `${ID}:${ref.owner}/${teamProject}`.toLowerCase() : '';
  const repoKey = scopeKey
    ? makeRepoRef({
      provider: ID, host: ref.host, owner: ref.owner, project: teamProject, name: ref.name,
    }).key
    : '';
  const number = Number(id);
  return {
    provider: ID,
    id: String(number),
    number,
    org: ref.owner,
    project: ref.project,
    repo: ref.name,
    title: String(fields['System.Title'] || ''),
    body: parts.join('\n\n'),
    bodyFormat: 'markdown',
    hiddenText: hidden.join('\n'),
    author: authorOf(fields['System.CreatedBy']),
    labels: splitTags(fields['System.Tags']),
    updatedAt: fields['System.ChangedDate'] || null,
    version: payload && payload.rev !== undefined ? String(payload.rev) : null,
    url: webUrl || null,
    itemType: String(fields['System.WorkItemType'] || ''),
    repoKey,
    scopeKey,
  };
}

/**
 * Azure Repos resolves `Fixes #N` style mentions in a PR description when the
 * PR completes, and it is not documented to skip code spans. Every `#N` after
 * the loop's own first line (the closing line from closingLine) gets an
 * invisible zero-width space entity, so plan text can mention a work item
 * without linking or resolving it. The first line is left as written.
 */
function defuseItemMentions(text) {
  const body = String(text || '');
  const newline = body.indexOf('\n');
  if (newline === -1) return body;
  const rest = body.slice(newline).replace(/(^|[^\w&#])#(\d+)/g, '$1#&#8203;$2');
  return body.slice(0, newline) + rest;
}

/** Cut a PR description to the forge limit without splitting a surrogate pair or leaving a fence open. */
function truncateDescription(text) {
  const body = String(text || '');
  if (body.length <= PR_DESCRIPTION_LIMIT) return { description: body, truncated: false };
  let cut = body.slice(0, PR_DESCRIPTION_LIMIT - TRUNCATION_NOTE.length - 4);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  const fences = (cut.match(/^\s*(?:```|~~~)/gm) || []).length;
  if (fences % 2 === 1) cut += '\n```';
  return { description: `${cut}${TRUNCATION_NOTE}`, truncated: true };
}

function hasAutoComplete(pr) {
  const setBy = pr && pr.autoCompleteSetBy;
  return Boolean(setBy && typeof setBy.id === 'string' && setBy.id !== ZERO_GUID);
}

/**
 * Defence in depth: dispatch already refuses these before any network call,
 * but the provider is the last code before a forge write.
 */
function assertCommitFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw providerError('commitFiles needs at least one file.', 400, 'empty-commit');
  }
  const seen = new Set();
  for (const file of files) {
    const filePath = file && file.path;
    if (!isSafeRepoPath(filePath) || isCarvedOut(filePath) || typeof file.content !== 'string') {
      throw providerError('commitFiles refused an unsafe, carved-out or non-text file.', 400, 'unsafe-commit-path');
    }
    // Azure DevOps paths are case-insensitive: two spellings of one path
    // would be two changes to one file.
    const folded = filePath.toLowerCase();
    if (seen.has(folded)) throw providerError('commitFiles got the same path twice.', 400, 'duplicate-commit-path');
    seen.add(folded);
    if (file.mode !== undefined && !['100644', '100755'].includes(String(file.mode))) {
      throw providerError('commitFiles accepts only regular (100644) or executable (100755) files.', 400, 'unsafe-commit-mode');
    }
  }
}

function assertBranchName(name) {
  if (!isSafeRepoPath(String(name || ''))) {
    throw providerError('Refusing an unsafe branch name.', 400, 'unsafe-branch');
  }
}

/**
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl]      fetch for every Azure DevOps call (and the default Entra mint)
 * @param {Function} [opts.mintEntraToken] ({ tenantId, clientId, clientSecret, clientAssertion }) → { token, expiresInMs }
 * @param {Function} [opts.orgTenant]      (org, env) → tenant GUID; default probes x-vss-resourcetenant
 * @param {Function} [opts.readTokenFile]  (path) → federated token text
 * @param {Function} [opts.sleep]          throttle wait (tests)
 * @param {Function} [opts.now]
 * @param {number}   [opts.retryBaseMs]
 * @param {object}   [opts.env]            env for URLs and the requester group; default process.env at call time
 */
function createAzureDevOpsProvider({
  fetchImpl, mintEntraToken: mintImpl, orgTenant, readTokenFile, sleep, now, retryBaseMs, env: boundEnv,
} = {}) {
  const envOf = () => boundEnv || process.env;
  const client = createAdoClient({
    fetchImpl, sleep, now, retryBaseMs,
  });
  const { request } = client;
  const tenantCache = new Map();
  const orgTenantOf = async (org, env = envOf()) => {
    const key = String(org).toLowerCase();
    if (!tenantCache.has(key)) {
      const lookup = orgTenant
        ? Promise.resolve(orgTenant(org, env))
        : discoverOrgTenant(org, env, { fetchImpl: fetchImpl || globalThis.fetch });
      tenantCache.set(key, lookup.catch((err) => {
        tenantCache.delete(key);
        throw err;
      }));
    }
    return tenantCache.get(key);
  };
  const credentials = createCredentialResolver({
    mintEntraToken: mintImpl || ((input) => mintEntraToken({ ...input, fetchImpl: fetchImpl || globalThis.fetch })),
    orgTenant: orgTenantOf,
    readTokenFile,
    now,
  });
  const trees = new Map();
  const commits = new Map();

  function credOf(cred) {
    if (cred === undefined || cred === null) return undefined;
    if (typeof cred !== 'object' || cred.provider !== ID) {
      throw providerError('Azure DevOps provider was handed another forge\'s credential.', 500, 'foreign-credential');
    }
    return cred;
  }

  const projectApi = (ref) => `${orgUrl(ref.owner, envOf())}/${encodeURIComponent(ref.project)}/_apis`;
  const repoApi = (ref) => `${projectApi(ref)}/git/repositories/${encodeURIComponent(ref.name)}`;
  const workItemApi = (ref, id) => `${projectApi(ref)}/wit/workitems/${id}`;
  const webUrlOf = (ref, suffix) => `${orgUrl(ref.owner, envOf())}/${encodeURIComponent(ref.project)}/${suffix}`;

  function parseRepo(input, { env = process.env } = {}) {
    const text = String(input === undefined || input === null ? '' : input).trim();
    // The host this process will call for that org (a junk ADO_BASE_URL
    // parses nothing: every later call would fail anyway).
    const hostFor = (org) => {
      try {
        return new URL(orgUrl(org, env)).host.toLowerCase();
      } catch {
        return null;
      }
    };
    const prefixed = splitProviderPrefix(text);
    if (prefixed) {
      if (prefixed.provider !== ID) return null;
      const segments = prefixed.rest.trim().split('/');
      if (segments.length !== 3) return null;
      const [org, project, name] = segments;
      if (!validSegments(org, project, name) || !hostFor(org)) return null;
      return makeRepoRef({
        provider: ID, host: hostFor(org), owner: org, project, name,
      });
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
    let url;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.password || url.search || url.hash) return null;
    const urlHost = url.host.toLowerCase();
    const raw = url.pathname.replace(/\/+$/, '').split('/').slice(1);
    let decoded;
    try {
      decoded = raw.map((segment) => decodeURIComponent(segment));
    } catch {
      return null;
    }
    let org;
    let rest;
    let host;
    try {
      host = baseHost(env);
    } catch {
      return null;
    }
    if (env && env.ADO_BASE_URL) {
      // Only the server this process will call (like GHES in the GitHub
      // provider): a dev.azure.com URL would be looked up on the wrong forge.
      const template = String(env.ADO_BASE_URL).trim().replace(/\/+$/, '');
      const basePath = new URL(template.replace('{org}', 'org')).pathname.replace(/\/+$/, '');
      const templateHost = /^[a-z][a-z0-9+.-]*:\/\/([^/]*)/i.exec(template);
      const orgInHost = Boolean(templateHost) && templateHost[1].includes('{org}');
      if (template.includes('{org}') && !orgInHost) {
        // `https://host/tfs/{org}`: the org is the path segment the
        // placeholder stands in; every other base segment must match.
        if (urlHost !== host) return null;
        const templateSegments = new URL(template.replace('{org}', '__noemi_org__')).pathname.split('/').filter(Boolean);
        const orgIndex = templateSegments.indexOf('__noemi_org__');
        if (orgIndex === -1) return null;
        const mismatch = templateSegments.some((segment, i) => (
          i !== orgIndex && (decoded[i] || '').toLowerCase() !== segment.toLowerCase()
        ));
        if (mismatch) return null;
        org = decoded[orgIndex];
        rest = decoded.slice(templateSegments.length);
      } else if (template.includes('{org}')) {
        const hostPattern = new URL(String(env.ADO_BASE_URL).replace('{org}', 'org')).host.toLowerCase().replace(/^org\./, '');
        if (!urlHost.endsWith(`.${hostPattern}`)) return null;
        org = urlHost.slice(0, -(hostPattern.length + 1));
        rest = decoded.slice(basePath.split('/').filter(Boolean).length);
      } else {
        if (urlHost !== host) return null;
        const baseSegments = basePath.split('/').filter(Boolean);
        if (baseSegments.some((segment, i) => (decoded[i] || '').toLowerCase() !== segment.toLowerCase())) return null;
        [org, ...rest] = decoded.slice(baseSegments.length);
      }
    } else if (urlHost === 'dev.azure.com') {
      [org, ...rest] = decoded;
    } else if (/^[a-z0-9-]+\.visualstudio\.com$/.test(urlHost)) {
      org = urlHost.slice(0, -'.visualstudio.com'.length);
      rest = decoded[0] && decoded[0].toLowerCase() === 'defaultcollection' ? decoded.slice(1) : decoded;
    } else {
      return null;
    }
    // A clone URL carries `org@`; any other user name is refused.
    if (url.username && decodeURIComponent(url.username).toLowerCase() !== String(org || '').toLowerCase()) return null;
    if (!Array.isArray(rest) || rest.length !== 3 || rest[1] !== '_git') return null;
    const [project, , rawName] = rest;
    // A clone URL may end in `.git`; the repository's name does not.
    const name = String(rawName || '').replace(/\.git$/i, '');
    if (!validSegments(String(org || ''), project, name) || !hostFor(org)) return null;
    return makeRepoRef({
      provider: ID, host: hostFor(org), owner: org, project, name,
    });
  }

  function parseItemId(input) {
    const text = String(input === undefined || input === null ? '' : input);
    if (!ITEM_ID_RE.test(text) || Number(text) > MAX_ITEM_ID) {
      throw providerError('Need --item N (a positive work item id).', 400, 'bad-item-id');
    }
    return text;
  }

  function itemDisplay(ref, id) {
    return `${ref.slug}#${id}`;
  }

  /**
   * `Fixes #N` resolves the work item when the PR completes, if the repo's
   * "commit mention work item resolution" setting is on; the PR's
   * workItemRefs link it either way. `Part of #N` is a mention only: it
   * links and never changes the item's state (Decision [2026-10-05-0001]).
   */
  function closingLine(id, { closes = true } = {}) {
    return `${closes ? 'Fixes' : 'Part of'} #${id}`;
  }

  function branchForItem(id) {
    return `noemi/workitem-${id}`;
  }

  /**
   * The producer's identity id. Azure DevOps has no fixed bot login to
   * default to (GitHub's `noemi-agent`), so an unset or malformed value
   * refuses every producer write.
   */
  function expectedProducerLogin(env = process.env) {
    const id = String((env && env.ADO_AGENT_EXPECTED_ID) || '').trim();
    if (!isGuid(id)) {
      throw providerError(
        'ADO_AGENT_EXPECTED_ID (the noemi-agent service principal identity id) is not set; refusing producer writes.',
        403,
        'producer-identity-unset',
      );
    }
    return id.toLowerCase();
  }

  async function whoAmI(ref, cred) {
    const data = await connectionData(request, ref.owner, credOf(cred), envOf());
    return { id: data.userId, login: data.userId, displayName: data.displayName };
  }

  async function getItem(ref, id, cred) {
    const itemId = parseItemId(id);
    const payload = await request(`${workItemApi(ref, itemId)}?api-version=${API}&$expand=none`, { cred: credOf(cred) });
    return normalizeWorkItem(ref, payload, itemId, { webUrl: webUrlOf(ref, `_workitems/edit/${itemId}`) });
  }

  /** Not idempotent: a 5xx is not retried (it may have posted). */
  async function postComment(ref, id, markdown, cred) {
    const itemId = parseItemId(id);
    return request(`${projectApi(ref)}/wit/workItems/${itemId}/comments?format=markdown&api-version=${COMMENTS_API}`, {
      cred: credOf(cred),
      method: 'POST',
      body: { text: String(markdown) },
    });
  }

  /**
   * Rewrite System.Tags so exactly one `noemi:*` tag is left (the new one)
   * and every other tag is kept. One JSON Patch replaces the whole string,
   * so the item is never without a loop tag mid-way. `test /rev` makes the
   * write conditional: a concurrent edit (409/412) is re-read and retried
   * once, and a repeated PATCH after a lost response fails the test and
   * re-reads instead of clobbering. `add` is used only when the field is
   * absent: on Tags `add` MERGES, so it cannot remove a stale tag.
   */
  async function syncLoopLabel(ref, item, label, cred) {
    const itemId = parseItemId(item && (item.id !== undefined ? item.id : item.number));
    const auth = credOf(cred);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const fresh = await request(`${workItemApi(ref, itemId)}?api-version=${API}&$expand=none`, { cred: auth });
      const fields = (fresh && fresh.fields) || {};
      const raw = fields['System.Tags'];
      const current = splitTags(raw);
      const keep = current.filter((tag) => !tag.toLowerCase().startsWith('noemi:'));
      const next = label ? [...keep, label] : keep;
      if (sameTags(current, next)) return;
      try {
        await request(`${workItemApi(ref, itemId)}?api-version=${API}`, {
          cred: auth,
          method: 'PATCH',
          contentType: 'application/json-patch+json',
          idempotent: true,
          body: [
            { op: 'test', path: '/rev', value: fresh.rev },
            { op: typeof raw === 'string' ? 'replace' : 'add', path: '/fields/System.Tags', value: next.join('; ') },
          ],
        });
        return;
      } catch (err) {
        if (attempt === 0 && err && (err.status === 409 || err.status === 412)) continue;
        throw err;
      }
    }
  }

  async function resolveEntitlement({
    ref, tenant, env = process.env, deps = {},
  } = {}) {
    return resolveAdoEntitlement({
      ref,
      tenant,
      env,
      orgTenant: deps.orgTenant || orgTenantOf,
      resolveCredential: credentials.resolveCredential,
      request,
    });
  }

  /**
   * Group membership, not a repo role (requester.js explains why). The 4th
   * argument carries the run's env and entitlement so a client row's
   * `requester_group` applies.
   */
  async function requesterPermission(ref, login, cred, { env, entitlement } = {}) {
    return adoRequesterPermission({
      request, ref, login, cred: credOf(cred), env: env || envOf(), entitlement,
    });
  }

  /**
   * Everyone who set or changed the title or a body field (Description,
   * Repro Steps, Acceptance Criteria), the creator included, as identity ids.
   * A Stakeholder or any project member can edit the Description of another
   * person's work item, so `--requested-by-author` must not trust the text
   * just because the author is entitled: run.js checks each editor. Reads
   * every page of the updates history; an edit with no editor id, a missing
   * list or too many pages throws (run.js: trigger-unverified, fail closed).
   */
  async function bodyEditors(ref, item, cred) {
    const itemId = parseItemId(item && (item.id !== undefined ? item.id : item.number));
    const auth = credOf(cred);
    const editors = new Set();
    for (let page = 0; ; page += 1) {
      if (page >= MAX_UPDATE_PAGES) throw providerError('too many work item updates to verify the editors', 502, 'ado-updates-pages');
      const data = await request(
        `${projectApi(ref)}/wit/workItems/${itemId}/updates?$top=${UPDATES_PAGE}&$skip=${page * UPDATES_PAGE}&api-version=${API}`,
        { cred: auth },
      );
      const updates = data && Array.isArray(data.value) ? data.value : null;
      if (!updates) throw providerError('work item updates lookup returned no list', 502, 'ado-updates');
      for (const update of updates) {
        const fields = update && update.fields && typeof update.fields === 'object' ? Object.keys(update.fields) : [];
        if (!fields.some((field) => BODY_EDIT_FIELDS.includes(field.toLowerCase()))) continue;
        const id = update.revisedBy && typeof update.revisedBy.id === 'string' ? update.revisedBy.id.toLowerCase() : '';
        if (!isGuid(id)) throw providerError('a work item edit has no editor identity', 502, 'ado-update-editor');
        editors.add(id);
      }
      if (updates.length < UPDATES_PAGE) break;
    }
    return [...editors];
  }

  /** Exact `refs/heads/<name>` objectId, or null. The refs filter is a PREFIX match. */
  async function branchSha(ref, name, cred) {
    const data = await request(`${repoApi(ref)}/refs?filter=${encodeURIComponent(`heads/${name}`)}&api-version=${API}`, { cred });
    const full = `refs/heads/${name}`;
    const hit = (data && Array.isArray(data.value) ? data.value : []).find((entry) => entry && entry.name === full);
    return hit && typeof hit.objectId === 'string' ? hit.objectId.toLowerCase() : null;
  }

  async function listIntegrationBranches(ref, cred) {
    const auth = credOf(cred);
    for (const name of ['develop', 'dev']) {
      if (await branchSha(ref, name, auth)) return [name];
    }
    return [];
  }

  async function commitOf(ref, sha, cred) {
    const key = `${ref.key}@${sha}`;
    if (!commits.has(key)) {
      const commit = await request(`${repoApi(ref)}/commits/${encodeURIComponent(sha)}?api-version=${API}`, { cred });
      commits.set(key, commit);
    }
    return commits.get(key);
  }

  /** One tree level: name → { mode, objectId, type }. Trees are content-addressed, so cached. */
  async function treeLevel(ref, treeId, cred) {
    const key = `${ref.key}@${treeId}`;
    if (!trees.has(key)) {
      const tree = await request(`${repoApi(ref)}/trees/${encodeURIComponent(treeId)}?api-version=${API}`, { cred });
      const entries = tree && Array.isArray(tree.treeEntries) ? tree.treeEntries : [];
      trees.set(key, new Map(entries.map((entry) => [String(entry.relativePath), {
        mode: normalizeMode(entry.mode),
        objectId: String(entry.objectId || '').toLowerCase(),
        type: String(entry.gitObjectType || ''),
      }])));
    }
    return trees.get(key);
  }

  /**
   * What each path is in a tree: `{ entry }` (blob or tree at that path),
   * `{ entry: null }` (absent), or `{ blocked: true }` (a parent segment is a
   * file or a symlink, so the path cannot be a regular file).
   */
  async function pathsInTree(ref, rootTree, paths, cred) {
    const out = new Map();
    for (const filePath of paths) {
      const segments = filePath.split('/');
      let treeId = rootTree;
      let result = { entry: null };
      for (let i = 0; i < segments.length; i += 1) {
        const entry = (await treeLevel(ref, treeId, cred)).get(segments[i]) || null;
        if (!entry) { result = { entry: null }; break; }
        if (i === segments.length - 1) { result = { entry }; break; }
        if (entry.type !== 'tree') { result = { blocked: true }; break; }
        treeId = entry.objectId;
      }
      out.set(filePath, result);
    }
    return out;
  }

  /**
   * `{ content, mode }` for a regular text file, `{ missing: true }` on 404,
   * `{ notFile: true }` for a folder, binary, symlink or submodule. The items
   * API does not report the mode, so it is read from the branch's tree: a
   * symlink's "content" is its target, which must never reach the model as
   * if it were the file.
   */
  async function readFile(ref, filePath, gitRef, cred) {
    encodeRepoPath(String(filePath || ''));
    const auth = credOf(cred);
    let item;
    try {
      item = await request(
        `${repoApi(ref)}/items?path=${encodeURIComponent(`/${filePath}`)}`
        + `&versionDescriptor.version=${encodeURIComponent(gitRef)}&versionDescriptor.versionType=branch`
        + `&includeContent=true&$format=json&api-version=${API}`,
        { cred: auth },
      );
    } catch (err) {
      if (err && err.status === 404) return { missing: true };
      throw err;
    }
    if (!item || item.isFolder || item.gitObjectType !== 'blob' || typeof item.content !== 'string') return { notFile: true };
    if (item.contentMetadata && item.contentMetadata.isBinary) return { notFile: true };
    const head = await branchSha(ref, gitRef, auth);
    const commit = head ? await commitOf(ref, head, auth) : null;
    if (!commit || !commit.treeId) return { notFile: true };
    const found = (await pathsInTree(ref, String(commit.treeId).toLowerCase(), [filePath], auth)).get(filePath);
    const mode = found && found.entry && found.entry.type === 'blob' ? found.entry.mode : null;
    if (mode !== '100644' && mode !== '100755') return { notFile: true };
    return { content: item.content, mode };
  }

  /** A text file's content on `branch`, or null when it does not exist there. */
  async function baseText(ref, filePath, branch, cred) {
    try {
      const item = await request(
        `${repoApi(ref)}/items?path=${encodeURIComponent(`/${filePath}`)}`
        + `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`
        + `&includeContent=true&$format=json&api-version=${API}`,
        { cred },
      );
      return item && typeof item.content === 'string' ? item.content : null;
    } catch (err) {
      if (err && err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Folded paths of every pipeline YAML a build definition in this
   * repository runs, plus every same-repo `template:` file those YAMLs
   * include, nested (read from `base`). Cycles are skipped. More than
   * MAX_PIPELINE_YAML files is a lookup failure (fail closed). The union
   * in paths.js catches `*azure-pipelines*.yml` at any depth; a definition
   * can name any path (`build/pipeline.yml`), so the repository is asked.
   * Needs Build (read) on the producer (vso.build). Throws on any lookup
   * failure.
   */
  async function pipelineYamlPaths(ref, base, cred) {
    const repo = await request(`${repoApi(ref)}?api-version=${API}`, { cred });
    const repoId = repo && typeof repo.id === 'string' && isGuid(repo.id) ? repo.id : null;
    if (!repoId) throw providerError('repository id lookup failed', 502, 'ado-repo-id');
    const pipelines = new Set();
    let continuation = '';
    for (let page = 0; page < MAX_DEFINITION_PAGES; page += 1) {
      const query = `repositoryId=${encodeURIComponent(repoId)}&repositoryType=TfsGit&includeAllProperties=true&api-version=${API}`
        + (continuation ? `&continuationToken=${encodeURIComponent(continuation)}` : '');
      const { data, headers } = await request(`${projectApi(ref)}/build/definitions?${query}`, { cred, includeHeaders: true });
      if (!data || !Array.isArray(data.value)) throw providerError('build definitions lookup returned no list', 502, 'ado-build-definitions');
      for (const definition of data.value) {
        const yamlPath = pipelinePathOf(definition && definition.process && definition.process.yamlFilename);
        if (yamlPath) pipelines.add(yamlPath);
      }
      const next = headers && typeof headers.get === 'function' ? headers.get('x-ms-continuationtoken') : null;
      if (!next) break;
      if (page === MAX_DEFINITION_PAGES - 1) throw providerError('too many build definition pages', 502, 'ado-build-definitions');
      continuation = next;
    }
    const folded = new Set();
    const queue = [];
    const enqueue = (filePath) => {
      const key = foldForCarveOut(filePath);
      if (folded.has(key)) return;
      if (folded.size >= MAX_PIPELINE_YAML) {
        throw providerError('too many pipeline YAML files to resolve templates', 502, 'ado-pipeline-templates');
      }
      folded.add(key);
      queue.push(filePath);
    };
    for (const pipeline of pipelines) enqueue(pipeline);
    while (queue.length) {
      const current = queue.shift();
      const text = await baseText(ref, current, base, cred);
      if (!text) continue;
      for (const template of templateRefs(text, current)) enqueue(template);
    }
    return folded;
  }

  /**
   * After a ref conflict: the branch is ours from an earlier run only when
   * its head commit has exactly our parent and changes exactly our paths to
   * exactly our blob ids. Anything else (including a truncated change list)
   * is head-exists; it is never overwritten.
   */
  async function sameChangeAt(ref, headSha, baseSha, files, cred) {
    const commit = await commitOf(ref, headSha, cred);
    const parents = commit && Array.isArray(commit.parents) ? commit.parents.map((p) => String(p).toLowerCase()) : [];
    if (parents.length !== 1 || parents[0] !== baseSha) return false;
    const listed = await request(`${repoApi(ref)}/commits/${encodeURIComponent(headSha)}/changes?top=${MAX_CHANGES}&api-version=${API}`, { cred });
    const changes = (listed && Array.isArray(listed.changes) ? listed.changes : [])
      .filter((change) => change && change.item && !change.item.isFolder && change.item.gitObjectType !== 'tree');
    const counted = listed && listed.changeCounts
      ? Object.values(listed.changeCounts).reduce((sum, n) => sum + (Number(n) || 0), 0) : changes.length;
    if (counted > changes.length) return false;
    const expected = new Map(files.map((file) => [`/${file.path}`, gitBlobSha(file.content)]));
    if (changes.length !== expected.size) return false;
    return changes.every((change) => expected.get(String(change.item.path)) === String(change.item.objectId || '').toLowerCase());
  }

  /**
   * ONE push: one commit with `parents: [base]` and one ref update that
   * creates `head` (oldObjectId all zeros, so it can never move an existing
   * branch). Retrying the push on 5xx is safe for the same reason: if the
   * first attempt landed, the retry is a ref conflict and resolves to
   * `resumed` below.
   *
   * Executable bit: the push API takes no mode [unverified]. Editing a
   * 100755 file could silently make it non-executable, so it is refused
   * (`mode-unsupported`); a symlink is refused (`symlink-unsupported`), never
   * written through. New files are regular files.
   */
  async function commitFiles(ref, {
    base, head, files, message,
  } = {}, cred) {
    assertCommitFiles(files);
    assertBranchName(base);
    assertBranchName(head);
    const auth = credOf(cred);
    const refused = (reason) => ({ status: 'refused', reason, sha: null });
    if (files.some((file) => String(file.mode) === '100755')) return refused('mode-unsupported');

    const baseSha = await branchSha(ref, base, auth);
    if (!baseSha) return { status: 'missing-base', sha: null };
    const baseCommit = await commitOf(ref, baseSha, auth);
    if (!baseCommit || !baseCommit.treeId) return { status: 'missing-base', sha: null };
    const existing = await pathsInTree(ref, String(baseCommit.treeId).toLowerCase(), files.map((f) => f.path), auth);

    // A YAML file may be a pipeline definition (or a template one includes)
    // at a path no static list names. Only YAML plans pay for the lookup;
    // a failed lookup refuses (fail closed).
    if (files.some((file) => YAML_RE.test(file.path))) {
      let pipelines;
      try {
        pipelines = await pipelineYamlPaths(ref, base, auth);
      } catch {
        return refused('pipeline-lookup-failed');
      }
      if (files.some((file) => pipelines.has(foldForCarveOut(file.path)))) return refused('pipeline-yaml');
    }

    const changes = [];
    for (const file of files) {
      const found = existing.get(file.path);
      if (found.blocked) return refused('path-not-a-directory');
      const entry = found.entry;
      if (entry && entry.type !== 'blob') return refused('path-is-not-a-file');
      if (entry && entry.mode === '120000') return refused('symlink-unsupported');
      if (entry && entry.mode !== '100644') return refused('mode-unsupported');
      changes.push({
        changeType: entry ? 'edit' : 'add',
        item: { path: `/${file.path}` },
        newContent: { content: Buffer.from(file.content, 'utf8').toString('base64'), contentType: 'base64encoded' },
      });
    }

    try {
      const pushed = await request(`${repoApi(ref)}/pushes?api-version=${API}`, {
        cred: auth,
        method: 'POST',
        idempotent: true,
        body: {
          refUpdates: [{ name: `refs/heads/${head}`, oldObjectId: ZERO_SHA }],
          commits: [{ comment: String(message || ''), parents: [baseSha], changes }],
        },
      });
      const commitId = pushed && Array.isArray(pushed.commits) && pushed.commits[0] && pushed.commits[0].commitId;
      const newObjectId = pushed && Array.isArray(pushed.refUpdates) && pushed.refUpdates[0] && pushed.refUpdates[0].newObjectId;
      const sha = String(commitId || newObjectId || '');
      if (!sha) throw providerError('Stage C: Azure DevOps returned no commit id for the push.', 502);
      return { status: 'created', sha };
    } catch (err) {
      const conflict = err && (err.status === 409 || err.code === 'TF401028');
      if (!conflict) throw err;
      const headSha = await branchSha(ref, head, auth);
      if (!headSha) throw err;
      const same = await sameChangeAt(ref, headSha, baseSha, files, auth);
      return { status: same ? 'resumed' : 'head-exists', sha: headSha };
    }
  }

  /**
   * Auto-complete must not be on: the loop's PR waits for the reviewer.
   * Returns true when it was set (by the repo's "auto-complete by default")
   * and is now cleared; throws when it is set and cannot be cleared.
   */
  async function clearAutoComplete(ref, id, cred) {
    const url = `${repoApi(ref)}/pullrequests/${id}?api-version=${API}`;
    const current = await request(url, { cred });
    if (!hasAutoComplete(current)) return false;
    let after;
    try {
      after = await request(url, {
        cred, method: 'PATCH', idempotent: true, body: { autoCompleteSetBy: { id: ZERO_GUID } },
      });
    } catch (err) {
      throw providerError(
        `Pull request ${id} has auto-complete set and clearing it failed (${(err && err.status) || 'error'}); it could merge without review. Cancel auto-complete by hand.`,
        409,
        'ado-auto-complete-not-cleared',
      );
    }
    if (hasAutoComplete(after)) {
      throw providerError(
        `Pull request ${id} still has auto-complete set after clearing it; it could merge without review. Cancel auto-complete by hand.`,
        409,
        'ado-auto-complete-not-cleared',
      );
    }
    return true;
  }

  /** A 409 (TF401179: an active PR for this source and target exists) returns that PR. */
  async function openChangeRequest(ref, {
    base, head, title, body, itemId,
  } = {}, cred) {
    assertBranchName(base);
    assertBranchName(head);
    const auth = credOf(cred);
    const sourceRefName = `refs/heads/${head}`;
    const targetRefName = `refs/heads/${base}`;
    const { description, truncated } = truncateDescription(defuseItemMentions(body));
    let pr;
    let existing = false;
    try {
      pr = await request(`${repoApi(ref)}/pullrequests?api-version=${API}`, {
        cred: auth,
        method: 'POST',
        idempotent: true,
        body: {
          sourceRefName,
          targetRefName,
          title: String(title || '').slice(0, 400),
          description,
          workItemRefs: itemId ? [{ id: String(parseItemId(itemId)) }] : [],
        },
      });
    } catch (err) {
      if (!err || !(err.status === 409 || err.code === 'TF401179')) throw err;
      const open = await request(
        `${repoApi(ref)}/pullrequests?searchCriteria.sourceRefName=${encodeURIComponent(sourceRefName)}`
        + `&searchCriteria.targetRefName=${encodeURIComponent(targetRefName)}`
        + `&searchCriteria.status=active&api-version=${API}`,
        { cred: auth },
      );
      pr = open && Array.isArray(open.value) ? open.value[0] : null;
      if (!pr) throw err;
      existing = true;
    }
    const number = pr && pr.pullRequestId;
    if (!Number.isInteger(number)) throw providerError('Azure DevOps returned no pull request id.', 502);
    const cleared = await clearAutoComplete(ref, number, auth);
    return {
      url: webUrlOf(ref, `_git/${encodeURIComponent(ref.name)}/pullrequest/${number}`),
      number,
      existing,
      ...(cleared ? { autoCompleteCleared: true } : {}),
      ...(truncated ? { descriptionTruncated: true } : {}),
    };
  }

  return {
    id: ID,
    label: 'Azure DevOps',
    // Informational. The enforced list is the union in coding-loop/paths.js.
    // Pipeline YAML at a path no pattern names is refused by commitFiles
    // after a build-definition lookup (`pipeline-yaml`).
    carveOutHints: [
      'azure-pipelines.yml', 'azure-pipelines.yaml', 'ci/azure-pipelines.yml', '.vsts-ci.yml',
      '.azure-pipelines/', '.azuredevops/', '.pipelines/',
    ],
    capabilities: Object.freeze({ preservesMode: false }),
    credentialHelp: Object.freeze({
      conductor: 'ADO_CONDUCTOR_TOKEN, ADO_CONDUCTOR_CLIENT_ID with ADO_CONDUCTOR_CLIENT_SECRET or ADO_CONDUCTOR_FEDERATED_TOKEN_FILE, or ADO_CONDUCTOR_PAT (dev only)',
      reader: 'an ADO_CONDUCTOR_* credential, or ADO_READ_TOKEN / ADO_READ_PAT for a local read',
    }),
    parseRepo,
    parseItemId,
    itemDisplay,
    closingLine,
    branchForItem,
    resolveCredential: credentials.resolveCredential,
    whoAmI,
    expectedProducerLogin,
    getItem,
    postComment,
    syncLoopLabel,
    resolveEntitlement,
    requesterPermission,
    bodyEditors,
    listIntegrationBranches,
    readFile,
    commitFiles,
    openChangeRequest,
    isBotIdentity,
    itemScopeKey: (ref) => `${ID}:${ref.owner}/${ref.project}`.toLowerCase(),
    requesterOfItem: (item) => String((item && item.author && item.author.id) || ''),
  };
}

const provider = createAzureDevOpsProvider();

module.exports = {
  defuseItemMentions,
  API,
  COMMENTS_API,
  PR_DESCRIPTION_LIMIT,
  createAzureDevOpsProvider,
  fieldToMarkdown,
  gitBlobSha,
  isBotIdentity,
  normalizeWorkItem,
  pipelinePathOf,
  provider,
  templateRefs,
  truncateDescription,
};
