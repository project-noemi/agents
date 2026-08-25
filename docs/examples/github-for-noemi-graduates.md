# GitHub for NoéMI Graduates: From SharePoint to Versioned AI Work

> A practical demo and decision guide for Project NoéMI graduates who are new to GitHub and more familiar with SharePoint.

This guide answers two common questions:

1. **What belongs in GitHub vs SharePoint?**
2. **How do I capture Microsoft Power Automate workflows in GitHub for version control?**

It mirrors patterns already used in this repository (especially `n8n-templates/`) so you can stay consistent with the NoéMI Architecture Blueprint.

---

## The Simple Rule

| Put it in **GitHub** when… | Put it in **SharePoint** when… |
|-----------------------------|--------------------------------|
| It is source code, scripts, configs, or infrastructure-as-code | It is a living collaborative document (meeting notes, agendas) |
| It is an **agent specification**, skill, MCP protocol, or value lens | It is training slides, videos, or recorded sessions |
| It is a **workflow definition** that should have history, branching, and review (exported n8n JSON or Power Automate solution package) | It is a final report, presentation, or stakeholder PDF |
| You need pull requests, CI checks, audit trail of every change, or easy rollback | It is a knowledge-base article for non-technical end users |
| Multiple people will edit the *same technical artifact* and need merge conflict resolution | Large media files or files that do not benefit from line-level diffs |
| The artifact is the "source of truth" that orchestrators or agents will execute | Operational lists, forms, or day-to-day team collaboration spaces |

**Hybrid pattern (recommended):**  
Keep a clear `README.md` in your GitHub repository that links to the relevant SharePoint site or folder. Technical / executable / versioned artifacts live in GitHub; human collaboration and non-code knowledge live in SharePoint.

---

## Why GitHub Feels Different from SharePoint (and Why That Is Good)

- **SharePoint** is excellent for co-authoring Office documents, sharing with non-developers, and managing permissions in a familiar Microsoft 365 world.
- **GitHub** is a **version-control system**. Every change is a commit with author, timestamp, and message. You can branch, review via Pull Requests, roll back, and run automated checks.

For AI agent work and automation definitions, version control is essential: you need to know *exactly* which version of an agent spec or flow ran, and you need a safe way to propose and review changes.

---

## Suggested Starter Structure for a Graduate POC / Personal Agents Repo

When you create your own repository (for example `MCP_POCs` or `{your-org}-agents`), start with something like this simplified mirror of the NoéMI blueprint:

```text
MCP_POCs/   (or your-company-agents/)
├── README.md                      # Overview + links to this guide and SharePoint
├── docs/
│   ├── github-vs-sharepoint.md     # Optional deeper notes
│   └── capturing-power-automate.md
├── mcp-pocs/                      # Your MCP server / client experiments
├── power-automate-workflows/      # Exported Solutions or unpacked flows
│   └── README.md                   # How to import / environment notes
├── agents/                        # Simple agent specs (if you create any)
├── scripts/                       # Helper scripts
├── .gitignore                     # Never commit secrets, .env, node_modules, etc.
└── LICENSE (optional)
```

Look at the real structure of this repository (`n8n-templates/`, `agents/`, `mcp-protocols/`, `docs/examples/`) for production-grade patterns.

---

## Capturing Microsoft Power Automate Workflows in GitHub

Power Automate flows live in the Power Platform cloud. They are not "files" until you export them. Treat the exported definition the same way this repository treats n8n workflow JSON files.

### Recommended process

1. **Create (or use) an unmanaged Solution** in your development Power Platform environment.  
   Solutions are the packaging unit for ALM (Application Lifecycle Management).

2. **Add your cloud flows** (and any dependent components such as connection references, environment variables, or custom connectors) into that Solution.

3. **Export the Solution** as an unmanaged `.zip` package from the Power Apps / Power Automate maker portal (or via the Power Platform CLI / admin center).

4. **(Strongly recommended) Unpack the solution** for readable files and better Git diffs:
   ```bash
   pac solution unpack --zipfile MySolution.zip --folder ./power-automate-workflows/MySolution
   ```
   This produces folders containing the flow definitions as JSON/XML that Git can diff meaningfully.

5. **Commit** either the `.zip` or (better) the unpacked folder into your GitHub repository under `power-automate-workflows/` (or a similar clear name).

6. **Add a short Markdown note** next to it:
   - Purpose of the flow
   - Trigger and main actions
   - Connectors / permissions required
   - Source environment
   - How to import into another environment

7. **Change workflow going forward**:
   - Make changes in the Power Automate designer (in the Solution)
   - Re-export / re-unpack
   - Commit on a feature branch
   - Open a Pull Request for review
   - After merge, import the versioned package into target environments (test → production)

### Why this works

- You get full history and the ability to roll back.
- Reviewers can see what changed (especially after unpacking).
- The same package can be imported into other environments — supporting proper promotion of automation.
- It matches the pattern used for `n8n-templates/` in this repository.

### Native GitHub integration (coming)

Microsoft is adding native GitHub as a Git provider for Power Platform Solutions source control (public preview targeted around 31 August 2026). Until then, the export → commit process above is the reliable, tool-agnostic method.

### Desktop flows note

Power Automate Desktop has its own version-control features inside the product. For cloud flows that integrate with SharePoint, Teams, Dataverse, etc., the Solution export method is the standard path for GitHub.

---

## First Steps if You Are New to GitHub

1. Create a GitHub account (or use your existing one) and, if appropriate, join or create an organization for your company/team.
2. Create a new repository (start private if preferred). Initialize with a README.
3. Either:
   - Use the GitHub web UI to upload / edit Markdown files, or
   - Install Git + GitHub Desktop / VS Code and `git clone` the repository locally.
4. Practice the basic cycle on a simple Markdown file:
   - Edit → Commit (with a clear message) → Push.
5. Invite a collaborator and practice opening a Pull Request, reviewing, and merging.
6. Only then start adding exported Power Automate solutions or agent specs.
7. Add a clear link in the README to your team's SharePoint site so non-developers still know where the human documents live.

---

## How This Relates to the NoéMI Blueprint

- This repository is the **technical reference architecture** (agent specs, skills, MCP protocols, n8n templates, governance).
- Your personal or company fork / copy is where you customize and add *your* workflows and POCs.
- SharePoint (or equivalent) remains the place for training materials, meeting notes, and stakeholder-facing documents.
- Keeping workflow *definitions* in GitHub gives you the same governance, review, and auditability that NoéMI requires for agents and skills.

For deeper reading inside this repo:

- [docs/examples/zero-to-first-agent.md](zero-to-first-agent.md) — safest beginner path
- [n8n-templates/](../../n8n-templates/) — the model for storing workflow definitions as code
- [docs/PHASE_ZERO_SECURITY_BASELINE.md](../PHASE_ZERO_SECURITY_BASELINE.md) — security first
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — contribution and review standards

---

## Quick Checklist for a New Graduate Project

- [ ] Created a GitHub repository for the technical artifacts
- [ ] Decided what stays in SharePoint and linked it from the GitHub README
- [ ] Put any Power Automate flows into a Solution and exported/unpacked them into the repo
- [ ] Added a short description .md next to each workflow package
- [ ] Practiced at least one Pull Request with a teammate
- [ ] Never committed secrets or connection strings (use `.env.template` + secret manager)

Welcome to the versioned side of the Virtual Workforce. Start small, keep the separation clear, and treat your automations and agent specs with the same care you treat production code.
