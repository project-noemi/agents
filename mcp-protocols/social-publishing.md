#### Overview
This file dictates how an agent's system publishes approved posts to social networks, whether through a network's own API or through a social scheduling service that holds the network connections. The agent never publishes: it drafts, a person approves, and code publishes the approved text ([Human-Approval Gates](../guardian-layer/approval-gates.md)). The draft is written by a writer such as the [Social Copywriter](../agents/marketing/social-copywriter.md).

Statements below about a network's or a service's prices, quotas and policies were true when written and change often. **Verify them against the current documentation before relying on them.**

#### 1. Choose the Route Before Writing a Client
- **Check the established tools first.** Before building against a network's own posting API, check whether a social scheduling service already publishes to that network for the organisation. Such services are the conventional route, and a network's own API often has costs that only appear late.
- **A network's own API may need access an organisation cannot get.** Posting to a company page through some networks' APIs requires a partner programme, an app review or a verified business relationship (verify current). A scheduling service that already holds that access publishes with one request.
- **Some networks charge per API post** (verify current pricing). A scheduling service usually does not charge per post, but may have a monthly quota per account group. Note the quota and check it against expected volume.
- **One service may not cover every network.** Using one service for the networks it supports and a second for the rest is a reasonable split. Keep each client behind the same publish interface, so the choice of service is a per-channel setting.

#### 2. Credentials and Accounts
- **A service key usually belongs to a person** and reaches every account group that person's team can see. Record whose key it is. If that person leaves the team, publishing stops until another member's key replaces it. Moving the key to a user that belongs to the bot avoids this.
- **Keep the key in the secret store, and the account identifiers in configuration.** Each business unit or brand has its own account group or channel id at the service, and two units may not share one (see [Capability Configuration That Only Subtracts](../docs/architecture/capability-configuration.md) §6).
- **"Posted by" belongs to whoever connected each network account** in the service, and that connection can lapse. When it does, the next post fails with the service's message. The failed-post alarm then says who must reconnect the account, for example a page administrator.
- **A network's own refresh token may rotate on every use** and invalidate the previous one. Keep it in one place, used by one process. A second process that refreshes it, such as a developer machine, locks the first one out (see [Environment Modes](../docs/architecture/environment-modes.md) §2).

#### 3. Service Settings That Change What Is Published
- **Switch off the service's automation features on every account group used by the agent.** Features such as automatic reposting, an automatic follow-up reply, or a "best time" scheduler that moves the publish time are applied to every draft created through the API. Each one publishes something nobody approved, or publishes at a time nobody chose.
- **Check them again whenever an account group is added.** These are account settings in the service, not request parameters, so code cannot enforce them; a periodic read-only check, or a line in the onboarding checklist, can.

#### 4. Publishing
- **Create one draft per network per approval**, enabled for exactly that network. Each destination keeps its own draft, approval card and receipt.
- **Send plain text, and check length yourself.** A service may accept a draft over the network's limit and fail later, or truncate it. Measure the rendered text against the network's limit before the approval card is shown.
- **Expose one operation.** The client offers only what publishing needs, such as creating a draft, publishing it and reading its status. It does not offer deletion, editing of published posts, or account management.
- **A post with a link may not be publishable immediately.** Some networks restrict immediate API publishing of posts that contain links when they come through a third-party service (verify current). Scheduling such a post a couple of minutes ahead is accepted. The approval then returns without a link to the post, so the thread says when it is due and code checks again after the slot. It then posts the network link in the thread, or raises the failed-post alarm and records a failed receipt.
- **The follow-up check lives in the process.** A restart inside that window loses the follow-up message, but not the post: the service publishes it anyway. Record this as a known limitation, or persist the pending check.

#### 5. Never Retry a Publish
- **Most scheduling services and network APIs have no idempotency key**, so a second request can publish twice. Do not retry a publish request automatically, on timeout or on an error that does not say the post was refused.
- **Report what is known.** A post the service accepted but the network has not confirmed is reported as "accepted, not yet confirmed", without a link, never as published and never as failed. A person can check the service and the network.
- **The approval's single-use transition is the duplicate guard** for the click. The publish request itself is made once.

#### 6. Rehearsal
- **Rehearse with an unpublished draft at the service.** In development, create a real draft with no publish time instead of publishing. That proves the key, the account group and the text end to end, and nothing reaches the network.
- **Make the rehearsal draft obvious.** Title it as a rehearsal ("REHEARSAL, delete me") and leave it for a person to look at and delete, rather than giving the client a delete operation.
- **The approval card says where a rehearsal goes**: to the service as a draft, not "nowhere". See [Environment Modes](../docs/architecture/environment-modes.md) §4.

#### 7. Receipts and Alarms
- Every publish writes a receipt: the network, the business unit, the service's draft id, the network's post link when known, and the outcome (`published`, `scheduled`, `accepted-unconfirmed`, `failed`).
- A failed post raises an alarm that says what to do, such as reconnecting the account in the service or checking the quota, and carries no post text or personal data. Repeats collapse as described in [Alert & Notify](../skills/reporting/alert-notify.md).
