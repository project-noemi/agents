'use strict';

/**
 * Forge provider registry.
 *
 * Providers are registered explicitly, here, at load time. There is no
 * directory scan: a file dropped into providers/ (or the documented
 * _template/) must never become a live forge by existing. Adding a forge is
 * one `registerProvider(require('./<id>').provider)` line below plus that
 * provider passing tests/helpers/provider-conformance.js.
 *
 * `--repo` resolution (parseRepoRef):
 *   - `provider:rest` (aliases: gh → github; ado, azdo → azure-devops) goes
 *     to that provider only. A known forge that is not registered in this
 *     build is a 400 "provider not available"; an unknown prefix is a 400.
 *   - A URL of a known forge that is not registered is the same 400.
 *   - Anything else is offered to every registered provider in
 *     registration order. github is first, so a bare `owner/name` keeps
 *     meaning GitHub.
 */

const {
  PROVIDER_ALIASES, assertProvider, canonicalProviderId, providerError, splitProviderPrefix,
} = require('./contract.js');

const REPO_USAGE = 'Need --repo owner/name (letters, digits, . _ - only).';

/** URL hosts of forges the loop knows about, for a clear "not available". */
const KNOWN_FORGE_HOSTS = [
  { re: /^https?:\/\/(?:[^/@]+@)?dev\.azure\.com\//i, provider: 'azure-devops' },
  { re: /^https?:\/\/(?:[^/@]+@)?[^/]+\.visualstudio\.com\//i, provider: 'azure-devops' },
  { re: /^https?:\/\/(?:[^/@]+@)?ssh\.dev\.azure\.com\//i, provider: 'azure-devops' },
];

const registry = new Map();

function registerProvider(p, { replace = false } = {}) {
  assertProvider(p);
  if (registry.has(p.id) && !replace) {
    throw providerError(`provider ${p.id} is already registered`, 409, 'provider-duplicate');
  }
  registry.set(p.id, p);
  return p;
}

/** Test seam: remove a provider registered by a test. */
function unregisterProvider(id) {
  return registry.delete(canonicalProviderId(id));
}

function notAvailable(id) {
  return providerError(
    `provider "${id}" is not available in this build of the coding loop. Registered: ${[...registry.keys()].join(', ') || 'none'}.`,
    400,
    'provider-not-available',
  );
}

function isKnownForge(id) {
  return Object.values(PROVIDER_ALIASES).includes(id);
}

function getProvider(id) {
  const canonical = canonicalProviderId(id);
  const found = registry.get(canonical);
  if (!found) throw notAvailable(canonical || String(id));
  return found;
}

function listProviders() {
  return [...registry.values()];
}

/**
 * Resolve an operator's `--repo` value to a RepoRef. Always returns a ref or
 * throws status 400; it never guesses a forge.
 */
function parseRepoRef(input, { env = process.env } = {}) {
  const text = String(input === undefined || input === null ? '' : input).trim();
  const prefixed = splitProviderPrefix(text);
  if (prefixed) {
    if (!registry.has(prefixed.provider)) {
      if (isKnownForge(prefixed.provider)) throw notAvailable(prefixed.provider);
      throw providerError(
        `unknown provider prefix "${prefixed.provider}". ${REPO_USAGE} Known: ${[...registry.keys()].join(', ')}.`,
        400,
        'provider-unknown',
      );
    }
    const ref = registry.get(prefixed.provider).parseRepo(text, { env });
    if (!ref) throw providerError(REPO_USAGE, 400, 'bad-repo');
    return ref;
  }
  for (const known of KNOWN_FORGE_HOSTS) {
    if (known.re.test(text) && !registry.has(known.provider)) throw notAvailable(known.provider);
  }
  for (const p of registry.values()) {
    const ref = p.parseRepo(text, { env });
    if (ref) return ref;
  }
  throw providerError(REPO_USAGE, 400, 'bad-repo');
}

registerProvider(require('./github/index.js').provider);

module.exports = {
  REPO_USAGE,
  getProvider,
  listProviders,
  parseRepoRef,
  registerProvider,
  unregisterProvider,
};
