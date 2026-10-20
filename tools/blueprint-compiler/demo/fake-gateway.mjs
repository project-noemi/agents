#!/usr/bin/env node
// Demo-only stand-in for the NewPush gateway's OpenAI surface, so the Mastra
// runtime can be shown live with no keys and no network. Not used by tests.
//
//   node demo/fake-gateway.mjs [--port 8787]
//   FAKE_GW_FAIL=503 node demo/fake-gateway.mjs     # always answer 503 (fallback demo)
//   FAKE_GW_FAIL=403 node demo/fake-gateway.mjs     # always answer 403 (fail-closed demo)
//
// Then point the compiler at it (plain http is allowed for localhost only):
//   AI_GW_API_KEY=demo AI_GW_BASE_URL=http://127.0.0.1:8787 \
//     node src/cli.js compile fixtures/architect.core.md --provider mastra
import http from "node:http";
import { parseArgs } from "node:util";

const { port = "8787" } = parseArgs({ options: { port: { type: "string" } } }).values;
const fail = Number(process.env.FAKE_GW_FAIL) || 0;

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
    const user = body.messages?.findLast((m) => m.role === "user")?.content ?? "";
    const authed = /^Bearer \S+$/.test(req.headers.authorization ?? "");
    console.log(`${req.method} ${req.url}  model=${body.model}  auth=${authed ? "Bearer ***" : "MISSING"}  refusal-criteria-in-system=${system.includes("## Refusal Criteria")}`);

    res.setHeader("content-type", "application/json");
    if (fail || req.url !== "/v1/chat/completions") {
      res.statusCode = fail || 404;
      return res.end(JSON.stringify({ error: { message: `fake gateway: ${res.statusCode}` } }));
    }
    res.end(JSON.stringify({
      id: "demo", object: "chat.completion", created: 0, model: body.model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
        content: `[fake gateway] ${body.model} saw the persona's Refusal Criteria: ${system.includes("## Refusal Criteria")}. You said: ${user}` } }],
      usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
    }));
  });
});

server.listen(Number(port), "127.0.0.1", () => console.log(`fake gateway on http://127.0.0.1:${port}` + (fail ? ` (always ${fail})` : "")));
