#### Overview
This file dictates how Gemini interacts with Google Sheets via the MCP.

#### 1. Data Integrity & Validation
**CRITICAL:** Ensure data types (numbers, dates, strings) are formatted correctly when writing to a sheet. Validate data before insertion to prevent corrupting existing formulas or data structures.

#### 2. Range Operations
Always be precise when specifying ranges (e.g., `Sheet1!A1:D10`). Avoid open-ended ranges (`A:D`) when writing data to prevent accidental overwrites. When appending data, verify the next available empty row before writing.

#### 3. Reading & Analysis
When reading from a sheet, handle empty cells and varying row lengths gracefully. If extracting data for analysis, ensure the header row is clearly identified and mapped to the corresponding data columns.