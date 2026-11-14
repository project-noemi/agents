import assert from "node:assert/strict";
import test from "node:test";
import { runArena, safeError } from "../src/arena.js";

// Offline: the engine gets a fake `compile`, so no file, server or network is involved.

const collect = async (events) => {
  const out = [];
  for await (const e of events) out.push(e);
  return out;
};

const checked = { ok: true, ir: { id: "coding/architect" }, resolved: { skills: [], mcp: [] } };
const answer = (text, extra = {}) => ({
  ok: true,
  ir: checked.ir,
  run: {
    provider: "x",
    model: "m-1",
    output: text,
    usage: { inputTokens: 3, outputTokens: 4, latencyMs: 9999, costUsd: 0.5 },
    fallbacks: [],
    ...extra,
  },
});
const failure = (errors, stage = "provider") => ({ ok: false, stage, errors, fallbacks: [] });

// The check call answers `check`; each provider call goes to its script.
function fakeCompile(scripts, check = checked) {
  const calls = [];
  const compile = async (opts) => {
    calls.push(opts);
    if (opts.checkOnly) return check;
    return scripts[opts.provider](opts);
  };
  compile.calls = calls;
  return compile;
}

const gate = () => {
  let open;
  const promise = new Promise((resolve) => {
    open = resolve;
  });
  return { promise, open };
};

test("providers run at the same time: a sequential run would hang on the gate", { timeout: 5000 }, async () => {
  const g = gate();
  const compile = fakeCompile({
    a: async (o) => {
      o.onStart();
      o.onToken("a1 ");
      await g.promise; // only provider b can open this
      o.onToken("a2");
      return answer("a1 a2");
    },
    b: async (o) => {
      o.onStart();
      o.onToken("b1");
      g.open();
      return answer("b1");
    },
  });

  const events = await collect(runArena({ compile, prompt: "hi", providers: ["a", "b"], id: "run1" }));

  assert.deepEqual(events[0], { type: "arena", id: "run1", blueprint: "coding/architect", providers: ["a", "b"] });
  assert.deepEqual(events.at(-1), { type: "end", id: "run1" });

  const text = (p) => events.filter((e) => e.type === "token" && e.provider === p).map((e) => e.text).join("");
  assert.equal(text("a"), "a1 a2");
  assert.equal(text("b"), "b1");

  const at = (type, provider, t) =>
    events.findIndex((e) => e.type === type && e.provider === provider && (t === undefined || e.text === t));
  assert.ok(at("token", "b", "b1") < at("token", "a", "a2"), "b streams while a is still running");
  for (const p of ["a", "b"]) assert.ok(at("start", p) < at("done", p), `${p}: start before done`);
});

test("the blueprint is checked once, and every provider call forbids fallbacks", async () => {
  const compile = fakeCompile({ mock: async () => answer("x"), xai: async () => answer("y") });
  await collect(runArena({ compile, prompt: "review", providers: ["mock", "xai"] }));

  const [first, ...rest] = compile.calls;
  assert.deepEqual(first, { checkOnly: true });
  assert.deepEqual(
    rest.map((c) => [c.provider, c.prompt, c.fallbacks]),
    [["mock", "review", []], ["xai", "review", []]],
  );
});

test("a repeated provider name runs once", async () => {
  const compile = fakeCompile({ a: async () => answer("x") });
  const events = await collect(runArena({ compile, prompt: "p", providers: ["a", "a"] }));
  assert.equal(compile.calls.length, 2, "one check, one run");
  assert.deepEqual(events[0].providers, ["a"]);
});

test("a failed provider is recorded, the others carry on, and nothing it said is echoed", async () => {
  const leak = "sk-secret-canary";
  const compile = fakeCompile({
    good: async (o) => {
      o.onStart();
      o.onToken("fine");
      return answer("fine");
    },
    down: async () =>
      failure([{ code: "PROVIDER_HTTP", status: 503, message: `gateway returned 503: {"key":"${leak}"}` }]),
    bug: async () => {
      throw new Error(`boom ${leak}`);
    },
    nokey: async () =>
      failure([{ code: "PROVIDER_CONFIG", message: `AI_GW_BASE_URL is not valid: "https://u:${leak}@x"` }]),
  });

  const events = await collect(runArena({ compile, prompt: "hi", providers: ["good", "down", "bug", "nokey"] }));

  assert.equal(JSON.stringify(events).includes(leak), false);
  const failed = Object.fromEntries(events.filter((e) => e.type === "failed").map((e) => [e.provider, e]));
  assert.deepEqual(failed.down, {
    type: "failed",
    provider: "down",
    stage: "provider",
    errors: [{ code: "PROVIDER_HTTP", message: "HTTP 503", status: 503 }],
  });
  assert.deepEqual(failed.bug, {
    type: "failed",
    provider: "bug",
    stage: "internal",
    errors: [{ code: "INTERNAL", message: "Internal server error." }],
  });
  assert.equal(failed.nokey.errors[0].code, "PROVIDER_CONFIG");
  assert.deepEqual(events.filter((e) => e.type === "done").map((e) => e.provider), ["good"]);
  assert.equal(events.at(-1).type, "end");
});

