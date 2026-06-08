---
name: Skill-Registry
description: Manages Conductor skills from the remote registry — install, remove, search, and list skills using the conductor CLI. Use during Technical Vision workflow or whenever the tech stack changes.
---

# Skill Registry Management

> This skill teaches you how to manage dynamic skills using the `conductor` CLI. Use it during **Technical Vision** (to install skills matching the chosen tech stack) or anytime the project's needs change.

## Prerequisites

- `glab` CLI installed and authenticated (`glab auth login --hostname <your-gitlab>`)
- `conductor.config.json` in the project root with the registry URL:

```json
{
  "registry": "https://your-gitlab-instance.com/group/skills-registry"
}
```

## When To Use

### During Technical Vision (Primary Flow)

After the tech stack is decided — whether from user input during genesis or from analyzing an existing codebase — search the registry for matching skills and install them:

```bash
# 1. Search for skills matching the chosen technologies
conductor search react
conductor search python
conductor search --tag data-engineering

# 2. Install relevant skills
conductor add react-best-practices
conductor add django-patterns

# 3. Verify installation
conductor list
```

### On Existing Projects

If `conductor init` detected a tech stack, it will have printed recommendations. Follow up by installing the suggested skills.

### When Tech Stack Changes

When the project adopts a new technology (e.g., adding Docker, switching to Next.js), search the registry and install relevant skills.

## Commands

### `conductor add <skill-name>`

Downloads a skill from the registry into `.agents/skills/`.

```bash
conductor add <skill-name>
conductor add <skill-name> --registry <url>   # Override registry URL
```

**What it does:**
1. Checks `glab` auth
2. Fetches `registry.json` from the registry
3. Downloads the skill folder via GitLab's archive API
4. Extracts to `.agents/skills/<Skill-Name>/`
5. Validates `skill.json` + `SKILL.md` exist

### `conductor remove <skill-name>`

Removes an installed skill.

```bash
conductor remove <skill-name>
conductor remove <skill-name> --force   # Required for core skills
```

Core skills (bundled with the framework) are protected — they require `--force` and will be restored on `conductor upgrade`.

### `conductor list`

Lists installed skills or browse the full registry.

```bash
conductor list                        # Local skills
conductor list --remote               # Registry skills (✓ = installed)
conductor list --tier tech-vision     # Filter by tier
conductor list --tier domain
```

### `conductor search <query>`

Searches the registry by name, description, tags, and tech stack.

```bash
conductor search react              # Find React-related skills
conductor search --tag debugging    # Filter by tag
conductor search --tier domain      # Filter by tier
conductor search python django      # Multi-word query
```

## Skill Tiers

| Tier | Where | When |
|------|-------|------|
| **Core** | Bundled in framework | Always available |
| **Tech Vision** | Downloaded from registry | When tech stack is defined |
| **Domain** | Downloaded from registry | For industry verticals (finance, healthcare, etc.) |

## Workflow Integration

After installing skills, they are immediately available in `.agents/skills/` and will be discovered by the AI agent. No restart or reconfiguration needed.

### Recommended flow during Technical Vision:

1. **List what's available**: `conductor list --remote`
2. **Search by tech stack**: `conductor search <technology>`
3. **Install matches**: `conductor add <skill-name>`
4. **Verify**: `conductor list` — confirm skills are installed
5. **Continue** with the Technical Vision workflow — new skills are now active
