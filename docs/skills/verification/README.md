# Verification Skills

Skills for validating preconditions before action and verifying claims after action.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Pre-Flight Check](../../../skills/verification/pre-flight-check.md) | Validate preconditions, create backups, assess risk | Linux SysAdmin, cPanel |
| [Cross-Reference](../../../skills/verification/cross-reference.md) | Verify claimed actions against source of truth | Fleet Dashboard |

## Pattern

Verification skills are split into two phases:
- **Pre-action** (Pre-Flight Check) — Ensure it's safe to proceed
- **Post-action** (Cross-Reference) — Confirm what happened matches what was reported
