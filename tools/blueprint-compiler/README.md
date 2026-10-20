# Blueprint Compiler

Turns a NoéMI Markdown persona into a Blueprint IR and runs it on a configured
model provider (`mock`, `gemini`, and `xai` for Grok), either directly or as a
Mastra agent (`--runtime mastra`), falling back to the next provider when one is
unavailable. The persona can come from a local file, an http(s) URL, or the
versioned registry.

This is not the fleet spec library. Specs live in `agents/`, `skills/`, and
`mcp-protocols/`. This package *reads* them.

## Quick start (offline)

```bash
cd tools/blueprint-compiler
npm test        # offline: every network call is faked
node src/cli.js compile fixtures/architect.core.md --provider mock --prompt "hello"
```

`compile` takes a file path, an `https://` URL, or `registry:domain/name[@version]`
(see [Loaders](#loaders)). [DEMO.md](DEMO.md) is a runnable, fully offline walkthrough.

## Live providers

All live providers go through NewPush's generative AI gateway: `gemini` uses
the Google-native surface (`/google/v1beta/models/{model}:generateContent`), while
`xai` uses the OpenAI-compatible surface (`/v1/chat/completions`), and so does the
Mastra runtime for every provider.
One gateway virtual key authenticates all of them as `Authorization: Bearer`. It is not a Google or
xAI credential; never send it to those providers directly.

Keys are injected at runtime and never written to disk. Do not add a `.env` file.

```bash
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --provider gemini
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --provider xai
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --runtime mastra --provider xai
op run --env-file=.env.template -- node src/cli.js compile fixtures/architect.core.md
```

| Variable | Purpose | Default |
|---|---|---|
| `NOEMI_PREFERRED_PROVIDER` | Provider used when `--provider` is omitted | `mock` |
| `NOEMI_FALLBACK_PROVIDERS` | Comma-separated, tried in order after the preferred one fails | none |
| `AI_GW_API_KEY` | NewPush gateway virtual key. Required for `gemini` and `xai` | none |
| `AI_GW_BASE_URL` | Gateway origin (override for forks or staging) | `https://ai-gw.newpush.com` |
| `GEMINI_MODEL` | Gemini model, Google-native id (a `google/` prefix is stripped) | `gemini-3.8-flash` |
| `GEMINI_TIMEOUT_MS` | Per-request timeout | `30000` |
| `XAI_MODEL` | Grok model (`xai/` is added if missing) | `xai/grok-4.6` |
| `XAI_TIMEOUT_MS` | Per-request timeout | `30000` |
| `NOEMI_RUNTIME` | How the chosen provider's model is called: `direct` or `mastra` (see [Runtimes](#runtimes)). `--runtime` overrides it | `direct` |
| `AI_GW_MAX_RETRIES` | Retries per provider on 429 / 5xx / network failure, before falling back | `3` |
| `AI_GW_RETRY_BASE_MS` | First backoff delay; doubles each retry (capped at 8s, plus jitter) | `1000` |
| `NOEMI_HTTP_ALLOWED_HOSTS` | Comma-separated host allowlist for http(s) and registry personas. Empty means any https host | none |
| `NOEMI_LOADER_TIMEOUT_MS` | Timeout for fetching a remote persona | `10000` |
| `NOEMI_LOADER_MAX_BYTES` | Size cap for a remote persona | `262144` |
| `NOEMI_REGISTRY_URL` | Registry base URL (see [Loaders](#loaders)) | `https://raw.githubusercontent.com/project-noemi/agents` |
| `NOEMI_REGISTRY_VERSION` | Version used when a registry ref has no `@version` | `main` |
| `NOEMI_REPO_ROOT` | Root that `skills/` and `mcp-protocols/` resolve against. Use an absolute path; a relative one resolves against the current directory. Not a secret | this clone's root |

A 401 from the gateway means the virtual key is missing or invalid; a 403 means
the model is not allowed on the key or its budget / rate limit is spent. Both
fail closed. Ask your NewPush contact about keys, models, and limits.

Failure handling, in order:

1. **Up front, before any provider runs.** Every name in `[preferred, ...fallbacks]`
   must be a known provider (`PROVIDER`), and every live provider in that chain
   must have valid gateway config (under `--runtime mastra` this includes the model id): key set, `AI_GW_BASE_URL` an https URL (http
   only for localhost), timeouts and retry settings whole numbers
   (`PROVIDER_CONFIG`). A typo in a fallback no longer waits for the preferred
   provider to fail. Repeated names run once.
2. **Retry on the same provider.** 429, 5xx, and network failures retry with
   exponential backoff (`scripts/resilience_helpers.js`). Timeouts are not retried.
3. **Fall back.** Once retries are spent, or on a timeout, the next provider runs.
4. **Fail closed.** 4xx, config errors, and `PROVIDER_EMPTY` (a blocked prompt, a
   safety/recitation/content filter stop, or an empty answer) never fall back.

All live providers send the same system prompt (`src/providers/prompt.js`) with the
persona's Refusal Criteria copied verbatim: Gemini as `systemInstruction`, xAI and
the Mastra runtime as the `system` message. The user prompt is never mixed into it.

Provider names for `--provider`, `NOEMI_PREFERRED_PROVIDER` and
`NOEMI_FALLBACK_PROVIDERS` are `mock`, `gemini` and `xai`. `mastra` is a runtime, not a provider name, and is
rejected as one (`PROVIDER`); see [Runtimes](#runtimes). `xai` is the
provider name used in `docs/model-routing.json`; `grok` is not an alias. (That
file calls Google's provider `google`; this package's name for it is `gemini`.)

## Runtimes

Provider and runtime are two separate choices. The **provider** (`mock`, `gemini`,
`xai`) decides which model answers. The **runtime** decides how that model is called:

- `direct` (default): the hand-rolled gateway call in `src/providers/`.
- `mastra`: the same model, run as a real `@mastra/core` agent built from the IR
  (`src/runtime/mastra.js`) against the gateway's OpenAI-compatible surface with the
  same `AI_GW_API_KEY`.

Select it with `--runtime mastra` or `NOEMI_RUNTIME=mastra`. Provider selection and
fallback work exactly as before, so "Mastra on Gemini, falling back to xAI" is:

```bash
NOEMI_FALLBACK_PROVIDERS=xai,mock \
  node src/cli.js compile fixtures/architect.core.md --runtime mastra --provider gemini
```

Mastra takes its model and timeout from the provider's own settings (`XAI_MODEL`,
`GEMINI_MODEL`, `XAI_TIMEOUT_MS`, `GEMINI_TIMEOUT_MS`), so each model is configured
once. There is no Mastra-specific model setting. `mock` has no model and always runs
direct, even with `--runtime mastra`.

The persona's Refusal Criteria are the agent's instructions, copied verbatim; the
runtime refuses to build an agent for an IR that has none (`MISSING_REFUSAL`).

The runtime adds no failure rules of its own: the chosen provider's rules apply
unchanged (same retry policy `AI_GW_MAX_RETRIES` / `AI_GW_RETRY_BASE_MS`; 429 / 5xx /
network failure / timeout fall back; 4xx, bad config and `PROVIDER_EMPTY` fail
closed). Mastra reports those failures differently from the hand-rolled providers (it
can resolve successfully with empty text or `finishReason: "aborted"`), so the runtime
translates them; ARCHITECTURE.md ("Mastra runtime") has the spike findings.

Successful runs report both layers: `run.provider` is the model provider and
`run.runtime` is `direct` or `mastra`. The audit record's `actions` read
`run:<provider>+mastra` for a Mastra run.

`@mastra/core` is a dependency of this package only, pinned exactly, and is
imported lazily, so direct runs never load it. It must never be added to the
repository root `package.json`.

The runtime does not read skill or MCP *content* yet; `resolved` proves the files
exist and the persona's `Skills:` line names them. Reading them is Sprint 4+ and
must re-check containment at read time (ARCHITECTURE.md, Resolution).

## Loaders

A persona can come from three places. All three end in the same `compileSource`,
so a remote persona is validated and resolved exactly like a local file.

| Source | CLI | API | Source ref |
|---|---|---|---|
| File | `compile fixtures/architect.core.md` | `compileFile(path)` | `{ kind: "file", ref }` |
| URL | `compile https://host/path/core.md` | `compileUrl(url)` | `{ kind: "http", ref }` |
| Registry | `compile registry:coding/architect@2026.09.11` | `compileRegistry(ref)` | `{ kind: "registry", ref, version }` |

The HTTP loader fails closed: https only (plain http for localhost), no
credentials / query / fragment in the URL, redirects are **not** followed, an
optional host allowlist, a timeout and a size cap, and HTML responses are
rejected. Failures return `stage: "load"` with code `LOAD` (or `LOAD_CONFIG` for a
bad `NOEMI_LOADER_*` value).

The registry maps `domain/name[@version]` to
`{NOEMI_REGISTRY_URL}/{version}/agents/{domain}/{name}/core.md`. Refs and versions
are matched against strict patterns before a URL is built. **The layout is our
assumption** (the public repo addressed by release tag); it lives in one function,
`registryUrl()`, so changing it is a one-line edit.

## Skill and MCP resolution

After validation, every `**Skill:**` and `**MCP:**` ref must point at a real file,
or the compile fails closed at `stage: "resolve"` before any provider runs. All
bad refs are reported together.

- `category/name` (or `skills/category/name.md`) maps to `skills/{category}/{name}.md`.
- An MCP id maps to `mcp-protocols/{id}.md`, then `.json`. An explicit `.md` or `.json` in the ref is honored.
- Refs that land on the same file are listed once. Where the filesystem reports the on-disk case (Windows), a name that matches only by case does not count.
- The success payload carries `resolved` beside `ir`, with repo-relative paths.

| Code | Meaning |
|---|---|
| `BAD_SLUG` | Not a lowercase-hyphen `category/name` (skills) or `id` (MCP). Blocks `..`, `\`, absolute paths |
| `UNRESOLVED_SKILL` / `UNRESOLVED_MCP` | Well-formed, but no file there |
| `PATH_ESCAPE` | The file leads outside `skills/` or `mcp-protocols/`, or that folder leads outside the repo root |
| `RESOLVE_ROOT` | The configured repo root does not exist |
| `RESOLVE_FS` | Any other filesystem error; the message carries only the error code |

Error messages never contain a filesystem path. `skills-dist/` is not consulted yet
(see ARCHITECTURE.md).

## Fallback behaviour

Moves to the next provider on: HTTP 429, HTTP 5xx, network failure, timeout.
Fails immediately on: a missing key, any other 4xx, an unknown preferred
provider. Misconfiguration should be loud, not hidden by another provider.
`run.provider` names the provider that actually answered, and the stderr audit
record's `risks` lists what failed first.

## Status

| Sprint | State |
|---|---|
| 1 | Parse, validate, mock provider |
| 2 | Config-driven selection, Gemini + xAI (Grok), fallback |
| 3 | Skill/MCP resolution, Mastra runtime (`--runtime mastra`), HTTP + registry loaders |
| 4 | Studio. See REQUIREMENTS.md |
| 5 | Arena. See REQUIREMENTS.md |

## Testing without the network

Shared fakes live in `tests/helpers/fake-network.js`. Reuse them for new providers.

Tests that need a real Mastra agent talk to a loopback fake gateway
(`tests/helpers/fake-gateway.js`) instead of stubbing `fetch`, because Mastra does
its own I/O. Loopback never leaves the machine. `spikes/mastra-gateway.mjs`
reproduces the Sprint 3 spike on its own.

Tests pass `repoRoot: fixtures/`, so they do not depend on `NOEMI_REPO_ROOT` or on
this clone's real `skills/`. The CLI tests clear the variable and cover the default root.

## Why it lives here

`tools/` already hosts runnable Node packages (`executive-assistant/`, `roi/`) next to the spec library. This package follows that convention with its own `package.json`, so root `npm run validate` stays a spec-only gate.

## Requirements and architecture

- [REQUIREMENTS.md](REQUIREMENTS.md) — Field Session requirements (proposal intent + 1 Sep 2026 amendments)
- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline and IR
- [DEMO.md](DEMO.md) — offline demo script
- [AGENTS.md](AGENTS.md) — secrets, loop, and package contract
- [GIT-WORKFLOW.md](GIT-WORKFLOW.md) — branch map, staying up to date, and opening PRs