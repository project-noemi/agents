# Phase 0 Security — SecretOps Baseline

This directory holds the baseline secure-execution boilerplate that establishes
the organization's data perimeter **before** any AI workload is deployed — the
step Project NoéMI calls **Phase 0 Security**.

It is the same "Fetch-on-Demand" model documented in
[`../../docs/tool-usages/secure-secret-management.md`](../../docs/tool-usages/secure-secret-management.md)
and mandated by [`../../AGENTS.md`](../../AGENTS.md): secrets live only in a
SecretOps vault, are injected into process memory at launch, and are never
written to disk, committed to Git, or pasted into chat.

## Files

- `agent_logic.py` — Illustrative Python entrypoint that initializes an LLM
  client and runs a trivial agentic task. Required secrets (`OPENAI_API_KEY`,
  `ERP_DATABASE_URL`) are read **only** from `os.environ`. If the vault wrapper
  was bypassed, it fails deadly (`Phase0SecurityError` → `sys.exit(1)`) instead
  of falling back to a local file or default key.

> **Note:** Per [`REQUIREMENTS.md` Section 8](../../docs/REQUIREMENTS.md), Python
> here is **LEGACY/ILLUSTRATIVE**. The canonical implementation path for Project
> NoéMI is Node.js.

## How to Run (the only supported launch path)

Secrets are resolved at runtime by the vault CLI using a scoped **Machine
Identity** — never a hardcoded key or a `.env` file on disk:

```bash
# Infisical (NewPush Labs default)
infisical run --env=dev -- python agent_logic.py

# 1Password equivalent (vault-reference manifest, not plaintext)
op run --env-file=.env.template -- python agent_logic.py
```

Running it any other way is the point of failure the script is designed to
catch: without the wrapper, the secrets are absent and the run aborts loudly.

## Why this exists

It makes "Shadow AI" impossible by construction. There is no `.env` parsing, no
`python-dotenv`, and no default credential — so the organization's proprietary
"Secret Sauce" (ERP data, keys, IP) cannot leak into git history, prompt logs,
or third-party model context through a convenient shortcut.
