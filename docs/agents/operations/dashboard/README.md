# Fleet Dashboard — Setup & Operations Guide

## Overview

The Fleet Dashboard is a centralized reporting hub for all NoéMI agents. It provides a single pane of glass to monitor agent activity, review triage reports, track health, and receive anomaly alerts.

Any NoéMI agent that produces structured output (Gatekeeper, Sentinel, QA & Risk Manager, etc.) can POST reports to the dashboard for aggregation and visualization.

---

## Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Gatekeeper   │  │ Sentinel    │  │ QA & Risk   │   ... more agents
│ Agent        │  │ Agent       │  │ Manager     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────────────────────────────────────┐
│              Fleet Dashboard API              │
│         POST /api/v1/reports                  │
├──────────────────────────────────────────────┤
│              Time-Series Store                │
│    (InfluxDB / TimescaleDB / SQLite)         │
├──────────────────────────────────────────────┤
│              Dashboard UI                     │
│    (Grafana / Custom Next.js / Astro)        │
├──────────────────────────────────────────────┤
│              Alert Engine                     │
│    (Missed cycles, error spikes, anomalies)  │
└──────────────┬───────────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ Slack Alerts  │
        └──────────────┘
```

---

## Deployment

### Option A: Grafana Stack (Recommended for Existing Infra)

If you already run Grafana (e.g., from the fleet-deployment example), add a dashboard data source.

**1. Configure InfluxDB for agent reports:**

```bash
# Create a database for agent reports
influx -execute "CREATE DATABASE noemi_agents"
influx -execute "CREATE RETENTION POLICY ninety_days ON noemi_agents DURATION 90d REPLICATION 1 DEFAULT"
```

**2. Import the Grafana dashboard:**

Import the dashboard JSON from `examples/gatekeeper-deployment/grafana-dashboard.json` via Grafana UI → Dashboards → Import.

**3. Agent configuration:**

Each agent needs these environment variables to report:

```bash
DASHBOARD_API_URL=http://influxdb.noemi.local:8086/write?db=noemi_agents
DASHBOARD_AUTH_TOKEN=op://Vault/Dashboard Token/credential
```

### Option B: Docker Compose (Standalone)

Deploy the full dashboard stack from scratch.

See `examples/gatekeeper-deployment/docker-compose.yml` which includes:

- **InfluxDB** — time-series storage for agent reports
- **Grafana** — dashboard UI with pre-configured panels
- **Alert webhook relay** — forwards anomaly alerts to Slack

```bash
# Start the dashboard stack
op run --env-file=.env.template -- \
  docker compose -f examples/gatekeeper-deployment/docker-compose.yml up -d

