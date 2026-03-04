#### Overview
This file dictates how Gemini interacts with Google Calendar via the MCP.

#### 1. Timezone Handling
**CRITICAL:** Always explicitly verify and state the timezone when creating, reading, or modifying events. Never assume the user's timezone; if it is ambiguous, ask for clarification. Convert times accurately when dealing with participants in different locations.

#### 2. Event Creation & Modification
When scheduling events, ensure all participant email addresses are correct. Clearly summarize the event details (title, time, timezone, participants, description, location/meet link) to the user before finalizing the creation or modification.

#### 3. Conflict Resolution
When checking availability or proposing times, proactively identify and flag scheduling conflicts. Offer alternative time slots based on the participants' visible availability.