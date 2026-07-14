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
│   ├── cli.js                 # Argument parser (init, upgrade, add, remove, list, search)
│   ├── detect.js               # Tech stack detection (used by init for skill recommendations)
│   ├── registry.js             # Remote skill registry client (fetch index, download, glab/gh auth)
│   ├── selective-copy.js       # Interactive/selective template copy for init
│   ├── kebab.js                 # kebab-case rename + checksum-key migration (used by upgrade)
│   ├── update.js                # Diffs installed vs. latest templates for upgrade
│   ├── bundles.js / checksums.js / prompt.js
│   └── commands/
│       ├── init.js            # Scaffolds .agents/ + conductor/ into target
│       ├── upgrade.js         # Replaces .agents/, kebab-case migration, conductor/ migration
│       ├── add.js             # Downloads a skill from the remote registry
│       ├── remove.js          # Removes an installed skill
│       ├── list.js            # Lists installed or remote (--remote) skills
│       └── search.js          # Searches the remote registry
├── templates/                 # THESE files get installed into user projects
│   ├── .agents/                # Agent core (AGENTS.md, how-it-works.md, registry.json, rules, workflows, skills, personas)
│   ├── conductor/              # Project state (numbered folders 0-compass..6-archive)
│   ├── conductor.config.json   # Registry URL config (used by add/list/search)
│   ├── GEMINI.md               # Platform stub (for installed projects, not this repo)
│   ├── CLAUDE.md
│   └── CHANGELOG.md
├── package.json               # v5.0.0
├── README.md                  # Public-facing with credits
├── CHANGELOG.md               # Package changelog
├── docs/roadmap/               # Design docs for in-progress/parked features
└── this file (CLAUDE.md)      # Development context for AI
```

### Key Distinction

- **`templates/`** = what users get. Edit these when changing the framework.
- **`src/`** = the installer. Edit these when changing the CLI.
- **Root files** = package metadata. This repo does NOT use the Conductor framework itself.

## Design Decisions Made

| Decision | Rationale |
|----------|-----------|
| `.agents/AGENTS.md` (always-on) vs. `.agents/how-it-works.md` (on-demand) | Only `.agents/rules/*.md` and the compact `AGENTS.md` classifier load every session (Progressive Disclosure); `how-it-works.md` carries the full routing table, folder purposes, and registries and is read on demand — restored after a V5 refactor deleted the equivalent file (`rules/conductor-system.md`) without replacing its content |
| `conductor/` wrapper (visible, not dotted) | Keep project root clean but let the human browse/edit their dashboard directly — this is their collaborative workspace, not hidden state |
| Platform stubs (`GEMINI.md`, `CLAUDE.md`) | Each AI platform auto-discovers its own file format |
| kebab-case naming (all of `.agents/` + `conductor/`) | Standardized off legacy Title-Case during the V5 migration; `upgrade` auto-renames existing installs |
| CLI auth detection (not URL regex) | `gh auth status` / `glab auth status` works for self-hosted GitLab |
| No NotebookLM skill in templates | Requires MCP server, too environment-specific for a general framework |
| Remote skill registry (`add`/`remove`/`list`/`search`) | "npm for AI skills" — core skills ship in `templates/`, tech-specific/domain skills download on demand from a `conductor.config.json`-configured registry |
| Test-Driven Law as an always-on `rules/` file, not a skill | TDD needs to be structural, not something an agent has to remember to reach for — same reasoning as the Verification Iron Law. Build's per-task loop now hard-codes RED→GREEN→REFACTOR as Step 2, not a generic "implement" step |
| `Inbox: X` / `Add to inbox: X` / `Scratchpad: X` quick-capture, in the always-on classifier | Some platforms (Claude Code, Antigravity 2.0) expose no file browser — chat is the human's only path into `conductor/1-workbench/`. The rule is deliberately zero-judgment (append verbatim, no workflow, no triage) so it stays as fast as opening a file would have been |
| `Grilling` + `Collaborative-Drafting` interview/drafting primitives as skills, loaded by discovery/PRD/spec/design workflows | The interview technique (Interviewer persona, one-at-a-time questioning, advancement gates) and the "propose-first → discuss → coverage-check → confirm" drafting quartet were duplicated inline across Genesis, Storyboard, Grand-PRD, Spec-It, Technical Vision, Carve, and the Design Brief. Extracted to `skills/grilling/SKILL.md` (extract decisions) and `skills/collaborative-drafting/SKILL.md` (produce documents) as single sources of truth (following Matt Pocock's `grilling` primitive), adding recommend-per-question, look-up-facts-don't-ask, and one convergence gate per document. Genesis, Storyboard, Grand-PRD, and the UX/UI Brief now supply the *agenda* and load the primitives for the *how* — the UX/UI Brief dropped from 448 lines / 7 per-phase gates to one gate at save. Quick-Path, Retrospective, Technical Vision, and Carve reference the primitives too, and Spec-It was reworked to *synthesize-not-re-interview* (Pocock's `to-spec`). Companion sharpening from Pocock's repo, keeping our stronger stances where they diverge: `tdd-cycle` (agree seams first + anti-pattern tells, but kept our in-loop REFACTOR), `code-review` (Fowler smell baseline, but kept our sequential spec→quality gate), `systematic-debugging` (red-command-first), `technical-vision` (deep-module deletion test + ADR 3-test gate), `ship` (merge-conflict discipline), plus a net-new `handoff` skill (context hygiene for the loop). See `docs/roadmap/Pocock-Alignment-Backlog.md` for the full Epic A–E status |

## Current State (V5.0.0 — Hybrid Architecture + Dynamic Skill Loading)

- 15 workflows (incl. loop-checker), 34 skills, 12 personas, 4 rules (3 always-on: prime-directive, verification-iron-law, test-driven-law; loop-guardrails is loop-scoped since the V6 rebalance)
- Deterministic enforcement (ADR-0001 D1): `.agents/hooks/` ships a TDD pre-commit + Verification pre-push, wired via `conductor install-hooks` (auto-run by init/upgrade in a git repo). Prose laws are now backed by code, not just advisory.
- Claude Code adapter: `init`/`upgrade` generate `.claude/commands/*.md` slash-command shims per workflow (ADR-0001 D5)
- Self-test: `bash templates/.agents/tests/check-conductor.sh` → 109 checks; loop unit tests: `npm run test:unit` (`node:test`, 48 cases, no agent CLI spawned)
- **V6 Autonomous Loop Backend — Phases 1, 2, 3 & Phase 4 (pair mode) shipped:**
  - *Phase 1 (driver):* `conductor loop` subcommand over the pure `src/loop/driver.js` (deterministic state machine: iteration ceiling, wall-clock budget, driver-observable stall detection, Evidence Rule via verify exit code, Scoping Barrier, fail-safe verify resolution mirroring `conductor_verify_cmd`). `loop-state.json` migrated to v2 (auto-migrates v1 on load). Soft layer reconciled. V5 `scripts/run-conductor-loop.js` stub deleted.
  - *Phase 2 (adapter interface):* driver is platform-agnostic; adapter registry/resolver `src/loop/adapters/index.js` with `claude.js` (primary) + `antigravity.js`. Selection: `--platform` → `loop-state.json.platform` → auto-detect. Codex adapter deferred.
  - *Phase 3 (isolation):* git-worktree isolation for the Maker (`src/loop/worktree.js`), document-only sandbox gate (`sandbox` field + `templates/.agents/sandbox/`; L3 refused without `sandbox:container` → `halted_sandbox_required`), and the independent Checker as a separate process (`workflows/loop-checker.md` + `src/loop/checker.js`, verdict via `checker-verdict.json`, fail-safe reject).
  - *Phase 4 (autonomy + merge + swarm):* autonomy slider L0–L3 in the driver (`autonomyPreflight`; L0 refuses, L1 single-beat→`awaiting_review`, L2 blueprint-only, L3 execution+PR); PR-gated merge via `gh`/`glab` (`src/loop/merge.js`, never a direct push); auditable trail to `0-compass/ship-log.md`; multi-vote adversarial Checker (`checker_votes`); Codex adapter; and the opt-in **swarm** (`src/loop/swarm.js`: task-graph blackboard, frontier scheduler, specialized roles, concurrent Makers, serialized merge queue — `concurrency=1` reproduces the pair). Maker completion via `maker-signal.json` (driver reads from disk, never clobberable in-memory). New terminals `awaiting_review` + `halted_autonomy`.
  - **Feature-complete.** Only excluded item: a published/maintained turnkey sandbox *image* (Q2 = document-only; we ship the Dockerfile + profile). The swarm is built but stays behind its evidence gate for real-world use. Tests: `npm run test:unit` (60 `node:test` cases) + `npm run test:smoke` (fake-agent e2e). See `docs/roadmap/Autonomous-Loop-Backend.md`.
- Dynamic Skill Loading (see `docs/roadmap/Dynamic-Skill-Loading.md`) — Phases 1–3 shipped (manifests, CLI commands, tech-stack detection during init); Phase 4 (curation pipeline) and Phase 5 (testing) still open
- Published: private GitHub repo `charlus/conductor-framework`

## Open Roadmap Items

- **Skill curation pipeline** — Phase 4 of Dynamic Skill Loading, deferred to the `skills-registry` repo's own backlog
- **Testing & verification** — Phase 5 of Dynamic Skill Loading
- **CHANGELOG.md** — has no entry yet for the V5.0.0 hybrid-architecture/dynamic-skill-loading work; back-fill before the next release

## How to Work on This Repo

1. **Edit templates/** when changing the framework content
2. **Edit src/** when changing the CLI behavior
3. **Always sync templates** after testing changes locally
4. **Run the self-test** after every change: `bash templates/.agents/tests/check-conductor.sh`
5. **Test the full flow**: `node bin/conductor.js init /tmp/test && bash /tmp/test/.agents/tests/check-conductor.sh`
6. **Commit with Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`

## Credits

Built on: [Test in Prod's Conductor](https://www.testinprod.co/), [Antigravity Kit](https://github.com/vudovn/antigravity-kit), [Antigravity Superpowers](https://github.com/skainguyen1412/antigravity-superpowers), [Superpowers](https://github.com/obra/superpowers).
