# Project NoéMI: Phase 0 Security & Secret Management

**Framework:** Gartner AI TRiSM (Security) | **Pedagogy:** Creation Diligence

## Overview
When our Practitioners build applications with Virtual Coworkers, hardcoding credentials (API keys, database URLs) into source code or chat logs is a major security risk. This guide outlines a "Fetch-on-Demand" architecture:

1. **Storage (The Vault):** Secrets live only in an encrypted SecretOps platform (Infisical).
2. **Access (The Injector):** Agents use the Infisical CLI (`infisical run`) to inject secrets into the process memory at runtime.
3. **Governance (The Guardian Layer):** Secrets are never written to disk, committed to Git, or exposed in the AI's context window.

For the client-side readiness conversation that should happen before these implementation details, see [`../PHASE_ZERO_SECURITY_BASELINE.md`](../PHASE_ZERO_SECURITY_BASELINE.md) and the reusable templates in [`../phase-zero-assessment/`](../phase-zero-assessment/).
For the builder-facing Docker layout that should come after secret injection is understood, see [`../examples/docker-agent-home.md`](../examples/docker-agent-home.md).
For the runtime-side expectations that sit on top of secret injection, see [`orchestrator-runtime-contract.md`](orchestrator-runtime-contract.md).

## The Tool Matrix for Project NoéMI
To replace the 1Password `op run` workflow, we need tools that support an Environment Injection CLI—meaning the secrets exist only in the process memory during runtime and never on the hard drive.

- **Infisical (The Top Open-Source Recommendation):** This is the perfect pedagogical fit for NoéMI. It is an open-source SecretOps platform that can be self-hosted within the NewPush Labs stack. Crucially, its CLI (`infisical run`) behaves exactly like 1Password’s `op run`, making it a seamless drop-in replacement for your curriculum.
- **Google Secret Manager / AWS Secrets Manager (The Enterprise Cloud Path):** The gold standard if the cohort's "Walled Garden" is built on GCP or AWS. However, instead of a CLI wrapper, it relies on Identity and Access Management (IAM) and Workload Identity. The AI must be taught to write SDK-specific code to fetch secrets programmatically. It is highly secure but shifts the "vibe coding" dynamic slightly.
- **Bitwarden Secrets Manager (BWS):** Another excellent open-source alternative with a CLI (`bws run`). Given NewPush's focus on SMBs, Bitwarden is a highly familiar tool for many participants.

## Part 1: The Accelerator’s Role (Governance)
Context: In the 1:50 Equilibrium, Accelerators govern the AI. Because autonomous agents run in headless environments (like cloud VMs or background workflows), they cannot use human SSO. Accelerators must provision "Machine Identities."

**Create the Machine Identity:**
1. Log in to the Infisical Dashboard.
2. Navigate to Access Control > Machine Identities.
3. Click Create Identity (e.g., name it `NoeMI-Agent-Crew`).
4. **Crucial (TRiSM Policy):** Grant "Read-Only" access strictly to the specific environment your agent needs (e.g., `Dev-Secrets`). Never grant an AI agent access to production secrets during the build phase.

**Save the Token:**
Generate an `INFISICAL_TOKEN`. You will need this to authorize the remote agents.

## Part 2: Configuring Remote Agents (Jules / n8n)
Context: Jules runs in a temporary, isolated Virtual Machine. The Practitioners must "teach" it how to access project secrets securely.

**Step 1: Inject the Service Token**
You must bridge the gap between the Jules VM and the Secret Manager.
1. Navigate to your Jules Dashboard (or Repository Settings).
2. Find the Environment Variables section.
3. Add a new variable:
   - `Name`: `INFISICAL_TOKEN`
   - `Value`: Your Machine Token from Part 1.

**Step 2: Install the CLI (Setup Script)**
Add the CLI tool to your repository's environment setup script (`setup.sh`).

```bash
#!/bin/bash
# Phase 0 Security: Install Infisical CLI
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
sudo apt-get update && sudo apt-get install -y infisical

# Verify Auth (Useful for Loki/Grafana debugging logs)
if infisical export > /dev/null 2>&1; then
  echo "✅ Phase 0: Guardian Layer connection established."
else
  echo "❌ Phase 0 Error: Auth Failed. Check INFISICAL_TOKEN."
fi
```

