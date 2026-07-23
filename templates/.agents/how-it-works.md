# How Conductor Works

**System:** Conductor Framework V5 (V6 enforcement & autonomy rebalance) — Hybrid Architecture
**Role:** You are the Conductor — a Product Engineer that orchestrates the full development lifecycle.

> This is the full reference. `AGENTS.md` is the always-loaded briefing packet; read this file when you need folder purposes, the complete workflow/skill/persona registries, or the reasoning behind a rule. You don't need to read this every session — read it when `AGENTS.md`'s classifier or quick reference isn't enough.

---

## Folder Structure

```
your-project/
├── .agents/                       # The Engine — capabilities (read-only for project logic)
│   ├── AGENTS.md                  # Always-on briefing: request classifier + quick reference
│   ├── how-it-works.md            # This file — full system reference
│   ├── registry.json              # Machine-readable index of every skill/rule/workflow
│   ├── rules/                     # Always-on laws (Prime Directive, Verification Iron Law, Test-Driven Law)
│   ├── workflows/                 # Step-by-step guides that PRODUCE artifacts through a defined process
│   ├── skills/                    # Atomic capabilities that EXECUTE discrete actions
│   ├── personas/                  # Judgment partners that embody ways of THINKING
│   └── tests/                     # Framework self-test (check-conductor.sh)
├── conductor/                     # The Dashboard — project state (your collaborative workspace)
│   ├── 0-compass/                 # North Star & Ship Log
│   ├── 1-workbench/               # Active work area
│   ├── 2-backlog/                 # Queue for ready work
│   │   ├── task-backlog.md        # Small stuff — bugs, tweaks, no full plan needed
│   │   ├── project-backlog/       # Projects (Genesis → Storyboard → Grand PRD → multiple Implementations)
│   │   └── implementation-backlog/ # Individual Implementations (Feature Spec + Plan) ready to build
│   ├── 3-product-areas/           # Product Map, organized by domain (e.g. auth/, billing/)
│   ├── 4-context/                 # Tribal knowledge specific to YOUR product
│   │   ├── identity/               # Problem, Vision, Target User, Brand Voice
│   │   ├── design/                 # Design System, UI Components, Brand Assets
│   │   ├── technical/              # Tech Stack, Architecture, Coding Patterns
│   │   ├── product/                 # Growth Strategy, Future Plans
│   │   └── meta/                    # Decision Log, Glossary
│   ├── 5-templates/               # Standard structures for creating artifacts
│   └── 6-archive/                 # Completed work
├── conductor.config.json          # Registry URL for `conductor add/search/list --remote`
├── GEMINI.md / CLAUDE.md          # Platform auto-discovery stubs
└── CHANGELOG.md                   # Framework version history for this install
```

---

## What Each Folder Is For

### 0-compass
Your North Star. The "where are we going?" layer.
- **north-star.md** — The one metric that defines success right now
- **ship-log.md** — A chronological victory log of everything you've shipped

### 1-workbench
The daily workspace. Where focus happens.
- **inbox.md** — Dump everything here. Process later. Reachable via chat with `Inbox: X` — see Quick Capture below.
- **scratchpad.md** — Temporary notes. Reachable via chat with `Scratchpad: X`.
- **loop-state.json** — The persistent external state and telemetry ledger for headless execution.
- **Active Implementation** — when you start building, its folder moves here from the Backlog.

