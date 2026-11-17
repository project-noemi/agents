# Codebase as Memory: The Correction Hierarchy

An agent's largest input is the repository it works in. It copies what it finds there, including workarounds and deprecated patterns. So when you correct an agent, the most durable place to record the correction is the codebase itself, not another sentence in a prompt.

This guide adapts that idea from the AI Engineer CODE 2026 talk "All Code Is Slop (Except Mine)" and shows where this repository already applies it. Use it when the same review finding, chat correction, or incident has happened more than once.

## The Correction Hierarchy

When a mistake repeats, fix it at the highest level that can hold it. Higher levels are deterministic and run on every change; lower levels need judgment and can be skipped.

| Level | Control | Holds the rule by | Example in this repository |
|---|---|---|---|
| 1 | Structure, types, data shape | Making the wrong thing impossible to write | Generated `CLAUDE.md` / `GEMINI.md` are pointers to `AGENTS.md`, so there is one source of instructions to drift ([`scripts/generate_all.js`](../../scripts/generate_all.js)) |
| 2 | Static checks: lint, audit, tests, CI | Failing the build when the rule is broken | [`scripts/audit-repo.js`](../../scripts/audit-repo.js) `checkMergeGateInvariant()` fails if the develop-only merge gate gains a wildcard exception |
| 3 | Verification: runtime and formal checks | Proving behaviour, not just shape | [`scripts/check-headless-hooks.js`](../../scripts/check-headless-hooks.js) refuses a headless dispatch unless hooks that wait for a person are disabled |
| 4 | Prose: rules, skills, `AGENTS.md` | Telling the agent what to do | `<!-- rule: secrets.no-ask-user -->` in [`AGENTS.md`](../../AGENTS.md), and skills under [`skills/`](../../skills/) |
| 5 | Human review | A person catching it | The human merge decision after the [AI reviewer](../AI_REVIEW_GOVERNANCE.md) |

Prose still matters. Some rules need judgment and cannot be checked by a script, and the audit enforces that the prose exists (for example, that every persona carries a `### Refusal Criteria` subsection). The point is order: try levels 1–3 first, and use level 4 for what genuinely needs judgment.

## Worked Examples From This Repository

**A stalled run became a gate.** A desktop dictation hook stalled a headless Grok run for ten minutes because it waited for a person. A reminder in a prompt would not have stopped the next run. Instead, `check-headless-hooks.js` (Decision [2026-09-27-0001]) refuses to dispatch unless the run's profile is isolated and managed-hooks-only. That is a level 3 control replacing what would have been a level 4 note.

**A logging habit became automation.** The reviewer calibration log needs an entry whenever a PR merges over a failing verdict. After a week it held zero entries despite clear overrides. [`scripts/calibration-watch.js`](../../scripts/calibration-watch.js) now opens the calibration PR itself, and a human fills in the judgment cells. The script's header states the reason: discipline had failed, so the log writes itself.

**A branch rule became an audit check.** "Only `develop` merges into `main`" was policy text. `audit-repo.js` now reads the gate workflow and fails if the source-branch condition drifts from the canonical check, so the rule survives an edit nobody reviewed carefully.

## Procedure: Turning a Repeated Correction Into a Control

1. **Collect the evidence.** Find at least two instances of the same mistake: review comments, chat corrections, failed runs. Link them.
2. **State the rule in one sentence.** "Contributor PRs never target `main`" is checkable; "be careful with branches" is not.
3. **Pick the highest level that can hold it.** Ask in order: can the structure make it impossible? Can the audit or a test detect it? Can a verification step prove it? Only then write a rule or skill step.
4. **Write the check so its failure message teaches.** The message should name the rule and the decision or document behind it, as the `audit-repo.js` messages do.
5. **Record the decision.** Add an entry to [`docs/DECISION_LOG.md`](../DECISION_LOG.md) when the rule is policy, so the next agent can find why it exists.
6. **Remove the old reminder.** If a prompt line or skill step said the same thing, delete or shorten it so there is one source.

## Done Bar

A correction is recorded when:

- the rule is stated in one sentence with linked evidence of the repeats;
- a check at the highest feasible level fails on the old mistake and passes on the fix (`npm run validate` for this repository);
- any prose that duplicated the rule now points to the check instead.

## What This Guide Does Not Cover

It does not prescribe a lint stack or test framework; those are per codebase. It does not loosen any core rule: `secrets.*` and `refusal.*` rules stay in force under every layer, as described in [`configuration-layers.md`](../configuration-layers.md).

Related: [agent-friendly architecture](agent-friendly-architecture.md), [verification skills](verification-skills.md), [agent gardeners](../governance/agent-gardeners.md).
