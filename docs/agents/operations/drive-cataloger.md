# Drive Cataloger — Operations Agent

## Overview

The Drive Cataloger is a read-only auditing agent that systematically inventories Google Drive contents, classifies documents, detects staleness, and produces structured catalogs for governance and cleanup decisions.

## When to Use

- Periodic audits of organizational Drive contents
- Identifying stale, orphaned, or over-shared files before compliance reviews
- Building a queryable inventory of documents by domain, type, or owner
- Comparing Drive state across time (diff between catalog runs)

## Relationship to Other Agents

| Agent | Relationship |
|-------|-------------|
| **Knowledge Manager** | Complementary — the Cataloger indexes *what exists*; the Knowledge Manager researches *what it means*. Feed catalog output to the Knowledge Manager for gap analysis. |
| **Fleet Dashboard** | The Cataloger can POST run summaries to the Fleet Dashboard for observability. |
| **QA & Risk Manager** | Catalog anomalies (public files, external sharing) feed into risk assessments. |

## Key Design Decisions

1. **Read-only by design.** The agent never modifies Drive contents. Cleanup actions (deletion, permission changes) are human decisions informed by catalog data.
2. **Metadata-first.** File content is never read unless the user explicitly requests content-based classification, minimizing API usage and respecting privacy.
3. **Scoped execution.** Every catalog run requires an explicit scope (folder, Shared Drive, or query filter). Unbounded full-Drive scans are prohibited.
4. **Staleness tiers.** Four configurable tiers (active / aging / stale / dormant) based on modification and view timestamps provide a shared vocabulary for governance conversations.

## Output Destinations

| Format | Use Case |
|--------|----------|
| **Google Sheet** (default) | Interactive exploration, filtering, sharing with stakeholders |
| **JSON** | Programmatic consumption, diff tooling, pipeline input |
| **Markdown** | Embedding in reports or documentation |

## Example Workflows

### Quarterly Drive Audit
1. Scope: entire Marketing Shared Drive, recursive
2. Run catalog → Google Sheet
3. Filter for `dormant` files → share with Marketing lead for cleanup decisions
4. Run diff against previous quarter's catalog → identify permission drift

### Pre-Compliance Check
1. Scope: all Shared Drives, filter `sharing = public`
2. Run catalog → JSON
3. Feed anomaly list to QA & Risk Manager for assessment
4. Generate report for compliance team

## Spec File
`agents/operations/drive-cataloger.md`