test("usage is normalized and latency is measured by the Arena, not taken from the provider", async () => {
  const compile = fakeCompile({
    a: async (o) => {
      o.onStart();
      return answer("x", { usage: { inputTokens: 12.4, outputTokens: -3, latencyMs: 9999, costUsd: 0.0021 } });
    },
  });
  const events = await collect(runArena({ compile, prompt: "p", providers: ["a"] }));
  const done = events.find((e) => e.type === "done");

  assert.equal(done.model, "m-1");
  assert.deepEqual([done.usage.inputTokens, done.usage.outputTokens, done.usage.costUsd], [12, 0, 0.0021]);
  assert.ok(Number.isInteger(done.usage.latencyMs) && done.usage.latencyMs >= 0 && done.usage.latencyMs < 1000);
});

test("a provider that returns its whole answer without streaming still gets one token event", async () => {
  const compile = fakeCompile({ a: async () => answer("whole answer") });
  const events = await collect(runArena({ compile, prompt: "p", providers: ["a"] }));
  const tokens = events.filter((e) => e.type === "token");
  assert.deepEqual(tokens, [{ type: "token", provider: "a", text: "whole answer" }]);
  assert.ok(events.findIndex((e) => e.type === "token") < events.findIndex((e) => e.type === "done"));
});

test("a blueprint that fails its checks is one error event, and no provider runs", async () => {
  const errors = [{ code: "MISSING_REFUSAL", message: "m", path: "Refusal Criteria" }];
  let completed = false;
  const compile = fakeCompile(
    { a: async () => assert.fail("a provider must not run") },
    { ok: false, stage: "validate", errors },
  );

  const events = await collect(
    runArena({ compile, prompt: "p", providers: ["a"], onComplete: () => { completed = true; } }),
  );

  assert.deepEqual(events, [{ type: "error", stage: "validate", errors }]);
  assert.equal(compile.calls.length, 1);
  assert.equal(completed, false, "nothing to save");
});

test("an exception while checking is an internal error event without its message", async () => {
  const compile = async () => {
    throw new Error("disk path /home/jane/secret");
  };
  const events = await collect(runArena({ compile, prompt: "p", providers: ["a"] }));
  assert.deepEqual(events, [
    { type: "error", stage: "internal", errors: [{ code: "INTERNAL", message: "Internal server error." }] },
  ]);
});

test("onComplete gets a summary in provider order, before the end event, with no prompt or text", { timeout: 5000 }, async () => {
  const g = gate();
  const compile = fakeCompile({
    slow: async (o) => {
      o.onStart();
      await g.promise;
      return answer("slow answer");
    },
    quick: async (o) => {
      o.onStart();
      g.open();
      return failure([{ code: "PROVIDER_EMPTY", message: "m" }]);
    },
  });

  const seen = [];
  let summary;
  for await (const e of runArena({
    compile,
    prompt: "secret prompt",
    providers: ["slow", "quick"],
    id: "r9",
    onComplete: async (s) => {
      summary = s;
      seen.push("complete");
    },
  })) {
    seen.push(e.type);
  }

  assert.deepEqual(seen.slice(-2), ["complete", "end"]);
  assert.equal(summary.id, "r9");
  assert.equal(summary.blueprint, "coding/architect");
  assert.ok(!Number.isNaN(Date.parse(summary.at)));
  // `quick` finished first; the summary still follows the provider order.
  assert.deepEqual(summary.results.map((r) => [r.provider, r.ok]), [["slow", true], ["quick", false]]);
  assert.equal(summary.results[0].model, "m-1");
  assert.deepEqual([summary.results[1].stage, summary.results[1].errorCodes], ["provider", ["PROVIDER_EMPTY"]]);
  const text = JSON.stringify(summary);
  assert.ok(!text.includes("secret prompt") && !text.includes("slow answer"));
});

test("a failing onComplete never blocks the end event", async () => {
  const compile = fakeCompile({ a: async () => answer("x") });
  const events = await collect(
    runArena({
      compile,
      prompt: "p",
      providers: ["a"],
      onComplete: async () => {
        throw new Error("disk full");
      },
    }),
  );
  assert.equal(events.at(-1).type, "end");
});

test("closing the stream before providers start runs none of them", async () => {
  const compile = fakeCompile({ a: async () => assert.fail("must not run") });
  for await (const e of runArena({ compile, prompt: "p", providers: ["a"] })) {
    assert.equal(e.type, "arena");
    break;
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(compile.calls.length, 1, "only the check ran");
});

test("safeError keeps codes and status but never the message text", () => {
  assert.deepEqual(
    safeError({ code: "PROVIDER_HTTP", status: 429, message: "x sk-1" }),
    { code: "PROVIDER_HTTP", message: "HTTP 429", status: 429 },
  );
  assert.equal(safeError({ code: "PROVIDER_EMPTY", message: "sk-1" }).message, "The provider returned no usable answer.");
  assert.deepEqual(safeError({ code: "WEIRD", message: "sk-1" }), { code: "WEIRD", message: "The provider failed." });
  assert.deepEqual(safeError({}), { code: "PROVIDER_FAILED", message: "The provider failed." });
  // Inherited object properties are not codes.
  assert.equal(safeError({ code: "constructor" }).message, "The provider failed.");
});