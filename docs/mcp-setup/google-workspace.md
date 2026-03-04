# Google Workspace MCP Setup

Covers setup for all 12 Google Workspace MCPs: Gmail, Calendar, Chat, Contacts, Docs, Drive, Forms, Keep, Meet, Sheets, Slides, and Admin.

All Google MCPs share the same authentication and connection pattern — configure once, enable individually.

## Prerequisites

- A Google Cloud project with the relevant APIs enabled (Gmail API, Calendar API, Drive API, etc.)
- A Google Workspace domain (for Admin MCP) or personal Google account
- OAuth 2.0 credentials (Desktop or Web application type) or a service account

## Authentication

### Option A: OAuth 2.0 (Interactive Users)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID**.
2. Download the credentials JSON file.
3. Store the client ID and client secret in your vault:
   ```bash
   op item create --category=login \
     --title="Google MCP OAuth" \
     --field="client_id=YOUR_CLIENT_ID" \
     --field="client_secret=YOUR_CLIENT_SECRET"
   ```
4. Reference in your environment:
   ```
   GOOGLE_CLIENT_ID=op://Vault/Google MCP OAuth/client_id
   GOOGLE_CLIENT_SECRET=op://Vault/Google MCP OAuth/client_secret
   ```

### Option B: Service Account (Automated Agents)

1. Create a service account in Google Cloud Console.
2. Enable **domain-wide delegation** if agents need to act on behalf of users.
3. Download the service account JSON key.
4. Store the key file path in your vault — never commit the JSON key to the repo.
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY=op://Vault/Google SA Key/credential
   ```

## Connection

The Google MCP servers expect these environment variables (injected at runtime):

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Persistent refresh token (after initial OAuth consent) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Path to service account JSON (if using SA auth) |

Scopes are configured per MCP. Enable only the scopes each agent needs (principle of least privilege):

- Gmail: `https://www.googleapis.com/auth/gmail.modify`
- Calendar: `https://www.googleapis.com/auth/calendar`
- Drive: `https://www.googleapis.com/auth/drive`
- Admin: `https://www.googleapis.com/auth/admin.directory.user.readonly`

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `401 Unauthorized` | Token expired or revoked | Re-run OAuth flow or refresh the service account key |
| `403 Forbidden` | Missing API scope or API not enabled | Enable the API in Cloud Console; check granted scopes |
| `429 Too Many Requests` | Rate limit exceeded | Implement exponential backoff; check per-API quotas |
| `404 Not Found` | Resource deleted or wrong ID | Validate resource IDs before operations |

## Verification

```bash
# Test that credentials are injected correctly
op run --env-file=.env.template -- node -e "
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? 'set' : 'MISSING');
  console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'set' : 'MISSING');
"

# Quick API smoke test (Gmail list labels)
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://gmail.googleapis.com/gmail/v1/users/me/labels" | head -20
```
