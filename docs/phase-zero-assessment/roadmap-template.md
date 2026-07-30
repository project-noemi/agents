# Phase 0 30/60/90-Day Roadmap Template

Use this roadmap to keep the two workstreams visible:

- **Security track** — what must be stabilized or governed
- **AI readiness track** — what must be clarified, measured, and piloted to produce value

Do not author the roadmap from a blank page each time. Start from the archetype baseline below, then assemble the specific items from the assessment findings using the [recommendation-library.md](recommendation-library.md), and finally tailor for the client. Pick the baseline first, adjust second.

## Pick A Client Archetype First

Client organizations cluster into a small number of shapes. Selecting the closest archetype gives you a sensible default pace, sequencing, and emphasis before you tailor. Choose by best fit on sector, size, and digital maturity — not an exact match — and note where the client deviates.

### A. Lean SMB / Owner-Led

- **Looks like:** under ~50 staff, few or no dedicated IT, owner or a single manager is the sponsor, tooling is mostly SaaS.
- **Roadmap emphasis:** move fast on one narrow pilot; keep security remediation to the few controls that actually block (MFA, backups, secrets). Do not over-engineer governance the org cannot staff.
- **Common risk:** the sponsor is also the process owner and the reviewer — capacity, not ambition, is the constraint.

### B. Mid-Market / Scaling

- **Looks like:** ~50–500 staff, some internal IT or an MSP, defined departments, mixed digital maturity across teams.
- **Roadmap emphasis:** standard 30/60/90 pacing; invest in process clarity and cross-team handoffs; formalize approval boundaries and measurement before widening scope.
- **Common risk:** enthusiasm outrunning process stability; pilots spreading across teams before one proves value.

### C. Regulated / High-Assurance

- **Looks like:** finance, healthcare, legal, public sector; compliance obligations; change control and audit expectations already exist.
- **Roadmap emphasis:** front-load the security track and refusal boundaries; extend timelines to fit change-control and sign-off; treat logging, audit, and human approval gates as launch blockers, not enhancements.
- **Common risk:** treating compliance sign-off as a formality; underestimating review cycles.

### D. Digitally Mature / Tech-Forward

- **Looks like:** strong engineering culture, existing automation, may already run Shadow AI, sponsor is technically fluent.
- **Roadmap emphasis:** compress the stabilize phase; focus on governance, measurement discipline, and consolidating ungoverned usage into a governed path rather than proving basic feasibility.
- **Common risk:** capability mistaken for readiness — measurement, approval boundaries, and role redesign lag the tooling.

### How To Use The Archetype

1. Select the closest archetype and adopt its pacing and emphasis as the starting shape of the roadmap.
2. Overlay the specific findings from the report, mapping each gap to a remediation item via [recommendation-library.md](recommendation-library.md).
3. Tailor: adjust dates, owners, and scope to the client, and record where they deviate from the archetype and why.

## 0-30 Days: Stabilize And Scope

### Security Track

- confirm executive sponsor and technical owner
- document the AI use case, systems touched, and allowed data classes
- close urgent identity, MFA, or privileged-access gaps
- verify backup recoverability for critical systems
- establish approved secret-management path for machine identities and service credentials
- define the initial refusal boundary for data and tasks that must not touch AI

### AI Readiness Track

- confirm the business owner for the target workflow
- document the current workflow, inputs, outputs, and approval steps
- identify the first narrow pilot candidate
- capture baseline metrics for volume, cycle time, and human effort
- define what work AI may perform first and what remains human-only

## 31-60 Days: Add Guardrails And Design The Pilot

### Security Track

- centralize logs for the systems involved in the AI workflow
- confirm alert ownership and incident escalation path
- review third-party AI and SaaS vendor exposure
- tighten access scopes for service accounts and connectors
- document human approval points for risky or mutating actions
- run a tabletop or dry run for failure handling

### AI Readiness Track

- convert the workflow into a constrained pilot design
- assign review, correction, and exception owners
- define the target output and acceptance criteria clearly
- train the participating team on the approval boundary
- confirm how the business owner will review results and value

## 61-90 Days: Prepare For Governed Launch

### Security Track

- finalize monitoring and audit expectations
- validate the target workflow against the readiness rubric
- perform a Red Team or boundary review where warranted
- confirm rollback and correction procedures

### AI Readiness Track

- run the first governed pilot
- compare pilot results to the baseline metrics
- document where human roles shifted from execution to supervision or exception handling
- decide whether to expand, constrain further, or pause
- prepare the handoff into ongoing ROI tracking using the approved metrics

## Owners And Dependencies

| Track | Item | Owner | Dependency | Target Date |
|-------|------|-------|------------|-------------|
| Security | | | | |
| AI Readiness | | | | |
