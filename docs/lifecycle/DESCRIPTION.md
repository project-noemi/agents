# The 4D Framework: Description

## 1. The Core Principle
Description is the process of translating human intent into structured logic that a Large Language Model (LLM) can understand and execute. Inaccurate description leads to "hallucination by ambiguity."

## 2. Moving from Vague to Contextual
The AI is a semantic calculator, not a mind reader.
- **Product Description**: Clearly defining the expected output format (e.g., JSON, Markdown, a Python script).
- **Process Description**: Defining the chain of reasoning or specific steps the agent must take to arrive at the solution.
- **Data Description**: Documenting the data inventory, allowed data classes, source systems, and required redactions or refusal boundaries.

## 3. The Description Process (High-Tech Surfboard Model)
- **Explorers (Passengers)**: Draft a business request in plain English (e.g., "Summarize this meeting and pull out action items").
- **Practitioners (Crew)**: Convert the Explorer's vague request into a structured prompt or workflow specification and document the data inventory needed for safe execution.
- **Accelerators (Pilots)**: Wrap the Practitioner's prompt into a robust system contract that enforces brand voice, operational boundaries, and Phase 0 Security mandates before the workflow is approved.
