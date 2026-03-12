# Changelog

All notable changes to the Conductor Framework will be documented in this file.

---

## [4.2.0] — 2026-03-12

### Changed
- **`.conductor/` wrapper** — All numbered folders (0-Compass through 6-Archive) now live inside `.conductor/` for a clean project root. Updated all 16 framework files.
- **`ai-init.md` → `AGENTS.md`** — Renamed to industry-standard convention and moved to `.agent/AGENTS.md`. Removed `.agent/rules/` folder.
- **Platform stubs** — Created `GEMINI.md` and `CLAUDE.md` at root for auto-discovery by platform-specific AI tools.
- **Build Phase 4 (Ship & Close)** — Rewritten with 6 structured steps. New "Document to Platform" step detects git hosting via CLI auth and handles: issue updates/closing, release notes, wiki/documentation updates.

### Added
- **NPX installer** — `npx conductor-framework init` scaffolds the full framework. Supports `--force` and `--agent-only`.
- **README.md** — Package README with install instructions and credits to all source frameworks.
- **Dynamic Skill Loading** — Parked as backlog item for V5.

---

## [4.1.0] — 2026-03-12

### Added
- **4 New Personas** — Code-Archaeologist (legacy code expert), Security-Auditor (OWASP + pentest), Database-Architect (schema & queries), Performance-Optimizer (Core Web Vitals)
- **Architecture-Patterns skill** — Pattern selection, trade-off analysis, context discovery (5 files)
- **Skill sub-files** — Frontend-Design (+7 guides: color, typography, animation, UX psychology, visual effects, motion, decision trees), Systematic-Debugging (+5 files: root-cause-tracing, condition-based-waiting, defense-in-depth, find-polluter.sh)
- **Self-test script** — `bash .agent/tests/check-conductor.sh` validates entire framework structure
- **Selective Skill Loading rule** — Read SKILL.md first, then only sub-files matching the task

### Changed
- **`ai-init.md`** — Added 4 new persona triggers and selective loading rule
- **`How-It-Works.md`** — Updated registries (10 personas, 27 skills) and added self-test section
- **`Conductor-Assistant.md`** — Updated with full V4.1 knowledge

---

## [4.0.0] — 2026-03-12

### Added
- **Designer persona** — Visual perfectionist with Stitch MCP integration
- **7 Design skills** — Design-Md, Enhance-Prompt, Stitch-Loop, React-Components, Shadcn-UI, Remotion, NotebookLM-Research
- **9 Engineering skills** — Systematic-Debugging, Clean-Code, Testing-Patterns, Frontend-Design, Documentation-Templates, Deployment-Procedures, I18n-Localization, Lint-And-Validate, Git-Worktrees
- **3 Git skills** — Git-Workflow (conventions), GitLab-CLI (glab), GitHub-CLI (gh)
- **Naming convention rules** — Title-Case-Kebab standardized across the framework
- **Git commit step** in Build workflow (Step 5: commit after each verified task)
- **PR/MR creation** step in Build Phase 4 (Ship & Close)

### Changed
- **`ai-init.md`** — Added Designer persona routing and git routing
- **`Build.md`** — Added git commit step (Step 5) and PR/MR creation in Ship & Close
- **`How-It-Works.md`** — Updated with all V4 registries (6 personas, 26 skills)
- **`Conductor-Assistant.md`** — Updated with full V4 knowledge

### Removed
- **`design-kit/`** folder — Contents moved into `.agent/personas/` and `.agent/skills/`

---

## [3.0.0] — 2026-03-12

### Added
- **Build workflow** — The missing execution phase. 5 phases: Setup, Execute Batch (with two-stage review), Checkpoint, Final Verification, Ship & Close
- **Quick-Path workflow** — Fast-track for standalone implementations. Skip Genesis/Storyboard when scope is clear
- **Retrospective workflow** — Post-shipping feedback loop. Extract lessons, update knowledge base
- **Verification-Gate skill** — Enforces the Iron Law: "No completion claims without fresh evidence"
- **Task-Tracker skill** — Live task tracking during Build execution
- **Code-Review skill** — Two-stage review: spec compliance first, then code quality
- **Context-Updater skill** — Keeps Product Area and Context files alive after builds
- **Request Classifier** in `ai-init.md` — Routes requests by type before any work starts
- **User guidance** ("🧭 Not sure?") in `ai-init.md` — Helps confused users choose the right workflow
- **Verification Iron Law** as a global rule in `ai-init.md`

### Changed
- **`ai-init.md`** — Rewritten from encyclopedia (106 lines) to routing contract (~100 lines)
- **`Technical-Vision.md`** — Expanded from 95 to 231 lines. Added explicit Read directives, AI-proposes-first, exploration loops, gaps checks, CTO persona hook
- **`Carve.md`** — Expanded from 86 to 210 lines. Added priority execution order (P0→P3), explicit Read directives, dependency mapping, cross-reference checks
- **`Conductor-Assistant.md`** — Updated to know about all V3 capabilities
- **`How-It-Works.md`** — Rewritten to reflect V3 structure

### Fixed
- Stale path `4-AI-Brain/` → `4-Context/` in `UX-Reviewer/SKILL.md`

---

## [2.0.0] — 2025-01-30

### Initial Release
- Genesis, Storyboard, Grand-PRD, UX-UI-Design-Brief, Technical-Vision, Carve, Spec-It workflows
- CTO, Architect, Product-Manager, Tech-Lead, Conductor-Assistant personas
- Brain-Dump-to-Epics, System-Janitor, UX-Reviewer skills
- Folder = State kanban model
- Three-tier backlog system
