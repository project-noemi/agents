# Architecture — NoéMI Blueprint Compiler

Status: agreed in Session 1 (1 September 2026); updated for Sprint 3. Package-local. Not a fleet Decision Log entry yet.

## Pipeline

```
source  →  load  →  parse  →  validate  →  resolve  →  instantiate  →  supervise
                                                      └─ mock (Sprint 1)
                                                      └─ gemini, xai (Sprint 2)
                                                      └─ runtime: direct, or a Mastra agent (Sprint 3)
```

| Stage | Sprint | Notes |
|---|---|---|
| Load | 1, 3 | `loaders/file.js`, `loaders/http.js`, `loaders/registry.js`. All three return `{ markdown, source }` and feed the same `compileSource`. See Loaders below. |
| Parse | 1, 3 | Markdown ATX `##` headings → section map (required headings match case-insensitively). Extract `**Skill:**` and `**MCP:**` refs and the `### Refusal Criteria` body onto `ir.refusalCriteria`. Pure: no env access. |
| Validate | 1, 3 | Required headings + a non-empty `### Refusal Criteria` under Rules & Constraints. Fail closed (`MISSING_REFUSAL`). |
| Resolve | 3 | `resolve.js`: skill slugs to `skills/{category}/{name}.md`, MCP ids to `mcp-protocols/{id}.md` or `.json`. Fails closed, collects every error. See Resolution below. |
| Instantiate | 3 | The provider is chosen by policy; the runtime by a separate switch. `runtime/mastra.js` builds a Mastra agent from the IR around the chosen provider's model (`--runtime mastra`). `mock` always runs direct. See Mastra runtime below. |
| Supervise | 2–3 | Timeouts, fallback list, structured errors, stderr audit JSON (`audit.js` builds the record; the CLI writes it). Actions run `parse`, `validate`, `resolve`, then `run:<provider>`. |

Studio (Sprint 4) and Arena (Sprint 5) sit on top of `supervise`.

## Intermediate representation

See `src/ir.js` and REQUIREMENTS.md §5. `id` is `{domain}/{name}` derived from path (`agents/coding/architect/core.md` → `coding/architect`) or from the H1.

## Resolution

`resolveBlueprint(ir, { repoRoot })` runs after validate. `repoRoot` comes from `opts.repoRoot`, else `NOEMI_REPO_ROOT` (via `config.js`), else this clone's root.

- **Slugs.** Lowercase-hyphen segments of at most 64 characters: `category/name` for skills, `id` for MCP. A leading `skills/` or `mcp-protocols/` and a trailing `.md` (or `.json` for MCP) are stripped first, because real personas use the long form. Anything else is `BAD_SLUG` before the filesystem is touched.
- **Containment.** The repo root, the kind root (`skills/` or `mcp-protocols/`) and each candidate are `realpath`ed. The kind root must sit inside the repo root, and the candidate strictly inside the kind root, or it is `PATH_ESCAPE`. This catches a kind root that is itself a link out of the repo, and links that stay inside the repo but leave the kind root. Only then is the real path `stat`ed and required to be a file.
- **Case.** Where `realpath` reports the on-disk case (Windows), a name that matches only case-insensitively counts as not found, so a persona that resolves there also resolves on Linux CI. Mounts that echo the requested case instead (for example WSL on `/mnt/c`) cannot be checked this way; Linux CI remains the authority.
- **MCP extensions.** A bare id tries `.md`, then `.json`. An explicit `.md` or `.json` in the ref is honored.
- **Errors.** Malformed refs are `BAD_SLUG` before any filesystem access and are reported even when the repo root is unusable. Every ref yields one error or one resolved entry, refs that land on the same file (e.g. `security/pii-scan` and `skills/security/pii-scan.md`) share one entry, and all errors are returned together (`stage: "resolve"`). Messages are fixed text plus the persona's own ref, capped at 80 characters, and never a filesystem path: Node fs messages carry absolute paths, which carry the username, and the CLI copies messages into the audit record. Unexpected fs errors become `RESOLVE_FS` with the error code only.
- **Output.** `{ skills: [{ ref, slug, path }], mcp: [{ ref, id, path }] }`, returned as `resolved` *beside* `ir`, not inside it, so the client-agreed IR (REQUIREMENTS.md §5) is unchanged. Paths are logical, repo-relative and POSIX.
- **No refs, no I/O.** A persona with no `**Skill:**` or `**MCP:**` refs makes no filesystem call at all.
- **Existence only.** The resolver proves a file existed at compile time. Whatever later reads skill or MCP content (Sprint 3 runtime) must re-check containment at read time.
- **Deferred: `skills-dist/`.** REQUIREMENTS §2.1 allows `skills-dist/` too. In a clone it is a byte-identical generated copy of `skills/` (`scripts/audit-repo.js`), so it adds nothing until a dist-only install needs it. A safe fallback would also have to check the category, because `skills-dist/` is keyed by bare name.
- **Tests** pin `repoRoot` to `fixtures/`, so they survive `NOEMI_REPO_ROOT` being set and the package being extracted from this repo. Only the CLI tests use the default root, with the variable cleared.

