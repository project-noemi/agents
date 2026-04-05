# Operating Profiles

Operating Profiles are the Project NoeMI layer for culturally grounded execution.

They are **not** simple translation files.

They tell an agent how to adapt its work for a local context such as:

- language
- country
- subregion
- sector
- audience

## Design Goal

Keep the core persona stable while varying the execution style responsibly.

An agent answers:

- what role am I playing?

An operating profile answers:

- how should this work be carried out here?

If you need to define what counts as success, what tradeoffs are acceptable, or whose benefit is being prioritized, use the separate Value Lens layer instead of putting that logic in an operating profile.

## Directory Pattern

Recommended layout:

```text
operating-profiles/
├── PROFILE_TEMPLATE.md
├── fr/
│   └── fr-fr/
│       ├── core.md
│       ├── north.md
│       └── south.md
└── en/
    └── en-us/
        └── core.md
```

## Authoring Rules

- use evidence, not stereotypes
- keep subregional overlays small and explicit
- separate hard requirements from local preference
- require human validation for any locally specific claim
- do not create hidden gender defaults

## Safe Identity Handling

If a profile must adapt for identity-related communications needs, handle that as an explicit, opt-in audience overlay with human review.

Do not infer gender or rewrite work style based on assumed identity.

## Start Small

The first useful rollout is:

1. one base language profile
2. one country profile
3. one subregional overlay
4. one audience overlay

That is enough to prove the system before adding more profile depth.

## Template

Use [`PROFILE_TEMPLATE.md`](PROFILE_TEMPLATE.md) as the canonical shape.

For the companion framework, see [`../docs/frameworks/value-lenses.md`](../docs/frameworks/value-lenses.md).
