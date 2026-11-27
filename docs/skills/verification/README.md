# Verification Skills

Skills for validating preconditions before action and verifying claims after action.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Pre-Flight Check](../../../skills/verification/pre-flight-check.md) | Validate preconditions, create backups, assess risk | Linux SysAdmin, cPanel |
| [Cross-Reference](../../../skills/verification/cross-reference.md) | Verify claimed actions against source of truth | Fleet Dashboard |
| [Complete Retrieval](../../../skills/verification/complete-retrieval.md) | Answer "there are none" only when the whole source was read | Any agent reporting from a paginated source |
| [Date Table](../../../skills/verification/date-table.md) | Give the model dates and weekdays to read, never to work out | Any agent answering questions about dates or schedules |

## Pattern

Verification skills are split into two phases:
- **Pre-action** (Pre-Flight Check) — Ensure it's safe to proceed
- **Post-action** (Cross-Reference) — Confirm what happened matches what was reported

Complete Retrieval sits beside both: it verifies that a claimed *absence* had the whole source behind it.
