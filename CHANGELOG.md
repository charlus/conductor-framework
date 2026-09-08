# Changelog

All notable changes to the Conductor Framework will be documented in this file.

---

## [Unreleased]

### Fixed — the rendered view broke on a real backlog

Four separate renderer failures, all found by pointing `conductor view` at a production `task-backlog.md` rather than the tidy fixtures the suite used. Every one of them passed the existing tests.

- **Task items shattered into one-word columns.** `.prose li.task` is a flex container so the checkbox can sit beside the text, but the body was left unwrapped — so every `<strong>`, `<code>` and text node became its own flex *item* and collapsed to a narrow column. A real item ("**DB-1:** Add `pool_pre_ping` to `core/database.py`") rendered as a wall of stacked single words. The body is now one `<span class="task-body">`, pinned by a test asserting the wrapper.
- **Underscore emphasis was shown literally.** `_Why:_` and `__bold__` were unsupported, so the markers printed. Now rendered — **with the delimiter required to sit against a non-word character on both sides**, because the alternative is worse: without that guard `pool_pre_ping`, `user_tokens` and `expires_at` get chewed into `<em>`. Both halves are tested.
- **Every document printed its title twice** — once in the page header, once as the document's own leading `# Title`. `renderMarkdown` takes `skipFirstH1` now; a *later* h1 is content and is always kept, and the outline still records the dropped one so no TOC anchor dies.
- **The dashboard columns showed raw markdown.** Backlog, queue and inbox lines were escaped and never rendered, so `**` and backticks appeared verbatim. Each displayed title now carries a `titleHtml` rendered at generation time, keeping the page free of a markdown parser. The queue is still the harvester's — same items, order and routing; the test asserts that invariant rather than object identity.

Two display changes came out of the same screenshots:

- **Done backlog items are collapsed** behind a `N done` fold instead of listed in full. A real backlog carries long DONE entries with post-mortems in them, and striking them through in place buried the open work the column exists to show. Long open items are clamped to three lines; the full text is one click away in the document view.
- **The sticky topbar is opaque.** Translucent, it let long documents scroll visibly underneath, which reads as a fault rather than as depth.

`conductor status` had the same raw-marker problem and gained `stripInlineMarkdown` — a title-safe strip, distinct from the search index's aggressive `plainText`.

---

## [6.3.0] — 2026-09-08 — Review Convergence, Evidence Freshness, Untrusted-Input Hardening & Terminal-First Surfaces

Six epics. E6 (human surfaces for a CLI-first workflow) is independent; E1–E5 came from a source audit of two peer harnesses (**gstack** `1.79.0.0`, **agentctl** `main`) plus a survey of 2026 harness-engineering practice. Design doc with the full evidence: [`docs/roadmap/Review-Convergence-And-Harness-Alignment.md`](docs/roadmap/Review-Convergence-And-Harness-Alignment.md). No breaking changes.

> **E1 outcome:** accepted by the maintainer as good enough on real ships (2026-09-08). E2's ledger remains available if a number is ever wanted.

### Added — human surfaces for a terminal-first workflow (E6)

The methodology's read path assumed an IDE: a file tree to browse, a rendered markdown preview to read, an editor to type into. Working through a CLI coding agent removes all three, and browsing `conductor/` becomes a chain of `ls`, `cd` and `vim`. The diagnosis was that **the files are not the problem** — they are what make the autonomous loop, the evidence ledger and PR review work — but the *human's* channel to them was gone. Note the asymmetry that made it obvious: `src/loop/harvester.js` already gave the loop a ranked, typed view of the same folder the human had to read with `cat`.

So `conductor/` stays one source of truth and gains renderers. Design and decisions: [`docs/roadmap/Terminal-First-Human-Surfaces.md`](docs/roadmap/Terminal-First-Human-Surfaces.md).

