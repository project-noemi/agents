'use strict';

/**
 * The forge provider contract for the issue-coding loop.
 *
 * The loop's verdicts (skip / refuse / needs-info / accepted / carve-out,
 * identity split, scan, budget) live in coding-loop/*.js and are the same
 * for every forge. A provider owns only the forge I/O: how a repository is
 * named, how an item is read, how a comment, a label, a commit and a change
 * request are written. Adding a forge must never mean editing intake.js.
 *
 * Every I/O method is async. `cred` is an opaque object the same provider's
 * resolveCredential produced; the core never opens it, logs it, or builds a
 * header from it.
 *
 * This module has no dependencies so intake.js, the registry and every
 * provider can share the RepoRef helpers without an import cycle.
 */

/**
 * @typedef {object} RepoRef
 * @property {string} provider   canonical provider id (`github`, `azure-devops`)
 * @property {string} host       forge host (`github.com`, a GHES host, `dev.azure.com`)
 * @property {string} owner      org / user / ADO organization
 * @property {string|null} project  ADO project; null on forges without one
 * @property {string} name       repository name
 * @property {string} slug       human path: `owner/name` or `org/project/repo`
 * @property {string} key        `${provider}:${slug}`, lowercased. Compare refs with this.
 */

/**
 * @typedef {object} WorkItem
 * @property {string} provider
 * @property {string} id          positive integer string
 * @property {number} number      Number(id)
 * @property {string} org         RepoRef.owner
 * @property {string|null} project
 * @property {string} repo        RepoRef.name
 * @property {string} title
 * @property {string} body
 * @property {'markdown'} bodyFormat  providers convert to markdown before returning
 * @property {string} hiddenText  text a human reader may not see (HTML comments,
 *   hidden fields) that a model could still be fed. Scanned with the body.
 * @property {{ id: (string|number|null), login: string, isBot: boolean }} author
 * @property {string[]} labels
 * @property {string|null} updatedAt
 * @property {(string|number|null)} version  forge revision marker (informational)
 * @property {string|null} url
 * @property {string} repoKey     RepoRef.key of the repository the FORGE says the
 *   item lives in (not the one we asked for). A mismatch means a rename or
 *   transfer redirect; the loop refuses.
 */

/**
 * @typedef {object} Credential  opaque; produced by provider.resolveCredential.
 * @property {string} provider
 * @property {'conductor'|'producer'|'reader'} role
 * @property {string} source     env var or mechanism name, never the secret
 */

/**
 * Permissions a provider may report from requesterPermission. GitHub's
 * `maintain` is kept as-is (intake's WRITE_PERMISSIONS includes it); other
 * forges map onto admin | write | read | none.
 */
const PERMISSIONS = Object.freeze(['admin', 'maintain', 'write', 'read', 'none']);

/** commitFiles outcomes. `missing-base` = the base branch has no commit. */
const COMMIT_STATUSES = Object.freeze(['created', 'resumed', 'head-exists', 'missing-base']);

/** Required properties and their typeof. */
const PROVIDER_PROPS = Object.freeze({
  id: 'string',
  label: 'string',
  carveOutHints: 'array',
});

/** Required methods, in the order a run calls them. */
const PROVIDER_METHODS = Object.freeze([
  'parseRepo',
  'parseItemId',
  'itemDisplay',
  'closingLine',
  'branchForItem',
  'resolveCredential',
  'whoAmI',
  'expectedProducerLogin',
  'getItem',
  'postComment',
  'syncLoopLabel',
  'resolveEntitlement',
  'requesterPermission',
  'listIntegrationBranches',
  'readFile',
  'commitFiles',
  'openChangeRequest',
  'isBotIdentity',
]);

const PROVIDER_ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Short names an operator may type. Kept here (not in the registry) so a
 * tenant entry `ado:contoso` matches the same way the CLI parses `ado:…`.
 */
const PROVIDER_ALIASES = Object.freeze({
  gh: 'github',
  github: 'github',
  ado: 'azure-devops',
  azdo: 'azure-devops',
  'azure-devops': 'azure-devops',
});

function providerError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

/** Canonical provider id for an alias, or the lowercased input when unknown. */
function canonicalProviderId(id) {
  const lower = String(id || '').trim().toLowerCase();
  return PROVIDER_ALIASES[lower] || lower;
}

