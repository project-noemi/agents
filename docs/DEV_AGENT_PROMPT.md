# DEV_AGENT_PROMPT — project-noemi/agents

> **Agent specification library** and reference architecture for Project NoéMI. Defines AI agent personas, MCP integrations, governance frameworks, and value lenses as Markdown. External orchestrators (Gemini CLI, n8n, LangChain) consume generated context files. Node.js 24+ tooling with contract tests, golden-fixture tests, and E2E tests.

---

## 1. Orientation — Read the Docs

Before touching any file, read and internalise:

| Document | Why |
|----------|-----|
| `CLAUDE.md` | Generated context file — architecture, commands, conventions |
| `AGENTS.md` | Master agent registry and composition rules |
| `docs/REQUIREMENTS.md` | Functional and non-functional requirements |
| `docs/METHODOLOGY.md` | The NoéMI methodology (4D framework) |
| `docs/GOVERNANCE.md` | Governance model for agent specifications |
| `docs/AGENT_TEMPLATE.md` | Canonical template — all agents must follow this structure |
| `docs/PROJECT_REFERENCE.md` | Cross-project reference links |
| `docs/PHASE_ZERO_SECURITY_BASELINE.md` | Security baseline requirements |
| `CONTRIBUTING.md` | Contribution guidelines |
| `mcp.config.json` | Active MCP protocol configuration |
| `package.json` | Scripts: `test`, `test:contracts`, `test:golden`, `test:e2e`, `validate`, `audit` |

### Tech Stack

- **Node.js 24+** (see `.node-version`)
- **CommonJS** modules (`"type": "commonjs"`)
- **node:test** built-in test runner (no Jest/Mocha)
- **Markdown** as the primary "code" — agent specs, MCP protocols, value lenses
- **1Password CLI** (`op run`) and **Infisical** for secrets injection
- **Context generation pipeline**: templates + `mcp.config.json` → `scripts/generate_*.js` → `GEMINI.md` / `CLAUDE.md`

### Key Patterns

- **Specs are Markdown**: `agents/` contains domain-organized agent specifications
- **MCP protocols**: `mcp-protocols/` — one `.md` per integration (Slack, Gmail, Google Suite, n8n, etc.)
- **Value lenses**: `value-lenses/` — perspective filters agents apply (balanced-enterprise, care-continuity, performance-efficiency)
- **Skills**: `skills/` — reusable task definitions composed into agent workflows
- **Generated files**: `GEMINI.md` and `CLAUDE.md` are **generated** — never edit directly
- **Templates**: `templates/context/` contains source templates for generation
- **Secrets**: Never hardcode. Use `op run --env-file=.env.template` or `infisical run`
- **Golden fixtures**: `tests/fixtures/` contains expected output snapshots — update via `npm run test:update-fixtures`

---

## 2. Plan — Write a Plan

Before writing code, create a plan in `docs/IMPLEMENTATION_PLAN.md`:

1. **What** — the new agent, MCP protocol, value lens, or tooling change
2. **Specification compliance** — does it follow `docs/AGENT_TEMPLATE.md`?
3. **Governance impact** — does `docs/GOVERNANCE.md` need updating?
4. **Test impact** — which test suites are affected (contracts, golden, E2E)?
5. **Generation impact** — does `mcp.config.json` need updating? Will `GEMINI.md`/`CLAUDE.md` change?
6. **Cross-project impact** — does this affect `project-noemi/website` or other consumers?

---

## 3. Documentation — Write User Docs First

- Agent specs **are** documentation — write them to the canonical template format
- Update `AGENTS.md` when adding/removing/renaming agents
- Update `docs/REQUIREMENTS.md` if adding new functional requirements
- Update `docs/DECISION_LOG.md` with rationale for significant changes
- Update `docs/CLARIFICATIONS.md` for resolved ambiguities
- MCP protocol docs must include: purpose, authentication method, available tools, example usage

---

## 4. Tests — Write Tests First

### Test Suites

```bash
npm test                    # All tests (contracts + golden + examples)
npm run test:contracts      # Contract + generator tests
npm run test:golden         # Golden fixture snapshot tests
npm run test:examples       # Examples smoke tests
npm run test:e2e            # End-to-end tests
npm run validate            # audit + all tests
npm run validate:full       # validate + E2E
```

### Contract Tests (`tests/contracts.test.js`)

- Verify all agent specs have required sections from `AGENT_TEMPLATE.md`
- Verify all MCP protocols have required fields
- Verify `mcp.config.json` references existing protocol files

### Golden Fixture Tests (`tests/golden-fixtures.test.js`)

- Compare generated output against `tests/fixtures/` snapshots
- Update fixtures: `npm run test:update-fixtures` (review diffs carefully)

### Generator Tests (`tests/generators.test.js`)

- Verify `generate_gemini.js` and `generate_claude.js` produce valid output
- Test with various `mcp.config.json` configurations

---

## 5. Code — Write the Code

### Agent Specification Rules

- **Follow `docs/AGENT_TEMPLATE.md` exactly** — required sections are non-negotiable
- Required: Role, Tone, Capabilities, Mission, Rules & Constraints, Boundaries, Workflow, Audit Log, External Tooling Dependencies
- Optional: Tool Usage, Output Format, Journal, Files of Interest
- Place in `agents/{domain}/` — create domain directory if new

### MCP Protocol Rules

- One file per integration in `mcp-protocols/`
- Must document: purpose, auth method, available tools, example usage
- Register in `mcp.config.json` with `enabled: true/false`

### Script Rules

- All scripts in `scripts/` — no inline build logic
- Use `node:` built-in modules where possible
- Read config from `process.env` — no `.env` file parsing
- `generate_*.js` scripts must be idempotent

### Value Lens Rules

- Follow `value-lenses/LENS_TEMPLATE.md` structure
- Place in `value-lenses/`
- Document trade-offs explicitly

---

## 6. Test the Code — Verify Everything

```bash
npm run audit              # Repository structure audit
npm run validate:full      # Full validation (audit + tests + E2E)
node scripts/generate_gemini.js   # Regenerate GEMINI.md
node scripts/generate_claude.js   # Regenerate CLAUDE.md
git diff GEMINI.md CLAUDE.md      # Review generated changes
```

- All tests must pass before PR
- Generated files (`GEMINI.md`, `CLAUDE.md`) must be committed if changed
- Run `npm run audit` to verify repo structure integrity

---

## Branch Workflow

```
feature/* ──► develop ──► main
```

- All work on `feature/*` branches off `develop`
- PR to `develop` for review
- `develop` → `main` via PR only (enforced by CI)
- After merging to `main`, regenerate context files and verify
