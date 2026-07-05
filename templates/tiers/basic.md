# Basic Service Tier

The **Basic** tier is the entry-level Project NoéMI service package for buyers
starting from a "Phase 0" security posture and evaluating agent-assisted
workflows in a bounded, low-risk surface.

## Positioning

- **Audience**: Small teams or single-department pilots.
- **Primary value**: Prove that agent-assisted workflows can be deployed safely
  in a "Walled Garden" without disrupting existing systems.
- **Time horizon**: 30–60 days from onboarding to first measurable win.

## Provisioned MCPs

| MCP | Purpose |
|-----|---------|
| `gmail` | Read-only triage and summarization. No sending. |
| `google-drive` | Read-only reference lookups. |
| `web-search` | Grounded factual lookups for agent responses. |
| `github` | Read-only repository awareness (optional). |

Mutating MCPs (send-mail, calendar-write, sheets-append) are **not**
provisioned at this tier. All actions surface as human-in-the-loop drafts.

## Provisioned Skills

- `verification/pre-flight-check`
- `classification/risk-triage`
- `reporting/structured-report`
- `security/pii-scan`

## Onboarding Validation Suite

The Client Onboarding agent must complete the following before the tier is
marked "ready":

1. `scripts/verify-env.sh --mode=builder` passes with a SecretOps CLI present.
2. Red Team Gauntlet PromptShield vectors (`PI-001`, `PI-002`, `PI-003`) all
   return `BLOCKED`.
3. Red Team Gauntlet PIIGuard vector `PII-001` returns a redacted payload.
4. `npm run validate` passes.

## Guardrails and Refusal Behavior

- All agents refuse tasks that require write access to systems not listed
  above.
- All agents emit a JSON Audit Log to `stderr` per Decision [2026-04-13].
- Human approval is required for every outbound message; no auto-send.

## Retention and Observability

- Fleet Dashboard: **not** provisioned (Basic tier does not include the
  multi-tenant observability stack).
- Agent logs retained locally by the orchestrator; retention policy is the
  buyer's responsibility.

## Upgrade Path

Move to `standard.md` when: (a) the buyer has completed the Phase 0 Assessment
Kit with an "AI-ready" recommendation, and (b) the pilot has demonstrated at
least one measurable ROI win in `tools/roi/`.
