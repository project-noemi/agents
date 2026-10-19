# Compliance Skills

Skills for legal and regulatory compliance workflows, including copyright enforcement, abuse handling, and jurisdiction-specific mandated procedures for hosting and MSP providers.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Abuse Takedown](../../../skills/compliance/abuse-takedown.md) | Execute compliant copyright/DMCA/abuse takedown notice workflows across jurisdictions | MSP/Hosting Operations; abuse response or support agents |

## Pattern

Compliance skills enforce legal mandates while preserving operational safety:
- Human approval gates are mandatory for customer-impacting actions (disable, suspend)
- Legal review gates are mandatory for counter-notices and restoration decisions
- Jurisdiction frameworks (US DMCA 512, EU DSA, national laws) are modular parameters
- All credentials resolved from SecretOps at runtime; never hardcoded or logged
- Bilingual customer notices generated per jurisdiction requirements
- Structured audit logs exclude secrets and PII
- Communication is factual: state actions and timestamps without liability statements