/**
 * Throws (status 500, code provider-contract) naming every missing or
 * mistyped member, so a half-written provider fails at registration, not
 * in the middle of a run that already posted a comment.
 */
function assertProvider(p) {
  if (!p || typeof p !== 'object') {
    throw providerError('provider contract: not an object', 500, 'provider-contract');
  }
  const problems = [];
  for (const [prop, type] of Object.entries(PROVIDER_PROPS)) {
    const value = p[prop];
    const ok = type === 'array' ? Array.isArray(value) : typeof value === type && value !== '';
    if (!ok) problems.push(`${prop} must be a ${type === 'array' ? 'array' : `non-empty ${type}`}`);
  }
  if (typeof p.id === 'string' && !PROVIDER_ID_RE.test(p.id)) {
    problems.push('id must be lowercase letters, digits and -');
  }
  for (const method of PROVIDER_METHODS) {
    if (typeof p[method] !== 'function') problems.push(`${method} must be a function`);
  }
  if (problems.length > 0) {
    throw providerError(`provider contract (${p.id || 'unnamed'}): ${problems.join('; ')}`, 500, 'provider-contract');
  }
  return p;
}

/** Build a RepoRef; the only place slug and key are derived. */
function makeRepoRef({
  provider, host, owner, project = null, name,
}) {
  const id = canonicalProviderId(provider);
  const slug = project ? `${owner}/${project}/${name}` : `${owner}/${name}`;
  return Object.freeze({
    provider: id,
    host: String(host || ''),
    owner: String(owner),
    project: project ? String(project) : null,
    name: String(name),
    slug,
    key: `${id}:${slug}`.toLowerCase(),
  });
}

/** `provider:rest` → { provider, rest }, or null when there is no prefix. URLs are not prefixes. */
function splitProviderPrefix(input) {
  const match = /^([A-Za-z][A-Za-z0-9-]*):(?!\/\/)(.*)$/s.exec(String(input || '').trim());
  if (!match) return null;
  return { provider: canonicalProviderId(match[1]), rest: match[2] };
}

/**
 * The fields of a RepoRef that tenant matching needs, from either a RepoRef
 * or an intake issue (`{ org, repo, provider?, project? }`; provider defaults
 * to github, which is every caller before providers existed).
 */
function matchTarget(refOrIssue) {
  if (!refOrIssue) return null;
  if (refOrIssue.key && refOrIssue.slug) return refOrIssue;
  const owner = refOrIssue.org;
  if (!owner) return null;
  // A missing repo name still matches an `orgs` entry (as it always did);
  // it can never match a `repos` allowlist entry.
  return makeRepoRef({
    provider: refOrIssue.provider || 'github',
    host: '',
    owner,
    project: refOrIssue.project || null,
    name: refOrIssue.repo === undefined || refOrIssue.repo === null ? '' : refOrIssue.repo,
  });
}

/**
 * Tenant `orgs` entry match. A bare entry is a GitHub owner and compares
 * exactly, as it always did. A prefixed entry (`azure-devops:contoso`)
 * compares case-insensitively on the canonical provider id and the owner.
 */
function ownerEntryMatches(entry, target) {
  if (typeof entry !== 'string' || !target) return false;
  const prefixed = splitProviderPrefix(entry);
  if (!prefixed) return target.provider === 'github' && entry === target.owner;
  return prefixed.provider === target.provider
    && prefixed.rest.toLowerCase() === String(target.owner).toLowerCase();
}

/**
 * `limits.repos` / registry `repos` entry match. A bare entry is a GitHub
 * slug and compares exactly (unchanged). A prefixed entry is a full key and
 * compares against RepoRef.key (lowercase).
 */
function repoEntryMatches(entry, target) {
  if (typeof entry !== 'string' || !target) return false;
  const prefixed = splitProviderPrefix(entry);
  if (!prefixed) return target.provider === 'github' && entry === target.slug;
  return `${prefixed.provider}:${prefixed.rest}`.toLowerCase() === target.key;
}

module.exports = {
  COMMIT_STATUSES,
  PERMISSIONS,
  PROVIDER_ALIASES,
  PROVIDER_ID_RE,
  PROVIDER_METHODS,
  PROVIDER_PROPS,
  assertProvider,
  canonicalProviderId,
  makeRepoRef,
  matchTarget,
  ownerEntryMatches,
  providerError,
  repoEntryMatches,
  splitProviderPrefix,
};
