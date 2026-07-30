# Phase 0 Recommendation Library

This is the remediation engine for the assessment kit. It maps the **common failure modes** in each assessment area to **standard remediation items**, so the [roadmap-template.md](roadmap-template.md) can be assembled from findings instead of written from scratch each time.

## How To Use It

1. Take each finding from the report ([report-template.md](report-template.md), sections 6 and 7).
2. Find the matching area below and the failure mode closest to the finding.
3. Pull the standard remediation into the roadmap, then edit it for the client — assign an owner, a date, and adjust scope.
4. Use the suggested window as a starting point; the client's archetype (see [roadmap-template.md](roadmap-template.md)) may pull it earlier or later.

The remediation text is a starting point, not final copy. Every item still needs a named owner and a target date to be real. If a finding has no matching row here, write the item by hand and consider adding it back to this library.

## Security Track

### Identity and MFA

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| MFA not enforced for all users | Enforce MFA org-wide; prioritize admins and anyone touching the target workflow | 0-30 |
| Shared or generic logins in use | Replace shared accounts with named identities; disable the shared credential | 0-30 |
| No clear inventory of who can access what | Produce an access inventory for the systems the workflow touches | 0-30 |

### Privileged Access and Service Accounts

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Over-broad admin rights | Reduce standing admin access to least privilege; document who retains it and why | 0-30 |
| Service accounts with excessive scope | Scope connector and service-account permissions down to the workflow's actual need | 31-60 |
| No review of privileged access | Establish a recurring access review with a named owner | 31-60 |

### Data Classification and Refusal Boundaries

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| No definition of what data must never touch AI | Define data classes and an explicit refusal boundary for the workflow | 0-30 |
| Sensitive data mixed into in-scope sources | Separate or mask sensitive fields before the pilot uses the source | 31-60 |

### Endpoint and Server Hygiene

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Unpatched or unmanaged endpoints in scope | Bring in-scope devices under patch and management baseline | 31-60 |
| No SaaS hardening on tools in the workflow | Apply baseline hardening to the SaaS apps the workflow depends on | 31-60 |

### Backup and Recovery

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Backups exist but recovery is untested | Run a restore test for the critical systems in scope | 0-30 |
| Key data source has no backup | Add the source to the backup regime before it feeds the pilot | 0-30 |

### Logging and Monitoring

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Logs not centralized for in-scope systems | Centralize logs for the systems in the AI workflow | 31-60 |
| No alert ownership | Assign alert ownership and an escalation path | 31-60 |
| No audit trail for AI actions | Define what the workflow must log for later review | 61-90 |

### Secrets Management

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Secrets in plaintext files or ad hoc sharing | Move secrets to a vault-backed runtime path; remove plaintext copies | 0-30 |
| API keys embedded in scripts or configs | Replace embedded keys with runtime injection | 0-30 |

### Third-Party and Vendor Risk

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| AI/SaaS vendor exposure not reviewed | Review data handling and terms for the AI and SaaS vendors in scope | 31-60 |
| Unmanaged connectors between tools | Inventory and scope down third-party connectors touching the workflow | 31-60 |

### Incident Response and Governance

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| No incident owner for AI-related issues | Name an incident owner and a basic response path | 31-60 |
| No rollback or correction procedure | Document rollback and correction steps for the pilot | 61-90 |

## AI Readiness Track

### Use-Case Clarity and Ownership

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| No named process owner | Confirm a single accountable owner for the workflow | 0-30 |
| Use case is vague or "AI everywhere" | Narrow to one specific, painful, high-volume workflow | 0-30 |

### Process Stability and Repeatability

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Workflow changes constantly | Document the current steps and stabilize them before piloting | 0-30 |
| Undocumented handoffs | Map inputs, outputs, and handoffs for the target workflow | 0-30 |

### Data and Knowledge Readiness

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Reference material scattered or missing | Consolidate the source documents and knowledge the workflow needs | 31-60 |
| No way to recognize exceptions | Define what an exception looks like and how it escalates | 31-60 |

### Human Approval and Escalation Design

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| No defined approval point | Define which steps require human approval before any output goes out | 0-30 |
| No escalation path for risky cases | Assign review, correction, and exception owners | 31-60 |

### Workforce Uplift and Role Redesign

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Roles unchanged after AI enters the loop | Define the human role after AI takes first-pass work: supervision, QC, exceptions | 31-60 |
| Team expected to keep doing every step manually | Redesign the task so people manage AI output rather than produce every draft | 61-90 |

### Tooling and Integration Practicality

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Integration path unclear | Choose the pilot path intentionally: human-led local, n8n workflow, or governed runtime | 31-60 |
| Pilot scoped too broadly for the tooling | Constrain the pilot to one toolset and one data class | 31-60 |

### Change Readiness and Sponsorship

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Sponsor engaged in name only | Secure real sponsor time to review results and approve corrections | 0-30 |
| Participants have no time to test | Protect participant time for the pilot in advance | 31-60 |

### Metrics and ROI Baseline

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| No baseline metrics captured | Capture current volume, cycle time, and effort before the pilot starts | 0-30 |
| No one owns measurement | Assign a measurement owner and define success metrics up front | 0-30 |

### Individual Adoption Readiness

| Common failure mode | Standard remediation | Window |
|---------------------|----------------------|--------|
| Low AI literacy across the workforce | Run a short, role-specific AI literacy uplift before the pilot | 0-30 |
| Low confidence or fear of exposure | Provide safe practice space and clear expectations that no one is being tested | 31-60 |
| Unspoken resistance or fear of replacement | Surface concerns openly; state the role-uplift intent, not headcount reduction | 0-30 |
| Ungoverned Shadow AI already in use | Redirect existing informal usage into the governed pilot path | 31-60 |
