#### Overview
This file dictates how an agent interacts with Slack, whether through a Slack MCP server or through an app the agent runs itself, over Socket Mode or an HTTP Request URL. Slack is where people talk to the agent, where approvals are clicked and where alarms land. Most of what goes wrong there is silent: a message that never arrived, a mention rendered from someone else's text, a form value that quietly reverted. The rules below come from those failures.

Related: [Human-Approval Gates](../guardian-layer/approval-gates.md) for approval cards, [Conversation Memory in Shared Chats](../docs/architecture/conversation-memory.md) for what a thread may store, and [Environment Modes](../docs/architecture/environment-modes.md) for running a development app beside production.

#### 1. Who May Do What
- Being in the workspace is not authorization. Keep three allowlists: the conversations the agent responds in, the people who may instruct it, and the people who may approve. The approver list is separate and usually narrower.
- An unset or empty allowlist refuses to start. It must never mean "everyone".
- Check the allowlists before anything else, including any storage read. Anyone in a channel can reach the event handler by typing, so they must not be able to trigger a database lookup per message.
- In a shared thread, ignore a message from someone outside the instructor list silently. A refusal addressed to a bystander fills the thread with noise.
- Log every refusal, without the message body.

#### 2. Receiving Events
Slack delivers events and interactions in one of two ways: over **Socket Mode**, a WebSocket the app opens, or over **HTTP** to a public Request URL. Most rules apply to both; where they differ, both cases are stated.
- **Verify every HTTP request.** With a Request URL, check Slack's signature header against the signing secret and refuse a request whose timestamp is more than a few minutes old, before parsing anything else. A public endpoint that skips this accepts forged events and forged button clicks. Socket Mode needs no signature check: the connection is opened with the app-level token.
- **Acknowledge first, then work.** Slack expects an event or interaction to be acknowledged within about three seconds: an HTTP 200 for a Request URL, an envelope acknowledgement over Socket Mode. When it is late, Slack retries, and a slow handler that acknowledges late is how an action runs twice. Acknowledge immediately, and protect the action itself with a single-use transition.
- **Deduplicate deliveries.** A retried event carries the same event id (over HTTP, with a retry-count header), so keep the ids of recent events and drop repeats. Separately, a mention can arrive twice as two different events: an `app_mention` and a message event in the same channel. Let one handler own it, and ignore the other copy.
- **One run per thread at a time.** A second message while a run is in progress gets "still working on your last message" rather than a parallel run, because two runs on one thread each answer from half the conversation.
- **Keep per-thread locks and rate limits in one place.** Socket Mode spreads events across every open connection for the same app; a load balancer spreads HTTP requests across replicas. Either way, a second process keeps its own copy of any in-memory lock or rate limit, so both guarantees halve. Run one process, or move that state into a shared store. With Socket Mode, the second process may be a developer machine holding the production token: warn at startup when another connection is detected, and in development refuse a token whose bot user id is not the expected one.
- **Know what happens to events while the app is down.** Over Socket Mode, an event that arrives while nothing is connected is lost: the mention produces nothing, and nothing arrives later. Over HTTP, Slack retries a failed delivery a few times and then gives up, and it can disable event delivery for an app whose endpoint keeps failing. Watch for that notice; the app looks healthy while nothing reaches it.
- **Rate-limit model runs per person**, across every path that reaches a model: mentions, thread replies, form submissions that draft something, redrafts. A run's own cost guard cannot see what the previous request cost.

#### 3. Liveness
Because a missed mention is silent, silence must mean only "the process is down":
- **Every message the agent accepts gets a visible reply**, even a refusal or a warning. A run that fails writes the failure into its placeholder message, not only into a server log.
- **Offer a status command that reaches no model and is not rate-limited**, so it answers when someone's quota is spent, which is when people start asking whether the agent is stuck.
- **Announce lifecycle in a status channel**: when the process starts, on an orderly stop, and, over Socket Mode, when the connection returns after being away for more than about a minute. Short reconnects are normal there, because Slack refreshes Socket Mode connections every few hours.
- **Record a heartbeat to a file**, so the next start can report the gap: "unreachable from 14:02 to 15:31, and anything asked in that window never arrived". A stopping process cannot be relied on to post its own farewell, so record whether it managed to, and let the next start say which.
- **Do not use the bot's presence dot as a signal.** Slack does not mark a bot as active for either Socket Mode or a Request URL.

#### 4. Formatting and Escaping
- **Use Block Kit for notifications**, with code blocks for errors and warnings.
- **Text that came from outside the organization goes in `plain_text`**: a contact's name, an email body, a feed item. It cannot render links or mentions there.
- **Generate `mrkdwn` from escaped text, never from raw text.** Escape `&`, `<` and `>` first, then add formatting. Only text the system itself wrote for a person to read is eligible for formatting.
- **Escape before splitting, and split at line boundaries.** A section's text is limited to 3000 characters. Escaping enlarges text, so escaping chunks that were already split can push them over the limit, and Slack then rejects the whole message. That means an approval card that never appears. Do not split inside a bold or italic span.
- **In a `markdown` block, insert a zero-width space after every `<`.** Slack's mentions and links all start with `<` (`<!channel>`, `<@U…>`, `<https://…|label>`), and whether that block parses them is not documented. The space breaks every token without changing how the text reads.
- **Show where a labelled link goes.** Rewrite `[label](url)` as `label (url)` in anything that may quote outside text, so a disguised link is visible before anyone clicks it.
- **Escape the notification text too.** The `text` fallback shown in notifications is parsed separately from the blocks.
- **Build mentions only from values that match the user id format**, taken from configuration or the event, never from model output or message text.
- **Truncate long logs and stack traces.** Post a short excerpt and a link to the logging system, not the full output.
- **Keep identifiers out of channel text.** An approval card for a bulk send shows counts and reasons, not a list of addresses. A one-to-one card shows its single recipient, because checking it is the point of the approval.

#### 5. Buttons, Forms and Modals
- **A button or modal carries a key, never a fact.** The value is a record id. Everything else, such as recipient, content and kind, is loaded from the record. A tampered payload can then name a different record, which is refused, but cannot redirect what is sent.
- **A model cannot open a form.** A modal needs a `trigger_id` from a user interaction, and a mention has none. Let the agent fill in a draft, store it, and reply with a button whose value is the draft id. The person opens the form, checks it and submits it.
- **An absent form answer means "unchanged", not "empty".** For number, email and URL inputs, Slack does not return an initial value the person never touched, even though the form shows it. Treat every missing field in an edit form as "keep the existing value". A field that arrives empty is still empty, so clearing an optional field keeps working.
- **Re-check approver rights when the button is clicked**, not when the card was posted.

#### 6. Showing Progress
- **Edit one message in place** rather than posting a message per step. A slow run says which step it is on, for example "Checking the calendar…", and the line disappears when the answer arrives.
- **Name steps from a fixed table**, one line per agent or tool. Never show arguments, results, list sizes, addresses or ids. The channel is a conversation, and the server log is where details go.
- **Showing a line must never fail the run.** A failed edit is logged and the run continues. Queue edits so they arrive in order and none lands on top of the final answer.

#### 7. Alarms
- Post alarms with the collapse rule in [Alert & Notify](../skills/reporting/alert-notify.md): a first occurrence always posts, a different condition always posts, and repeats update one message with a count.
- Each alarm says what stopped working and what to do about it, and carries no user ids, channel ids, message bodies or personal data. The audit log holds the detail.
