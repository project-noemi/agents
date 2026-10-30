'use strict';

/**
 * GitHub forge provider (github.com and GitHub Enterprise Server).
 *
 * Built from the code the loop already ran: the REST calls, paths, retry
 * options and error handling are the ones run.js, dispatch.js, writer.js and
 * entitlement.js made before the provider seam existed, so a GitHub run is
 * byte-for-byte the same conversation with the API. scripts/github-client.js
 * stays where it is because scripts/review-pr.js shares it; this module
 * wraps it.
 *
 * Retry semantics come from gh(): GET retries on 5xx; a POST/DELETE retries
 * on 5xx only when the call passes `idempotent: true`. Comments are NOT
 * idempotent (a blind retry posted duplicates); label edits, content-
 * addressed git objects, and creates that resolve their own 422 are.
 *
 * GHES: pass `gh` bound to githubApiBase(env) (run.js does), or rely on the
 * default, which reads GITHUB_API_URL from process.env at call time.
 */

const { GITHUB_DOTCOM_API, gh, githubApiBase } = require('../../../scripts/github-client.js');
const { mintGithubAppInstallationToken } = require('../../../scripts/github-app-token.js');
const { resolveProducerToken } = require('../../../scripts/agent-token.js');
const { encodeRepoPath, isCarvedOut, isSafeRepoPath } = require('../../paths.js');
const { hiddenInMarkdown } = require('../../markup/html-to-markdown.js');
const { BOT_LOGINS } = require('../../intake.js');
const { makeRepoRef, providerError, splitProviderPrefix } = require('../contract.js');
const { findRepoInstallation, resolveGithubEntitlement } = require('./entitlement.js');

const ID = 'github';
const SLUG_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ITEM_ID_RE = /^[1-9][0-9]*$/;
const FILE_MODES = new Set(['100644', '100755']);

/**
 * A credential is an object whose token is NOT enumerable: JSON.stringify,
 * util.inspect and an accidental `...cred` in an audit line never carry it.
 */
function githubCredential(token, { role = 'reader', source = 'token' } = {}) {
  if (typeof token !== 'string' || token === '') return null;
  const cred = { provider: ID, role, source };
  Object.defineProperty(cred, 'token', { value: token, enumerable: false });
  return Object.freeze(cred);
}

/**
 * Bearer token for a call. A missing credential sends no token (GitHub
 * answers 401/404, which the caller already handles); a credential another
 * provider minted is refused outright.
 */
function tokenOf(cred) {
  if (cred === undefined || cred === null || cred === '') return undefined;
  if (typeof cred === 'string') return cred;
  if (cred.provider !== ID) {
    throw providerError('GitHub provider was handed another forge\'s credential.', 500, 'foreign-credential');
  }
  return cred.token;
}

function labelNames(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item.name === 'string') return item.name;
    return '';
  }).filter(Boolean);
}

/** login string, a REST `user` object, or a WorkItem author. */
function isBotIdentity(author) {
  if (!author) return false;
  if (typeof author === 'object' && author.isBot === true) return true;
  const login = String(typeof author === 'string' ? author : author.login || '').replace(/^@/, '').toLowerCase();
  const type = typeof author === 'object' ? String(author.type || '').toLowerCase() : '';
  if (type === 'bot') return true;
  if (login.endsWith('[bot]')) return true;
  return BOT_LOGINS.has(login);
}

/**
 * GitHub follows a renamed or transferred repository's redirect silently.
 * This is the `owner/name` the payload itself names, so the core can refuse
 * an item that now lives somewhere else.
 */
function issueRepoOf(payload) {
  const fromApi = /\/repos\/([^/]+)\/([^/]+)\/?$/.exec(String((payload && payload.repository_url) || ''));
  if (fromApi) return `${fromApi[1]}/${fromApi[2]}`;
  const fromHtml = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/(?:issues|pull)\/\d+/.exec(String((payload && payload.html_url) || ''));
  if (fromHtml) return `${fromHtml[1]}/${fromHtml[2]}`;
  return '';
}

