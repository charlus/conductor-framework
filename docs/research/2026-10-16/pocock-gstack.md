# Pocock skills and gstack: changes since the last harvest (2026-10-16)

Scope: Matt Pocock's skills since the harvest in `docs/roadmap/Pocock-Alignment-Backlog.md` (status 2026-07-14), and gstack from 1.79.0.0 (2026-09-01, the harvest in `docs/roadmap/Review-Convergence-And-Harness-Alignment.md`) to 1.91.101.0 (2026-10-13). Primary sources are the repos (CHANGELOGs, commits, skill files), read through `gh api` and raw.githubusercontent.com. Public writing gave nothing the repos do not have. Searches for Garry Tan posts on gstack found only secondary summaries from March to June 2026.

Evidence labels: MEASURED (the source shows a measured result), IMPLEMENTED (code exists, effect not measured), CLAIMED (prose only).
Classification: ALREADY-HAVE, PARKED/DECLINED, NEW.

## 1. Direction

**Pocock** (v1.1.0 2026-07-08 to v1.3.1 2026-10-04; 384 commits since 2026-07-01). The catalogue gets smaller and the bar to change it gets stricter:
- `SCOPE.md`: an issue stays open only for an observed failure that fits the philosophy. New skills are not accepted.
- `.out-of-scope/` keeps one file per rejected idea.
- Six skills were removed in #752 and `resolving-merge-conflicts` in `daa01d8` ("no longer needed").

The work is moving from one interactive session to parallel and AFK runs:
- `implement-spec` runs implementer subagents on the ready frontier of a task graph.
- `wayfinder` runs research subagents.
- `claude-handoff` launches the next session with `claude --bg`.
- `chief-of-staff` is experimental.
- `retro` now aims at the agent's environment and turns mechanical findings into deterministic checks.

**gstack** (89 releases in six weeks). Two themes:
- Unattended operation for a parent agent: the `unattended` session kind, a run-directory artifact contract and a gate list that a run never approves itself (1.91.70.0, 1.91.72.0, 1.91.97.0).
- Honest gates: a check that did not run says `not run` or `unavailable`, gates fail closed, receipts are bound to a tree, and gate-integrity scanning (1.91.19.0, 1.87.3.0, 1.91.91.0, commit `5b9b837`).

gstack is also cutting weight:
- 227 test files removed (1.91.8.0).
- Opus 5.5 prompt clean-up, with "normal-volume" instructions (1.91.15.0).
- Per-host installs: 632 SKILL.md files down to 63 (1.91.65.0).

Most of the volume is product-specific (CSO paid evals, gbrain, Capy, browser, iOS) and is noise for Conductor.

## 2. Ranked ideas

### I1. Zero-run green fails the evidence gate. NEW. High value.

- **Source.** gstack `docs/designs/HONEST_WORK_GATE_INTEGRITY.md` §W3, shipped in `5b9b837` (2026-10-10): https://github.com/garrytan/gstack/blob/main/docs/designs/HONEST_WORK_GATE_INTEGRITY.md
- **Evidence.** IMPLEMENTED. The motivating defect was observed: "Bun can silently ignore a nonexistent file selector and pass the remaining files". The design gives no rate.
- **What it does.** `gstack-evidence run` parses the runner summary into `tests_ran`, with three states:
  - `N`.
  - `0`, which is ZERO-RUN and counts as a failed lane: bun `0 pass 0 fail`, jest "No tests found", pytest "no tests ran", rspec "0 examples", go `[no test files]`.
  - `unknown`, which keeps the exit-0 pass and says `count unavailable`.
- The child's exit code is never changed. The check lives in `check`, so it keeps the transparency rule Conductor also has.
- **Conductor gap.** `conductor evidence` and the loop's green floor read only the exit code (`src/loop/driver.js`, `ready_for_check`). A verify command that selects nothing passes both gates, including in the unattended loop.
- **Fit.** This is the Evidence Rule from Operating Truth 4. It is deterministic, small, and needs a behaviour test with a fixture runner output.

