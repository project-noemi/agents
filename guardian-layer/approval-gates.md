# Human-Approval Gates

The [orchestrator runtime contract](../docs/tool-usages/orchestrator-runtime-contract.md#5-human-approval-boundaries)
says the orchestrator, not the persona, must stop before a mutating action such as sending email.
This page says what that stop has to guarantee for an approval click to mean what the approver
thinks it means.

The rules come from a production agent deployment that drafts one-to-one email, newsletters and
social posts. Each is released from a chat card (a message with **Approve**, **Edit** and **Decline**
buttons) that a person clicks. The same rules apply to any approval surface: a web view, an email
digest, a ticket transition.

## What the click is for

An approval puts **a human read of the rendered output** between a model and the outside world.
Every rule below protects that read. What the approver saw is what is sent, sent once, to the
destination the card named, under the conditions the card stated. A gate that allows any of those
to drift between the card and the send is approving something nobody read.

Approval is an additional condition, never a replacement. Any other check on the action, such as a
check on where an email's recipient came from, still runs after the click.

## 1. The card carries an opaque id and nothing else

- The button's value is a random id (a UUID). The kind of action, the destination, the body and the
  audience are read server-side from a stored **approval record**.
- The id arrives from an interaction payload that a client can forge. Check its shape before it
  builds a file path or a query.
- Dispatch on the **record's** kind, never on anything in the payload. Each handler refuses a record
  of another kind. A tampered payload can then name a different approval, but cannot redirect what
  any approval sends, and a newsletter approval has no code path to the one-to-one sender.

## 2. Leaving `pending` is one atomic transition

An approval record moves from `pending` to exactly one of `approved`, `declined`, `superseded` or
`expired`, and never moves again.

- Winning the transition is a single atomic create-if-absent, such as an exclusive file create, a
  unique-key insert or a compare-and-set. There is **one lock per approval, not one per target
  state**, so a simultaneous Approve and Decline cannot both succeed.
- Whoever wins owns the transition. Every other caller is told it was already handled. A double
  click, or the chat platform's own retry of an interaction, therefore cannot send twice.
- "Missing", "malformed", "already decided" and "expired" all return the same refusal, and a caller
  cannot branch on which it was. A client still showing buttons that were removed server-side is a
  cosmetic problem, not a security one.
- A record that exists but cannot be parsed refuses every click. Nothing is sent on the strength of
  a record the system could not read.
- Approvals outlive the process. A card clicked after a restart must still work, so the record is
  durable storage, not memory.

## 3. A revision is a new record

- **Edit** and **Decline** retire the card. An edit creates a new record, with a new id, a revision
  number and a pointer to the record it supersedes. The retired card can never be approved: the
  server refuses the click, rather than the client hiding the button.
- **The edit box holds the body and nothing else.** Recipients, audience, channel and brand are
  carried over server-side, byte for byte. A named approver rewriting wording is trusted. A model or
  a form field choosing the destination is what the gate exists to stop.
- The record stores a **digest** over everything that decides the outcome: wording, recipients or
  audience, channel, attachments. The click recomputes it from what is about to be sent and refuses
  on a mismatch, such as a draft edited outside the card while the card waited.
- Declining also ends any suspended run waiting on the card, so no run is left holding storage open.

## 4. Re-check at the click, never cache

A card can wait hours between being rendered and being clicked. Anything that can change in that
window is read again at the click.

- **Switches.** A lane or feature switched off since the card was made refuses.
- **Approver rights.** The clicker is checked against the approver list at the click, not when the
  card was posted.
- **External state the card showed.** If the card showed a recipient's address from a system of
  record, the address is read again and must equal what the card showed. A contact edited while the
  card waited refuses, and the thread asks for a fresh card.
- **Environment mode.** If the runtime distinguishes `live` from `rehearsal` (everything except the
  network call), the mode is **stamped on the record when the card is made**, shown on the card, and
  compared with the current mode at the click. A disagreement **refuses** rather than choosing a side.
  Honouring the stamp would let a `live` card publish from a development machine. Honouring the
  current mode would let a card that said "rehearsal" publish for real. The only safe move is a new
  draft, which is a new question and a new consent.

## 5. Send once, and report what happened

- Where the provider supports it, the approval id is the **idempotency key**. A retried click
  replays the first send instead of making a second one.
- An **indeterminate** result (a timeout after the request left) is never retried automatically: a
  retry could be a second email. The thread says the outcome is unknown and where to check.
- If the provider holds the action in its own approval queue, the click reports it as **not sent
  yet** and says what would release it. It is never reported as sent, and never as failed.
- A rehearsed result is marked in every field that outlives the moment. There is no synthetic URL,
  and the id carries a `rehearsal:` prefix.

## 6. Record who decided

- The record stores the decider's platform user id, the time, a decision note, and the digest of
  exactly what they released.
- The thread names the decider with a **structured mention built from the stored id**. A display name
  is never interpolated into text that is escaped or parsed as markup: escaped, a mention renders as
  literal text; unescaped, a display name becomes an injection path.

## 7. No agent holds a send, publish or approve tool

The gate is deterministic code reached from the card. Models draft. A draft tool stores the draft
server-side and returns its id, and sends nothing.

Enforce this with a **census test** rather than a convention:

- Enumerate every agent the runtime actually builds, not a hand-maintained list, and read each
  agent's tool ids.
- Fail on any id that reads as a send, post, publish, broadcast, campaign, bulk, chat-post or
  approve capability.
- Treat both `-` and `_` as word separators. Tool ids from MCP servers are usually snake_case
  (`create_post`) and local ones often kebab-case (`create-post`). A hyphen-only pattern lets
  `create_post` through. Avoid `\b`, which also matches inside `postcode`.
- Add a **positive** test: build an agent that does carry a posting tool and assert the guard
  rejects it. Every negative test over the real agents stays green whether the guard works or not.

An illustrative pattern:

```js
const SEND_TOOL_ID =
  /(^|[-_])send([-_]|$)|(^|[-_])post([-_]|$)|publish|campaign|bulk|blast|broadcast|approv/i;
```

## 8. Self-approval

Keep two lists: who may **ask** for a draft, and the shorter list of who may **release** one.

A person on both lists may release their own request. The click's value is a human reading the
rendered output, not two-party authorisation. A person who asked for a draft, read the rendered
card and clicked Approve has done that read in full. Requiring a second person adds no reading. It
moves the reading to someone with less context and makes every release wait on their attention,
and a predictable response to that wait is approving without reading.

- **Do not key a two-person rule to headcount.** A control that turns itself on when a second
  approver is added changes behaviour on an unrelated configuration change. Nobody notices until a
  colleague cannot release their own work.
- **Risk belongs to the lane, not the person.** If a second reader is ever worth the delay, it is a
  per-kind rule on the lane where a mistake is most expensive, such as one-to-one email, which
  cannot be retracted. It is not a rule on every approval.
- **Name what is left.** Without a second reader, nothing catches one person's mistake before it
  goes out. What remains is accountability, through the recorded decider, rather than prevention.
  Write that trade down where the gate is described.

## 9. The one exception: an unattended scheduled message

Some recurring messages are not worth a card per run, such as an internal reminder posted to the
team that set it up. Approving a reminder to yourself every week is friction with no safety value.
Such a message may post without per-run approval **only when all of these hold**:

- **Setting it up is the approval.** Creating or editing the schedule requires approver rights,
  checked when the form opens and again when it is submitted.
- **The destination is where it was set up, and nobody types it.** The record holds the conversation
  the schedule was created from, validated as a platform conversation id. The form has no
  destination field, and an edit cannot change the destination.
- **The destination allowlist is asked again on every run.** A conversation removed from it gets
  nothing. The run fails closed, raises an alarm and stays owed.
- **The schema is strict.** A stored target that turns up with an unknown key such as `to` or
  `channel` is refused, not read with the extra key dropped.
- **The job type cannot change.** A schedule that posts internally cannot be edited into one that
  publishes outside the team.
- **Only the schedule pings anyone.** Mentions come from a stored list of validated user ids, with an
  upper bound. The generated body cannot ping or link: platform mention and link syntax is
  neutralised in the plain-text fallback and in any rich block. This matters most when the body may
  quote untrusted text, such as a community feed. Do not rely on undocumented renderer behaviour.
- **An empty run posts nothing.** A reminder saying "nothing to do" teaches people to ignore the
  ones that matter.
- **The message says what it is.** A context line names the schedule and how to change or stop it.

Anything that leaves the team, such as email or a public post, still produces a card on every run.
A schedule is a new way to *ask*, not a new way to act.

## Tests that hold these properties

| Property | Test |
| --- | --- |
| Opaque id | A payload naming another record's kind or destination changes nothing that is sent. A malformed id is refused before storage is touched. |
| Single use | Two concurrent transitions on one record: exactly one wins. Approve after Decline is refused. |
| Revision | Approving a superseded record is refused. An edit preserves recipients byte for byte. |
| Digest | Changing the stored draft after the card was made refuses the click. |
| Re-check | Switching the lane off, changing the mode, or editing the recipient between card and click each refuses. |
| Census | Every built agent carries no send, publish or approve tool, and a planted posting tool is caught. |
| Unattended | A stored target with an extra destination key is refused. A body containing a broadcast mention posts it inert. |

## Appendix: recurrence rules for scheduled jobs

Schedules feed approval cards and unattended messages alike. These rules keep a schedule from
quietly becoming a different schedule.

- **Anchor "every N weeks" on the schedule's creation.** Anchoring on the last run makes the cadence
  drift every time a run is missed. Anchoring on an absolute epoch is stable but arbitrary.
- **"Ends after N" counts runs that produced something.** A missed period fires once on return, and
  an empty run produces nothing. Neither spends the allowance. Keep "when it last ran" and "how many
  runs it has used" as separate fields.
- **An end date is inclusive.**
- **An edit is the same schedule with new answers.** It keeps the id, the creation anchor, the
  creator and the run count. The job type cannot change. Deleting and re-creating resets both the
  anchor and the count, invisibly.
- **Changing when it runs moves the catch-up watermark.** Otherwise a schedule moved to 06:00 at
  lunchtime fires immediately for a slot nobody promised. Only a recurrence change moves it. A rename
  that moved it would silently drop a run the schedule still owed.
- **On an edit form, an absent field means unchanged, and an empty field means empty.** Some chat
  platforms omit untouched values of certain input types from the submission. Fall back to the
  stored record for every field, not only the ones known to be affected.
- **Show the rule as a sentence** ("every 2 weeks on Mon and Thu at 06:00") wherever schedules are
  listed. That line is where people check that what they set up is what they meant.
