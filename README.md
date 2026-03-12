# 🎼 Conductor Framework

**The Conductor** — an AI Software Engineering framework for the full development lifecycle.

Workflows, skills, and personas that turn any AI coding assistant into a Product Engineer. Plan → Design → Build → Ship → Learn.

---

## Quick Install

```bash
npx conductor-framework init
```

This scaffolds the full Conductor Framework into your project:

```
your-project/
├── .agent/              # AI agent core (workflows, skills, personas)
│   ├── AGENTS.md        # System instructions (auto-discovered)
│   ├── workflows/       # Genesis → Build pipeline
│   ├── skills/          # 27 modular skills
│   ├── personas/        # 10 thinking partners
│   └── tests/           # Framework self-test
├── .conductor/          # Project state (all managed artifacts)
│   ├── 0-Compass/       # North Star & Ship Log
│   ├── 1-Workbench/     # Active work
│   ├── 2-Backlog/       # Queued work
│   ├── 3-Product-Areas/ # Feature inventory
│   ├── 4-Context/       # Tribal knowledge
│   ├── 5-Templates/     # Document templates
│   └── 6-Archive/       # Completed work
├── GEMINI.md            # Gemini auto-discovery stub
└── CLAUDE.md            # Claude auto-discovery stub
```

### Options

```bash
# Install into a specific directory
npx conductor-framework init ./my-project

# Only install .agent/ (for existing projects)
npx conductor-framework init --agent-only

# Overwrite an existing installation
npx conductor-framework init --force
```

---

## How It Works

Tell your AI assistant what you need. The Conductor classifies and routes:

| You say... | Conductor routes to |
|:---|:---|
| "I have an idea" | **Genesis** workflow → full problem exploration |
| "Build it" | **Build** workflow → verified execution |
| "Quick path" | **Quick-Path** → skip discovery, go fast |
| "CTO mode" | **CTO** persona → strategic thinking partner |
| "Security mode" | **Security Auditor** persona → vulnerability analysis |

### The Pipeline

```
Genesis → Storyboard → Grand PRD → Technical Vision → Carve → Spec-It → Build → Retrospective
   ↑                                                                          ↑
   └── Discovery Phase ──────────────────────────── Execution Phase ──────────┘
```

### What's Inside

- **11 Workflows** — From Genesis (ideation) to Build (verified execution) to Retrospective (learning)
- **27 Skills** — Verification Gate, Code Review, Frontend Design, Systematic Debugging, Git Workflow, and more
- **10 Personas** — CTO, Architect, Product Manager, Designer, Security Auditor, Database Architect, and more

Full documentation: [`.agent/How-It-Works.md`](.agent/How-It-Works.md)

---

## The Verification Iron Law

> **No completion claims without fresh verification evidence.**

Before claiming any work is done, the agent must run a check, read the output, confirm it matches, and only then claim completion. "Should work" is not evidence.

---

## Self-Test

Validate your installation:

```bash
bash .agent/tests/check-conductor.sh
```

---

## Credits & Acknowledgments

Conductor was built by standing on the shoulders of giants. This framework incorporates ideas, patterns, and direct inspiration from:

- **[Conductor Framework](https://www.testinprod.co/)** by Test in Prod — The original framework that started it all. Conductor V4 is a evolution of their pioneering ASE methodology.

- **[Antigravity Kit](https://github.com/vudovn/antigravity-kit)** by vudovn — A comprehensive skill library (36 skills, 18 agents, 10 workflows) that contributed engineering skills, design patterns, and the multi-file skill architecture.

- **[Antigravity Superpowers](https://github.com/skainguyen1412/antigravity-superpowers)** by skainguyen1412 — Contributed the self-test infrastructure, the npx install pattern, and rich debugging sub-docs.

- **[Superpowers](https://github.com/obra/superpowers)** by obra — The original inspiration for Antigravity Superpowers and many AI agent patterns in the ecosystem.

We believe in building on each other's work. If you find value in Conductor, consider contributing back.

---

## License

MIT