### I2. Bind the Checker verdict to the worktree it reviewed. NEW for the loop. High value.

- **Source.** gstack 1.87.3.0, "Review freshness now checks both ends": https://github.com/garrytan/gstack/blob/main/CHANGELOG.md
- **Evidence.** MEASURED. Across 5 deterministic scenarios, false CURRENT grades fell from 5 to 0: mid-review edits 2→0, log-only result 1→0, advisory findings left open 2→0 (`test/review-start-evidence.test.ts`).
- **Conductor gap.** In `src/commands/loop.js` the Checker runs with `permissionMode: "acceptEdits"`, after the driver's verify run. Its "do not modify code" rule is prose only (code comment near line 632). Nothing compares the tree the floor verified with the tree the Checker left.
- `src/evidence/wtree.js` already computes the right fingerprint. Take it before verify and again after the Checker. A mismatch means reject, and the next beat re-verifies.
- I did not see a Checker edit code in a live run, so the size of the risk is not verified. The fix is a few lines and touches the safety envelope, which is why it ranks high.

### I3. Extend the Goodhart boundary with tagged gate relaxations. Part ALREADY-HAVE, part NEW. Medium-high value.

- **Source.** gstack `review/gate-integrity.md` (RH-1 to RH-15) and `gstack-gate-diff` (`5b9b837`): https://github.com/garrytan/gstack/blob/main/review/gate-integrity.md
- **Evidence.**
  - IMPLEMENTED, with a calibration pass.
  - Measured on 40 to 49 of their merged PRs: 23 to 45 listed hunks per PR (median), p75 above 100. So only findings reach a human, never every hunk.
  - RH-15 was narrowed to CI and config paths after calibration ("fix(gate-diff): RH-15? only on CI/config floors after calibration").
- **Already in Conductor.** `templates/.agents/hooks/lib.sh` covers:
  - RH-1 (deleted, renamed-away or skipped tests).
  - Gutted assertions (assertion delta).
  - RH-10 in part (protected paths, F12).
- **Not covered.**
  - RH-13: added suppression pragmas (`eslint-disable`, `@ts-ignore`, `# noqa`).
  - RH-14: `continue-on-error: true`, `allow_failure: true`, `[skip ci]`, `--no-verify` added in scripts.
  - RH-4: placeholders such as `todo!()` and `NotImplementedError` in product code.
  - RH-15: a numeric gate relaxed (timeout up, threshold down).
- **Recommendation.** Add RH-13, RH-14 and RH-4: they are syntactic and have few false positives. Leave RH-15 out unless it is limited to CI and config files, as gstack learned.

### I4. Grilling in frontier rounds, not one question at a time. NEW (Pocock reversed the source we copied). High value to the PO. This is the owner's decision.

- **Source.** Commit `a4b2009` (2026-07-16): https://github.com/mattpocock/skills/commit/a4b2009
- Also `95249b0` (2026-10-07): "Word each question so 'yes' accepts your recommended answer".
- Current skill: https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md
- **Evidence.** CLAIMED: "Same 13 questions land in ~3 rounds instead of 13". The method:
  - Each round asks every question whose prerequisites are settled.
  - Questions are numbered, each with a recommendation.
  - A question that depends on another open question waits for a later round.
  - Fact-finding goes to subagents and does not block the round.
- **Conductor state.** `templates/.agents/skills/grilling/SKILL.md` Law 1 is still "One question at a time", with Pocock's old reason. `collaborative-drafting`, `genesis.md`, `survey.md` and `retrospective.md` repeat it.
- **Why the owner decides.** It changes what the human sees in every interview. Pocock keeps the dependency ordering, which was the reason for one-at-a-time, through the "later round" rule.
- **Recommendation.** Adopt rounds plus the "yes accepts" wording. A busy PO answering by number is the use case. The change is prose in 5 files, and grilling has no eval, so the effect is not verified.

### I5. Handoff items say whether each step was run, read or assumed. NEW. Medium value.

