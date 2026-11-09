# Operations Agents (Documentation)

## Overview
This directory contains documentation for agents specialized in knowledge management, QA, and multimodal workflows.

## Personas
- **Knowledge Manager**: Curates and manages the repository's knowledge base.
  - Spec: `agents/operations/knowledge-manager.md`
- **QA & Risk Manager**: Audits agents for performance, reliability, and security risks.
  - Spec: `agents/operations/qa-risk-manager.md`
- **Multimodal Specialist**: Handles video and image analysis tasks.
  - Spec: `agents/operations/multimodal-specialist.md`
- **After-hours Autotask Nudge**: Posts a Slack nudge to on-call engineers when a new or unassigned Autotask Service Desk ticket arrives outside business hours (08:00-18:00 Budapest), never auto-assigns, and records after-hours reach and first-response SLA breach metrics.
  - [Live persona](../../../agents/operations/after-hours-autotask-nudge.md)
- **Club Operations**: Helps volunteer-club officers prepare plans, minutes, calendars, and speaker briefs with source verification and human decision ownership.
  - [Live persona](../../../agents/operations/club-operations.md)
  - [Rotary deployment example](../../examples/rotary-club-operations.md)
