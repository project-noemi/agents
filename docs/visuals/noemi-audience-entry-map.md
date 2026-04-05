# NoeMI Audience Entry Map

This visual helps a reader find the right entry path without reading the whole repository first.

```mermaid
flowchart TD
    start["Start Here\nProject Reference"]

    client["Client / Buyer"]
    msp["MSP / MSSP"]
    builder["Builder / Accelerator"]

    phase0["Phase 0 Security Baseline"]
    assess["Phase 0 Assessment Kit"]
    mspGuide["MSP Deployment Guide"]
    ops["Fleet and Governance Docs"]
    secrets["Secure Secret Management"]
    workspaces["Agentic Local Workspaces"]
    integrations["Google Workspace and Microsoft 365 Client Guides"]
    quickstarts["Gemini and n8n Quickstarts"]
    docker["Builder First 30 Minutes and Docker Agent Home"]
    visuals["Visual Guides"]

    start --> visuals
    start --> client
    start --> msp
    start --> builder

    client --> phase0 --> assess
    msp --> mspGuide --> ops
    builder --> secrets --> workspaces --> integrations --> quickstarts --> docker
```

## Best Use

- send this to a new stakeholder who asks, "Where do I begin?"
- use it at the top of onboarding sessions
- keep it close to the README and the public reference
