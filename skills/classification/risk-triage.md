# Risk Triage — Classification Skill

## Purpose
Categorize items into risk tiers to determine the appropriate action path. This skill standardizes the pattern of multi-tier classification used across triage agents (PR review, data privacy, prompt security) so that the classification logic, output format, and escalation rules are consistent fleet-wide.

## Inputs
- **item** — The entity to classify (PR metadata, data payload, user prompt, alert, etc.)
- **criteria** — A set of rules provided by the calling agent that define what qualifies for each tier
- **tiers** — The classification tiers to use (defaults to three-tier: Safe / Needs Review / Blocked)
- **escape_hatch** — Optional label or flag that causes the item to be logged as "Skipped" with no action

## Procedure
1. **Check escape hatch** — If the item carries the escape hatch flag, log it as `SKIPPED` and return immediately.
2. **Evaluate against criteria** — Test the item against the calling agent's criteria, starting from the most restrictive tier (Blocked) down to the least restrictive (Safe).
3. **Classify** — Assign the item to the first matching tier. If no tier matches, default to the middle tier (Needs Review) — never default to Safe.
4. **Annotate** — Record which specific criteria triggered the classification. This becomes the audit trail.
5. **Return** — Provide the classification result with tier, reasoning, and matched criteria.

## Outputs
- **tier** — The assigned classification (e.g., `SAFE`, `NEEDS_REVIEW`, `BLOCKED`, `SKIPPED`)
- **reasons** — List of criteria that determined the classification
- **confidence** — `high` (all criteria clearly matched) or `low` (ambiguous — defaulted to conservative tier)

```json
{
  "tier": "NEEDS_REVIEW",
  "reasons": ["CI check pending", "Author is external contributor"],
  "confidence": "high"
}
```

## Boundaries
- **Always:** Default to the conservative (middle) tier when uncertain. Include the full reasoning in the output.
- **Ask First:** Overriding a Blocked classification to a lower tier.
- **Never:** Classify an item as Safe when any criterion is ambiguous or unresolvable. Skip the escape hatch check.

## Examples

**PR Triage (Gatekeeper agent):**
- Input: PR with passing CI, 12 lines changed, docs-only, org member author
- Criteria: Gatekeeper Rule #2 (all conditions met)
- Output: `{ "tier": "SAFE", "reasons": ["CI green", "docs-only", "<300 LOC", "org member"], "confidence": "high" }`

**Data Privacy (PIIGuard agent):**
- Input: JSON payload containing "SSN: 999-00-1234"
- Criteria: PIIGuard classification (Confidential/PII patterns)
- Output: `{ "tier": "BLOCKED", "reasons": ["SSN pattern detected"], "confidence": "high" }`
