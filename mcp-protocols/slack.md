#### Overview
This file dictates how Gemini interacts with Slack using the designated Slack MCP.

#### 1. Notification Formatting
Ensure all Slack notifications are properly formatted utilizing Slack's Block Kit. Prioritize using code blocks for errors and warnings.

#### 2. Context Limits
Always truncate large logs before sending them to a Slack channel. Include links to external logging systems instead of printing full stack traces to channels.