- **Source.** gstack 1.91.17.0, field bug #3004: https://github.com/garrytan/gstack/blob/main/CHANGELOG.md
- **Evidence.** IMPLEMENTED. The motivating failure was observed: a resumed session acted on a guessed command and hit the wrong system.
- **What it does.** Each open item ends with `(path run) exit 0`, `(path read)` or `(path assumed)`. The restore step shows the assumed items under "Verify first" and checks them read-only before acting.
- **Conductor state.** `templates/.agents/skills/handoff/SKILL.md` says "re-check live state" in general terms. Build's `task-tracker.md` resume has no markers.
- **Fit.** It fits the "not verified" honesty rule and costs a few lines of prose.

### I6. A Merge Danger section in the PR body. NEW. Medium value.

- **Source.** Pocock `pr` skill, graduated in v1.3.0 (2026-10-04): https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md
- **Evidence.** CLAIMED.
- **What it does.**
  - "Door: one-way or two-way". A one-way door is a destructive or hard-to-reverse change.
  - "Blast Radius: <one word>".
  - A Summary that is the smallest visual that shows the change: pseudocode, call tree or diff sketch.
- **Conductor state.** `templates/.agents/workflows/ship.md` Phase 6 has five sections and no reversibility line. The door call matches the owner's own rule for when a decision is his ("cannot be undone cheaply").
- **Recommendation.** Add one line to "What I need from you". Skip the visuals.

### I7. Prove the regression test is red against the base tree. NEW. Medium value, medium-high cost.

- **Source.** gstack 1.91.9.0, "base control": https://github.com/garrytan/gstack/blob/main/CHANGELOG.md
- **Evidence.** IMPLEMENTED for Node and Bun only. Limits: 90 s per test, 3 min per run. Other ecosystems record "base control unavailable".
- **Conductor state.** RED is prose in `templates/.agents/rules/test-driven-law.md`, and the pre-commit hook checks only that a test change exists.
- Pocock adds a companion idea (`f3fc563`, 2026-10-07): "If you forced the red by mutating code or a fixture, diff against a pristine copy to prove the mutation landed".
- **Recommendation.** Worth a design note. Do not build it now: it depends on the ecosystem, and it runs tests twice.

### I8. A measured pass bar for flaky LLM eval cases. NEW for the Eval-Driven Law. Medium value for projects with LLM features.

- **Source.** gstack 1.91.33.0: https://github.com/garrytan/gstack/blob/main/CHANGELOG.md
- **Evidence.** MEASURED, analytically. The binomial table gives:
  - A healthy case (p = 0.95) was sent to a needless fix round 8.6% of the time. With one extension this falls to 4.1%.
  - A flaky case (p = 0.80) still fails the bar about 60% of the time.
- **The bar.**
  - 9/10 trials meet it.
  - 8/10 meets it as "qualified" only when each red is a proven provider error or judge noise.
  - 7/10 gets exactly one more batch on the same tree.
  - Anything else is a fix round. "Never raise a budget, lower a threshold, add a retry or skip a case."
- **Conductor state.** `templates/.agents/skills/writing-evals/SKILL.md` has no rule for repeated trials. The 6.11.0 changelog records a push that failed on one flaky eval.

### I9. Normal-volume instructions, changed only behind an eval. NEW (lesson). Low-medium value.

- **Source.** gstack 1.91.15.0 and 1.91.18.0: https://github.com/garrytan/gstack/blob/main/CHANGELOG.md
- **Evidence.** IMPLEMENTED. They ran Anthropic's prompt-audit against `claude-opus-5-5` and found that "CRITICAL/MUST stacks current models over-apply".
- They changed a safety rule's wording only when an eval showed the model still obeyed the new text. A registry of held safety rules fails CI when a rule's wording changes without its eval.
- Prose-pinning tests became behaviour tests, checked by a mutation pass.
- **Conductor state.** Templates hold 24 `MUST`, 14 "Iron Law", 6 `ALWAYS`, 2 `CRITICAL` and an all-caps TDD headline. That is modest. Only do this behind an eval.

### I10. The reviewer declares how much of the diff it read. NEW, small. Low-medium value.

