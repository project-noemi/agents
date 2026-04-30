# MCP Protocol: logging-mcp

## Overview
The `logging-mcp` is a specialized Model Context Protocol (MCP) definition that abstracts the retrieval of agent execution logs. It provides a unified interface for agents like the **ROI Auditor** to ingest structured logs regardless of whether the underlying infrastructure uses Loki/Grafana or n8n webhooks.

## Capabilities
- **Query Logs:** Retrieve historical execution logs based on agent persona, task ID, or timestamp.
- **Listen for Events:** Subscribe to real-time log emissions for event-driven workflows.
- **Schema Normalization:** Transform varied backend log formats into a standardized JSON audit shape.

## Multi-Backend Support

### 1. Loki/Grafana (Structured Log Queries)
- **Use Case:** High-volume, historical analysis of fleet-wide metrics.
- **Integration:** Connects via the Grafana Loki API using LogQL to filter for `agent_persona` and `task_status`.

### 2. n8n Webhooks (Event-Driven Ingestion)
- **Use Case:** Real-time triggering of follow-up actions or ROI calculation upon task completion.
- **Integration:** Receives POST requests containing task completion payloads.

### 3. InfluxDB (Time-Series Aggregation)
- **Use Case:** Numeric aggregation, retention policy enforcement, and dashboard queries for the Fleet Dashboard reference deployment (`examples/gatekeeper-deployment/`).
- **Integration:** Writes via the InfluxDB v2 line-protocol endpoint (`POST /api/v2/write`); queries via Flux. The `dashboard-ingest` service is the reference adapter that converts a signed JSON report into a `cycle_report` measurement.
- **Notes:** InfluxDB stores numeric counters and tags; the full structured Audit Log (see "Audit Log Embedding" below) should still be persisted in Loki or n8n for textual search.

## Standardized Log Shape
To ensure interoperability, the protocol enforces a minimum log shape compatible with the project-wide `Audit Log` mandate:

```json
{
  "timestamp": "ISO-8601",
  "agent": "persona-slug",
  "task": "task-slug",
  "status": "success | failure",
  "duration_ms": 1234,
  "metadata": {
    "labor_savings_category": "standard | complex",
    "pii_scrubbed": true
  }
}
```

## Audit Log Embedding

The project-wide `Audit Log` (see `AGENTS.md` and `REQUIREMENTS.md` Section 2) and the `logging-mcp` standardized log shape are **complementary, not redundant**:

- The `logging-mcp` envelope carries observability metadata (`timestamp`, `agent`, `task`, `status`, `duration_ms`).
- The Audit Log JSON `{ "task", "inputs", "actions", "risks", "result" }` is embedded as `metadata.audit_log` on `status: "success"` events.
- For `status: "failure"` events, `metadata.error` carries the failure reason and `metadata.audit_log` is optional.

```json
{
  "timestamp": "2026-04-30T12:00:00Z",
  "agent": "gatekeeper",
  "task": "pr-triage",
  "status": "success",
  "duration_ms": 1842,
  "metadata": {
    "labor_savings_category": "standard",
    "pii_scrubbed": true,
    "audit_log": {
      "task": "pr-triage",
      "inputs": ["pr#1234"],
      "actions": ["scanned", "labeled"],
      "risks": [],
      "result": "auto_merged"
    }
  }
}
```

This keeps the technical observability envelope and the auditable persona record in a single payload while allowing each backend to project the field it cares about.

## Security & Compliance
- **Fetch-on-Demand:** Access credentials for Loki or n8n endpoints must be injected via SecretOps (`infisical` or `op`).
- **PII Protection:** The protocol implementation must ensure all logs are scrubbed of PII before they are exposed to the `Query Logs` capability.
