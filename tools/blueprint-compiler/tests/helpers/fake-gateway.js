// A loopback HTTP server standing in for the NewPush gateway's OpenAI surface.
// Loopback is not "the network": it never leaves the machine, and gateway.js
// allows plain http for localhost. Tests that need a REAL Mastra Agent use this
// instead of a fetch stub, because Mastra's model layer does its own I/O.
import http from "node:http";

/** An OpenAI chat.completions body. */
export const chatReply = (text, { finish = "stop", usage = { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }, extra = {} } = {}) => ({
  id: "chatcmpl-test", object: "chat.completion", created: 0, model: "xai/grok-4.6",
  choices: [{ index: 0, message: { role: "assistant", content: text, ...extra }, finish_reason: finish }],
  usage,
});

/**
 * @param {(req: { method: string, url: string, headers: object, body: any, n: number }, res: http.ServerResponse) => void} handler
 * @param {(gateway: { base: string, requests: object[] }) => Promise<void>} fn
 */
export async function withLocalGateway(handler, fn) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const r = { method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null };
      requests.push(r);
      handler({ ...r, n: requests.length }, res);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fn({ base: `http://127.0.0.1:${server.address().port}`, requests });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

export const sendJson = (res, body, status = 200) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};
export const sendError = (res, status) => sendJson(res, { error: { message: `synthetic ${status}` } }, status);
