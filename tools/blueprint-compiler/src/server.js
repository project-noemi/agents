#!/usr/bin/env node
/**
 * Sprint 4 Studio server: the one place a browser reaches the compiler.
 * Routes and event shapes follow studio/src/api/http.ts and types.ts.
 *
 *   GET    /api/health            { ok: true }
 *   GET    /api/providers         { providers, runtimes }
 *   POST   /api/validate          { input } -> JSON
 *   POST   /api/run               { input, prompt, provider?, runtime?, blueprintId? } -> SSE
 *   POST   /api/arena             { blueprintId, prompt } -> SSE (Sprint 5, every provider at once)
 *   GET    /api/runs[?limit=N]    run history, newest first
 *   GET    /api/arena/runs[?limit=N]   saved Arena runs, newest first
 *   GET    /api/arena/scoreboard  one row per provider, totalled over the saved Arena runs
 *   GET    /api/blueprints        saved blueprints (summaries)
 *   POST   /api/blueprints        { name, markdown } -> 201 saved blueprint
 *   GET    /api/blueprints/:id    one saved blueprint
 *   PUT    /api/blueprints/:id    { name, markdown }
 *   PATCH  /api/blueprints/:id    { name }  (rename)
 *   DELETE /api/blueprints/:id    204
 *
 * `input` is { kind: "text", markdown } | { kind: "url", url } | { kind: "registry", ref }.
 *
 * Trust boundary:
 *   - Gateway keys stay in this process's environment.
 *   - NOEMI_HTTP_ALLOWED_HOSTS and NOEMI_STUDIO_TOKEN are required at startup.
 *   - Every route except GET /api/health needs `Authorization: Bearer <token>`;
 *     anything else is a 401 before routing (so unknown paths are 401, not 404).
 *     The Vite proxy adds it, so a browser never holds it.
 *   - Requests are rate limited per minute (NOEMI_STUDIO_RATE_LIMIT), with a
 *     smaller limit for runs and Arena runs (NOEMI_STUDIO_RUN_RATE_LIMIT).
 *   - JSON bodies are size-capped.
 *   - The Host header is restricted to allowed hosts.
 *   - One audit record is written per request.
 *   - /api/run and /api/arena are throttled (NOEMI_THROTTLE_*): 429 + Retry-After.
 *   - With NOEMI_DAILY_SPEND_CAP_USD set, they are refused (429) once today's
 *     spend reaches the cap. Prices come from the price table in config.js.
 *   - Saved blueprints and run history live in one folder (NOEMI_STUDIO_DATA_DIR).
 *     File names come from server-made ids, never from browser input.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { pathToFileURL } from "node:url";
import {
  compileRegistry,
  compileText,
  compileUrl,
  PROVIDERS,
} from "./compile.js";
import { loadServerConfig, RUNTIMES } from "./config.js";
import { auditFromRequest, writeAudit } from "./audit.js";
import { runArena } from "./arena.js";
import { createRateLimiter } from "./rate-limit.js";
import { createBlueprintStore, ID } from "./store/blueprints.js";
import { StoreError } from "./store/files.js";
import { arenaRecordFrom, createArenaStore } from "./store/arena.js";
import { createRunStore, runRecordFrom } from "./store/runs.js";
import { createSpendLedger } from "./store/spend.js";
import { createThrottle } from "./throttle.js";

const MAX_PROMPT_CHARS = 16_000;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const INPUT_KINDS = ["text", "url", "registry"];
const STORE_STATUS = { NOT_FOUND: 404, INVALID: 400, TOO_LARGE: 413, LIMIT: 409 };
const DEFAULT_RUN_LIMIT = 100;
const MAX_RUN_LIMIT = 500;
// Liveness only; it reveals nothing about agents, runs or configuration.
const PUBLIC_ROUTES = new Set(["health"]);
// The routes that call a model, and so cost money.
const THROTTLED_ROUTES = new Set(["run", "arena"]);

// Compare fixed-length digests so neither content nor length leaks through timing.
const digest = (value) => createHash("sha256").update(value, "utf8").digest();

/** True when the request carries `Authorization: Bearer <token>` matching `expected`. */
function hasValidBearer(req, expected) {
  const match = /^Bearer[ ]+(\S+)[ ]*$/i.exec(req.headers.authorization ?? "");
  return Boolean(match) && timingSafeEqual(digest(match[1]), expected);
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class SpendCapError extends RequestError {
  constructor() {
    super(429, "The daily spending cap has been reached. Runs resume when the day changes.");
  }
}

/** Throws RequestError(400) unless `input` is one of the accepted shapes. */
function checkInput(input) {
  if (!input || typeof input !== "object" || !INPUT_KINDS.includes(input.kind)) {
    throw new RequestError(
      400,
      `input.kind must be one of: ${INPUT_KINDS.join(", ")}.`,
    );
  }

  const field = { text: "markdown", url: "url", registry: "ref" }[input.kind];

  if (typeof input[field] !== "string") {
    throw new RequestError(400, `input.${field} must be a string.`);
  }
}

function readJson(req, maxBytes) {
  if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) {
    return Promise.reject(
      new RequestError(415, "Send the request body as application/json."),
    );
  }

  if (Number(req.headers["content-length"]) > maxBytes) {
    return Promise.reject(
      new RequestError(413, `Request body is larger than ${maxBytes} bytes.`),
    );
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;

      if (total > maxBytes) {
        reject(
          new RequestError(413, `Request body is larger than ${maxBytes} bytes.`),
        );
        req.removeAllListeners("data");
        req.resume();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new RequestError(400, "Request body is not valid JSON."));
      }
    });

    req.on("error", () => {
      reject(new RequestError(400, "Request body could not be read."));
    });
  });
}

