# Superpowers (obra/superpowers, Prime Radiant): state as of 2026-10-16

Researched 2026-10-16 through `gh api`, raw.githubusercontent.com and blog.fsck.com. No third-party code was cloned or run. Evidence labels: MEASURED (the source shows a measured result), IMPLEMENTED (the code exists, its effect is not measured), CLAIMED (prose only). Classification against Conductor 6.13.0: ALREADY-HAVE, PREVIOUSLY-DECLINED/PARKED, NEW.

## 1. Direction

Since 2026-06, Superpowers has turned into an eval-driven prompt-engineering shop. Every skill change goes in as a PR with a pre-registered hypothesis, a no-guidance control and per-rep tables. The eval lab (Quorum + Gauntlet) runs real agent CLIs. Releases: v6.0.0 (2026-06-16), v6.1.0 (06-30), v6.2.0 (07-23), v6.3.0 (08-12), v6.4.1 (09-18), v6.4.2 (09-25), v7.0.0 (2026-10-09). Source: https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md

Recurring themes:
- **Cost, with quality held.** The SDD review was rewritten (one reviewer per task, diffs passed as files, a required `model:` line), and v6.4.1 added "Native" inline execution as the cheaper default for capable models.
- **Less prose.** The v6.1.0 bootstrap was compressed. v6.2.0 ran a "compression sweep" that removed recap, social-proof and persuasion sections, with each cut micro-tested.
- **Tuning per model generation.** v6.4.2 was needed because Opus 5.5 started implementing the project while it wrote the plan. v7.0.0 rebuilt brainstorming around intent, because the router-and-gate version produced menus and process jargon.
- **Harness breadth.** Added Kimi, Pi, Antigravity, Devin, Hermes, Muse, OpenCode 2 and Qwen. Gemini was removed in v6.1.0 and restored in v6.2.0. Codex hooks were removed because native skill discovery was sufficient.
- Jesse Vincent's own posts state the lesson as: models are much more capable, but guided process still beats unsupervised use; and newer frontier models each have new quirks that need re-tuning (https://blog.fsck.com/2026/10/09/what-a-year/, https://blog.fsck.com/2026/09/21/superpowers-6.4/). CLAIMED.

