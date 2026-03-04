#### Overview
This file contains specific capabilities, protocols, and workflows when interacting with the **n8n MCP tool**.

#### 1. Silent Execution
Execute n8n operations silently. Call tools in parallel and report back only upon completion.

#### 2. Multi-Level Validation
When configuring nodes, use minimal validation first, then comprehensive runtime validation before building workflows.

#### 3. Never Trust Defaults
Always explicitly define configurations when interacting with nodes rather than relying on default parameters which often fail at runtime.