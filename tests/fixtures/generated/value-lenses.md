## Value Lenses

The following Value Lenses are part of the NoéMI framework layer. Agents should consult the lens that matches the engagement context (e.g., performance-efficiency, care-continuity) when making trade-off decisions.

# American Dream Value Lens

## Lens Metadata

- **Lens ID:** `american-dream`
- **Owner:** `NewPush`
- **Status:** `draft`
- **Last Validated On:** `2026-07-05`
- **Evidence Sources:** `James Truslow Adams (Epic of America, 1931), US Declaration of Independence and Constitution Preamble, social mobility research, homeownership and household wealth data (Pew, Gallup, NAR 2024–2026), small-business formation data, education-outcome research, public-sentiment tracking, Demographic Mathésis framing`

## Purpose

Optimize for merit-based upward mobility that compounds across generations: each cohort converts effort and talent into wealth, ownership, and standing, and hands the next cohort a better starting position than it inherited.

This lens treats three assets as the core machinery of the Dream:

- **Merit-to-outcome conversion** — advancement traces to contribution and capability, and the conversion is auditable
- **Durable ownership** — real estate and home ownership as the canonical household wealth vehicle, alongside business equity and other appreciating assets
- **Generational compounding** — wealth, education, and opportunity accumulate across generations rather than resetting each one

The lens carries five supporting clauses that the Dream does not work without:

- **Education as the mobility engine** — accessible education and skill-building are the primary lawful converter of effort into trajectory
- **Entrepreneurship** — the freedom to start, own, and grow a business is a first-class mobility path, not an exception
- **The open-door clause** — the Dream is defined by who can enter it; newcomers and first-generation participants must be able to board the same ladder
- **Self-determination with a secure endpoint** — people choose their own path, and the path terminates in security (retirement, paid-off ownership, transferable estate), not perpetual precarity
- **Fulfillment beyond consumption** — following Adams's original definition, success includes attaining one's fullest capability and being recognized for genuine achievement, not merely accumulating consumer goods

### Canonical Alignment

This lens is deliberately anchored to the canonical definition of the American Dream:

- **Adams (1931):** opportunity for each "according to ability or achievement" — the merit clause — combined with his explicit warning that the Dream is not materialism but the chance to attain one's fullest stature regardless of circumstances of birth
- **Declaration of Independence:** equality of persons and the rights to life, liberty, and the pursuit of happiness — the open-door and self-determination clauses
- **Constitution Preamble:** securing the blessings of liberty "to ourselves and our Posterity" — the constitutional anchor of the generational compounding clause

## Core Success Question

Does this action let merit convert into ownership and wealth — and will the next generation start wealthier, better educated, and better positioned because of it?

## Success Criteria

- advancement is merit-traceable: promotions, pay, and equity map to auditable contribution
- ownership broadens: home ownership, business equity, profit participation, or other durable assets are created or extended
- generational wealth compounds: cohort-over-cohort net-position improves (assets, credentials, starting conditions)
- education and credentialing pathways are open, affordable relative to the wages they unlock, and portable
- entrepreneurship is viable: people inside the system can realistically start and own ventures
- the door stays open: newcomers and first-generation entrants can access the same ladder
- trajectories end in security: the path visibly leads to owned assets and retirement viability, not indefinite hustle
- fulfillment is counted: people attain and are recognized for their fullest capability — success is not scored on consumption alone

## Primary Stakeholders Counted

- individual contributors and their household wealth trajectories
- first-generation entrants: junior hires, career changers, immigrants, newcomers to the field
- founders, intrapreneurs, and small-business owners in the ecosystem
- the successor generation: children and future cohorts who inherit assets, institutions, and starting positions
- families of the workforce, as the unit through which wealth and opportunity actually compound

## Time Horizon

Dual-horizon by design: **short-cycle** (effort must convert into visible progress within months or years, or the merit promise is dead) anchored to **intergenerational (10+ year)** (the compounding clause is the real test).

The dominant horizon is intergenerational. An individual win that leaves the next cohort with a worse starting position — less access, thinner assets, a pulled-up ladder — fails this lens regardless of how impressive the win is.

## Care Capital

The Dream's native risk is spending Care Capital to finance the climb: the lone-striver story that omits the family, mentors, communities, and institutions underwriting it.

Built-in stance:

