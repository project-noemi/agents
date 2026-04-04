# Phase 0 Security Baseline — Client Guide Before Starting an Advanced AI Project

Project NoéMI treats **Phase 0 Security** as the prerequisite for serious AI adoption. Before an organization launches copilots, agentic workflows, RAG systems, or autonomous integrations, it should first baseline its cybersecurity posture. The goal is not to become "perfect" before using AI. The goal is to understand your real risk, fix critical gaps, and establish safe operating boundaries.

This guide is written from the **client's perspective**. It is meant to help leadership teams, IT managers, and operational owners ask better questions of their internal team, their MSP, or their MSSP before they fund an advanced AI initiative.

This guide covers the **security half** of that conversation. The paired **AI readiness half** of the initial assessment lives in the [Phase 0 Assessment Kit](phase-zero-assessment/README.md), where security readiness and AI readiness are treated as separate executive questions.

## Why Phase 0 Comes First

AI accelerates execution. That is useful when your environment is governed, and dangerous when it is not.

Without a Phase 0 baseline, advanced AI projects often amplify existing weaknesses:

- Shadow AI spreads faster because staff route work to public tools outside policy.
- Sensitive data is exposed because classification and egress boundaries are unclear.
- Agents inherit over-privileged access because identity and secrets are not well governed.
- Automation makes mistakes at machine speed because logging, review, and rollback paths are weak.
- Third-party risk expands because every new model, connector, and SaaS integration becomes part of the attack surface.

Phase 0 is therefore not a delay. It is the step that prevents an AI initiative from being built on an unstable foundation.

## What Clients Should Be Concerned About Before AI

The right question is not "Do we have security?" The right question is "Do we know where our weaknesses are, who owns them, and what controls protect our highest-risk workflows?"

Before an advanced AI project, clients should explicitly baseline the following areas:

### 1. Identity, Access, and Privilege

- Do all staff use centralized identity with MFA?
- Are admin accounts separated from day-to-day user accounts?
- Are service accounts documented, reviewed, and scoped to least privilege?
- If an AI workflow needs access to Google Workspace, GitHub, Slack, CRM, or databases, how will that access be granted, monitored, and revoked?

### 2. Data Classification and Data Boundaries

- Which data is safe for AI, which requires guardrails, and which must never leave the organization?
- Are there written categories such as Public, Internal, Confidential, Regulated, or Client-Owned?
- Can teams identify where sensitive data lives: email, shared drives, SaaS apps, endpoints, file shares, ticketing systems, and cloud storage?
- Do you have a Refusal Principle that clearly defines work that must remain human-only or isolated from public AI systems?

### 3. Endpoint, Server, and SaaS Hygiene

- Are endpoints managed and patched on a predictable cadence?
- Do you have EDR or MDR coverage on user devices and servers?
- Are critical SaaS platforms configured with modern security controls and audit logging?
- Is asset inventory accurate enough to know what systems will be affected by AI integrations?

### 4. Email, Collaboration, and Human Risk

- Are phishing-resistant controls in place?
- Do staff understand what they can and cannot paste into AI systems?
- Are collaboration platforms governed well enough to avoid accidental oversharing?
- Has the organization addressed Shadow AI behavior through policy, education, and technical controls?

### 5. Backup, Recovery, and Incident Response

- Are backups isolated, immutable, or otherwise resilient against ransomware?
- Have restore procedures been tested recently?
- Is there a written incident response plan?
- If an AI workflow causes harm, misroutes data, or triggers a breach, who owns containment and communications?

### 6. Logging, Monitoring, and Forensics

- Are identity, endpoint, firewall, email, cloud, and critical SaaS logs retained centrally?
- Can the team distinguish normal automation from suspicious behavior?
- If an AI-connected service account is abused, would you know?
- Is there an MSSP, SOC, or internal team monitoring alerts, or are logs simply accumulating without action?

### 7. Secrets, APIs, and Machine Identities

- Are credentials kept in a vault or still scattered across `.env` files, tickets, and admin notes?
- Will AI-related services use short-lived credentials, managed secrets, and machine identities?
- Can you rotate or revoke credentials without breaking undocumented workflows?

### 8. Third-Party and Vendor Risk

- Which AI tools, plugins, SaaS platforms, and model providers are being considered?
- What data do they process, where is it stored, and who can access it?
- Are security reviews and contract requirements in place before adoption?
- Will the MSP or MSSP help assess third-party exposure, or only support tools after procurement?

