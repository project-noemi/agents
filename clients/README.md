# Clients Directory

This directory is the runtime root for **per-client tenant configurations** provisioned by the [Client Onboarding agent](../agents/operations/client-onboarding.md).

It is intentionally empty in the public reference architecture — actual client tenants are environment-specific and managed by operators in their own forks or deployments. Each provisioned client lives at `clients/<client-id>/` and typically contains:

- `mcp.config.json` — per-client active MCP and skill assignment
- `GEMINI.md` — generated context, vendored per client (produced via `node scripts/generate_all.js --config=clients/<client-id>/mcp.config.json`)
- `notes.md` — operator-managed handoff notes (never secrets — secrets live in the vault)

## Why the directory exists in the upstream repository

The `Client Onboarding` persona, `Fleet Dashboard` persona, and several decision-log entries reference `clients/` as a canonical onboarding sink. Pre-creating this directory with a `.gitignore` and a `README.md`:

1. Makes the agent specifications "truthful" — workflows that write to `clients/<client-id>/` succeed in a fresh fork without manual `mkdir`.
2. Documents the expected layout for forking organizations.
3. Keeps actual client material out of source control via the local `.gitignore`.

## Security

- **Never** commit real client material to the upstream `project-noemi/agents` repository.
- Secrets remain in Infisical or 1Password — `mcp.config.json` files may reference vault paths, never literal secret values.
- The `.gitignore` enforces "empty in upstream" by default; remove or amend it in your own fork only if you intentionally vendor sanitized client templates.
