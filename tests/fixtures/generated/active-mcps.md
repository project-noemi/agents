## Active MCP Protocols

The following MCP integrations are active. Summaries below carry each protocol's hard rules (CRITICAL / "Do not" / "Never") verbatim; the full protocol file is the operative contract — **read it before first use of that MCP in a session.**

### N8n Protocol

- **Protocol:** `mcp-protocols/n8n.md`

> Always explicitly define configurations when interacting with nodes rather than relying on default parameters which often fail at runtime.

> Do not invent template catalogs, node validators, or workflow helper methods unless the orchestrator explicitly provides them. If the runtime only exposes JSON files or the n8n API, work within that real surface.

### Slack Protocol

- **Protocol:** `mcp-protocols/slack.md`

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
- In containerized or remote sessions without `gh` (e.g., cloud sandbox containers), use `node scripts/agent-pr.js` — it resolves `AGENT_GH_TOKEN` from process memory and speaks to the REST API directly.
- Both paths verify the token against `AGENT_GH_EXPECTED_LOGIN` and refuse to act if it resolves to any other account, including a human's.
- If no machine-identity token is resolvable, stop and surface the gap to the human. Do **not** fall back to opening the PR with human credentials — a mis-authored PR re-creates the exact failure this rule exists to prevent.
- Approving and merging remain human-only acts. The machine identity may do neither (identity register, `docs/MACHINE_IDENTITY.md`).
