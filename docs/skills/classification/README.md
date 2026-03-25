# Classification Skills

Skills for categorizing items into discrete tiers to determine action paths.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Risk Triage](../../../skills/classification/risk-triage.md) | Multi-tier categorization (Safe / Needs Review / Blocked) | Gatekeeper, PIIGuard, PromptShield |

## Pattern

Classification skills follow a common pattern:
1. Check for escape hatches (skip conditions)
2. Evaluate against criteria from most restrictive to least restrictive
3. Default to the conservative tier when uncertain
4. Annotate with the specific criteria that triggered the classification
