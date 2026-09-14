# Rotary District 1911 (Hungary) — Club Operations Example

This example applies the generic [Rotary Club Operations agent](../../agents/operations/rotary-club-operations.md) to Hungarian District 1911 club workflows, demonstrating how to anchor a governed operations assistant to organization-specific knowledge sources.

## Use case

A club president in District 1911 needs to plan a July–June presidential year, draft minutes in Hungarian or English, prepare speaker briefs, and maintain continuity through officer transitions — all while distinguishing Rotary International requirements, Hungarian district practice, and local club rules.

## Canonical knowledge sources

These are the two NotebookLM notebooks that contain the district-specific knowledge base. Access requires an authorized Google account; links alone do not grant access.

| Notebook | Purpose | URL |
|----------|---------|-----|
| Club-president knowledge base | Hungarian and international Rotary materials, association operations, officer responsibilities, venues, and speakers | [https://notebooklm.google.com/notebook/79991b67-2486-4b44-a512-d161437750c4](https://notebooklm.google.com/notebook/79991b67-2486-4b44-a512-d161437750c4) |
| Club-pattern notebook | Seven years of club-operations patterns: recurring work, preparation, continuity, and lessons from experience | [https://notebook.google.com/notebook/ebe34c2c-d14f-4004-9eaa-d2bf27450686](https://notebook.google.com/notebook/ebe34c2c-d14f-4004-9eaa-d2bf27450686) |

> **Source coverage status:** Initial edition; notebook-content review pending. The notebooks remain the source of truth. An authorized reviewer must verify each rule, pattern, and date against underlying documents before labeling findings as notebook-verified.

## Quick start

### Option 1: Chat directly with the notebooks (no setup required)

If you already use Gemini/NotebookLM, open either notebook above and ask questions directly:

> Using the club-president sources, explain my first 30 days as president. Separate Rotary International requirements, Hungarian district practice, club rules, and suggestions. Cite the underlying documents and flag anything that needs a current-year check.

> Készíts elnöki éves feladatnaptárat. Különítsd el a Rotary International előírásait, a magyar district gyakorlatát és a klub saját szokásait. Jelöld a forrásokat és az ellenőrizendő határidőket; ne szerepeljenek benne személyes adatok.

### Option 2: Use the governed agent workflow

For drafts with evidence trails, explicit unknowns, refusal gates, and audit records, load the [Rotary Club Operations agent](../../agents/operations/rotary-club-operations.md) in your repository-aware AI client:

```bash
# From repository root
npm ci
node scripts/generate_all.js
npm run validate
```

Then in your AI session:

```text
Read AGENTS.md, agents/operations/rotary-club-operations.md, and
skills/operations/rotary-meeting-minutes.md. Adopt the persona.

For this District 1911 deployment, use these notebook URLs as canonical sources:
- Club-president knowledge base: https://notebooklm.google.com/notebook/79991b67-2486-4b44-a512-d161437750c4
- Club-pattern notebook: https://notebook.google.com/notebook/ebe34c2c-d14f-4004-9eaa-d2bf27450686

Draft minutes for a board meeting (2030-09-10, Europe/Budapest) from these synthetic notes:
N1: Programme lead proposed Venue A for next speaker meeting.
N2: Treasurer requested written quote before any spending decision.
N3: Secretary agreed to obtain quote by 2030-09-17.
N4: No venue decision or vote was recorded; quorum evidence absent.

Produce draft minutes, action register, unknowns, and separate JSON audit record.
Language: English. Source status: notebooks not consulted (synthetic exercise).
```

## District 1911 context

### District portal and resources

- **District website:** [https://rotary.hu/](https://rotary.hu/)
- **District number:** 1911 (Hungarian Rotary clubs)
- **Officer learning events:** Current district invitations use PELS/SELS terminology (verify applicability and dates each year rather than assuming)
- **Language:** Club operations conducted in Hungarian and/or English; preserve Hungarian terms where translation affects meaning (e.g., *elnökségi ülés*, *közgyűlés*)

### Hungarian legal and compliance context

Club operations must comply with:
- Rotary International governing documents (current edition)
- District 1911 instructions and calendar
- Club's valid governing documents
- Hungarian association law, accounting standards, and data protection (GDPR)

**Important:** The agent does not resolve legal conflicts. Route legal, accounting, filing, and safeguarding questions to the club's qualified advisers with relevant documents. Do not infer Hungarian obligations from another district's practice.

## What the agent will NOT do

Per the [Refusal Criteria](../../agents/operations/rotary-club-operations.md#refusal-criteria):

- Fabricate or certify minutes, votes, quorum, approvals, or deadlines
- Disclose private club records or member identities into public artifacts
- Attempt autonomous invitations, bookings, payments, filings, or membership decisions
- Access notebooks without authorization

The agent drafts and advises; officers retain decisions, spending authority, record approval, and official representation.

## Synthetic exercises (no notebook access required)

Try these acceptance checks with the generic agent loaded:

| Skill | Test prompt | Expected behavior |
|-------|-------------|-------------------|
| Meeting minutes | Draft minutes from contradictory notes (one says venue approved, another says no vote recorded) | Surface the conflict explicitly; refuse to pick a convenient outcome; return decision to secretary |
| Annual calendar | Plan July 2030–June 2031 with no current district calendar supplied | Include 12 months + pre-term block, mark all district dates as "unscheduled verification tasks," refuse to invent deadlines |
| Speaker brief | Prepare 45-min session brief when speaker bio is unavailable and venue accessibility is unverified | Use "Guest Speaker" placeholder, list venue accessibility as unconfirmed, refuse to invent credentials or claim confirmation |

## Adapting to your club

To deploy for a different District 1911 club:

1. Replace the notebook URLs above with your club's authorized knowledge sources (or remove them for public exercises)
2. Supply your club's meeting cadence, timezone, and governance excerpts
3. Verify district calendar dates against current notices rather than carrying forward historical patterns
4. Keep member names, minutes, contact lists, confidential finances, and identifiable incidents out of git and audit logs

For clubs in other districts or countries, fork this example and update:
- District number, portal URL, and district-specific terminology
- Applicable legal/compliance framework
- Language and cultural context
- Officer learning event naming conventions

## 4D alignment

| Dimension | Implementation in this example |
|-----------|-------------------------------|
| **Delegation** | Officers own decisions; agent prepares drafts within explicit scope |
| **Description** | Meeting type, year, audience, language, source status, and outputs are explicit |
| **Discernment** | Check citations, dates, contradictions, and inferred decisions before returning drafts |
| **Diligence** | Keep private data out of git/logs; record uncertainty; refuse fabricated authority |

## Related repository resources

- **Generic agent:** [agents/operations/rotary-club-operations.md](../../agents/operations/rotary-club-operations.md)
- **Generic guide:** [docs/examples/rotary-club-operations.md](../../docs/examples/rotary-club-operations.md)
- **Skills:** [rotary-annual-calendar](../../skills/operations/rotary-annual-calendar.md), [rotary-meeting-minutes](../../skills/operations/rotary-meeting-minutes.md), [rotary-speaker-brief](../../skills/operations/rotary-speaker-brief.md)
- **4D Framework:** [docs/METHODOLOGY.md](../../docs/METHODOLOGY.md)

---

**Example status:** Initial district-specific deployment; notebook review pending. Keep confidential club data in your approved private workspace, not in this public repository.
