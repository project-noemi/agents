#!/usr/bin/env node
/**
 * Sprint 4 Studio server: the one place a browser reaches the compiler.
 * Routes and event shapes follow studio/src/api/http.ts and types.ts.
 *
 *   GET    /api/health            { ok: true }
 *   GET    /api/providers         { providers, runtimes }
 *   POST   /api/validate          { input } -> JSON
 *   POST   /api/run               { input, prompt, provider?, runtime?, blueprintId? } -> SSE
 *   GET    /api/runs[?limit=N]    run history, newest first
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
 *   - NOEMI_HTTP_ALLOWED_HOSTS is required at startup.
 *   - JSON bodies are size-capped.
 *   - The Host header is restricted to allowed hosts.
 *   - One audit record is written per request.
 *   - Saved blueprints and run history live in one folder (NOEMI_STUDIO_DATA_DIR).
 *     File names come from server-made ids, never from browser input.
 */
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
import { createBlueprintStore, ID } from "./store/blueprints.js";
import { StoreError } from "./store/files.js";
import { createRunStore, runRecordFrom } from "./store/runs.js";

const MAX_PROMPT_CHARS = 16_000;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const INPUT_KINDS = ["text", "url", "registry"];
const STORE_STATUS = { NOT_FOUND: 404, INVALID: 400, TOO_LARGE: 413, LIMIT: 409 };
const DEFAULT_RUN_LIMIT = 100;
const MAX_RUN_LIMIT = 500;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
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

  const blueprints = createBlueprintStore({
    dir: config.dataDir,
    maxBytes: config.loader.maxBytes,
    maxItems: config.maxBlueprints,
  });
  const runs = createRunStore({ dir: config.dataDir, maxRuns: config.maxRuns });

  const allowedHostnames = new Set([
    ...LOOPBACK,
    config.host.toLowerCase(),
  ]);

  if (config.origin) {
    allowedHostnames.add(new URL(config.origin).hostname.toLowerCase());
  }

  const compileOpts = {
    loader: config.loader,
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

  async function listRuns(req, res) {
    const raw = new URL(req.url ?? "/", "http://localhost").searchParams.get("limit");
    const limit = raw === null ? DEFAULT_RUN_LIMIT : Number(raw);

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RUN_LIMIT) {
      throw new RequestError(
        400,
        `limit must be a whole number from 1 to ${MAX_RUN_LIMIT}.`,
      );
    }

    sendJson(res, 200, await runs.list(limit));
  }

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
    route("GET", /^\/api\/runs$/, "runs.list", listRuns),

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
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "600",
        });

        res.end();
        return;
      }

      if (!found) {
        throw new RequestError(404, "Not found.");
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