## Provider policy

Configuration, not code. Providers are `mock` (Sprint 1) and `gemini` and `xai` (Sprint 2). The runtime is a separate switch: `direct` (default) or `mastra` (Sprint 3), set by `--runtime` or `NOEMI_RUNTIME`. Every live provider is called through NewPush's generative AI gateway with one virtual key (`AI_GW_API_KEY`) resolved by `infisical run` / `op run`. Provider credentials stay with NewPush. Never `dotenv`.

Model policy plumbing: `config.js` maps `NOEMI_PREFERRED_PROVIDER` and `NOEMI_FALLBACK_PROVIDERS` to `modelPolicy` (read at call time; empty values count as unset). `compileSource` passes it into `parseBlueprint`, which never touches the environment. `loadRuntime` (also in `config.js`) reads `NOEMI_RUNTIME` the same way.

**Provider and runtime are two layers.** `compile.js` holds a `DIRECT` table (the hand-rolled call per provider) and a `LIVE` table (how each live provider is reached through the gateway: `timeoutVar`, `modelId`). Under `--runtime mastra` each live provider's entry runs `runMastra(ir, input, { provider, ...LIVE[name] })` instead; `mock` has no `LIVE` entry and always runs direct. The model comes from the provider's own setting (`XAI_MODEL`, `GEMINI_MODEL`), exposed as `gatewayModelId()` by each provider module, so there is one place to configure a model. Fallback therefore works between model providers with the runtime held fixed. An unknown runtime is `RUNTIME`; `mastra` as a provider name is `PROVIDER`.

Fallback triggers: timeout, 429 / 5xx / network failure after backoff (`providers/gateway.js`, whose `withGatewayRetry` is the single retry policy for `postJson` and the Mastra runtime alike). A missing key, bad gateway config, an unknown provider name, or an empty/blocked response fails closed up front or immediately, never falls back. A mock-only environment must still complete `npm test`.

## Mastra runtime

`runtime/mastra.js` exports `buildMastraAgent(ir, config)` (IR to agent, no model call), `runMastra(ir, prompt, target, deps)` (`target` is the `LIVE` entry plus the provider name; the result reports the model provider as `provider` and `runtime: "mastra"`), and `loadMastraConfig(target)` (checked up front for every live provider in the chain when the runtime is `mastra`). `@mastra/core` is a dependency of this package only, pinned exactly (`1.71.0`), imported lazily so a mock-only run never loads it.

**Refusal Criteria.** The agent's `instructions` are `buildSystemPrompt(ir)`, so the persona's criteria are copied verbatim into the system slot, as for Gemini and xAI. `buildMastraAgent` throws `MISSING_REFUSAL` for an IR without them: `validate.js` already stops that case, but Studio and Arena will call the runtime directly.

**Spike (Sprint 3, section 4): can Mastra's model layer target the gateway's OpenAI surface with `AI_GW_API_KEY`? Yes.** `spikes/mastra-gateway.mjs` reproduces it against a loopback server. Two traps, both pinned by tests:

| Config | What goes over the wire | Verdict |
|---|---|---|
| `{ id: "xai/grok-4.6", url: base }` | `POST /chat/completions`, `model: "grok-4.6"` | Wrong path and a bare model id the gateway rejects |
| `{ id: "xai/grok-4.6", url: base + "/v1" }` | `POST /v1/chat/completions`, `model: "grok-4.6"` | Right path, still a bare model id |
| `{ providerId: "newpush", modelId: "xai/grok-4.6", url: base + "/v1" }` | `POST /v1/chat/completions`, `model: "xai/grok-4.6"`, `Authorization: Bearer <key>` | **Used.** `url` is a base that Mastra appends `/chat/completions` to |