- **`src/conductor-state.js`** — ONE read of `conductor/`, shared by every surface, and it **calls the harvester** rather than re-parsing the backlog. Two parsers would eventually disagree about the same file, and then neither surface would be trusted. Pure except a thin IO wrapper, so the digest is testable with no repo on disk. Adds what only a whole-folder read can produce: **backlinks** (which documents reference this one) and staleness.
- **`conductor status`** — the daily question in one screen: inbox depth, open tasks per priority, the queue in the order the loop would drain it, stale documents, loop state. Costs **zero tokens and zero context** — asking an agent to summarise state cost a full turn every time, for the question asked most often. `--json` for scripts, `--no-color` for pipes.
- **`conductor inbox add "…"` / `list`** — quick capture as a command. `Inbox: X` existed as a row in the always-on classifier and did not fire reliably, which is the expected outcome for prose competing for attention; appending a line to a file is mechanical, so it becomes code. The chat convention stays as the fallback. Capture **refuses to scaffold `conductor/`** outside an install rather than littering an unrelated repo.
- **`conductor view [--open]`** — renders every document into ONE self-contained HTML file (`conductor/.views/index.html`, gitignored): rendered tables, cross-document search, per-document outline, backlinks, light/dark, mobile. One file because the page is opened over `file://`, where the browser blocks runtime loading — so nav, search index and all rendered documents are stamped in at generation time — and because one file is one bookmark. `--open` shells to the platform opener (`wslview` on WSL, where `xdg-open` has nothing to open), and the command prints a clickable `file://` URL resolved for the platform the *browser* runs on — the `wsl.localhost/<distro>` UNC host under WSL, since a Windows browser cannot resolve `file:///home/...`. The `/view` shim tells the agent to relay that URL verbatim rather than build one. The page is invisible to `git status` and to `git add -A` (verified by asking `git check-ignore`), and the ignore entry is rewritten on every run so an older install self-heals. `--out <path>` is a deliberate override and gets no entry written for it, but it now **warns when that path is inside a repo and not ignored** — the one route by which a derived page could reach a commit.
- **`src/view/markdown.js`** — a dependency-free markdown renderer run at generation time, so the page ships no parser. Its contract is security: content in `conductor/` is written by the human, by agents, and through the inbox by whatever was pasted in, and the page runs from `file://`. Every character is escaped, raw HTML is shown as text and never passed through, and `javascript:`/`data:`/`vbscript:` URLs are neutralised. There is no trusted-markdown path.
- **`/status`, `/inbox`, `/view`** slash commands generated alongside the workflow shims — the first CLI-backed shims, distinct from the workflow ones.
- **`.agents/AGENTS.md`** routes "what's on our plate" to `conductor status` and puts the command first for capture — and the always-on bill went **down** 9 bytes doing it (16,442 → 16,433), with the ceiling ratcheted to match.

**Deliberately not done:** flattening the pipe tables out of 17 `conductor/` templates. That was planned while raw markdown was the only way to read them; once `conductor view` renders them, a table is dense and scannable rather than the hardest thing on the page. The state files that *are* read raw — `inbox.md`, `task-backlog.md`, `scratchpad.md` — have no tables and are pinned table-free by test.

### Fixed — `conductor status` read a loop field that does not exist

The loop line read a top-level `loop.beat`, which is not in the v2 `loop-state.json` schema (the counter is `iterations.current`), so the beat number never rendered. It also omitted **`phase`** — the field that decides whether the loop can run at all, since the driver refuses to start in `discovery`. It now shows `phase · status · beat n/max · autonomy`.

The bug survived its own test because the fixture was an invented shape rather than the shipped one. **The test now loads `templates/conductor/1-workbench/loop-state.json` itself**, so an invented shape can no longer satisfy it and a schema change fails loudly instead of silently blanking the line. A companion case asserts that a bogus top-level `beat` is *not* what gets read. Found while checking a documentation claim, which is the only reason it surfaced at all.

### Changed — documentation caught up with the shipped surface

