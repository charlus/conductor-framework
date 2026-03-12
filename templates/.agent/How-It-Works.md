# How Conductor Framework V4 Works

An overview of how the system is structured, how things flow, and what each piece does.

---

## Folder Structure

```
your-project/
├── .agent/                       # Agent Core (Workflows, Skills, Personas)
│   ├── AGENTS.md                 # System instructions — auto-discovered entry point
│   ├── How-It-Works.md           # This file - system overview
│   ├── workflows/                # Agent Workflows (Genesis → Build)
│   ├── skills/                   # Atomic Skills (Verification, Review, etc.)
│   ├── personas/                 # Judgment partners (CTO, PM, etc.)
│   └── tests/                    # Framework self-test scripts
├── .conductor/                   # Project State (all managed artifacts)
│   ├── 0-Compass/                # Direction & goals
│   ├── 1-Workbench/              # Active work area
│   ├── 2-Backlog/                # Queue for ready work
│   │   ├── Task-Backlog.md       # Small tasks
│   │   ├── Project-Backlog/      # Projects (contain multiple implementations)
│   │   └── Implementation-Backlog/
│   ├── 3-Product-Areas/          # Inventory of features & tribal knowledge
│   ├── 4-Context/                # Tribal Knowledge
│   │   ├── Identity/             # Problem, Vision, Brand Voice
│   │   ├── Design/               # Design System, Assets
│   │   ├── Technical/            # Tech Stack, Architecture
│   │   ├── Product/              # Strategy, Roadmap
│   │   └── Meta/                 # Decision Log, Glossary
│   ├── 5-Templates/              # Document templates
│   └── 6-Archive/                # Completed work
├── GEMINI.md                     # Gemini auto-discovery stub
├── CLAUDE.md                     # Claude auto-discovery stub
└── CHANGELOG.md                  # Framework version history
```

---

## What Each Folder Is For

### 0-Compass
Your North Star. The "where are we going?" layer.
- **North Star** — The one metric that defines success
- **Ship-Log** — A chronological victory log of everything you've shipped

### 1-Workbench
The daily workspace. Where focus happens.
- **Inbox** — Dump everything here. Process later.
- **Scratchpad** — Temporary notes.
- **Active Implementation** — When you start building, move its folder here from the Backlog.

