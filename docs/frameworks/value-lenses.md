# Value Lenses

Project NoeMI needs a way to evaluate work through more than one success logic without embedding that logic invisibly into every agent.

This document defines that layer as **Value Lenses**.

Project NoeMI uses this layer to integrate business efficiency with the Demographic Mathésis view of long-term human sustainability.

## Why This Is Needed

Two teams can look at the same output and disagree honestly because they are optimizing for different things.

One team may reward:

- speed
- throughput
- efficiency
- measurable output
- short-cycle gains

Another team may reward:

- continuity
- sustainability
- care
- relational stability
- long-term habitability

Both may be rational within their own frame.

The system needs a clean way to say:

- what counts as success here?
- whose benefit is being counted?
- what time horizon matters?
- what tradeoffs are acceptable?
- what happens to Care Capital and Demographic Footprint if this decision scales?

## Core Principle

An agent persona defines **what role is acting**.

An operating profile defines **how the work should be carried out in a local context**.

A value lens defines **how success and tradeoffs should be judged**.

Keep those layers separate.

Value Lenses are intentionally separate from:

- Agent Personas, which define the role and workflow
- Operating Profiles, which define local style and execution customs

## Why Not Use Gendered Operational Labels

Some of the background scholarship that inspires this distinction contrasts different civilizational or ethical logics, including highly gendered language.

For enterprise implementation, Project NoeMI should use **neutral operational names**.

Reason:

- it avoids turning a governance tool into a cultural fight
- it avoids stereotyping or essentializing people
- it keeps the implementation reviewable by business, legal, and HR stakeholders

That means the implementation can preserve the conceptual distinction without saying:

- men evaluate like this
- women evaluate like that

## Recommended Starter Lenses

### 1. Competitiveness-Output Lens

Optimizes for:

- speed
- cost discipline
- throughput
- predictability
- clear measurable output

Blind spot:

- high risk of demographic debt and erosion of trust networks

### 2. Care-Demographic-Vitality Lens

Optimizes for:

- relational health
- care capital
- demographic vitality
- human viability
- 10+ year sustainability

Core question:

- does this action support or deplete the human ecosystem over a 10-year horizon?

### 3. Mathesis-Integrative Lens

Optimizes for:

- practical business viability
- care capital
- demographic stability
- competitiveness without degrading the human system that must sustain the result

Default rule:

- this is the default lens when no higher-stakes override is selected

## What Belongs In A Value Lens

- success criteria
- care capital stance
- demographic footprint stance
- stakeholders counted
- time horizon
- acceptable tradeoffs
- evidence required
- common blind spots
- failure modes
- questions the lens asks first

## What Does Not Belong In A Value Lens

- stereotypes about identity groups
- hidden moral assumptions with no explicit review
- local language or register rules that belong in operating profiles
- role-specific process steps that belong in agent personas

## Recommended Repo Structure

```text
value-lenses/
├── README.md
├── LENS_TEMPLATE.md
├── competitiveness-output.md
├── care-demographic-vitality.md
└── mathesis-integrative.md
```

## Activation Model

The agent should receive:

1. the base persona
2. the relevant tools and protocols
3. the selected operating profile, if any
4. the selected value lens

The value lens should refine the definition of success, not replace the role.

## Selection Rules

- the lens should be explicit
- the lens should be human-selected for high-stakes work
- the lens should never be silently inferred from gender or identity
- if no lens is chosen, default to a documented enterprise baseline
- the default baseline for this repository is `mathesis-integrative`

## Comparison Mode

The safest first implementation pattern is **comparison mode**.

That means the agent can:

1. propose one or more options
2. score them under multiple lenses
3. explain where the lenses agree
4. explain where the lenses conflict
5. show when speed gains create a Care Capital deficit or a negative Demographic Footprint

This is safer than silently optimizing for one value system.

## Governance Rules

- every lens needs an owner
- every lens needs explicit success dimensions
- every lens needs failure modes
- high-stakes use should show the active lens in the audit trail
- a lens must never be hidden when it materially changes recommendations

## First Safe Rollout

Start with:

1. one template
2. three starter lenses
3. one example comparison workflow

Do not start with dozens of lenses.

## Relationship To Operating Profiles

Operating profiles answer:

- how do we work here?

Value lenses answer:

- what does good mean here?
- what is the Care Capital effect?
- what is the Demographic Footprint?

Both can be active at the same time, but they solve different problems.

## Related Files

- [`../../value-lenses/README.md`](../../value-lenses/README.md)
- [`../../value-lenses/LENS_TEMPLATE.md`](../../value-lenses/LENS_TEMPLATE.md)
- [`localized-operating-profiles.md`](localized-operating-profiles.md)
