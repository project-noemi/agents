// Sprint 3 spike (Section 4): can Mastra's model layer target the gateway's
// OpenAI-compatible surface with AI_GW_API_KEY?
// Runs a real @mastra/core Agent against a LOCAL fake gateway. No network.
import http from "node:http";
import { Agent } from "@mastra/core/agent";

const seen = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body && JSON.parse(body) });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      id: "x", object: "chat.completion", created: 0, model: "xai/grok-4.6",
      choices: [{ index: 0, message: { role: "assistant", content: "hello from fake gateway" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const variants = {
  "A: { id: 'xai/grok-4.6', url: base }": { id: "xai/grok-4.6", url: base, apiKey: "gw-key" },
  "B: { id: 'xai/grok-4.6', url: base + '/v1' }": { id: "xai/grok-4.6", url: `${base}/v1`, apiKey: "gw-key" },
  "C: { providerId: 'newpush', modelId: 'xai/grok-4.6', url: base + '/v1' }": { providerId: "newpush", modelId: "xai/grok-4.6", url: `${base}/v1`, apiKey: "gw-key" },
};

for (const [label, model] of Object.entries(variants)) {
  seen.length = 0;
  try {
    const agent = new Agent({ id: "spike", name: "spike", instructions: "SYSTEM-MARKER", model });
    const out = await agent.generate("hi");
    const r = seen[0];
    console.log(label, "\n  ->", r?.method, r?.url, "| auth:", r?.auth, "| model:", r?.body?.model,
      "| system:", r?.body?.messages?.[0]?.role, "| text:", out.text);
  } catch (e) {
    console.log(label, "\n  -> ERROR", e.message?.slice(0, 200), "| requests seen:", seen.map((s) => s.url));
  }
}
server.close();
