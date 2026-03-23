# 🔐 Secrets & Configuration
This project follows a "Fetch-on-Demand" architecture for security (Phase 0 Security). All sensitive credentials (API keys, database URLs, etc.) are stored exclusively in an encrypted SecretOps platform (Infisical or 1Password) and are never written to disk or hardcoded in source code.

## Mandatory Security Rules

- NEVER ask the user for secrets in the chat interface.


- NEVER hardcode actual secret values in any files, `.env` files, or logs.


- ALWAYS use an Environment Injection CLI (`infisical run` or `op run`) to resolve credentials at runtime.

# 🛡 Error Handling and Resilience
To ensure reliability and stability, agents and toolkit components must implement robust error handling patterns.

## Mandatory Directives
- **Graceful Degradation**: If an MCP tool or external API fails, the agent must explain the error clearly and attempt alternative strategies if available, rather than silently failing.
- **Exponential Backoff**: Implement exponential backoff retry logic for transient network errors or rate-limiting (429) responses.
- **Standardized Logging**: All technical errors must be logged to `stderr` to allow the orchestrator to capture and report execution failures accurately.

# 🚀 Execution Patterns
The Infisical CLI or 1Password CLI is required in the environment. When you need to execute scripts, tests, or servers that require credentials, you must wrap the command using the following pattern:

## Standard Command Wrapper
Use `infisical run` or `op run` to dynamically pull the specified environment and inject secrets directly into the process memory.

## Examples:


- Infisical Pattern: `infisical run --env=dev -- <command>`


- 1Password Pattern: `op run --env-file=.env.template -- <command>`


- Starting a Chat Session: `infisical run --env=dev -- gemini chat`

# 🛠 Local Development & Authentication
When running on a local host, the system uses human SSO or Desktop App integration for authentication.


- Infisical: If execution fails, ensure you are logged in via `infisical login`.
- 1Password: If execution fails, ensure you are logged in via `op signin`.

# 📝 Coding Standards
- **Fetch-on-Demand**: When writing code that requires configuration, always assume the values will be provided via process memory environment variables (e.g., `os.getenv()`). Do not create local `.env` parsing logic.
- **4D Framework Alignment**: All development must adhere to the 4D AI Fluency Framework (Delegation, Description, Discernment, Diligence). Personas must structurally incorporate these dimensions to ensure technical and ethical gating.
- **Persona Standards**: Specialized agent personas must follow the "Role, Mission, Rules & Constraints, Workflow, Boundaries" format and explicitly document their expected external tooling dependencies.
- **Naming Conventions**: All exported artifacts (n8n workflows, scripts, documentation) must use English-first, slug-based naming (e.g., `ai-triage-inbound.json`) to avoid localization drift.
- **Audit Log (Mandatory)**: All agent personas must include an "Audit Log" requirement in their workflow, ensuring they output a brief JSON summary of their reasoning (once the standardized schema is finalized).
