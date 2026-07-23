# Loop Robustness Plan — Hardening the `conductor loop` Outer Loop

> **Status:** in progress (2026-07-23). Motivated by the first real end-to-end run of `conductor loop`, which drove a live `claude` maker + independent checker correctly but **lost the work** on a one-line task. This plan closes that gap, borrowing proven patterns from `agentctl` (a battle-tested peer factory; see `MEMORY` › agentctl-analysis).
>
> **Shipped** (branch `feat/loop-robustness-p0`): **P0.1** commit backstop (`src/loop/autocommit.js`), **P0.2** teardown dirty-guard (`src/loop/worktree.js`), **P0.3** verify-against-committed (by ordering), **P1.1** capture logged to the ship-log, **P1.2** diagnosable checker verdicts (`src/loop/checker.js`). Covered by `test/loop-robustness.test.js` (10 cases) + confirmed live by the fake-agent smoke test.
> **Shipped — Fleet Bridge §5** (Client B): **FB-1** harvester (`src/loop/harvester.js`, inbox + backlog → typed/routed work queue), **FB-2** claim + **FB-3** write-back (`src/loop/writeback.js`, reflected into `conductor/` + ship-log + PR), **FB-4** work-type→workflow routing with per-beat assignment appended to the prompt (zero `templates/` changes), **FB-5** re-harvest each run + `--from-conductor --dry-run` queue preview. Wired via `conductor loop --from-conductor`; harvested metadata preserved through `normalizeTask`. Covered by `test/loop-fleet-bridge.test.js` (12 cases) + verified live in `--dry-run` against a populated `conductor/`.
> **Shipped — L3 sandbox without a maintained image** (the blocker before any live L3 run): the L3 gate no longer forces a BYO container. `sandbox: "cli-native"` uses the agent CLI **vendor's own** sandbox (Anthropic's bubblewrap+socat for `claude`, enabled per-beat via `--settings .agents/sandbox/claude-sandbox.settings.json` with `failIfUnavailable: true` = fail-closed; Google-hosted for `agy`; OpenAI's for `codex`). No Docker image for this project to maintain — only `apt install bubblewrap socat`. `driver.SANDBOX_PROVIDERS = ["cli-native","container"]`; `none` still refused at L3 and needs `--unsafe-no-sandbox` for a real run. Covered by `test/loop-sandbox.test.js` (6 cases); verified via a `cli-native` L3 dry-run. **Only `.agents/sandbox/` templates changed — interactive path untouched.**
> **Shipped — first real L3 run (2026-07-23), the go/no-go, now GREEN.** Two ladder steps on a disposable target with a real GitHub remote (`charlus/conductor-loop-livetest`, task = implement `sum()` so `npm test` passes): **Step A** no-sandbox (L1) and **Step B** sandboxed (L3, `cli-native`) each drove a real `claude` maker → P0.1 auto-capture → checker APPROVED → PR opened → `completed (1/1 merged)`. The maker ran inside Anthropic's bubblewrap (host: `apt install bubblewrap socat`), did **not** fail-closed, and the fail-closed network allowlist still permitted the `github.com` push + `gh pr create`. The runs surfaced four real defects the fully-stubbed test suite is blind to (the whole adapter layer is faked in `node --test`) — three now fixed:
> - **Checker could never approve** — launched in read-only `--permission-mode plan`, so it couldn't write the required `checker-verdict.json` → fail-safe reject forever. Fixed → `acceptEdits` (commit `364139d`).
> - **Merge false-negative** — `gh pr create` exits non-zero when a PR already exists (contention/retry); `openPullRequest` now probes `gh pr list --head` and reuses it. **Checker verdict-write flakiness** — retry once on a missing verdict file. **One-loop-per-target lock** (`src/loop/lock.js`) — refuses a second concurrent loop (processes race on the shared worktree/branch/write-back). Commit `713f18e`.
> - **P1.4-adjacent: non-force push vs a stale divergent loop branch** — `openPullRequest` now falls back to `--force-with-lease` on a rejected push (machine-owned `conductor/loop/*`). Commit `6e99050`. Validated live by planting a divergent branch.
>
> **Shipped — first concurrency > 1 fleet run (2026-07-23), GREEN.** A swarm of 3 independent tasks at `concurrency=2` (L3, cli-native) completed **3/3 merged** with 3 separate PRs, across two waves (2 parallel makers, then 1), serialized merge queue, **no commit/ref race** between concurrent worktrees. It exposed a per-task-isolation gap now fixed: swarm tasks shared ONE global verify, but each runs in an isolated worktree with only its own work — so (a) the Evidence-Rule floor and (b) the independent Checker both false-fail on a repo-wide verify. Fixed: `task.verify` scoped command for the floor, and a per-task Checker prompt pinned to that command (`d044bab`). Before the Checker fix: 1 false-rejection recovered only by retry luck; after: 0 rejections, first-vote approvals.
>
> **Remaining:** **P1.4** merge-conflict/resume discipline (the resume half), **P2** (self-improvement loop, architecture-checklist contract, multi-engine parity), higher-concurrency + write-back-under-contention mileage (`--from-conductor` at `concurrency > 1`, where per-task claims commit to `master`), and the leftover testing cases (fake-maker forgets-to-commit; done-claimed-but-no-commit re-prompt).

