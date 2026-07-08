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
4. **Quick Capture**: On platforms with no file browser (Claude Code, Antigravity 2.0), this is the human's only way to reach `1-workbench/` directly. When the user says `Inbox: X` or `Add to inbox: X`, append `X` verbatim as a new bullet to `conductor/1-workbench/inbox.md`. When they say `Scratchpad: X`, append to `conductor/1-workbench/scratchpad.md`. No workflow, no clarifying questions, no judgment about where it "should" really go — that's what makes it fast. Confirm in one line (`"Added to inbox."`) and stop. If the message has multiple items (one per line, or semicolon-separated), add each as its own bullet.

## Execution

Execute file reads or writes exclusively inside the `conductor/` directory based on the user's request, adhering to the boundaries above.
