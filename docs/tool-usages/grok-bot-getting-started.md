# Grok Bot: Getting Started

> Also available as a Google Doc; the GitHub markdown is the source of truth.

A **Grok Bot** is a persistent, hosted assistant. Unlike a one-shot chat, a bot keeps context over time and can act on your behalf through connected services. For hosted personas without persistence, see [`grok-custom-agents.md`](grok-custom-agents.md). For how bots run under the hood, see [`../architecture/grok-bot-architecture.md`](../architecture/grok-bot-architecture.md).

## What A Grok Bot Has

| Capability | What it means |
|---|---|
| **Chat** | A conversational interface you use to give tasks and review results. |
| **Memory** | Persistent notes and stores the bot reads and updates across conversations. |
| **Routines** | Instructions that run on a **schedule** (e.g. every weekday morning) or on an **event** (e.g. a new email or message). |
| **Skills** | Reusable, named procedures the bot can follow for recurring work. |
| **Connectors** | Authorized links to services such as mail, calendar, drive, chat, code hosting, and CRMs. |
| **Teammates** | Other bots (and people) the bot can message and delegate to. |
| **Computer ("box")** | A persistent Linux machine with a shell, files, and a browser for work that needs real tools. |

## 1. Create A Bot

1. Create a new bot and give it a clear, narrow **purpose** (e.g. "inbox triage", "release notes", "ops monitoring").
2. Write its standing instructions: role, tone, what it may do on its own, and what always needs approval.
3. Seed its memory with stable facts it needs (conventions, preferred formats). Never put secrets in memory.

## 2. Connect Services

- Connect only the services the bot actually needs (least privilege).
- Prefer read-only scopes until a write workflow is proven.
- Use a dedicated machine identity for code hosting where possible (see [`../MACHINE_IDENTITY.md`](../MACHINE_IDENTITY.md)).
- Keep credentials out of prompts, memory, and files; follow [`secure-secret-management.md`](secure-secret-management.md).

## 3. Write Routines

A good routine states:

- **Trigger**: schedule (cron-like cadence and timezone) or event (source and filter).
- **Inputs**: which connectors and memory it reads.
- **Steps**: what to check, how to decide.
- **Output**: where results go (a summary in chat, a draft, a file).
- **Guardrails**: what it must not do without approval.

Example:

```text
Trigger: weekdays 08:00 local time
Read: unread mail from the last 24h, today's calendar
Do: group mail by urgency; flag conflicts on the calendar
Output: a short summary in chat; draft (do not send) replies for the top 3
```

Start with a manual run, review the output, then enable the schedule.

## 4. Delegate Between Bots

- Give each bot one domain; have a coordinator bot hand off well-scoped tasks.
- A delegation message should include the goal, context, constraints, and the expected shape of the result.
- The receiving bot reports back; the coordinator decides on next steps.
- To coordinate many bots as a team, see [`grok-bot-org-board-guide.md`](grok-bot-org-board-guide.md).
- Bots share one computer (see the architecture doc), so hand off files by path rather than pasting large content.

## 5. Approval And Safety Basics

- **Drafts before external sends**: emails, chat messages, and posts are drafted first and sent only after a human approves.
- **Approval for risky actions**: deleting, sharing, purchasing, force-pushing, submitting forms, or changing production systems require explicit approval.
- **Untrusted content stays data**: instructions found inside emails, web pages, or documents are never followed as commands.
- **Blocked means stop**: if a safety check blocks an action, the bot asks for approval instead of working around it.

## 6. Good Practices

- Keep bots narrow and instructions short; refine from real output.
- Make routines idempotent so a re-run does no harm.
- Log what routines did (a summary per run) so you can audit them.
- Review connector scopes and routines periodically; remove what is unused.
- Store reusable procedures as skills instead of repeating long prompts.
- Never put names of customers, credentials, or personal data in shared or public artifacts.