- **`README.md`** gains a "Reading Your Project From a Terminal" section — `status`, `inbox`, `view`, why the page is one derived file, and the WSL URL caveat — plus a feature bullet. The commands existed but were invisible to anyone reading the repo.
- **`templates/CLAUDE.md`** no longer claims every slash command is a workflow shim. It now distinguishes workflow shims from the three **CLI shims** (`/status`, `/inbox`, `/view`), which have no workflow behind them, and warns against hand-building the `file://` URL.
- **`skills/context-engineering/SKILL.md`** — the reference `how-it-works.md` names for quick-capture *mechanics* — taught only the file-append path and so contradicted the classifier that routes to it. Now command-first, with a new "Reading State" directive. Rewritten to stay **under** its existing eager ceiling rather than raising it.
- **`docs/Running-The-Loop.md`** dropped "a human editing `conductor/` in VS Code" — the exact assumption this release removes — and now points at `conductor status` for previewing the fleet's queue and the loop's phase.
- Stale **V5** markers corrected to V6 in `how-it-works.md` and the self-test banner. `templates/CHANGELOG.md`'s footer is now version-agnostic, so it cannot drift again.

### Changed — the review gate now converges (E1)
- **`skills/independent-review/reviewer.md`** (new, 116 lines, capped at 130 by test): ONE self-contained reviewer brief, handed over verbatim, replacing a chain of five skills. `BLOCKER` / `IMPORTANT` / `NIT`; a **BLOCKER needs a quoted line and confidence ≥ 7**, and an unquotable finding is downgraded rather than promoted. `APPROVE` means **zero blockers**, not zero findings. The reviewer judges the acceptance criteria (or `goal_description`) plus `architecture-checklist.md` as a checklist, reports the whole class with its complete instance list, and carries an explicit "Not a finding" exclusion list.
- **`skills/independent-review/calibration.md`** (new): 7 graded cases pinning **both** drift directions — over-rejection (a false positive killed by the quote rule, criteria-met-but-more-could-be-built, a test-structure opinion) and under-rejection (a quotable defect with a one-line fix is still a BLOCKER, a reward-hacked test, an unsatisfied checklist item) — plus the `SCOPE:` case.
- **One capped delta round**, briefed with round-1 findings *plus the author's dispositions* and the fix commits' diff only; then a single batched question to the human. **No follow-up backlog from review** — a proven in-scope defect is fixed now or written into the PR body under "Known gaps". An unreviewed fix round is never escalated.
- **Proportionality:** Ship Phase 4 skips the subagent below 50 changed non-test lines *and* no risk path (auth, payments, migrations, API contracts, security, CI, hooks).
- The unbounded phrasings are gone: "look for the reason this is **not** done", "if unsure → reject", "Reviewer found issues = not done. No exceptions", "zero warnings".
- `personas/checker.md` and `workflows/loop-checker.md` adopt the same rubric (v2) and emit a `findings[]` verdict. **The driver's fail-safe on a missing or malformed verdict is unchanged.**

### Added — evidence freshness, context budget, review ledger (E2)
- **`conductor evidence run|check|list`** — verification evidence bound to a **working-tree content fingerprint**, so committing exactly the code that was tested keeps its evidence FRESH while an untracked new source file invalidates it. Transparency invariant: the child's exit code is always the wrapper's; every bookkeeping failure is a warning. `--expect-cmd` binds a label to the real suite; `--allow-paths` excuses release-file-only changes. Machine-local (`CONDUCTOR_HOME`) and per-branch.
- **`pre-push` now trusts FRESH evidence** instead of re-running the suite on unchanged content. Fail-safe: no CLI, no ledger, any doubt runs the command — the ledger can only *skip a redundant run*, never satisfy the gate. Measured live: 2.3s → 0.15s on a content-identical push, and a source change still re-runs.
- **`conductor context-bill`** + a CI **ratchet** — Progressive Disclosure is now a number (16,442 bytes ≈ 4.4k tokens always-on) with a committed ceiling. Two ledgers (ALWAYS-ON vs EAGER); CI fails on growth past the fixture **and on a new skill or workflow with no budget entry**. Ceilings in bytes, exact and machine-independent; a 24 KB hard cap sits above the ratchet.
- **`conductor review-log append|summary`** — records each review finding with its disposition and reports rounds to APPROVE, dismissal rate per class, and blockers by category. A class dismissed >50% of the time (n≥3) is flagged a **rubric suspect**: fix `calibration.md`, not the author.

