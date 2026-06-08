---
name: Context-Engineering
description: "Use when updating the task backlog, reading PRDs, or modifying project state in the conductor/ directory"
---

# Context Engineering (The Bridge)

This skill bridges the gap between the open-standard agent environment (`.agents/`) and the human-facing collaborative dashboard (`conductor/`).

## Core Directives

When interacting with the `conductor/` directory, you must strictly follow these rules to protect the human user's decisions:

1. **Never Delete Human Context**: When updating a backlog, ship-log, or PRD, you may append to it or update status markers (e.g., `[ ]` to `[x]`). You must NEVER delete or drastically rewrite the human's original thoughts or epics.
2. **Dashboard Navigation**: The human-facing dashboard contains:
   - `conductor/0-Compass/` (North Star, Ship Log)
   - `conductor/1-Workbench/` (Inbox, Active Implementations)
   - `conductor/2-Backlog/` (Task Backlog, Project Backlog)
   - `conductor/3-Product-Areas/` (Features, Epics)
   - `conductor/4-Context/` (Technical, Design, Identity)
3. **Task Updates**: When completing a task, immediately update `conductor/2-Backlog/Task-Backlog.md` and log your victory in `conductor/0-Compass/Ship-Log.md`.

## Execution

Execute file reads or writes exclusively inside the `conductor/` directory based on the user's request, adhering to the boundaries above.
