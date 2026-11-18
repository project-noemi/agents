# Verification Skills

A verification skill teaches an agent how to prove its own work, so "done" means evidence was observed rather than that a step was started. It is the inner loop that makes parallel agent work safe: you can only hand more tasks to agents once you trust how they check them.

This guide adapts the emphasis on runtime and formal verification from the AI Engineer CODE 2026 talk "All Code Is Slop (Except Mine)" and maps it onto the skill format this repository already uses.

## What Makes a Verification Skill Good

1. **One command or procedure, reproducible.** Another agent or a person runs the same steps and gets the same verdict.
2. **CLI-first.** It runs headless, in CI or a box, without a person clicking through a UI.
3. **Evidence, not assertion.** The output is logs, check conclusions, status codes, or screenshots, each with the source and time it was read.
4. **A written done bar.** The skill states in advance what must be observed. The agent does not redefine done after the fact.
5. **A stop path.** When the done bar is not met, the skill says whether to retry, continue, or escalate, and never says "report success anyway".

## Examples Already in This Repository

| Skill or check | What it verifies |
|---|---|
| [`skills/verification/pre-flight-check.md`](../../skills/verification/pre-flight-check.md) | Preconditions before a state-changing action; returns `READY`, `CONFIRM`, or `ABORT` with a rollback plan |
| [`skills/verification/cross-reference.md`](../../skills/verification/cross-reference.md) | That a claimed action (PR merged, label added, file created) actually happened, checked against the source of truth |
| [`scripts/skill-utility-eval.js`](../../scripts/skill-utility-eval.js) | That a recorded run followed a skill's Ask First and Never gates, not just that the headings exist |
| `npm run validate` | Repository audit plus the fast test suite; the gate every PR here runs |
| [`docker-runtime-verification.md`](docker-runtime-verification.md) | That the Docker example homes actually boot on a Docker-capable host |

## Writing One

Start from [`skills/SKILL_TEMPLATE.md`](../../skills/SKILL_TEMPLATE.md) so the skill carries the sections the audit requires, including `### Refusal Criteria`. Then fill in:

1. **Purpose.** Name the claim being verified, for example "a staging deploy serves the intended release".
2. **Inputs.** What the caller supplies: target URL, PR number, expected identifier.
3. **Procedure.** Read-only steps in order. Each step names the command or API and the value it expects.
4. **Outputs.** A verdict (`pass`, `fail`, `escalate`) and the evidence list: source, time read, observed value.
5. **Boundaries.** Verification reads; it does not fix. If the skill finds a problem, it reports it and stops, so a separate change can be reviewed.

### Worked example: staging deploy check

- **Done bar:** the health endpoint returns 200, it reports the expected release identifier, and each named page returns 200.
- **Procedure:** read the health endpoint, compare the identifier with the expected one, request each named page, record status codes and the time of each read.
- **Not done when:** a deploy job was only queued, the identifier is the previous release, or any page fails. The skill reports which item failed and stops.

### Testing the skill itself

Record two or three sample runs as action lists, one that passes and one that should fail, and score them the way `skill-utility-eval.js` scores its canonical skills. A verification skill that never fails on a bad sample is not verifying anything.

## Publishing

Reusable skills live in [`skills/`](../../skills/) as the source of truth, and published Agent Skills copies are generated into [`skills-dist/`](../../skills-dist/); see [`docs/skills/README.md`](../skills/README.md). Organization-specific checks (internal URLs, release naming) stay in the organization's own copy of this library.

## Done Bar for This Guide

You have a usable verification skill when it follows the template, passes `npm run audit`, fails on at least one recorded bad sample, and its report lists evidence with sources and read times.

Related: [codebase as memory](codebase-as-memory.md), [trust scaling](trust-scaling.md), [software factory](software-factory.md).