### Added — the agent layer is now testable (E3)
- **The rubric-v2 evidence bar enforced in `src/loop/checker.js`**, not just in prose. A malformed BLOCKER never becomes an approval (it stays a rejection); `approved:true` while listing a BLOCKER is self-contradicting and fails safe; `approved:true` with only IMPORTANT/NIT still approves. The bar buys a **diagnostic** — an evidenced rejection is now distinguishable from a Checker rejecting on vibes.
- **`npm run eval:routing`** (`CONDUCTOR_EVALS=1`) — the first test here that says anything true about agent behaviour. Spawns a real `claude -p` and grades routing exactly. Two suites: `classifier` (the table is the artifact) and `descriptions` (**the table is removed**, so a regressed description can actually fail — gstack shipped this suite with the answer key in the fixture and found it could not fail). Negative controls graded. `eval:routing:sensitivity` mutates the fixture and **inverts the exit code**: a green eval proves nothing unless it can go red.

### Security — untrusted trigger input can never gain authority (E4)
- **Trust comes from authorship, not transport.** A third-party trigger source with no operator-level `author_association`, or any payload setting `"untrusted": true`, is untrusted and forced to the **L1 no-merge floor** via `clampAutonomy` (de-escalation only, so a lower operator ceiling still wins). An operator-configured transport (`cron`, CI, the CLI) keeps full trust.
- **Trust envelope** on untrusted goal/context: always wraps, labels injection-matching lines `[INJECTION-PATTERN]`, folds fullwidth/zero-width evasion **for matching only** (emitted text is never rewritten), and defuses a forged copy of the banner with a ZWSP.
- **Tool allowlist, never a blocklist** — `Read Edit Write Glob Grep TodoWrite`; no `Bash`, no `WebFetch`, no `WebSearch`. Every published bypass of this agent class defeated a blocklist.
- **`conductor trust-verify`** — the Stop hook bypasses the permission system, so it now runs only the verification command the operator recorded (realpath + `sha256`, 0600 store, append-only grant log). Editing the command invalidates trust. Untrusted **fails open** with a note; `pre-push` still enforces the Iron Law where the operator typed `git push`. Stop-hook re-entry is bounded at 3 blocks, then releases with a loud `UNVERIFIED` warning.
- Context: Feb 2026 turned one malicious Cline issue *title* into an npm supply-chain compromise; April 2026 disclosed the same shape in Claude Code's security-review action (CVSS 9.4), Gemini CLI Action and Copilot's coding agent.

### Added — drift gate for `.agents/`, and a descope (E5)
- **`test/template-integrity.test.js`** (60 assertions): registry ↔ disk both ways, non-empty descriptions, **path-level reachability** (excluding `registry.json` and `check-conductor.sh` — inventories, not routes), link validity, skill frontmatter, and host-path containment.
- **Two real bugs it found:** `agentic-flow.md` shipped in every install and was documented but had **no classifier trigger**, so "design a flow" could never reach it; `loop-checker.md` and `unattended-loop.md` had **empty registry descriptions**. Both fixed.
- **E5's per-host compiler was descoped on evidence.** gstack needs one because it hardcodes `~/.claude/skills/gstack`; Conductor installs `.agents/`, so it is host-neutral by construction — 5 legitimate Claude integration points and 3 "Task tool" mentions that already carry platform fallbacks. Both properties are now pinned by tests. **Model overlays are deferred, not dismissed** (no injection point yet).

