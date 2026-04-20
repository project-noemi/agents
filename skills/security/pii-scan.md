# PII Scan — Security Skill

## Purpose
Scan a data payload for Personally Identifiable Information (PII) and sensitive data patterns, then classify, redact, or block the payload accordingly. This skill extracts the core detection and redaction logic used by Guardian agents into a reusable component that any agent can invoke before sending data to external systems.

## Inputs
- **payload** — The data to scan (string, JSON, or structured document)
- **context** — Where the payload is headed: `public_api` (external LLM, SaaS), `walled_garden` (internal/local model), or `internal_log` (audit storage)
- **redaction_mode** — `auto` (attempt redaction), `strict` (block if any PII found), or `report_only` (scan but don't modify)

## Procedure
1. **Pattern scan** — Search the payload for known PII patterns:
   - Social Security Numbers (XXX-XX-XXXX)
   - Credit card numbers (Luhn-valid sequences)
   - Email addresses
   - Phone numbers
   - Private health information (PHI) markers
   - API keys, connection strings, and credential patterns
   - Physical addresses
2. **Classify sensitivity** — Assign the payload to a tier:
   - **Public** — No PII detected. Safe for any destination.
   - **Internal** — Contains internal identifiers or business data. Safe for walled garden, not for public APIs.
   - **Confidential/PII** — Contains PII or credentials.
3. **Apply action based on context + classification:**
   - Public payload → any context: `APPROVED`
   - Internal payload → `walled_garden` or `internal_log`: `APPROVED`
   - Internal payload → `public_api`: `FLAGGED`
   - Confidential payload + `auto` mode: Attempt redaction → `REDACTED`
   - Confidential payload + `strict` mode: `BLOCKED`
   - Confidential payload where redaction destroys utility: `BLOCKED`
4. **Redact** (if applicable) — Replace detected PII with typed placeholders: `[REDACTED_SSN]`, `[REDACTED_CC]`, `[REDACTED_EMAIL]`, etc. Preserve semantic structure.
5. **Return** — Provide the scan result with classification, action, and sanitized payload.

## Outputs
- **status** — `APPROVED`, `FLAGGED`, `REDACTED`, or `BLOCKED`
- **classification** — `public`, `internal`, or `confidential`
- **findings** — List of detected patterns with type and location
- **payload** — Original (if approved) or sanitized (if redacted) payload
- **reason** — Human-readable explanation of the decision

```json
{
  "status": "REDACTED",
  "classification": "confidential",
  "findings": [
    { "type": "SSN", "location": "summary field", "redacted": true },
    { "type": "credit_card", "location": "summary field", "redacted": true }
  ],
  "payload": "New hire [REDACTED_NAME] completed orientation. SSN: [REDACTED_SSN], card: [REDACTED_CC]. Please process.",
  "reason": "2 PII patterns detected and redacted. Semantic structure preserved."
}
```


## Rules & Constraints (4D Diligence)
1. **Atomic Logic:** This skill must perform exactly one logical task.
2. **Standard Output:** Always return data in the mandated structured format.
3. **Safety Gating:** Adhere to all defined Boundaries and never exceed authorized tool usage.
## Boundaries
- **Always:** Scan every payload before forwarding to external systems. Use typed placeholders that indicate what was redacted. Log scan results (without the PII itself) for audit.
- **Ask First:** Changing redaction patterns. Allowing a Confidential payload through in `report_only` mode.
- **Never:** Forward unscanned payloads to public APIs. Include actual PII values in scan result logs. Attempt to answer the user's underlying question — this skill is a compliance filter only.

## Audit Log
{
  "task": "...",
  "inputs": [],
  "actions": [],
  "risks": [],
  "result": "..."
}
