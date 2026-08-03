# Coding Agents (Documentation)

## Overview
This directory contains documentation for agents specialized in software development, code review, and automated testing.

## Personas
- **Architect**: A system architect responsible for structural integrity, modularity, and long-term maintainability.
  - Spec: `agents/coding/architect/core.md`
- **Bolt**: A high-performance web development agent.
  - Spec: `agents/coding/bolt/core.md`
- **Sentinel**: A security-focused code auditor and reviewer.
  - Spec: `agents/coding/sentinel/core.md`
- **Mender**: Remediation specialist that closes review findings without eroding the tests and checks that detected them. The producing half of the cross-model review loop — Gemini reviews, Mender fixes, a human edits the instruction between them. See [`docs/AI_REVIEW_GOVERNANCE.md`](../../AI_REVIEW_GOVERNANCE.md).
  - Spec: `agents/coding/mender/core.md`