### Known gaps
- The context bill counts only `SKILL.md` per skill directory, so `reviewer.md` and `calibration.md` are unbilled eager cost. Fix: count sibling `.md` files, re-capture.
- Ship Phase 4 does not yet cite FRESH evidence instead of re-running; only `pre-push` consumes the ledger.

---

## [6.2.0] — 2026-07-24 — Loop Robustness, Multi-Engine & the Eval-Driven Law

Hardens the V6 autonomous loop from a working prototype into something trustworthy (borrowing proven patterns from the `agentctl` peer factory), brings real **multi-engine parity** (Claude Code + Antigravity `agy` + `codex`, each verified against the installed CLI), and adds the **Eval-Driven Law + ship-contract** — the "tests ≠ evals" discipline, enforced deterministically like TDD. No breaking changes; `conductor upgrade` lands every new skill and hook on existing installs (verified end-to-end, with a backup written first and all `conductor/` knowledge preserved).

### Added — Eval-Driven Law + the ship-contract
- **The Eval-Driven Law**, enforced in two stages like TDD: a `pre-commit` **presence** gate blocks provider-calling code (`openai`/`anthropic`/`langchain`/…) staged without an evalset (`evals/…` or `*.eval.*`); a `pre-push` **run** gate runs the configured `eval` command (`conductor.config.json` `"eval"`) and blocks on failure. Independent from the TDD gate — waiving one never skips the other. Escape hatches `CONDUCTOR_NO_EVAL` / `CONDUCTOR_SKIP_EVAL`, both waiver-logged. Detection is gated to impl files, so docs/config that merely *name* a provider are never flagged.
- **`writing-evals` skill** — the how-to: three grading modes (rubric/LM-judge, property/assertion, reference) so "no labelled data" is never an excuse. A skill, not an always-on rule (evals matter only to LLM-feature projects).
- **`architecture-checklist` skill + the ship-contract** — turns "follow the architecture" into checkable items (deterministic `check:` shell commands or Checker-verified), produced by `technical-vision`/`carve`, verified by `loop-checker` + `independent-review`. The ship-contract has two halves: deterministic (TDD/Eval hooks + `check:` items) and semantic (the Checker).
- **Judge calibration (Level C)** — every LLM-judge surface (`judge-panel`, `loop-checker`, `independent-review`, `behavior-validator`) carries a `Rubric vN` stamp; `judge-panel` documents the Calibration discipline (version the rubric, spot-check against human judgment, diverse lenses). New `test/hooks-eval-gate.sh` (12 behavior cases) via `npm run test:hooks`. Design: `docs/roadmap/Eval-Driven-Law.md`.

### Added — Multi-engine parity (Claude Code + `agy` + `codex`)
- The loop's adapter layer now works against the **real** `agy` (Antigravity 1.1.6) and `codex` (0.145.0) CLIs, with every flag verified against the CLI — not guessed. **`agy`** (proven end-to-end on a live L1 run): correct binary (`agy`, not `antigravity`), `--print`/`--mode`, headless auto-approval, and `--add-dir` to anchor its workspace to the loop worktree. **`codex`**: `codex exec -s workspace-write` so the Checker can write its verdict. Flag mappings are unit-tested (`mapMode`/`beatArgs`).
- **Sandbox finding:** `agy --sandbox` blocks the agent from operating, so `sandbox: cli-native` + `agy` is refused with guidance to use `container`; `codex` is confined by construction (`workspace-write`).

