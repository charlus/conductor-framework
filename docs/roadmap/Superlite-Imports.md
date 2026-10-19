# Superlite imports: design

> **Status:** A13 shipped in 6.15.0 and A14 in 6.16.0 (2026-10-19), both verified live. `claude -p --output-format json` does report `total_cost_usd` on a subscription login, as a list-price estimate (`costBasis: list`). A12 is next. A10 and A11 wait for D1's condition. Owner decided D1–D5 on 2026-10-19.
> **Source:** [`Harvest-2026-10.md`](Harvest-2026-10.md), section "Superlite", items A10–A16. Superlite was read at `eea16ee` and never run.
> **Related:** [`Swarm-Collision-Admission.md`](Swarm-Collision-Admission.md) (F8), [`Autonomous-Loop-Backend.md`](Autonomous-Loop-Backend.md), and the paused `Unattended-Crossing.md` (draft PR #69).

## Scope and order

Five imports. Each one takes superlite's idea and replaces the self-report parts with facts that the driver reads.

| Order | Item | Changes | Gate before build |
|---|---|---|---|
| 1 | A13 retry carries the rejection | `src/loop/swarm.js`, `src/loop/driver.js`, `src/loop/harvester.js` | none |
| 2 | A14 cost per beat | `src/loop/adapters/*.js`, `src/loop/driver.js`, `src/commands/status.js` | none |
| 3 | A12 ruling log | `unattended-loop.md`, `src/loop/*`, `src/gitattributes.js` | none |
| 4 | A10 declared file scope | `src/loop/harvester.js`, `src/loop/swarm.js` | F8's condition: the swarm has run real work and the wasted beats are measured |
| 5 | A11 contracts with examples | `src/loop/harvester.js`, `src/loop/swarm.js` | A10 shipped |

**Not imported.**
- A15 (a waiver that quotes what it waives) is already covered. Our waivers are per-commit environment variables, logged in the commit they waive (`hooks/lib.sh:336`), so a waiver cannot be written in advance.
- A16 (robustness probes) stays parked. It is Python only, unproven, and overlaps the Eval-Driven Law.
- The coordinator-edit hook does not apply. Our orchestrator is code, not a model.

**The crossing.** The first real crossing runs in another session (2026-10-19). Build A13 and A14 now. Build A12 after the crossing. Build A10 and A11 after the swarm has run real work (D1).

## A13: a retry receives the reason for its rejection

**Gap (verified in code).** `processTask` (`swarm.js`) retries by calling `runBeat` again with the same assignment. The assignment is `renderAssignment(task)` (`harvester.js:186`), and it has no rejection field. The verify exit code, the verify output and the Checker's `reason` and `findings` (`checker.js:57`) are logged, but the next Maker never receives them. Each beat is a fresh `claude -p` process, so context size is already bounded. What is missing is the reason. Pair mode was not checked yet: check it first in the build.

**Design.**
- The driver writes the note, not the agent. After a rejected beat, the driver appends one entry to `task.attempts`, keeping the last 3. Each entry holds:
  - `beat`: the beat number.
  - `verify_exit`: the verify exit code.
  - `verify_tail`: the last 40 lines of verify output, at most 4 KB.
  - `checker_reason` and `checker_findings`: the Checker's reason and findings, at most 10.
  - `files`: from `git diff --name-only` of the beat.
- The Maker may add a `notes` field to `maker-signal.json`, at most 1,500 characters. This field is advisory input for the next Maker and never part of a verdict.
- `renderAssignment` adds a section, "Previous attempts were rejected", built from `task.attempts`. Verify output and Checker text are model or repository output, so they go inside the untrusted envelope of `untrusted.js`.
- After 2 rejected beats on a task, the next beat uses `loop.models.maker_escalation` if it is set. This is a quality setting and does not depend on `loop.cost_aware` (D2). Without it, nothing changes.

**Tests.**
- A unit test, red then green: the prompt of the second beat contains the first beat's Checker reason, inside the envelope.
- A live run with a task built to fail its first verify.

## A14: cost and tokens per beat

**Gap (verified in code).** Every adapter returns `tokens: 0`: `claude.js:87`, `codex.js:55` and `antigravity.js:84`. `state.budget.tokens_spent` (`driver.js:365`) therefore adds zeros. Nobody knows what a loop run costs.

**Design.**
- **Claude adapter.** Add `--output-format json` to `buildArgv`. Parse the final object for `total_cost_usd`, `usage` and `result`, and pass `result` to the driver as `stdout`, so the verdict parsing at `driver.js:138` sees the same text as today.
- **Fallback.** If the JSON cannot be parsed, cost and tokens are `null` and `stdout` is the raw output. Measurement fails open and never changes a gate.
- **Codex and agy** report `null` (unknown), not `0`.
- **Beat log.** One line per beat: role, model, task, duration, tokens and cost (`beat-log.js`). The Checker votes are logged as well.
- **Surfaces.** `conductor status` shows the cost of the last run, split by role. That split is the measurement Q3 and `loop.models` need.
- **Cost-aware mode.** `loop.cost_aware` (default `false`) enables the cost ceiling `budget.max_cost_usd`. At 70% of it, write one inbox line. At 100%, halt between beats with `budget_exceeded`, as the wall-clock ceiling already does. With the default, tokens and cost are recorded and shown, and nothing acts on them (D3).
- **The swarm ignores a spent quota (verified in code).** `processTask` (`swarm.js`) discards the result of `runBeat`. It never calls `classifyBeatResult` (`driver.js:140`), so a beat that hit the session limit counts as a rejected attempt, and the task fails after its retries. The pair driver halts with `usage_limit_reached` and the reset time instead. Fix: the swarm uses the same check and halts the whole run with `usage_limit_reached`, so that a re-run resumes it. With `--output-format json`, the limit message can move into the JSON `result`. The check must read the field where the message ends up.

**Not verified.** Whether `claude -p --output-format json` reports `total_cost_usd` on a subscription login. Superlite read `total_cost_usd` from `stream-json`. The first live run settles it. If it does not report the cost, record tokens only.

**Tests.**
- A parser unit test on a recorded JSON result and on garbage input.
- A driver test: a beat that reports cost adds to the budget. With `cost_aware`, crossing the ceiling halts the run. Without it, the run continues.
- A swarm test, red then green: a beat that hit the usage limit halts the run with `usage_limit_reached` and does not count as a rejection.
- A live claude beat.

## A12: a ruling log for unattended decisions

**Gap.** An unattended Maker decides product questions alone. Only its diff shows what it chose.

**Design.**
- **Format.** `unattended-loop.md` (the one interactive template that loop work may change) tells the Maker to append one line to `conductor/1-workbench/rulings.md` for each decision the spec did not settle:
  `- [YYYY-MM-DD HH:MM] <task id> · <decision> · why: <reason> · if wrong: low|medium|high · <what breaks>`
- **Merges.** The file only grows, so it gets `merge=union` in `src/gitattributes.js`.
- **Collection.** After each beat, the driver reads the new ruling lines from the worktree diff:
  - The PR body lists every ruling of the task.
  - A `high` ruling also goes to the inbox (`writeInbox`), so the owner sees it before the merge (D4).
  - The Checker receives the rulings as review input: a ruling that contradicts the spec is a finding.
- **What code cannot do.** Code cannot force an agent to log a decision. The format is parsed and checked. Completeness can be measured only by an eval, never enforced.
- **Interactive Build is unchanged.** It already asks for product decisions.

**Tests.**
- Parser tests.
- A driver test: a `high` ruling produces an inbox line, and the PR body contains every ruling.

## A10: declared file scope, enforced by the driver

**Why now and not before.** F8 rejected "declare the scope" because a declaration is a self-report. Here the declaration becomes a contract that the driver checks against the real diff, so a wrong declaration fails one task and does not cause a collision. F8's other condition still holds: build only when the swarm has run real work (D1).

**Design.**
- **Format.** An indented line under a backlog item: `Owns: src/billing/**, test/billing/**`. `parseBacklog` already reads that block (`blockBelow`), and the parser adds `task.owns`.
- **Admission.** From the frontier, in priority order, admit a task only when its `owns` cannot overlap any task already in the wave.
  - Overlap is decided by prefix and glob, and is conservative: two globs that could match the same path overlap. Superlite compares exact strings and misses `src/` against `src/a.py`.
  - A task with no `Owns` owns everything, so it runs alone in its wave. Missing input is therefore safe, and pair mode is unchanged.
- **Enforcement.** After verify passes and before the Checker runs, compare `git diff --name-only <base>...HEAD` in the worktree with `owns`.
  - Files under `conductor/` are excluded, because the loop writes them itself.
  - A file outside the scope rejects the beat with the file list, and that reason reaches the next beat through A13.
  - The second rejection for scope fails the task, with an inbox line that asks for a wider scope.
- **Who writes `Owns`.** The Implementation Plan in `spec-it`, phase 2 (D5). That phase already decides how the work is built, after the agent has read the code, so it is the point where the files are known. Because the driver checks the real diff, the writer can be an agent: a wrong scope fails one task and does not cause a collision. A backlog item without a plan has no scope and runs alone. Prerequisite: the harvester reads only `task-backlog.md` today, not implementation plans, so a scoped plan reaches the swarm only after A10 adds that path.
- **Backstop.** F7's merge-time prediction stays in place.

**Tests.**
- A unit test of the overlap rule with a table of prefix, glob and exact cases.
- A swarm test: two tasks that overlap never share a wave.
- A behaviour test: a beat that writes outside its scope is rejected.

## A11: contracts with examples

**Finding that changes the picture (verified in code).** In the swarm, a dependency counts as `merged` once its PR is opened (`merge.js:15`: the driver opens the PR and a human merges it). The dependent task's worktree starts from the root `HEAD`, so it does not contain its producer's code unless the human merged in between. Dependencies today therefore order work without delivering code. A11 makes that state explicit and safe.

**Design.**
- **Format.** Under the producer item: `Produces: parseCell(raw: string) -> Cell`, followed by at least 2 `e.g.` lines with concrete values, for example `e.g. parseCell("=1+2") -> {kind: "formula", value: 3}`. Under the consumer item: `Consumes: parseCell (from <task id>)`.
- **Scheduling.** A `Consumes` whose producer has at least 2 `e.g.` lines creates no dependency edge. The consumer's brief contains the signature and the examples, and tells the Maker to build against a fake that returns exactly those values.
- **Deterministic check.** In the producer's diff, a test file must contain each example's output value as a literal. This can be checked with grep. It is weak but enforced, and the Checker judges the rest.
- **Seam check.** When both tasks pass, the driver appends a backlog item `Verify seam <producer> → <consumer>`, tagged `loop-ready`, with the consumer's verify run as `CONDUCTOR_REAL=1`. A later run picks it up once the human has merged both PRs on the base branch. The swarm cannot do this check itself, because "merged" means only "PR opened".

**Tests.**
- Parser tests.
- A swarm test: an edge backed by examples is not a dependency.
- A behaviour test: a producer whose tests lack an example value is rejected.
- A test that the seam item is written.

## Safety envelope

None of the five changes weakens an invariant:
- The PR-gated merge is untouched.
- The sandbox gate and the autonomy clamp run before any of the new code.
- The Evidence Rule is extended: the scope check (A10) and the example check (A11) use the real diff.
- A missing Checker verdict still fails safe.
- Each new input fails open only for measurement (A14). It fails closed for admission (A10: no scope means the task runs alone).

## Decisions (owner, 2026-10-19)

- **D1, decided.** Build A13 and A14 now, A12 after the first crossing, and A10 and A11 after the swarm has run real work.
- **D2, decided.** Cost is not a concern on a subscription. Escalation to a stronger Maker model is a quality setting, used when `loop.models.maker_escalation` is set. Features that act on cost sit behind `loop.cost_aware`, which is off by default.
- **D3, decided.** The owner runs on quota, not pay-per-token. The cost ceiling exists only with `loop.cost_aware`. A spent quota is handled as the pair driver already handles it: the run halts with `usage_limit_reached`, and the swarm must do the same.
- **D4, decided.** A `high` ruling goes to the inbox, and the run continues.
- **D5, decided.** `spec-it`'s Implementation Plan writes `Owns`, `Produces` and the `e.g.` lines. This changes an interactive workflow, but the lines have no effect outside the swarm.
