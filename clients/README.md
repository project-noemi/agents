# Client Tenants

This directory holds provisioned client configurations produced by the `Client Onboarding` agent (`agents/operations/client-onboarding.md`).

Tenant subdirectories are intentionally **not committed** (see `.gitignore`). They contain client-specific MCP configs, vault references, and dashboard registrations that should live only in the runtime environment, not in the public reference repository.

## Layout

```
clients/
  <client-slug>/
    mcp.config.json
    context/
    onboarding-report.json
```

## Provisioning

Tier defaults come from [`templates/tiers/`](../templates/tiers/README.md). The onboarding agent copies a tier template, substitutes the client slug, and writes the materialized configuration here.
