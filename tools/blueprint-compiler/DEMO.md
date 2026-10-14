# Mid-project demo script

About 10 minutes. Everything runs **offline** except the optional live step at the
end, so a dead network or a missing key cannot sink the demo.

The through-line to say out loud: *a blueprint is Markdown; the compiler
validates it, resolves what it points at, and runs it on whichever provider is
configured. It fails closed at every step, and the persona's Refusal Criteria
always reach the model.*

## Before you start (once, not on stage)

```bash
cd tools/blueprint-compiler
npm install
npm test                       # expect: all green
export NOEMI_REPO_ROOT="$PWD/fixtures"   # offline skills/ and mcp-protocols/
```

Open three terminals in `tools/blueprint-compiler`: **A** (the demo), **B**
(`node demo/fake-gateway.mjs`), **C** (`node demo/fake-registry.mjs`). Start B and C
before you begin. Each prints one line when it is listening.

Keep a pre-run copy of every command's output in a scratch file. If a command
misbehaves live, show the saved output and move on rather than debugging on stage.

## 1. It is tested, offline (30 s)

```bash
npm test
```

Say: every network call is faked, no keys needed. This is the same suite CI runs.

## 2. Compile a persona (1 min)

```bash
node src/cli.js compile fixtures/architect.core.md --provider mock --prompt "review src/parse.js"
```

Point at three things in the output: the **IR** (`id`, `sections`,
`refusalCriteria`, `skills`), **`resolved`** (the skill ref became a real
repo-relative path), and the **one-line audit record on stderr**
(`task / inputs / actions / risks / result`).

## 3. It fails closed (2 min)

```bash
# A persona with no "### Refusal Criteria"
node src/cli.js compile fixtures/broken.missing-refusal.md --provider mock; echo "exit $?"

# A persona whose skill refs try to escape skills/
node src/cli.js compile fixtures/traversal.core.md --provider mock; echo "exit $?"
```

Say: the first stops at **validate** with `MISSING_REFUSAL`. A prose mention does
not count. The second stops at **resolve**: all six escape attempts reported at
once, as `BAD_SLUG`, before any file is touched. Neither ran a provider. Note the
error messages contain no filesystem path.

## 4. Mastra runtime, with Refusal Criteria attached (3 min)

Terminal B is our stand-in for the NewPush gateway.

```bash
export AI_GW_API_KEY=demo AI_GW_BASE_URL=http://127.0.0.1:8787
node src/cli.js compile fixtures/architect.core.md --runtime mastra --provider xai --prompt "review src/parse.js"
```

Say: this is a real `@mastra/core` Agent built from the IR, talking to the
gateway's OpenAI-compatible endpoint with the same virtual key as Gemini and Grok.
Look at Terminal B: it logged `refusal-criteria-in-system=true`. The persona's
rules went in the **system** message, verbatim, never the user turn. The answer
echoes that back.

**Fallback.** Restart B as `FAKE_GW_FAIL=503 node demo/fake-gateway.mjs`:

```bash
AI_GW_MAX_RETRIES=0 NOEMI_FALLBACK_PROVIDERS=mock \
  node src/cli.js compile fixtures/architect.core.md --runtime mastra --provider xai
```

Say: a 503 falls back to the next provider and the audit record says so
(`fallback-from:xai`, `run:mock`). Nothing is silently swapped in.

**Fail closed.** Restart B as `FAKE_GW_FAIL=403 node demo/fake-gateway.mjs`, run the
same command (keep `NOEMI_FALLBACK_PROVIDERS=mock`). Say: a 403 is a setup
problem, so it does **not** fall back, even though a fallback is configured.
Misconfiguration should be loud.

## 5. Load from a URL and from the registry (2 min)

Terminal C serves personas. Unset the gateway variables first
(`unset AI_GW_API_KEY AI_GW_BASE_URL`).

```bash
node src/cli.js compile http://127.0.0.1:8790/core.md --provider mock

export NOEMI_REGISTRY_URL=http://127.0.0.1:8790
node src/cli.js compile registry:coding/architect@2026.09.11 --provider mock
node src/cli.js compile registry:coding/broken --provider mock; echo "exit $?"
node src/cli.js compile registry:coding/traversal --provider mock; echo "exit $?"
```

Say: a remote persona takes **exactly** the same validate and resolve path as a
local file. The broken and traversal personas fail the same way they did in step 3,
even though they came over HTTP. The loader itself is strict: https only, no
redirects, size and time caps, optional host allowlist.

## 6. Optional: live (1 min, needs a key)

```bash
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --provider xai
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --runtime mastra --provider xai
```

Say: same code path, real gateway. The key is injected at runtime and never
written to disk. Only do this if the earlier steps went smoothly.

## What to say about what is next

- **Studio (Sprint 4)** sits on `compileSource` / `compileUrl` / `compileRegistry`
  and the provider registry; it needs the host allowlist set before it accepts a
  user-typed URL (ARCHITECTURE.md, Loaders).
- **Arena (Sprint 5)** fans one blueprint and prompt across providers; `usage`
  already returns tokens and latency, and cost is stubbed at 0 until pricing lands.
- **Open question for the client:** the registry layout (git tag on the public repo)
  is our assumption. Confirm it, or tell us what the real registry looks like.

## If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot connect` / `fetch failed` in steps 4-5 | Terminal B or C is not running, or wrong port | Restart it; the port is in its first line |
| `UNRESOLVED_SKILL` in step 2 | `NOEMI_REPO_ROOT` not set to `fixtures/` | `export NOEMI_REPO_ROOT="$PWD/fixtures"` |
| `PROVIDER_CONFIG` in step 4 | `AI_GW_API_KEY` or `AI_GW_BASE_URL` not exported in this shell | Re-export both |
| `@mastra/core could not be loaded` | `npm install` not run | `npm install` in this directory |
| Step 5 hits the real internet | `NOEMI_REGISTRY_URL` not exported | Export it, or use the full `http://127.0.0.1:8790/...` URL |