## What a Minimum Phase 0 Cybersecurity Stack Should Cover

The exact tools may vary, but the capabilities should not.

| Capability | Why It Matters Before AI | What "Good Enough to Start" Looks Like |
| --- | --- | --- |
| Identity platform with MFA and SSO | Prevents weak account sprawl and inconsistent access | MFA enforced for staff, SSO used for core systems, admin roles documented |
| Endpoint security (EDR/MDR) | AI projects do not help if endpoints are easy to compromise | Coverage on workstations and servers, alerts reviewed, exceptions tracked |
| Patch and vulnerability management | Agents amplify exposure if the environment is already fragile | Defined patch windows, critical vuln process, documented ownership |
| Email and collaboration security | Phishing and oversharing remain the fastest path to compromise | Modern email protections, awareness training, collaboration sharing reviewed |
| Backup and disaster recovery | AI automation adds operational dependency and blast radius | Backups tested, recovery times understood, offline or isolated recovery path |
| Logging and monitoring | Needed to govern AI actions and investigate incidents | Centralized logs for key systems, alert triage ownership, retention defined |
| Secrets management | AI systems must not rely on hardcoded credentials | Vault-based secret storage, runtime injection, rotation process |
| Asset inventory | You cannot secure what you cannot enumerate | Named owners for critical systems, current inventory for endpoints and SaaS |
| Network, DNS, and egress controls | Helps enforce data boundaries and reduce exfiltration risk | Filtering, segmentation where needed, high-risk traffic visibility |
| Governance and incident response | AI requires policy and human accountability | Written policies, response plan, escalation path, tabletop or rehearsal completed |

## How to Evaluate the Stack Before Launching AI

Clients should expect a **diagnostic baseline**, not a generic tool pitch. A proper Phase 0 assessment usually includes the following:

### 1. Scope the Business Risk First

Start with mission-critical workflows, not products:

- What business process is the AI project meant to improve?
- Which systems and data sources will it touch?
- Which user groups will rely on it?
- What would be the business impact if it malfunctioned, leaked data, or was abused?

This keeps the assessment tied to real outcomes instead of abstract security theater.

### 2. Review Existing Documentation

Ask for the current state of:

- security policies
- incident response documentation
- backup and restore procedures
- identity and access model
- asset inventory
- vendor list and major SaaS tools
- compliance requirements
- prior audit findings or recent incidents

If these artifacts are incomplete, that is itself a Phase 0 finding.

### 3. Interview the Right Stakeholders

A proper baseline should include short conversations with:

- leadership sponsor for the AI initiative
- IT operations
- security owner or external security provider
- business owner of the target workflow
- compliance, legal, or privacy lead when regulated data is involved

The point is to uncover mismatches between what policy says, what IT believes, and what the business is actually doing.

### 4. Perform Non-Invasive Technical Validation

Depending on scope, this can include:

- external vulnerability review
- identity and MFA posture review
- dark web credential exposure checks
- backup and restore evidence review
- endpoint and server control coverage review
- SaaS configuration checks for critical platforms
- logging and alerting maturity review

This stage should not require disruptive production changes just to establish the baseline.

### 5. Produce a Written Report of Findings

Clients should expect a clear output, not a vague verbal summary. At minimum:

- an executive summary in plain language
- major risks grouped by severity
- evidence or observations behind each finding
- business impact, not just technical jargon
- immediate actions for the next 30 days
- a medium-term roadmap for the next 60 to 90 days
- clear note of which items block advanced AI adoption versus which can be improved in parallel

### 6. Agree on Readiness Gates

Phase 0 is complete when the organization can answer:

- What data can and cannot be used with AI?
- Who approves new AI tools and integrations?
- Which credentials and machine identities will be used?
- How will AI activity be logged and monitored?
- What happens if the workflow fails or causes a security event?
- Which urgent gaps must be closed before go-live?

## How to Work With an MSP or MSSP on Phase 0

If you already have an MSP or MSSP, use them. But ask them to behave like a diagnostic partner, not a product reseller.

The reusable templates that support this conversation live in the [Phase 0 Assessment Kit](phase-zero-assessment/README.md).
That kit now separates:

- the **Security Assessment**: "Can we do this safely?"
- the **AI Readiness Assessment**: "Can we do this in a way that creates measurable business value?"
### What to Ask For

