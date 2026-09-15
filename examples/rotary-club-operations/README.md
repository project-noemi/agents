# Rotary Club Operations Example

This example demonstrates how to apply the generic [Club Operations agent](../../agents/operations/club-operations.md) and skills to **Rotary International club workflows**.

## Overview

The core repository provides **organization-agnostic** club-operations tools:
- **Agent:** `agents/operations/club-operations.md` — Generic club operations assistant  
- **Skills:** `skills/operations/{meeting-minutes,annual-calendar,speaker-brief}.md` — Generic club workflow skills

This example shows how to **layer Rotary-specific context** on top of those generic tools.

## What's in this example

- **`guide.md`** — Detailed guide to Rotary club operations workflows (this used to be in docs/examples)
- **`district-1911/`** — Hungarian District 1911 deployment example with NotebookLM sources, Hungarian/English bilingual workflows

## Using generic club-ops tools for Rotary

### Quick start

The generic club-operations agent and skills work for any volunteer organization. For Rotary:

1. Use the fiscal year July 1 – June 30
2. Reference Rotary International (RI) as the governing body
3. Include district-level events and requirements
4. Follow RI officer training and succession patterns

See `guide.md` for detailed Rotary workflows, officer responsibilities, and meeting structures.

### Example prompt

```text
Read AGENTS.md, agents/operations/club-operations.md, and
skills/operations/meeting-minutes.md. Adopt the persona.

For Rotary International context:
- Fiscal year: July 1 2030 – June 30 2031
- Governing body: Rotary International (RI)
- District: [your district number]
- Knowledge sources: [your NotebookLM/wiki URLs if any]

Draft minutes for a board meeting (2030-09-10) from these notes:
[...your meeting notes...]

Language: English.
```

The generic agent handles meeting-minute drafting; you provide the Rotary-specific inputs.

## District-specific deployments

The **`district-1911/`** subfolder shows a complete district deployment with:
- Specific NotebookLM knowledge-base URLs
- Hungarian/English bilingual workflows
- District portal references and local compliance requirements
- PELS/SELS terminology and Hungarian legal framework notes

Other districts can fork this pattern:
- Replace District 1911 URLs with your district resources
- Update language, terminology, and legal/compliance framework
- Add your district's specific event calendar and officer training schedules

## What NOT to include

Per repository rules, examples must never contain:
- ❌ Real member names, contact details, or PII
- ❌ Actual meeting minutes, votes, attendance, or financial records  
- ❌ Private club documents, passwords, or credentials
- ❌ Confidential incidents or safeguarding information

Use synthetic data for public examples. Keep real club data in your private workspace.

## Related resources

- **Generic agent:** [agents/operations/club-operations.md](../../agents/operations/club-operations.md)
- **Generic skills:** [meeting-minutes](../../skills/operations/meeting-minutes.md), [annual-calendar](../../skills/operations/annual-calendar.md), [speaker-brief](../../skills/operations/speaker-brief.md)
- **4D Framework:** [docs/METHODOLOGY.md](../../docs/METHODOLOGY.md)

---

**Status:** Community reference implementation. No RI endorsement implied.
