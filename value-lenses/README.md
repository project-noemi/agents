# Value Lenses

Value Lenses are the Project NoeMI layer for explicit success criteria and tradeoff logic.

They answer a different question:

- what does "good" mean here?

## Logic Separation

Value Lenses are intentionally separate from:

- **Agent Personas**, which define the role, mission, and workflow
- **Operating Profiles**, which define local execution style, language, and custom

Value Lenses do **not** define who is acting or how a locale prefers to work.

They define:

- what outcomes count as success
- what tradeoffs are acceptable
- what time horizon matters
- what hidden costs must be surfaced

## Design Goal

Make the active value system explicit instead of leaving it hidden inside prompts, habits, or enterprise politics.

This layer is where Project NoeMI integrates traditional business efficiency with the Demographic Mathésis view of long-term human sustainability.

For public-facing docs, workshops, and onboarding, Project NoeMI uses the more intuitive lens names below because they are easier to explain quickly to a broad audience.

## Directory Pattern

Recommended layout:

```text
value-lenses/
├── LENS_TEMPLATE.md
├── performance-efficiency.md
├── care-continuity.md
└── balanced-enterprise.md
```

## Authoring Rules

- use neutral operational language
- preserve the scholarly distinction between efficiency and care logics without using culturally inflammatory labels
- define success dimensions clearly
- define stakeholders and time horizon explicitly
- document acceptable tradeoffs
- document failure modes
- do not use identity stereotypes as scoring logic

## Core Measures

Every value lens should make its stance on these measures explicit:

- **Care Capital:** the health of relational networks, trust, reciprocity, and maintainable human cooperation
- **Demographic Footprint:** the effect on life-balance, renewal capacity, and the long-term reproductivity of the social or organizational system
- **Time Horizon:** whether the lens prioritizes immediate output, medium-term stability, or intergenerational sustainability over a 10+ year horizon

## Safe Governance Rule

If the active lens materially changes a recommendation, it should be visible in the audit trail or decision summary.

## Comparison Mode

Agents should support **Comparison Mode** when a decision is materially affected by competing success logics.

That means the same proposal can be scored under different lenses to show tradeoffs, for example:

- a gain in speed that creates a deficit in Care Capital
- a cost reduction that worsens Demographic Footprint over a 10+ year horizon
- a slower rollout that improves trust and long-term system habitability

Comparison Mode should highlight:

1. where the lenses agree
2. where the lenses conflict
3. what is being gained
4. what is being depleted

## First Rollout

The repository starts with three baseline lenses:

1. `performance-efficiency`
2. `care-continuity`
3. `balanced-enterprise`

## Template

Use [`LENS_TEMPLATE.md`](LENS_TEMPLATE.md) as the canonical shape.
