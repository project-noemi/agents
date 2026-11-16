# Trust Scaling and Evidence Workflows

Trust in an agent should rise only as fast as the evidence for it. This guide describes how to widen what an agent may do on its own, one verified path at a time, without removing the human decisions that governance requires.

The framing "trust first, then parallel" comes from Lauren Tan's (@poteto) talk ["All Code Is Slop (Except Mine)"](https://ai.engineer/code/2026/talks/lauren-tan) (AI Engineer CODE 2026): invest in the agent's environment until you can trust its output, and only then increase volume. This repository's AI review rollout is a worked example of the same idea.

## The Pattern

1. **Define the path.** Name one kind of work narrowly, such as "documentation PRs into `develop`" or "staging verification reports".
2. **Collect evidence.** For each run, keep what was checked, what the reviewer said, and what the human decided.
3. **Measure disagreement.** Count how often the human overrides the agent or reviewer, and in which direction.
4. **Set the threshold in advance.** Write down the override rate, window, and sample size that would justify the next step before you look at the numbers.
5. **Widen one step.** If the evidence meets the threshold, extend autonomy on that path only. Keep the rest unchanged.
6. **Keep the brake.** Any step can be reversed when new evidence (a revert, an incident, a rising override rate) says so.

## How This Repository Does It

The AI reviewer rollout in [`AI_REVIEW_GOVERNANCE.md`](../AI_REVIEW_GOVERNANCE.md) follows this pattern:

- **Phase 1 is advisory.** The reviewer runs premise, framing, code, and compliance gates and posts a verdict. It does not approve, merge, or block. A human decides.
- **Every disagreement is recorded.** When a PR merges over a failing verdict, [`scripts/calibration-watch.js`](../../scripts/calibration-watch.js) opens a calibration entry in [`docs/reviews/CALIBRATION.md`](../reviews/CALIBRATION.md), and a human fills in the direction and reason. Authorized `/override` comments seed draft calibration PRs through [`scripts/override-calibration.js`](../../scripts/override-calibration.js) ([`AI_REVIEW_OVERRIDE.md`](../AI_REVIEW_OVERRIDE.md)).
- **Phase 2 is gated on that log.** Reviewer approvals stay unauthorized until the override rate over a stated window, and its direction, are cited from the log. The governance document says it directly: "It feels reliable" does not advance a phase.
- **Identity separation holds at every phase.** Producer and reviewer use different machine identities, and the producer can never approve its own work ([`MACHINE_IDENTITY.md`](../MACHINE_IDENTITY.md)).

## What Counts as Evidence

| Evidence | Good when | Weak when |
|---|---|---|
| CI and audit results | Tied to the exact head commit | Reported from an earlier run |
| Reviewer verdict | Newer than the head commit it covers | Older than the latest push |
| Human decision | Recorded with direction and reason | Only implied by a merge |
| Runtime check | Fresh read with source and time | "The workflow said it succeeded" |
| Revert or incident | Linked back to the PR that caused it | Fixed silently |

## What Does Not Scale Away

Some decisions stay human regardless of evidence in this framework: approving and merging, production deploys, spending money, sending external messages, and the core `secrets.*` and `refusal.*` rules in [`AGENTS.md`](../../AGENTS.md). Trust scaling widens how much preparation and verification an agent does on its own before reaching those decisions. It does not remove them.

## Alignment With the 4D Framework

- **Delegation:** choosing which path to widen is a delegation decision ([`lifecycle/DELEGATION.md`](../lifecycle/DELEGATION.md)).
- **Discernment:** evaluating the evidence is discernment ([`lifecycle/DISCERNMENT.md`](../lifecycle/DISCERNMENT.md)).
- **Diligence:** keeping the log and the brake is diligence ([`lifecycle/DILIGENCE.md`](../lifecycle/DILIGENCE.md)).
- **Security:** none of this precedes the [Phase 0 baseline](../PHASE_ZERO_SECURITY_BASELINE.md).

## Done Bar

A trust step is justified when the path is named, the threshold was written before the data was reviewed, the evidence cited meets it, and the reversal condition is stated.

Related: [verification skills](verification-skills.md), [software factory](software-factory.md), [codebase as memory](codebase-as-memory.md).
