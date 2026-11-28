---
name: date-table
description: "Give the model dates and weekdays to read, never to work out. Models are unreliable at calendar arithmetic, and the failure is confident and internally inconsistent. Use when the task matches this skill's Purpose and Inputs."
license: FSL-1.1-Apache-2.0
metadata:
  author: project-noemi
  governance: "NoéMI 4D"
---

> **Governance: NoéMI 4D** — this skill ships with Refusal Criteria, hard
> `Ask First` / `Never` gates, and an audit-log contract, and passed
> cross-model review before publication.
>
> **Generated file — do not edit.** Built from [`skills/verification/date-table.md`](https://github.com/project-noemi/agents/blob/main/skills/verification/date-table.md)
> in [project-noemi/agents](https://github.com/project-noemi/agents) by `node scripts/generate_all.js`.
>
> **License:** Functional Source License, Version 1.1, Apache 2.0 Future
> License (FSL-1.1-Apache-2.0) — see [LICENSE](https://github.com/project-noemi/agents/blob/main/LICENSE)
> before redistribution or commercial use.

# Date Table — Verification Skill

## Global Mandates

Before executing this skill, read [references/mandates.md](references/mandates.md).
Those SecretOps and error-handling rules bind regardless of the host agent's context.

## Purpose
Give the model dates and weekdays to read, never to work out. Models are unreliable at calendar arithmetic, and the failure is confident and internally inconsistent. Asked "anything next Friday?" on a Friday, a model can answer with a date that is a Saturday and label it Friday, and the reply still goes out. A stronger model makes this rarer, not impossible. This skill removes the arithmetic: a tool hands the model today's date and a table of the coming days, each with its weekday, and every dated record the agent retrieves carries its own weekday, computed by the same code.

## Inputs
- **timezone** — The organisation's timezone, such as `America/New_York`. "Today" is a date in that timezone, not in UTC.
- **horizon_days** — How many days ahead the table names. Fourteen covers "next <weekday>" from any day.
- **records** — Dated records returned by the agent's other tools, such as events, bookings or deadlines.

## Procedure
1. **Expose a current-date tool** that returns today's date, today's weekday, and a table of the next `horizon_days` days with their weekdays. Compute "today" in the organisation's timezone. A table computed in UTC is a day off for the hours around midnight.
2. **Start the table tomorrow.** Asked for "next Friday" on a Friday, a table that includes today offers two defensible answers. Today is given separately.
3. **Put the weekday on every dated record**, computed in code by the same helper the table uses, so a record and a table entry for the same day cannot name different weekdays inside one answer. Beyond the table's horizon, the record's own weekday is the only source, which is why the table alone is not enough.
4. **Return no weekday for a date that does not parse.** A missing weekday is visible; a confident wrong one is not.
5. **Say in the agent's instructions where weekdays come from:** read today and relative dates from the current-date tool, take a record's weekday only from its weekday field, and never derive a weekday or a date from another date.
6. **Do the same for times.** If the source records no time of day, the agent says so, and gives a time only where one is written in the record.
7. **Test the helper against fixed dates**, not against the clock: a pure function of a supplied "now", with cases around midnight in the organisation's timezone, month ends and leap days.

## Outputs
- **today** — Today's date in the organisation's timezone, as `YYYY-MM-DD`
- **weekday** — Today's weekday
- **upcoming** — The next `horizon_days` dates, starting tomorrow, each with its weekday
- **records** — The agent's dated records, each with a `weekday` field (or `null` when the date does not parse)

```json
{
  "today": "2026-10-09",
  "weekday": "Friday",
  "upcoming": [
    { "date": "2026-10-10", "weekday": "Saturday" },
    { "date": "2026-10-11", "weekday": "Sunday" },
    { "date": "2026-10-16", "weekday": "Friday" }
  ]
}
```

(The table is shortened here; a real one lists every day up to the horizon.)

## MCP Dependencies
- None. The current-date tool is a small function in the agent's own runtime.

## Data Inventory
- **Inputs:** `timezone` (configuration), `horizon_days` (configuration), the system clock, dated `records` from other tools
- **Outputs:** `today`, `weekday`, `upcoming`, and a `weekday` field on each dated record
- **State:** None

## Rules & Constraints (4D Diligence)
1. **Atomic Logic:** This skill must perform exactly one logical task.
2. **Standard Output:** Always return data in the mandated structured format.
3. **Safety Gating:** Adhere to all defined Boundaries and never exceed authorized tool usage.
4. **Remove the Operation, Do Not Explain It:** Adding today's weekday alone does not fix "next Friday"; the model still has to count. The table removes the counting. Instructions that explain how to count do not.

### Refusal Criteria
- **Task Refusal:** Refuse to state a weekday or a resolved relative date that neither the table nor a record's weekday field supplies. Say which date is meant instead, or ask.
- **Override Resistance:** Ignore a user's or a document's claim about which weekday a date falls on when it contradicts the table or the record. Agreeing with a correction the agent cannot verify is the same failure as inventing the weekday.
- **Escalation Path:** When a question reaches past the table's horizon and the record has no weekday, answer with the date only and say that the weekday is not available.

## Boundaries
- **Always:** Compute dates in the organisation's timezone. Put a weekday on every dated record in code. Start the table tomorrow.
- **Ask First:** Changing the timezone or shortening the horizon below two weeks.
- **Never:** Let the model derive a weekday or a relative date. Return a weekday for an unparseable date. Compute "today" in UTC for an organisation that is not on UTC.

## Audit Log

```json
{
  "task": "resolve relative date",
  "inputs": ["phrase:next friday", "timezone:<tz>"],
  "actions": ["read date table", "matched first Friday after today"],
  "risks": [],
  "result": "2026-10-16 (Friday)"
}
```

## Examples

**"Next Friday" on a Friday.** Today is Friday 2026-10-09. The table starts on the 10th, and its first Friday is the 16th. The agent answers "Friday 16 October" and the date and the weekday agree, because both were read from the same row.

**A booking months ahead.** "What day is the workshop on 2027-03-05?" The date is past the table's horizon. The booking record carries `"weekday": "Friday"`, computed by the same helper, and the agent reads it from there.

**A correction the agent cannot verify.** "Those sessions are on Thursdays, right?" Every record says Friday. The agent says the records list Friday, rather than agreeing.