**Step 3: Instruct Jules (AGENTS.md)**
To ensure the AI Agent understands our Description and Delegation principles, add this section explicitly telling it how to run code securely.

```markdown
# Phase 0 Security & Configuration
This project uses Infisical for SecretOps. 
- The CLI (`infisical`) is pre-installed.
- **NEVER** ask the user for secrets in chat or hardcode them in files. This violates the Diligence protocol.
- **ALWAYS** use `infisical run` to execute scripts that require credentials.

## Execution Pattern
When running Python scripts or Node apps, wrap your execution:
`infisical run --env=dev -- python agent_logic.py`
*(Infisical will automatically inject all secrets from the 'dev' environment into the process).*
```

## Part 3: Configuring Local "Vibe Coding" (Gemini CLI)
Context: When a Practitioner is "vibe coding" locally, they can authenticate using their human user identity (SSO) rather than managing long-lived machine tokens.

**Step 1: Authenticate Locally**
Practitioners log in via their browser (often via Casdoor SSO in NewPush Labs).
```bash
infisical login
```

**Step 2: Running the Agent Securely**
To give the Gemini CLI access to secrets (e.g., if it needs to run a database script it just wrote), the Practitioner wraps the agent execution. Unlike 1Password, which requires a `.env.template` with reference strings, Infisical dynamically pulls the environment you specify.

**Command:**
```bash
# This injects the 'dev' secrets into the shell where Gemini runs
infisical run --env=dev -- gemini chat
```

**Pro Tip (Alias):**
Add this to your `~/.zshrc` or `~/.bashrc` to build secure muscle memory:
```bash
alias safe-gemini='infisical run --env=dev -- gemini'
```

## Part 4: The "Agent Contract" (Prompting Guide)
To ensure the agent writes secure code, Practitioners must master Process Description.

**1. The "Reference" Prompt**
User (Practitioner): "Write a Python script to connect to the database. Assume the DATABASE_URL is securely injected into the environment at runtime via our SecretOps tool. Do not create a local `.env` file or ask me for the password."

Agent (Correct Response):
```python
import os

# Phase 0 Security: Agent assumes the variable exists in process memory
db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise ValueError("Missing DATABASE_URL. Phase 0 breach: Did you execute with `infisical run`?")
```
*(Note: If teaching Google Secret Manager, the prompt changes slightly: "Fetch the password dynamically using the google-cloud-secret-manager Python SDK.")*

**2. The "Execution" Prompt**
User (Practitioner): "Run the script you just wrote."

Agent (Correct Action):
Because of the `AGENTS.md` instructions, the AI knows to execute:
```bash
infisical run --env=dev -- python script.py
```

## Part 5: Verifying Phase 0 Security (For Accelerators)
To verify that your Guardian Layer is active, Accelerators can use these commands to audit the environment.

**1. The Core Identity Check**
```bash
# Returns information about the currently authenticated machine identity
infisical me
```

**2. Test Secret Resolution**
Perform a "dry run" to confirm the token has correct permissions without exposing secrets to the application.
```bash
# Exports the environment variables safely to the terminal for verification
infisical export --env=dev
```

## 🛠 Troubleshooting Common Governance Errors

| Symptom | Likely Cause | Fix |
|---|---|---|
| Unauthorized access | Token is scoped to the wrong environment (e.g., prod instead of dev). | Accelerator must update the Machine Identity RBAC policy. |
| `infisical: command not found` | The CLI is not in your system `$PATH`. | Verify installation in the `setup.sh` script. |
| Agent hardcodes secrets | The `AGENTS.md` file is missing or ignored. | Correct the agent's behavior via Discernment and update the system prompt. |

## 🎓 The Pedagogical "Aha!" Moment
To solidify this in Week 4 (Discernment & The Guardian Layer), you can introduce a "Red Team Gauntlet" Lab:

- **The Setup:** Instruct the Accelerators to intentionally try to prompt the AI agent to reveal the `OPENAI_API_KEY` that the Practitioner has been using to build their Virtual Coworker.
- **The Result:** If the Practitioner used `infisical run` properly, the secret was injected purely into the memory of the Python process, not into the AI's chat context window. The agent cannot hallucinate or leak what it does not know.

When the Accelerators face the Feynman Requirement in Week 6, explaining how a Machine Token securely passes an API key to an LLM agent without human intervention is a masterclass in AI Governance. It perfectly justifies their George Mason University micro-credential.
