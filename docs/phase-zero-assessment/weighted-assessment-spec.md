# Weighted Self-Assessment Scoring Spec

A design specification for a **self-scored, weighted** variant of the Phase 0 assessment. It is the input for the classman team to implement as an LMS class; it does not replace the assessor-led kit.

## A. Purpose And Scope

This spec defines a self-serve, weighted-scoring version of the Phase 0 assessment that an SME can complete without an assessor present, delivered as a classman LMS class. It complements — it does not replace — the assessor-led [security-assessment.md](security-assessment.md) and [ai-readiness-assessment.md](ai-readiness-assessment.md); those go deeper, while this variant produces a fast, self-scorable readiness signal with the same two-track banding the [readiness-rubric.md](readiness-rubric.md) already uses.

It reuses the exact assessment areas from the kit — 7 Security areas from [security-assessment.md](security-assessment.md) and 9 AI-Readiness areas from [ai-readiness-assessment.md](ai-readiness-assessment.md) (areas 1–8 on `main` plus the incoming *Individual Adoption Readiness* area introduced by PR #327). Questions are derived from the probe bullets under each area — no new areas are invented here.

## B. Scoring Model

This model follows the classman team's move from all-or-nothing grading to **weighted answers**: every option earns graded points, and there are no wrong answers — only more or fewer points.

### Weighted answer scale

Each question offers up to four graded options on a fixed scale. The best answer earns the most points; each step down earns one less:

| Points | Level | Meaning |
|-------:|-------|---------|
| **3** | ready | True today, and you could show evidence |
| **2** | mostly | True for most of the workflow, minor gaps |
| **1** | partial | Partly true, or true for some cases only |
| **0** | not-yet | Not true today, or unknown |

The scale is consistent across every question. There is no negative score and no "wrong" answer — a `0` simply signals a gap to close, which aligns with the weighted-answer direction ("best answer = X, second best = X−1, …").

### Per-track scoring (banded separately)

> **Recommendation:** Score and band **Security** and **AI-Readiness independently**. Never collapse them into one aggregate — an organization can be safe but not ready, or ready but not safe, and each track drives different remediation.

For each track, sum the points earned and divide by the track maximum (3 × number of questions in that track) to get a normalized percentage. With the question bank in Section C:

- **Security:** 16 questions → max **48 points**
- **AI-Readiness:** 21 questions → max **63 points**

Map each track's percentage to a band (thresholds are **tunable defaults**, not fixed law):

| Track score | Band |
|------------:|------|
| **≥ 80%** | `ready now` |
| **55–79%** | `ready with guardrails` |
| **< 55%** | `not ready yet` |

The band names are exactly those in [readiness-rubric.md](readiness-rubric.md).

### Critical-gap override

> **Recommendation:** A single fatal answer forces its track to `not ready yet`, no matter how high the total score. Some gaps cannot be averaged away.

Certain lowest-level options are marked `[critical-gap]` in the question bank (for example: no verified backups, no MFA, no named process owner). The rule:

> **If any `[critical-gap]` option is selected — i.e. a critical-gap answer at the `not-yet` (0-point) level — that track's band is forced to `not ready yet`, regardless of the computed percentage.**

A track can therefore score 90% and still land in `not ready yet` if one critical gap is present. The report should name which critical gap triggered the override so the reader knows exactly what to fix.

### Overall recommendation

The overall recommendation is **derived from the two track bands** (after any override), consistent with the Overall Recommendation section of [readiness-rubric.md](readiness-rubric.md):

| Security band | AI-Readiness band | Overall recommendation |
|---------------|-------------------|------------------------|
| `ready now` | `ready now` | **proceed** |
| `ready with guardrails` | `ready now` / `ready with guardrails` | **proceed with guardrails** |
| `ready now` | `ready with guardrails` | **proceed with guardrails** |
| `not ready yet` | any | **pause for remediation** |
| any | `not ready yet` | **pause for remediation** |

In short: `proceed` only when both tracks are `ready now`; `pause for remediation` whenever either track is `not ready yet` (including by override); otherwise `proceed with guardrails`.

## C. Question Bank

Each question lists a prompt and its graded options with points. A `[critical-gap]` marker on a `0`-point option means selecting it triggers the override for that track. Questions are derived from the probe bullets of each kit area; answer them for **one specific workflow**, honestly.

### Security Track (7 areas, 16 questions)

Source: [security-assessment.md](security-assessment.md).

#### S1. Identity, MFA, and Privileged Access

**S1.1 — Is multi-factor authentication enforced on the accounts and systems this workflow touches?**
- (3) Enforced for all users, including admins and remote access
- (2) Enforced for most, a few exceptions remain
- (1) Enabled but optional or inconsistently applied
- (0) Not enforced, or unknown `[critical-gap]`

**S1.2 — Are administrative and everyday accounts separated, with least-privilege scoping for connected systems?**
- (3) Separate admin accounts, access scoped to what each role needs
- (2) Mostly separated, some over-broad access remains
- (1) Shared or over-privileged accounts are common
- (0) No separation; everyone effectively has broad access

**S1.3 — Do service accounts and machine identities used by automation have named owners?**
- (3) Every service account has an owner and a defined scope
- (2) Most do; a few are unowned or over-scoped
- (1) Service accounts exist but ownership is unclear
- (0) Unknown or unmanaged service accounts

#### S2. Data Boundaries and Refusal Rules

**S2.1 — Is data classified well enough to know what may and may not go into an AI tool?**
- (3) Clear classes with documented approved vs prohibited AI usage
- (2) General understanding, not fully documented
- (1) Ad hoc; decided case by case
- (0) No classification; no refusal boundaries

**S2.2 — Are human-only tasks and human-only data classes defined?**
- (3) Explicitly defined and communicated
- (2) Understood informally by the team
- (1) Only a rough sense exists
- (0) Not defined

#### S3. Endpoint, Server, and SaaS Hygiene

**S3.1 — Are the devices and servers in scope managed and patched on a known cadence?**
- (3) Centrally managed with a regular, tracked patch cadence
- (2) Mostly managed, cadence is informal
- (1) Partial management, patching is reactive
- (0) Unmanaged or unknown

**S3.2 — Is there endpoint protection (EDR/MDR) and a current asset inventory for systems in scope?**
- (3) EDR/MDR coverage and a maintained inventory
- (2) Protection in place, inventory partial or stale
- (1) Limited coverage, no reliable inventory
- (0) No endpoint protection or inventory

#### S4. Backup, Recovery, and Incident Response

**S4.1 — Are the systems in scope backed up?**
- (3) Backups cover all in-scope systems on a defined schedule
- (2) Most systems covered, some gaps
- (1) Partial or inconsistent backups
- (0) No backups `[critical-gap]`

**S4.2 — Has a restore actually been tested with evidence it works?**
- (3) Restores tested recently with documented evidence
- (2) Tested at some point, not recently
- (1) Assumed to work, never verified
- (0) Recoverability unknown or untested `[critical-gap]`

**S4.3 — Is there an incident escalation path with a named owner for breach or workflow-failure handling?**
- (3) Documented escalation path with a named owner
- (2) Informal path, owner generally known
- (1) Unclear who responds or how
- (0) No incident response ownership

#### S5. Logging, Monitoring, and Forensics

**S5.1 — Is there centralized logging covering the systems and AI-related service accounts in scope?**
- (3) Centralized logs with adequate coverage and retention
- (2) Most systems logged, retention limited
- (1) Scattered logs, hard to correlate
- (0) Little or no usable logging

**S5.2 — Does someone own alerts, and can automation actions be traced?**
- (3) Alert ownership defined; automation actions are traceable
- (2) Alerts monitored informally
- (1) Alerts exist but nobody clearly owns them
- (0) No alerting or traceability

#### S6. Secrets, APIs, and Machine Identity

**S6.1 — Are secrets handled through a vault-backed path rather than plaintext?**
- (3) Vault-backed handling; no plaintext secrets in files or repos
- (2) Mostly vault-backed, some plaintext remains
- (1) Migration started; plaintext `.env` habits persist
- (0) Secrets live in plaintext files or shared ad hoc `[critical-gap]`

**S6.2 — Is there a rotation process, and non-human auth for headless automation?**
- (3) Rotation process exists; machine identities used for automation
- (2) Rotation happens irregularly
- (1) Rotation is manual and rare
- (0) No rotation; shared static credentials

#### S7. Third-Party and Vendor Exposure

**S7.1 — Have the AI vendors and connectors in scope been reviewed?**
- (3) Vendors and connectors reviewed, exposure understood
- (2) Some review done, gaps remain
- (1) Only informal awareness
- (0) No vendor or connector review

**S7.2 — Are data-processing and contract concerns for those vendors addressed?**
- (3) Data-processing terms reviewed and acceptable
- (2) Reviewed, some open questions
- (1) Aware but not yet addressed
- (0) Not considered

### AI-Readiness Track (9 areas, 21 questions)

Source: [ai-readiness-assessment.md](ai-readiness-assessment.md). Area 9 aligns with the *Individual Adoption Readiness* area added by PR #327.

#### A1. Business Use-Case Clarity

**A1.1 — Is there a specific workflow to improve, with real volume and real pain?**
- (3) Specific workflow, known volume, clearly painful
- (2) Identified, volume/pain roughly understood
- (1) A general area, not yet specific
- (0) No specific workflow in mind

**A1.2 — Does the workflow have a named process owner who can decide to change it?**
- (3) Named owner with authority to change the workflow
- (2) Owner identified, authority partial
- (1) Ownership is shared or unclear
- (0) No named process owner `[critical-gap]`

**A1.3 — Is there a named executive sponsor for this initiative?**
- (3) Engaged sponsor who backs the pilot
- (2) Sponsor identified, engagement light
- (1) Interest exists, no clear sponsor
- (0) No sponsor

#### A2. Process Stability and Repeatability

**A2.1 — Does the workflow have repeatable steps rather than changing every time?**
- (3) Stable, repeatable steps
- (2) Mostly repeatable, some variation
- (1) Frequently changing
- (0) No stable process; a moving target

**A2.2 — Are inputs, outputs, and handoffs clear?**
- (3) Clear inputs, outputs, and handoffs
- (2) Mostly clear, some ambiguity
- (1) Only partly understood
- (0) Unclear or undocumented

#### A3. Data and Knowledge Readiness

**A3.1 — Are the source documents and systems the work relies on known and accessible?**
- (3) Known, accessible, and understandable
- (2) Mostly known, some access gaps
- (1) Partially known
- (0) Unknown or inaccessible

**A3.2 — Can normal cases be told apart from exceptions that a human must handle?**
- (3) Exceptions are recognizable and can be escalated
- (2) Usually recognizable
- (1) Only sometimes
- (0) No way to distinguish exceptions

#### A4. Human Approval and Decision Rights

**A4.1 — Is the final human approver for the workflow's output known?**
- (3) Final approver is named and agreed
- (2) Generally known, not formalized
- (1) Unclear who signs off
- (0) No human approver identified `[critical-gap]`

**A4.2 — Do risky or customer-facing actions stay behind a review gate?**
- (3) Review gates enforced for risky/customer-facing steps
- (2) Gates exist, not consistently applied
- (1) Informal review only
- (0) No review gates

**A4.3 — Does an escalation path exist for cases the AI should not handle?**
- (3) Clear escalation path defined
- (2) Path exists informally
- (1) Ad hoc escalation
- (0) No escalation path

#### A5. Workforce Uplift and Role Design

**A5.1 — Is it clear who performs the task today and which parts shift to AI first-pass work?**
- (3) Current performers and AI-first-pass split are defined
- (2) Roughly understood
- (1) Only a vague idea
- (0) Not considered

**A5.2 — Is the human role after AI enters the loop defined (supervision, QC, exceptions)?**
- (3) Post-AI human role is defined and communicated
- (2) Broadly understood
- (1) Not yet worked out
- (0) No view of how roles change

#### A6. Tooling and Integration Practicality

**A6.1 — Are the systems the pilot needs known, with a realistic integration path?**
- (3) Systems known; integration path is realistic
- (2) Mostly known, some unknowns
- (1) Significant uncertainty
- (0) Unknown or clearly impractical

**A6.2 — Can the pilot begin with a constrained, intentionally chosen toolset?**
- (3) Constrained toolset and delivery path chosen deliberately
- (2) Rough plan for a constrained start
- (1) No clear scoping of tools
- (0) No plan; would start too broad

#### A7. Change Readiness and Sponsorship

**A7.1 — Do participants have the time and authority to test and review results?**
- (3) Time and authority are allocated
- (2) Some time, authority partial
- (1) Little bandwidth
- (0) No time or authority allocated

**A7.2 — Do staff understand that AI changes the shape of work, not just its speed?**
- (3) Understood and communicated
- (2) Partly understood
- (1) Seen only as "faster"
- (0) Not understood or discussed

#### A8. Value Measurement and ROI Baseline

**A8.1 — Are current volume, turnaround time, and effort known, at least roughly?**
- (3) Baseline metrics known or easily captured
- (2) Some metrics known
- (1) Only rough guesses
- (0) No baseline data

**A8.2 — Are success metrics defined before the pilot starts?**
- (3) Success metrics agreed up front
- (2) Draft metrics exist
- (1) Vague sense of success
- (0) No agreed definition of success

#### A9. Individual Adoption Readiness

Aligns with the *Individual Adoption Readiness* area from PR #327. Answer for the people who will actually do the work, not just the sponsor.

**A9.1 — Do the people doing the work understand what AI can and cannot reliably do?**
- (3) Solid, realistic literacy across the team
- (2) Reasonable understanding, some gaps
- (1) Limited or uneven literacy
- (0) Little understanding; expectations unrealistic

**A9.2 — Do those people feel confident using AI in their own work, not anxious or exposed?**
- (3) Confident and willing
- (2) Cautiously willing
- (1) Hesitant
- (0) Anxious, exposed, or resistant

**A9.3 — Have concerns like fear of replacement or distrust of output been surfaced openly?**
- (3) Concerns discussed openly and addressed
- (2) Some discussion has happened
- (1) Concerns are known but unspoken
- (0) Concerns are hidden or ignored

## D. Computing The Result

Worked example for one workflow (illustrative numbers).

**Security track** — sum of the 16 answers = **41 / 48 = 85%**. On points alone this is `ready now`. But the answer to **S4.2 (verified restore)** was the `0`-point `[critical-gap]` option "recoverability unknown or untested".

- Points band: `ready now` (85% ≥ 80%)
- Critical-gap override: **triggered** by S4.2 → Security forced to **`not ready yet`**

**AI-Readiness track** — sum of the 21 answers = **44 / 63 = 70%**. No `[critical-gap]` option was selected (A1.2 and A4.1 both scored above `0`).

- Points band: `ready with guardrails` (55–79%)
- Critical-gap override: not triggered → AI-Readiness stays **`ready with guardrails`**

**Overall** — Security is `not ready yet`, so by the derivation table the overall recommendation is **pause for remediation**, even though both tracks scored well on points. The report names the trigger: *no verified backup restore*.

Output lines, matching [readiness-rubric.md](readiness-rubric.md):

```
Security readiness: not ready yet   (85% by points; forced by critical gap: no verified restore)
AI readiness: ready with guardrails (70% by points)
Overall recommendation: pause for remediation
First pilot recommendation: not recommended yet — verify backup recoverability first
```

This shows the two must-haves working together: **separate per-track bands**, and a **hard override** that a high score cannot outvote.

## E. Implementation Notes For classman

Non-prescriptive guidance for the team implementing this as a weighted LMS class:

- Model each question as a weighted quiz question with **per-option points** on the 3/2/1/0 scale (best → not-yet).
- Store a **critical-gap flag per option** so the `[critical-gap]` lowest options can force an override independent of points.
- **Band each track separately** (Security and AI-Readiness) using the normalized-percentage thresholds; keep the thresholds configurable, as they are tunable defaults.
- **Apply the critical-gap override** after banding: any selected critical-gap option forces its track to `not ready yet`.
- Derive the **overall recommendation** from the two track bands, then surface both track bands plus the overall as **completion feedback** — a readiness signal with named gaps, not a pass/fail or GREAT/NOT_COMPLETED grade.
- Where useful, echo the four output lines from [readiness-rubric.md](readiness-rubric.md) so the self-serve result reads the same as the assessor-led report.