/** The pre-provider intake shape; intake.issueFromGitHub delegates here. */
function issueFromPayload(repoFullName, payload) {
  const [org, repo] = String(repoFullName || '').split('/');
  const user = payload && payload.user ? payload.user : {};
  return {
    org,
    repo,
    number: payload && payload.number,
    author: user.login,
    author_type: user.type === 'Bot' ? 'bot' : 'user',
    title: payload && payload.title,
    body: payload && payload.body,
    labels: payload && payload.labels,
  };
}

/** REST issue payload → WorkItem. */
function normalizeItem(ref, payload, id) {
  const user = (payload && payload.user) || {};
  const actual = issueRepoOf(payload);
  const number = Number(id !== undefined ? id : payload && payload.number);
  const body = String((payload && payload.body) || '');
  const repoKey = actual ? `${ID}:${actual}`.toLowerCase() : '';
  return {
    provider: ID,
    id: String(number),
    number,
    org: ref.owner,
    project: null,
    repo: ref.name,
    title: String((payload && payload.title) || ''),
    body,
    bodyFormat: 'markdown',
    // GitHub renders inline HTML in issue bodies, so an HTML comment, a
    // `hidden` element or a title attribute is invisible to the person who
    // reads the issue but is fed to the model with the body. The body is
    // left exactly as written; the invisible part is copied to hiddenText so
    // it is scanned and fingerprinted on its own.
    hiddenText: hiddenInMarkdown(body),
    author: {
      id: user.id === undefined ? null : user.id,
      login: String(user.login || ''),
      isBot: isBotIdentity(user),
    },
    labels: labelNames(payload && payload.labels),
    updatedAt: (payload && payload.updated_at) || null,
    version: (payload && payload.updated_at) || null,
    url: (payload && payload.html_url) || null,
    repoKey,
    // A GitHub issue belongs to the repository itself.
    scopeKey: repoKey,
  };
}

/** `refs/heads/<name>` as a URL path: each segment encoded, slashes kept. */
function refPath(branch) {
  return encodeRepoPath(String(branch));
}

async function treeShaOfCommit(call, slug, sha, token) {
  const commit = await call(`/repos/${slug}/git/commits/${encodeURIComponent(sha)}`, { token });
  return commit && commit.tree && commit.tree.sha;
}

/**
 * Mode of each path that already exists as a blob in the base tree. Walks
 * one directory level per call (cached per tree) instead of a recursive
 * listing, which GitHub truncates on large repositories. Only a regular
 * blob's mode is carried over (see commitFiles).
 */
async function baseBlobModes(call, slug, rootTree, paths, token) {
  const cache = new Map();
  const entriesOf = async (sha) => {
    if (!cache.has(sha)) {
      const tree = await call(`/repos/${slug}/git/trees/${encodeURIComponent(sha)}`, { token });
      const list = tree && Array.isArray(tree.tree) ? tree.tree : [];
      cache.set(sha, new Map(list.map((entry) => [entry.path, entry])));
    }
    return cache.get(sha);
  };
  const modes = new Map();
  for (const filePath of paths) {
    const segments = filePath.split('/');
    let sha = rootTree;
    let entry = null;
    for (let i = 0; i < segments.length; i += 1) {
      entry = (await entriesOf(sha)).get(segments[i]) || null;
      if (!entry) break;
      if (i < segments.length - 1) {
        if (entry.type !== 'tree') { entry = null; break; }
        sha = entry.sha;
      }
    }
    if (entry && entry.type === 'blob') modes.set(filePath, String(entry.mode));
  }
  return modes;
}

/**
 * Defence in depth: dispatch already refuses these before any network call,
 * but the provider is the last code before a forge write and must not trust
 * its caller to have checked.
 */
function assertCommitFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw providerError('commitFiles needs at least one file.', 400, 'empty-commit');
  }
  for (const file of files) {
    const filePath = file && file.path;
    if (!isSafeRepoPath(filePath) || isCarvedOut(filePath) || typeof file.content !== 'string') {
      throw providerError('commitFiles refused an unsafe, carved-out or non-text file.', 400, 'unsafe-commit-path');
    }
    if (file.mode !== undefined && !FILE_MODES.has(String(file.mode))) {
      throw providerError('commitFiles accepts only regular (100644) or executable (100755) files.', 400, 'unsafe-commit-mode');
    }
  }
}

/**
 * @param {object} [opts]
 * @param {Function} [opts.gh]        (path, { token, method, body, idempotent }) → JSON. Defaults to
 *                                    scripts/github-client.js gh() against githubApiBase(process.env).
 * @param {Function} [opts.fetchImpl] fetch for the default gh() and the App installation lookup.
 * @param {Function} [opts.mint]      GitHub App installation-token minter (tests).
 */
function createGithubProvider({ gh: ghImpl, fetchImpl, mint } = {}) {
  const call = ghImpl || ((p, opts = {}) => gh(p, {
    apiBase: githubApiBase(process.env), ...(fetchImpl ? { fetchImpl } : {}), ...opts,
  }));

  function parseRepo(input, { env = process.env } = {}) {
    let text = String(input === undefined || input === null ? '' : input).trim();
    const prefixed = splitProviderPrefix(text);
    if (prefixed) {
      if (prefixed.provider !== ID) return null;
      text = prefixed.rest.trim();
    }
    const apiBase = githubApiBase(env);
    const ghesHost = apiBase === GITHUB_DOTCOM_API ? null : new URL(apiBase).host.toLowerCase();
    let host = ghesHost || 'github.com';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
      let url;
      try {
        url = new URL(text);
      } catch {
        return null;
      }
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
      // Only the host this process will call. A github.com URL while
      // GITHUB_API_URL points at GHES would be looked up on the wrong forge.
      const allowed = ghesHost ? [ghesHost] : ['github.com', 'www.github.com'];
      if (!allowed.includes(url.host.toLowerCase())) return null;
      host = ghesHost || 'github.com';
      const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.pathname);
      if (!match) return null;
      text = `${match[1]}/${match[2]}`;
    }
    if (!SLUG_RE.test(text) || text.includes('..')) return null;
    const [owner, name] = text.split('/');
    return makeRepoRef({
      provider: ID, host, owner, project: null, name,
    });
  }

  function parseItemId(input) {
    const text = String(input === undefined || input === null ? '' : input);
    if (!ITEM_ID_RE.test(text)) {
      throw providerError('Need --issue N (positive integer).', 400, 'bad-item-id');
    }
    return text;
  }

  function itemDisplay(ref, id) {
    return `${ref.slug}#${id}`;
  }

  function closingLine(id, { closes = true } = {}) {
    return `${closes ? 'Closes' : 'Part of'} #${id}`;
  }

  function branchForItem(id) {
    return `noemi/issue-${id}`;
  }

  function expectedProducerLogin(env = process.env) {
    return (env && env.AGENT_GH_EXPECTED_LOGIN) || 'noemi-agent';
  }

  /**
   * Identity split (docs/MACHINE_IDENTITY.md):
   *   conductor  CONDUCTOR_GH_TOKEN, else an App installation token for the
   *              repo owner; null when neither is configured.
   *   producer   scripts/agent-token.js rules (AGENT_GH_TOKEN, or
   *              AGENT_GH_TOKEN_CLASSIC under AGENT_GH_USE_CLASSIC with no
   *              fallback). Throws when missing, and when it IS the
   *              conductor token.
   *   reader     the conductor, else GH_TOKEN / GITHUB_TOKEN (local reads).
   */
  async function resolveCredential({
    role, ref, env = process.env, deps = {},
  } = {}) {
    const mintToken = deps.mintToken || deps.mint || mint || mintGithubAppInstallationToken;
    const conductor = async () => {
      if (env && env.CONDUCTOR_GH_TOKEN) {
        return githubCredential(env.CONDUCTOR_GH_TOKEN, { role: 'conductor', source: 'CONDUCTOR_GH_TOKEN' });
      }
      if (env && env.CONDUCTOR_APP_ID && env.CONDUCTOR_APP_PRIVATE_KEY) {
        const token = await mintToken({
          appId: env.CONDUCTOR_APP_ID,
          privateKey: env.CONDUCTOR_APP_PRIVATE_KEY,
          owner: ref && ref.owner,
          apiBase: githubApiBase(env),
        });
        return githubCredential(token, { role: 'conductor', source: 'CONDUCTOR_APP' });
      }
      return null;
    };
    if (role === 'conductor') return conductor();
    if (role === 'producer') {
      const { token, source } = resolveProducerToken(env);
      if (env && env.CONDUCTOR_GH_TOKEN && token === env.CONDUCTOR_GH_TOKEN) {
        throw providerError(
          'Stage C refuses the conductor token as the producer (identity split). Set AGENT_GH_TOKEN to the noemi-agent token.',
          400,
          'producer-is-conductor',
        );
      }
      return githubCredential(token, { role: 'producer', source });
    }
    if (role === 'reader') {
      const viaConductor = await conductor();
      if (viaConductor) return viaConductor;
      if (env && env.GH_TOKEN) return githubCredential(env.GH_TOKEN, { role: 'reader', source: 'GH_TOKEN' });
      if (env && env.GITHUB_TOKEN) return githubCredential(env.GITHUB_TOKEN, { role: 'reader', source: 'GITHUB_TOKEN' });
      return null;
    }
    throw providerError(`unknown credential role: ${role}`, 400, 'bad-role');
  }

  /**
   * The credential's user. A conductor App installation token (minted from
   * CONDUCTOR_APP_*, or a `ghs_` token in CONDUCTOR_GH_TOKEN) has no user
   * (`GET /user` answers 403); it is reported as an installation, which can
   * never be the producer's user (dispatch's runtime identity split).
   */
  async function whoAmI(ref, cred) {
    const installation = cred && typeof cred === 'object' && cred.role === 'conductor'
      && (cred.source === 'CONDUCTOR_APP' || /^ghs_/.test(String(cred.token || '')));
    if (installation) {
      return { id: null, login: '', appInstallation: true };
    }
    const actor = await call('/user', { token: tokenOf(cred) });
    return { id: actor && actor.id !== undefined ? actor.id : null, login: (actor && actor.login) || '' };
  }

  async function getItem(ref, id, cred) {
    const payload = await call(`/repos/${ref.slug}/issues/${id}`, { token: tokenOf(cred) });
    return normalizeItem(ref, payload, id);
  }

  /** Not idempotent: a 5xx is not retried (it may have posted). */
  async function postComment(ref, id, markdown, cred) {
    return call(`/repos/${ref.slug}/issues/${id}/comments`, {
      token: tokenOf(cred),
      method: 'POST',
      body: { body: markdown },
    });
  }

  /**
   * Add the new loop label FIRST, then remove the stale ones. If a call fails
   * part-way the issue still carries the current state (plus a stale label the
   * next sync removes), never no loop label at all. Both calls are safe to
   * repeat (adding a present label is a no-op; a repeated DELETE is a 404,
   * ignored), so they opt in to retry on 5xx.
   */
  async function syncLoopLabel(ref, item, label, cred) {
    const token = tokenOf(cred);
    const number = item && (item.id !== undefined ? item.id : item.number);
    const names = labelNames(item && item.labels);
    if (label && !names.includes(label)) {
      await call(`/repos/${ref.slug}/issues/${number}/labels`, {
        token,
        method: 'POST',
        idempotent: true,
        body: { labels: [label] },
      });
    }
    for (const name of names) {
      if (!name.startsWith('noemi:') || name === label) continue;
      const encoded = encodeURIComponent(name);
      try {
        await call(`/repos/${ref.slug}/issues/${number}/labels/${encoded}`, { token, method: 'DELETE', idempotent: true });
      } catch (err) {
        if (!err || err.status !== 404) throw err;
      }
    }
  }

  async function resolveEntitlement({
    ref, tenant, env = process.env, deps = {},
  } = {}) {
    return resolveGithubEntitlement({
      ref,
      tenant,
      env,
      fetchImpl: deps.fetchImpl || fetchImpl || globalThis.fetch,
      apiBase: deps.apiBase || githubApiBase(env),
    });
  }

  /** 404 is `none`; any other failure is `{ login, error }` (intake refuses). */
  async function requesterPermission(ref, login, cred) {
    if (!login) return null;
    try {
      const res = await call(
        `/repos/${ref.slug}/collaborators/${encodeURIComponent(login)}/permission`,
        { token: tokenOf(cred) },
      );
      return { login, permission: (res && res.permission) || 'none' };
    } catch (err) {
      if (err && err.status === 404) return { login, permission: 'none' };
      return { login, error: err && err.message };
    }
  }

  /**
   * Exact single-ref reads (git/ref, not the prefix-matching
   * git/matching-refs) in preference order; the first that exists wins.
   */
  async function listIntegrationBranches(ref, cred) {
    const token = tokenOf(cred);
    for (const name of ['develop', 'dev']) {
      try {
        const found = await call(`/repos/${ref.slug}/git/ref/heads/${name}`, { token });
        if (found && !Array.isArray(found) && found.ref === `refs/heads/${name}`) return [name];
      } catch (err) {
        if (!err || err.status !== 404) throw err;
      }
    }
    return [];
  }

  /**
   * `{ content, mode }` for a text file, `{ missing: true }` on 404, and
   * `{ notFile: true }` for a directory, symlink or submodule. The contents
   * API does not report the git mode, so `mode` is null here; commitFiles
   * reads modes from the base tree itself.
   */
  async function readFile(ref, filePath, gitRef, cred) {
    const encoded = encodeRepoPath(String(filePath || ''));
    let payload;
    try {
      payload = await call(`/repos/${ref.slug}/contents/${encoded}?ref=${encodeURIComponent(gitRef)}`, { token: tokenOf(cred) });
    } catch (err) {
      if (err && err.status === 404) return { missing: true };
      throw err;
    }
    if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') {
      return { notFile: true };
    }
    return { content: Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8'), mode: null };
  }

  /**
   * ONE commit, created atomically through the Git Data API. Blobs (as tree
   * content), trees and commits are invisible until a ref points at them, so
   * the branch ref is created LAST: either the whole change is visible, or
   * nothing is. Trees and commits are content-addressed, so `idempotent:
   * true` only ever makes an unreferenced object.
   *
   * A file that already exists keeps its mode from the base tree: an
   * executable script (100755) stays executable. Only 100644/100755 are ever
   * written. A symlink (120000) at the path is replaced by a regular file,
   * never preserved: preserving it would turn model-written content into a
   * link target that could point at a carve-out.
   *
   * A 422 on the ref means the branch exists. Same tree as ours → an earlier
   * run got this far: `resumed`. Different tree → `head-exists`; never
   * overwritten.
   */
  async function commitFiles(ref, {
    base, head, files, message,
  } = {}, cred) {
    assertCommitFiles(files);
    const token = tokenOf(cred);
    const slug = ref.slug;
    const baseRef = await call(`/repos/${slug}/git/ref/heads/${refPath(base)}`, { token });
    const baseSha = baseRef && baseRef.object && baseRef.object.sha;
    if (!baseSha) return { status: 'missing-base', sha: null };
    const baseTree = await treeShaOfCommit(call, slug, baseSha, token);
    if (!baseTree) return { status: 'missing-base', sha: null };

    const modes = await baseBlobModes(call, slug, baseTree, files.map((file) => file.path), token);
    const tree = await call(`/repos/${slug}/git/trees`, {
      token,
      method: 'POST',
      idempotent: true,
      body: {
        base_tree: baseTree,
        tree: files.map((file) => ({
          path: file.path,
          mode: file.mode ? String(file.mode) : (modes.get(file.path) === '100755' ? '100755' : '100644'),
          type: 'blob',
          content: file.content,
        })),
      },
    });
    const treeSha = tree && tree.sha;
    if (!treeSha) throw providerError('Stage C: GitHub returned no tree sha.', 502);

    const commit = await call(`/repos/${slug}/git/commits`, {
      token,
      method: 'POST',
      idempotent: true,
      body: { message, tree: treeSha, parents: [baseSha] },
    });
    const commitSha = commit && commit.sha;
    if (!commitSha) throw providerError('Stage C: GitHub returned no commit sha.', 502);

    try {
      await call(`/repos/${slug}/git/refs`, {
        token,
        method: 'POST',
        idempotent: true,
        body: { ref: `refs/heads/${head}`, sha: commitSha },
      });
    } catch (err) {
      if (!err || err.status !== 422) throw err;
      let existingSha = null;
      let existingTree = null;
      try {
        const existing = await call(`/repos/${slug}/git/ref/heads/${refPath(head)}`, { token });
        existingSha = existing && existing.object && existing.object.sha;
        existingTree = existingSha ? await treeShaOfCommit(call, slug, existingSha, token) : null;
      } catch (lookupErr) {
        if (!lookupErr || lookupErr.status !== 404) throw lookupErr;
      }
      if (!existingTree || existingTree !== treeSha) return { status: 'head-exists', sha: existingSha || null };
      return { status: 'resumed', sha: existingSha };
    }
    return { status: 'created', sha: commitSha };
  }

  /** A 422 means a PR for this head exists; return it (`existing: true`). */
  async function openChangeRequest(ref, {
    base, head, title, body,
  } = {}, cred) {
    const token = tokenOf(cred);
    try {
      const pr = await call(`/repos/${ref.slug}/pulls`, {
        token,
        method: 'POST',
        idempotent: true,
        body: {
          title, head, base, body,
        },
      });
      return { url: pr && pr.html_url, number: pr && pr.number, existing: false };
    } catch (err) {
      if (!err || err.status !== 422) throw err;
      const open = await call(
        `/repos/${ref.slug}/pulls?state=open&head=${encodeURIComponent(`${ref.owner}:${head}`)}`,
        { token },
      );
      const pr = Array.isArray(open) ? open[0] : null;
      if (!pr) throw err;
      return { url: pr.html_url, number: pr.number, existing: true };
    }
  }

  return {
    id: ID,
    label: 'GitHub',
    // Informational. The enforced list is the union in coding-loop/paths.js.
    carveOutHints: ['.github/workflows/', '.github/actions/', '.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'],
    parseRepo,
    parseItemId,
    itemDisplay,
    closingLine,
    branchForItem,
    resolveCredential,
    whoAmI,
    expectedProducerLogin,
    getItem,
    postComment,
    syncLoopLabel,
    resolveEntitlement,
    requesterPermission,
    listIntegrationBranches,
    readFile,
    commitFiles,
    openChangeRequest,
    isBotIdentity,
    itemScopeKey: (ref) => ref.key,
    requesterOfItem: (item) => String((item && item.author && item.author.login) || ''),
  };
}

const provider = createGithubProvider();

module.exports = {
  createGithubProvider,
  findRepoInstallation,
  githubCredential,
  isBotIdentity,
  issueFromPayload,
  issueRepoOf,
  normalizeItem,
  provider,
};
