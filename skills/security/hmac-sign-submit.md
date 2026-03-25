# HMAC Sign & Submit — Security Skill

## Purpose
Sign an outgoing payload with HMAC-SHA256 and submit it to a receiving API that verifies agent identity and payload integrity. This skill implements the cryptographic trust layer used by agents reporting to the Fleet Dashboard or any API that requires authenticated, tamper-evident submissions.

## Inputs
- **payload** — The JSON body to sign and submit (will be serialized with deterministic key ordering)
- **signing_secret** — The agent's HMAC secret (resolved from vault at runtime, never hardcoded)
- **api_url** — The target API endpoint
- **auth_token** — Bearer token for API authentication (resolved from vault at runtime)

## Procedure
1. **Serialize** — Convert the payload to a JSON string with deterministic key ordering (keys sorted alphabetically). This ensures the same payload always produces the same signature.
2. **Sign** — Compute `HMAC-SHA256(signing_secret, serialized_payload)` and encode as hex.
3. **Build headers** — Construct the request with:
   - `Content-Type: application/json`
   - `Authorization: Bearer <auth_token>`
   - `X-Signature-256: sha256=<hex_signature>`
4. **Submit** — POST the serialized payload to `api_url` with the constructed headers. Apply a 30-second timeout.
5. **Handle response:**
   - `200-299` — Success. Return the response body.
   - `401` — Authentication failure. Log the error and alert via Slack. **Do not retry with different credentials.**
   - `429` — Rate limited. Apply exponential backoff (max 3 retries).
   - `5xx` — Server error. Retry once after 5 seconds. If still failing, log and alert.

## Outputs
- **submitted** — Boolean indicating successful submission
- **status_code** — HTTP response status code
- **response** — Response body from the API (if successful)
- **signature** — The hex-encoded HMAC signature that was sent (for audit logging)

```json
{
  "submitted": true,
  "status_code": 200,
  "response": { "id": "report-123", "status": "accepted" },
  "signature": "a1b2c3d4e5f6..."
}
```

## Boundaries
- **Always:** Use deterministic key ordering for serialization. Include both Bearer token and HMAC signature. Log every submission attempt (success or failure) with timestamp.
- **Ask First:** Retrying after a 401 response. Changing the signing algorithm.
- **Never:** Log or expose the signing secret or auth token in outputs. Retry 401 responses automatically. Submit without both authentication headers.

## Examples

**Fleet Dashboard submission (Gatekeeper agent):**
```bash
BODY='{"agent_id":"gatekeeper","cycle_timestamp":"2026-03-17T12:00:00Z",...}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')
curl -X POST "$DASHBOARD_API_URL/api/v1/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DASHBOARD_AUTH_TOKEN" \
  -H "X-Signature-256: sha256=$SIGNATURE" \
  -d "$BODY"
```
