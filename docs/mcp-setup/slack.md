# Slack MCP Setup

Setup guide for the Slack MCP integration used by NoéMI agents.

## Prerequisites

- A Slack workspace where you have permission to install apps
- A Slack app created at [api.slack.com/apps](https://api.slack.com/apps)

## Authentication

Slack MCP uses a **Bot Token** (`xoxb-...`).

1. Create a Slack app (or use an existing one) in your workspace.
2. Under **OAuth & Permissions**, add the required bot token scopes:
   - `chat:write` — send messages
   - `channels:read` — list channels
   - `channels:history` — read channel messages
   - `files:write` — upload files
   - `users:read` — resolve user names
3. Install the app to your workspace and copy the **Bot User OAuth Token**.
4. Store the token in your vault:
   ```bash
   op item create --category=login \
     --title="Slack MCP Bot" \
     --field="bot_token=xoxb-YOUR-TOKEN"
   ```
5. Reference in your environment:
   ```
   SLACK_BOT_TOKEN=op://Vault/Slack MCP Bot/bot_token
   ```

## Connection

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_DEFAULT_CHANNEL` | (Optional) Default channel ID for notifications |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `invalid_auth` | Token is invalid or revoked | Regenerate the bot token and update the vault |
| `channel_not_found` | Bot not invited to the channel | Invite the bot with `/invite @bot-name` |
| `not_in_channel` | Bot lacks channel membership | Same as above — bot must be a member |
| `ratelimited` | Too many API calls | Respect `Retry-After` header; batch messages |
| `missing_scope` | Token lacks a required scope | Add the scope in Slack app settings and reinstall |

## Verification

```bash
# Test that the token is injected and valid
op run --env-file=.env.template -- curl -s \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/auth.test" | jq .

# Expected: {"ok": true, "user": "bot-name", ...}
```
