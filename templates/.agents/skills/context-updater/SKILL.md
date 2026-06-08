---
name: Context-Updater
description: Use after Build or Retrospective to update Product Area and Context files with what was learned and built.
---

# Context Updater

## Purpose

Keep the knowledge base alive. After building or shipping, update Product Area files (`.conductor/3-Product-Areas/`) and Context files (`.conductor/4-Context/`) with what was learned.

Without this, upstream documents become stale and downstream workflows read outdated information.

## When to Trigger

- End of the **Build** workflow (Phase 4: Ship & Close)
- End of the **Retrospective** workflow (Phase 3: Update Knowledge Base)
- Whenever you notice Context/Product Area files are out of date

## What to Update

### Product Area Files (`.conductor/3-Product-Areas/[Area]/`)

| File | Update With |
|------|------------|
| `[Area]-Features.md` | New features that were shipped. Update existing feature descriptions if behavior changed |
| `[Area]-Technical.md` | New architectural decisions, patterns, data model changes, API changes |
| `[Area]-Epics.md` | Mark completed Epics. Note scope changes. Add new Epics discovered during Build |

### Context Files (`.conductor/4-Context/`)

| File | Update With |
|------|------------|
| `Technical/` | New conventions, stack changes, infrastructure decisions |
| `Design/` | New design patterns, component library additions |
| `Product/` | User insights, metrics, product learnings |
| `Identity/` | Only if the product vision or positioning changed |

## How to Update

1.  **Read the completed Implementation artifacts** (Feature Spec, Implementation Plan, Task Tracker)
2.  **Extract key decisions:** What was decided? What was learned?
3.  **Append to relevant files** — add new sections, don't overwrite existing content
4.  **Date your additions** — use `## [Date] — [Topic]` headers so the knowledge is traceable
5.  **Keep it concise** — facts and decisions, not narrative

## Rules

- **Append, don't replace.** Existing content may still be relevant
- **Be specific.** "Added user auth" is useless. "Added JWT-based auth with refresh tokens, stored in httpOnly cookies" is useful
- **Cross-reference.** Link back to the Implementation that produced this knowledge
- **Don't update if nothing changed.** Not every build changes the architecture
