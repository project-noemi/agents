## Active MCP Protocols

The following MCP integrations are active. When working with these tools, follow the protocol rules below.

### N8n Protocol

#### Overview
This file contains specific capabilities, protocols, and workflows when interacting with the **n8n MCP tool**.

#### 1. Silent Execution
Execute n8n operations silently. Call tools in parallel and report back only upon completion.

#### 2. Multi-Level Validation
When configuring nodes, validate in layers:

- credentials
- node parameters
- expressions
- branch routing
- workflow runtime behavior

#### 3. Never Trust Defaults
Always explicitly define configurations when interacting with nodes rather than relying on default parameters which often fail at runtime.

#### 4. Do Not Assume Hidden Helper Tools
Do not invent template catalogs, node validators, or workflow helper methods unless the orchestrator explicitly provides them. If the runtime only exposes JSON files or the n8n API, work within that real surface.

#### 5. Prefer Current Node Types
Use current built-in node types and explicit `typeVersion` values. Treat older workflow JSON as illustrative until verified against the target n8n release.

### Slack Protocol

#### Overview
This file dictates how Gemini interacts with Slack using the designated Slack MCP.

#### 1. Notification Formatting
Ensure all Slack notifications are properly formatted utilizing Slack's Block Kit. Prioritize using code blocks for errors and warnings.

#### 2. Context Limits
Always truncate large logs before sending them to a Slack channel. Include links to external logging systems instead of printing full stack traces to channels.

### Gmail Protocol

#### Overview
This file dictates how Gemini interacts with Gmail via the MCP.

#### 1. Safety & Confirmation
**CRITICAL:** Never send an email without explicit, unambiguous user confirmation unless executing an automated, pre-approved workflow. Always prefer drafting emails over sending them directly.

#### 2. Drafting & Formatting
When drafting emails, strictly adhere to the requested tone, professionalism, and formatting requirements. Ensure all recipient addresses (To, Cc, Bcc) are accurate and validated before drafting.

#### 3. Reading & Searching
When searching for or reading emails, prioritize specific search queries (e.g., `from:user@example.com subject:"Update"`) to minimize data retrieval and respect privacy constraints. Do not summarize entire threads unless requested; focus on extracting the requested information.

### Google Drive Protocol

#### Overview
This file dictates how Gemini interacts with Google Drive via the MCP.

#### 1. File Search & Discovery
Use precise query parameters when searching for files or folders to avoid returning massive datasets. Always verify the file ID or folder ID before performing operations.

#### 2. Permissions & Sharing
**CRITICAL:** Be extremely cautious when modifying file permissions or sharing settings. Never make a file public or share it broadly without explicit user confirmation. Always prefer the least privileged access level necessary (e.g., Viewer instead of Editor).

#### 3. Structure & Metadata
When creating new files or folders, always ensure they are placed within the correct target directory. Do not leave files orphaned in the root directory unless explicitly instructed. Respect existing naming conventions and metadata requirements.

### Google Calendar Protocol

#### Overview
This file dictates how Gemini interacts with Google Calendar via the MCP.

#### 1. Timezone Handling
**CRITICAL:** Always explicitly verify and state the timezone when creating, reading, or modifying events. Never assume the user's timezone; if it is ambiguous, ask for clarification. Convert times accurately when dealing with participants in different locations.

#### 2. Event Creation & Modification
When scheduling events, ensure all participant email addresses are correct. Clearly summarize the event details (title, time, timezone, participants, description, location/meet link) to the user before finalizing the creation or modification.

#### 3. Conflict Resolution
When checking availability or proposing times, proactively identify and flag scheduling conflicts. Offer alternative time slots based on the participants' visible availability.

### Google Docs Protocol

#### Overview
This file dictates how Gemini interacts with Google Docs via the MCP.

#### 1. Document Creation & Formatting
When creating or formatting Google Docs, utilize standard structural elements (headings, paragraphs, lists) to ensure readability and proper document outline.

#### 2. Content Modification
When appending or replacing text, ensure you are targeting the correct section of the document. Do not overwrite existing content unless explicitly instructed to do so. If the document is large, consider breaking updates into smaller, targeted operations.

#### 3. Reading & Extraction
When reading documents, extract only the necessary context. For large documents, summarize the relevant sections rather than attempting to ingest the entire content at once.

### Google Sheets Protocol

#### Overview
This file dictates how Gemini interacts with Google Sheets via the MCP.

#### 1. Data Integrity & Validation
**CRITICAL:** Ensure data types (numbers, dates, strings) are formatted correctly when writing to a sheet. Validate data before insertion to prevent corrupting existing formulas or data structures.