## 0. North Star — two clients, one source of truth

The framework must serve **two clients over the same `./conductor/` folder**, with no second database:

- **`./conductor/` is the single source of truth** (durable): `0-compass/ship-log.md`, `1-workbench/inbox.md`, `2-backlog/task-backlog.md` (+ `implementation-backlog/`, `project-backlog/`), `implementations/NN-*/implementation-plan.md`, `3-product-areas/`, `4-context/`.
- **Client A — interactive** (Claude Code in VS Code): chat → `AGENTS.md` classifier → workflows read/write `conductor/`. This is the default, primary experience and **must stay untouched**. *(All loop-robustness work lives in `src/loop/*` + `src/commands/loop.js` — the `conductor loop` CLI path — and changes **zero** `templates/` files, so the interactive experience is unaffected by design.)*
- **Client B — autonomous fleet** (N × `claude`/`agy` CLIs via `conductor loop`): pulls work *from* `conductor/` (inbox items, backlog, open implementation-plans, bug reports), executes each item in an isolated git worktree, and writes results *back* to `conductor/` (close the item, update product-areas, append ship-log, open a PR).
- **`loop-state.json` is ephemeral RUN/coordination state, not a competing truth.** A dispatcher *derives* it from `conductor/` at the start of a run and reflects progress *back* into `conductor/`. The Spine holds only what the driver's guardrails need (iteration/budget/stall bookkeeping) plus which agent claimed which task.

Both clients therefore read and write the same folder; a human editing `inbox.md` in VS Code and a fleet agent draining it are two clients of one database. **P0 (below) is the safety prerequisite for Client B** — an autonomous agent that loses its work can't be trusted with a backlog. The **Fleet Bridge** (§5) is the work that actually delivers Client B.

## 1. What the first live run proved (and exposed)

The loop is architecturally real: it resolved the `claude` adapter, created an isolated worktree, spawned a real maker beat, ran the verify command itself, spawned a **separate** independent checker process, computed a fail-safe verdict, reached `awaiting_review`, tore down the worktree, and wrote an audit trail. The **safety envelope held** — no bad merge, fail-safe reject, clean human handoff, isolation intact.

But on the trivial goal "create `hello.txt` containing `conductor`", the net result was: **master unchanged, branch empty, the maker's file destroyed.** One root cause, four links:

1. **The maker never committed.** It created `hello.txt` (uncommitted), wrote `maker-signal.json {done:true}`, and skipped the `git commit` that [`unattended-loop.md`](../../templates/.agents/workflows/unattended-loop.md) Step 2.3 requires. A soft-layer instruction miss with **no hard backstop**.
2. **The verify gate has a working-tree blind spot.** `test -f hello.txt` passes on an *uncommitted* file, so the driver's Evidence Rule (`statusAfterVerify`) green-lit work git never captured (`verify exit=0`, output hash = the empty-string hash). Verify measures the **working tree**, not the **committed diff**.
3. **The checker rejected — arguably correctly.** [`loop-checker.md`](../../templates/.agents/workflows/loop-checker.md) reviews "the commits on the current branch"; there were none, so `0/1 approved → fail-safe reject`. Correct behavior, wrong outcome.
4. **Teardown discarded the work.** [`teardownWorktree`/`hasUniqueCommits`](../../src/loop/worktree.js) count *commits* via `rev-list HEAD..branch`; 0 unique commits ⇒ "clean" ⇒ `worktree remove --force` deleted the uncommitted file.

