# Secure Secret Management Example

This directory contains examples of the "Fetch-on-Demand" architecture described in the [Secure Secret Management for AI Agents](../../docs/tool-usages/secure-secret-management.md) documentation.

## Files
- `setup.sh`: A script that an orchestrator (like n8n) would run to install the Infisical CLI and verify the Guardian Layer connection.
- `agent_logic.py`: An example of how the AI agent should be instructed to write code. Notice it expects `DATABASE_URL` and `OPENAI_API_KEY` to already exist in the environment (`os.getenv()`), rather than asking for them or loading a `.env` file from disk.

## How to Run (Local Vibe Coding)
If you have Infisical installed and are logged in (`infisical login`), you can test the injection locally:

```bash
# This injects the 'dev' secrets into the python process memory
infisical run --env=dev -- python agent_logic.py
```