---
name: Task-Tracker
description: Use during Build workflow execution to maintain a live task tracker. Update at every state change.
---

# Task Tracker

## Purpose

Maintain a live table of tasks during execution. Updated at **every** state change — not at the end, not when convenient, at EVERY change.

## Format

The tracker lives inside the active Implementation folder as `Task-Tracker.md`.

```markdown
| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | Create user model | done | Tests: 5/5 pass |
| 2 | Add auth middleware | in_progress | |
| 3 | Build login endpoint | not_started | |
| 4 | Write integration tests | not_started | |
```

## Status Values

| Status | Meaning |
|--------|---------|
| `not_started` | Task hasn't begun |
| `in_progress` | Currently working on this task |
| `done` | Completed with verification evidence |
| `blocked` | Cannot proceed — explain why in Evidence column |
| `cancelled` | Deliberately skipped — explain why in Evidence column |

## Rules

1.  **One `in_progress` at a time.** Never have two active tasks
2.  **Evidence is mandatory for `done`.** No evidence = not done
3.  **Update immediately.** Don't batch updates. Change status the moment it changes
4.  **Table only.** No prose, no instructions — just the table and a header
5.  **Location:** Always inside the active Implementation folder, never a global file

## When to Create

* At the start of the **Build** workflow (Phase 0)
* At the start of **Quick-Path** Phase 3 (Build)
* Whenever executing a multi-step implementation plan

## When to Update

* Task starts → `in_progress`
* Task verification passes → `done` + evidence
* Task hits a blocker → `blocked` + explanation
* Task is deliberately skipped → `cancelled` + reason