**Mastra reports failure differently, so the runtime translates it.** Observed on 1.71.0:

| Gateway does | Mastra does | Runtime does |
|---|---|---|
| 429 / 5xx / 4xx | Throws `AI_APICallError` with `.statusCode` (not `.status`) | Rethrows with `.status`, so retry and fallback work |
| Connection refused | `AI_APICallError`, no status | Rethrows as `TypeError("fetch failed")`, the shape `fallback.js` treats as a network failure |
| Hangs past the deadline | **Resolves** with `finishReason: "aborted"` and empty text | Checks the abort signal and throws `TimeoutError` |
| 200 with empty text, a `refusal`, or `content_filter` | **Resolves** successfully | Throws `PROVIDER_EMPTY` (fail closed, never falls back) |
| 200 with `choices: []` | Throws a bare `TypeError` from inside the SDK | Throws `PROVIDER_EMPTY`, not a bug-fallback |

Without that translation a 503 would never fall back and a blocked answer would be returned as a success.

**One retry policy.** The runtime passes `maxRetries: 0` to Mastra and wraps each attempt in `withGatewayRetry`, so `AI_GW_MAX_RETRIES` means the same thing for every provider and a failing gateway is not hit `(Mastra retries) × (ours)` times.

**Silence.** Mastra's default logger prints raw error objects to stderr, which would break the CLI's one-JSON-line audit record. The runtime installs Mastra's `noopLogger`; a test fails if anything reaches stderr.

**Not yet.** Skill and MCP *content* are not loaded into the agent. `resolved` proves the files exist and the prompt names the skills. Loading them (Sprint 4+) must re-check containment at read time. The `mastra` provider has no tools and no streaming yet; Studio's stream view is the first consumer that needs streaming.

Known dependency note: `npm audit` reports a moderate, transitive finding (`sprintf-js` via `gray-matter`, which Mastra uses for front matter). Nothing here passes untrusted strings to it. Re-check when bumping Mastra.

## Loaders

`loaders/file.js`, `loaders/http.js` and `loaders/registry.js` each return `{ markdown, source }`. `compile.js` wraps all three in one `loadThenCompile`, so every source gets the same `compileSource` (parse, validate, resolve, run) and the same structured `stage: "load"` failure (`LOAD`, or `LOAD_CONFIG` for a bad `NOEMI_LOADER_*` value). Loaders read no environment; `config.js` (`loadLoaderConfig`) supplies their settings, and `opts.loader` overrides it.

**HTTP (`loadHttp`).** A URL typed into Studio is attacker-influenced input, so the loader fails closed:

- https only; plain http only for localhost (as in `gateway.js`)
- no credentials, query string, or fragment, so a token cannot reach `source.ref`, the audit record, or an error message
- redirects are not followed: a redirect is how an allowed host becomes an internal one
- a timeout and a hard size cap, enforced while streaming (and by declared `content-length`)
- `text/html` responses are rejected
- optional host allowlist (`NOEMI_HTTP_ALLOWED_HOSTS`)

**Residual risk (SSRF).** With no allowlist, any https host is allowed, including ones that resolve to private addresses. That is acceptable for a CLI a developer runs on their own machine. **Studio must set an allowlist, or add address filtering, before it accepts a user-typed URL.**

**Registry (`loadRegistry`).** A ref is `domain/name[@version]`. Segments must be lowercase-hyphen (at most 64 characters) and the version a tag or branch name with no slash, validated before any URL is built, so neither can add a path segment, query, or host. The URL is then fetched by `loadHttp`, inheriting every rule above.

> **Assumption to confirm with the client.** The 5 August brief never fixed a registry layout. We assumed the public repo addressed by release tag (releases are already tagged `YYYY.MM.DD`):
> `{NOEMI_REGISTRY_URL}/{version}/agents/{domain}/{name}/core.md`, with the base defaulting to `https://raw.githubusercontent.com/project-noemi/agents` and the version to `main`. It is isolated in `registryUrl()`.

## Non-goals (Sprint 1–5)

- Replacing `coding-loop/` (that is how we *build*; this is what we *build*).
- Replacing `newpush-mastra-orchestration` (Slack/Datto chatbot).
- A design system for Studio.
- Inventing security primitives (Presidio, Casdoor, Infisical already exist).
- YAML-first schemas that do not match the live Markdown contract.