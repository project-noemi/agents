# Web Search MCP Setup

Setup guide for the built-in web search and web fetch capabilities.

## Prerequisites

- A Gemini CLI environment with web search enabled
- No external API keys required — this is a built-in capability

## Authentication

Web search and web fetch are **built-in Gemini capabilities** that require no additional authentication. They are enabled by default when the Gemini CLI has internet access.

If your deployment runs in an air-gapped or restricted network environment, ensure outbound HTTPS (port 443) is allowed.

## Connection

No additional environment variables are required. The capability is available when:

1. The Gemini CLI is running with internet access
2. The `web-search` MCP is listed in `mcp.config.json`

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Search returns empty results | Query too specific or connectivity issue | Broaden the search query; verify internet access |
| `web_fetch` returns paywall content | Target site blocks automated access | Do not attempt to bypass; inform the user the content is inaccessible |
| `web_fetch` timeout | Target site is slow or unresponsive | Retry once; if persistent, try an alternative source |
| Anti-bot challenge (CAPTCHA) | Site detects automated access | Do not attempt to bypass; inform the user |

## Verification

```bash
# Confirm the MCP is active in config
node -e "
  const cfg = require('./mcp.config.json');
  console.log('web-search active:', cfg.active_mcps.includes('web-search'));
"

# Functional test: ask the agent to search for something and verify it returns results
```
