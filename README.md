# 🎼 Conductor Framework

**The Conductor** — an AI Software Engineering framework for the full development lifecycle.

Workflows, skills, and personas that turn any AI coding assistant into a Product Engineer. Plan → Design → Build → Ship → Learn.

---

## Quick Install

```bash
npx github:charlus/conductor-framework init
```

This scaffolds the full Conductor Framework into your project:

```
your-project/
├── .agents/              # AI agent core (rules, workflows, skills, personas)
│   ├── AGENTS.md        # Routing table (quick reference)
│   ├── rules/           # System rules (auto-loaded by Antigravity)
│   ├── workflows/       # Genesis → Build pipeline
│   ├── skills/          # 34 modular skills
│   ├── personas/        # 12 thinking partners
│   └── tests/           # Framework self-test
├── conductor/           # Project state (all managed artifacts)
│   ├── 0-compass/       # North Star & Ship Log
│   ├── 1-workbench/     # Active work (scratchpad, inbox, loop-state.json)
│   ├── 2-backlog/       # Queued work
│   ├── 3-product-areas/ # Feature inventory
│   ├── 4-context/       # Tribal knowledge
│   ├── 5-templates/     # Document templates
│   └── 6-archive/       # Completed work
├── GEMINI.md            # Gemini auto-discovery stub
└── CLAUDE.md            # Claude auto-discovery stub
```

### Options

```bash
# Install into a specific directory
npx github:charlus/conductor-framework init ./my-project

# Only install .agents/ (for existing projects)
npx github:charlus/conductor-framework init --agent-only

# Overwrite an existing installation
npx github:charlus/conductor-framework init --force
```

### Upgrading

Already have Conductor installed? Upgrade to the latest:

```bash
npx github:charlus/conductor-framework upgrade
```

Upgrade works from **any prior version** (V4, V5, or a hand-copied install) on a single principle — **your `conductor/` project knowledge is preserved; the `.agents/` methodology is replaced.** It will:
- **Back up first** — the existing `.agents/` (and any migrated folders) are copied to a git-ignored `.conductor-backup/<timestamp>/` before anything changes; a failure mid-run auto-restores.
- **Replace the instructions** — `.agents/` framework files (workflows, skills, rules, personas) are overwritten with the current version, so a methodology upgrade actually lands. **Custom** skills/workflows you added are carried forward; new core capabilities (e.g. the interview primitives) install even if they postdate your original selection.
- **Refresh `conductor/5-templates/`** — the framework document scaffolding — while leaving all your knowledge in `0-compass`, `2-backlog`, `3-product-areas`, `4-context`, `6-archive` untouched.
- **Migrate structure & schema** — legacy `.agent/` / `.conductor/` / root numbered folders → the `conductor/` dashboard; `loop-state.json` → the current schema.
- **Refresh platform stubs** — the framework block in `CLAUDE.md`/`GEMINI.md` (between `<!-- conductor:managed -->` markers) is updated in place while your own notes outside it are kept; your `CHANGELOG.md` is never touched.
- **Stamp the version** — records the framework version for idempotent future upgrades.

Preview any upgrade with `upgrade --dry-run` (prints the plan, writes nothing).

### Skill Registry (optional)

Beyond the 34 core skills bundled in `templates/`, Conductor can download tech-specific or domain skills on demand from a registry you configure:

```bash
npx conductor-framework list --remote          # browse the registry
npx conductor-framework search react           # search by keyword
npx conductor-framework add react-components    # install a skill
npx conductor-framework remove react-components # uninstall a skill
```

This requires a `conductor.config.json` (scaffolded by `init`) pointing at your own skills registry — there is no public registry yet, so this is aimed at teams running a private one (e.g. on GitLab, via `glab`).

---

## How It Works

Tell your AI assistant what you need. The Conductor classifies and routes:

| You say... | Conductor routes to |
|:---|:---|
| "I have an idea" | **Genesis** workflow → full problem exploration |
| "Build it" | **Build** workflow → verified execution |
| "Quick path" | **Quick-Path** → skip discovery, go fast |
| "Loop", "Unattended" | **Unattended-Loop** workflow → headless autonomous run |
| "CTO mode" | **CTO** persona → strategic thinking partner |
| "Security mode" | **Security Auditor** persona → vulnerability analysis |

### The Pipeline

```
Genesis → Storyboard → Grand PRD → UX/UI Design Brief → Technical Vision → Carve → Spec-It → Build → Ship → Retrospective
   ↑                                                                                                  ↑
   └── Discovery Phase ─────────────────────────────────────────────── Execution Phase ──────────────┘
```

