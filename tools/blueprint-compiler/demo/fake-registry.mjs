#!/usr/bin/env node
// Demo-only persona server for the http and registry loaders. Not used by tests.
//
//   node demo/fake-registry.mjs [--port 8790]
//
// Serves fixtures/*.core.md under the registry layout (any version) and flat:
//   http://127.0.0.1:8790/core.md                                        architect
//   http://127.0.0.1:8790/<version>/agents/coding/architect/core.md      architect
//   http://127.0.0.1:8790/<version>/agents/coding/broken/core.md         no Refusal Criteria
//   http://127.0.0.1:8790/<version>/agents/coding/traversal/core.md      escaping skill refs
import { readFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const { port = "8790" } = parseArgs({ options: { port: { type: "string" } } }).values;
const files = { architect: "architect.core.md", broken: "broken.missing-refusal.md", traversal: "traversal.core.md" };

const server = http.createServer(async (req, res) => {
  const m = req.url.match(/^\/(?:[^/]+\/agents\/coding\/(architect|broken|traversal)\/)?core\.md$/);
  console.log(`${req.method} ${req.url} -> ${m ? 200 : 404}`);
  if (!m) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("content-type", "text/markdown; charset=utf-8");
  res.end(await readFile(join(fixtures, files[m[1] ?? "architect"])));
});
server.listen(Number(port), "127.0.0.1", () => console.log(`fake registry on http://127.0.0.1:${port}`));
