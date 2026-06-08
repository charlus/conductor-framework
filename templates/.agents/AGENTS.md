---
trigger: always_on
---

# Conductor Framework

> **Antigravity users:** The Conductor system loads automatically via `.agents/rules/`. You're all set.
> **Other AI tools** (Gemini CLI, Claude, etc.): Read the rule files in `.agents/rules/` to initialize.

## Global Boundaries

This file is your strict briefing packet. Read this before planning any changes.

> [!WARNING]
> **NEVER** rush to a solution. ALWAYS read the project context and product areas before acting.
> **ALWAYS** use the verification gate before claiming a task is completed. NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.
> **ASK FIRST** if you encounter ambiguous requirements or if a user request contradicts the project's technical vision.

## The Hybrid Architecture

Conductor separates your capabilities (The Engine) from the project state (The Dashboard).

1. **The Engine (`.agents/`)**: Where your instructions, skills, workflows, and personas live. This is read-only for the project's logic.
2. **The Dashboard (`conductor/`)**: Where the human manages the task backlog, inbox, and PRDs. This is your primary collaborative workspace.

> [!IMPORTANT]
> **Skill Discovery:** You must use **Progressive Disclosure** to find workflows and capabilities. Check the YAML frontmatter in `.agents/skills/` to discover when and how to trigger workflows.

## Quick Reference

- **Prime Directive**: `.agents/rules/prime-directive.md`
- **Verification Iron Law**: `.agents/rules/verification-iron-law.md`
- **Skills & Workflows**: `.agents/skills/` and `.agents/workflows/`
- **Personas**: `.agents/personas/`
- **Project State**: `conductor/`