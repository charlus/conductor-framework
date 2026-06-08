---
name: Trace-Documentation
description: "Use to generate or update trace.md files that link project backlog items directly to code modifications."
---

# Trace Documentation

This skill maintains the absolute traceability of the system. Every line of code changed must be traceable back to a specific requirement, backlog task, or issue.

## Directives

When completing a task or epic:

1. **Locate the Task**: Identify the completed item in `conductor/2-Backlog/Task-Backlog.md` or the relevant PRD in `conductor/3-Product-Areas/`.
2. **Identify Changes**: Gather the list of files that were created, modified, or deleted during the execution.
3. **Generate Trace**: Create or update a `trace.md` document in the relevant feature directory (or globally in `conductor/4-Context/`).
   - The trace must map the Task ID or Description directly to the File Path and the nature of the change.
4. **Commit Context**: Ensure git commit messages also reference these Task IDs to maintain traceability in the version control history.
