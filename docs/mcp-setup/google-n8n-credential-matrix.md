# Google Workspace + n8n Credential Matrix

This guide exists because "Google Workspace integration" means different things in different runtimes.

Project NoeMI currently supports three distinct patterns:

1. Gemini CLI using the Google Workspace extension
2. generic or self-hosted Google Workspace MCP servers using `GOOGLE_*` environment variables
3. n8n workflows using built-in Google nodes plus a separate Gemini credential

Do not mix these up. They are the main source of failed first implementations.

## Credential Matrix

| Runtime surface | Use this when | Credential model | Where credentials live | Common gotcha |
|---|---|---|---|---|
| Gemini CLI + Workspace extension | Human-led terminal work | Google account login via the extension | Gemini CLI extension auth state | Setting `GOOGLE_CLIENT_ID` does not configure this path |
| Generic Google Workspace MCP server | Custom or self-hosted MCP server runtime | OAuth client + refresh token or service account | Vault-injected `GOOGLE_*` env vars | Works for your MCP server, but not automatically for Gemini CLI or n8n |
| n8n Gmail / Docs / Drive / Sheets nodes | Repeatable workflow automation | n8n Google credential(s) | n8n credential store | n8n API key does not configure these nodes |
| n8n Google Gemini node | Gemini in an n8n workflow | n8n Gemini API credential | n8n credential store | Gemini credential is separate from Gmail/Docs/Drive credentials |
| n8n API access | Workflow management through API | n8n API key | Vault + runtime env vars | Public API availability depends on your n8n plan/setup |

## Decision Rule

Use this shortcut:

- **Need ad-hoc human work in the terminal?** Use [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md).
- **Need recurring or event-driven automation?** Use [`../examples/n8n-google-workspace-quickstart.md`](../examples/n8n-google-workspace-quickstart.md).
- **Need a custom MCP server runtime outside both of those?** Use [`google-workspace.md`](google-workspace.md).

## Minimum Credential Sets by Workflow Type

### Gmail triage in n8n

- Gmail credential
- Google Gemini credential

### Gmail triage plus Google Doc output

- Gmail credential
- Google Docs credential
- Google Gemini credential

### Sheets enrichment workflow

- Google Sheets credential
- optional Gmail credential
- Google Gemini credential if the flow uses AI classification or generation

### Gemini CLI Workspace exploration

- Gemini CLI Workspace extension login only

## Troubleshooting

### "Gemini CLI can access Drive, but n8n cannot"

These are different auth surfaces. Your Gemini CLI Workspace extension login does not configure n8n credentials.

### "My `GOOGLE_CLIENT_ID` and `GOOGLE_REFRESH_TOKEN` are set, but Gemini CLI still can't use Gmail"

Those variables are for a generic MCP server path. Gemini CLI's Workspace extension uses its own auth flow.

### "The n8n Gmail node says 'Forbidden - perhaps check your credentials?'"

This often happens when:

- the Gmail API is not enabled
- the granted scopes are incomplete
- a service account is being used without impersonation where Gmail access is required

### "The n8n Gmail node returns `unauthorized_client`"

Check:

- the correct Google API is enabled
- the right scopes are granted
- domain-wide delegation is configured if you are using a service account for user mailboxes

### "The Gemini model node works, but Gmail or Docs does not"

That usually means your Gemini credential is fine but your Google Workspace node credentials are not. Treat them as separate setups.

### "The n8n API check fails, but the workflow editor works"

The n8n API key path is separate from node credentials and may also depend on your plan or instance settings.

### "Service account auth works for Drive or Sheets, but not for Gmail"

Gmail is stricter. If you are automating mailbox access with a service account, you usually need domain-wide delegation and impersonation configured correctly.

## Recommended Starting Point

For most first implementations:

1. prove the Google surface manually in Gemini CLI
2. move one narrow use case into n8n
3. keep the last mutating action human-reviewed
4. only then expand the workflow surface

That sequence is more reliable than trying to stand up full Gmail + Docs + Sheets + Gemini automation on day one.