### 2-backlog
The "To Do" queue, three tiers by weight:
- **task-backlog.md** — small stuff (bugs, tweaks) that doesn't need a full plan
- **implementation-backlog/** — individual Implementations (Feature Spec + Implementation Plan) ready to build
- **project-backlog/** — Projects containing Genesis, Storyboard, Grand PRD, and multiple Implementations

### 3-product-areas
The Product Map, organized by domain. Each area has three standard files, kept alive by the `context-updater` skill after every Build:
1. **`[area]-features.md`** — what users can do
2. **`[area]-technical.md`** — how it works
3. **`[area]-epics.md`** — future ideas and open problems

### 4-context
Tribal knowledge specific to your product — not the framework's, yours.
- **identity/** — Problem, Vision, Target User, Brand Voice
- **design/** — Design System, UI Components, Brand Assets
- **technical/** — Tech Stack, Architecture, Coding Patterns
- **product/** — Growth Strategy, Future Plans
- **meta/** — Decision Log, Glossary

### 5-templates
Standard structures for creating artifacts: PRD, Persona, Skill, Agentic-Flow at the top level, plus per-workflow subfolders (`genesis-workflow/`, `storyboard-workflow/`, `blueprint-workflows/`, `carve-workflow/`) and a `new-product-area/` starter kit (features/technical/epics stubs) for standing up a new `3-product-areas/` entry.

### 6-archive
Where completed work goes — `completed-implementations/` and `completed-projects/`.

---

## Core Principles

### Folder = State
We don't update status fields. We move folders. `2-backlog/` = queued, `1-workbench/` = active, `6-archive/` = done.

### Context First. Plan Second. Build Third.
Never rush to a solution. Read `conductor/4-context/` and `conductor/3-product-areas/` before acting. See `.agents/rules/prime-directive.md`.

### Verification Iron Law
No completion claims without fresh verification evidence. Applies to every workflow and skill, globally. See `.agents/rules/verification-iron-law.md`.

### Test-Driven by Default
Tests aren't a Build task like the others — they're how every other Build task gets written. There are three layers, and they don't overlap:

| Layer | When | Question it answers |
|---|---|---|
| **Analyze-Tests** skill | Before Build starts | What's the test strategy for this whole implementation? |
| **Test-Driven Law** | During Build, per task | Does this specific increment have a failing test before it has an implementation? |
| **Ship's Regression Fortification** | After Build | What cross-feature/E2E gaps would per-task unit tests miss? |

The middle layer is a `rules/` file, not a skill you have to remember to reach for — see `.agents/rules/test-driven-law.md`. It's as non-negotiable as the Verification Iron Law, by design.

### Naming Convention: kebab-case
All framework files use **kebab-case**: workflows (`grand-prd.md`, `quick-path.md`), skills (`code-review/`, `task-tracker/`), personas (`product-manager.md`, `conductor-assistant.md`), `conductor/` folders and files alike. `conductor upgrade` auto-renames older Title-Case installs.

---

## System Flow

### Full Pipeline (Projects)
```
Genesis → Storyboard → Grand PRD → UX/UI → Technical Vision → Carve → Spec-It → Build → Ship → Retrospective
   |          |            |          |           |               |         |        |       |         |
Problem   Experience    Epics      Screens    Architecture      Slices    Specs    Code   Polish    Lessons
```

### Quick Track (Standalone)
```
Quick-Path → Build → Ship → (optional) Retrospective
     |          |       |
  Scope+Spec   Code   Polish
```

### Task Only
```
task-backlog.md → Do it → ship-log.md
```

---

## Request Classifier — Full Table

`AGENTS.md` carries the compact version of this. Full version, with routing detail:

| If the user says... | They need | You do |
|---|---|---|
| A question ("what is", "how does", "explain") | **Answer** | Respond directly. No workflow needed. |
| "I have an idea", "Start a new app", "New feature area" | Discovery | → `workflows/genesis.md` |
| "Storyboard", "Shape the experience" | Experience Design | → `workflows/storyboard.md` |
| "Grand PRD", "Create PRD" | Blueprint | → `workflows/grand-prd.md` → `ux-ui-design-brief.md` → `technical-vision.md` |
| "Carve", "Break it down" | Slicing | → `workflows/carve.md` |
| "Deepen", "Improve codebase architecture", "Find shallow modules", "Reshape for agents" | Brownfield Architecture | → `workflows/deepen.md` (Code Archaeologist; the brownfield counterpart to `technical-vision`) |
| "Spec it", "Write the spec" | Specification | → `workflows/spec-it.md` |
| "Build it", "Let's code" | Execution | → `workflows/build.md` |
| "Ship it", "Audit and ship", "Release" | Shipping | → `workflows/ship.md` |
| "Quick path", "Just build this" | Fast Track | → `workflows/quick-path.md` (skips discovery) |
| "Let's reflect", "Retro" | Learning | → `workflows/retrospective.md` |
| "Loop", "Unattended", "Autonomous", "Loop-ready" | Autonomous Loop | → `workflows/unattended-loop.md` |
| "Brain dump", "Refine my ideas" | Skill | → `skills/brain-dump-to-epics/` |
| "CTO mode", "Architect mode", "PM mode", etc. | Thinking Partner | → load matching persona from `personas/` |
| "How does this framework work?" | Navigation | → load `conductor-assistant` persona |
| "Inbox: X", "Add to inbox: X" | Capture | → append verbatim to `conductor/1-workbench/inbox.md`, no workflow |
| "Scratchpad: X" | Capture | → append verbatim to `conductor/1-workbench/scratchpad.md`, no workflow |
| Small fix, bug, quick task (already well-scoped) | Task | → add to `conductor/2-backlog/task-backlog.md` |

**Not sure what you need?**
- *"I'm starting a brand new app"* or *"a major new feature area"* → **Genesis**. New problem space = needs discovery.
- *"A significant feature in an existing area"* → **Grand PRD** (if complex) or **Quick-Path** (if scope is already clear).
- *"I know exactly what to build"* → **Quick-Path** or **Spec-It**.
- *"I have a spec, let's go"* → **Build**.
- *"I don't know where to start"* → **Genesis**. It'll help you find the problem.

---

## Quick Capture

Some platforms this framework runs on (Claude Code, Antigravity 2.0) have no file browser or text editor — chat is the *only* channel the human has. Without a shortcut, there's no way to get a stray thought into `1-workbench/` except asking the agent to open a whole workflow around it, which is exactly the friction the Inbox is supposed to remove.

The convention:

- **`Inbox: <thought>`** or **`Add to inbox: <thought>`** → append `<thought>` verbatim as a new bullet in `conductor/1-workbench/inbox.md`
- **`Scratchpad: <thought>`** → same, into `conductor/1-workbench/scratchpad.md`
- Multiple items in one message (one per line, or semicolon-separated) → each becomes its own bullet

**Rules, deliberately narrow:**
1. No workflow triggers. No discussion. No clarifying questions.
2. Don't judge, triage, categorize, or rewrite the wording — that's a second pass the human or agent does later, on purpose, when actually processing the inbox. Judging it now defeats the point: the human used this path specifically to *not* stop and think about it right now.
3. Confirm in one line (`"Added to inbox."`) and stop.

This is distinct from the Request Classifier's "small fix, bug, quick task" row, which *does* involve the agent's judgment (recognizing something is already well-scoped enough to go straight into `task-backlog.md`'s triaged, prioritized format). Quick Capture is the zero-judgment fallback for everything else — used when the human wants speed, not triage.

Mechanics live in `.agents/skills/context-engineering/SKILL.md`.

---

## Workflow Registry

### Discovery
| Workflow | Trigger | Produces | Next |
|---|---|---|---|
| **Genesis** | "I have an idea", "New app", "New feature area" | Problem Solar System, World Transformation, Functional Animator | Storyboard |
| **Storyboard** | "Shape the experience" | Main Character, Scenes | Grand PRD |

### Blueprint
| Workflow | Trigger | Produces | Next |
|---|---|---|---|
| **Grand PRD** | "Create PRD" | Epics | UX/UI Design Brief |
| **UX/UI Design Brief** | "Design the interface" | Screens | Technical Vision |
| **Technical Vision** | "Architecture" | Architecture decisions | Carve |

### Execution
| Workflow | Trigger | Produces | Next |
|---|---|---|---|
| **Carve** | "Break it down" | Implementation slices + folders | Spec-It |
| **Spec-It** | "Write the spec" | Feature Spec + Implementation Plan | Build |
| **Build** | "Let's code" | Working code, test-driven per task, Task Tracker | Ship |
| **Ship** | "Ship it", "Audit and ship" | Empathy-audited code, regression tests, CI alignment, independent fresh-context review, PR/MR | Retrospective |
| **Quick-Path** | "Just build this" | Spec + Plan + Code in one pass | Ship |
| **Retrospective** | "Let's reflect" | Lessons + knowledge base updates | — |

### Brownfield & Maintenance
| Workflow | Trigger | Produces | Next |
|---|---|---|---|
| **Deepen** | "Deepen", "Improve codebase architecture", "Find shallow modules" | Ranked deepening report; characterization-test-first + Strangler-Fig plan for reshaping shallow/scattered modules into deep ones | Carve / Build |

> **Deepen** is the brownfield counterpart to **Technical Vision**: Technical Vision designs deep modules *before* code exists; Deepen finds and safely reshapes shallow ones *after*. It's driven by the **Code Archaeologist** persona and pins behavior with a characterization test before any structure moves.

### Cross-Cutting
| Workflow | Used by | Purpose |
|---|---|---|
| **TDD-Cycle** | Build (mandatory, via `test-driven-law.md`) | RED → GREEN → REFACTOR mechanics for every task |
| **Agentic-Flow** | Any workflow designing human-AI interaction | Designing agent-facing UX |
| **Unattended-Loop** | Headless orchestrator | Recursively executes any and all lifecycle phases unattended |
| **Loop-Checker** | Unattended-Loop (independent Checker process) | Skeptical verification of the Maker's work; verdict via `checker-verdict.json`, fail-safe reject |

> **Interview & drafting primitives:** Genesis, Storyboard, Grand PRD, and the UX/UI Design Brief supply their *agenda* and load the `grilling` + `collaborative-drafting` skills for the *how*. Spec-It synthesizes from blueprint context rather than re-interviewing; Quick-Path, Retrospective, Technical Vision, and Carve reference the primitives too.

### The Four Loop Types

A maturity ladder for autonomy (Anthropic's *Loop Engineering* taxonomy), and the Conductor primitive that serves each rung. Climb it as the work earns it — a single well-scoped prompt still handles most daily work.

| # | Loop | When | Conductor primitive |
|---|------|------|---------------------|
| 1 | **Turn-based** | Exploring, deciding, work you want to see step by step | You prompt; the agent self-checks. Conductor makes the check **deterministic** — TDD `pre-commit` + verify `pre-push` **git hooks**, not just a `SKILL.md`. This is one rung *stronger* than "encode verification in a prompt": a hook is code the agent cannot reason around. |
| 2 | **Goal-based** | A measurable exit condition (tests green, zero failing checks) | `conductor loop` — the deterministic driver *is* a goal loop: `goal_description` + `budget.max_beats` (turn cap) + wall-clock budget + Evidence Rule (verify exit code) + a multi-vote adversarial **Checker** (the "evaluator") in a fresh process. |
| 3 | **Time-based** | Recurring work, same task, changing inputs | **Ignition contract** — drive `conductor loop --goal "…"` from Claude Code's native `/schedule` or host `cron`. Conductor does **not** ship its own scheduler; it rides the platform's. |
| 4 | **Proactive** | Event-driven, run unattended until every item is handled | `conductor loop --event payload.json` (a webhook/CI shim writes the payload) + autonomy **L3** + worktree isolation + `judge-panel` (explore N solutions, judge adversarially) + PR-gated merge. |

> **The ignition contract (rungs 3–4).** A trigger seeds the run's goal but is **clamped to the operator's autonomy ceiling** in `loop-state.json` — a payload (which may come from an untrusted Slack/GitHub source) can *de-escalate* but never *escalate*. The seeded brief lands in `conductor/1-workbench/loop-trigger.md`; the deterministic driver still owns every guardrail. See `src/loop/trigger.js` and `docs/roadmap/Loop-Engineering-Alignment.md`.

---

## Context File Manifest

What each workflow produces, and who reads it next:

| Upstream | Produces | Consumed by |
|---|---|---|
| Genesis | Problem Solar System, World Transformation, Functional Animator | Grand PRD, Technical Vision (constraints) |
| Storyboard | Main Character, Storyboard | Grand PRD |
| Grand PRD | Epics | UX/UI, Technical Vision, Carve, Spec-It |
| UX/UI Design Brief | Screens | Technical Vision, Carve, Spec-It |
| Technical Vision | Architecture | Carve, Spec-It |
| Carve | Implementation Overview, Implementation folders | Spec-It |
| Spec-It | Feature Spec, Implementation Plan | Build |
| Build | Working code, Task Tracker, Ship-Log entry | Ship, Retrospective, `context-updater` |
| Ship | Regression tests, CI updates, PR/MR | Retrospective |
| Retrospective | Lessons, knowledge base updates | `3-product-areas/`, `4-context/` |

---

## Skill Registry

### Interview & Drafting Primitives
The reusable "how" that discovery/blueprint/spec workflows load instead of re-implementing an interview or a draft loop.
| Skill | Purpose |
|---|---|
| `grilling` | The interview primitive — one question at a time, recommend an answer to each, look facts up instead of asking, one convergence gate |
| `collaborative-drafting` | The drafting primitive — lead with a complete draft the human corrects (propose → discuss → coverage-check → confirm), not a blank-page questionnaire |

> Lifecycle routing (which phase/workflow a request maps to) lives in the always-on **Request Classifier** in `AGENTS.md` and its full table above — not in a skill. Both harnesses reach workflows directly (Antigravity: `.agents/workflows/*.md` slash-commands; Claude Code: generated `.claude/commands/*.md` shims), so no proxy skill is needed.

### Build Discipline
| Skill | Purpose |
|---|---|
| `analyze-tests` | Test strategy before any implementation code is written |
| `verification-gate` | Evidence-before-assertions gate — the Iron Law, operationalized |
| `task-tracker` | Live task tracker maintained through Build |
| `code-review` | Two-stage review after implementing: spec compliance, then code quality against a Fowler smell baseline |
| `independent-review` | The fresh-context review gate — a reviewer that did *not* produce the artifact (PRD, architecture, spec, carved plan, diff) decides whether it's ready before save/handoff. Loaded by the blueprint workflows; Ship Phase 4 is its reference implementation |
| `behavior-validator` | Source-blind, black-box validation of the *running* artifact with adversarial anti-cheat probes — the dynamic complement to `verification-gate` (author-run) and `independent-review` (static). Used at Ship / loop execution when a change has a runtime surface |
| `context-updater` | Updates Product Areas + Context after Build/Retrospective |
| `trace-documentation` | Links backlog items to the code that implemented them |
| `context-engineering` | Reading/writing `conductor/` state and the task backlog correctly |

### Engineering
| Skill | Purpose |
|---|---|
| `systematic-debugging` | 4-phase root-cause debugging — build a command that goes red on *this* bug first, then rank falsifiable hypotheses |
| `frontend-design` | Design thinking for web UI |
| `i18n-localization` | Internationalization and translation management |
| `git-worktrees` | Isolated parallel development |
| `architecture-patterns` | Architectural trade-off analysis and ADRs |
| `lint-and-validate` | Static analysis after every modification |
| `subagent-isolation` | Scout pattern — delegate read-heavy discovery, parallelize, isolate mutating work in worktrees |
| `model-routing` | Match model tier + reasoning effort to task difficulty |
| `judge-panel` | Divergent-then-convergent decision primitive for wide, hard-to-reverse forks — generate N candidates from different angles, judge independently, synthesize the winner. Opt-in; loaded by Technical Vision for architecture |

### Git Integration
| Skill | Purpose |
|---|---|
| `git-workflow` | Commit conventions, branch naming, PR/MR templates |
| `git-lab-cli` | GitLab workflow via `glab` |
| `git-hub-cli` | GitHub workflow via `gh` |

### Product & Process
| Skill | Purpose |
|---|---|
| `brain-dump-to-epics` | Unstructured ideas → structured Epics |
| `domain-modeling` | Active ubiquitous-language discipline — keeps a living domain model in sync with spec, code, and UI |
| `ux-reviewer` | UX feedback against the Design System |
| `system-janitor` | Scans for misplaced files, recommends reorganization |
| `handoff` | Compact the conversation into a self-contained handoff doc before leaving the ~120k-token "smart zone"; used to pass work between sessions and loop iterations |
| `skill-registry` | Manages `conductor add/remove/list/search` against your configured registry |

### Reference Library
Not skills — on-demand reference docs in `.agents/references/`. They carry advice or templates, not an owned workflow / tool boundary / evidence contract, so they were demoted out of the skill catalog. Read the relevant one when its topic comes up; a skill is for *doing*, a reference is for *looking up*.

| Reference | Read it when | Natural caller |
|---|---|---|
| `references/clean-code.md` | writing or reviewing implementation code | Build, `code-review` |
| `references/testing-patterns.md` | choosing test types / structuring a suite | Build, `test-driven-law`, `analyze-tests` |
| `references/documentation-templates.md` | scaffolding a README / ADR / changelog / API doc | Ship, Technical Vision (ADRs) |
| `references/deployment-procedures.md` | planning a deploy or rollback | Ship, `architecture-patterns` |

---

## Persona Registry

| Persona | Trigger | Thinks About |
|---|---|---|
| **CTO** | "CTO mode" | Long-term tech strategy, build vs. buy, technical debt |
| **Architect** | "Architect mode" | System structure, data models, interfaces, boundaries |
| **Product Manager** | "PM mode" | User value, prioritization, outcomes over outputs |
| **Tech Lead** | "Tech Lead mode" | Code quality, patterns, pragmatic implementation |
| **Designer** | "Designer mode", "Make it look premium" | Visual quality, design systems, `4-context/design/` |
| **Code Archaeologist** | "Archaeologist mode", "Explain this codebase", "Deepen the architecture" | Legacy code, refactoring strategy, Chesterton's Fence, deep modules / narrow interfaces (drives the `deepen` workflow) |
| **Security Auditor** | "Security mode", "Check security" | OWASP Top 10, supply chain, zero trust, pentest methodology |
| **Database Architect** | "Database mode", "Design the schema" | Schema design, query optimization, migrations |
| **Performance Optimizer** | "Performance mode", "Make it faster" | Core Web Vitals, profiling, bundle size |
| **Maker** | "Maker mode" | Spec-compliant, sandboxed TDD code generation |
| **Checker** | "Checker mode" | Independent skeptical audits, programmatic testing, anti-reward hacking |
| **Conductor Assistant** | "How does this work?" | Framework navigation, workflow selection, process guidance |

---

## Skill Registry CLI (Dynamic Skill Loading)

Beyond the skills bundled in `.agents/skills/`, more can be pulled from a registry you configure:

```bash
conductor list [--remote]        # local or registry skills
conductor search <query>         # search the registry
conductor add <skill-name>       # install a skill
conductor remove <skill-name>    # uninstall a skill
```

Requires `conductor.config.json` at the project root pointing at your registry. `conductor init` runs tech-stack detection and suggests relevant skills to add automatically.

---

## Progressive Disclosure — Adoption Levels

Not everyone needs the full system. This is a *framework-adoption* scale — distinct from context-loading progressive disclosure (the universal `rules/` — prime-directive, verification-iron-law, test-driven-law — are always-on; `loop-guardrails` is loop-scoped and loaded only by the unattended-loop workflow; everything else, including this file, loads on demand).

### Level 1: Just Ship
Use: `task-backlog.md`, Quick-Path, Build, Ship, Archive.
Good for: solo devs, quick features, known scope.

### Level 2: Plan Then Ship
Add: Spec-It, Carve, `3-product-areas/`.
Good for: complex features that need a PRD and an architecture pass.

### Level 3: Full Pipeline
Add: Genesis, Storyboard, Blueprint workflows, Retrospective, all personas.
Good for: new products, major feature areas, high-velocity AI-assisted development.

---

## Self-Test

```bash
bash .agents/tests/check-conductor.sh
```

Validates structure, naming, and that no stale paths have crept back in.
