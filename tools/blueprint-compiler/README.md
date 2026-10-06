# Blueprint Compiler

Turns a NoéMI Markdown persona into a Blueprint IR and runs it on a configured
model provider (`mock`, `gemini`, and `xai` for Grok), falling back to the next
provider when one is unavailable.

This is not the fleet spec library. Specs live in `agents/`, `skills/`, and
`mcp-protocols/`. This package *reads* them.

## Quick start (offline)

```bash
cd tools/blueprint-compiler
npm test        # offline: every network call is faked
node src/cli.js compile fixtures/architect.core.md --provider mock --prompt "hello"
```

## Live providers

Both live providers go through NewPush's generative AI gateway: `gemini` uses
the Google-native surface (`/google/v1beta/models/{model}:generateContent`) and
`xai` uses the OpenAI-compatible surface (`/v1/chat/completions`). One gateway
virtual key authenticates both as `Authorization: Bearer`. It is not a Google or
xAI credential; never send it to those providers directly.

Keys are injected at runtime and never written to disk. Do not add a `.env` file.

```bash
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --provider gemini
infisical run --env=dev -- node src/cli.js compile fixtures/architect.core.md --provider xai
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
| `NOEMI_REPO_ROOT` | Root that `skills/` and `mcp-protocols/` resolve against. Use an absolute path; a relative one resolves against the current directory. Not a secret | this clone's root |

A 401 from the gateway means the virtual key is missing or invalid; a 403 means
the model is not allowed on the key or its budget / rate limit is spent. Both
fail closed. Ask your NewPush contact about keys, models, and limits.

Provider names for `--provider`, `NOEMI_PREFERRED_PROVIDER` and
`NOEMI_FALLBACK_PROVIDERS` are `mock`, `gemini` and `xai`. `xai` is the
provider name used in `docs/model-routing.json`; `grok` is not an alias. (That
file calls Google's provider `google`; this package's name for it is `gemini`.)

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
| 3+ | Skill/MCP resolution, Mastra. See REQUIREMENTS.md |

## Testing without the network

Shared fakes live in `tests/helpers/fake-network.js`. Reuse them for new providers.

Tests pass `repoRoot: fixtures/`, so they do not depend on `NOEMI_REPO_ROOT` or on
this clone's real `skills/`. The CLI tests clear the variable and cover the default root.

## Why it lives here

`tools/` already hosts runnable Node packages (`executive-assistant/`, `roi/`) next to the spec library. This package follows that convention with its own `package.json`, so root `npm run validate` stays a spec-only gate.

## Requirements and architecture

- [REQUIREMENTS.md](REQUIREMENTS.md) — Field Session requirements (proposal intent + 1 Sep 2026 amendments)
- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline and IR
- [AGENTS.md](AGENTS.md) — secrets, loop, and package contract
- [GIT-WORKFLOW.md](GIT-WORKFLOW.md) — branch map, staying up to date, and opening PRs