### 2-Backlog
The "To Do" queue. It has three tiers:
- **Project-Backlog/** — Projects containing Genesis, Storyboard, Grand PRD, and multiple Implementations.
- **Implementation-Backlog/** — Individual Implementations (Feature Spec + Implementation Plan) ready to be built.
- **Task-Backlog.md** — Small stuff (bugs, tweaks) that doesn't need a full plan.

### 3-Product-Areas
The "Product Map." Organized by domain (e.g., `Auth/`, `Billing/`).
Each Area contains three standard files:
1. **[Area]-Features.md** — What users can do (updated after every Build via Context-Updater)
2. **[Area]-Technical.md** — How it works (updated after every Build via Context-Updater)
3. **[Area]-Epics.md** — Future ideas and big problems to solve

### 4-Context
The project's "Tribal Knowledge." Context specific to YOUR product.
- **Identity/** — Problem, Vision, Target User, Brand Voice.
- **Design/** — Design System, UI Components, Brand Assets.
- **Technical/** — Tech Stack, Architecture, Coding Patterns.
- **Product/** — Growth Strategy, Future Plans.
- **Meta/** — Decision Log, Glossary.

### .agent
The Agent's Operational Core.
- **AGENTS.md** — System prompt — the routing contract, request classifier, and Verification Iron Law
- **workflows/** — Step-by-step guides that *produce* artifacts through a defined process
- **skills/** — Atomic capabilities that *execute* discrete actions
- **personas/** — Judgment partners that embody ways of *thinking*

### 5-Templates
Standard structures for creating artifacts:
- **Individual Files:** PRD, Agentic-Flow, Persona, Skill
- **Genesis-Workflow/**: Problem-Solar-System, World-Transformation, Functional-Animator
- **Storyboard-Workflow/**: Main-Character, Storyboard
- **Blueprint-Workflows/**: Grand-PRD, UX-UI-Design-Brief, Technical-Vision
- **Carve-Workflow/**: Implementation-Overview, Project-Documentation, Feature-Spec, Implementation-Plan
- **Folders:** New-Product-Area (Starter Kit)

### 6-Archive
Where completed work goes.
- **Completed-Projects/** — Full projects after all implementations ship
- **Completed-Implementations/** — Standalone implementations after shipping

---

## Core Principles

### Folder = State
We don't update status fields. We move folders.
- `2-Backlog/` = Queued
- `1-Workbench/` = Active
- `6-Archive/` = Done

### Verification Iron Law
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE. This applies globally to all workflows and skills. Run the command. Read the output. Then claim the result.

### Context First. Plan Second. Build Third.
Never rush to solution. Read `4-Context/` and `3-Product-Areas/` before acting.

### Naming Convention: Title-Case-Kebab
All framework files use **Title-Case-Kebab**:
- Workflows: `Grand-PRD.md`, `Quick-Path.md`
- Skills: `Code-Review/`, `Task-Tracker/`
- Personas: `Product-Manager.md`, `Conductor-Assistant.md`
- Templates: `Genesis-Workflow/`, `Blueprint-Workflows/`

---

## System Flow

### Full Pipeline (Projects)

```
Genesis → Storyboard → Grand PRD → UX/UI → Technical Vision → Carve → Spec-It → Build → Retrospective
   |          |            |          |           |                |         |         |         |
Problem    Experience   Epics     Screens    Architecture      Slices    Specs      Code    Lessons
```

### Fast Track (Standalone)
```
Quick-Path → Build → (optional) Retrospective
     |          |
  Scope+Spec   Code
```

### Task Only
```
Task-Backlog.md → Do it → Ship-Log
```

---

## Workflow Registry

### Discovery Workflows
| Workflow | Trigger | Produces | Next |
|----------|---------|----------|------|
| **Genesis** | "I have an idea", "New app", "New feature area" | Problem Solar System, World Transformation, Functional Animator | Storyboard |
| **Storyboard** | "Shape the experience" | Main Character, Scenes | Grand PRD |

### Blueprint Workflows
| Workflow | Trigger | Produces | Next |
|----------|---------|----------|------|
| **Grand PRD** | "Create PRD" | Epics in `Blueprint/Grand-PRD.md` | UX/UI Design Brief |
| **UX/UI Design Brief** | "Design the interface" | Screens in `Blueprint/UX-UI-Design-Brief.md` | Technical Vision |
| **Technical Vision** | "Architecture" | Architecture in `Blueprint/Technical-Vision.md` | Carve |

### Execution Workflows
| Workflow | Trigger | Produces | Next |
|----------|---------|----------|------|
| **Carve** | "Break it down" | Implementation slices + folders | Spec-It |
| **Spec-It** | "Write the spec" | Feature Spec + Implementation Plan | Build |
| **Build** | "Let's code" | Working code + Ship-Log entry | Retrospective |
| **Quick-Path** | "Just build this" | Spec + Plan + Code (all in one) | Retrospective |
| **Retrospective** | "Let's reflect" | Lessons + knowledge base updates | — |

---

## Context File Manifest

Every workflow produces documents and every downstream workflow consumes them. Here is the full chain:

| Upstream Workflow | Produces | Consumed By |
|-------------------|----------|-------------|
| **Genesis** | `Genesis/Problem-Solar-System.md`, `World-Transformation.md`, `Functional-Animator.md` | Grand PRD (explicitly), Technical Vision (for constraints) |
| **Storyboard** | `Storyboard/Main-Character.md`, `Storyboard.md` | Grand PRD (explicitly) |
| **Grand PRD** | `Blueprint/Grand-PRD.md` | UX/UI, Technical Vision, Carve, Spec-It (all explicitly) |
| **UX/UI Design Brief** | `Blueprint/UX-UI-Design-Brief.md` | Technical Vision, Carve, Spec-It (all explicitly) |
| **Technical Vision** | `Blueprint/Technical-Vision.md` | Carve, Spec-It (all explicitly) |
| **Carve** | `Blueprint/Implementation-Overview.md`, `Implementations/` folders | Spec-It (explicitly) |
| **Spec-It** | `Feature-Spec.md`, `Implementation-Plan.md` | Build (explicitly) |
| **Build** | Working code, `Task-Tracker.md`, Ship-Log entry | Retrospective, Context-Updater |
| **Retrospective** | Lessons, knowledge base updates | `3-Product-Areas/`, `4-Context/` files |

---

## Skill Registry

### Core Skills
| Skill | Trigger | Purpose |
|-------|---------|---------|
| **Verification-Gate** | Before any completion claim | Enforces the Iron Law: evidence before assertions |
| **Task-Tracker** | During Build execution | Maintains live task table, updated at every state change |
| **Code-Review** | After implementing code | Two-stage review: spec compliance → code quality |
| **Context-Updater** | After Build or Retrospective | Updates Product Areas and Context with what was learned |
| **Brain-Dump-to-Epics** | "Refine my ideas" | Transforms unstructured ideas into Epics |
| **System-Janitor** | "Clean up files" | Scans for misplaced files, recommends reorganization |
| **UX-Reviewer** | "Review this design" | Provides UX feedback against Design System |

### Design Skills (require Stitch MCP)
| Skill | Purpose |
|-------|---------|
| **Design-Md** | Analyze Stitch projects and synthesize a semantic design system into DESIGN.md |
| **Enhance-Prompt** | Transform vague UI ideas into polished, Stitch-optimized prompts |
| **Stitch-Loop** | Iterative website building using Stitch with autonomous baton-passing |
| **React-Components** | Convert Stitch designs into modular React components |
| **Shadcn-UI** | Expert guidance for shadcn/ui component integration |
| **Remotion** | Generate walkthrough videos from Stitch projects |
| **NotebookLM-Research** | Conversational research partner using NotebookLM |

### Engineering Skills
| Skill | Purpose |
|-------|---------|
| **Systematic-Debugging** | 4-phase debugging with root cause analysis |
| **Clean-Code** | Pragmatic coding standards — concise, direct, no over-engineering |
| **Testing-Patterns** | Unit, integration, and mocking strategies |
| **Frontend-Design** | Design thinking for web UI — components, layouts, typography |
| **Documentation-Templates** | README, API docs, code comment standards |
| **Deployment-Procedures** | Safe deployment workflows and rollback strategies |
| **I18n-Localization** | Internationalization patterns and translation management |
| **Git-Worktrees** | Parallel development using git worktrees |

### Git Integration Skills
| Skill | Purpose |
|-------|---------|
| **Git-Workflow** | Commit conventions, branch naming, PR/MR templates |
| **GitLab-CLI** | GitLab workflow using `glab` CLI |
| **GitHub-CLI** | GitHub workflow using `gh` CLI |
| **Architecture-Patterns** | Architectural decisions, pattern selection, trade-off analysis |

---

## Persona Registry

| Persona | Trigger | Thinks About |
|---------|---------|-------------|
| **CTO** | "CTO mode" | Long-term tech strategy, build vs. buy, technical debt |
| **Architect** | "Architect mode" | System structure, data models, interfaces, boundaries |
| **Product Manager** | "PM mode" | User value, prioritization, outcomes over outputs |
| **Tech Lead** | "Tech Lead mode" | Code quality, patterns, pragmatic implementation |
| **Designer** | "Designer mode", "Make it look premium" | Visual quality, design systems, Stitch integration, `4-Context/Design/` |
| **Code Archaeologist** | "Archaeologist mode", "Explain this codebase" | Legacy code, refactoring strategy, Chesterton's Fence, Strangler Fig |
| **Security Auditor** | "Security mode", "Check security" | OWASP Top 10, supply chain, zero trust, pentest methodology |
| **Database Architect** | "Database mode", "Design the schema" | Schema design, query optimization, migrations, platform selection |
| **Performance Optimizer** | "Performance mode", "Make it faster" | Core Web Vitals, profiling, bundle size, perceived speed |
| **Conductor Assistant** | "How does this work?" | Framework navigation, workflow selection, process guidance |

---

## Progressive Disclosure

Not everyone needs the full system. Start simple.

### Level 1: Just Ship
**Use:** Task-Backlog, Quick-Path, Build, Archive.
**Good for:** Solo devs, quick features, known scope.

### Level 2: Plan Then Ship
**Add:** Spec-It, Carve, Product-Areas.
**Good for:** Complex features that need PRDs and Architecture.

### Level 3: Full Pipeline
**Add:** Genesis, Storyboard, Blueprint, Retrospective, all Personas.
**Good for:** New products, major feature areas, high-velocity AI-assisted development.

---

## Self-Test

Run the framework validation suite to verify structural integrity:

```bash
bash .agent/tests/check-conductor.sh
```

This validates all files exist, naming is correct, and version references are consistent.