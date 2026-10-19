# Peer methodology frameworks not yet audited (2026-10-16)

Scope: frameworks Conductor has not audited (Superpowers, Pocock, gstack, ECC, AI-DLC, AG Kit excluded). Nothing was executed. Every claim comes from reading repository source, release notes or vendor docs on 2026-10-16. Repository metadata from `gh api repos/<owner>/<repo>` on that date.

Evidence labels:
- MEASURED: the source publishes a run with numbers (who ran it is stated).
- IMPLEMENTED: code or a deterministic script exists in the repository.
- CLAIMED: prose, marketing or docs without code or data.

Classification against Conductor 6.13.0: ALREADY-HAVE (file cited), PREVIOUSLY-DECLINED/PARKED (roadmap doc cited), NEW.

## 1. Maturity table

| Framework | Repo | Stars | Last release | Activity (30 days) | State |
|---|---|---:|---|---|---|
| GitHub Spec Kit | github/spec-kit | 141,494 | v1.2.0, 2026-10-13 | 100+ commits | Very active, now a platform (extensions, presets, workflows, bundles, catalogs) |
| OpenSpec | Fission-AI/OpenSpec | 72,115 | v1.14.2, 2026-10-15 | 100+ commits | Very active, 30+ tools |
| Ruflo (ex Claude Flow) | ruvnet/ruflo | 75,393 | v3.56.10, 2026-10-14 | 100+ commits | Active, hype-heavy |
| GSD (archived) | gsd-build/get-shit-done | 64,284 | v1.43.0-rc2, 2026-05-17 | archived 2026-05-31 | Moved to open-gsd/gsd-core |
| GSD Core | open-gsd/gsd-core | 10,574 | v1.17.0, 2026-10-14 | active | Successor, lost ~84% of stars in the move |
| GSD Pi | open-gsd/gsd-pi | 1,321 | v1.22.0, 2026-10-12 | active | Own terminal agent |
| BMAD Method | bmad-code-org/BMAD-METHOD | 54,209 | v6.12.4, 2026-10-14 | 82 commits | v7 alpha, ETA 2026-10-16 |
| BMad Loop | bmad-code-org/bmad-loop | 159 | v0.13.2, 2026-10-10 | active | Early beta, closest peer to `conductor loop` |
| Taskmaster | eyaltoledano/claude-task-master | 28,232 | 0.43.1, 2026-03-31 | 0 commits | Stalled since 2026-04-23 (docs moved to tryhamster.com) |
| Compound Engineering | EveryInc/compound-engineering-plugin | 25,550 | v3.30.5, 2026-10-11 | 81 commits | Very active, eval-driven |
| SuperClaude | SuperClaude-Org/SuperClaude_Framework | 23,910 | v4.3.0, 2026-03-22 | 1 commit | Stalled |
| HumanLayer | humanlayer/humanlayer | 11,703 | nightly 2026-02-27 | 0 commits | Repo deprecated ("code here is pretty much all deprecated"), product rebuilt closed |
| Agent OS | buildermethods/agent-os | 5,507 | v3.0, 2026-01-20 | 1 commit | Shrunk to standards injection |
| Kiro (AWS) | kirodotdev/Kiro (issues only) | 4,368 | IDE 1.3.11 / CLI 2.31.1, 2026-10-15 | closed source | Very active product |
| Google Conductor | gemini-cli-extensions/conductor | 3,769 | conductor-v0.4.1, 2026-03-11 | 0 commits (last 2026-09-01) | Small, prose-only plugin, Google CLA |
| Tessl | tesslio/* | n/a (tile: 56) | n/a | active org | Pivoted to a skills registry with evals |

New with traction since June 2026 (GitHub search `created:>2026-05-01`, sorted by stars): omnigent-ai/omnigent (10,841, meta-harness), HarnessMD/munder-difflin (8,790, multi-agent desktop), alibaba/open-code-review (47,465, hybrid review CLI), michael-denyer/pstack-claude (2,573), lennney/stop-that-shit (2,697), Sahir619/fable-method (2,303). Hacker News (Algolia, stories since 2026-06-01, >60 points) showed no new methodology framework breakout. The space consolidated around Spec Kit and OpenSpec.

## 2. Per framework

### 2.1 GitHub Spec Kit
Source: https://github.com/github/spec-kit (README, `templates/commands/*.md`, CHANGELOG, read 2026-10-16 at v1.2.0).

Direction: from one SDD flow (constitution, specify, plan, tasks, implement) to a process platform. v1.0.0 shipped 2026-08-21. Core now has `converge`. Bug fixing (`assess, fix, test`) and idea assessment (`intake, research, define, shape, decide`, ending in go / needs-clarification / kill) are bundled extensions. A YAML workflow engine has gate steps (`on_reject: abort|skip|retry`, `verdict_input`). Community catalogs carry third-party "Quality Gates", "Verify Tasks", "Honest Gate" extensions.

Distinctive mechanisms:
- `/speckit-converge` (IMPLEMENTED as a prompt template, `templates/commands/converge.md`, added around 1.0.10, 2026-09). Reads spec, plan, tasks as the sole source of intent, assesses the current code and appends a `## Phase N: Convergence` of tasks. Rules: append-only, byte-identical `tasks.md` when converged, "completion claims are not evidence" (every checked task is re-assessed), and four gap types: `missing`, `partial`, `contradicts`, `unrequested`. Each task cites its source (`FR-003`, `US1/AC2`, `Constitution II`). Run `implement` then `converge` until "Converged".
- `/speckit-checklist`: "unit tests for English". Checklists test the quality of requirements writing, not the code.
- `/speckit-analyze`: read-only cross-artifact consistency check (spec, plan, tasks) before implementation.
- Bug extension verdict `verified | partial | failed`: "Missing verification is not a successful fix." (README)
- 1.1.2 fix "an interrupted gate prompt must not approve the gate" (#4529): the same fail-safe-on-missing-verdict rule Conductor has.

Measured results: none published. Lesson: the critique in the field is spec drift and waterfall overhead (OpenSpec README: "Thorough but heavyweight. Rigid phase gates, lots of Markdown, Python setup"). Spec Kit's answer is converge, not a living spec.

Against Conductor:
- converge's spec-versus-code gap assessment: ALREADY-HAVE in substance. The reviewer checks acceptance criteria first (`templates/.agents/skills/independent-review/reviewer.md` lines 13, 58) and the loop Checker rejects on a missing verdict (`src/loop/checker.js`).
- The `unrequested` gap type (code the author added that no requirement asked for): NEW in part. Conductor's reviewer has "Speculative generality" and tells the reviewer not to demand work beyond scope (`reviewer.md` lines 106-109), but no class for author-added scope. Low cost to add one review class.
- Gate engine, catalogs, presets: not needed. Conductor routes with workflows and enforces with hooks.

### 2.2 OpenSpec
Source: https://github.com/Fission-AI/OpenSpec (README, `src/core/archive.ts` 2,420 lines, `src/core/validation/`, CHANGELOG 1.14.x).

Direction: lightweight, brownfield-first, "fluid not rigid". Each change is a folder (`proposal.md`, `specs/` deltas, `design.md`, `tasks.md`). `/opsx:archive` merges the deltas into the living specs in `openspec/specs/`. Stores (beta) put planning in its own repository, shared across code repositories.

Distinctive mechanisms:
- Delta specs: `## ADDED | MODIFIED | REMOVED | RENAMED Requirements`, each requirement with `#### Scenario` WHEN/THEN. IMPLEMENTED: the archive rebuilds each main spec from the deltas and validates the result before it writes, aborts on a blocking condition and fingerprints the tree so a concurrent edit aborts the move (`archive.ts`, lines 63-170, 400-1280).
- `openspec validate --strict`: requirement length limit (500 characters), task checkbox and numbering checks, unknown metadata keys reported (1.14.0, #1925: "Those keys were stripped with no signal ... `validate --strict` exited 0").
- 1.14.1 (#2047): "Apply no longer calls a change ready to archive too early." When every task is checked, it asks for review or verify first. 1.14.0 (#2018): "Archive stops on a failed spec sync".
- Stores: a planning repository shared by several code repositories.

Measured results: none. Downloads and stars only.

Against Conductor:
- Living spec updated at Ship: ALREADY-HAVE as prose (`templates/.agents/workflows/ship.md` line 185: "Update `conductor/3-product-areas/[area]/[area]-features.md` ... with the newly shipped capabilities"). Nothing checks that it happened or that the result is coherent. OpenSpec's structured delta merge with validation is NEW. It is a large change to Conductor's document model, value unproven. Do not build without a usage audit showing product-area drift.
- Stores: ALREADY-HAVE in another form, the outer layout (`src/nested-repos.js`, README "Where the file lives").

### 2.3 AWS Kiro
Source: kiro.dev docs and blog (closed source). https://kiro.dev/docs/specs/correctness/ (updated 2026-08-04), https://kiro.dev/blog/run-all-tasks/ (2026-01-16), https://kiro.dev/changelog/ (entries 2026-10-09..15).

Direction: spec-driven IDE plus CLI, Crew and Web surfaces. Specs (`requirements.md` in EARS, `design.md`, `tasks.md`), steering files, agent hooks on IDE events. 2026-10-13: CLI 2.31.0 `/autonomous on` (local autonomous mode, enables the sandbox first), IDE 1.3.0 local command sandbox, Web workflows with capped loops ("Run N more", "Stop looping and continue").

Distinctive mechanisms:
- Requirements to properties to property-based tests (CLAIMED in docs, product code not inspectable). In design, Kiro states each testable EARS requirement as a universal property, links it to the requirement and the task, generates PBTs, runs them, shrinks a failure to a minimal counterexample and asks whether to fix the code, the test or the requirement.
- "Run all tasks" was held back at launch because users "spent too long backtracking and fixing errors". It shipped only with PBTs, dev-server and LSP diagnostics, and subagents. No numbers published.

Against Conductor:
- Property tests derived from acceptance criteria: NEW. Conductor's TDD Law requires a test per change (`templates/.agents/hooks/pre-commit`, `rules/`), not a property per criterion. Value is real for data-transforming code, low for UI and CRUD. Best fit: a short section in `skills/tdd-cycle` or `writing-evals` that says when a property test is the right RED. No gate.
- Steering files, hooks: ALREADY-HAVE (root `AGENTS.md` project card, `src/agents-md.js`; git hooks and PreToolUse hooks, `templates/.agents/hooks/`).
- Sandbox before autonomy: ALREADY-HAVE (L3 sandbox gate, `src/loop/`).

### 2.4 BMAD Method and BMad Loop
Sources: https://github.com/bmad-code-org/BMAD-METHOD (README, v6.12.4, v7 alpha), https://github.com/bmad-code-org/bmad-loop (README, CHANGELOG Unreleased, v0.13.2 2026-10-10).

BMAD direction: persona-driven agile method (analyst, PM, architect, UX, dev, test). v7 moves to skills installed with `npx skills add` and to Claude Code and Codex plugin marketplaces. "The process sizes itself to the work": small changes go straight to `bmad-build`. Modules: Builder, Test Architect, Game Dev, Loop.

BMad Loop is the closest peer to `conductor loop` found in this audit. "Plain Python drives the loop: pick story, implement, adversarially review, verify, commit." Mechanisms, all IMPLEMENTED per README and CHANGELOG:
- Completion only on the harness's Stop hook event or the death of the session, "never on model prose".
- After each session: spec status, baseline commit, non-empty diff, board in sync, then the user's `[verify]` commands.
- Review in a fresh session, optionally on another CLI (`[adapter.review] name = "codex"`), bounded to `max_review_cycles` (default 3).
- Environment faults (probe failure, verify exit 126/127, configured code, provider rate-limit and quota events) pause the run without charging the attempt.
- Deferred-work ledger (`DW-<n>`) plus `bmad-loop sweep`: a triage session checks each entry against the code and sorts it into resolved (with evidence), buildable bundles, blocked, skipped or a human decision. A `gate:` line blocks named stories.
- Project plugins run only after `plugins enable` records a content hash outside the repository, and run from a verified out-of-tree snapshot.
- Cost-weighted token budgets per stage (`session_budget_mode = off | warn | enforce`).
- Worktree isolation merges locally. "No PRs are opened."

Against Conductor:
- Deterministic driver, Evidence Rule, worktree isolation, stall detection, dead-beat and usage-limit handling: ALREADY-HAVE (`src/loop/driver.js` `classifyBeatResult`, `usage_limit_reached`; `docs/roadmap/Loop-Deadbeat-Robustness.md`).
- Merge model: Conductor is stronger. PR-gated merge versus local merge with no PR.
- Plugin hash trust: ALREADY-HAVE in spirit (`conductor trust-verify`, `src/loop/untrusted.js`).
- Checker on a different harness or model: NEW for the loop. `src/commands/loop.js` line 646 runs the Checker through the same `resolved.adapter`. `model-routing` skill warns against "Verifying a high-stakes change with a weaker model" but offers no cross-vendor Checker. See 3.1.
- Verify exit 126/127 as environment fault: NEW in part. Conductor classifies Checker infra failures (`isInfraReason`, `src/loop/checker.js`) and usage limits, but a verify command that is not found would read as a red build. Small fix.
- Token budget: PREVIOUSLY-DECLINED/PARKED (`docs/roadmap/Loop-Deadbeat-Robustness.md`: "Token budget ... deliberately DEFERRED").
- Deferred-work sweep: ALREADY-HAVE in part (inbox, `conductor inbox`, triage is "a later pass, on purpose"). The sweep's "already resolved, closed with evidence" check against code is NEW but low value.

### 2.5 Compound Engineering (Every)
Source: https://github.com/EveryInc/compound-engineering-plugin (README, `skills/ce-compound/SKILL.md`, `skills/ce-compound-refresh/SKILL.md`, `skills/ce-code-review/references/cross-model-review.md`, `docs/plans/*eval-report.md`, read at main 2026-10-16, release v3.30.5).

Direction: 36 skills on 14 hosts. Loop: brainstorm, plan, work, simplify, review, compound. `/lfg` runs it unattended up to a PR with a bounded CI repair loop, and does not merge unless granted. Of all peers, this one is the most disciplined about measurement.

Distinctive mechanisms:
- `ce-compound` durable bar (IMPLEMENTED as prompt): write a learning only if "a future engineer reading the final implementation" would still repeat the mistake without it. "Completion, effort, and diff size do not establish eligibility." One learning per run. Update a learning that became inaccurate rather than add a duplicate.
- `ce-compound-refresh`: audits learnings against the current code for drift, overlap and staleness. Deleting accurate docs needs explicit consent.
- Cross-model adversarial pass (IMPLEMENTED, `scripts/cross-model-adversarial-review.sh`): only the adversarial persona gets a twin on a different model family, read-only, same findings schema. Agreement between the two can promote a finding. Host family is attested from environment markers, and an unknown family skips the pass. Egress needs a sanctioned route, and `cross_model_review_mode: off` disables it.
- Reviewer benchmark on reversed real bug-fix commits (MEASURED, self-run, private harness): "the reviewed diff re-introduces the exact defect a real fix removed", blind Opus judge, 3-vote majority. Result: dropping the peer from high to medium reasoning kept detection (JS 92% vs 94%, n=5) at about 30-70% fewer tokens. A cheaper model lost detection (JS 78%, Go 67%). Source: `docs/plans/2026-07-18-adversarial-peer-benchmark-report.md` (marked superseded 2026-07-21 by a dollar-priced rerun).
- Review calibration (MEASURED, 7 scenarios on Claude and Codex, `docs/plans/2026-09-04-review-calibration-eval-report.md`): "Reviewers must now show a practical problem or worthwhile maintenance benefit before reporting a finding." "Confidence, agreement, and suggested fixes do not establish importance." Limit stated: "keyword grades alone are insufficient", so outcomes were read from transcripts.
- `ce-simplify-code` before review: prune useless tests and comments.

Against Conductor:
- Lesson capture location: ALREADY-HAVE (6.12.0 always-on block: conventions to `4-context/technical/coding-patterns.md`, decisions to `4-context/meta/decision-log.md`). The durable-bar counterfactual is NEW and cheap, one sentence. Content-hash dedup of lessons is PARKED (`docs/roadmap/AIDLC-Harvest.md` A6).
- Review calibration: ALREADY-HAVE, and converged independently (`reviewer.md` "not a defect" list, `calibration.md`, rubric v2 in `src/loop/checker.js`, review-log dismissal alarm in `src/commands/review-log.js`).
- Reversed-fix corpus as a reviewer eval: NEW. Conductor's evals measure routing, personas and the fact gate (`test/evals/`), none measures reviewer detection. See 3.2.
- Cross-model adversarial pass: NEW. See 3.1.
- Refresh of stale knowledge against code: ALREADY-HAVE in part (`conductor agents-md check` for the card; `system-janitor` skill). Not for `4-context/`.

### 2.6 GSD (Get Shit Done) and its successors
Sources: https://github.com/gsd-build/get-shit-done (archived 2026-05-31, README redirect), https://github.com/open-gsd/gsd-core (v1.17.0, `docs/explanation/the-phase-loop.md`, `docs/features/4139-compact-content.md`, `.changeset/archived/*`), https://github.com/open-gsd/gsd-pi (v1.22.0).

Direction: context engineering against "context rot". Phase loop Discuss, Plan, Execute, Verify, Ship. Executors run in parallel waves, each with a fresh context loaded only with its plan. In May 2026 the project split. The original repository was archived, development moved to the `open-gsd` org, and GSD 2 became GSD Pi, a separate terminal agent. Stars dropped from 64k to 10.5k.

Distinctive mechanisms:
- Plan-checker that verifies plans "fit a fresh context window" and that executors in a wave touch non-overlapping concerns (CLAIMED in docs).
- Verify checks requirement coverage and decision coverage ("were the decisions captured in `CONTEXT.md` actually implemented?").
- Debt-marker gate (IMPLEMENTED, PR #3343): the phase cannot advance when modified files hold `TBD`/`FIXME`/`XXX` with no issue reference or `DEF-*` ID. Stated limit: only files declared in the plan, globs not expanded.
- `human_needed` verification stays pending and never passes ship preflight (PR #3339).
- Compact content (IMPLEMENTED, ADR-4139): hand-written token-minimised variants of prompts, off by default. A missed read must degrade to "a complete, correct, terser state". No compact variant may remove guardrails.

Against Conductor:
- Fresh context per role, task tracker across resets: ALREADY-HAVE (`skills/handoff`, `subagent-isolation`, Build 6.9.0 `task-tracker.md`).
- Non-overlap of parallel work: ALREADY-HAVE as prediction (`src/loop/conflict.js`). Admission control is PARKED (`docs/roadmap/Swarm-Collision-Admission.md`).
- Context budget: ALREADY-HAVE and stronger, a byte ratchet by test (`src/context-bill.js`, `test/fixtures/context-budget.json`). Compact variants: not needed.
- Debt-marker gate: NEW. It is grep-able, so under Operating Truth 3 it belongs in `hooks/lib.sh` with a behaviour test. Low cost. Moderate value: unattended beats leave TODOs that the Checker may not flag.
- Lesson: a governance split cost the project most of its audience. Not a mechanism.

### 2.7 Google's Conductor (name clash)
Source: https://github.com/gemini-cli-extensions/conductor (README, `plugin.json` name `"conductor"`, 41 files, CONTRIBUTING requires the Google CLA). Last release conductor-v0.4.1, 2026-03-11, last commit 2026-09-01.

Direction: "Measure twice, code once." A prose-only skill set (`conductor-setup`, `-new-track`, `-implement`, `-review`, `-revert`, `-status`) for Antigravity and Claude Code. Setup writes `conductor/product.md`, `product-guidelines.md`, `tech-stack.md`, `workflow.md`, `code_styleguides/`, `tracks.md`. Work units are tracks, with phases and tasks. `conductor-revert` reverts by logical unit (track, phase, task) by reading git history. No hooks, no CLI, no tests.

Against Conductor:
- Name clash, confirmed: same product name, Claude Code plugin name `conductor` (commands `/conductor:*`), the same `conductor/` folder at the project root, and an `.agents/plugins/conductor` workspace link path. A user who has both installs gets two methodologies writing into one `conductor/` folder. charlus's Conductor ships as the npm package `conductor-framework`, so npm has no conflict. This is a product decision (see the summary).
- Logical-unit revert: NEW, low value. Conductor merges by PR, so a revert is a PR revert.
- Everything else: ALREADY-HAVE and stronger (hooks, loop, evidence).

### 2.8 Tessl
Sources: https://github.com/tesslio/spec-driven-development-tile (README), Product Hunt and registry pages via web search (secondary).

Direction: started as "spec as source". By 2026 it is a registry of skills and context ("tiles") with evals and Snyk dependency scanning. The founder says they rerun skill evals on each new model release. The SDD tile has `[@test]` links from spec lines to tests, plus `scripts/check-spec-links.sh` that checks link targets exist (IMPLEMENTED), and nine eval scenarios, including "trivial changes that should bypass the full workflow".

Against Conductor:
- Spec-to-test link check: PREVIOUSLY-PARKED (`docs/roadmap/AIDLC-Harvest.md` A5, "Machine-checked traceability ... proves an ID maps to a file, not that the file implements it"). Tessl's version has the same limit.
- Skill registry: ALREADY-HAVE (`conductor add/search`, `src/registry.js`). Rerunning evals on a model change is NEW as a practice. Conductor's evals run on demand, and a nightly lane is PARKED as a cost decision (`docs/roadmap/AIDLC-Harvest.md`).

### 2.9 Agent OS (Builder Methods)
Source: https://github.com/buildermethods/agent-os CHANGELOG `[3.0] - 2026-01-20`.

Direction: v3 removed its spec writing, task breakdown and orchestration phases: "Claude Code's plan mode, extended thinking, and improved models now handle much of the scaffolding". It kept standards: `/discover-standards` extracts conventions from code, and `/inject-standards` injects the relevant ones through an `index.yml`.

Against Conductor: standards discovery and injection by context is ALREADY-HAVE (`conductor survey`, `4-context/technical/coding-patterns.md`, personas from paths `src/personas.js`). The lesson matters more than the mechanism. A methodology layer must drop what the harness now does natively. Conductor's 6.9.0 Build autonomy change follows the same logic.

### 2.10 Taskmaster
Source: https://github.com/eyaltoledano/claude-task-master README. Last commit 2026-04-23. PRD parsed into a task graph with dependencies, complexity analysis, `expand`, `next`, tags for workstreams, and a research model.

Against Conductor: ALREADY-HAVE (Carve, `brain-dump-to-epics`, task tracker, the loop's drain order in `src/loop/harvester.js`). Stalled. Nothing to take.

### 2.11 SuperClaude
Source: https://github.com/SuperClaude-Org/SuperClaude_Framework README, v4.3.0 2026-03-22. 30 `/sc:*` commands, personas, modes, optional MCP servers. Claims "2-3x faster execution and 30-50% fewer tokens" with MCPs: CLAIMED, no data in the repository. Stalled.

Against Conductor: nothing distinctive. Prose personas are weaker than Conductor's path-loaded personas with Review Lens.

### 2.12 Ruflo (ex Claude Flow)
Source: https://github.com/ruvnet/ruflo README, v3.56.10. "100+ specialized agents, coordinated swarms, self-learning memory, federation", "SONA neural patterns", a neural-trader plugin. The README itself labels its main diagram "a conceptual flow, not a live execution trace".

Against Conductor: hype. Self-learning memory overlaps the self-evolution topic the maintainer parked on 2026-10-16 (memory `harness-rsi-paper-declined.md`). Ruflo publishes no independent evidence, so it does not clear that bar.

### 2.13 HumanLayer
Source: https://github.com/humanlayer/humanlayer (README: "the code here is pretty much all deprecated"), `.claude/commands/` (27 commands, last changed 2025-11-12). Research, plan, implement, with "frequent intentional compaction". Plans split success criteria into "Automated Verification" and "Manual Verification". The rule "No Open Questions in Final Plan" stops planning when a question is open.

Against Conductor: ALREADY-HAVE (handoff skill, `templates/conductor/5-templates/carve-workflow/implementation-plan.md` "Verification" functional and technical lines, Spec-It synthesise-not-re-interview). The command set is frozen and the product is now closed.

### 2.14 New since June 2026
- fable-method (https://github.com/Sahir619/fable-method, 2,303 stars, created 2026-07-06). MEASURED by its author: 15 rounds, more than 260 runs, blind judges that diff and execute (`eval/RESULTS.md`). Two findings matter for Conductor. (a) Round 2: "The rule as mid-list prose changed almost nothing." Making it "a forced artifact at the decision point" (an `INTENT:` line whenever behaviour changes) plus an explicit authority order "user > spec > tests > code" took Haiku from 0 of 4 to 4 of 4 on surfacing a spec-versus-test conflict (round 3). (b) "The lift is inversely proportional to tier", with no lift on ordinary small tasks. Small n, author-run.
- alibaba/open-code-review (47,465 stars). Hybrid review: deterministic file selection and bundling so that no changed file is skipped, one subagent per bundle, separate comment-positioning and reflection modules. Vendor benchmark (MEASURED by the vendor): 200 real PRs, 1,505 annotated issues, higher precision and F1 than Claude Code at about 1/9 of the tokens, lower recall (README). Stated failure of plain agents: "On larger changesets, agents tend to 'cut corners,' selectively reviewing only some files".
- stop-that-shit (2,697 stars). Hooks and a skill against scope creep, unused defensive code, review-only intent violations ("review denied a write") and re-verification loops. Evidence is anecdotal by its own statement ("not a controlled benchmark"), plus 18 offline paired cases.
- omnigent, munder-difflin: meta-harnesses and multi-agent desktops. Conductor does not compete there. Nothing to take.
- pstack-claude: port of Cursor's pstack playbooks. No distinctive mechanism over Conductor.

## 3. Ideas ranked by value to Conductor

### 3.1 Checker on a different model family (NEW)
Evidence: IMPLEMENTED in Compound Engineering (`cross-model-review.md`) and BMad Loop (`[adapter.review]`). Detection numbers exist only for reasoning tier and model choice in one role, from a self-run benchmark (MEASURED, n=3-5). No source measures same-family against cross-family review on equal footing.
Fit: `src/commands/loop.js` already has an adapter per platform and N-vote Checkers (`checker_votes`). A `checker.platform` key that runs one vote on another adapter would reuse the code paths. Risk: it changes the egress profile (code goes to a second vendor) and the cost. That makes it a product decision. Measure before shipping: run 3.2's corpus same-family against cross-family.

### 3.2 Reviewer detection eval on reversed real bug fixes (NEW)
Evidence: MEASURED method (Compound Engineering benchmark report, 2026-07-18). The corpus is free to build from Conductor's own `git log` of `fix:` commits: revert the fix, ask the reviewer, score with a blind judge.
Fit: Conductor has no eval of what its reviewer catches, only of routing, personas and the fact gate (`test/evals/`). The ">50% dismissed" alarm in `review-log` measures false positives only. This would measure false negatives, which rubric v2 tuning could otherwise make worse unseen. It needs the sensitivity check already in `test/evals/README.md`.

### 3.3 Authority order and a forced `INTENT:` line when behaviour changes (NEW)
Evidence: MEASURED by the author (fable-method rounds 1-3, 0/4 to 4/4, n=4). It agrees with Conductor's Operating Truth 3 (prose rules are advisory).
Fit: no Conductor rule says what wins when the spec and an existing test disagree (search of `rules/`, `build.md`, `tdd-cycle` found none). One line in the always-on block (user > spec > tests > code), plus an `INTENT:` line that the reviewer brief requires when a commit changes a tested behaviour. Context cost is small. Risk: the always-on byte ceiling, `test/fixtures/context-budget.json`.

### 3.4 Debt-marker gate in pre-commit (NEW)
Evidence: IMPLEMENTED (GSD Core PR #3343). No measurement.
Fit: grep-able, so it belongs in `hooks/lib.sh` with a behaviour test, like the Goodhart boundary. Block a new `TODO`/`FIXME`/`XXX`/`TBD` in staged code lines unless the line has an issue reference. Conductor already excludes `conductor/` from code. Cheap. Value is highest in the unattended loop.

### 3.5 Review coverage: every changed file accounted for (NEW)
Evidence: vendor-MEASURED (open-code-review benchmark), observed failure "agents cut corners on larger changesets".
Fit: the Checker verdict (`checker-verdict.json`) could list the files reviewed. `src/loop/checker.js` would reject a verdict that omits a changed file. Deterministic, small. Only for the loop, where nobody reads the review.

### 3.6 Verify exit 126/127 as an environment fault in the loop (NEW, small)
Evidence: IMPLEMENTED (BMad Loop).
Fit: extends `isInfraReason` and dead-beat classification to the verify step, so a missing tool does not burn beats or produce a misleading "red build" rejection.

### 3.7 `unrequested` review class (NEW, small)
Evidence: IMPLEMENTED as prompt (Spec Kit converge). Not measured.
Fit: add to the reviewer's closed class set (`src/commands/review-log.js` CATEGORIES has `scope`). Check whether `scope` already covers it before adding anything. It may be a one-line clarification only.

### 3.8 Durable-bar counterfactual for lessons (NEW, one sentence)
Evidence: CLAIMED (Compound Engineering `ce-compound`).
Fit: add to the 6.12.0 "where a lesson goes" line. It reduces noise in `4-context/`. Cost is bytes in the always-on block, so put it in `context-updater` instead.

### 3.9 Property tests derived from acceptance criteria (NEW)
Evidence: CLAIMED (Kiro docs).
Fit: guidance in `tdd-cycle` on when a property test is the right RED. No gate. Value limited to data-transforming code.

Not worth taking: OpenSpec delta-merge document model (large change, no evidence of drift in Conductor projects), Spec Kit gate engine and catalogs, logical-unit revert, compact prompt variants, swarm topologies, self-learning memory, deferred-work sweep beyond the inbox.

## 4. Where Conductor is already ahead (verified by reading both sides)

- Enforcement in code. Only BMad Loop, GSD Core and stop-that-shit enforce anything deterministically. Spec Kit, OpenSpec, BMAD, Google Conductor, Agent OS, SuperClaude and Taskmaster enforce their process in prose only. Conductor has the TDD, Eval, Goodhart, protected-path and stable-tree gates (`templates/.agents/hooks/`) and the heartbeat (`src/heartbeat.js`).
- Merge safety. BMad Loop merges locally with no PR. Compound Engineering's `/lfg` opens a PR and does not merge by default, which matches Conductor. No peer has an evidence ledger bound to the working-tree content (`src/evidence/`).
- Personas loaded from the paths a change touches (`src/personas.js`). BMAD, SuperClaude and Compound Engineering pick personas per stage or per reviewer selection, and none uses a fixed precedence for conflicts.
- Context budget enforced by a byte ratchet (`src/context-bill.js`). GSD gives the user an opt-in compact mode. Google Conductor warns about token use in its README.
- Review calibration: Compound Engineering arrived independently at the same rule ("show a practical problem") that rubric v2 and `calibration.md` carry. Conductor adds the review-log dismissal alarm (`src/commands/review-log.js`).

## 5. Uncertainty

- Kiro is closed source. Its PBT pipeline is documented, not inspectable.
- Compound Engineering's benchmark harness is private (`tmchow/cross-model-peer-eval`), so its numbers cannot be reproduced.
- fable-method and stop-that-shit evidence is author-run, small n.
- Star counts are a weak signal. GSD's split shows how quickly they move.
