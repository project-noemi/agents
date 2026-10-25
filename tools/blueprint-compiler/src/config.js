import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Maps environment to model policy. Reads env at CALL time (tests mutate
// process.env per test), so never cache this at module load.
// AI_GW_* variables belong to providers/gateway.js (Section 2), not here.
export function loadModelPolicy(env = process.env) {
  return {
    // `||`, not `??`: an empty NOEMI_PREFERRED_PROVIDER="" must mean "unset".
    preferred: env.NOEMI_PREFERRED_PROVIDER?.trim() || "mock",
    fallbacks: (env.NOEMI_FALLBACK_PROVIDERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// How the chosen provider's model is called. Orthogonal to provider selection:
// `direct` posts to the gateway itself, `mastra` runs the same model as a Mastra
// agent. Same call-time rule; empty means unset.
export const RUNTIMES = ["direct", "mastra"];
export const loadRuntime = (env = process.env) => env.NOEMI_RUNTIME?.trim() || "direct";

// src/ -> blueprint-compiler/ -> tools/ -> repo root.
// resolve() drops the trailing separator so default and override roots look alike.
const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

// Root that skills/ and mcp-protocols/ resolve against. Same call-time rule.
// A relative NOEMI_REPO_ROOT resolves against the process cwd; prefer absolute.
export function loadResolverConfig(env = process.env) {
  const override = env.NOEMI_REPO_ROOT?.trim();
  return { repoRoot: override ? resolve(override) : DEFAULT_REPO_ROOT };
}

export const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/project-noemi/agents";
const DEFAULT_REGISTRY_VERSION = "main";
const DEFAULT_LOADER_TIMEOUT_MS = 10_000;
const DEFAULT_LOADER_MAX_BYTES = 256 * 1024;

function loaderInt(env, name, fallback) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    const err = new Error(`${name} must be a whole number >= 1; got "${raw}".`);
    err.code = "LOAD_CONFIG";
    throw err;
  }
  return n;
}

// Settings for loaders/http.js and loaders/registry.js. Loaders themselves never
// read the environment (AGENTS.md); compile.js hands them this. Same call-time
// rule as above. Throws code LOAD_CONFIG on a bad number, which compile.js turns
// into a structured stage "load" failure.
export function loadLoaderConfig(env = process.env) {
  return {
    // Optional host allowlist for http(s) personas. Empty means any https host:
    // set it before Studio lets a user type a URL (SSRF, see ARCHITECTURE.md).
    allowedHosts: (env.NOEMI_HTTP_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    timeoutMs: loaderInt(env, "NOEMI_LOADER_TIMEOUT_MS", DEFAULT_LOADER_TIMEOUT_MS),
    maxBytes: loaderInt(env, "NOEMI_LOADER_MAX_BYTES", DEFAULT_LOADER_MAX_BYTES),
    registry: {
      baseUrl: env.NOEMI_REGISTRY_URL?.trim() || DEFAULT_REGISTRY_URL,
      defaultVersion: env.NOEMI_REGISTRY_VERSION?.trim() || DEFAULT_REGISTRY_VERSION,
    },
  };
}
const DEFAULT_STUDIO_HOST = "127.0.0.1";
// Matches the Studio dev proxy default (studio/vite.config.ts).
const DEFAULT_STUDIO_PORT = 8787;
// Room for the largest persona the loaders accept plus JSON escaping and a prompt.
const DEFAULT_STUDIO_MAX_BODY_BYTES = 512 * 1024;

function serverError(message) {
  const err = new Error(message);
  err.code = "SERVER_CONFIG";
  return err;
}

// Settings for server.js. Same call-time rule as above. Throws SERVER_CONFIG.
// The Studio server lets a browser name a URL, so it refuses to start without
// a host allowlist: an empty NOEMI_HTTP_ALLOWED_HOSTS would mean any https host.
export function loadServerConfig(env = process.env) {
  let loader;
  try {
    loader = loadLoaderConfig(env);
  } catch (err) {
    throw serverError(err.message);
  }
  if (!loader.allowedHosts.length) {
    throw serverError("NOEMI_HTTP_ALLOWED_HOSTS must list at least one host before the Studio server starts.");
  }

  const port = env.NOEMI_STUDIO_PORT?.trim();
  if (port && !(/^\d+$/.test(port) && Number(port) <= 65535)) {
    throw serverError(`NOEMI_STUDIO_PORT must be a port number; got "${port}".`);
  }
  let maxBodyBytes;
  try {
    maxBodyBytes = loaderInt(env, "NOEMI_STUDIO_MAX_BODY_BYTES", DEFAULT_STUDIO_MAX_BODY_BYTES);
  } catch (err) {
    throw serverError(err.message);
  }

  // Optional single CORS origin, for a Studio served from somewhere other than
  // the Vite proxy. Unset means same-origin only.
  const rawOrigin = env.NOEMI_STUDIO_ORIGIN?.trim();
  let origin = null;
  if (rawOrigin) {
    try {
      origin = new URL(rawOrigin).origin;
    } catch {
      throw serverError(`NOEMI_STUDIO_ORIGIN must be an origin such as http://localhost:5173; got "${rawOrigin}".`);
    }
  }

  return {
    host: env.NOEMI_STUDIO_HOST?.trim() || DEFAULT_STUDIO_HOST,
    port: port ? Number(port) : DEFAULT_STUDIO_PORT,
    maxBodyBytes,
    origin,
    loader,
  };
}