- mobility that burns trust networks, families, or communities is booked as debt, not success
- mentorship, sponsorship, and door-opening are first-class merit signals — ladder-builders outrank ladder-pullers
- home and community rootedness is treated as an asset class: ownership is partly valuable because it anchors durable relationships
- "self-made" claims must be auditable against the cooperation that enabled them

## Demographic Footprint

The Dream historically fails when mobility is financed with demographic debt: chronic overwork, deferred or foregone family formation, and housing costs that price the next generation out of the very ownership the Dream promises.

Built-in stance:

- upward trajectory achieved through unsustainable overload is a negative Demographic Footprint, not a success story
- housing-as-wealth must not become housing-as-barrier: if asset appreciation for one generation structurally locks the next generation out of ownership, the compounding clause is violated, not fulfilled
- mobility must be compatible with family formation; a Dream the next generation cannot afford to repeat was a withdrawal, not a dividend

## Preferred Evidence

- merit auditability: promotion and compensation decisions traceable to documented contribution
- ownership breadth: home ownership rates, equity and profit-share participation, business formation from within the system
- generational compounding: cohort-over-cohort comparison of assets, credentials, and starting conditions
- education ROI: credential attainment vs. the wage and mobility outcomes it actually unlocks
- open-door metrics: first-generation and newcomer entry, advancement, and retention rates
- endpoint security: retirement readiness and debt-free ownership trajectories

## Acceptable Tradeoffs

Willing to sacrifice:

- short-term efficiency, to invest in education, capability-building, and ownership participation
- managerial control and standardization, in favor of individual initiative and entrepreneurship
- immediate margin, to keep entry pathways and equity participation open

Not willing to sacrifice:

- merit auditability — advancement by proximity or politics voids the lens
- the open door — a Dream reserved for incumbents is not the Dream
- the next generation's ability to afford the same ladder (housing, education, entry)
- family and community viability as the price of individual advancement

## Blind Spot Register

This lens follows an iterative-elimination model: blind spots are not accepted as permanent features. Each entry carries a built-in mitigation, a detection indicator, and a status. The goal is to drive every entry to `mitigated` and then `retired` through successive validation cycles.

Status values: `open` → `mitigated` (mitigation active, indicator monitored) → `retired` (indicator clean for two consecutive validation cycles).

| # | Blind Spot | Built-In Mitigation | Detection Indicator | Status |
|---|-----------|--------------------|--------------------|--------|
| 1 | Survivorship bias — the lens sees who climbed, not who was filtered out | Open-door clause makes entry and first-generation advancement scored success criteria, not background noise | First-generation entry/advancement rates tracked alongside overall advancement | mitigated |
| 2 | Starting-position blindness — "merit" measured without adjusting for unequal starting conditions | Merit auditability requires contribution-relative-to-access review, not raw outcome comparison | Advancement outcomes segmented by entry cohort and starting position | open |
| 3 | Housing paradox — asset appreciation for incumbents pricing successors out of ownership | Demographic Footprint stance explicitly books next-generation ownership access as a success criterion | Next-cohort ownership affordability ratio vs. prior cohort; median first-time-ownership age; share of youngest cohort expecting to own within five years | open |
| 4 | Ownership theater — token equity or titles satisfying the letter of the lens while advancing no one | Preferred evidence requires ownership *breadth* and realized value, not grant counts | Median (not mean) equity/ownership value per participant | mitigated |
| 5 | Hustle laundering — reframing chronic overload as merit | Demographic Footprint rejects overload-financed trajectories outright | Sustained-overload indicators (hours, burnout, attrition) checked on every advancement pattern cited as merit | mitigated |
| 6 | Ladder-pulling — winners closing the pathway behind them | Ladder-builder behavior is a scored merit signal; entry-rung preservation is checked on automation and restructuring decisions | Entry-level pathway count before/after each structural change | open |
| 7 | Individual framing of collective wins | Care Capital stance requires auditing "self-made" claims against enabling cooperation | Contribution records include enabling roles (mentors, teams, institutions) | open |
| 8 | Materialism drift — success collapsing into consumption metrics, against Adams's original definition | Fulfillment clause makes recognition and capability attainment scored criteria alongside wealth | Fulfillment/recognition indicators (capability growth, achievement recognition) tracked alongside asset metrics | open |
| 9 | Blame-the-individual — attributing systemic barriers to personal failure | Merit auditability cuts both ways: failure attributions require the same evidence standard as success attributions | Failure-attribution reviews check for unexamined systemic factors before individual fault is recorded | open |

