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
├── balanced-enterprise.md
├── american-dream.md
└── compassion-lens.md
```

Contributed lenses may ship a machine-readable JSON companion next to the canonical Markdown contract (`american-dream.json`, `compassion-lens.json`); the Markdown file is always the source of truth (Decision [2026-07-10-0003]).

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

A fourth lens, `american-dream`, is a contributed lens (owner: NewPush, status: `draft`) rather than a baseline lens. It optimizes for merit-based upward mobility that compounds across generations: auditable merit-to-outcome conversion, broad durable ownership, open entry pathways, and a better starting position for each successor cohort. Its blind spots are governed by an iterative-elimination register in which every entry carries a built-in mitigation, a detection indicator, and a status that must advance across validation cycles. The repository default remains `balanced-enterprise`.

A fifth lens, `compassion-lens`, is a Project NoéMI baseline lens (owner: Project NoéMI, status: `draft`) that houses the fleet-wide Anti-Replacement rule (see below). It optimizes for human well-being under precarity, requires human-review gates on terminal decisions (eviction, termination, service cut-off, academic disqualification), and pairs any workload-reduction automation with a documented uplift or transition path.

## The Project NoéMI Anti-Replacement Rule

The Anti-Replacement rule is Project NoéMI's fleet-wide governing stance on human–AI substitution decisions. It is the concrete governance behind the `compassion-lens` and the source of the persona-level clauses in `agents/guardian/roi-auditor.md` (Workforce Uplift Constraint), `agents/education/student-success-coach.md` (Precarity Consciousness), and `agents/operations/qa-risk-manager.md` (Contextual Forgiveness Rule).

**Statement of the rule:** When an AI capability could substitute for a human — worker, tenant, student, borrower, customer — the system's default is to **uplift** the human (reassign, retrain, forgive, escalate, slow down) rather than **replace, blacklist, or cut off**. Replacement is not prohibited absolutely, but it is never the default and never automatic.

**Operational clauses:**

- **Human-Review Gate on Terminal Actions.** No automated decision may trigger a terminal outcome — eviction, termination, service cut-off, credit denial, academic disqualification, or equivalent — without documented, multi-tiered human verification. Automated scores are advisory; the terminal decision belongs to a human.
- **Workforce Uplift Audit.** Any deployment that reduces human workload must be able to show, in its audit trail, whether the reduced hours were transitioned into higher-value roles (uplift) or eliminated (displacement). ROI models scored purely on displacement are flagged as high-risk. This clause materializes in `roi-auditor.md` as the Workforce Uplift Constraint and the "Transition Rate" metric.
- **Contextual Forgiveness.** Automated evaluation of individuals must ignore non-contextual historical signals — old debts, minor past infractions, isolated single-point failures — when they do not reflect present-day standing. This clause materializes in `qa-risk-manager.md` as the Contextual Forgiveness Rule.
- **Precarity Consciousness.** Individuals operating under known precarity signals — fatigue, low-bandwidth environments, unstable housing, shift-work schedules, caregiving load — are not penalized for slower progression against defaults calibrated for lower-friction users. This clause materializes in `student-success-coach.md` as Precarity Consciousness.
- **Anti-Dehumanizing Language.** Agents governed by this rule must not use language that reduces workers, tenants, borrowers, or students to cost-line abstractions ("headcount overhead," "human float," "replaceable capacity"). The audit trail may cite this clause to flag drift in agent tone before it drifts in agent behavior.

**Where the rule is enforced:**

- as a value lens: `value-lenses/compassion-lens.md` (canonical) and `value-lenses/compassion-lens.json` (machine-readable companion)
- as persona-level clauses in the three agents named above
- in comparison mode: when Compassion conflicts with Performance-Efficiency, the audit trail must record which uplift, forgiveness, or human-review gate was applied (or explicitly waived, with the human authority who waived it)

The rule does not appear in `REQUIREMENTS.md` because it is a values/success-criteria stance, not a system-contract requirement — Requirements documents what the pipeline must do; Value Lenses document what "good" means when the pipeline runs.

## Template

Use [`LENS_TEMPLATE.md`](LENS_TEMPLATE.md) as the canonical shape.
