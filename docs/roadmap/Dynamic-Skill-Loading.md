# Dynamic Skill Loading

> **Status:** In Progress — V5
> **Priority:** High — This is the "killer feature" for V5

## Vision

A plugin system for Conductor skills. Developers install the core framework, then dynamically load project-specific skills based on their tech stack from a curated registry.

## Architecture

### Three Tiers

| Tier | Where | When |
|------|-------|------|
| **Core** | Bundled in `conductor-framework` (`templates/.agents/skills/`) | Always installed |
| **Tech Vision** | Downloaded from `skills-registry` | Auto-recommended during init based on detected stack |
| **Domain** | Downloaded from `skills-registry` | Installed manually for industry verticals |

### Skill Manifest

Every skill has a `skill.json`:

```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "What this skill does",
  "tier": "tech-vision",
  "tags": ["tag1", "tag2"],
  "techStack": ["react", "typescript"],
  "source": "euranova",
  "sourceUrl": null,
  "author": "Euranova",
  "license": "MIT",
  "dependencies": [],
  "minConductorVersion": "5.0.0"
}
```

### Registry

Monorepo on a private GitLab instance, configured via `conductor.config.json`.

Download strategy: `glab api` with GitLab's archive `path` parameter for selective subdirectory downloads — no full clone needed. Requires GitLab CLI (`glab`) as a prerequisite.

### Configuration

`conductor.config.json` is placed in the project root during `conductor init`. It must contain the registry URL pointing to your GitLab skills-registry:

```json
{
  "registry": "https://your-gitlab-instance.com/group/skills-registry"
}
```

All registry commands (`add`, `search`, `list --remote`) require this file.

### CLI Commands

```bash
conductor add <skill-name>       # Download from registry
conductor remove <skill-name>    # Remove locally
conductor list [--remote]        # List local or registry skills
conductor search <query>         # Search registry
```

## Curated Sources

| Source | URL | Status |
|--------|-----|--------|
| skills.sh | https://skills.sh/ | To curate |
| Superpowers | https://github.com/obra/superpowers | To curate |
| Antigravity Codes | https://antigravity.codes/ | To curate |
| skillsmp.com | https://skillsmp.com/ | To investigate |

## Progress

- [x] Phase 1: Manifest format + `skill.json` backfill + registry repo scaffold
- [x] Phase 2: CLI commands (`add`, `remove`, `list`, `search`)
- [x] Phase 3: Tech stack detection during init + skill recommendations
- [ ] Phase 4: Skill curation pipeline (deferred — backlog in `skills-registry/CONTRIBUTING.md`)
- [ ] Phase 5: Testing & verification
