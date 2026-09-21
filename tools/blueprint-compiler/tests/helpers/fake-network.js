export function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return fn().finally(() => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

export function withFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return fn().finally(() => { globalThis.fetch = original; });
}

// fake.calls records every request so tests can assert call counts / init.signal
export function recordFetch(handler) {
  const calls = [];
  const fake = async (url, init) => { calls.push({ url: String(url), init }); return handler(url, init, calls.length); };
  fake.calls = calls;
  return fake;
}

export const jsonResponse = (body, status = 200) => ({
  ok: true, status, json: async () => body, text: async () => JSON.stringify(body),
});
export const errorResponse = (status, body = `synthetic ${status} from the stub`) => ({
  ok: false, status, text: async () => body,
});
export const geminiBody = (text, usage = { promptTokenCount: 1, candidatesTokenCount: 1 }) => ({
  candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage,
});
export const networkFailure = (msg = "fetch failed") => async () => { throw new TypeError(msg); };
export const timeoutFailure = () => async () => {
  throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
};
export const xaiBody = (text, usage = { prompt_tokens: 1, completion_tokens: 1 }) => ({
  choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
  usage,
});

// Route a fake fetch by hostname so one test can fake several providers at once.
// { "api.x.ai": handler, "generativelanguage.googleapis.com": handler }
export const routeFetch = (byHost) => async (url, init) => {
  const host = new URL(String(url)).host;
  const handler = byHost[host];
  if (!handler) throw new Error(`unexpected request to ${host}`);
  return handler(url, init);
};
