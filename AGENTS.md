# 🔐 Secrets & Configuration
This project follows a "Fetch-on-Demand" architecture for security (Phase 0 Security). All sensitive credentials (API keys, database URLs, etc.) are stored exclusively in an encrypted SecretOps platform (Infisical) and are never written to disk or hardcoded in source code.

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
The Infisical CLI is pre-installed in the environment. When you need to execute scripts, tests, or servers that require credentials, you must wrap the command using the following pattern:

## Standard Command Wrapper
Use `infisical run` to dynamically pull the specified environment and inject secrets directly into the process memory.

## Examples:


- Infisical Pattern (Python): `infisical run --env=dev -- python script.py`


- Starting a Chat Session: `infisical run --env=dev -- gemini chat` 

# 🛠 Local Development & Authentication
When running on a local host, the system uses human SSO or Desktop App integration for authentication.


- Infisical: If execution fails, ensure you are logged in via `infisical login`.

# 📝 Coding Standards
When writing code that requires configuration, always assume the values will be provided via process memory environment variables (e.g., `os.getenv()`). Do not create local `.env` parsing logic.
