# Value Lenses

Value Lenses are the Project NoeMI layer for explicit success criteria and tradeoff logic.

They are not:

- personas
- operating profiles
- translations

They answer a different question:

- what does good look like here?

## Design Goal

Make the active value system explicit instead of leaving it hidden inside prompts, habits, or enterprise politics.

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
- define success dimensions clearly
- define stakeholders and time horizon explicitly
- document acceptable tradeoffs
- document failure modes
- do not use identity stereotypes as scoring logic

## Safe Governance Rule

If the active lens materially changes a recommendation, it should be visible in the audit trail or decision summary.

## First Rollout

The repository starts with three baseline lenses:

1. `performance-efficiency`
2. `care-continuity`
3. `balanced-enterprise`

## Template

Use [`LENS_TEMPLATE.md`](LENS_TEMPLATE.md) as the canonical shape.
