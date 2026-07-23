# Loop Robustness Plan — Hardening the `conductor loop` Outer Loop

> **Status:** proposed (2026-07-23). Motivated by the first real end-to-end run of `conductor loop`, which drove a live `claude` maker + independent checker correctly but **lost the work** on a one-line task. This plan closes that gap, borrowing proven patterns from `agentctl` (a battle-tested peer factory; see `MEMORY` › agentctl-analysis).

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

- Extend the unit suite (`npm run test:unit`, stub adapter) with cases for: commit-backstop no-ops when already committed; teardown refuses a dirty tree; done-claimed-but-no-commit re-prompts.
- Extend the smoke test (`npm run test:smoke`, fake agent) so the fake maker sometimes "forgets" to commit and the harness recovers — the exact scenario the live run hit.
- Add a **real** L1 e2e (opt-in, `--unsafe-no-sandbox`, gated by an env flag) that asserts: after a run, the maker's file exists on the branch AND the worktree was preserved (not force-dropped). This is the regression guard for the bug we found.

## 4. Sequencing

P0 first (it's the data-loss bug and it's small — the commit-backstop is ~30 lines lifted from `ag-merge`). Then P1.1–P1.2 (beat reliability), then P1.3 (the plan→Spine bridge, the biggest UX win). P2 is the "catch up to agentctl's ceiling" tier and can follow once the pair loop survives real tasks.
