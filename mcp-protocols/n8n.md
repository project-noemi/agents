#### Overview
This file contains specific capabilities, protocols, and workflows when interacting with the **n8n MCP tool**.

#### 1. Silent Execution
Execute n8n operations silently. Call tools in parallel and report back only upon completion.

#### 2. Multi-Level Validation
When configuring nodes, validate in layers:

- credentials
- node parameters
- expressions
- branch routing
- workflow runtime behavior

#### 3. Never Trust Defaults
Always explicitly define configurations when interacting with nodes rather than relying on default parameters which often fail at runtime.

#### 4. Do Not Assume Hidden Helper Tools
Do not invent template catalogs, node validators, or workflow helper methods unless the orchestrator explicitly provides them. If the runtime only exposes JSON files or the n8n API, work within that real surface.

#### 5. Prefer Current Node Types
Use current built-in node types and explicit `typeVersion` values. Treat older workflow JSON as illustrative until verified against the target n8n release.
