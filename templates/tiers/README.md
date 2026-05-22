# Client Tier Templates

This directory provides **starter `mcp.config.json` templates** for the three canonical client tiers used by the [Client Onboarding agent](../../agents/operations/client-onboarding.md):

- `basic.mcp.config.json` — Minimum-viable fleet for evaluation tenants.
- `standard.mcp.config.json` — Production-ready Workspace and Slack collaboration fleet.
- `premium.mcp.config.json` — Full Workspace, governance, and dashboard fleet.

The Client Onboarding workflow copies one of these templates into `clients/<client-id>/mcp.config.json` during the **PROVISION** phase, then customizes the payload for client-specific parameters before invoking `node scripts/generate_all.js --config=clients/<client-id>/mcp.config.json`.

## Schema

Every tier file conforms to the same schema as the repository root `mcp.config.json`:

```json
{
  "active_mcps": ["..."],
  "active_skills": ["..."]
}
```

`active_mcps` entries must map to files in `mcp-protocols/`; `active_skills` entries must map to files in `skills/`. The repository audit script enforces this referential integrity once enabled.

## Tier escalation

Tiers compose by **superset** — `standard` includes everything in `basic` plus more; `premium` includes everything in `standard` plus more. The Client Onboarding agent uses this property to support tier upgrades without re-provisioning from scratch.
