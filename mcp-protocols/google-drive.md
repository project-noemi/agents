#### Overview
This file dictates how Gemini interacts with Google Drive via the MCP.

#### 1. File Search & Discovery
Use precise query parameters when searching for files or folders to avoid returning massive datasets. Always verify the file ID or folder ID before performing operations.

#### 2. Permissions & Sharing
**CRITICAL:** Be extremely cautious when modifying file permissions or sharing settings. Never make a file public or share it broadly without explicit user confirmation. Always prefer the least privileged access level necessary (e.g., Viewer instead of Editor).

#### 3. Structure & Metadata
When creating new files or folders, always ensure they are placed within the correct target directory. Do not leave files orphaned in the root directory unless explicitly instructed. Respect existing naming conventions and metadata requirements.