# Phase 0 Security Assessment

This assessment answers one executive question:

**"Can we begin this AI initiative safely?"**

It is the cybersecurity half of the Project NoeMI initial assessment. Its purpose is to identify the risks that would make an AI pilot unsafe, fragile, or non-governable before the organization connects AI to real systems, real data, or real customer interactions.

## What This Assessment Is For

Use this assessment when a business or enterprise wants to:

- introduce copilots, agents, or workflow automation
- connect AI to email, document systems, CRM, ERP, or line-of-business tools
- move from informal experimentation to governed production use

The security assessment does **not** tell the client whether the use case is commercially worthwhile. It tells them whether the environment is safe enough to begin.

## The Questions It Answers

- Are identity, access, and privilege boundaries strong enough for AI-connected workflows?
- Are data classes, refusal boundaries, and sharing rules clear enough to prevent accidental leakage?
- Are secrets, service accounts, and machine identities governed well enough for automation?
- Can the organization detect, investigate, and contain misuse, failure, or breach?
- Are there critical blockers that should stop the AI initiative until remediation is complete?

## Core Assessment Areas

### 1. Identity, MFA, and Privileged Access

- centralized identity
- MFA coverage
- admin separation
- service-account ownership
- least-privilege scoping for connected systems

### 2. Data Boundaries and Refusal Rules

- data classification
- systems holding regulated or confidential data
- approved vs prohibited AI usage
- human-only tasks and human-only data classes

### 3. Endpoint, Server, and SaaS Hygiene

- managed devices
- patch cadence
- EDR or MDR coverage
- critical SaaS security settings
- AI feature settings in critical SaaS tenants
- current asset inventory

### 4. Backup, Recovery, and Incident Response

- backup coverage
- restore evidence
- recovery ownership
- incident escalation paths
- breach and workflow-failure handling

### 5. Logging, Monitoring, and Forensics

- centralized log coverage
- alert ownership
- retention
- traceability for AI-related service accounts or automation actions

### 6. Secrets, APIs, and Machine Identity

- vault-backed secret handling
- rotation process
- removal of plaintext `.env` habits
- machine identities or equivalent non-human auth paths for headless automation

### 7. Third-Party and Vendor Exposure

- AI vendor review
- connector exposure
- SaaS risk
- data-processing and contract concerns
- AI features and AI subprocessors added by existing vendors

## Technical Validation Procedure

For the concrete scan deployment procedure that maps automated tooling to these assessment areas, see [network-security-assessment.md](network-security-assessment.md). That document provides per-scan prerequisites, expected outputs, a client deployment guide, and guidance on adapting the workflow to any assessment platform.

### AI Already in Use: Audit Checks

These checks gather the evidence for Area 10 of the [AI Readiness Assessment](ai-readiness-assessment.md). They are read-only, stay within the [consent template](consent-template.md) scope, and make no changes to client systems. Findings record that a credential or grant exists and where, never its value.

| Check | Evidence source | Existing scan category it extends | Feeds |
|---|---|---|---|
| C1. AI apps and personal accounts in use | Web proxy, DNS or secure web gateway logs for AI services; expense and card data for AI subscriptions; SSO app catalogue | Interview and document review (new); LAN discovery for egress where available | A10.1, self-assessment 16 |
| C2. Connector and app grants | Identity provider app consent and OAuth grants (for example, Entra ID enterprise applications; Google Workspace third-party app access), listed by scope | Cloud Identity and Configuration (extend outputs to consented apps and their scopes) | A10.3, A10.4, self-assessment 17 |
| C3. AI features in core SaaS tenants | Admin settings for AI features in the in-scope tenants (office suite, CRM, helpdesk); vendor subprocessor notices | Interview and configuration review (new) | A10.2 |
| C4. Coding assistants, local models and tool connections on endpoints | Installed AI applications and running processes; local model services listening on the network; tool-connection (MCP) configuration files on developer machines | Endpoint Assessment (extend software inventory to AI tools) | A10.1, A10.3 |
| C5. AI credentials in code and configuration | Secrets scan of in-scope repositories and configuration for model provider API keys | Database Security / Secrets (extend patterns to AI provider keys) | A10.3, security S6.1 |
| C6. Non-human activity on human accounts | Sign-in and API logs for machine-speed activity, off-hours bursts, or cloud-hosting source networks on employee tokens | Cloud Identity and Configuration (risky sign-ins); logging review | A10.3, A10.6, security S5 |
| C7. Policy, request path and review cadence | AI use policy, request records, agent register and review dates | Interview and document review | A10.5, A10.6 |

C2 (app grants) and C4 (endpoint AI inventory) may need read permissions beyond the standard scans, for example read access to the identity provider's consented-app list; list them in the signed consent before the audit runs. The audit sees managed devices, managed networks and the tenants in scope. It does not see personal devices, AI used off the corporate network, or local models that make no network calls.

## What Good Output Looks Like

The client should receive:

- a clear written summary of the biggest risks
- a distinction between blockers and non-blockers
- evidence and business impact for each major finding
- compensating controls where immediate remediation is not practical
- a security readiness classification:
  `ready now`, `ready with guardrails`, or `not ready yet`

## Why This Assessment Matters

For any business owner considering an AI initiative, this assessment protects the value of the initiative itself. The business value is:

- fewer surprises after launch
- lower chance of data leakage or uncontrolled Shadow AI behavior
- less rework caused by rushed, unsafe implementations
- clearer approval and accountability before the workflow touches sensitive systems
- higher confidence that a future pilot can scale instead of being shut down by risk

In short:

> This assessment reduces the chance that an AI project creates new operational risk faster than it creates value.

## What It Does Not Claim

- it is not a penetration test unless separately scoped
- it is not a compliance certification
- it does not guarantee no future incident
- it does not replace ongoing MSP or MSSP operations where continuous monitoring is needed

## Executive Summary

> The security assessment tells us whether the organization is grounded enough to start AI safely, what must be fixed first, and what controls must remain in place as the initiative grows.
