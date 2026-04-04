# Phase 0 30/60/90-Day Roadmap Template

Use this roadmap to keep the two workstreams visible:

- **Security track** — what must be stabilized or governed
- **AI readiness track** — what must be clarified, measured, and piloted to produce value

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
