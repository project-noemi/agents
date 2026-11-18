# Agent Inventory Template

Keep one row per agent that has its own identity in any connected system: mail, calendar, files, CRM, chat or code hosting. The inventory answers, for every agent, who it is in each system, what it may do there, which person answers for it, and how to switch it off.

Copy this table into your own repository or a shared sheet, replace the example row, and review it on the date in the last column.

| Agent | Identity (account or app registration) | Scopes | Human owner | Revocation step | Review date |
| --- | --- | --- | --- | --- | --- |
| Inbox triage bot | `triage-agent@example.com` (dedicated mailbox account, not a person's login) | Mail: read and create drafts; no send, no delete. Calendar: none. Files: none. | Operations lead (Alex Example) | Disable `triage-agent@example.com` and revoke its OAuth grant in the mail admin console; confirm no session remains. | 2027-02-01 |

The example row is fictional.

## How to fill it in

- **Agent:** the name the team uses for the agent and its purpose in a few words.
- **Identity:** the dedicated account, service account or app registration the agent signs in with. Never a person's own login or token. One identity per agent; do not share identities between agents.
- **Scopes:** what the identity may do in each connected system. Start read-only, and list what it may not do (send, delete, pay, share) as well as what it may do.
- **Human owner:** the person who answers for the agent and approves widening its scopes.
- **Revocation step:** the exact action that cuts the agent off in each system, so anyone on call can do it the same day.
- **Review date:** when the owner next confirms the identity is still needed and its scopes are still the minimum.

Related: [Machine identity](../../MACHINE_IDENTITY.md), [Grok Bot: Getting Started](../../tool-usages/grok-bot-getting-started.md), [Phase 0 Security Baseline](../../PHASE_ZERO_SECURITY_BASELINE.md).
