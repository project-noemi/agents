# Phase 0 Assessment Kit

This kit is the reusable operational bundle for a **Phase 0 initial assessment**. It is designed for clients, MSPs, MSSPs, and Accelerators who need a structured way to answer two separate questions before launching an advanced AI initiative:

1. **Can we do this safely?**
2. **Can we do this in a way that creates real business value?**

That is why the kit is now explicitly split into:

- a **Security Assessment**
- an **AI Readiness Assessment**

The kit is intentionally diagnostic and non-salesy. Its purpose is to establish readiness, document risk, identify the first worthwhile pilot, and produce a practical remediation path. It is not a penetration test, a compliance certification, or a disguised procurement script.

## The Two Assessment Tracks

### Security Assessment

See [security-assessment.md](security-assessment.md).

This track evaluates:

- identity and privilege
- data boundaries
- endpoint and SaaS hygiene
- backups and incident readiness
- logging and monitoring
- secrets, APIs, and machine identities
- third-party exposure

It answers:

> Are we grounded enough to begin AI safely?

### AI Readiness Assessment

See [ai-readiness-assessment.md](ai-readiness-assessment.md).

This track evaluates:

- use-case clarity
- process stability
- data and knowledge readiness
- human approval boundaries
- role redesign and workforce uplift
- integration practicality
- sponsorship and change readiness
- value measurement and ROI baseline

It answers:

> Are we organized enough to turn AI into governed productivity, more output, and lower unit cost?

## What This Kit Contains

- [security-assessment.md](security-assessment.md) — the cybersecurity half of the initial assessment
- [ai-readiness-assessment.md](ai-readiness-assessment.md) — the business and operating-model half of the initial assessment
- [consent-template.md](consent-template.md) — language for authorizing a non-invasive two-track review
- [report-template.md](report-template.md) — the structure for a written report of findings across both tracks
- [roadmap-template.md](roadmap-template.md) — a 30/60/90-day remediation and enablement plan
- [readiness-rubric.md](readiness-rubric.md) — the gate used to classify security readiness, AI readiness, and the overall recommendation

## Recommended Use

1. Confirm the business problem, target workflow, and systems the AI initiative will touch.
2. Use the consent template to document scope and expectations.
3. Perform the **security assessment** using [../PHASE_ZERO_SECURITY_BASELINE.md](../PHASE_ZERO_SECURITY_BASELINE.md) and [security-assessment.md](security-assessment.md).
4. Perform the **AI readiness assessment** using [ai-readiness-assessment.md](ai-readiness-assessment.md).
5. Deliver one combined report in plain language for the business owner and technical leads.
6. End with the roadmap and readiness rubric so the client knows whether to proceed, proceed with guardrails, or pause.

## Why This Matters For NoeMI Participants

This split helps NoeMI participants speak to business owners at a higher level.

Instead of saying:

> I can do this task with AI.

they can say:

> We can assess whether this workflow is safe, whether it is worth automating, what human role should remain in control, and how the business can increase output without increasing headcount at the same rate.

That is the real shift from tool use to governance and value creation.

## Ground Rules

- The client keeps the findings.
- NewPush may help if the client does not already have a capable MSP or MSSP, but the kit is not tied to a mandatory downstream vendor relationship.
- Outputs must exclude secrets, unnecessary sensitive detail, and exploit instructions.
