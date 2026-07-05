# Premium Service Tier

The **Premium** tier is for organizations running Project NoéMI at fleet scale
across multiple departments or tenants, with formal compliance obligations
(SOC-2, HIPAA-adjacent, ISO 27001) and 24/7 operational expectations.

## Positioning

- **Audience**: Multi-department deployments, MSSPs, or regulated industries.
- **Primary value**: Multi-tenant isolation, formal identity, continuous
  Red Team validation, and quarterly business review (QBR) reporting.
- **Time horizon**: Ongoing; Premium is a steady state, not a phase.

## Provisioned MCPs

Premium includes everything in Standard **plus**:

| MCP | Purpose |
|-----|---------|
| `google-admin` | Workspace admin operations with per-action approval. |
| `google-meet`, `google-chat` | Meeting and chat automation. |
| `google-forms`, `google-slides`, `google-keep` | Full Workspace surface. |
| `google-contacts` | CRM sync with human-in-the-loop. |
| Custom MCPs | Tenant-defined additions per SOW. |

## Provisioned Skills

Premium includes everything in Standard **plus** any tenant-specific skills
authored under `skills/` and enabled in the tenant's `mcp.config.json`.

## Onboarding Validation Suite

In addition to all Standard-tier checks:

9. Casdoor identity layer is provisioned and every agent path enforces JWT
   validation at the ingress boundary.
10. Full multi-tenant Fleet Dashboard is provisioned with per-tenant HMAC
    secrets and asynchronous verification of mutating claims.
11. Continuous Red Team Gauntlet: the full vector set (`PI-001..PI-003`,
    `PII-001..PII-002`) runs on a scheduled cadence (weekly minimum).
12. QBR Presenter agent is configured for scheduled quarterly reports.
13. The buyer has an incident response runbook that includes an agent
    kill-switch and a documented rollback procedure.

## Guardrails and Refusal Behavior

- Cross-tenant boundary is enforced at the identity layer (Casdoor JWT) and
  in every agent's `Rules & Constraints` refusal criteria.
- All mutating actions are HMAC-signed and asynchronously verified.
- Any Audit Log emission that fails schema validation triggers a fleet-wide
  alert to the Accelerator on call.

## Retention and Observability

- Detailed reports retained 90 days in the primary bucket; downsampled
  aggregates retained 1+ year in a secondary bucket.
- Full audit trail archived to cold storage per the tenant's compliance
  requirement.
- Fleet Dashboard supports per-tenant scoped views.

## Upgrade Path

Premium is the top tier in the reference architecture. Additional scope is
delivered through a bespoke SOW rather than a new tier.
