# Blueprint Compiler

Isolated package that turns a NoéMI Markdown persona into a Blueprint IR and (in Sprint 1) a mock completion.

This is not the fleet spec library. Specs live in `agents/`, `skills/`, and `mcp-protocols/`. This package *reads* them.

```bash
cd tools/blueprint-compiler
npm test
node src/cli.js compile fixtures/architect.core.md --provider mock --prompt "hello"
```

No network. No API keys. Node.js ≥ 24.

## Sprint 1

- Parse `##` headings into `ir.sections`
- Extract `**Skill:** \`category/name\`` onto `ir.skills`
- Fail closed when a required heading or `### Refusal Criteria` is missing
- Run the mock provider

Live providers (Gemini + Grok), skill resolution, and Mastra instantiation are later sprints. See [REQUIREMENTS.md](REQUIREMENTS.md).

## Why it lives here

`tools/` already hosts runnable Node packages (`executive-assistant/`, `roi/`) next to the spec library. This package follows that convention with its own `package.json`, so root `npm run validate` stays a spec-only gate.

## Requirements and architecture

- [REQUIREMENTS.md](REQUIREMENTS.md) — Field Session requirements (proposal intent + 1 Sep 2026 amendments)
- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline and IR
- [AGENTS.md](AGENTS.md) — secrets, loop, and package contract
