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

/** `google/gemini-x` and `gemini-x` are the same model: drop a leading `vendor/`. */
export const modelKey = (model) => String(model).trim().replace(/^[\w.-]+\//, "");

// Price table: USD per MILLION tokens, keyed by model id (any `vendor/` prefix is
// ignored). Checked against the providers' published list prices in Nov 2026.
// Add models here or, without editing code, set NOEMI_PRICE_TABLE to JSON of the
// same shape (entries there replace entries here):
//   {"<model id>":{"inputPerMTok":0.3,"outputPerMTok":2.5}}
// A model with no entry costs 0 in the scoreboard, and is refused outright while
// a daily cap is set. Known gaps: one flat rate per model, so cached-input
// discounts and xAI's higher rate above 200K-token prompts are not modelled.
// REVIEW ON 2027-01-01: Gemini 3.8 Flash's introductory price ends 2026-12-31 and
// doubles to $1.50 / $7.50.
export const DEFAULT_PRICES = {
  "mock-hello-world": { inputPerMTok: 0, outputPerMTok: 0 },
  "gemini-3.8-flash": { inputPerMTok: 0.75, outputPerMTok: 3.75 },
  "grok-4.6": { inputPerMTok: 2, outputPerMTok: 6 },
};

function priceError(message) {
  const err = new Error(message);
  err.code = "PROVIDER_CONFIG";
  return err;
}

const validPrice = (v) =>
  v && typeof v === "object" && [v.inputPerMTok, v.outputPerMTok].every((n) => Number.isFinite(n) && n >= 0);

/**
 * The price table as a Map of modelKey -> { inputPerMTok, outputPerMTok }.
 * Same call-time rule as above. Throws code PROVIDER_CONFIG on a bad
 * NOEMI_PRICE_TABLE; the message never repeats the value.
 */
export function loadPriceTable(env = process.env) {
  const table = new Map();
  const add = (model, price) => table.set(modelKey(model), {
    inputPerMTok: price.inputPerMTok,
    outputPerMTok: price.outputPerMTok,
  });
  for (const [model, price] of Object.entries(DEFAULT_PRICES)) add(model, price);

  const raw = env.NOEMI_PRICE_TABLE?.trim();
  if (!raw) return table;

  const shape =
    "NOEMI_PRICE_TABLE must be a JSON object of model id -> { inputPerMTok, outputPerMTok }, both numbers >= 0.";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw priceError(shape);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw priceError(shape);
  for (const [model, price] of Object.entries(parsed)) {
    if (!model.trim() || !validPrice(price)) throw priceError(shape);
    add(model, price);
  }
  return table;
}

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

// Like loaderInt but allows 0 (meaning "off") and names the setting in the error.
function wholeNumber(env, name, fallback, min = 0) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw serverError(`${name} must be a whole number >= ${min}; got "${raw}".`);
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
// Saved blueprints and run history live together in this one folder. It is
// git-ignored (see .gitignore). Tests point NOEMI_STUDIO_DATA_DIR at a temp folder.
const DEFAULT_DATA_DIR = resolve(fileURLToPath(new URL("../data", import.meta.url)));
const DEFAULT_MAX_BLUEPRINTS = 200;
const DEFAULT_MAX_RUNS = 500;
const DEFAULT_MAX_ARENA_RUNS = 500;
// Request throttle for the routes that call a model: this many requests per window.
// 0 turns it off. One shared window: Studio has one bearer token, not users.
const DEFAULT_THROTTLE_MAX = 30;
const DEFAULT_THROTTLE_WINDOW_MS = 60_000;
// 32 printable characters is ~190 bits from `openssl rand -base64 32`.
const MIN_STUDIO_TOKEN_CHARS = 32;

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

  let maxBlueprints;
  let maxRuns;
  try {
    maxBlueprints = loaderInt(env, "NOEMI_STUDIO_MAX_BLUEPRINTS", DEFAULT_MAX_BLUEPRINTS);
    maxRuns = loaderInt(env, "NOEMI_STUDIO_MAX_RUNS", DEFAULT_MAX_RUNS);
  } catch (err) {
    throw serverError(err.message);
  }
  // Shared bearer token every non-health route requires (AGENTS.md, Management
  // API Security). It is a secret: inject it with `infisical run` / `op run`.
  // Fail closed, like the allowlist above, and never echo the value.
  const token = env.NOEMI_STUDIO_TOKEN ?? "";
  if (!token) {
    throw serverError("NOEMI_STUDIO_TOKEN must be set before the Studio server starts.");
  }
  if (token.length < MIN_STUDIO_TOKEN_CHARS || !/^[\x21-\x7e]+$/.test(token)) {
    throw serverError(
      `NOEMI_STUDIO_TOKEN must be at least ${MIN_STUDIO_TOKEN_CHARS} printable characters with no spaces.`,
    );
  }

  let maxArenaRuns;
  try {
    maxArenaRuns = loaderInt(env, "NOEMI_STUDIO_MAX_ARENA_RUNS", DEFAULT_MAX_ARENA_RUNS);
  } catch (err) {
    throw serverError(err.message);
  }

  // Daily spending cap in USD. Unset means no cap. Counted in a calendar day of
  // NOEMI_SPEND_TIMEZONE (an IANA name such as America/Denver; default UTC).
  let dailyCapUsd = null;
  const rawCap = env.NOEMI_DAILY_SPEND_CAP_USD?.trim();
  if (rawCap) {
    dailyCapUsd = Number(rawCap);
    if (!Number.isFinite(dailyCapUsd) || dailyCapUsd <= 0) {
      throw serverError(`NOEMI_DAILY_SPEND_CAP_USD must be a number > 0; got "${rawCap}".`);
    }
  }
  const spendTimeZone = env.NOEMI_SPEND_TIMEZONE?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: spendTimeZone });
  } catch {
    throw serverError(`NOEMI_SPEND_TIMEZONE must be an IANA time zone such as America/Denver; got "${spendTimeZone}".`);
  }
  // A bad price table stops the server at startup, not on the first run.
  try {
    loadPriceTable(env);
  } catch (err) {
    throw serverError(err.message);
  }

  const throttleMax = wholeNumber(env, "NOEMI_THROTTLE_MAX_REQUESTS", DEFAULT_THROTTLE_MAX);
  const throttleWindowMs = wholeNumber(env, "NOEMI_THROTTLE_WINDOW_MS", DEFAULT_THROTTLE_WINDOW_MS, 1);

  const dataOverride = env.NOEMI_STUDIO_DATA_DIR?.trim();

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
    dataDir: dataOverride ? resolve(dataOverride) : DEFAULT_DATA_DIR,
    maxBlueprints,
    maxRuns,
    maxArenaRuns,
    dailyCapUsd,
    spendTimeZone,
    throttle: throttleMax > 0 ? { max: throttleMax, windowMs: throttleWindowMs } : null,
    origin,
    token,
    loader,
  };
}