Activity is high: 212 open issues and 156 open PRs on 2026-10-16. Open PRs on the same day restructure brainstorming and executing-plans again (#2535, #2532). superpowers-lab has been idle since 2026-06-01 (4 skills: finding-duplicate-functions, mcp-cli, using-tmux, windows-vm). The marketplace lists superpowers, superpowers-chrome, elements-of-style, episodic-memory, superpowers-lab, claude-session-driver, private-journal-mcp and double-shot-latte. Nothing new there is relevant to Conductor.

## 2. Eval suite

- Repo: https://github.com/prime-radiant-inc/superpowers-evals (public, pushed 2026-10-10). It was moved out of the plugin in v6.0.2 because the submodule broke installs.
- What it measures: 94 scenarios on workflow compliance, not capability. Scenario families: `triggering-*`, `user-pref-*` (respects "no TDD" and similar), `worktree-*`, `sdd-*` (breaker, resume, planted defects, compaction survival, stale foreign workspace), `verification-*` (phantom completion, "just confirm" pressure), `tdd-holds-under-tests-later-pressure`, `writing-good-tests-*`, `cost-*` (over-trigger, review fan-out), `e2e-broken-feature-honest-report`, and `conversation-*` (multi-turn with a simulated user). Grading is a Gauntlet LLM QA agent plus deterministic post-checks (for example `skill-before-tool`, `assert-checkout-clean`).
- Method (docs/experiments/*):
  - pre-registered decision rules
  - frozen control refs
  - pinned CLI versions, with a rule to re-baseline after a CLI bump
  - n≥5 for prose bets
  - **ceiling calibration**: the control must fail at least once before a with/without differential counts
  - Fisher tests on release gates
  - "negative results get equal billing"
- Published results (MEASURED):
  - Release gate 2026-08-09: 388 scored runs, $850. No dev-unfavourable significant cell. `sdd-escalates-broken-plan` went 0/10 → 10/10 on gpt-5.6-sol. https://github.com/prime-radiant-inc/superpowers-evals/blob/main/docs/experiments/2026-08-09-fresh-release-gate-readout.md
  - Opus 5 vs Opus 4.8 on v6.3.0: 136 runs. Identical on 11 of 13 cells. Opus 5 always front-loads brainstorming (`triggering-writing-plans` 5/5 → 0/5). Opus 5 costs about 1.5× and uses about 1.8× the tokens for the same outcomes. https://github.com/prime-radiant-inc/superpowers-evals/blob/main/docs/experiments/2026-09-02-opus5-signature.md
  - Grader reliability: in 12 conversation runs, independent blind audits found **3 false passes** by the official LLM assessor, all on Claude. The assessor had read the decisive evidence and still passed. https://github.com/prime-radiant-inc/superpowers-evals/blob/main/docs/experiments/2026-09-08-conversation-release-results.md and https://github.com/prime-radiant-inc/superpowers-evals/blob/main/docs/experiments/2026-09-10-assessor-triage.md
  - Grader swap Sonnet 4.6 → 5: 3 of 3 agreements at n=1. A drift screen only, not certification.
- Weaknesses they state themselves: the driver and the grader are the same model ("fused"), there is no offline re-judge, the infrastructure is very heavy (a VM appliance, credential pools, sealed reports), and some deterministic checks are stricter than the acceptance criteria.

## 3. Ideas, ranked by value to Conductor

### I1. Rebuttal prose is the one cut that costs behaviour. Conductor's TDD has none. MEASURED. NEW (gap)
- Skill-edit campaign (PRs #1932–#1935): deleting TDD's "Why Order Matters" rebuttals dropped test-first under "just write it, tests after" pressure from **8/10 to 5/10 (n=10)**, corroborated on Codex. Reframing prose positively (#1935) and moving it to the point of use (#1932) were neutral. The verdict: "the risk lives specifically in deletion of rationalization-rebuttal content". https://github.com/prime-radiant-inc/superpowers-evals/blob/main/docs/experiments/2026-07-06-skill-edit-campaign-1932-1935.md
- Conductor: `templates/.agents/rules/test-driven-law.md` (23 lines) and `workflows/tdd-cycle.md` (44 lines) have no Excuse/Reality table. Only `skills/verification-gate/SKILL.md` has one. The `pre-commit` gate checks only that a test is *present*, so tests written after the code in the same commit pass it. The context-bill ratchet pushes toward the exact cut that was measured harmful.
- Action: add a short rationalization table to `tdd-cycle.md` (eager, so it does not count against the always-on budget). Add a `tdd-holds-under-tests-later-pressure` case to `test/evals/`, with a control that must fail at least once. Rule for compression PRs: never delete rebuttal rows without a differential.

### I2. Guidance acts at the point of decision, not in the bootstrap. MEASURED. NEW (as a design rule)
- PR #2110: "run the project's suite, not just your file". With the text placed at the Verify-GREEN step, sessions looked at the full suite 1/12 (control) → 8/12. The same text in the session-start bootstrap was "inert on claude and glm". Sessions that saw a failure reported it 20/20, so looking is the bottleneck. https://github.com/obra/superpowers/pull/2110
- Corroborated by #2319: implementer-side prose was inert over 30 reps. The standard moved behaviour only where the reviewer and planner decide.
- Conductor: rules marked `inline: true` are injected into the root AGENTS.md (`src/agents-md.js`), which is the bootstrap placement shown to be weak. The full-suite part is ALREADY-HAVE in code: `hooks/pre-push` runs the verify command. The design lesson is new: every inline rule needs a copy at the workflow step where the agent makes the decision. Build already hard-codes RED→GREEN→REFACTOR as Step 2, which fits this.

### I3. A confident user claim switches off verification. MEASURED (n=3 calibration). NEW
- Calibration: no claim, or a hedged one ("pretty sure I ran it") → agents verify. A confident claim ("I ran it, it's green") → Claude about 1/3 verify, Codex 0/3. Urgency had no effect. Same campaign doc as I1, around line 510.
- Conductor: `verification-gate` has no row for "the user says it already passed". The loop path is immune because the Evidence Rule reads the exit code. The interactive path is exposed.
- Action: one table row: "User says it's green → their run is not your evidence. Run it." Cheap.

### I4. Weak reviewers do not fail visibly; they defend the defect. MEASURED. ALREADY-HAVE in part
- Haiku as per-task reviewer: 10 planted defects, **0 flagged at the correct severity**. Haiku "advocates for defects" (it praised a DRY violation as YAGNI) and "the pass/fail gate masks the reviewer failure". Separately, guidance alone did not stop controllers from leaving the model unnamed, so dispatches decayed to the session's top tier (26 reviewers on top tier in one run). Making `model:` a required template line fixed it (26/26 explicit). https://github.com/prime-radiant-inc/superpowers-evals/blob/main/docs/experiments/2026-06-10-sdd-cost-experiments.md
- Conductor: `skills/model-routing/SKILL.md` already says a weak verifier is a false safety signal. It also says "simple mechanical checks can run cheap" and "escalate on failure, don't start high". Escalate-on-failure does not work for reviewers, because a weak reviewer never fails visibly.
- Action: add one sentence ("the Checker never runs below the mid tier, escalate-on-failure does not apply to reviewers"). Check that the loop's Checker dispatch names its model in code. Side finding: the model table stops at `claude-opus-4-8` and does not list Opus 5 or Opus 5.5.

### I5. Match the form of the guidance to the failure, and micro-test the wording. MEASURED. NEW (maintainer practice)
- `skills/writing-skills/SKILL.md`, "Match the Form to the Failure" (https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md):
  - discipline slip → prohibition + rationalization table
  - wrong output shape → positive recipe
  - missing element → required slot in the template
  - conditional behaviour → predicate keyed to something observable
- Measured: a "don't restate the brief" prohibition gave 4.4 restated values against 3.6 for no guidance, and the recipe gave 3.0 with zero variance. Appending one nuance clause to the winning recipe regressed it to 3.8. A discrete prohibition with no competing incentive works ("don't re-run tests": 0/5 violations against 3/5 with no guidance).
- Micro-test protocol: realistic surrounding context, a no-guidance control (if the control does not fail, write nothing), 5+ reps, read every hit by hand, treat variance as a metric.
- Conductor has no equivalent. `skills/writing-evals` covers evals, not wording. Almost all of Conductor is prompt text, so this belongs in the repo's CLAUDE.md or contributor practice, not in `templates/`. Near-zero cost.

### I6. Spec-silent behaviour gets a reasonable-person standard, and plans carry a "Review Focus" list. MEASURED (6 reps per arm, plus 3-rep full runs). NEW, with tension
- Problem: in 21 eval reps, every implementer shipped the same crash on an input the spec implied but never named, and the reviewer graded it Minor. The reviewer standard moved the grading from Minor 6/6 to Important 6/6. Capping the list at a stated count of 5 was the only form that stopped list bloat (11–20 lines → 5–6). PR #2319: https://github.com/obra/superpowers/pull/2319
- Conductor: `reviewer.md` already treats a correctness defect as a BLOCKER class and has `SCOPE: partial`, which is close to their "Declined to judge" list. Its "not a finding: add a case for X where X cannot occur" is deliberately narrow. The spec-it side (at most 5 implied failure modes, each pinned by a test) is new and fits the Eval-Driven Law. Value is medium. Do not widen reviewer scope, since that conflicts with Conductor's bounded-review convergence work.

### I7. Eval methodology: ceiling calibration, frozen controls, blind grader audits. MEASURED. ALREADY-HAVE in part
- Conductor's sensitivity check (`test/evals/README.md`) is the same idea as their ceiling-calibration rule. New for Conductor:
  - **pre-register the pass threshold before data** (for example, treatment ≥ control − 1 failure at n=5)
  - **audit the LLM judge blind**, since 3 of 12 official passes were false
  - re-baseline after a harness CLI upgrade
- Applies to `test/evals/persona-eval.mjs` and to judge-panel calibration. Skip their appliance, campaign and credential-pool infrastructure. It is far beyond Conductor's needs.

### I8. `diagnosing-superpowers`: session forensics with path:line evidence. IMPLEMENTED (its behaviour evals are kept outside the repo). NEW, low-to-medium
- Intake first, then seven parallel analyst subagents (skill timeline, plan adherence, repeated work, stumbles, quality evidence, request conflicts, cost and time). Any finding without `path:line` is dropped. Read-only, scrubbed bundle only on request. https://github.com/obra/superpowers/blob/main/skills/diagnosing-superpowers/SKILL.md
- Possible use for Conductor: a post-mortem of a failed `conductor loop` beat from its transcripts. Worth building only when a recorded incident needs it.

### I9. A plan is decisions, not a code transcript. Global Constraints and Interfaces blocks. MEASURED. NEW, low unless observed
- v6.4.2 / #2333: one field report had a 19,393-line plan and no code written. With the recipe plus a proportion check (plan length against spec length), the six-module plan fell from 1,371–1,475 lines to 475–551 and still passed 9/9 planted-defect probes. https://github.com/obra/superpowers/pull/2333
- Global Constraints header: elicited 0/5 → 5/5. Per-task Interfaces blocks: 0% → 100% of tasks, and fewer fix waves (1 against 2–4). Note their own attribution: the dollar savings came from model-written plans, not from this guidance.
- Conductor's `workflows/spec-it.md` has neither. Adopt only if Conductor plans show bloat or cross-task contract drift.

### I10. Builder check replaces the spec reviewer. IMPLEMENTED + CLAIMED (6-tester blind comparison, outcomes truncated in the PR). ALREADY-HAVE in part
- A fresh subagent reads the design "as the builder who cannot talk to the author" and lists only the questions where a wrong guess would matter. https://github.com/obra/superpowers/blob/main/skills/brainstorming/builder-check-prompt.md, PR #2463.
- Conductor's spec lens ("is every criterion testable and unambiguous") covers most of it. The builder framing is a cheap prompt variant. Low value.

### I11. Rule-and-continue, with rulings in a ledger. MEASURED. ALREADY-HAVE
- PR #2077: one session sat 8h48m on a question the controller could have decided. With the change: 0/3 stalls against 3/3 for the control, and 5/5 refusals at a `DROP TABLE` step.
- Conductor: Build 6.9.0, `workflows/build.md:38,221` ("Decide engineering, escalate product", deviations recorded in the tracker). Their extra piece is a "Rulings I made" section in the finish report. Check that Conductor's PR body lists recorded deviations. Small.

### I12. Five-round fix-loop breaker and resume-the-implementer. MEASURED. PREVIOUSLY-DECLINED
- v6.2.0, RED/GREEN campaign. Conductor rejected Superpowers' fix-loop escalation in the cross-upstream scan (CHANGELOG.md line 481: "E1's one capped round is accepted"). The new evidence does not change that: their problem was an incoherent unbounded loop, and Conductor already caps it at one round.

### Noise or no action
- **CLAUDE.md removed so AGENTS.md is read** (v6.4.2): ALREADY-HAVE (Conductor 6.7.0, same reasoning).
- **Antigravity bootstraps from a skill description** (v7.0.0, 12 runs on agy 1.3.1): relevant only if Conductor's agy adapter ever lacks AGENTS.md loading.
- **Native inline execution is about 2× faster and half the cost of SDD** (blog 6.4): CLAIMED, the eval is not published.
- **Controller turn batching by prompt** is "prompt-immune" (0 of 159 turns batched): a useful negative result. Do not try it in Conductor's loop prompts.
- **Visual companion security model, Windows hook fixes**: not relevant.
- Blog posts on the Sen/"Therapist" pattern and credential arbiters (https://blog.fsck.com/2026/07/20/the-therapist-pattern/, https://blog.fsck.com/2026/07/05/new-patterns/): CLAIMED, no measurements. The Therapist (only one subagent may edit the persona) is in line with Conductor's "propose rules, never auto-append".

## Sources not reachable or not read in full
- superpowers-autoresearch (public, https://github.com/prime-radiant-inc/superpowers-autoresearch): referenced, not read.
- PR #2463 evaluation outcomes: the body was truncated in the API output. Full results are in PR #2464, not read.