# Access Grafana
open http://localhost:3000
# Default credentials: admin / (from GF_ADMIN_PASSWORD in vault)
```

### Option C: SQLite + Lightweight UI (Minimal)

For small deployments or local development:

```bash
# The dashboard API can use SQLite as a backend
DASHBOARD_STORE=sqlite
DASHBOARD_SQLITE_PATH=~/.noemi/dashboard.db
```

Pair with a simple Astro or static page that reads from the SQLite DB and renders the views described in the agent spec.

---

## Report Ingestion API

### POST /api/v1/reports

Agents submit reports after each triage cycle.

**Request:**

```json
{
  "agent_id": "gatekeeper",
  "agent_version": "1.0.0",
  "cycle_timestamp": "2026-03-17T12:00:00Z",
  "org": "my-org",
  "summary": {
    "total_evaluated": 42,
    "actions": {
      "auto_merged": 12,
      "flagged_for_review": 8,
      "closed_stale_conflict": 3,
      "skipped": 2,
      "errors": 1
    }
  },
  "details": [
    {
      "repo": "my-org/frontend",
      "pr_number": 123,
      "pr_url": "https://github.com/my-org/frontend/pull/123",
      "title": "Update deps",
      "classification": "safe",
      "action_taken": "merged",
      "reasoning": "All CI green, 12 lines changed, lockfile only, org member",
      "merge_sha": "abc123f"
    }
  ],
  "duration_seconds": 47
}
```

**Response:**

```json
{
  "status": "accepted",
  "report_id": "rpt_abc123",
  "timestamp": "2026-03-17T12:00:01Z"
}
```

### GET /api/v1/agents

List all registered agents and their current health.

**Response:**

```json
{
  "agents": [
    {
      "agent_id": "gatekeeper",
      "last_seen": "2026-03-17T12:00:00Z",
      "expected_interval_hours": 4,
      "status": "healthy",
      "last_cycle_summary": {
        "total_evaluated": 42,
        "errors": 1
      }
    },
    {
      "agent_id": "sentinel",
      "last_seen": "2026-03-17T06:00:00Z",
      "expected_interval_hours": 24,
      "status": "healthy",
      "last_cycle_summary": {
        "total_evaluated": 5,
        "errors": 0
      }
    }
  ]
}
```

### GET /api/v1/digest?period=daily

Returns an aggregated summary across all agents.

---

## Dashboard Views

### 1. Overview (Home)

| Column | Description |
|--------|-------------|
| Agent Name | Identifier (e.g., Gatekeeper, Sentinel) |
| Status | `healthy` / `warning` / `failed` / `stale` |
| Last Cycle | Timestamp of most recent report |
| Actions | Summary counts for the last cycle |
| Trend | Sparkline of action counts over 7 days |

### 2. Agent Detail

Drill into a specific agent to see:

- **Timeline:** Bar chart of actions per cycle over the last 30 days.
- **Success rate:** Percentage of cycles with 0 errors.
- **Action breakdown:** Pie chart of classification distribution.
- **Recent actions:** Table of the last 50 individual actions with links to PRs/issues.

### 3. Action Log

A filterable, searchable table across all agents:

| Column | Filterable |
|--------|-----------|
| Timestamp | Date range picker |
| Agent | Dropdown |
| Repo | Text search |
| PR/Issue | Number search |
| Classification | Dropdown |
| Action | Dropdown |
| Reasoning | Full-text search |

### 4. Anomaly Alerts

| Alert Type | Trigger | Notification |
|-----------|---------|-------------|
| Missed cycle | No report in 1.5× expected interval | Slack + Dashboard banner |
| Error spike | Errors > 20% of cycle actions | Slack + Dashboard banner |
| Volume anomaly | Count deviates > 2σ from 7-day mean | Dashboard banner |

---

## Configuring Agent Registration

Each agent must be registered so the dashboard knows its expected reporting interval. Add to the dashboard config:

```yaml
# dashboard-config.yml
agents:
  gatekeeper:
    display_name: "Gatekeeper"
    domain: "engineering"
    expected_interval_hours: 4
    slack_alert_channel: "#ops-alerts"

  sentinel:
    display_name: "Sentinel"
    domain: "coding"
    expected_interval_hours: 24
    slack_alert_channel: "#security-alerts"

  qa-risk-manager:
    display_name: "QA & Risk Manager"
    domain: "operations"
    expected_interval_hours: 12
    slack_alert_channel: "#ops-alerts"
```

---

## Adding a New Agent to the Dashboard

1. **Add the report POST call** to the agent's workflow (step 4 / REPORT phase).
2. **Register the agent** in `dashboard-config.yml` with its expected interval.
3. **Define the report schema** — use the standard envelope (`agent_id`, `cycle_timestamp`, `summary`, `details`) with agent-specific `details` entries.
4. **Test ingestion** by sending a sample report via curl:

```bash
curl -X POST http://dashboard.noemi.local/api/v1/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DASHBOARD_AUTH_TOKEN" \
  -d '{
    "agent_id": "my-new-agent",
    "agent_version": "0.1.0",
    "cycle_timestamp": "'$(date -u +%FT%TZ)'",
    "org": "my-org",
    "summary": {"total_evaluated": 1, "actions": {"tested": 1}},
    "details": [],
    "duration_seconds": 5
  }'