### What's Inside

- **15 Workflows** — From Genesis (ideation) to Build (verified execution) to Ship, plus the headless **Unattended-Loop** orchestrator and its independent **Loop-Checker**
- **34 Skills** — including the `grilling` and `collaborative-drafting` interview/drafting primitives, `handoff` (context hygiene), Verification Gate, Code Review, Systematic Debugging, and more
- **12 Personas** — Including the strategic thinking partners and loop-execution specialists (**Maker** and **Checker**)

Full documentation: [`AGENTS.md`](templates/.agents/AGENTS.md)

*Note: Conductor uses **Progressive Disclosure**. IDEs only load a tiny `prime-directive.md` which points them to `AGENTS.md` for routing. This keeps your context window clean and lightning fast!*

---

## The Verification Iron Law

> **No completion claims without fresh verification evidence.**

Before claiming any work is done, the agent must run a check, read the output, confirm it matches, and only then claim completion. "Should work" is not evidence.

---

## 🤖 Autonomous Loop Backend (V6)

Conductor drives headless, unattended building through a **deterministic loop backend** — a pure state machine (`src/loop/driver.js`), not a prose-only prompt. Run it with `conductor loop`, or trigger the **Unattended-Loop** workflow from a recursive harness.

The driver reads and writes **The Spine** (a durable JSON ledger, `conductor/1-workbench/loop-state.json` — v2 schema) and enforces the guardrails in code, not just advice:
* **Iteration Ceiling & wall-clock budget** — bound token spend on headless runs.
* **Driver-observable stall detection** — halts when progress stops instead of looping forever.
* **The Evidence Rule** — task completion resolves from the verify command's exit code, fail-safe; a model can't self-declare victory.
* **The Scoping Barrier** — headless runs are refused during `discovery` (that phase needs a human).

Around the driver:
* **Platform adapters** (`src/loop/adapters/`) — Claude Code (primary), Antigravity, and Codex, selected via `--platform` → `loop-state.json` → auto-detect.
* **Maker/Checker split** — the Maker builds in an isolated git worktree; an **independent Checker** process verifies via a multi-vote verdict (`checker-verdict.json`, fail-safe reject).
* **Sandbox gate** — real headless runs are gated behind a sandbox profile (`--unsafe-no-sandbox` to override); L3 requires a container.
* **Swarm scaling & autonomy slider (L0–L3)** — parallelize independent work with a PR-gated merge queue.

**Ignition contract** — the driver is a *goal* loop with no scheduler of its own (by design). Seed it from an external trigger and it composes into the **time-based** and **proactive** loops of Anthropic's Loop-Engineering taxonomy:

```bash
# recurring (drive from Claude Code /schedule or host cron)
conductor loop --goal "check for new TODO comments and address them"
# event-driven (a webhook/CI shim writes the payload, then fires the loop)
conductor loop --event ./event.json
```

A trigger can seed the goal but is **clamped to the operator's autonomy ceiling** — a payload (which may come from an untrusted source) can de-escalate but never escalate. Every driver guardrail still binds.

See [`docs/roadmap/Autonomous-Loop-Backend.md`](docs/roadmap/Autonomous-Loop-Backend.md), [`docs/roadmap/Loop-Engineering-Alignment.md`](docs/roadmap/Loop-Engineering-Alignment.md), and [`docs/adr/0001-enforcement-and-autonomy-rebalance.md`](docs/adr/0001-enforcement-and-autonomy-rebalance.md).

---

## Self-Test

Validate your installation:

```bash
bash .agents/tests/check-conductor.sh
```

---

## Credits & Acknowledgments

Conductor was built by standing on the shoulders of giants. This framework incorporates ideas, patterns, and direct inspiration from:

- **[Conductor Framework](https://www.testinprod.co/)** by Test in Prod — The original framework that started it all. Conductor is an evolution of their pioneering ASE methodology.

- **[Antigravity Kit](https://github.com/vudovn/antigravity-kit)** by vudovn — A comprehensive skill library (36 skills, 18 agents, 10 workflows) that contributed engineering skills, design patterns, and the multi-file skill architecture.

- **[Antigravity Superpowers](https://github.com/skainguyen1412/antigravity-superpowers)** by skainguyen1412 — Contributed the self-test infrastructure, the npx install pattern, and rich debugging sub-docs.

- **[Superpowers](https://github.com/obra/superpowers)** by obra — The original inspiration for Antigravity Superpowers and many AI agent patterns in the ecosystem.

We believe in building on each other's work. If you find value in Conductor, consider contributing back.

---

## License

MIT
