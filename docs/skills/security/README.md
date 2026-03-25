# Security Skills

Skills for cryptographic operations and data privacy enforcement.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [HMAC Sign & Submit](../../../skills/security/hmac-sign-submit.md) | Sign payloads with HMAC-SHA256 and submit to authenticated APIs | Gatekeeper, Fleet Dashboard |
| [PII Scan](../../../skills/security/pii-scan.md) | Detect and redact PII from data payloads | PIIGuard |

## Pattern

Security skills enforce the Fetch-on-Demand principle:
- Signing secrets and auth tokens are resolved from the vault at runtime
- Skills never log, store, or expose secret values
- All operations produce an audit trail (without the secrets themselves)
