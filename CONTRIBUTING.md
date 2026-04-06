# Contributing to Project NoeMI Agents

Project NoeMI is both a public reference architecture and an agent specification library. Contributions should strengthen that dual role: the docs should tell the truth, and the runnable examples, generators, and tests should support that truth.

## Before You Change Anything

Read the repo contract first:

1. [AGENTS.md](AGENTS.md)
2. [README.md](README.md)
3. [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)
4. [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
5. [docs/DECISION_LOG.md](docs/DECISION_LOG.md)

If you are changing a specific area, read the closest guide too:

- Builder path: [docs/examples/builder-first-30-minutes.md](docs/examples/builder-first-30-minutes.md)
- Docker path: [docs/examples/docker-agent-home.md](docs/examples/docker-agent-home.md)
- Secret handling: [docs/tool-usages/secure-secret-management.md](docs/tool-usages/secure-secret-management.md)
- Client security framing: [docs/PHASE_ZERO_SECURITY_BASELINE.md](docs/PHASE_ZERO_SECURITY_BASELINE.md)

## Security Rules

- Never ask for secrets in chat or in issue comments.
- Never commit real credentials, `.env` secrets, tokens, or copied vault values.
- Use Fetch-on-Demand patterns only:
  - `infisical run --env=dev -- <command>`
  - `op run --env-file=.env.template -- <command>`
- Treat `.env.template` and example `.env.example` files as inventories or vault-reference manifests only.

## Local Setup

From the repo root, use the preflight that matches your machine:

```bash
bash scripts/verify-env.sh --mode=builder
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-env.ps1 -Mode builder
```

Then run:

```bash
node scripts/generate_all.js
npm run validate
```

If your change touches Docker examples or runtime-facing stack behavior, also run:

```bash
npm run test:e2e
```

If Docker is unavailable in your environment, call that out in your PR instead of claiming the smoke suite passed.

## What to Regenerate

Run `node scripts/generate_all.js` when you change any of the following:

- `AGENTS.md`
- `agents/`
- `skills/`
- `mcp-protocols/`
- `mcp.config.json`
- `templates/context/GEMINI.template.md`
- `templates/context/CLAUDE.template.md`
- generator helper logic in `scripts/`

Generated outputs are committed to the repo. CI checks that `GEMINI.md` and `CLAUDE.md` stay fresh.

## Validation Expectations

The canonical fast gate is:

```bash
npm run validate
```

That runs:

- the repository audit
- contract tests
- generator determinism checks
- golden fixture checks
- example smoke checks

Use `npm test` directly only when you intentionally want the test suite without the audit wrapper.

If you intentionally change generated-context sections, refresh the golden fixtures with:

```bash
npm run test:update-fixtures
```

Then rerun:

```bash
npm run validate
```

## Contribution Guidelines by Area

### Docs

- Keep `docs/PROJECT_REFERENCE.md` as the canonical public narrative.
- Keep `docs/REQUIREMENTS.md` as current implementation truth, not a stale drift graveyard.
- Keep `docs/DECISION_LOG.md` focused on durable decisions, not temporary work notes.
- Prefer buyer-safe, diagnostic language in Phase 0 content. Do not turn repo docs into sales collateral.

### Personas and Generators

- All personas must keep the required headings:
  - `Role`
  - `Tone`
  - `Capabilities`
  - `Mission`
  - `Rules & Constraints`
  - `Boundaries`
  - `Workflow`
  - `External Tooling Dependencies`
  - `Audit Log`
- Keep Gemini and Claude generator behavior aligned unless there is a deliberate, documented reason to diverge.

### Examples

- Examples should reflect the documented security and governance model.
- Do not introduce local `.env` parsing logic.
- Use runtime env access (`process.env`, `os.getenv()`), not checked-in secrets or dotenv loaders.
- Historical Python examples may remain, but do not present them as the recommended first path for new builders.

## Pull Request Expectations

Every PR should explain:

- what changed
- why it changed
- which audience path it affects:
  - Client / Buyer
  - MSP / MSSP
  - Builder / Accelerator
- what validation was run
- whether Docker smoke validation was run, skipped, or not applicable

If you changed docs, examples, generators, or repo contracts, include enough context for a reviewer to see how the change aligns with Project NoeMI's reference-architecture role.

## Commit Style

Use short, descriptive commit subjects. The repo commonly uses prefixes like:

- `docs(...)`
- `feat(...)`
- `fix(...)`
- `ci(...)`
- `test(...)`

## When in Doubt

Favor the option that makes the repository more truthful, more secure, and easier to validate.
