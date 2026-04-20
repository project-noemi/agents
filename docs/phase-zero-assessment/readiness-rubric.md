# Phase 0 Readiness Rubric

Use this rubric to classify whether an organization is ready to begin an advanced AI initiative.

The key rule is simple:

- **security readiness** tells you whether the environment is safe enough
- **AI readiness** tells you whether the business and workflow are ready enough
- the **overall recommendation** should reflect both

## 1. Security Readiness

### Ready Now

Use when all of the following are true:

- MFA and privileged access are under control
- backup and recovery are verified for the systems in scope
- secrets will be handled through a vault-backed runtime path
- logging and incident ownership are defined
- data classes and refusal boundaries are documented
- no critical blockers remain for the target workflow

### Ready With Guardrails

Use when the organization can move forward with a constrained pilot, but only if specific controls are added or enforced first:

- medium-risk gaps exist but are understood and owned
- the pilot can be limited to safe data or non-mutating actions
- human approval points are added for sensitive operations
- remediation items are already scheduled in the 30/60/90-day roadmap

### Not Ready Yet

Use when the current environment would make the AI initiative materially unsafe to launch:

- MFA, privileged access, or service-account governance is weak
- backup recoverability is unknown or untested
- secrets are still managed through plaintext files or ad hoc sharing
- data boundaries are undefined
- logging is insufficient to investigate misuse or failure
- critical vendor or compliance issues remain unresolved

## 2. AI Readiness

### Ready Now

Use when all of the following are true:

- the business use case is defined and owned
- the workflow is stable enough to pilot
- the human approval boundary is clear
- the team knows what success looks like
- baseline metrics exist or can be captured immediately
- leadership sponsor and process owner are engaged

### Ready With Guardrails

Use when the organization can run a constrained pilot, but only if the first rollout stays narrow:

- the use case is promising but the workflow still needs tightening
- approval gates must remain strong
- only one team, one document class, or one low-risk action should be in scope at first
- measurement must be formalized before broader rollout

### Not Ready Yet

Use when the organization is still too ambiguous or unstable to expect meaningful value:

- the use case is vague or has no real owner
- the workflow changes too often to automate reliably
- nobody agrees what good output looks like
- no baseline metrics exist and no one owns measurement
- the organization is treating experimentation as transformation

## 3. Overall Recommendation

### Proceed

Use when:

- security readiness is `ready now` or a very light `ready with guardrails`
- AI readiness is `ready now`
- the first pilot can be launched with clear ownership and measurement

### Proceed With Guardrails

Use when:

- one or both tracks are `ready with guardrails`
- the initial pilot can be safely constrained
- remediation items are named, owned, and time-bound

### Pause For Remediation

Use when:

- security readiness is `not ready yet`
- or AI readiness is `not ready yet`
- or the organization cannot yet name a safe, worthwhile first pilot

## 4. Output Lines

Every assessment should end with four short lines:

`Security readiness: ready now | ready with guardrails | not ready yet`

`AI readiness: ready now | ready with guardrails | not ready yet`

`Overall recommendation: proceed | proceed with guardrails | pause for remediation`

`First pilot recommendation: <named workflow or "not recommended yet">`
