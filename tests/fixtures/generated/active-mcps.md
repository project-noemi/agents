## Active MCP Protocols

The following MCP integrations are active. Summaries below carry each protocol's hard rules (CRITICAL / "Do not" / "Never") verbatim; the full protocol file is the operative contract — **read it before first use of that MCP in a session.**

### N8n Protocol

- **Protocol:** `mcp-protocols/n8n.md`

> Always explicitly define configurations when interacting with nodes rather than relying on default parameters which often fail at runtime.

> Do not invent template catalogs, node validators, or workflow helper methods unless the orchestrator explicitly provides them. If the runtime only exposes JSON files or the n8n API, work within that real surface.

### Slack Protocol

- **Protocol:** `mcp-protocols/slack.md`

> Because a missed mention is silent, silence must mean only "the process is down":
> - **Every message the agent accepts gets a visible reply**, even a refusal or a warning. A run that fails writes the failure into its placeholder message, not only into a server log.
> - **Offer a status command that reaches no model and is not rate-limited**, so it answers when someone's quota is spent, which is when people start asking whether the agent is stuck.
> - **Announce lifecycle in a status channel**: when the process starts, on an orderly stop, and, over Socket Mode, when the connection returns after being away for more than about a minute. Short reconnects are normal there, because Slack refreshes Socket Mode connections every few hours.
> - **Record a heartbeat to a file**, so the next start can report the gap: "unreachable from 14:02 to 15:31, and anything asked in that window never arrived". A stopping process cannot be relied on to post its own farewell, so record whether it managed to, and let the next start say which.
> - **Do not use the bot's presence dot as a signal.** Slack does not mark a bot as active for either Socket Mode or a Request URL.

> - **Use Block Kit for notifications**, with code blocks for errors and warnings.
> - **Text that came from outside the organization goes in `plain_text`**: a contact's name, an email body, a feed item. It cannot render links or mentions there.
> - **Generate `mrkdwn` from escaped text, never from raw text.** Escape `&`, `<` and `>` first, then add formatting. Only text the system itself wrote for a person to read is eligible for formatting.
> - **Escape before splitting, and split at line boundaries.** A section's text is limited to 3000 characters. Escaping enlarges text, so escaping chunks that were already split can push them over the limit, and Slack then rejects the whole message. That means an approval card that never appears. Do not split inside a bold or italic span.
> - **In a `markdown` block, insert a zero-width space after every `<`.** Slack's mentions and links all start with `<` (`<!channel>`, `<@U…>`, `<https://…|label>`), and whether that block parses them is not documented. The space breaks every token without changing how the text reads.
> - **Show where a labelled link goes.** Rewrite `[label](url)` as `label (url)` in anything that may quote outside text, so a disguised link is visible before anyone clicks it.
> - **Escape the notification text too.** The `text` fallback shown in notifications is parsed separately from the blocks.
> - **Build mentions only from values that match the user id format**, taken from configuration or the event, never from model output or message text.
> - **Truncate long logs and stack traces.** Post a short excerpt and a link to the logging system, not the full output.
> - **Keep identifiers out of channel text.** An approval card for a bulk send shows counts and reasons, not a list of addresses. A one-to-one card shows its single recipient, because checking it is the point of the approval.

> - **Edit one message in place** rather than posting a message per step. A slow run says which step it is on, for example "Checking the calendar…", and the line disappears when the answer arrives.
> - **Name steps from a fixed table**, one line per agent or tool. Never show arguments, results, list sizes, addresses or ids. The channel is a conversation, and the server log is where details go.
> - **Showing a line must never fail the run.** A failed edit is logged and the run continues. Queue edits so they arrive in order and none lands on top of the final answer.

### Gmail Protocol

- **Protocol:** `mcp-protocols/gmail.md`

> **CRITICAL:** Never send an email without explicit, unambiguous user confirmation unless executing an automated, pre-approved workflow. Always prefer drafting emails over sending them directly.

> When searching for or reading emails, prioritize specific search queries (e.g., `from:user@example.com subject:"Update"`) to minimize data retrieval and respect privacy constraints. Do not summarize entire threads unless requested; focus on extracting the requested information.

### Google Drive Protocol

- **Protocol:** `mcp-protocols/google-drive.md`

> **CRITICAL:** Be extremely cautious when modifying file permissions or sharing settings. Never make a file public or share it broadly without explicit user confirmation. Always prefer the least privileged access level necessary (e.g., Viewer instead of Editor).

> When creating new files or folders, always ensure they are placed within the correct target directory. Do not leave files orphaned in the root directory unless explicitly instructed. Respect existing naming conventions and metadata requirements.

### Google Calendar Protocol

- **Protocol:** `mcp-protocols/google-calendar.md`

> **CRITICAL:** Always explicitly verify and state the timezone when creating, reading, or modifying events. Never assume the user's timezone; if it is ambiguous, ask for clarification. Convert times accurately when dealing with participants in different locations.

### Google Docs Protocol

- **Protocol:** `mcp-protocols/google-docs.md`

> When appending or replacing text, ensure you are targeting the correct section of the document. Do not overwrite existing content unless explicitly instructed to do so. If the document is large, consider breaking updates into smaller, targeted operations.

