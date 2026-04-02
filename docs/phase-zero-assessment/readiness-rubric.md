# Phase 0 Readiness Rubric

Use this rubric to classify whether an organization is ready to begin an advanced AI initiative.

## Ready Now

Use when all of the following are true:

- the business use case is defined and owned
- MFA and privileged access are under control
- backup and recovery are verified for the systems in scope
- secrets will be handled through a vault-backed runtime path
- logging and incident ownership are defined
- data classes and refusal boundaries are documented
- no critical blockers remain for the target workflow

## Ready With Guardrails

Use when the organization can move forward with a constrained pilot, but only if specific controls are added or enforced first:

- medium-risk gaps exist but are understood and owned
- the pilot can be limited to safe data or non-mutating actions
- human approval points are added for sensitive operations
- remediation items are already scheduled in the 30/60/90-day roadmap

## Not Ready Yet

Use when the current environment would make the AI initiative materially unsafe or misleading to launch:

- MFA, privileged access, or service-account governance is weak
- backup recoverability is unknown or untested
- secrets are still managed through plaintext files or ad hoc sharing
- data boundaries are undefined
- logging is insufficient to investigate misuse or failure
- critical vendor or compliance issues remain unresolved

## Output Line

Every assessment should end with a one-line classification:

`Phase 0 readiness: ready now | ready with guardrails | not ready yet`
