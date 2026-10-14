/**
 * Sprint 3 loader: a versioned persona registry. A registry ref is
 * `domain/name` with an optional `@version`:  coding/architect@2026.09.11
 *
 * ASSUMPTION (confirm with the client; the 5 August brief never fixed a
 * registry layout): the registry is the public repo itself, addressed by git
 * tag, because releases are already tagged YYYY.MM.DD. A ref maps to
 *
 *   {baseUrl}/{version}/agents/{domain}/{name}/core.md
 *
 * with baseUrl defaulting to https://raw.githubusercontent.com/project-noemi/agents
 * and version defaulting to "main" (config.js). Swapping in a real registry
 * service later only means changing registryUrl().
 *
 * The fetch itself is loaders/http.js, so a registry persona gets the same
 * https / no-redirect / size-cap / allowlist rules, then the same
 * validate -> resolve path as a local file. Refs and versions are matched
 * against strict patterns BEFORE any URL is built, so neither can add a path
 * segment, a query, or a host.
 */
import { loadError, loadHttp } from "./http.js";

const SEG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SEG = 64;
// A git tag or branch with no slash: 2026.09.11, v1.2.0, main.
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const cap = (s) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);

/**
 * Split and vet `domain/name[@version]`. Throws LOAD.
 * @returns {{ ref: string, version?: string }}
 */
export function parseRegistryRef(input) {
  const raw = String(input ?? "").trim();
  const at = raw.indexOf("@");
  const ref = at === -1 ? raw : raw.slice(0, at);
  const version = at === -1 ? undefined : raw.slice(at + 1);

  const parts = ref.split("/");
  if (parts.length !== 2 || !parts.every((p) => p.length <= MAX_SEG && SEG.test(p))) {
    throw loadError(`Registry ref "${cap(ref)}" is not a lowercase-hyphen domain/name.`);
  }
  if (version !== undefined && !VERSION.test(version)) {
    throw loadError(`Registry version "${cap(version)}" is not a tag or branch name.`);
  }
  return version === undefined ? { ref } : { ref, version };
}

/** The persona URL for a vetted ref. The one place that knows the layout. */
export function registryUrl({ ref, version }, { baseUrl, defaultVersion }) {
  const [domain, name] = ref.split("/");
  return `${baseUrl.replace(/\/+$/, "")}/${version ?? defaultVersion}/agents/${domain}/${name}/core.md`;
}

/**
 * @param {string} input `domain/name` or `domain/name@version`
 * @param {{ registry: { baseUrl: string, defaultVersion: string },
 *           allowedHosts?: string[], timeoutMs?: number, maxBytes?: number }} opts
 * @returns {Promise<{ markdown: string, source: { kind: "registry", ref: string, version: string } }>}
 */
export async function loadRegistry(input, opts) {
  const parsed = parseRegistryRef(input);
  const version = parsed.version ?? opts.registry.defaultVersion;
  const { markdown } = await loadHttp(registryUrl(parsed, opts.registry), opts);
  return { markdown, source: { kind: "registry", ref: parsed.ref, version } };
}
