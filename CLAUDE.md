# Conductor Framework — Development Context

> You are working on **the Conductor Framework itself** — an npm package that provides AI Software Engineering methodology to other projects. This is NOT a project using Conductor. This IS Conductor.

## What This Repo Is

An npm package (`conductor-framework`) that scaffolds an AI agent methodology into any project via:

```bash
npx github:charlus/conductor-framework init      # New projects
npx github:charlus/conductor-framework upgrade    # Existing projects
```

The installable framework lives in `templates/`. The CLI lives in `bin/` + `src/`.

## Architecture

```
conductor-framework/          ← You are here (package source)
├── bin/conductor.js           # CLI entry point
├── src/
│   ├── cli.js                 # Argument parser (init, upgrade)
│   └── commands/
│       ├── init.js            # Scaffolds .agent/ + .conductor/ into target
│       └── upgrade.js         # Replaces .agent/, migrates root→.conductor/
├── templates/                 # THESE files get installed into user projects
│   ├── .agent/                # Agent core (AGENTS.md, workflows, skills, personas)
│   ├── .conductor/            # Project state (numbered folders)
│   ├── GEMINI.md              # Platform stub (for installed projects, not this repo)
│   ├── CLAUDE.md
│   └── CHANGELOG.md
├── package.json               # v4.2.0
├── README.md                  # Public-facing with credits
├── CHANGELOG.md               # Package changelog
└── this file (CLAUDE.md)      # Development context for AI
```

### Key Distinction

- **`templates/`** = what users get. Edit these when changing the framework.
- **`src/`** = the installer. Edit these when changing the CLI.
- **Root files** = package metadata. This repo does NOT use the Conductor framework itself.

## Design Decisions Made

| Decision | Rationale |
|----------|-----------|
| `.agent/AGENTS.md` not `ai-init.md` | Industry-standard naming for AI auto-discovery |
| `.conductor/` wrapper | Keep project root clean — framework state in one hidden folder |
| Platform stubs (`GEMINI.md`, `CLAUDE.md`) | Each AI platform auto-discovers its own file format |
| Title-Case-Kebab naming | All skill/persona/workflow files follow this convention |
| CLI auth detection (not URL regex) | `gh auth status` / `glab auth status` works for self-hosted GitLab |
| No NotebookLM skill in templates | Requires MCP server, too environment-specific for a general framework |

## Current State (V4.2.0)

- 11 workflows, 26 skills (was 25; Lint-And-Validate exists), 10 personas
- Self-test: `bash templates/.agent/tests/check-conductor.sh` → 63 checks
- Published: private GitHub repo `charlus/conductor-framework`

## Parked Ideas

### Dynamic Skill Loading (V5 candidate)
Location: `docs/roadmap/Dynamic-Skill-Loading.md`

Vision: "npm for AI skills" — detect tech stack during Genesis, download relevant skills from a registry. Like VS Code extensions but for AI agent capabilities.

## How to Work on This Repo

1. **Edit templates/** when changing the framework content
2. **Edit src/** when changing the CLI behavior
3. **Always sync templates** after testing changes locally
4. **Run the self-test** after every change: `bash templates/.agent/tests/check-conductor.sh`
5. **Test the full flow**: `node bin/conductor.js init /tmp/test && bash /tmp/test/.agent/tests/check-conductor.sh`
6. **Commit with Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`

## Credits

Built on: [Test in Prod's Conductor](https://www.testinprod.co/), [Antigravity Kit](https://github.com/vudovn/antigravity-kit), [Antigravity Superpowers](https://github.com/skainguyen1412/antigravity-superpowers), [Superpowers](https://github.com/obra/superpowers).
