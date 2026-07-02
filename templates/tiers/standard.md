# Standard Service Tier

The **Standard** tier is the recommended baseline for buyers who have cleared
Phase 0, completed a Basic-tier pilot, and are ready to give agents bounded
mutating access to their operational systems.

## Positioning

- **Audience**: Departments or business units with a defined workflow owner.
- **Primary value**: Move agent-assisted workflows from "draft-only" to
  "human-approved-then-execute" with full audit and rollback.
- **Time horizon**: 60–120 days from Basic-tier graduation to Standard steady
  state.

## Provisioned MCPs

Standard includes everything in Basic **plus**:

| MCP | Purpose |
|-----|---------|
| `gmail` (send) | Send after human approval; every send is logged. |
| `google-calendar` | Read+write with per-event approval gate. |
| `google-docs`, `google-sheets` | Read+write with change-scoped approval. |
| `slack` | Read+send with channel-scoped consent. |
| `n8n` | Workflow execution with per-run audit trail. |
| `github` (write) | PRs and comments, never direct pushes to protected branches. |

## Provisioned Skills

Standard includes everything in Basic **plus**:

- `verification/cross-reference`
- `reporting/alert-notify`
- `security/hmac-sign-submit`
- `orchestration/dispatch-coordinate`

## Onboarding Validation Suite

In addition to all Basic-tier checks:

5. Red Team Gauntlet PIIGuard vector `PII-002` returns `BLOCKED`.
6. Gatekeeper deployment example smoke test passes (`npm run test:examples`).
7. Branch protection is verified on the buyer's repository (per Decision
   [2026-05-20] Branch Protection: Mandatory Enforcement).
8. The buyer has designated a **Practitioner** and an **Accelerator** by role
   (per the human-AI collaboration model).

## Guardrails and Refusal Behavior

- Mutating actions require explicit human approval per action; no batch-approve.
- Every action emits a JSON Audit Log entry with `task`, `inputs`, `actions`,
  `risks`, `result`.
- Agents refuse cross-tenant data access. Any request that would join data
  from more than one client scope is blocked and escalated.

## Retention and Observability

- Fleet Dashboard is provisioned in single-tenant mode with HMAC-signed
  ingestion at `/api/v1/reports` (Decision [2026-05-20]).
- Detailed reports retained 90 days; aggregate summaries retained 1 year.
- Grafana + InfluxDB stack per `examples/gatekeeper-deployment/`.

## Upgrade Path

Move to `premium.md` when: (a) the buyer needs multi-tenant fleet operation,
(b) more than one department is running agent workflows, or (c) SOC-2 /
regulated-industry compliance is on the roadmap.
