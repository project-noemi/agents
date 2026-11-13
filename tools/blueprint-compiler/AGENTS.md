# 🔐 Secrets & Configuration

This package follows Project NoéMI Phase 0 Security. Credentials live in Infisical or 1Password and are injected at runtime. They are never written to disk.

- NEVER ask for secrets in chat or issue comments.
- NEVER hardcode secret values in source, fixtures, `.env`, or logs.
- ALWAYS wrap credentialed commands:
  - `infisical run --env=dev -- <command>`
  - `op run --env-file=.env.template -- <command>`
- Read configuration from `process.env`. Do not add dotenv loaders.

Sprint 1 needs no secrets. `npm test` and the mock CLI must stay offline.

# 🛡 Error Handling

- Fail closed on missing required persona headings or missing Refusal Criteria.
- Transient HTTP 429 / 5xx (Sprint 2+): exponential backoff, then a structured error. Do not silently swap in a success.
- Technical errors go to `stderr`. Audit logs are JSON on `stderr`, separate from the user-facing payload.

# 🚀 How this team builds

Use the NoéMI coding loop in `coding-loop/`. Do not invent a parallel process.

1. Open an issue with an observable problem, an in-scope path, and a checkable done condition.
2. Write a plan. Red-team the plan before coding.
3. Implement on a branch from `develop`. One concern per PR.
4. Producer opens the PR. Conductor comments. Reviewer posts findings and does not approve.
5. Humans merge only when CI is green.

Node.js 24 is the baseline. Conventional commits: `feat(compiler)`, `fix(validate)`, `test(parse)`, `docs(compiler)`.

# 📝 Compiler contract

- Input is a NoéMI Markdown persona (`docs/AGENT_TEMPLATE.md` headings).
- Output of Sprint 1 is a Blueprint IR plus a mock completion, not a live model call.
- Missing Refusal Criteria is a hard error.
- Extract `**Skill:** \`category/name\`` references onto `ir.skills`.
- Do not target `newpush/newpush-mastra-orchestration`.
- Do not add Mastra or provider SDKs to the repository root `package.json`.

# 🧑 Role alignment

- Explorer (client): sets sprint priorities and acceptance.
- Practitioner (student team): turns priorities into issues, plans, and PRs.
- Accelerator (NewPush reviewer + repo gates): enforces the Refusal Principle and merge policy.
