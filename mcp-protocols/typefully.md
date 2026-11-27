#### Overview
This file dictates how an agent's system publishes approved posts through [Typefully](https://typefully.com), a social scheduling service, through its REST API (v2) or an MCP server that wraps it. The agent never publishes: it drafts, a person approves, and code calls Typefully. The service-independent rules (choosing a route, never retrying, rehearsal, receipts) are in [Social Publishing](../docs/architecture/social-publishing.md); this file adds what is specific to Typefully.

The details below were checked against Typefully's API documentation and live calls in November 2026. Typefully's plans, quotas and network policies change; **verify them against the current documentation.**

#### 1. Keys and Social Sets
- **An API key belongs to a team member's account** and reaches every social set that member's team can see. Record whose key it is: if that person leaves the team, publishing stops until another member's key replaces it.
- **A social set is the unit of identity**: the group of network accounts (for example an X account and a LinkedIn page) that a business unit publishes as. Pass the social set id on every request. Keep it in configuration per business unit, and do not let two units share one.
- **"Posted by" and the network connection belong to whoever connected each account** in the social set. A lapsed connection makes the next post fail; the alarm should say who reconnects it.
- **Plans meter published posts per social set** (verify the current quota) and may require a subscription per social set.

#### 2. Settings That Publish What Nobody Approved
Typefully applies a social set's automation settings to every draft created through the API. **Keep these off on any social set an agent publishes to**:
- **Auto-Retweet**, which reposts a published post later.
- **Auto-Plug**, which adds a follow-up reply once a post reaches a threshold.
- **Natural Posting Time**, which moves a scheduled time.

These are account settings, not request parameters, so code cannot enforce them. Check them when a social set is added.

#### 3. Creating a Post
- **One draft per platform.** Enable exactly one platform on each draft. A draft enabled for two platforms publishes one approval's text on both.
- **The publish time decides what happens**: `"now"` publishes immediately, a timestamp schedules, and no publish time saves an unpublished draft.
- **Immediate publishing is asynchronous.** The create call answers with a publish state of `in_progress`; the network's post URL appears on a later read of the draft (a `<platform>_published_url` field). Read the draft a few times, a couple of seconds apart, before reporting. If it has not finished, report "accepted, not yet confirmed" without a link.
- **Typefully does not check length.** A draft over a network's limit is accepted as a draft. Check the rendered text against the network's limit before the approval card is shown.
- **Use a narrow client**: create a draft, upload media, read a draft. Do not give the client list, edit or delete operations.

#### 4. X Posts With Links
- **Typefully cannot publish an X post that contains a URL immediately.** Its documentation states that direct publishing of X drafts containing URLs is blocked.
- **A scheduled X post with a link is accepted and goes out.** Schedule it about two minutes ahead. In testing it was published within a minute of its slot.
- Because the approval returns before the post exists, the thread says when it is due, and code reads the draft again a few minutes later to post the link, or raises the failed-post alarm.
- X posts can carry a "Made with AI" label through Typefully. LinkedIn posts have no such field.

#### 5. Images
Uploading an image publishes nothing on its own. It takes three steps:
1. Request an upload URL for the social set with the file name and the alt text. Typefully copies the alt text into the draft when the media is attached. File names are limited to letters, digits, `-`, `_`, `.` and an image extension. Alt text is subject to each network's limit.
2. `PUT` the bytes to the returned URL **with no headers at all**. It is a presigned storage URL, and any added header, including a content type, makes the signature check fail with HTTP 403.
3. Read the media's status until it is `ready` (usually a few seconds), then attach its id to the draft.

#### 6. Errors and Retries
- **Never retry a create.** Typefully has no idempotency key, so a second request after an uncertain first one can publish twice. A timeout is reported as "may have been published; check Typefully".
- Map errors to an action for the person reading the thread: HTTP 429 is rate limiting (try later, by hand); 401 is a revoked or wrong key; 402 is a plan or billing limit; 400 and 422 are a validation problem with the draft; 5xx is Typefully's side. Each message says that nothing was published, except after a timeout.
- Set a request timeout. A hung approval is worse than an uncertain one.

#### 7. Rehearsal
In development, create the draft with no publish time. That proves the key, the social set and the text end to end, and nothing reaches the network. Title the draft as a rehearsal ("REHEARSAL, delete me") and leave it for a person to delete. The client has no delete operation.
