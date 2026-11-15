/**
 * Sprint 3 loader: fetch a persona over http(s). Returns the same
 * `{ markdown, source }` shape as loaders/file.js, so the persona then takes
 * exactly the same parse -> validate -> resolve path as a local file.
 *
 * A URL typed into Studio is attacker-influenced input, so this fails closed:
 *   - https only (plain http only for localhost, as in providers/gateway.js)
 *   - no credentials, query, or fragment in the URL (tokens must not end up in
 *     source.ref, the audit record, or an error message)
 *   - optional host allowlist
 *   - redirects are NOT followed (a redirect is how an allowed host becomes an
 *     internal one)
 *   - a timeout and a hard size cap, enforced while streaming
 *   - an HTML response is rejected (login pages, error pages)
 *
 * Every failure is an Error with code "LOAD"; compile.js turns it into a
 * structured stage "load" result. Messages never carry more than the URL.
 * This module reads no environment: callers pass `opts` (see config.js).
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 256 * 1024;

export function loadError(message) {
  const err = new Error(message);
  err.code = "LOAD";
  return err;
}

/** Parse and vet a persona URL. Throws LOAD. Exported for the registry loader and tests. */
export function checkUrl(raw, { allowedHosts = [] } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw loadError("Persona URL is not a valid URL.");
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw loadError("Persona URL must use https (http only for localhost).");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw loadError("Persona URL must not contain credentials, a query string, or a fragment.");
  }
  if (allowedHosts.length && !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw loadError(`Host "${url.hostname}" is not in the allowed host list.`);
  }
  return url;
}

async function readCapped(response, maxBytes) {
  const tooBig = () => loadError(`Persona is larger than the ${maxBytes}-byte limit.`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooBig();
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw tooBig();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * @param {string} rawUrl
 * @param {{ allowedHosts?: string[], timeoutMs?: number, maxBytes?: number }} [opts]
 * @returns {Promise<{ markdown: string, source: { kind: "http", ref: string } }>}
 */
export async function loadHttp(rawUrl, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES } = opts;
  const url = checkUrl(rawUrl, opts);

  let response;
  try {
    response = await fetch(url.href, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/markdown, text/plain;q=0.9" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === "TimeoutError") throw loadError(`Fetching ${url.href} timed out after ${timeoutMs} ms.`);
    throw loadError(`Fetching ${url.href} failed (network error).`);
  }

  if (response.status >= 300 && response.status < 400) {
    throw loadError(`Fetching ${url.href} returned a redirect (HTTP ${response.status}); redirects are not followed.`);
  }
  if (!response.ok) {
    throw loadError(`Fetching ${url.href} returned HTTP ${response.status}.`);
  }
  if (/\btext\/html\b/i.test(response.headers.get("content-type") ?? "")) {
    throw loadError(`${url.href} returned HTML, not a Markdown persona.`);
  }

  let markdown;
  try {
    markdown = await readCapped(response, maxBytes);
  } catch (err) {
    if (err.code === "LOAD") throw err;
    if (err?.name === "TimeoutError") throw loadError(`Reading ${url.href} timed out after ${timeoutMs} ms.`);
    throw loadError(`Reading ${url.href} failed.`);
  }
  return { markdown, source: { kind: "http", ref: url.href } };
}