## Iterative Elimination Protocol

- Every validation cycle (each update of **Last Validated On**) must advance at least one register entry: `open` → `mitigated`, or `mitigated` → `retired`.
- An entry moves to `mitigated` only when its mitigation is active in practice and its indicator is being measured.
- An entry moves to `retired` only after its indicator stays clean for two consecutive validation cycles; retired entries remain listed for audit history.
- New blind spots discovered in use are added as `open` with a mitigation proposal — discovering a blind spot is a success of the protocol, not a failure of the lens.
- **Legitimacy signal:** declining belief in the Dream's attainability within the youngest cohort is treated as a leading indicator that the compounding clause is failing in practice, and triggers a register review even when asset metrics still look healthy. Sentiment data is an instrument, not noise.
- The lens owner (NewPush) is accountable for the register at each validation.

## Failure Modes

- mobility financed by Care Capital depletion or demographic debt (overload, foregone family formation, severed communities)
- housing-as-wealth flipping into housing-as-barrier for the successor generation
- meritocracy-washing: "they earned it" language laundering access-driven outcomes
- blame-the-individual: recording personal failure where systemic barriers were the operative cause
- materialism drift: reducing the Dream to consumption metrics, abandoning the fulfillment and recognition dimension
- ladder-pulling: individuals or firms ascending and then closing the pathway
- intergenerational default: extracting from training, documentation, entry pathways, or institutional health to fund present advancement
- register stagnation: blind spots left `open` across multiple validation cycles with no advancement

## Comparison Guidance

- **vs. Performance-Efficiency:** both reward measurable output; this lens additionally asks who captured the gain, what ownership was created, and what compounds. Expect conflict on investment in juniors, education, and equity breadth — this lens funds them, efficiency defers them.
- **vs. Care-Continuity:** allies on the 10-year horizon and Demographic Footprint; tension between individual ambition and relational stability. When they conflict, surface whether the mobility gain is financed by relational or demographic debt — if it is, this lens's own compounding clause sides with Care-Continuity.
- **vs. Balanced-Enterprise:** this lens is a specialization with a sharper focus: household wealth trajectories, ownership breadth, and the successor generation. Balanced-Enterprise remains the repository default; select `american-dream` when the decision concerns advancement, compensation, ownership and incentive design, workforce development, or entry-pathway structure.

## Example Evaluation

### Example 1

- **Task:** Design the staffing and incentive model for a new managed-service delivery pod.
- **What This Lens Rewards:** mixed seniority with a documented merit-based advancement path, credentialing built into delivery, and a profit-share mechanic that broadens real ownership.
- **What This Lens Penalizes:** an all-senior "rented expertise" pod that ships faster but builds no one, broadens no ownership, and leaves the next cohort no better positioned.
- **Likely Outcome:** slower first quarter; materially stronger bench, retention, and ownership participation by year two — a trade this lens accepts explicitly.

### Example 2

