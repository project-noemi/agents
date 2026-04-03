# Localized Operating Profiles

Project NoeMI needs a way to adapt agent work across languages, regions, subregions, and local business customs without collapsing everything into simple translation.

This document defines that layer as **Localized Operating Profiles**.

## Why This Is Needed

A translated answer can still feel wrong locally.

Examples:

- the expected level of directness can differ by region
- meeting cadence and response timing can differ inside the same country
- trust signals, formality, and escalation norms can differ by industry or geography
- the same task can require different documentation depth or handoff style depending on local practice

That means the adaptation layer should not only ask:

- what language should the agent use?

It should also ask:

- how is this work normally performed here?
- what tone earns trust in this region?
- what level of initiative is expected before escalation?
- what local compliance, etiquette, and review norms matter?

## Core Principle

An agent persona defines **what the role does**.

A localized operating profile defines **how that work should be carried out for a specific local context**.

Keep those layers separate.

For explicit success criteria and tradeoff logic, use the separate Value Lens layer described in [value-lenses.md](value-lenses.md).

## Recommended Layering Model

Use inheritance from broad to specific:

1. language family
2. country or national market
3. subregion or city cluster
4. industry or sector overlay
5. audience overlay

Examples:

- `fr` -> shared French-language conventions
- `fr/fr-fr` -> France-wide conventions
- `fr/fr-fr/north` -> northern France subregional overlay
- `fr/fr-fr/south` -> southern France subregional overlay
- `fr/fr-fr/healthcare` -> French healthcare overlay
- `fr/fr-fr/north/executive-buyers` -> audience-specific overlay

## What Belongs In A Profile

- language and register
- formality and politeness norms
- decision-making and escalation expectations
- documentation depth and evidence expectations
- meeting and scheduling norms
- response-time expectations
- trust signals and phrases to prefer
- phrases, framing, or approaches to avoid
- local regulatory or compliance notes when they affect execution

## What Does Not Belong In A Profile

- stereotypes presented as facts
- unsupported assumptions about competence, seniority, or personality
- inferred identity attributes
- raw secrets, customer data, or protected personal information

## Gender And Identity Differences

This is the most sensitive part of the design.

Project NoeMI should **not** create default agent variants based on inferred gender.

If identity-aware adaptation is ever needed, it should be handled as:

- an explicit audience preference
- a clearly documented communications requirement
- a locally validated convention
- an opt-in overlay, not a hidden default

Safe examples:

- a customer explicitly requests inclusive French forms for a community program
- a local campaign requires a women-founder audience lens that has been reviewed by a human operator

Unsafe examples:

- assuming a different work style because the audience is male or female
- changing authority, empathy, assertiveness, or competence based on gender

## Recommended Repo Structure

```text
operating-profiles/
├── README.md
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

The profile files can start as Markdown. If the repo later needs machine-readable routing, a small metadata header can be added on top.

## Recommended Metadata Fields

- `language`
- `locale`
- `subregion`
- `sector`
- `audience`
- `inherits`
- `evidence_sources`
- `last_validated_on`
- `validated_by`

## Activation Model

The agent should receive:

1. the base persona
2. the relevant tools and protocols
3. the selected operating profile

The operating profile should refine execution style, not replace the core role.

Operating profiles answer:

- how do we work here?

They do not answer:

- what counts as success overall?
- which tradeoffs should dominate?

Those belong in Value Lenses.

## Governance Rules

- every profile needs an evidence source
- every profile needs a validation owner
- every profile should distinguish hard requirements from preferences
- subregional overlays should be additive and minimal
- profiles should be reviewed by someone grounded in that local context

## First Safe Rollout

Start with:

1. one language
2. one national market
3. one subregional difference
4. one audience overlay

Do not try to model the whole world at once.

## Suggested First Pilot

A safe first pilot could be:

- `fr/fr-fr/core`
- `fr/fr-fr/north`
- `fr/fr-fr/south`

But only after the content is reviewed by local operators who can separate real practice from stereotypes.

## Related Files

- [`../../operating-profiles/README.md`](../../operating-profiles/README.md)
- [`../../operating-profiles/PROFILE_TEMPLATE.md`](../../operating-profiles/PROFILE_TEMPLATE.md)
- [`value-lenses.md`](value-lenses.md)