### Google Sheets Protocol

- **Protocol:** `mcp-protocols/google-sheets.md`

> **CRITICAL:** Ensure data types (numbers, dates, strings) are formatted correctly when writing to a sheet. Validate data before insertion to prevent corrupting existing formulas or data structures.

### Google Slides Protocol

- **Protocol:** `mcp-protocols/google-slides.md`

> When modifying existing slides, carefully identify the target slide ID or index before applying changes. Do not delete slides or rearrange the presentation order without explicit instruction.

### Google Meet Protocol

- **Protocol:** `mcp-protocols/google-meet.md`

### Google Chat Protocol

- **Protocol:** `mcp-protocols/google-chat.md`

> When replying to existing conversations, always ensure the reply is correctly threaded to maintain context. Do not start a new thread for an ongoing topic unless instructed.

### Google Keep Protocol

- **Protocol:** `mcp-protocols/google-keep.md`

### Google Forms Protocol

- **Protocol:** `mcp-protocols/google-forms.md`

### Google Contacts Protocol

- **Protocol:** `mcp-protocols/google-contacts.md`

> Only access or modify contacts that are strictly relevant to the user's immediate request. Do not perform bulk exports or broad searches without clear authorization.

### Google Admin Protocol

- **Protocol:** `mcp-protocols/google-admin.md`

> **CRITICAL:** Operations within the Admin Console have organization-wide impact. Proceed with extreme caution. Never execute actions that create, suspend, or delete users, or modify organization-wide settings (like domain routing or security policies) without explicit, multi-step confirmation from an authorized administrator.

### Web Search Protocol

- **Protocol:** `mcp-protocols/web-search.md`

> Use web search primarily for verifying facts, gathering up-to-date documentation, or diagnosing unknown error messages. Do not use web search for general conversational knowledge that is already well-established within your training data.

> When fetching content from specific URLs (`web_fetch`), ensure the URLs are well-formed. If a URL returns a paywall or anti-bot challenge, do not attempt to bypass it; inform the user that the content is inaccessible.

### Github Protocol

#### Overview
This file dictates how agents interact with GitHub using the GitHub CLI (`gh`) and the GitHub REST/GraphQL APIs.

#### 1. Authentication
Always authenticate via environment variable `GH_TOKEN` injected at runtime through vault CLI wrappers (`op run` / `infisical run`). Never store tokens in config files or commit them to the repository.

#### 2. Rate Limit Awareness
Monitor `X-RateLimit-Remaining` headers on every API response. When remaining calls drop below 100, introduce a backoff delay. On `403` or `429` responses, wait for the `X-RateLimit-Reset` timestamp before retrying.

#### 3. Pagination
Always paginate API responses. Use `--paginate` with `gh api` or follow `Link` headers in raw REST calls. Never assume a single page contains all results.

#### 4. Scope Minimization
Request only the scopes and data fields necessary for the current operation. Use GraphQL queries to select specific fields rather than fetching full objects via REST when possible.

#### 5. Audit Trail
Log every mutating API call (merge, close, comment, label) with the full request and response status for traceability. Include the agent identifier in all comments and commit messages.

#### 6. PR Authorship (Machine Identity)
Agent-initiated pull requests MUST be opened under the `noemi-agent` machine identity, never with a human's credentials. GitHub blocks a pull request's author from approving it, so an agent PR opened with the reviewing human's token is unreviewable by that human and collapses the human-reviews-AI gate into an admin bypass (see `docs/MACHINE_IDENTITY.md` — the token that opens the PR is what determines authorship; commit metadata does not).

- Where the `gh` CLI is available, open PRs via `bash scripts/agent-gh.sh pr create ...`.
- In containerized or remote sessions without `gh` (e.g., cloud sandbox containers), use `node scripts/agent-pr.js` — it resolves `AGENT_GH_TOKEN` from process memory and speaks to the REST API directly. Cross-org work (a private `{company}-agents` copy) uses `AGENT_GH_TOKEN_CLASSIC` only when `AGENT_GH_USE_CLASSIC=1`; the resolver must not fall back to `AGENT_GH_TOKEN`.
- Calibration watch (`scripts/calibration-watch.js`) is the one reader that falls back the other way. It starts on `AGENT_GH_TOKEN`. If `GET /repos/{owner}/{repo}` returns HTTP 404, it retries with `AGENT_GH_TOKEN_CLASSIC` and continues only when that login matches `AGENT_GH_EXPECTED_LOGIN` (default `noemi-agent`). A missing classic token is still a hard fail. A requested classic path (`AGENT_GH_USE_CLASSIC`) still refuses to fall back to `AGENT_GH_TOKEN`.
- Both paths verify the token against `AGENT_GH_EXPECTED_LOGIN` and refuse to act if it resolves to any other account, including a human's.
- If no machine-identity token is resolvable, stop and surface the gap to the human. Do **not** fall back to opening the PR with human credentials — a mis-authored PR re-creates the exact failure this rule exists to prevent.
- Approving and merging remain human-only acts. The machine identity may do neither (identity register, `docs/MACHINE_IDENTITY.md`).