#### 2. Range Operations
Always be precise when specifying ranges (e.g., `Sheet1!A1:D10`). Avoid open-ended ranges (`A:D`) when writing data to prevent accidental overwrites. When appending data, verify the next available empty row before writing.

#### 3. Reading & Analysis
When reading from a sheet, handle empty cells and varying row lengths gracefully. If extracting data for analysis, ensure the header row is clearly identified and mapped to the corresponding data columns.

### Google Slides Protocol

#### Overview
This file dictates how Gemini interacts with Google Slides via the MCP.

#### 1. Slide Creation & Structure
When creating presentations, utilize appropriate slide layouts (Title, Title and Body, Blank, etc.) to ensure a consistent and professional design.

#### 2. Content Placement
When adding text, shapes, or images, specify exact positioning and dimensions when possible. Ensure content does not overlap or spill outside the visible slide boundaries.

#### 3. Presentation Updates
When modifying existing slides, carefully identify the target slide ID or index before applying changes. Do not delete slides or rearrange the presentation order without explicit instruction.

### Google Meet Protocol

#### Overview
This file dictates how Gemini interacts with Google Meet via the MCP.

#### 1. Meeting Generation
When generating a Google Meet link, ensure it is attached to the corresponding Google Calendar event if applicable.

#### 2. Participant Management
Be aware of meeting entry settings (e.g., who can bypass the waiting room) if the MCP supports configuring them. Ensure the generated meeting links are provided clearly to the user.

### Google Chat Protocol

#### Overview
This file dictates how Gemini interacts with Google Chat via the MCP.

#### 1. Message Formatting
When sending messages to spaces or direct messages, utilize Google Chat's formatting capabilities (bold, italics, code blocks) to ensure readability.

#### 2. Threading & Context
When replying to existing conversations, always ensure the reply is correctly threaded to maintain context. Do not start a new thread for an ongoing topic unless instructed.

#### 3. Notification Management
Use `@mentions` judiciously. Only mention specific individuals or `@all` when the message requires immediate attention or action from those parties.

### Google Keep Protocol

#### Overview
This file dictates how Gemini interacts with Google Keep via the MCP.

#### 1. Note Creation
When creating notes, utilize appropriate formats (text, lists) based on the user's request. Add relevant labels or colors if specified to aid in organization.

#### 2. Task Management
For to-do lists, clearly distinguish between completed and pending tasks when reading or updating the note.

### Google Forms Protocol

#### Overview
This file dictates how Gemini interacts with Google Forms via the MCP.

#### 1. Form Structure
When creating or modifying a form, ensure questions are clearly worded and utilize the appropriate input type (multiple choice, short answer, linear scale, etc.).

#### 2. Response Handling
When reading or analyzing form responses, treat the data as structured output (often linked to a Google Sheet). Handle missing or malformed responses gracefully during analysis.

### Google Contacts Protocol

#### Overview
This file dictates how Gemini interacts with Google Contacts via the MCP.

#### 1. Contact Management
When creating or updating contacts, ensure fields (name, email, phone, organization) are populated accurately. Avoid creating duplicate entries; search for existing contacts before adding a new one.

#### 2. Privacy & Scope
Only access or modify contacts that are strictly relevant to the user's immediate request. Do not perform bulk exports or broad searches without clear authorization.

### Google Admin Protocol

#### Overview
This file dictates how Gemini interacts with the Google Workspace Admin Console via the MCP.

#### 1. Extreme Caution
**CRITICAL:** Operations within the Admin Console have organization-wide impact. Proceed with extreme caution. Never execute actions that create, suspend, or delete users, or modify organization-wide settings (like domain routing or security policies) without explicit, multi-step confirmation from an authorized administrator.

#### 2. Auditing & Logging
When performing administrative tasks, maintain a clear audit trail of actions taken, reasoning, and the specific IDs of users or groups affected.

#### 3. Group Management
When managing Google Groups, carefully verify the email addresses being added or removed, and confirm the intended permission levels (Owner, Manager, Member) before applying changes.

### Web Search Protocol

#### Overview
This file dictates how Gemini interacts with its built-in web search and web fetch capabilities.

#### 1. Verification vs. Discovery
Use web search primarily for verifying facts, gathering up-to-date documentation, or diagnosing unknown error messages. Do not use web search for general conversational knowledge that is already well-established within your training data.

#### 2. URL Processing
When fetching content from specific URLs (`web_fetch`), ensure the URLs are well-formed. If a URL returns a paywall or anti-bot challenge, do not attempt to bypass it; inform the user that the content is inaccessible.

#### 3. Citation & Summarization
Always synthesize and summarize search results in your own words rather than dumping raw excerpts. If asked for sources, clearly provide the URLs or citations corresponding to the information retrieved.

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
