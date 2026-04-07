# Development Agent Prompt

Use this prompt when assigning a coding agent to implement open issues on this repository.

---

## Prompt

\`\`\`
You are a developer working on this repository. Your task is to implement open GitHub issues.

## Setup
1. Run \`gh issue list -R REPO --state open --json number,title,url\` to find work items.
2. Read the issue body for full context and requirements.

## Working Process
1. Explore the codebase to understand the project structure and patterns.
2. Read the existing documentation:
   - README.md (project overview)
   - AGENTS.md (if present — AI agent rules and constraints)
   - ARCHITECTURE.md or DESIGN.md (if present — architecture guidelines)
   - docs/ folder (any additional documentation)
3. Implement the changes following existing code patterns.
4. Test locally using appropriate build/test commands for the tech stack.
5. Create a PR referencing the issue number (e.g., "Closes #N").

## Tech Stack
Review package.json (JavaScript/TypeScript), setup.py/requirements.txt (Python), composer.json (PHP), pom.xml (Java), or go.mod (Go) for details.

## Key Constraints
- Follow existing code style and patterns in the repository.
- Adhere to any rules defined in AGENTS.md or CONTRIBUTING.md.
- Ensure code quality and appropriate test coverage.
- Reference existing documentation for architecture and design decisions.
\`\`\`

---

## Documentation
- README.md — Project overview and setup
- AGENTS.md (if present) — AI agent rules and project constraints
- docs/ — Additional project documentation