```

5. **Verify** the agent appears in the Overview with `healthy` status.

---

## Security & Authentication

### Three-Layer Trust Model

The dashboard uses a defense-in-depth approach to ensure reports are authentic and truthful:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Transport Security (TLS)                        │
│   Encrypts data in transit, prevents eavesdropping       │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Agent Identity (Bearer Token + HMAC Signature)  │
│   Proves who sent the report and that it wasn't tampered │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Data Verification (GitHub API Cross-Reference)  │
│   Independently confirms that claimed actions happened   │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: Transport Security

- All external endpoints require HTTPS. Plaintext HTTP is rejected with `301`.
- Internal (Docker network) traffic uses the `gatekeeper-net` bridge. For production, enable mTLS between containers.

### Layer 2: Agent Identity — Bearer Tokens + HMAC Signing

Each agent has **two secrets** stored separately in the vault:

| Secret | Purpose | Vault Path |
|--------|---------|------------|
| Bearer token | Identifies the agent, authorizes the request | `op://Vault/{AgentID}/bearer-token` |
| HMAC secret | Signs the payload, proves integrity | `op://Vault/{AgentID}/hmac-secret` |

**Why two secrets?** If the Bearer token leaks (e.g., in a log), the attacker still cannot forge reports without the HMAC secret. The two are stored in different vault entries and rotated independently.

**How agents sign reports:**

```bash
# The agent computes this before POSTing:
BODY='{"agent_id":"gatekeeper","cycle_timestamp":"2026-03-17T12:00:00Z",...}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | awk '{print $2}')

curl -X POST "$DASHBOARD_API_URL/api/v1/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DASHBOARD_AUTH_TOKEN" \
  -H "X-Signature-256: sha256=$SIGNATURE" \
  -d "$BODY"
```

**How the dashboard verifies:**

1. Extract `agent_id` from the Bearer token lookup.
2. Retrieve the agent's HMAC secret from the registry.
3. Compute `HMAC-SHA256(secret, raw_request_body)`.
4. Compare against `X-Signature-256` using constant-time comparison.
5. Reject with `401` if signature is missing or doesn't match.

**Setting up agent secrets:**

```bash
# Generate secrets for a new agent
BEARER=$(openssl rand -hex 32)
HMAC_KEY=$(openssl rand -hex 32)

# Store in 1Password
op item create --category=login --title="Gatekeeper Bearer Token" \
  --field="credential=$BEARER"
op item create --category=login --title="Gatekeeper HMAC Secret" \
  --field="credential=$HMAC_KEY"

# Register in dashboard-config.yml
# agents:
#   gatekeeper:
#     bearer_token_ref: op://Vault/Gatekeeper Bearer Token/credential
#     hmac_secret_ref: op://Vault/Gatekeeper HMAC Secret/credential
```

### Layer 3: Data Verification — Cross-Referencing Claims

Even with valid identity and signing, the dashboard does not blindly trust report contents. After ingestion, a background verifier cross-references mutating claims against the GitHub API:

| Claim | Verification |
|-------|-------------|
| "Merged PR #123" | `gh api /repos/{repo}/pulls/123` → `merged == true`, SHA matches |
| "Closed PR #456" | `gh api /repos/{repo}/pulls/456` → `state == "closed"` |
| "Added label" | `gh api /repos/{repo}/issues/{n}/labels` → label present |
| "Deleted branch" | `gh api /repos/{repo}/branches/{branch}` → returns 404 |
| "Posted comment" | `gh api /repos/{repo}/issues/{n}/comments` → comment by agent user exists |

Each detail record gets a verification status:

| Status | Badge | Meaning |
|--------|-------|---------|
| `pending` | ⏳ | Not yet checked (within 5 min of ingestion) |
| `verified` | ✅ | GitHub API confirms the claim |
| `mismatch` | ❌ | GitHub API contradicts the claim |
| `unverifiable` | ➖ | No external source to check (e.g., "skipped") |

**On mismatch:** The dashboard raises an anomaly alert, sets the agent to `warning` status, and logs the expected vs. actual values for investigation.

### Token Rotation

- Rotate Bearer tokens and HMAC secrets every 90 days.
- The dashboard supports **two active credentials per agent** during rotation (old + new).
- Rotation procedure:
  1. Generate new secrets and store in vault.
  2. Update `dashboard-config.yml` to list both old and new.
  3. Restart/redeploy the agent with the new secrets.
  4. After confirming the agent reports successfully, remove the old secrets from the config.

### Additional Security Controls

- Dashboard UI access uses the same org-level SSO/auth as Grafana.
- No raw secrets or tokens are stored in the dashboard — only report data and verification results.
- API rate limiting: 60 requests/minute per agent, 10 requests/minute per dashboard reader.
- All authentication failures are logged with source IP, agent ID attempted, and timestamp.
