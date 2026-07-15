# Changelog

All notable changes to the Conductor Framework will be documented in this file.

---

## [6.1.0] — 2026-07-15 — Multi-Agent Across Workflows

Brings the V6 loop backend's multi-agent capability to the everyday workflows — retro-compatibly and proportionately. Two mechanisms recur: **empty-context** agents (a reviewer/verifier that never saw the producing context, for honest judgment) and **parallelization** (independent sub-tasks in isolated contexts, merged). Every enhancement degrades gracefully — an isolated subagent when the platform supports one, else a deliberate fresh-context self-pass or sequential inline work — and each gate is one-per-artifact, never per-step. Two new reusable primitives (`independent-review`, `judge-panel`) that the rest of the framework composes with. No breaking changes; `conductor upgrade` lands the new skills on existing installs.

### Added — Independent-review gate for blueprint artifacts
- **`independent-review` skill (`.agents/skills/independent-review/SKILL.md`)** — Ship Phase 4's fresh-context Maker/Checker gate, extracted into a reusable primitive: a reviewer that did *not* produce the artifact returns a binary `APPROVE`/`CHANGES REQUESTED` verdict before the artifact is saved or handed off, with a fix loop and per-artifact review lenses (PRD, architecture, spec+plan, carve slicing, diff). Retro-compatible — spawns an isolated subagent when the platform supports one, else degrades to a deliberate fresh-context self-pass; one gate per artifact, not per step.
- **Wired into the blueprint workflows** — Grand-PRD, Technical-Vision, Spec-It, and Carve now run the gate before writing their artifacts, closing the gap where blueprint specs/architectures were saved with no independent review (unlike shipped diffs, which already had Ship Phase 4). Technical-Vision routes the reviewer to a strong model tier given the artifact's downstream leverage.
- **Ship Phase 4** now references the skill as its reference implementation (single source of truth for the gate's mechanics); behavior unchanged.
- Registered in `registry.json` (core bundle), the self-test (`check-conductor.sh`), and `how-it-works.md`.

### Added — Judge-panel decision primitive
- **`judge-panel` skill (`.agents/skills/judge-panel/SKILL.md`)** — divergent-then-convergent decision-making for wide, hard-to-reverse forks: generate N candidates from deliberately different angles (simplest-that-works / risk-first / leverage-first), score them with independent judges against fit / simplicity / risk / evolvability / team-fit, then synthesize the winner while grafting the best of the runners-up. Opt-in (only when the space is genuinely wide); retro-compatible (parallel isolated authors when a subagent primitive exists, else sequential in-context divergence, floor of two real candidates). Guards against divergent generation's bias toward cleverness — simplicity breaks ties and the deletion test is mandatory on the synthesis.
- **Wired into Technical-Vision Phase 3 (architecture)** as an opt-in method; composes with the independent-review gate (the panel *produces* the architecture, the gate *checks* it). Registered in `registry.json`, `check-conductor.sh`, and `how-it-works.md`.

### Changed — Scouts & fresh-context gates across the remaining workflows
- **Genesis** (Phase 0 context scan) can fan out **parallel scouts** (prior `conductor/` docs, relevant code, prior art in the problem space) when there's real ground to cover — keeping raw file dumps out of the interview thread; kept at Genesis's problem/capability altitude (no tech-stack eval). Skip inline for greenfield.
- **Spec-It** (Phase 0) gains a **codebase-inventory scout** — the blueprint says *what* to build; the scout reports *what already exists* (files to change, utilities/patterns to reuse) so the spec's Dependencies and the plan's Files & Components are grounded in reality, not guesses.
- **Retrospective** (Phase 1) can **mine evidence in parallel** (git history, tracker evidence column, ship-log, trace, CI logs) so Phase 2's lessons are concrete facts, not memory — and a fresh-context read resists rationalizing one's own work.
- **UX/UI Design Brief** — Phase 2 offers **2–3 divergent navigation options** (human as judge) when the nav pattern is genuinely contested; Assembly adds a **fresh-context design gate** (independent-review with a `ux-reviewer` lens against the Design System), the design-flavored sibling of the blueprint review gate.
- **Build** — documented that parallel execution of independent tasks is the **swarm's** job (unattended, L3), not interactive Build, whose one-task-at-a-time rule deliberately preserves per-task human oversight.

### Added — TDD test-author → implementer split (opt-in, swarm)
- **`src/loop/swarm.js`** grew an opt-in two-phase task lifecycle: a **test-author** writes the failing tests first (the contract), then a separate **implementer** in its own context makes them pass and is forbidden to touch the tests — making reward-hacking structural (the agent that greens the code can't move the goalposts it didn't write). Enabled by `state.tdd_split` (swarm-wide) or a task's `contract_first` (per-task override); off by default. The contract phase's success is **RED** (a green suite before any implementation is a vacuous contract and is rejected); once RED is confirmed the implementer takes over. New `test-author` role archetype; the implementer reuses the `maker` archetype, so the implementation phase resolves **identically** to the non-split path — `concurrency=1` with the split off reproduces the pair exactly (regression guard holds). `normalizeState` carries `tdd_split`; `runBeat` forwards `role`/`phase` to the adapter.
- **Prose:** `unattended-loop.md` documents the two per-beat roles; `test-driven-law.md` gains an *interactive vs. unattended* section (the tight one-mind loop stays the interactive default — the split is unattended-only); `model-routing` notes test-author needs strong spec comprehension. Covered by 4 new `node:test` cases (76 total).

### Changed — Independent Checker at Build's batch checkpoint
- **`build` Phase 2 (Checkpoint)** now runs the `independent-review` gate (Diff lens) once per **batch** — a reviewer that did not write the batch checks spec compliance, quality, and whether the new tests are meaningful or reward-hacked. Closes the gap where Build's only review was the Maker's per-task **self**-review (Step 4), with no independent eyes until Ship. Proportionate (skip for small low-risk batches where the human at the checkpoint is the fresh reviewer; one gate per batch, never per task) and non-duplicative (at L3 the driver's out-of-process Checker already covers each beat — this is the interactive equivalent). Step 4 is reframed as the Maker's self-review, symmetric with Ship's Empathy Audit split.

### Changed — Parallel hypothesis testing in systematic-debugging
- **`systematic-debugging` Phase 3 (Understand)** now supports fanning out **one empty-context scout per hypothesis** when there are 3–5 genuinely independent, non-trivial hypotheses: each scout gets only the red command, its one assigned hypothesis, and the kill-criterion, and runs in its own isolated context (a separate worktree if it instruments code) so probes never confound each other and no scout anchors on another's theory. The orchestrator merges verdicts (one survivor → 5 Whys; none → completeness pass + fresh set; several → compound cause) and **re-confirms against the red command before trusting any scout** (Verification Iron Law). Sequential one-at-a-time remains the default and the graceful-degradation floor; new anti-patterns guard against confounded shared-tree probes, trusting an unverified scout, and fanning out a one-liner.

## [6.0.0] — 2026-07-14 — V6 Enforcement & Autonomy Rebalance

Implements `docs/adr/0001-enforcement-and-autonomy-rebalance.md`. The autonomy-backend (deterministic loop driver, adapters, sandbox/isolation, autonomy slider, swarm) is now built — see `docs/roadmap/Autonomous-Loop-Backend.md`; only a published/maintained turnkey sandbox image and a real-LLM CI run remain.

### Added — Robust cross-version upgrade (V4/V5/unversioned → 6.0.0)

`upgrade` was reworked on one principle: **`conductor/` project knowledge is preserved; `.agents/` methodology is replaced.** See `docs/roadmap/Robust-Upgrade-Migration.md`.
- **Version stamp** (`src/version.js`) — `init`/`upgrade` write `.agents/.conductor-version.json` (framework version read from `package.json`), making upgrades version-aware and idempotent. Unstamped installs are detected by structure (V4 vs V5).
- **Backup-first + rollback** (`src/backup.js`) — the existing `.agents/`, `conductor/5-templates/`, migrated legacy folders, and `loop-state.json` are copied to a git-ignored `.conductor-backup/<timestamp>/` before any change; a mid-run failure auto-restores.
- **Ownership-based replacement** (`src/update.js`) — framework-owned files (anything shipping in `templates/**`) are now **replaced wholesale** (the old checksum-gated `SKIP` that silently kept stale/edited instructions — and silently no-op'd checksum-less V4 installs — is gone). User-authored additions are carried forward; core rules/workflows/skills (incl. the new interview/drafting/handoff primitives) always land even if absent from a stale `.selections.json`.
- **`conductor/5-templates/` refresh** — framework document scaffolding is refreshed on upgrade; user knowledge folders (`0-compass`, `2-backlog`, `3-product-areas`, `4-context`, `6-archive`) are never touched.
- **Managed platform stubs** (`src/stubs.js`) — `CLAUDE.md`/`GEMINI.md` now wrap their framework portion in `<!-- conductor:managed:begin/end -->` markers. `upgrade` refreshes only that block (so the stub header, `/loop`, and slash-command sections stay current) while preserving anything you write outside it; legacy stubs with no markers get the block inserted and their old content preserved below. `CHANGELOG.md` remains create-if-absent — it's your project's changelog, not the framework's.
- **Loop-state schema migration** — `loop-state.json` is migrated to the current schema during `upgrade` (reusing the driver's `normalizeState`), no longer only lazily on first run.
- **Safer kebab engine** (`src/kebab.js`) — renames only framework-scaffolded names (numbered folders, not arbitrary user files), no longer silently clobbers on collisions, and leaves canonically-cased files (`Dockerfile.sandbox`) alone.
- **`--dry-run`** prints the full plan and writes nothing; **`--no-backup`** opts out of the backup.
- Covered by `test/upgrade.test.js`.

### Changed
- **Version → 6.0.0.**

### Added
- **Deterministic enforcement hooks (D1)** — `.agents/hooks/` ships a Test-Driven-Law `pre-commit` (blocks implementation changes with no test change) and a Verification-Iron-Law `pre-push` (blocks a push whose verification command fails). Logged escape hatches (`CONDUCTOR_NO_TEST`, `CONDUCTOR_SKIP_VERIFY`, `CONDUCTOR_HOOKS=off`) and an opt-in interactive Claude Code Stop hook. Wired by the new `conductor install-hooks` command, auto-run by `init`/`upgrade` in a git repo. Prose laws are now backed by code.
- **Claude Code slash-command bridge (D5)** — `init`/`upgrade` generate `.claude/commands/<name>.md` shims per workflow, so `/build`, `/carve`, `/spec-it`, … work natively in Claude Code. Derived from the installed workflow set; stale shims pruned by marker; foreign commands preserved.
- **`domain-modeling` skill (D6)** — active ubiquitous-language discipline producing a living `conductor/4-context/meta/domain-model.md`; wired into Technical Vision (name the domain before the data model).
- **`subagent-isolation` skill** — the scout pattern: delegate read-heavy discovery, parallelize independent investigations, isolate mutating work in worktrees.
- **`model-routing` skill** — match model tier + reasoning effort to task difficulty.
- **Registry supply-chain scanning** — `conductor add` scans downloaded `SKILL.md` for prompt-injection/secret/dangerous-shell patterns; critical findings block install unless `--allow-unsafe`.

### Added — Autonomous Loop Backend (`conductor loop`, Phases 1–4)
- **Deterministic driver (Phase 1)** — `conductor loop` subcommand over a pure, testable state machine (`src/loop/driver.js`): the host runner owns the iteration ceiling, wall-clock budget, driver-observable stall detection (git HEAD + verify output), the Evidence Rule (verification exit code forces the verdict), the Scoping Barrier, and fail-safe verify resolution (mirrors the pre-push hook's `conductor_verify_cmd`). `loop-state.json` schema v2 (auto-migrates v1 on load). Replaces the V5 `scripts/run-conductor-loop.js` stub (deleted).
- **Platform adapters (Phase 2)** — the driver is platform-agnostic; registry/resolver (`src/loop/adapters/`) with **Claude Code** (primary), **Antigravity**, and **Codex** adapters. Selection: `--platform` → `loop-state.json.platform` → auto-detect.
- **Isolation (Phase 3)** — git-worktree isolation for the Maker; the independent **Checker as a separate process** (verdict via `checker-verdict.json`, fail-safe reject); document-only sandbox gate (`sandbox: none|container` + `templates/.agents/sandbox/`; L3 refused without a container → `halted_sandbox_required`).
- **Autonomy slider + merge + swarm (Phase 4)** — L0–L3 enforced in the driver (L0 interactive-only, L1 single-beat → `awaiting_review`, L2 blueprint-only, L3 execution); **PR-gated merge** via `gh`/`glab` (never a direct push); auditable action trail to `0-compass/ship-log.md`; **multi-vote adversarial Checker** (`checker_votes`, majority); and the opt-in **swarm** (`src/loop/swarm.js`: task-graph blackboard, frontier scheduler, specialized roles, concurrent Makers, serialized PR-gated merge queue). `concurrency=1` reproduces the pair exactly.
- **Maker completion signal** — the Maker writes `maker-signal.json`; the driver reads it from disk (never trusts clobberable in-memory state), symmetric with the Checker verdict.

### Added — Interview & Drafting Primitives (Pocock alignment)

Draws from [Matt Pocock's skills](https://github.com/mattpocock/skills) where it sharpens ours, keeping Conductor's stronger stances where they diverge. See `docs/roadmap/Pocock-Alignment-Backlog.md`.

- **`grilling` skill** — the interview primitive (one question at a time, recommend an answer to each, look facts up instead of asking, one convergence gate). Single source of truth for the interview technique.
- **`collaborative-drafting` skill** — the drafting primitive (lead with a complete draft the human corrects: propose → discuss → coverage-check → confirm). The document-scale counterpart to `grilling`.
- **`handoff` skill** — compact a conversation into a self-contained handoff doc before leaving the ~120k-token "smart zone"; reference artifacts by path, redact secrets. Includes loop context-hygiene guidance.

### Changed — interview/blueprint workflows onto primitives

- **Genesis, Storyboard, Grand PRD, UX/UI Design Brief** rewritten to supply only their *agenda* + templates and load `grilling` + `collaborative-drafting` for the *how* — deleting duplicated Communication-Style blocks, ~14 per-phase Advancement Gates, and Stage-Setting scripts (the UX/UI Brief went 448→90 lines, 7 gates → 1 at save).
- **Spec-It** reworked to **synthesize, not re-interview** (Pocock `to-spec`): drafts specs from the locked blueprint context and grills only genuine gaps; added a Testing-Decisions/seams element feeding Build's TDD.
- **Quick-Path, Retrospective, Technical Vision, Carve** now reference the primitives instead of restating the interview inline.
- **`tdd-cycle`** — agree test seams first (highest useful seam, ideal one), vertical slices, and anti-pattern tells (implementation-coupled / tautological / horizontal). Kept our mandatory in-loop REFACTOR (stronger than Pocock's defer-to-review).
- **`code-review`** — Stage 2 gains a fixed **Fowler smell baseline** + "the repo overrides / skip what tooling enforces." Kept our sequential spec→quality gate (not Pocock's parallel two-axis).
- **`systematic-debugging`** — "build a command that goes red on *this* bug first" as the prime move, a ranked repro-method ladder, 3–5 ranked falsifiable hypotheses, and write-the-regression-test-before-the-fix.
- **`technical-vision`** — the deep-module **deletion test** for module boundaries and the **ADR 3-test gate** for when to record a decision.
- **`ship`** — merge/rebase-conflict discipline (recover intent from primary sources, never reflexively `--abort`).

### Changed
- **Carve** — tracer-bullet first-slice guidance (walking skeleton over foundation-first) and a ubiquitous-language naming rule.
- **`unattended-loop` / `loop-guardrails` reconciled** — the soft layer no longer performs driver-owned bookkeeping (iteration/stall counters, `maker_active`, in-context Checker); the driver is the authority, the prose is guidance.
- **`loop-guardrails` demoted (D2)** — from `always_on` to loop-scoped; loaded explicitly by the `unattended-loop` workflow, so interactive sessions don't pay for it.
- **Refactor at review stage (D10)** — `code-review` Stage 2 gains a cross-cutting refactoring pass that complements (never replaces) the mandatory per-increment REFACTOR in the TDD loop.

### Tests
- Self-test grows to 113 checks (new skills incl. the interview/drafting/handoff primitives, enforcement hooks, slash-command bridge, loop backend + v2 schema).
- `node:test` unit suite (`npm run test:unit`, 72 cases — loop driver/adapters/isolation/autonomy/merge/swarm + cross-version upgrade + managed stubs; no agent CLI spawned) and an end-to-end smoke test with a fake agent (`npm run test:smoke`).

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
