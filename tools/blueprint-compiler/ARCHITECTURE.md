# Architecture — NoéMI Blueprint Compiler

Status: agreed in Session 1 (1 September 2026). Package-local. Not a fleet Decision Log entry yet.

## Pipeline

```
source  →  load  →  parse  →  validate  →  resolve  →  instantiate  →  supervise
                                                      └─ mock (Sprint 1)
                                                      └─ mastra agent (Sprint 3)
```

| Stage | Sprint | Notes |
|---|---|---|
|| Load | 1 | `loaders/file.js` (`loadFile`). HTTP + registry in Sprint 3. |
| Parse | 1, 3 | Markdown ATX `##` headings → section map (required headings match case-insensitively). Extract `**Skill:**` and `**MCP:**` refs and the `### Refusal Criteria` body onto `ir.refusalCriteria`. Pure: no env access. |
| Validate | 1, 3 | Required headings + a non-empty `### Refusal Criteria` under Rules & Constraints. Fail closed (`MISSING_REFUSAL`). |
| Resolve | 3 | `resolve.js`: skill slugs to `skills/{category}/{name}.md`, MCP ids to `mcp-protocols/{id}.md` or `.json`. Fails closed, collects every error. See Resolution below. |
| Instantiate | 3 | Build a Mastra agent from IR. Sprint 1 returns a mock agent. |
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

Configuration, not code. Sprint 1 ships only `mock`. Sprint 2 adds Gemini + Grok (xAI), both called through NewPush's generative AI gateway with one virtual key (`AI_GW_API_KEY`) resolved by `infisical run` / `op run`. Provider credentials stay with NewPush. Never `dotenv`.

Model policy plumbing: `config.js` maps `NOEMI_PREFERRED_PROVIDER` and `NOEMI_FALLBACK_PROVIDERS` to `modelPolicy` (read at call time; empty values count as unset). `compileSource` passes it into `parseBlueprint`, which never touches the environment.

Fallback triggers later: timeout, 429 after backoff, 5xx, missing key. A mock-only environment must still complete `npm test`.

## Non-goals (Sprint 1–5)

- Replacing `coding-loop/` (that is how we *build*; this is what we *build*).
- Replacing `newpush-mastra-orchestration` (Slack/Datto chatbot).
- A design system for Studio.
- Inventing security primitives (Presidio, Casdoor, Infisical already exist).
- YAML-first schemas that do not match the live Markdown contract.
