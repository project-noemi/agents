# Project NoéMI — Agents Library

Project NoéMI is an **agent specification library**. It defines AI agent personas, MCP (Model Context Protocol) integrations, and governance frameworks as Markdown files. It is **not** a runtime or execution engine — external orchestrators like [Gemini CLI](https://github.com/google-gemini/gemini-cli), [n8n](https://n8n.io/), or [LangChain](https://www.langchain.com/) consume these specifications to execute tasks.

## Table of Contents

- [Quick Start](#quick-start)
- [What This Repository Contains](#what-this-repository-contains)
- [Repository Structure](#repository-structure)
- [Agents](#agents)
- [MCP Protocols](#mcp-protocols)
- [How It Works](#how-it-works)
- [Deploying the Examples](#deploying-the-examples)
- [Documentation Guide](#documentation-guide)
- [Security Model](#security-model)
- [Adding or Modifying Agents](#adding-or-modifying-agents)
- [Governance](#governance)
- [Commit Standards](#commit-standards)

---

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) (v18+), [Docker](https://www.docker.com/), and a secret manager ([Infisical CLI](https://infisical.com/docs/cli/overview) or [1Password CLI](https://developer.1password.com/docs/cli/))

```bash
# 1. Clone the repository
git clone https://github.com/newpush/agents.git
cd agents

# 2. Verify your environment has the required tools
bash scripts/verify-env.sh

# 3. Configure which MCP integrations are active (edit as needed)
cat mcp.config.json

# 4. Generate context files consumed by orchestrators
node scripts/generate_gemini.js   # For Gemini CLI / LangChain
node scripts/generate_claude.js   # For Claude Code

# 5. Use the generated context with your orchestrator
# Example with Gemini CLI:
infisical run --env=dev -- gemini -p GEMINI.md "List all open PRs in our org"
# Claude Code reads CLAUDE.md automatically when opened in this repository
```

The generated `GEMINI.md` and `CLAUDE.md` files contain your agent personas, security mandates, and MCP protocol definitions — everything an orchestrator needs to act as your agents.

---

## What This Repository Contains

| What | Where | Purpose |
|------|-------|---------|
| Agent specifications | `agents/` | Markdown definitions of AI agent personas across 8 domains |
| Skill definitions | `skills/` | Reusable task recipes that agents compose into their workflows |
| MCP protocol definitions | `mcp-protocols/` | Behavioral rules for 16 tool integrations (Google Workspace, Slack, GitHub, n8n, etc.) |
| Deployment examples | `examples/` | Docker Compose stacks, workflow templates, and testing suites |
| Documentation | `docs/` | Framework docs, setup guides, agent-specific documentation |
| Build scripts | `scripts/` | Context generation (`generate_gemini.js`, `generate_claude.js`) and environment verification |
| ROI tools | `tools/roi/` | Methodology for calculating agent return on investment |
| Presentations | `presentations/` | Slidev-based presentation decks for stakeholders |

---

## Repository Structure

```
.
├── agents/                          # Agent specifications (source of truth)
│   ├── coding/                      # Bolt (performance), Sentinel (security)
│   ├── communication/               # Postman (email handling)
│   ├── engineering/                  # AI Architect, Gatekeeper (PR triage)
│   ├── guardian/                     # PII Guard, Prompt Shield, ROI Auditor
│   ├── infrastructure/              # cPanel, Linux system administration
│   ├── marketing/                   # Brand, SEO, Thumbnails, Video Content
│   ├── operations/                  # Fleet Dashboard, Knowledge Manager, QA
│   └── product/                     # Documentation specialist
│
├── skills/                          # Reusable task definitions (skills layer)
│   ├── SKILL_TEMPLATE.md            # Canonical template for new skills
│   ├── classification/              # Risk triage, multi-tier categorization
│   ├── verification/                # Pre-flight checks, cross-referencing
│   ├── reporting/                   # Structured reports, alert delivery
│   ├── security/                    # HMAC signing, PII scanning
│   └── orchestration/               # Sub-agent dispatch and coordination
│
├── mcp-protocols/                   # MCP behavioral rules (one file per tool)
│   ├── gmail.md, slack.md, n8n.md, github.md, web-search.md
│   └── google-*.md                  # Full Google Workspace suite (11 protocols)
│
├── docs/                            # All documentation
│   ├── AGENT_TEMPLATE.md            # Canonical template for new agents
│   ├── METHODOLOGY.md               # 4D Framework (Delegation, Description, ...)
│   ├── GOVERNANCE.md                # AI TRiSM and Red Teaming protocols
│   ├── REQUIREMENTS.md              # Project requirements and drift tracking
│   ├── agents/                      # Per-agent documentation (mirrors agents/)
│   ├── examples/                    # Deployment guides (MSP, RFP responder, etc.)
│   ├── mcp-setup/                   # MCP infrastructure setup guides
│   ├── lifecycle/                   # 4D Framework lifecycle documentation
│   └── frameworks/                  # Gartner TRiSM reference
│
├── examples/                        # Deployable examples
│   ├── docker/                      # Docker sandbox with pgvector memory
│   ├── fleet-deployment/            # Multi-tenant stack (Traefik + n8n + Grafana)
│   ├── gatekeeper-deployment/       # PR triage agent + Fleet Dashboard
│   ├── red-team-gauntlet/           # Adversarial testing suite
│   ├── secure-secret-management/    # Fetch-on-Demand pattern demo
│   ├── video-automation-pod/        # YouTube packaging automation
│   ├── gmu-validation/              # Academic verification bot
│   ├── rfp-split/                   # RFP document processing samples
│   └── workflows/                   # n8n workflow JSON templates
│
├── scripts/
│   ├── generate_gemini.js           # Builds GEMINI.md from template + MCPs
│   ├── generate_claude.js           # Builds CLAUDE.md from template + MCPs + agent index
│   └── verify-env.sh               # Checks prerequisites (Docker, CLI tools)
│
├── mcp.config.json                  # Declares which MCPs are active
├── GEMINI.template.md               # Base template for Gemini context generation
├── CLAUDE.template.md               # Base template for Claude Code context generation
├── AGENTS.md                        # Global security mandates and directives
├── GEMINI.md                        # Generated output for Gemini (do not edit directly)
├── CLAUDE.md                        # Generated output for Claude Code (do not edit directly)
└── .env.template                    # Environment variable reference
```

**Key rule:** The `docs/agents/` directory mirrors the `agents/` directory. If an agent spec exists at `agents/infrastructure/linux.md`, its documentation lives at `docs/agents/infrastructure/linux/`.

---

## Agents

The library includes **20 agent specifications** organized into 8 domains. Each agent is a Markdown file that defines a persona an orchestrator can adopt.

| Domain | Agents | Purpose |
|--------|--------|---------|
| **Coding** | Bolt (core, Next.js 16), Sentinel | Performance optimization, security auditing |
| **Communication** | Postman | Email drafting, tone management, routing |
| **Engineering** | AI Architect, Gatekeeper | System design, automated PR triage |
| **Guardian** | PII Guard, Prompt Shield, ROI Auditor | Data protection, prompt injection defense, value tracking |
| **Infrastructure** | cPanel, Linux | Server administration via API and CLI |
| **Marketing** | Brand Strategist, SEO Strategist, Thumbnail Specialist, Video Content Manager | Brand compliance, YouTube optimization, visual design, content orchestration |
| **Operations** | Fleet Dashboard, Knowledge Manager, Multimodal Specialist, QA & Risk Manager | Observability, research, media processing, quality assurance |
| **Product** | Doc | Technical documentation |

Every agent spec follows the canonical template defined in [`docs/AGENT_TEMPLATE.md`](docs/AGENT_TEMPLATE.md) with required sections: **Role**, **Tone**, **Capabilities**, **Rules & Constraints**, and **Boundaries** (Always / Ask First / Never).

---

## Skills

Skills are **reusable task recipes** that agents compose into their workflows. They sit between agents (who) and MCP protocols (how) in the architecture:

```
Agents (who)  →  compose  →  Skills (what)  →  use  →  MCP Protocols (how)
                                    ↑
                              Policies (why) govern everything
```

| Category | Skills | Purpose |
|----------|--------|---------|
| **Classification** | Risk Triage | Multi-tier categorization (Safe / Needs Review / Blocked) |
| **Verification** | Pre-Flight Check, Cross-Reference | Validate preconditions; verify claims against source of truth |
| **Reporting** | Structured Report, Alert & Notify | Standardized report generation; Slack/email delivery |
| **Security** | HMAC Sign & Submit, PII Scan | Cryptographic payload signing; data privacy scanning |
| **Orchestration** | Dispatch & Coordinate | Sub-agent delegation and output aggregation |

Agents reference skills in their Workflow sections using the `**Skill:**` syntax:

```markdown
### 2. CLASSIFY
**Skill:** `classification/risk-triage` — Classify each PR as Safe, Needs Review, or Stale Conflict
```

The skill template is at [`skills/SKILL_TEMPLATE.md`](skills/SKILL_TEMPLATE.md). Skills are declared in `mcp.config.json` under `active_skills` and injected into the generated context files alongside MCP protocols.

---

## MCP Protocols

MCP (Model Context Protocol) protocols define **how agents interact with external tools**. Each protocol file in `mcp-protocols/` contains behavioral rules, validation steps, and error handling guidance.

**16 protocols available:**

| Category | Protocols |
|----------|-----------|
| **Google Workspace** | Docs, Sheets, Slides, Drive, Calendar, Meet, Chat, Keep, Forms, Contacts, Admin |
| **Communication** | Gmail, Slack |
| **Automation** | n8n |
| **Development** | GitHub |
| **Research** | Web Search |

The file `mcp.config.json` controls which protocols are active. Only active protocols are injected into the generated `GEMINI.md` and `CLAUDE.md`.

For setup instructions, see [`docs/mcp-setup/`](docs/mcp-setup/).

---

## How It Works

### Context Generation Pipeline

The core build step combines your agent specs and MCP protocols into context files that orchestrators consume. Two parallel pipelines exist — one for Gemini CLI and one for Claude Code:

```
{GEMINI,CLAUDE}.template.md + mcp.config.json + AGENTS.md
         │                          │               │
         │              ┌───────────┘               │
         ▼              ▼                           ▼
  scripts/generate_{gemini,claude}.js ──> {GEMINI,CLAUDE}.md
```

Both scripts follow the same steps:

1. Read the base template (`GEMINI.template.md` or `CLAUDE.template.md`)
2. Read `mcp.config.json` to determine which MCP integrations are active
3. For each active MCP, inject the protocol definition from `mcp-protocols/`
4. Extract global security mandates from `AGENTS.md`
5. Write the final context file

**`generate_claude.js` additionally:**
- Auto-discovers all agent specs in `agents/` and builds an indexed table (domain, title, file path)
- Injects the agent index into `CLAUDE.md` so Claude Code has a complete reference at conversation start

```bash
# Regenerate after changing MCP config, protocol files, or adding agents
node scripts/generate_gemini.js    # For Gemini CLI / LangChain
node scripts/generate_claude.js    # For Claude Code
```

### Using with Orchestrators

**Claude Code** (reads CLAUDE.md automatically):
Open this repository in Claude Code. It reads `CLAUDE.md` as project instructions at the start of every conversation — no manual setup required. The file includes the agent index, security mandates, and all active MCP protocols.

**Gemini CLI** (direct agent interaction):
```bash
infisical run --env=dev -- gemini -p GEMINI.md "Analyze the server logs on web01"
```

**n8n** (automated workflows):
Import workflow templates from `examples/workflows/` into your n8n instance. The workflows reference agent personas and MCP integrations defined in this repository.

**LangChain / Custom** (programmatic):
Read `GEMINI.md`, `CLAUDE.md`, or individual agent specs from `agents/` as system prompts in your LLM application.

---

## Deploying the Examples

All examples use the **Fetch-on-Demand** security model: secrets are injected at runtime via vault CLI wrappers (`infisical run` or `op run`), never hardcoded. See [Security Model](#security-model) for details.

### 1. Docker Sandbox (Beginner Start Here)

A minimal environment with a PostgreSQL + pgvector memory layer and a Python runtime container. Good for experimenting with agent code locally.

**Location:** `examples/docker/`

```bash
cd examples/docker

# Create a .env file with your credentials (use .env.template as reference)
cp ../../.env.template .env
# Edit .env to add your POSTGRES_PASSWORD and API keys

# Start the stack
docker compose up -d

# Enter the runtime container
docker exec -it noemi-agent-runtime bash

# Run your agent code
python agent.py
```

**What you get:**
- `agent-memory` — PostgreSQL with pgvector for embedding storage
- `agent-runtime` — Python 3.12 container with your code mounted at `/app`

---

### 2. Fleet Deployment (Multi-Tenant Infrastructure)

A production-oriented stack simulating parallel environments with shared ingress and observability. Designed for running multiple isolated orchestrator instances (e.g., boot camp cohorts or MSP client tenants).

**Location:** `examples/fleet-deployment/`

```bash
cd examples/fleet-deployment

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — set passwords for: GF_ADMIN_PASSWORD, CASDOOR_DB_PASSWORD,
#   COHORT01_DB_PASSWORD, COHORT02_DB_PASSWORD

# Start the full stack
op run --env-file=.env -- docker compose up -d
# Or with Infisical:
infisical run --env=dev -- docker compose up -d
```

**What you get:**

| Service | URL | Purpose |
|---------|-----|---------|
| Traefik | `http://localhost:8080` | Reverse proxy and dashboard |
| Casdoor | `http://localhost:8000` | Identity provider (SSO) |
| Grafana | `http://localhost:3000` | Centralized log dashboard |
| Loki | `http://localhost:3100` | Log aggregation backend |
| n8n (Cohort 01) | `http://cohort01.noemi.local` | Isolated orchestrator instance |
| n8n (Cohort 02) | `http://cohort02.noemi.local` | Isolated orchestrator instance |

**Note:** Add `cohort01.noemi.local`, `cohort02.noemi.local`, `auth.noemi.local`, and `audit.noemi.local` to your `/etc/hosts` file pointing to `127.0.0.1` for local development.

---

### 3. Gatekeeper Deployment (PR Triage + Fleet Dashboard)

Deploys the Gatekeeper agent for automated GitHub PR triage, with InfluxDB for report storage, Grafana for visualization, and a Slack alert relay.

**Location:** `examples/gatekeeper-deployment/`

```bash
cd examples/gatekeeper-deployment

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — required:
#   GH_TOKEN          — GitHub token with repo, read:org scopes
#   GATEKEEPER_ORG    — Your GitHub organization name
#   SLACK_WEBHOOK_URL — Slack incoming webhook for notifications
#   INFLUXDB_PASSWORD, INFLUXDB_ADMIN_TOKEN, GF_ADMIN_PASSWORD

# Build and start
op run --env-file=.env -- docker compose up -d --build
```

**What you get:**

| Service | URL | Purpose |
|---------|-----|---------|
| InfluxDB | `http://localhost:8086` | Time-series store for triage reports |
| Grafana | `http://localhost:3000` | Fleet Dashboard visualization |
| Gatekeeper | (runs on schedule) | Scans PRs every 4 hours (configurable) |
| Alert Relay | (background) | Posts Slack alerts when agents go stale |

**Configuration options** (set in `.env`):
- `GATEKEEPER_REPOS` — Comma-separated repo allowlist (empty = scan all)
- `GATEKEEPER_DRY_RUN=true` — Set to `false` to enable actual merges/closes
- `GATEKEEPER_INTERVAL_HOURS=4` — Triage cycle frequency

---

### 4. Red Team Gauntlet (Security Testing)

A set of adversarial test cases for validating Guardian agents (PII Guard and Prompt Shield). No infrastructure required — these are test vectors you pass to your agents.

**Location:** `examples/red-team-gauntlet/`

```bash
# No deployment needed. Open the README for test cases:
cat examples/red-team-gauntlet/README.md
```

**What it tests:**
- **Prompt injection** — Direct override, roleplay-based bypass, invisible prompting
- **PII leaks** — SSN/credit card redaction, credential exfiltration blocking

Pass each test case to your Guardian agent. A correctly functioning agent will return `{ "status": "BLOCKED" }` for injection attempts and redacted output for PII leaks.

---

### 5. Video Automation Pod (YouTube Packaging)

Automates the video content lifecycle: transcription, title/thumbnail generation, and SEO optimization using the marketing agent team.

**Location:** `examples/video-automation-pod/`

```bash
cd examples/video-automation-pod

# Install Python dependencies
pip install -r requirements.txt

# Run the pod with your video files
python manager.py \
  --project "MyVideo" \
  --rough_cut rough_assembly.mp4 \
  --pose_clip pose_video.mp4
```

**What it does:**
1. Transcribes your rough assembly to extract the core message
2. Generates 3+ curiosity-driven titles and thumbnail hooks
3. Scans the pose clip for the most expressive frames
4. Composites 15+ thumbnail variations with your brand assets

**Prerequisites:** Python 3.12+, FFmpeg, OpenAI API key (for transcription)

---

### 6. Secure Secret Management (Pattern Demo)

Demonstrates the Fetch-on-Demand architecture — how agents should read credentials from the environment rather than from files or hardcoded values.

**Location:** `examples/secure-secret-management/`

```bash
# Install Infisical CLI (if not already installed)
bash examples/secure-secret-management/setup.sh

# Run agent code with secrets injected
infisical run --env=dev -- python examples/secure-secret-management/agent_logic.py
```

**Key principle:** Agent code uses `os.getenv("DATABASE_URL")` — never `dotenv.load()` or hardcoded strings. The vault CLI wrapper injects secrets into the process environment at launch time.

---

### 7. n8n Workflow Templates

Pre-built n8n workflow JSON files you can import into any n8n instance.

**Location:** `examples/workflows/`

| Workflow | File | Purpose |
|----------|------|---------|
| RFP Auto-Responder | `rfp-responder.json` | Watches Gmail for RFPs, analyzes with Gemini, creates Google Doc drafts |
| ROI Tracking Pipeline | `roi-tracking-pipeline.json` | Collects agent execution metrics and writes to Google Sheets |
| Video Automation Pod | `video-automation-pod.json` | Orchestrates the video packaging workflow via n8n |

**To import:**
1. Open your n8n instance
2. Go to **Workflows > Import from File**
3. Select the `.json` file
4. Configure credentials (Gmail, Google Docs, Gemini API) in the n8n credential manager

---

### 8. GMU Validation Bot

A verification bot for academic credentialing validation, used in the George Mason University partnership.

**Location:** `examples/gmu-validation/`

```bash
node examples/gmu-validation/verification-bot.js
```

---

## Documentation Guide

All documentation lives in `docs/`. Here's where to find what:

| Looking for... | Go to |
|----------------|-------|
| How to create a new agent | [`docs/AGENT_TEMPLATE.md`](docs/AGENT_TEMPLATE.md) |
| The 4D Framework methodology | [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) |
| Governance and compliance | [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) |
| Project requirements | [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) |
| Design decisions and rationale | [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) |
| Open questions and clarifications | [`docs/CLARIFICATIONS.md`](docs/CLARIFICATIONS.md) |
| MCP setup guides | [`docs/mcp-setup/`](docs/mcp-setup/) |
| 4D lifecycle deep-dives | [`docs/lifecycle/`](docs/lifecycle/) |
| Per-agent documentation | [`docs/agents/`](docs/agents/) (mirrors `agents/` structure) |
| Deployment examples and guides | [`docs/examples/`](docs/examples/) |
| MSP deployment guide | [`docs/examples/msp-deployment.md`](docs/examples/msp-deployment.md) |
| Gartner TRiSM framework reference | [`docs/frameworks/gartner-trism.md`](docs/frameworks/gartner-trism.md) |

---

## Security Model

Project NoéMI enforces a **Fetch-on-Demand** architecture for all secrets:

1. **Never hardcode credentials** — not in agent specs, not in scripts, not in config files
2. **Store secrets in vaults** — [Infisical](https://infisical.com/) or [1Password](https://1password.com/)
3. **Inject at runtime** — Use CLI wrappers to pass secrets into the process environment:

```bash
# Using Infisical
infisical run --env=dev -- [your command]

# Using 1Password
op run --env-file=.env.template -- [your command]
```

4. **Read from environment** — Agent code accesses credentials via `process.env` or `os.getenv()`, never by parsing `.env` files

The `.env.template` file at the repository root documents all required environment variables without containing actual values.

See [`docs/tool-usages/secure-secret-management.md`](docs/tool-usages/secure-secret-management.md) for the full guide and [`examples/secure-secret-management/`](examples/secure-secret-management/) for a working demo.

---

## Adding or Modifying Agents

1. **Start from the template:** Copy [`docs/AGENT_TEMPLATE.md`](docs/AGENT_TEMPLATE.md)
2. **Place the spec** in `agents/{domain}/{name}.md`
3. **Create matching docs** at `docs/agents/{domain}/{name}/`
4. **If the agent uses MCP tools**, ensure referenced protocols exist in `mcp-protocols/`
5. **Run the Red Team Gauntlet** (`examples/red-team-gauntlet/`) against your new agent before deployment
6. **Regenerate context:** `node scripts/generate_gemini.js`

**Required sections:** Role, Tone, Capabilities, Rules & Constraints, Boundaries (Always / Ask First / Never)

**H1 format:** `# {Name} — {Domain} Agent`

---

## Governance

All agents are evaluated against two frameworks before deployment:

### 4D AI Fluency Framework

Developed in partnership with George Mason University. Every agent design decision maps to one of four dimensions:

| Dimension | Focus | Agent Spec Section |
|-----------|-------|--------------------|
| **Description** | Precise instruction and contextualization | Role, Tone, Capabilities |
| **Discernment** | Knowing when AI is appropriate vs. human judgment | Boundaries (Ask First / Never) |
| **Delegation** | Autonomous workflows via MCP integrations | Workflow, Tool Usage |
| **Diligence** | Continuous verification and ethical alignment | Rules & Constraints |

See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) and [`docs/lifecycle/`](docs/lifecycle/) for details.

### Gartner AI TRiSM (Trust, Risk, Security Management)

| Pillar | How We Address It |
|--------|-------------------|
| **Trust** | Transparent boundaries, auditable action trails, Fleet Dashboard observability |
| **Risk** | Fetch-on-Demand credentials, data minimization, PII Guard |
| **Security** | Prompt Shield, Red Team Gauntlet, execution confirmation for critical operations |

See [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) and [`docs/frameworks/gartner-trism.md`](docs/frameworks/gartner-trism.md).

---

## Commit Standards

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject
```

| Type | Purpose |
|------|---------|
| `feat` | New agent or feature |
| `fix` | Bug fix in a spec or doc |
| `docs` | Documentation changes |
| `style` | Formatting changes |
| `refactor` | Code restructuring |
| `chore` | Maintenance tasks |

**Scope** matches the domain or area: `marketing`, `guardian`, `agents`, `lifecycle`, etc.

**Examples:**
- `feat(engineering): add gatekeeper PR triage agent`
- `fix(agents): resolve code review findings across specs`
- `docs(examples): add MSP deployment guide`

---

## License

See [LICENSE](LICENSE) for details.