The design is sound; the **reps** are missing. `agentctl`'s 2,731-line orchestrator is dense with exactly this class of scar tissue because it has actually run, a lot.

## 2. Prioritized fixes

### P0 — Never lose the maker's work (the failure we hit)

**P0.1 Commit-before-anything backstop.** After each maker beat, before verify, the driver (or the beat epilogue) must ensure the worktree's changes are committed. Steal `agentctl`'s `ag-merge` `auto_commit()`: stage `git add -A`, generate a conventional-commit message from the goal/role, commit. If the maker already committed, this is a no-op.
- *Where:* `src/commands/loop.js` `runBeat` wrapper (after `adapter.runBeat`, before returning), or a new `src/loop/autocommit.js` injected as a dep.
- *Effect:* closes links 1, 2, and 4 simultaneously — verify then sees a real diff, the checker has commits to review, and teardown's `hasUniqueCommits` correctly preserves the branch.

**P0.2 Teardown must never `--force`-drop uncommitted work.** `teardownWorktree` should refuse to remove a worktree with a dirty working tree (`git status --porcelain` non-empty), independently of the commit count. Keep-and-report, as it already does for unmerged commits.
- *Where:* `src/loop/worktree.js` — add a dirty-tree check alongside `hasUniqueCommits`.

**P0.3 Verify against the committed state, not just the working tree.** Document and enforce that verification runs after P0.1's commit so a green result reflects captured work. Optionally hash `git diff HEAD~1..HEAD` into the beat-progress signal so "no committed change" is observable to stall detection.

### P1 — Make beats reliable (borrow agentctl's hardening)

**P1.1 Maker done-signal + commit enforcement in the prompt AND the harness.** The prompt already asks for a commit; add a harness-level check: if `maker_reported_done` is true but there's no new commit, treat it like a stall/reject and re-prompt with a focused "you claimed done but committed nothing" nudge (cf. agentctl's completion-aware resume nudge and its `REQUIRED_ARTIFACTS` re-trigger loop).
- *Where:* `src/loop/driver.js` `passed_by_checker`/`idle` transitions.

**P1.2 Checker verdict-file robustness.** Today a missing/malformed `checker-verdict.json` fails safe to reject (correct), but the trivial-task run shows the checker often produces no usable verdict. Add: (a) a one-shot re-prompt if the verdict file is absent after the checker beat; (b) surface *why* (empty diff vs no file vs explicit reject) in the log and `loop-state.json.history`, so a reject is diagnosable rather than opaque.
- *Where:* `src/commands/loop.js` `makeChecker`, `src/loop/checker.js`.

**P1.3 Bridge `conductor/` project state → the Spine.** The biggest usability gap: the driver only consumes `loop-state.json`; it never reads the human's `conductor/2-plan/` tasks or workbench. Add a `conductor loop --from-plan` (or a pre-flight harvester) that reads carved tasks from `conductor/2-plan/` into `loop-state.json.tasks[]` for swarm mode, and derives a sane default `phase`/`goal` from project state. Until then, document the manual Spine setup (done — see `docs/Running-The-Loop.md`).

**P1.4 Merge-conflict + resume discipline.** Adopt agentctl's exit-42 conflict convention and its state-file backup/restore around git operations, so a mid-run kill or a conflicted branch resumes cleanly rather than stranding a worktree. Conductor already has atomic state writes; add the resume path for a half-finished beat.

### P2 — Reach agentctl's differentiators

**P2.1 Cross-run self-improvement.** Port agentctl's `process_improver` idea: after a run (or a stall), an agent mines `loop-state.json.history` + rejected diffs for recurring failure patterns and appends project-specific rules to `.agents/rules/` (which already auto-load each beat). Guard with agentctl's ≥2-occurrence threshold to avoid over-fitting. This is the single novel capability agentctl has that Conductor's loop lacks.

**P2.2 Architecture-checklist compliance contract.** Adopt agentctl's `ARCHITECTURE_CHECKLIST.md` machine-readable tables as an input the maker/checker beats must satisfy — turns "follow the architecture" into checkable items. Fits Conductor's existing `technical-vision`/`carve` outputs.

**P2.3 Multi-engine parity.** The adapters (`claude`/`antigravity`/`codex`) exist; exercise and harden the non-Claude paths (token accounting, model fallback) so "same loop, any engine" is real, as it is in agentctl.

