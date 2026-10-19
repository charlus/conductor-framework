# Superlite imports: design

> **Status:** designed 2026-10-19, nothing built. Decisions D1–D5 are open for the owner.
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

**Conflict with an earlier recommendation.** The paused Unattended Crossing brainstorm recommends "stop adding loop features and do one real crossing". A13 and A14 make that crossing readable: a retry that knows why it failed, and a cost for the crossing report and for Q3. A12 to A11 should wait until the crossing has run (D1).

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
- After 2 rejected beats on a task, the next beat uses `loop.models.maker_escalation` if it is set (D2). Without it, nothing changes.

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
- **Ceiling.** `budget.max_cost_usd`. At 70% of it, write one inbox line. At 100%, halt between beats with `budget_exceeded`, as the wall-clock ceiling already does (D3).

**Not verified.** Whether `claude -p --output-format json` reports `total_cost_usd` on a subscription login. Superlite read `total_cost_usd` from `stream-json`. The first live run settles it. If it does not report the cost, record tokens only.

**Tests.**
- A parser unit test on a recorded JSON result and on garbage input.
- A driver test: a beat that reports cost adds to the budget, and crossing the ceiling halts the run.
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
- **Who writes `Owns`.** The human, in the backlog, for the first runs. Changing `carve` or `spec-it` to emit it is a change to the interactive path (D5).
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

## Decisions for the owner

- **D1.** Order against the crossing. My pick: build A13 and A14 now, because they make the first real crossing readable. Build A12 after the crossing. Build A10 and A11 only after the swarm has run real work. The alternative is to build all five now, against the paused brainstorm's advice.
- **D2.** Escalation to a stronger Maker model after 2 rejections. It raises cost per task. My pick: opt-in through `loop.models.maker_escalation`, off by default.
- **D3.** A cost ceiling that halts the run. My pick: a hard halt between beats, the same as the wall-clock ceiling. The alternative is to warn only, as superlite does.
- **D4.** Where a `high` ruling goes. My pick: the inbox, and the run continues. The alternative is to stop the task until the owner answers.
- **D5.** Whether `carve` and `spec-it` emit `Owns`, `Produces` and `e.g.` lines. This changes the interactive path. My pick: not before A10 has run on hand-written scopes.