- **Source.** gstack 1.91.78.0: `Diff read: full|partial`, `Undeclared behavior changes:`, and "CLEAN counts as approved only after a full read".
- **Evidence.** IMPLEMENTED.
- **Conductor state.** `reviewer.md` already makes the reviewer state its sweep method and any gap. `src/loop/checker.js` could reject an approval that declares `partial`. This is one field and one test.

## 3. Already have, or noise

**ALREADY-HAVE**
- gstack sideways review (sweep every sibling site of a finding, 1.91.78.0): Conductor E1 "sweep the class, `also:` list".
- Review-log status derived from findings (1.91.70.0): `src/loop/checker.js` and `conductor review-log` enforce this.
- "A check that did not run says so" (1.91.19.0, 1.86.0.0): AI-DLC A1 to A3 in 6.13.0 (`conductor status` Skipped line).
- Retro aimed at the environment, with mechanical findings turned into checks (Pocock `0243b6e`): `templates/.agents/workflows/retrospective.md`, question 5.
- `implement-spec` parallel implementers on the frontier: `src/loop/swarm.js`.
- Pocock "call the Skill tool" phrasing (`d28dfdc`): Conductor uses path pointers, and the persona eval measured 9/9 reads.
- Judge false-pass with a required step removed (gstack 1.91.24-era `docs/evals/judge-controls-2026-10.md`): Conductor evals have `--mutate` sensitivity.
- Free text sent as a file, `--body-file` (1.91.32.0): `git-hub-cli` already uses `--body-file`, and `merge.js` passes argv arrays with no shell.
- Unattended runs never approve their own gate: the autonomy clamp and the L1 floor.

**Noise for Conductor**
- stamp-at-merge version allocation (1.91.73.0, 1.91.83.0).
- `/eval-plan` pricing and preregistration.
- Capy, gbrain, CSO paid baselines, browser, iOS, and impeccable's 61 design detectors.
- Pocock `wait-what` (the owner's CLAUDE.md already asks for ASD-STE100), `chief-of-staff` (experimental, prose only), and `to-questionnaire`.

**Small housekeeping**
- Pocock's "smart zone" figure moved from about 120k to about 150k tokens (`skills/engineering/ask-matt/PHASE-BOUNDARIES.md`). Conductor's handoff skill still says ~120k. Cosmetic.
- Pocock removed `resolving-merge-conflicts` as no longer needed (`daa01d8`, CLAIMED). Conductor's ship.md merge-conflict bullet (C3) may be a no-op. Leave it, it is one bullet.

## 4. Parked and declined items: does new evidence change them?

- **Model overlays (deferred).** gstack now sends Opus 5.5 and Sonnet 5.5 to the generic Claude overlay. Tuned overlays are opt-in and apply only to exact older models (1.91.15.0, 1.91.18.0). This supports staying deferred.
- **"Boil the Ocean" (declined).** `ETHOS.md` keeps it, but §4 "Honest Work" (2026-10-10) now opposes gate weakening and self-certification. The verdict stays the same.
- **Per-host compiler (descoped).** gstack still needs it for its home-path install (and added an Antigravity host in 1.91.67.0). Conductor's reasons are unchanged.
- **Context-bill sibling blind spot (deferred).** Still open: `src/context-bill.js` bills only `SKILL.md` per skill directory. gstack bills lazy sections through carve-guard ratios. It is still a small fix.
- **F8 admission control (parked in `docs/roadmap/Swarm-Collision-Admission.md`, blocked on per-task file scope).** gstack `gstack-lane-check` (1.91.79.0) diffs in-flight branches against a plan's planned files (IMPLEMENTED, not measured). Conductor's implementation plans already name files: 6.12.0 uses "the plan's file names" for personas. This weakens the blocker. Priority stays low because F7 merge-time prediction exists.
- **Pocock stances we declined (in-loop REFACTOR, sequential spec-then-quality review).** Pocock still defers refactoring to review and still runs parallel review axes (`code-review` `3da8c01` now runs the subagents in the foreground). No new evidence either way.
