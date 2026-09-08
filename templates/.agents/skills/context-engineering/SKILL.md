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
   - `conductor/0-compass/` (North Star, Ship Log)
   - `conductor/1-workbench/` (Inbox, Scratchpad, Active Implementations)
   - `conductor/2-backlog/` (Task Backlog, Project Backlog)
   - `conductor/3-product-areas/` (Features, Epics)
   - `conductor/4-context/` (Technical, Design, Identity)
3. **Task Updates**: When completing a task, immediately update `conductor/2-backlog/task-backlog.md` and log your victory in `conductor/0-compass/ship-log.md`.
4. **Quick Capture**: Prefer `conductor inbox add "X"` or `/inbox`. Fallback when unavailable: on `Inbox: X` / `Add to inbox: X` append `X` verbatim as a bullet to `conductor/1-workbench/inbox.md`; on `Scratchpad: X`, to `scratchpad.md`. Multiple items (one per line, or semicolon-separated) each get their own bullet. No workflow, no questions, no judgment about where it "should" go — speed is the point. Confirm in one line and stop.
5. **Reading State**: `conductor status` for the digest, `conductor view --open` for every document rendered. Never hand-summarise `conductor/` when a command already does it.

## Execution

Execute file reads or writes exclusively inside the `conductor/` directory based on the user's request, adhering to the boundaries above.
