# n8n MCP Setup

Setup guide for the **n8n API and workflow-management surface** used by Project NoeMI.

Important: this guide covers how a runtime talks to **n8n itself**. It does **not** configure Gmail, Google Docs, Google Sheets, Google Drive, or Gemini nodes inside n8n. Those are separate credentials inside the n8n editor.

If you want the user-first Google automation path, start here instead:

- [`../examples/n8n-google-workspace-quickstart.md`](../examples/n8n-google-workspace-quickstart.md)
- [`google-n8n-credential-matrix.md`](google-n8n-credential-matrix.md)

## Prerequisites

- A running n8n instance (self-hosted or n8n Cloud)
- Admin access to generate API keys

## Authentication

n8n MCP authenticates via an **API key**.

1. In your n8n instance, go to **Settings → API → API Keys**.
2. Create a new API key with appropriate permissions.
3. Store the key in your vault:
   ```bash
   op item create --category=login \
     --title="n8n MCP" \
     --field="api_key=YOUR_API_KEY" \
     --field="base_url=https://your-n8n-instance.example.com"
   ```
4. Reference in your environment:
   ```
   N8N_API_KEY=op://Vault/n8n MCP/api_key
   N8N_BASE_URL=op://Vault/n8n MCP/base_url
   ```

## Connection

| Variable | Description |
|----------|-------------|
| `N8N_API_KEY` | n8n API key |
| `N8N_BASE_URL` | Base URL of the n8n instance (e.g., `https://n8n.example.com`) |

For the fleet deployment example, each cohort has its own n8n instance — see `examples/fleet-deployment/docker-compose.yml`.

## What This Does Not Configure

The n8n API key path does not automatically configure:

- Gmail node credentials
- Google Docs / Sheets / Drive credentials
- Google Gemini credentials
- workflow-level OAuth scopes for downstream apps

Treat those as separate setup work inside n8n.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `401 Unauthorized` | Invalid or expired API key | Regenerate the key in n8n settings |
| `ECONNREFUSED` | n8n instance is down or unreachable | Check that the instance is running and the URL is correct |
| `404 /api/v1/workflows` | API not enabled on the instance | Enable the public API in n8n settings |
| API key setup unavailable | Plan or instance configuration does not expose the API | Verify your n8n edition and API availability before depending on API-driven workflow management |
| Workflow execution timeout | Long-running workflow exceeds limit | Increase timeout in n8n settings or break into sub-workflows |

## Verification

```bash
# Test connectivity and auth
op run --env-file=.env.template -- curl -s \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows?limit=1" | jq .count

# Expected: a number (0 or more)
```