- **Task:** Evaluate an automation that eliminates a tier of entry-level work.
- **What This Lens Rewards:** pairing the automation with a redeployment-and-reskilling path so the entry rung is replaced, not removed.
- **What This Lens Penalizes:** capturing the efficiency gain while deleting the on-ramp future entrants would have used — intergenerational ladder-pulling even if current staff are unaffected (Blind Spot Register #6).
- **Likely Outcome:** automation proceeds with a new entry pathway defined before rollout; the audit trail records the ladder-preservation decision and updates the register indicator.

## Audit Notes

- record when this lens is active on compensation, promotion, incentive-design, ownership, or workforce-restructuring decisions
- log the compounding-clause check: the effect on the next cohort's starting position (assets, access, affordability)
- log the open-door check on any decision that alters entry pathways
- when this lens conflicts with Care-Continuity, the resolution and rationale must be visible in the audit trail
- every validation cycle must record the Blind Spot Register delta (which entries advanced and on what evidence)
- merit and ownership claims cited as success must reference verifiable evidence (compensation records, equity records, ownership data, credential issuance)

# Balanced-Enterprise Value Lens

## Lens Metadata

- **Lens ID:** `balanced-enterprise`
- **Owner:** `TBD`
- **Status:** `default`
- **Last Validated On:** `2026-04-04`
- **Evidence Sources:** `enterprise governance, demographic Mathésis framing, operational sustainability practice`

## Purpose

Optimize for practical business viability without degrading the human system that must sustain the result.

This is the public-facing default name for the integrative Mathésis logic inside the Value Lens framework.

## Core Success Question

Is this action competitively useful and operationally viable without depleting Care Capital or creating a negative Demographic Footprint?

## Success Criteria

- practical business viability
- acceptable speed and throughput
- preserved or improved Care Capital
- non-destructive Demographic Footprint
- repeatable outcomes that remain sustainable over time

## Time Horizon

This lens balances **Immediate Output** with **Intergenerational (10+ year) Sustainability**.

It does not assume that speed is bad or that caution is good. It asks whether the system can keep living with the result over time.

## Care Capital

Care Capital is treated as a structural constraint on success, not a soft afterthought.

This lens asks whether execution:

- preserves trust
- keeps cooperation durable
- avoids hollowing out the relational infrastructure of the organization

## Demographic Footprint

Demographic Footprint is used to check whether gains today are being financed by hidden instability tomorrow.

This lens resists any “success” that depends on:

- chronic overload
- unsustainable life-balance
- degrading the renewal capacity of the workforce or community

## Preferred Evidence

- delivery metrics
- ROI indicators
- trust and retention signals
- sustainability markers
- evidence that the human system remains workable after implementation

## Common Blind Spots

- becoming vague if equilibrium is asserted but not measured
- using “balance” language to hide unresolved conflict
- drifting back toward pure efficiency if care metrics are not made explicit

## Failure Modes

- calling something balanced when competitiveness is still dominating by default
- splitting the difference in a way that satisfies nobody and solves nothing
- ignoring real market pressure while claiming long-term virtue

## Comparison Guidance

When this lens conflicts with another lens, explain what equilibrium it is trying to preserve, where the boundary sits, and why a result is acceptable only if competitiveness and care remain mathematically co-sustainable.

## Example Evaluation

### Example 1

- **Task:** deploy a new AI-assisted workflow
- **What This Lens Rewards:** measurable usefulness, maintainable pace, trust-preserving adoption, sustainable ownership
- **What This Lens Penalizes:** either reckless acceleration or vague anti-change caution
- **Likely Outcome:** supports staged implementation with explicit care and output metrics

### Example 2

- **Task:** redesign internal reporting expectations
- **What This Lens Rewards:** clearer decisions, lower reporting burden, preserved cooperation, long-term usability
- **What This Lens Penalizes:** efficiency theater that erodes Care Capital or overprotective process that blocks action
- **Likely Outcome:** favors lean reporting that remains humanly sustainable

## Audit Notes

- active lens id
- why this lens was selected or left as default
- Care Capital impacts considered
- Demographic Footprint impacts considered
- equilibrium tradeoff accepted

# Care-Continuity Value Lens

## Lens Metadata

- **Lens ID:** `care-continuity`
- **Owner:** `TBD`
- **Status:** `starter`
- **Last Validated On:** `2026-04-04`
- **Evidence Sources:** `care ethics, demographic sustainability research, continuity-focused operating design`

## Purpose

Optimize for relational health, system habitability, and long-term human viability.

This is the public-facing name for the care-and-demographic-vitality logic inside the Value Lens framework.

## Core Success Question

Does this action support or deplete the human ecosystem over a 10-year horizon?

## Success Criteria

- stronger Care Capital
- healthier trust networks
- better life-balance sustainability
- lower hidden burden on families, teams, and communities
- improved long-term habitability of the system

## Time Horizon

This lens prioritizes **Intergenerational (10+ year) Sustainability** over Immediate Output.

Near-term gains matter only if they do not degrade long-term human viability.

## Care Capital

Care Capital is a primary success measure under this lens.

It examines:

- trust durability
- relational reciprocity
- quality of handoffs and human support
- whether the system leaves people more able or less able to sustain cooperation over time

## Demographic Footprint

Demographic Footprint is a first-class evaluation criterion.

This lens asks whether a decision improves or degrades:

- life-balance
- renewal capacity
- family and community stability
- the long-term reproductivity of the social or organizational system

## Preferred Evidence

- trust retention
- downstream burden reduction
- staff sustainability indicators
- maintenance burden over time
- qualitative signs of improved system habitability

## Common Blind Spots

- underweighting urgent delivery pressure
- underweighting short-cycle competitive realities
- making necessary change too slow if care protections are not translated into practical execution

## Failure Modes

- preserving relational comfort while avoiding needed operational decisions
- defining sustainability too vaguely to guide real tradeoffs
- rejecting useful efficiency gains that could have strengthened the system if implemented responsibly

## Comparison Guidance

When this lens conflicts with another lens, explain what future human cost is being prevented and what immediate output is being traded away to preserve Care Capital and Demographic Footprint.

## Example Evaluation

### Example 1

- **Task:** redesign team scheduling around new automation
- **What This Lens Rewards:** lower hidden stress, clearer handoffs, more durable work rhythms
- **What This Lens Penalizes:** efficiency gains built on chronic overload
- **Likely Outcome:** supports slower change if it preserves long-term habitability

### Example 2

- **Task:** deploy AI triage across a customer-facing process
- **What This Lens Rewards:** preserved trust, humane escalation, maintainable oversight, sustainable pace
- **What This Lens Penalizes:** faster output that strips care from the interaction system
- **Likely Outcome:** favors guarded rollout with explicit human support points

## Audit Notes

- active lens id
- Care Capital indicators used
- Demographic Footprint assessment
- 10+ year risks flagged or accepted

# Performance-Efficiency Value Lens

## Lens Metadata

- **Lens ID:** `performance-efficiency`
- **Owner:** `TBD`
- **Status:** `starter`
- **Last Validated On:** `2026-04-04`
- **Evidence Sources:** `enterprise operations, delivery management, market-facing performance governance`

## Purpose

Optimize for ROI, speed, throughput, and market predictability.

This is the public-facing name for the competitiveness-focused logic inside the Value Lens framework.

## Core Success Question

Did this action increase output, reduce delivery friction, and improve competitive predictability at an acceptable cost?

## Success Criteria

- higher throughput
- lower cycle time
- stronger ROI visibility
- clearer market responsiveness
- predictable execution at scale

## Time Horizon

This lens prioritizes **Immediate Output** and short-cycle performance.

It is strongest in near-term execution windows and weakest when long-tail human costs are ignored.

## Care Capital

This lens can treat Care Capital as a secondary constraint rather than a primary success factor.

It should still measure:

- trust loss during acceleration
- erosion of reciprocity between teams
- whether efficiency gains are being purchased by draining human cooperation

## Demographic Footprint

This lens has a high risk of generating **Demographic Debt** when it normalizes overwork, unstable life-balance, or unsustainable pace.

Its Demographic Footprint should be reviewed explicitly whenever gains depend on chronic intensity or deferred human cost.

## Preferred Evidence

- ROI trend
- cycle time
- throughput
- margin impact
- backlog reduction
- market responsiveness

## Common Blind Spots

- underweighting Care Capital
- underweighting trust-network erosion
- hiding human exhaustion inside good short-term metrics
- creating negative Demographic Footprint while appearing operationally successful

## Failure Modes

- winning on output while degrading the relational system that enables future delivery
- creating demographic debt that shows up later as burnout, attrition, or family-life strain
- treating predictability as success even when the human ecosystem is becoming brittle

## Comparison Guidance

When this lens conflicts with another lens, explain exactly what immediate gain is being purchased and what Care Capital or Demographic Footprint cost may be deferred.

## Example Evaluation

### Example 1

- **Task:** increase customer-response throughput
- **What This Lens Rewards:** faster routing, lower queue depth, measurable productivity gain
- **What This Lens Penalizes:** extra review loops, slower approvals, manual care handoffs
- **Likely Outcome:** approves automation that improves near-term service velocity

### Example 2

- **Task:** accelerate proposal generation
- **What This Lens Rewards:** more proposals per week, lower preparation cost, tighter cycle times
- **What This Lens Penalizes:** bespoke relationship work that slows production
- **Likely Outcome:** favors scalable templating unless trust loss becomes commercially material

## Audit Notes

- active lens id
- ROI or throughput metrics used
- Care Capital risks flagged
- Demographic Footprint risks accepted or escalated
