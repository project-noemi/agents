# MCP Protocol: logging-mcp

## Overview
The `logging-mcp` is a specialized Model Context Protocol (MCP) definition that abstracts the retrieval of agent execution logs. It provides a unified interface for agents like the **ROI Auditor** to ingest structured logs regardless of whether the underlying infrastructure uses Loki/Grafana or n8n webhooks.

## Capabilities
- **Query Logs:** Retrieve historical execution logs based on agent persona, task ID, or timestamp.
- **Listen for Events:** Subscribe to real-time log emissions for event-driven workflows.
- **Schema Normalization:** Transform varied backend log formats into a standardized JSON audit shape.

## Dual-Backend Support

### 1. Loki/Grafana (Structured Log Queries)
- **Use Case:** High-volume, historical analysis of fleet-wide metrics.
- **Integration:** Connects via the Grafana Loki API using LogQL to filter for `agent_persona` and `task_status`.

### 2. n8n Webhooks (Event-Driven Ingestion)
- **Use Case:** Real-time triggering of follow-up actions or ROI calculation upon task completion.
- **Integration:** Receives POST requests containing task completion payloads.

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

## Security & Compliance
- **Fetch-on-Demand:** Access credentials for Loki or n8n endpoints must be injected via SecretOps (`infisical` or `op`).
- **PII Protection:** The protocol implementation must ensure all logs are scrubbed of PII before they are exposed to the `Query Logs` capability.
