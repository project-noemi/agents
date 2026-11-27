#### Overview
This file dictates how an agent's system publishes approved posts through [Buffer](https://buffer.com), a social scheduling service, through its GraphQL API or an MCP server that wraps it. The agent never publishes: it drafts, a person approves, and code calls Buffer. The service-independent rules (choosing a route, never retrying, rehearsal, receipts) are in [Social Publishing](../docs/architecture/social-publishing.md); this file adds what is specific to Buffer.

The details below were checked against Buffer's developer documentation and a live post in November 2026. Buffer's plans and API access change; **verify them against the current documentation.**

#### 1. Keys and Channels
- **An API key belongs to a person's Buffer account** and reaches every organisation and channel that account can see. Record whose key it is: if that person loses access, publishing stops until a new key replaces it.
- **A channel is the unit of identity**: one connected network account, such as a company page. Pass the channel id on every request. Keep it in configuration per business unit, and do not let two units share one.
- **The key owner needs Full Access on the channel.** With "Needs Approval", Buffer holds the post for approval inside Buffer instead of publishing it, and the API reports that, not a failure. Treat it as "not published", tell the person to grant Full Access, and to delete the held post in Buffer.
- **A disconnected channel makes the next post fail.** The alarm should say who reconnects it: an administrator of the network page refreshes the channel in Buffer.

#### 2. One Endpoint, Narrow Client
- **Buffer's API is GraphQL behind one URL**, which makes a generic "send any query" wrapper the obvious thing to write. Do not write one. Expose only the operations publishing needs: create a post, and read a post's status. Without a generic wrapper, nothing in the client can list, edit or delete posts, change a channel, or reach another organisation's queue.
- **Send plain text.** Buffer takes the post as typed. Check the rendered text against the network's limit before the approval card is shown.

#### 3. Creating a Post
- **Publish with the `shareNow` mode** to publish immediately. In testing, the create call answered with status `sent` in the same response. Read the post's status a few times, a couple of seconds apart, when it does not, before reporting.
- **A post Buffer accepted but the network has not confirmed is reported as "accepted, not yet confirmed"**, without a link.
- Buffer holds the network connection, so there is no network API version or token expiry for the system to track.

#### 4. Errors and Retries
- **Never retry a create.** There is no idempotency key, so a second request after an uncertain first one can publish twice. A timeout is reported as "may have been published; check Buffer".
- GraphQL reports some refusals as a successful HTTP response whose payload is an error type. Read the payload's error message, not only the HTTP status.
- An authentication failure usually means the key was revoked or its owner lost access to the organisation that holds the channel.
- Set a request timeout. A hung approval is worse than an uncertain one.

#### 5. Rehearsal
In development, create the post with `saveToDraft` set, so Buffer keeps it as an unpublished draft. That proves the key, the channel and the text end to end, and nothing reaches the network. Leave the draft for a person to delete; the client has no delete operation.
