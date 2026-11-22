# Agent Gardeners: Keeping Anti-Patterns Out

Agents amplify whatever patterns a codebase already has. A workaround left in one file becomes the template for the next ten. A gardener is a role, held by a person, an agent, or both, that keeps the paved path clear: it finds repeated mistakes, turns them into durable controls, and removes the patterns agents should not copy.

The garden analogy comes from the AI Engineer CODE 2026 talk "All Code Is Slop (Except Mine)": as code arrives continuously from many agents, the constraints in the codebase are the foundation new code grows around, and weeds left in place spread. This guide turns that into a governed routine.

## What a Gardener Does

1. **Watches for repeats.** Reads recent review findings, calibration entries, failed runs, and reverts, and groups ones that share a cause.
2. **Proposes one control per pattern.** Uses the [correction hierarchy](../examples/codebase-as-memory.md): structure first, then audit or test, then verification, then a rule or skill step.
3. **Removes the bad example.** When a control lands, the old instances are fixed or deleted in the same or a follow-up PR, so agents stop finding them.
4. **Reports, does not silently clean.** Every change goes through a normal PR with review. A gardener never pushes cleanups straight to a protected branch.

## Gardeners in This Repository Today

| Gardener | What it tends |
|---|---|
| [`scripts/audit-repo.js`](../../scripts/audit-repo.js) | Fails on drift: missing persona sections, stale generated files, a weakened merge gate, relaxed core rules in layer files |
| [`scripts/calibration-watch.js`](../../scripts/calibration-watch.js) | Opens a calibration entry whenever a PR merges over a failing review, so disagreements are recorded instead of forgotten |
| [`scripts/override-calibration.js`](../../scripts/override-calibration.js) | Collects `/override` evidence into one draft calibration PR per rule, so repeated overrides of the same rule are visible together |
| Admin Override Watch ([`AI_REVIEW_GOVERNANCE.md`](../AI_REVIEW_GOVERNANCE.md)) | Detects each admin override on `develop` and asks for attestation |
| [QA & Risk Manager](../../agents/operations/qa-risk-manager.md) persona | Reviews workflows and agent designs for deviations from the framework |

None of these approve or merge. Each one turns a pattern into evidence or a failing check, and a human decides what changes.

## Running a Gardener Sweep

- **Cadence:** weekly, or after a cluster of similar review findings.
- **Inputs:** review comments and calibration entries since the last sweep, failed CI runs, reverts.
- **Steps:**
  1. Group findings by cause, not by file.
  2. For each group with two or more instances, write the rule in one sentence and pick the highest level of the correction hierarchy that can hold it.
  3. Draft the control and the cleanup of existing instances as one PR, opened by the gardener's machine identity.
  4. Record policy-level rules in [`DECISION_LOG.md`](../DECISION_LOG.md).
- **Stop rules:** no workflow or governance-file edits without the owner's explicit request; no force-push; no cleanup outside a reviewed PR; changes to the review runner or reviewer persona stop for human review, per the carve-out in [`AI_REVIEW_GOVERNANCE.md`](../AI_REVIEW_GOVERNANCE.md).
- **Output:** a short report listing each pattern, its instances, the proposed control, and the PR link, or "no repeats found".

## Done Bar

A sweep is complete when every repeated pattern found has either an open PR with a control and cleanup, or a written reason it was left as is. A control is complete when its check fails on the old pattern, passes after cleanup, and no remaining instance in the codebase would teach the old pattern to the next agent.

## Fit With the Framework

Gardening is [Diligence](../lifecycle/DILIGENCE.md) applied over time, complements the [Guardian agents](../agents/guardian/README.md) that monitor agents at run time, and operates inside the [Phase 0 security baseline](../PHASE_ZERO_SECURITY_BASELINE.md) and [`GOVERNANCE.md`](../GOVERNANCE.md).

Related: [codebase as memory](../examples/codebase-as-memory.md), [agent-friendly architecture](../examples/agent-friendly-architecture.md), [software factory](../examples/software-factory.md).