### Added — Autonomous loop hardening (Loop Robustness Plan)
- **P0 data-loss fixes** — a commit-before-verify backstop (`autoCommit`), a teardown dirty-guard, and verify-against-committed, so a Maker that forgets to commit never loses its work (the original live-run failure). Plus an **empty-done guard**: a done-claim on a branch with no committed work re-prompts instead of opening an empty PR.
- **Fleet Bridge** (`conductor loop --from-conductor`) — drains `conductor/` inbox + backlog into a routed work queue and reflects results back (claim → done → PR), so the interactive dashboard and the autonomous fleet share one source of truth.
- **cli-native sandbox** — L3 runs in the CLI vendor's own sandbox (Anthropic bubblewrap for `claude`), no maintained Docker image required.
- **Resume discipline** — a killed run resumes without stranding worktrees; **cross-run self-improvement** mines the ship-log for recurring failures and proposes rules (propose-only). The isolated Maker is conductor-enabled even when the scaffold is gitignored. Design + status: `docs/roadmap/Loop-Robustness-Plan.md`.

### Added — Skill catalog audit + Reference Library
- Skill catalog streamlined (37 → 29) against a coherent-responsibility bar; four advice docs demoted to a new `.agents/references/` library (still discoverable via `how-it-works.md`). `upgrade` now prunes framework-owned skills dropped upstream while keeping registry-imported and hand-authored ones (ownership via the checksum manifest; `test/update-prune.test.js`).

### Added — `deepen` brownfield architecture workflow
- The brownfield counterpart to `technical-vision`: finds shallow/scattered modules in an existing codebase and reshapes them into deep modules with narrow interfaces — characterization-test-first + Strangler-Fig. Driven by the Code Archaeologist persona.

### Fixed
- **Dry-run purity + lock ordering** (`conductor loop`): all disk writes deferred until after the one-loop lock, so `--dry-run` never mutates state and a second invocation can't rewind a live run's on-disk tasks.
- **Checker write-capability, merge, and cross-process safety** — the independent Checker runs write-capable (not read-only `plan`); PR reuse on contention; `--force-with-lease` fallback on a stale loop branch; per-task verification for concurrent swarm tasks.

### Added — Loop ignition contract (time-based & proactive loops)
- **`conductor loop --goal "<text>"` and `--event <file.json>`** — an external trigger can now seed the loop's goal, turning the goal-based driver into the **time-based** and **proactive** loops of Anthropic's Loop-Engineering taxonomy *by composition*. Conductor deliberately ships **no scheduler of its own** — drive `conductor loop` from Claude Code's native `/schedule` or host `cron` (time-based), or from a webhook/CI shim that writes an event payload (proactive). Rationale and the full four-loop readiness map: `docs/roadmap/Loop-Engineering-Alignment.md`.
- **`src/loop/trigger.js`** (pure) — `parseTriggerPayload` (a JSON object *or* a bare goal string), `applyTrigger` (seeds `goal_description`/`phase`, records provenance), `clampAutonomy`, `renderTriggerDoc`. Covered by `test/loop-trigger.test.js` (11 `node:test` cases).
- **Safety — autonomy clamp.** A trigger payload may originate from untrusted input (a Slack message, a GitHub issue body). It may set the goal/phase/context and may *request* an autonomy level, but the level is **clamped to the operator ceiling already in `loop-state.json`** — a trigger can de-escalate but **never escalate**. Privilege stays with the operator, not the event.
- **Auditability.** The seeded goal + provenance persist to the Spine (`loop-state.json.last_trigger`), the run's brief is written to `conductor/1-workbench/loop-trigger.md` (data for the Maker, never spliced into driver control flow), and the trigger — including any refused escalation — is logged to `0-compass/ship-log.md`. `--dry-run` previews all of it without mutating state.

### Documentation
- **`how-it-works.md`** gained a **"Four Loop Types"** section mapping each rung (turn / goal / time / proactive) to the Conductor primitive that serves it — including that Conductor's deterministic TDD/verify **git hooks** are one rung *stronger* than the guide's "encode verification in a `SKILL.md`" (a hook is code the agent cannot reason around).
- **`README.md`** documents the ignition contract in the Autonomous Loop Backend section.

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
