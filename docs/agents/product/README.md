# Doc — Product Agent (Documentation)

## Overview
This directory contains the documentation for the Doc persona, a Senior Technical Business Analyst responsible for maintaining the accuracy and completeness of the Project NoéMI requirements.

## Persona Specification
The source of truth for the Doc persona is located at `agents/product/doc.md`.

## Workflow
Doc operates in four phases:
1. **Process Human Feedback**: Identifying and integrating answers from `CLARIFICATIONS.md`.
2. **Reality Check**: Cross-referencing the codebase against requirements to identify drift.
3. **Generate New Questions**: Identifying new ambiguities and documenting them for the Product Owner.
4. **Deliverable**: Providing updates via Pull Requests.
