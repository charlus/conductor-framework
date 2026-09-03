---
trigger: always_on
---

# Conductor Framework

> **Antigravity users:** The Conductor system loads automatically via `.agents/rules/`. You're all set.
> **Other AI tools** (Gemini CLI, Claude, etc.): Read the rule files in `.agents/rules/` to initialize, then this file.

## Global Boundaries

> [!WARNING]
> **NEVER** rush to a solution. ALWAYS read the project context and product areas before acting.
> **ALWAYS** use the verification gate before claiming a task is completed. NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.
> **ALWAYS** write a failing test before implementation code during Build. See `.agents/rules/test-driven-law.md`.
> **ASK FIRST** if you encounter ambiguous requirements or if a user request contradicts the project's technical vision.

## The Hybrid Architecture

Conductor separates your capabilities (The Engine) from the project state (The Dashboard).

1. **The Engine (`.agents/`)**: Where your instructions, skills, workflows, and personas live. Read-only for the project's logic.
2. **The Dashboard (`conductor/`)**: Where the human manages the task backlog, inbox, and PRDs. This is your primary collaborative workspace.

## Request Classifier

Classify what the user needs before acting:

| If the user says... | Route to |
|---|---|
| A question ("what is", "how does", "explain") | Answer directly — no workflow needed |
| "I have an idea", "New app", "New feature area" | `workflows/genesis.md` |
| "Grand PRD", "Create PRD" | `workflows/grand-prd.md` |
| "Carve", "Break it down" | `workflows/carve.md` |
| "Deepen", "Improve codebase architecture", "Find shallow modules" | `workflows/deepen.md` |
| "Design a flow", "Agentic flow" | `workflows/agentic-flow.md` |
| "Spec it", "Write the spec" | `workflows/spec-it.md` |
| "Build it", "Let's code" | `workflows/build.md` |
| "Ship it", "Audit and ship", "Release" | `workflows/ship.md` |
| "Quick path", "Just build this" | `workflows/quick-path.md` |
| "Let's reflect" | `workflows/retrospective.md` |
| "Loop", "Unattended", "Autonomous", "Loop-ready" | `workflows/unattended-loop.md` |
| "CTO mode", "Architect mode", "PM mode", etc. | matching persona in `personas/` |
| "How does this framework work?" | `personas/conductor-assistant.md` |
| **"Inbox: X", "Add to inbox: X"** | **Append `X` verbatim to `conductor/1-workbench/inbox.md`. No workflow, no clarifying questions — confirm in one line and stop.** |
| **"Scratchpad: X"** | **Append `X` verbatim to `conductor/1-workbench/scratchpad.md`. Same no-workflow, one-line-confirm rule.** |
| Small fix, bug, quick task (already well-scoped) | Add to `conductor/2-backlog/task-backlog.md` |
| Not sure? | Default to `workflows/genesis.md` — it will help find the right scope |

Inbox/Scratchpad capture exists because some platforms (Claude Code, Antigravity 2.0) have no file browser — chat is the only way the human can reach `conductor/1-workbench/` at all. Don't triage, judge, or improve the wording — that defeats the point of a zero-friction capture path. Triage happens later, when the human or agent processes the inbox on purpose.

Full classifier (with the "not sure what you need" decision guide) and everything else — folder purposes, workflow/skill/persona registries, adoption levels — lives in **`.agents/how-it-works.md`**. Read it when this table isn't enough.

> [!IMPORTANT]
> **Skill Discovery:** Use Progressive Disclosure to find capabilities beyond this table. Check the YAML frontmatter in `.agents/skills/` for triggers on demand — don't load every skill up front.

## Quick Reference

- **Full system reference**: `.agents/how-it-works.md`
- **Prime Directive**: `.agents/rules/prime-directive.md`
- **Verification Iron Law**: `.agents/rules/verification-iron-law.md`
- **Test-Driven Law**: `.agents/rules/test-driven-law.md`
- **Skills & Workflows**: `.agents/skills/` and `.agents/workflows/`
- **Personas**: `.agents/personas/`
- **Project State**: `conductor/`
