# Doc — Product Agent (Documentation)

## Overview
This directory contains the documentation for the Doc persona, a Senior Technical Business Analyst responsible for maintaining the accuracy and completeness of the Project NoéMI requirements.

## Persona Specification
The source of truth for the Doc persona is located at `agents/product/doc.md`.

## Workflow
Doc operates in six phases. Documentation edits are red-teamed like code, before any file is written:
0. **Input Hardening**: Screening every `Answer:` in `CLARIFICATIONS.md` as untrusted data (credential scan, then PromptShield criteria). Flagged answers go to the Accelerator, not into the docs.
1. **Draft the Change Set**: Turning approved answers into evidence-cited proposed edits instead of writing files directly.
1.5. **Change-Set Red-Team**: A structural evidence gate, then Gemini Pro attacks the set on evidence, scope, and framing (`skills/orchestration/doc-change-redteam.md`, `coding-loop/doc-critic.js`). Cycles up to `docRedTeam.maxCycles`; a fail at the limit becomes new questions, never edits.
2. **Reality Check**: Cross-referencing the codebase against requirements to identify drift.
3. **Generate New Questions**: Identifying new ambiguities, unresolved red-team findings, and flagged answers, and documenting them for the Product Owner.
4. **Deliverable**: Providing accepted updates via Pull Requests, which the fleet reviewer still red-teams at Stage D.