const sendJson = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
};

// Unexpected exceptions never expose their messages or stack traces.
const internalFailure = (err) => ({
  ok: false,
  stage: "internal",
  errors: [
    {
      code: typeof err?.code === "string" ? err.code : "INTERNAL",
      message: "Internal server error.",
    },
  ],
});

/** Store failures with a known code become 4xx; anything else stays a 500. */
async function viaStore(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof StoreError && STORE_STATUS[err.code]) {
      throw new RequestError(STORE_STATUS[err.code], err.message);
    }
    throw err;
  }
}

/**
 * Build the Studio server.
 * @param {{ env?: NodeJS.ProcessEnv, repoRoot?: string, audit?: NodeJS.WritableStream }} [opts]
 */
export function createServer(opts = {}) {
  const config = loadServerConfig(opts.env ?? process.env);
  const audit = opts.audit ?? process.stderr;
  // Keep only the digest; the raw token is not held past startup.
  const tokenDigest = digest(config.token);

  const blueprints = createBlueprintStore({
    dir: config.dataDir,
    maxBytes: config.loader.maxBytes,
    maxItems: config.maxBlueprints,
  });
  const runs = createRunStore({ dir: config.dataDir, maxRuns: config.maxRuns });
  const arenaRuns = createArenaStore({ dir: config.dataDir, maxRuns: config.maxArenaRuns });
  const spend = createSpendLedger({ dir: config.dataDir, timeZone: config.spendTimeZone });
  const throttle = config.throttle ? createThrottle(config.throttle) : null;

  const allowedHostnames = new Set([
    ...LOOPBACK,
    config.host.toLowerCase(),
  ]);

  if (config.origin) {
    allowedHostnames.add(new URL(config.origin).hostname.toLowerCase());
  }

  const compileOpts = {
    loader: config.loader,
    // With a cap, a model that has no price would count as free: refuse it instead.
    ...(config.dailyCapUsd !== null ? { requirePrice: true } : {}),
    ...(opts.repoRoot ? { repoRoot: opts.repoRoot } : {}),
  };

  const load = (input, extra) => {
    const options = { ...compileOpts, ...extra };

    if (input.kind === "text") {
      return compileText(input.markdown, options);
    }

    if (input.kind === "url") {
      return compileUrl(input.url, options);
    }

    return compileRegistry(input.ref, options);
  };

  async function readObject(req) {
    const body = await readJson(req, config.maxBodyBytes);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RequestError(400, "Request body must be a JSON object.");
    }

    return body;
  }

  /** Throws a 429 once today's spend has reached the cap. No-op without a cap. */
  async function checkSpendCap() {
    if (config.dailyCapUsd !== null && (await spend.spentToday()) >= config.dailyCapUsd) {
      throw new SpendCapError();
    }
  }

  /** Best effort, like run history: a ledger that cannot be written never fails a finished run. */
  async function recordSpend(usd) {
    try {
      await spend.add(usd);
    } catch {
      // Intentionally ignored; see above.
    }
  }

  async function validate(req, res, log) {
    const body = await readJson(req, config.maxBodyBytes);
    checkInput(body?.input);
    log.input = body.input;

    let result;

    try {
      result = await load(body.input, { checkOnly: true });
    } catch (err) {
      result = internalFailure(err);
    }

    log.result = result;

    sendJson(res, result.stage === "internal" ? 500 : 200, result);
  }

  async function run(req, res, log) {
    const body = await readJson(req, config.maxBodyBytes);
    checkInput(body?.input);
    log.input = body.input;

    const { provider, runtime, prompt, blueprintId } = body;

    if (provider !== undefined && !PROVIDERS.includes(provider)) {
      throw new RequestError(
        400,
        `provider must be one of: ${PROVIDERS.join(", ")}.`,
      );
    }

    if (runtime !== undefined && !RUNTIMES.includes(runtime)) {
      throw new RequestError(
        400,
        `runtime must be one of: ${RUNTIMES.join(", ")}.`,
      );
    }

    if (
      prompt !== undefined &&
      (typeof prompt !== "string" || prompt.length > MAX_PROMPT_CHARS)
    ) {
      throw new RequestError(
        400,
        `prompt must be a string of at most ${MAX_PROMPT_CHARS} characters.`,
      );
    }

    // Only links a history row to a saved blueprint. Never used as a path.
    if (
      blueprintId !== undefined &&
      !(typeof blueprintId === "string" && ID.test(blueprintId))
    ) {
      throw new RequestError(400, "blueprintId must be a saved blueprint id.");
    }

    log.provider = provider;
    log.runtime = runtime;

    await checkSpendCap();

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    });

    res.flushHeaders();

    res.on("close", () => {
      if (!res.writableFinished) {
        log.disconnected = true;
      }
    });

    const send = (event) => {
      if (!res.destroyed && res.writable) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    // This is the only result declaration in the run() function.
    let streamedOutput = false;
    let result;
    const startedAt = Date.now();

    try {
      result = await load(body.input, {
        provider,
        runtime,
        prompt: prompt || undefined,

        onStart: (started) => {
          send({ type: "start", ...started });
        },

        onToken: (text) => {
          if (typeof text !== "string" || text.length === 0) {
            return;
          }

          // Track whether any content was streamed. Do not append the complete
          // result after streamed tokens, or the client would receive duplicates.
          streamedOutput = true;
          send({ type: "token", text });
        },
      });
    } catch (err) {
      result = internalFailure(err);
    }

    log.result = result;

    // Record the run BEFORE the closing event, so a client that refreshes its
    // table on `done` or `error` always sees it. History is best effort: if the
    // data folder is unwritable the run still completes.
    try {
      await runs.append(
        runRecordFrom({
          input: body.input,
          provider,
          runtime,
          blueprintId,
          result,
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch {
      // Intentionally ignored; see above.
    }

    if (result.ok) await recordSpend(result.run.usage?.costUsd);

    if (result.ok) {
      const {
        provider: answeredBy,
        runtime: via,
        model,
        usage,
        fallbacks,
        output,
      } = result.run;

      // Compatibility path for providers/runtimes that return only full output.
      // Once a token was streamed, never send the complete output again.
      if (
        !streamedOutput &&
        typeof output === "string" &&
        output.length > 0
      ) {
        send({ type: "token", text: output });
      }

      send({
        type: "done",
        provider: answeredBy,
        runtime: via,
        model,
        usage,
        fallbacks,
      });
    } else {
      send({
        type: "error",
        stage: result.stage,
        errors: result.errors,
      });
    }

    res.end();
  }

  /**
   * Sprint 5 Arena: one saved blueprint and one prompt, run on every provider
   * at once (src/arena.js). A provider that fails is recorded as failed and
   * never replaced by a fallback. The stream is SSE, like /api/run.
   */
  async function arena(req, res, log) {
    const body = await readObject(req);
    const { blueprintId, prompt } = body;

    if (!(typeof blueprintId === "string" && ID.test(blueprintId))) {
      throw new RequestError(400, "blueprintId must be a saved blueprint id.");
    }

    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
      throw new RequestError(
        400,
        `prompt must be a non-empty string of at most ${MAX_PROMPT_CHARS} characters.`,
      );
    }

    // 404 before any stream starts. The Markdown comes from the saved
    // blueprint, never from the request.
    const saved = await viaStore(() => blueprints.get(blueprintId));
    const input = { kind: "text", markdown: saved.markdown };
    log.input = input;

    await checkSpendCap();

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    });

    res.flushHeaders();

    res.on("close", () => {
      if (!res.writableFinished) {
        log.disconnected = true;
      }
    });

    const send = (event) => {
      if (!res.destroyed && res.writable) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    const events = runArena({
      prompt,

      // The engine calls this once to check the blueprint and once per
      // provider. The check result is what the audit record describes.
      compile: async (extra) => {
        const checking = extra.checkOnly === true;

        try {
          const result = await load(input, extra);
          if (checking) log.result = result;
          return result;
        } catch (err) {
          if (checking) log.result = internalFailure(err);
          throw err;
        }
      },

      // Runs before the closing `end` event, so a client that reads the
      // scoreboard on `end` sees this run. The summary holds no prompt or text.
      // Saving is best effort; the spend is recorded either way.
      onComplete: async (summary) => {
        log.arena = summary;
        await recordSpend(summary.results.reduce((sum, r) => sum + (r.costUsd || 0), 0));
        await arenaRuns.append(arenaRecordFrom(summary, blueprintId));
      },
    });

    // Drain to the end even if the client left: the providers cannot be
    // cancelled, so finishing keeps the run complete and its audit record true.
    for await (const event of events) {
      send(event);
    }

    res.end();
  }

  const listFrom = (store) => async (req, res) => {
    const raw = new URL(req.url ?? "/", "http://localhost").searchParams.get("limit");
    const limit = raw === null ? DEFAULT_RUN_LIMIT : Number(raw);

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RUN_LIMIT) {
      throw new RequestError(
        400,
        `limit must be a whole number from 1 to ${MAX_RUN_LIMIT}.`,
      );
    }

    sendJson(res, 200, await store.list(limit));
  };

  const route = (method, pattern, name, handler) => ({ method, pattern, name, handler });
  const BP = /^\/api\/blueprints\/([^/]+)$/;

  const routes = [
    route("GET", /^\/api\/health$/, "health", (_req, res) => {
      sendJson(res, 200, { ok: true });
    }),
    route("GET", /^\/api\/providers$/, "providers", (_req, res) => {
      sendJson(res, 200, { providers: PROVIDERS, runtimes: RUNTIMES });
    }),
    route("POST", /^\/api\/validate$/, "validate", validate),
    route("POST", /^\/api\/run$/, "run", run),
    route("POST", /^\/api\/arena$/, "arena", arena),
    route("GET", /^\/api\/runs$/, "runs.list", listFrom(runs)),
    route("GET", /^\/api\/arena\/runs$/, "arena.runs", listFrom(arenaRuns)),
    route("GET", /^\/api\/arena\/scoreboard$/, "arena.scoreboard", async (_req, res) => {
      sendJson(res, 200, await arenaRuns.scoreboard());
    }),

    route("GET", /^\/api\/blueprints$/, "blueprints.list", async (_req, res) => {
      sendJson(res, 200, await viaStore(() => blueprints.list()));
    }),
    route("POST", /^\/api\/blueprints$/, "blueprints.create", async (req, res) => {
      const { name, markdown } = await readObject(req);
      sendJson(res, 201, await viaStore(() => blueprints.create({ name, markdown })));
    }),
    route("GET", BP, "blueprints.get", async (_req, res, _log, [id]) => {
      sendJson(res, 200, await viaStore(() => blueprints.get(id)));
    }),
    route("PUT", BP, "blueprints.update", async (req, res, _log, [id]) => {
      const { name, markdown } = await readObject(req);

      // PUT replaces; a missing field is a client bug, not "keep the old one".
      if (typeof name !== "string" || typeof markdown !== "string") {
        throw new RequestError(400, "name and markdown must both be strings.");
      }

      sendJson(res, 200, await viaStore(() => blueprints.update(id, { name, markdown })));
    }),
    route("PATCH", BP, "blueprints.rename", async (req, res, _log, [id]) => {
      const { name } = await readObject(req);

      if (typeof name !== "string") {
        throw new RequestError(400, "name must be a string.");
      }

      sendJson(res, 200, await viaStore(() => blueprints.update(id, { name })));
    }),
    route("DELETE", BP, "blueprints.delete", async (_req, res, _log, [id]) => {
      await viaStore(() => blueprints.remove(id));
      res.writeHead(204, { "cache-control": "no-store" });
      res.end();
    }),
  ];

  const takeRequest = createRateLimiter(config.rateLimit);
  const takeRun = createRateLimiter(config.runRateLimit);

  function match(method, path) {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(path);
      if (m) return { route: r, params: m.slice(1) };
    }
    return null;
  }

  return http.createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const found = match(req.method, path);

    const log = {
      route: found ? found.route.name : `${req.method}:unknown`,
    };

    if (config.origin) {
      res.setHeader("access-control-allow-origin", config.origin);
      res.setHeader("vary", "origin");
    }

    try {
      const hostname = new URL(
        `http://${req.headers.host ?? ""}`,
      ).hostname.toLowerCase();

      if (!allowedHostnames.has(hostname)) {
        throw new RequestError(421, "Unexpected Host header.");
      }

      if (
        req.method === "OPTIONS" &&
        config.origin &&
        req.headers.origin === config.origin
      ) {
        log.route = "preflight";

        res.writeHead(204, {
          "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-max-age": "600",
        });

        res.end();
        return;
      }

      // Before the 404 check, so an unauthenticated caller cannot map routes.
      if (!(found && PUBLIC_ROUTES.has(found.route.name)) && !hasValidBearer(req, tokenDigest)) {
        res.setHeader("www-authenticate", 'Bearer realm="noemi-studio"');
        throw new RequestError(401, "Missing or invalid bearer token.");
      }

      // Health is exempt: it reveals nothing and spends nothing.
      if (!(found && PUBLIC_ROUTES.has(found.route.name))) {
        const spends = found && THROTTLED_ROUTES.has(found.route.name);
        const retryAfter = takeRequest() || (spends ? takeRun() : 0);

        if (retryAfter) {
          res.setHeader("retry-after", String(retryAfter));
          throw new RequestError(429, "Too many requests. Try again shortly.");
        }
      }

      if (!found) {
        throw new RequestError(404, "Not found.");
      }

      if (throttle && THROTTLED_ROUTES.has(found.route.name)) {
        const taken = throttle.take();
        if (!taken.ok) {
          res.setHeader("retry-after", String(Math.ceil(taken.retryAfterMs / 1000)));
          throw new RequestError(429, "Too many requests. Wait a moment and try again.");
        }
      }

      await found.route.handler(req, res, log, found.params);
    } catch (err) {
      if (err instanceof RequestError) {
        log.rejected = {
          status: err.status,
          reason: err.message,
        };

        if (!res.headersSent) {
          sendJson(res, err.status, { ok: false, message: err.message });
        } else {
          res.end();
        }
      } else {
        log.result = internalFailure(err);

        if (!res.headersSent) {
          sendJson(res, 500, {
            ok: false,
            message: "Internal server error.",
          });
        } else {
          res.end();
        }
      }
    } finally {
      writeAudit(auditFromRequest(log, log.result), audit);
    }
  });
}

/** `npm run studio`: start the server, or exit 1 if its configuration is unsafe. */
export function main() {
  let server;

  try {
    server = createServer();
  } catch (err) {
    if (err.code !== "SERVER_CONFIG") {
      throw err;
    }

    console.error(`Studio server not started: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const { host, port } = loadServerConfig();

  server.listen(port, host, () => {
    console.error(
      `Studio server listening on http://${host.includes(":") ? `[${host}]` : host}:${port}`,
    );
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}