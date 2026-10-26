# Compliance Skills

Skills for legal and regulatory compliance workflows: copyright enforcement, abuse handling, and jurisdiction-specific mandated procedures for hosting and platform providers.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Abuse Takedown](../../../skills/compliance/abuse-takedown.md) | Execute compliant copyright/DMCA/abuse takedown notice workflows; optional jurisdiction references and bilingual templates | Hosting/SaaS/platform operations; abuse response agents |

## Pattern

Compliance skills enforce legal mandates while preserving operational safety:
- Human approval gates for customer-impacting actions
- Legal review gates for counter-notices and restoration
- Strict input validation to prevent command injection
- All credentials via SecretOps; never hardcoded or logged
- Jurisdiction-specific frameworks as optional references (loaded on demand)
- Factual communication without liability statements
