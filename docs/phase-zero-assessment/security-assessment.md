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

## Technical Validation Procedure

For the concrete scan deployment procedure that maps automated tooling to these assessment areas, see [network-security-assessment.md](network-security-assessment.md). That document provides per-scan prerequisites, expected outputs, a client deployment guide, and guidance on adapting the workflow to any assessment platform.

## What Good Output Looks Like

The client should receive:

- a clear written summary of the biggest risks
- a distinction between blockers and non-blockers
- evidence and business impact for each major finding
- compensating controls where immediate remediation is not practical
- a security readiness classification:
  `ready now`, `ready with guardrails`, or `not ready yet`

## Why This Assessment Matters

This assessment protects the value of the AI initiative itself. The business value is:

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
