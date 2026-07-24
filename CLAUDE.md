# Conductor Framework — Development Context

> You are working on **the Conductor Framework itself** — the npm package that scaffolds an AI Software Engineering methodology into other projects. This is NOT a project using Conductor. This IS Conductor. It is a **harness-configuration + orchestration layer**: the methodology in `templates/` configures a real coding-agent harness (Claude Code / agy / codex), and `conductor loop` (`src/loop/`) is an outer orchestrator that drives those harnesses unattended — it is not itself a harness.

## How I Must Operate Here (read this first)

Almost everything in this repo is **instructions for other agents' harnesses** (`templates/`) or **control code for an unattended orchestrator** (`src/loop/`) — not ordinary app code. A wrong line propagates to every install, or fires on every autonomous beat with no human watching. Four operating truths, each learned the hard way:

1. **The tests lie by omission.** A green `test:unit` / self-test / `test:smoke` ≠ working for anything **agent-, loop-, or adapter-shaped** — that whole layer is *stubbed*. Real behavior is proven only by a **live run** (`conductor loop … --platform <p>` in a background shell with a `timeout` backstop). Never claim a behavior you have not executed. Every real adapter bug this class ever had passed all green suites and died only on a live run.
2. **The interactive path is sacred.** Loop/backend work lives in `src/loop/*` + `src/commands/loop.js` and keeps `templates/.agents/workflows/` **byte-identical** except `unattended-loop.md`. Verify: `git diff --name-only master..HEAD -- templates/.agents/workflows/ | grep -v unattended-loop` → empty. One source of truth (`conductor/`), two clients (interactive Claude Code + the autonomous fleet).
3. **Enforce with code, not prose.** A non-negotiable gets a deterministic **hook + a *behavior* test** (red→green) wherever the rule is grep-able; the Checker handles the semantic rest. Prose rules are advisory. (A *behavior* test — not a structural existence check — is what caught the eval gate's false-positive.)
4. **Never weaken the orchestrator's safety envelope.** `conductor loop` runs unattended, so these invariants must survive every edit: **PR-gated merge (never a direct push), the L3 sandbox gate, the Evidence Rule (verify exit code, not self-report), worktree isolation, the autonomy clamp, and fail-safe-on-missing-verdict.** If a change touches one, that is the thing to get right.

Also: this harness (Claude Code) hard-blocks merges and dangerous flags — those are the human's, not obstacles to route around. Durable state between sessions lives in the `memory/` dir + the roadmap docs' **status blocks** — read them first, keep them current.

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
├── package.json               # manifest + npm test scripts (test:unit/smoke/hooks)
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
| Upgrade **replaces** `.agents/` instructions, **preserves** `conductor/` knowledge (ownership rule: framework-owned = ships in `templates/**`) | A methodology upgrade must land new instructions — the old checksum-gated behavior *kept* user-edited instruction files and silently no-op'd checksum-less V4 installs, stranding them on stale methodology. Now framework files are replaced wholesale (custom additions carried forward, everything backed up first to `.conductor-backup/`), while the user's app knowledge in `conductor/` is never touched. The `conductor/5-templates/` scaffolding is framework-owned and refreshed too. Confirmed with the maintainer for the 6.0.0 upgrade path |

## Current State — read the source, not this file

This used to be a version-stamped prose snapshot; it drifts (it predated the V6 loop backend, multi-engine parity, and the Eval-Driven Law). **Truth lives in the source, not here:**

- **What shipped & why** → `docs/roadmap/*.md` (each carries a live status block) + `CHANGELOG.md`.
- **Cross-session / in-flight findings** → the `memory/` dir (start at `MEMORY.md`).
- **The methodology surface** → `templates/.agents/how-it-works.md` (routing table, skill/rule registries, the ship-contract).

Stable pointers to where the big subsystems live:
- **Autonomous loop** → `src/loop/` (driver, adapters, worktree, checker, merge, swarm, trigger) + `src/commands/loop.js`; the only interactive template it touches is `.agents/workflows/unattended-loop.md`. Design: `docs/roadmap/Autonomous-Loop-Backend.md`, `docs/roadmap/Loop-Robustness-Plan.md`.
- **Deterministic enforcement** → `templates/.agents/hooks/` (`lib.sh` + `pre-commit` for the TDD + Eval *presence* gates, `pre-push` for Verify + Eval *run* gates), wired by `conductor install-hooks`. The ship-contract (Eval-Driven Law + `architecture-checklist`, judge-rubric calibration): `docs/roadmap/Eval-Driven-Law.md`.
- **CLI** → `src/` (`cli.js` parser; `init`/`upgrade` in `src/commands/`; `update.js`/`backup.js`/`version.js` for the robust cross-version upgrade — `docs/roadmap/Robust-Upgrade-Migration.md`).

> **Version note:** `package.json` may lag what's on `master` — several PRs can land before a bump. Don't trust a version number as a statement of what's shipped; trust the roadmap status blocks + `git log`.

## How to Work on This Repo

1. **Edit `templates/`** for framework content, **`src/`** for CLI behavior.
2. **TDD the framework itself** — a failing test first. For a non-negotiable, that means a **hook + a behavior test** (Operating Truth 3), not a prose rule.
3. **Prove agent/loop/adapter behavior with a live run** (Operating Truth 1) — never from the stubbed suites.
4. **After any change**, run the full local suite and — for loop work — confirm the interactive path is untouched:
   ```bash
   npm run test:unit && npm test && npm run test:smoke && npm run test:hooks
   git diff --name-only master..HEAD -- templates/.agents/workflows/ | grep -v unattended-loop   # empty for loop work
   ```
   Full install flow: `node bin/conductor.js init /tmp/test --all && bash /tmp/test/.agents/tests/check-conductor.sh`.
5. **Commit** with Conventional Commits (`feat:`/`fix:`/`docs:`/`refactor:`); don't squash commits a roadmap doc cites by hash; keep the relevant roadmap status block + `memory/` current.
6. **Hand off** merges and classifier-blocked / dangerous-flag actions to the human.

## Credits

Built on: [Test in Prod's Conductor](https://www.testinprod.co/), [Antigravity Kit](https://github.com/vudovn/antigravity-kit), [Antigravity Superpowers](https://github.com/skainguyen1412/antigravity-superpowers), [Superpowers](https://github.com/obra/superpowers).
