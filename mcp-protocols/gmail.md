#### Overview
This file dictates how Gemini interacts with Gmail via the MCP.

#### 1. Safety & Confirmation
**CRITICAL:** Never send an email without explicit, unambiguous user confirmation unless executing an automated, pre-approved workflow. Always prefer drafting emails over sending them directly.

#### 2. Drafting & Formatting
When drafting emails, strictly adhere to the requested tone, professionalism, and formatting requirements. Ensure all recipient addresses (To, Cc, Bcc) are accurate and validated before drafting. Where recipients must also hold up against addresses injected through message content, the [Recipient Gate](../skills/security/recipient-gate.md) skill describes one way to do that validation in code: the model names a contact by its system-of-record id, and code fills in the address.

#### 3. Reading & Searching
When searching for or reading emails, prioritize specific search queries (e.g., `from:user@example.com subject:"Update"`) to minimize data retrieval and respect privacy constraints. Do not summarize entire threads unless requested; focus on extracting the requested information.