## 3. Testing

- **Shipped:** the smoke test's fake agent now **honors the permission mode** (`plan` = read-only → checker writes no verdict), plus an assertion that the Checker is invoked write-capable — the deterministic CI guard for the plan-mode bug (proven non-vacuous: reintroducing `plan` fails the smoke test). `npm run test:smoke` is now 7 cases.
- **Shipped:** a **real-agent L1 e2e** (`npm run test:e2e` / `test/e2e-loop-real.sh`), opt-in via `CONDUCTOR_E2E_REAL=1` (spawns a real `claude`; not in the default suite). Asserts the stub-invisible invariants: maker committed real work, verify green on the branch, Checker APPROVED (verdict written), worktree preserved. Validated 5/5 against a live agent.
- **Shipped:** merge-reuse, force-with-lease-fallback, and the one-loop lock have unit cases (`test/loop-phase4.test.js`, `test/loop-lock.test.js`); unit suite now 125.
- **Remaining:** extend the smoke so the fake maker sometimes "forgets" to commit and the harness recovers; a done-claimed-but-no-commit re-prompt case.

## 4. Sequencing

P0 first (it's the data-loss bug and it's small — the commit-backstop is ~30 lines lifted from `ag-merge`). Then P1.1–P1.2 (beat reliability). Then the **Fleet Bridge (§5)** — the work that turns the driver into Client B. P2 is the "catch up to agentctl's ceiling" tier and can follow once the fleet survives real tasks.

## 5. The Fleet Bridge — wiring `conductor/` to the autonomous fleet (Client B)

This is the epic that delivers the North Star (§0): let N agents drain the human's `conductor/` backlog autonomously, with `conductor/` as the one source of truth. It supersedes the earlier, narrower "P1.3 plan→Spine bridge". Each piece is deps-injected so the driver stays pure and unit-testable.

- **FB-1 Harvester (`conductor/` → work queue).** A pure reader that turns the source of truth into a normalized work list: unprocessed `1-workbench/inbox.md` bullets, open items in `2-backlog/task-backlog.md`, ready `implementations/NN-*/implementation-plan.md` steps, and bug reports. Emits `loop-state.json.tasks[]` (each item typed: `triage` | `carve` | `build` | `bugfix`, with a stable id + a pointer back to its source location). New `src/loop/harvester.js`; `conductor loop --from-conductor` (or default when no `--goal`).
- **FB-2 Dispatcher & claiming (no collisions).** N agents each claim a distinct work item via the swarm blackboard (`src/loop/swarm.js` already has a task-graph + serialized merge queue). Claims persist to `loop-state.json` (ephemeral coordination) AND a lightweight lock/marker in the item's `conductor/` source, so a human in VS Code sees "🤖 in progress" and doesn't double-book it. One worktree per item; `concurrency` bounds the fleet.
- **FB-3 Write-back (results → `conductor/`).** On a green + Checker-approved item: append `0-compass/ship-log.md`, tick the backlog/inbox item as done (or move it to `6-archive/`), update the relevant `3-product-areas/*`, and open a PR (never a direct push). The single source of truth reflects fleet progress the same way it reflects human progress. New `src/loop/writeback.js`.
- **FB-4 Work-type → workflow routing.** Map each harvested item type to the existing workflow the beat runs: `triage`→inbox triage, `carve`→`carve.md`, `build`→`build.md` (per-task TDD), `bugfix`→a debug/fix path. The beat prompt already loads `AGENTS.md` + workflows; FB-4 just tells the beat *which* workflow + *which* `conductor/` item it owns this beat (via `task.role`/`task.phase`, already forwarded by the swarm `runBeat`).
- **FB-5 Interactive/fleet coherence guarantees.** Concurrency safety when a human edits `conductor/` mid-run (re-harvest each scheduling round; treat the file as truth, the Spine as cache); idempotent claims (a re-run reconciles against `conductor/`, never double-shipping); and a clean `--dry-run` that prints the harvested queue so an operator can see what the fleet *would* pick up before launching it.

**Explicitly preserved:** none of FB touches `templates/` semantics for interactive use — it adds *readers/writers* over the same folder. Client A keeps working exactly as today; Client B becomes a second, well-behaved reader/writer of the same truth.
