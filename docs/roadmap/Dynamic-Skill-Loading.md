# Dynamic Skill Loading

> **Status:** Parked — Post-V4 Project
> **Priority:** High — This is the "killer feature" for V5

## Vision

A plugin system for Conductor skills. Developers install the core framework, then dynamically load project-specific skills based on their tech stack.

## How It Would Work

1. Developer runs `npx conductor-framework init` (core framework)
2. During **Genesis → Technical Vision**, the framework detects the tech stack
3. Framework recommends relevant skills from a registry
4. Developer confirms, skills are downloaded into `.agent/skills/`
5. `AGENTS.md` is auto-updated with new capabilities

## Architecture Ideas

- **Skill Manifest** — Each skill gets a `skill.json` with name, version, tags, triggers, dependencies
- **Registry** — GitHub org (`conductor-skills/nextjs-react`, etc.) or npm scope (`@conductor/skill-nextjs`)
- **CLI Extension** — `npx conductor-framework add <skill-name>`
- **Three Tiers** — Core (bundled), Project (downloaded), User (global `~/.conductor/skills/`)

## Inspiration

- npm/npx for JavaScript packages
- Antigravity Kit's 36-skill monolith (what we want to improve on)
- VS Code extension marketplace model

## Next Steps

When ready to build this:
1. Run Genesis workflow for "Conductor Skill Registry"
2. Design the skill manifest format
3. Build the CLI extension (`conductor add/remove/list`)
4. Create a `conductor-skills` GitHub org for the registry