- A Phase 0 baseline or cyber risk assessment tied to the AI initiative you are considering
- A clear explanation of how they evaluate identity, backup resilience, endpoint coverage, logging, vendor risk, and data boundaries
- A written report of findings with prioritized actions
- A list of assumptions, exclusions, and evidence sources
- A clear distinction between "safe to proceed now," "safe with guardrails," and "do not proceed yet"

### Questions Clients Should Ask Their Provider

- How do you determine whether our current environment is ready for an AI workflow that touches sensitive systems?
- How do you evaluate identity risk, service accounts, API keys, and machine access before automation goes live?
- How do you verify that backups are actually recoverable?
- How do you assess SaaS and third-party exposure introduced by AI tools?
- What logs do you require to monitor AI-related activity safely?
- Which findings would cause you to recommend delaying the AI project?
- Who owns remediation planning, and how will progress be measured?

### Red Flags

- They recommend tools before understanding your workflow and data risk.
- They cannot explain how they will baseline identity, backups, logging, and secrets.
- They treat AI as "just another app" instead of an operational multiplier.
- They do not provide a written report or roadmap.
- They avoid discussing service accounts, privileged access, or third-party risk.
- They cannot explain what evidence supports their conclusions.

## A Practical, Non-Salesy Way to Reach Out

The best outreach is direct and diagnostic. You are not asking for a proposal first. You are asking for a baseline.

### Sample Outreach Note

```text
We are planning an advanced AI initiative and want to complete a Phase 0 security baseline first.

Before we move forward, we want an external review of our current posture across identity, endpoint coverage, backups, logging, SaaS risk, data classification, and secrets management.

We are not looking for a generic tool pitch. We are looking for a short diagnostic assessment, a written report of findings, and a practical roadmap that tells us what must be fixed before we proceed with AI.

Can you let us know whether you offer that kind of baseline, what the scope includes, and what evidence or outputs we should expect at the end?
```

This keeps the conversation grounded in risk reduction, not procurement theater.

## If You Do Not Have an MSP or MSSP

Some organizations know they need a baseline but do not yet have a trusted provider. In that case, NewPush can help in a way that stays aligned with the Phase 0 philosophy.

### A Sensible Free-Assessment Option

If an organization does not already have an MSP or MSSP capable of performing a proper baseline, **NewPush can offer a no-cost Phase 0 assessment** designed to answer one question:

**"Are we grounded enough, from a cybersecurity perspective, to begin an advanced AI project safely?"**

To keep this non-salesy and useful, the offer should be framed like this:

- it is educational and diagnostic, not a disguised procurement trap
- it focuses on current risk and readiness, not on forcing a platform decision
- the client keeps the written findings and can use them with their internal team, another MSP/MSSP, or NewPush
- the goal is clarity on readiness gates, not pressure to buy downstream services

### What the Free Assessment Should Include

- a short stakeholder discovery session
- review of key policies and operational artifacts
- non-invasive baseline checks where appropriate
- a simple risk summary
- a prioritized 30/60/90-day action plan
- a recommendation on whether the AI initiative can proceed now, should proceed with guardrails, or should pause pending remediation

### What It Should Not Pretend To Be

- not a full penetration test
- not a formal compliance certification
- not a guarantee that no future incident will occur
- not a replacement for ongoing MSP/MSSP operations if the client needs continuous monitoring and response

## Definition of "Ready Enough" for Phase 0

An organization is usually ready to begin a serious AI project when:

- leadership agrees on the business use case and risk appetite
- data categories and refusal boundaries are defined
- identity, MFA, and privileged access are under control
- endpoint and backup fundamentals are in place
- secrets are handled through a vault or equivalent managed process
- logging and response ownership are defined
- third-party AI tools are reviewed before adoption
- there is a written list of known gaps and an agreed remediation plan

That is the right standard. Not perfection. Not panic. Just disciplined grounding before acceleration.

## How This Connects to Project NoéMI

In NoéMI, Phase 0 is the security perimeter that must exist before the organization builds a Virtual Workforce. The more autonomous the AI system becomes, the more important the baseline becomes.

For the broader program context, see:

- [PROJECT_REFERENCE.md](PROJECT_REFERENCE.md)
- [GOVERNANCE.md](GOVERNANCE.md)
- [tool-usages/secure-secret-management.md](tool-usages/secure-secret-management.md)
- [phase-zero-assessment/README.md](phase-zero-assessment/README.md)
