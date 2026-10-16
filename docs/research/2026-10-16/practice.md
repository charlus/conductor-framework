# Harness engineering and agentic SE practice, June to October 2026

Researched 2026-10-16 against Conductor 6.13.0. Every web source was read as untrusted data. Evidence labels:

- **MEASURED**: numbers from a described experiment (sample size stated or recoverable).
- **IMPLEMENTED**: the author ships or runs it; outcome numbers are vendor-reported, or absent.
- **CLAIMED**: opinion, argument or anecdote.

Classification against Conductor: **ALREADY-HAVE** (file cited), **DECLINED/PARKED** (roadmap doc cited), **NEW**.

---

## 1. Converging trends

Each trend has at least three independent sources.

### T1. Harness components expire with each model generation. Remove them, then measure.

- Anthropic, *Harness design for long-running application development* (2026-03-24): "every component in a harness encodes an assumption about what the model can't do on its own". They removed context resets with Opus 4.5, then sprints and per-sprint evaluation with Opus 4.6. A radical cut "wasn't able to replicate the performance of the original", so they removed one component at a time. IMPLEMENTED. https://www.anthropic.com/engineering/harness-design-long-running-apps
- Cursor, *Improved token efficiency for longer agent runs* (2026-09-23): removed about 66% of the system prompt "because newer models needed fewer explicit rules". Tools used in fewer than 20% of conversations now load on demand (static tool tokens -60%). Overall token cost -7% "without reducing agent quality", by A/B test on live traffic. Sample sizes are not given. MEASURED (vendor). https://cursor.com/blog/improved-token-efficiency
- Anthropic, *April 23 postmortem* (2026-04-23): three harness-level changes degraded Claude Code. Two were a verbosity cap in the system prompt (-3% in an ablation eval) and a lower default effort. All passed review, tests and dogfooding. New process: "Per-model evals will run for every Claude Code system prompt change", line-by-line ablations, soak periods. IMPLEMENTED. https://www.anthropic.com/engineering/april-23-postmortem
- Thariq Shihipar (Anthropic) on Latent Space (2026-09-29): guidance files are model-specific ("this changes per model"), and "in the limit, Claude.md goes away". Add entries only for repeated failures. CLAIMED. https://www.latent.space/p/thariq
- Steve Yegge, quoted by Willison (2026-08-04): Gas Town worked with Opus 4.6 and broke with 4.7. CLAIMED. https://simonwillison.net/tags/coding-agents/
- Claude Code docs: `/doctor prompt-audit` looks for "instructions written for older models" and conflicting files. The best-practices page says: "If Claude already does something correctly without the instruction, delete it or convert it to a hook." IMPLEMENTED. https://code.claude.com/docs/en/memory.md, https://code.claude.com/docs/en/best-practices
- Thoughtworks Radar Vol. 34 (2026-04-15), *Agent instruction bloat* (Caution). IMPLEMENTED (field reports). https://www.thoughtworks.com/radar/techniques/agent-instruction-bloat
- ETH Zurich, Gloaguen et al., arXiv 2602.11988 (v1 2026-02-12, v3 2026-09-29): context files do not generally raise success and add more than 20% inference cost. Secondary summaries report that LLM-generated files lowered success slightly and human-written files helped about 4%. MEASURED (abstract verified; per-arm figures are second-hand). https://arxiv.org/abs/2602.11988

### T2. The value of a harness depends on the model. Measure it with and without.

- Naresh Jain on martinfowler.com, *Are Harnesses Worth the Cost?* (2026-10-13): 10 paired runs per arm on one Java service, graded by 178 external acceptance tests.
  - Frontier GPT-6 Sol: 10/10 with and 10/10 without the harness. The harness cost about 7× more ($2.68 against $0.41) and took about 3× longer.
  - Cost-optimised GPT-6 Luna: 3/10 without, 10/10 with. $0.27 a run with the harness, still cheaper than unharnessed Sol.
  - Unharnessed failures clustered at integration boundaries: status codes, Kafka payload contract, environment variable names.
  - MEASURED (small, one task). https://martinfowler.com/articles/are-harnesses-worth-the-cost.html
- Anthropic harness-design post: the solo run cost $9 in 20 minutes, the full harness $200 in 6 hours. Quality was "immediately apparent" (the solo game's core mode did not work). Anthropic keeps the evaluator only "when the task sits beyond what the current model does reliably solo". IMPLEMENTED (single runs, no variance).
- Claude Code `claude plugin eval` (v2.1.269, about 2026-09): each case runs 3× with the plugin and 3× without. It reports WITH, W/OUT and Δ, and can gate CI. "If a case scores 1.0 both with and without the plugin, the plugin isn't what made it pass." IMPLEMENTED. https://code.claude.com/docs/en/plugin-evals.md
- Thariq: "we just added evals plugins for skills", and skills are "forgotten sometimes" in long sessions. CLAIMED.
- Vercel (2026-01, outside the window): an 8 KB docs index in AGENTS.md scored 100% on Next.js evals. Skills peaked at 79%, and a secondary source says the skill was never invoked in 56% of cases. MEASURED (vendor). https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals

### T3. Maintainability decay is the main unsolved problem. Passing tests do not prevent it.

- HumanLayer, SlopCodeBench run (about 2026-07-27): staged requirements and strict pass across checkpoints, on 3 problems and 17 checkpoints.
  - Strict passes: Opus 5 4/17, Opus 4.8 1/17, Sonnet 5 1/17.
  - "Not a single model made it through all the challenges without increasing complexity across checkpoints."
  - Opus 4.8's duplication went from 4.6% to 16.8%.
  - MEASURED (one run per model, directional). Benchmark paper: arXiv 2603.24755. https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/benchmarking-opus-5-on-slop-code-bench.md
- Dex Horthy, *Why Software Factories Fail* (about 2026-07-22): RL rewards passing tests and puts "no penalty for eroding codebase maintainability". Keep humans on product intent, architecture and interfaces, and per-slice review of 100 to 200 lines. CLAIMED, and the author sells tools in this space. https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/wsff.md
- OpenAI, *Harness engineering* (2026-02, the anchor post):
  - The team spent "every Friday (20% of the week) cleaning up AI slop" until they encoded "golden principles" and added recurring background Codex tasks. These "scan for deviations, update quality grades, and open targeted refactoring pull requests".
  - Rules that documentation fails to hold are promoted into lint and structural tests.
  - IMPLEMENTED. https://openai.com/index/harness-engineering/ (read via a reader proxy because of a 403)
- Giles Edwards-Alexander on martinfowler.com, *The Economic Benefit of Refactoring* (2026-07-30): 15 refactoring steps on a 17k-line Rust file. Input tokens for the same representative change fell 83% (159,564 → 27,360), mostly once the largest file was split. Claude did not find the refactorings itself. MEASURED (n=1, estimated tokens). https://martinfowler.com/articles/exploring-gen-ai/refactoring-economic-benefit.html
- Boris Cherny (Anthropic), via Willison (2026-09-11): "Production code written by Claude should have a higher bar". Anthropic uses lint rules, end-to-end tests, daily fuzzers, automated review and automated refactoring. IMPLEMENTED. https://simonwillison.net/2026/Sep/11/boris-cherny/

### T4. Deterministic sensors beat prose. Silent on success, corrective on failure.

- Geoffrey Huntley, via Willison (2026-10-13): a pre-commit hook rejects direct observability calls and injects a prompt that names the right library. Result: "All of a sudden it's ten out of ten." CLAIMED. https://simonwillison.net/2026/Oct/13/geoffrey-huntley/
- Thoughtworks Radar Vol. 34, *Feedback sensors for coding agents* (Trial): deterministic gates, ideally "during the coding session … before a commit is made". https://www.thoughtworks.com/radar/techniques/feedback-sensors-for-coding-agents
- HumanLayer, *Skill Issue* (2026-03-12): hooks that are "completely silent" on success, and exit code 2 re-engages the agent. Swallow test output and surface only errors. Run a subset of tests during a session, not the full suite. IMPLEMENTED/CLAIMED. https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents
- Claude Code best practices: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic". Stop hook or `/goal` as the gate for unattended runs. IMPLEMENTED.

### T5. A reviewer with clean context and one writer. Do not chase every finding.

- Cognition, *Multi-Agents: What's Actually Working* (2026-04-22): the review works "best when the coding and review agents do not share any context beforehand". "Writes stay single-threaded and the additional agents contribute intelligence rather than actions." Parallel-writer swarms have low adoption. IMPLEMENTED. https://cognition.com/blog/multi-agents-working
- Claude Code best practices: adversarial review in a fresh subagent. "A reviewer prompted to find gaps will usually report some … Chasing every finding leads to over-engineering." IMPLEMENTED.
- Thoughtworks Radar Vol. 34: *Coding agent swarms* is Caution ("costly and immature"). It notes that the C compiler and the Cursor browser had complete specs and test suites, which typical product work lacks.
- Cursor, *Scaling long-running autonomous coding* (2026-01): equal peers with locks failed. Planners, workers and judges work better, and "periodic fresh starts" are still needed against drift. IMPLEMENTED. https://cursor.com/blog/scaling-agents

### T6. Proof of work for async agents: a plan grounded in source, expected results, recorded evidence.

- Cognition, *Verifying Agentic Development at Scale* (2026-05-29):
  - The test plan "must be grounded in source, not assumptions".
  - The agent records the expected behaviour before each action, because "Devin will lie less about its findings if it annotates its expected behavior".
  - Login is scripted deterministically.
  - Failure modes: drift, invented paths, screenshot timing, and setting state through browser JavaScript instead of the UI.
  - Approved test runs per day more than doubled. IMPLEMENTED.
  - https://cognition.com/blog/testing-development
- Claude Code best practices: "Have Claude show evidence rather than asserting success." Naresh Jain R5: require recorded evidence at completion. Antigravity: artifacts (plans, screenshots, recordings) that the reviewer comments on. IMPLEMENTED.

### T7. Humans at the start and the end. The middle is "boring".

- Every, *Compound Engineering Gets an Upgrade* (2026-05-29): "Ideate and brainstorm are the new front of the process. Polish is the new end." The work phase "has become boring". CLAIMED. https://every.to/p/compound-engineering-gets-an-upgrade
- HumanLayer WSFF: product review, system design, program design, then vertical slices. One hour of planning cut review from about 6 hours to 20 minutes (author's illustration). CLAIMED.
- Claude Code docs and Thariq: interview with AskUserQuestion, write SPEC.md, run a fresh session. "figuring out your unknowns." IMPLEMENTED/CLAIMED.
- Willison (2026-08-22, 2026-09-24): the key skill is to "confidently instruct … then confidently verify", and agents make engineering harder. CLAIMED. https://simonwillison.net/2026/Aug/22/more-than-just-code-review/

### T8. Cheap executor, frontier lead. Routing for cost.

- Cognition, *Making Fable Cheaper Than Opus* (2026-07-13):
  - 3,000 sessions on FrontierCode 1.1.
  - Fable plus a cheaper sidekick: score 60.7 at $1.86, against pure Fable at 60.8 and $4.03 (-54%).
  - The gain came from fewer lead turns and specific handoff briefs that state constraints and the definition of done. It did not come from more handoffs.
  - MEASURED (vendor, means only, effort settings possibly mismatched).
  - https://cognition.com/blog/making-fable-cheaper-than-opus
- Devin Fusion (2026-06-29): routing switches models only at compaction, to avoid extra cache misses. Fusion scores 63.1 at $1.35, Opus 5 63.6 at $3.51. "Delegation hurt quality" when judgment is the deliverable. MEASURED (vendor). https://cognition.com/blog/devin-fusion
- Cursor Router (2026-08-06): Auto Balance "outperforms Opus 4.8 at 41% lower cost", with satisfaction inferred from user behaviour. MEASURED (vendor). https://cursor.com/blog/how-cursor-router-works
- Naresh Jain (T2): the harness turns the cheap model from unusable to reliable.

### T9. Harness vendors are absorbing orchestration

All IMPLEMENTED. This matters for where Conductor's differentiation sits.

- Claude Code: `/goal` (a Stop-hook evaluator per turn), agent view, agent teams, dynamic workflows, Projects (parallel cloud sessions), auto mode as default (v2.1.283), mods. Docs: https://code.claude.com/docs/en/goal.md, https://code.claude.com/docs/en/workflows.md, https://code.claude.com/docs/en/claude-projects.md
- Cursor (2026-08-19): `/goal`, subagents on their own machines, PR and Slack subscriptions. Projects followed (2026-09-10). https://cursor.com/changelog/08-19-26
- Codex at DevDay (2026-09-29): Codex Cloud, an `/agents` view, and the Agents API with the Codex harness. Coverage is secondary only. https://www.infoq.com/news/2026/10/openai-devday-2026/
- Factory Missions (2026-06-15): no measurements. https://factory.com/news/software-factory

---

## 2. Other sources read

| Source | Date | Point | Evidence |
|---|---|---|---|
| Böckeler, *TDD inside the agent loop: theater or actual value?* https://martinfowler.com/articles/exploring-gen-ai/tdd-in-the-agent-loop.html | 2026-08-10 (index date) | Below, under I3 | MEASURED, small |
| Anthropic, *How we contain Claude* https://www.anthropic.com/engineering/how-we-contain-claude | 2026-05-25 | Below, under I1 | MEASURED (vendor) |
| Edwards-Alexander, *An Accidental Blackboard* https://martinfowler.com/articles/exploring-gen-ai/an-accidental-blackboard.html | 2026-09-02 | Agents coordinated by claiming plan lines in the repo. Frequent pushes overloaded CI. Wants the channel kept out of git. No data | CLAIMED |
| Cursor, *Rollouts and Security Reviewer* https://cursor.com/blog/rollouts-and-security-reviewer | 2026-09-23 | Pre-merge monitoring plan from the diff, post-deploy check against a baseline. Security reviewer comment acceptance rose from 45–50% to 60–70% | IMPLEMENTED / vendor |
| Cognition, *Estimating the Productivity of an Autonomous AI SWE* https://cognition.com/blog/ai-productivity | 2026-06-04 | An estimator agent tracks human estimates at r_log = 0.74 over 233 sessions. Lines changed alone give R² = 0.27, so "code volume is a weak proxy" | MEASURED |
| Thoughtworks Radar Vol. 34, *Measuring collaboration quality with coding agents* (Assess) https://www.thoughtworks.com/radar/techniques/measuring-collaboration-quality-with-coding-agents | 2026-04-15 | Track first-pass acceptance, iterations per task, post-merge rework and review burden, not throughput | CLAIMED |
| HumanLayer, *Context forking* https://www.humanlayer.dev/blog/context-forking-to-save-time-trouble-and-tokens | 2026-05-15 | Rewind to before large low-value output. Fork to explore designs. No data | CLAIMED |
| Factory, *Measuring agent readiness* https://factory.com/articles/measuring-agent-readiness | 2026-05-27 | Readiness score gates autonomy. No outcome data | CLAIMED |
| Willison, *Default hard budget caps* https://simonwillison.net/2026/Oct/3/default-hard-budget-caps/ | 2026-10-03 | Hard spend caps by default for anything agents wire up. AWS and GCP added caps | CLAIMED |
| OpenAI Codex best practices https://learn.chatgpt.com/guides/best-practices | undated | Short AGENTS.md, rules added after repeated mistakes. Plan first. "skills define the method and scheduled tasks define the schedule". Worktrees per live task | IMPLEMENTED |
| Spec-driven tools (Kiro, Spec Kit, OpenSpec), secondary roundup | 2026 | Heavy process for small changes (a minor bug became 16 acceptance criteria in Kiro). Specs drift from code unless something enforces sync | CLAIMED |

Thin coverage, recorded as gaps:

- **Google.** No primary 2026 Jules or Antigravity engineering post found. Antigravity 2.0 and `agy` (2026-05) are known only from secondary sources. Conductor already harvested Google's *New SDLC* (see `docs/roadmap/Eval-Driven-Law.md`).
- **GitHub Copilot.** No dated 2026 lessons post found.
- **Amp.** Only a podcast: Oracle is a reviewing and planning subagent, not an editor.
- **Vercel.** Only the January eval post.
- **Thoughtworks Radar.** Vol. 35 is not yet published. Vol. 34 (April) is the latest.

---

## 3. Ideas ranked by value to Conductor

### I1. Check the loop sandbox egress: the maker can reach github.com

- **What.** Anthropic's containment post: "Every function reachable through any domain on an allowlist is now an attack surface." Keep credentials out of the sandbox, because "if credentials never enter the sandbox, they can't be exfiltrated". Measured context: users approved about 93% of prompts, auto mode lets about 17% of overeager actions through, and the red-team phish test succeeded 24 of 25 times.
- **Conductor today.**
  - The driver pushes from outside the sandbox (`src/loop/merge.js:88`).
  - The maker profile `templates/.agents/sandbox/claude-sandbox.settings.json` allows `github.com` and `*.github.com`.
  - The sandbox allows reads, so the host's `gh` or git credentials may be readable inside it.
  - If they are, a maker beat could push or open a PR itself and bypass the driver's PR gate.
- **Evidence.** MEASURED (Anthropic, vendor). The Conductor side is **not verified**: I did not run a live beat.
- **Classification.** NEW. Touches the safety envelope (PR-gated merge, L3 sandbox).
- **Recommendation.** A live check: from inside a sandboxed beat, try `gh auth status` and `git push`. If either works, drop GitHub from the maker allowlist, or deny reads of the credential paths. The maker needs registries, not the forge. Cheap, high value.

### I2. An outcome eval with a "bare harness" arm, per model

- **What.** T2 and T1 together: run the same task with Conductor's Build and without it, on the target models, and grade on external acceptance (Jain's method). `claude plugin eval` does this with/without split natively, and the April postmortem shows why a re-run on every prompt change pays.
- **Conductor today.** `test/evals/` measures *process adherence* against a mutation (persona read 9/9 against 0/9, routing 16/16, sensitivity checks). The project card eval compared card against draft card. Nothing measures whether a Conductor-built feature is *better* than one from the bare harness, or on which models the methodology pays for its bytes.
- **Evidence.** MEASURED (Jain), IMPLEMENTED (Anthropic plugin eval).
- **Classification.** Partly ALREADY-HAVE (`test/evals/README.md`). The outcome arm is NEW. A recurring live-eval lane was PARKED as a cost decision: "Nightly live-eval lane gating releases", `docs/roadmap/AIDLC-Harvest.md` § Parked.
- **Recommendation.** A one-off, not a lane. Run 3 to 5 tasks × 2 models × with/without Conductor, graded by hidden acceptance tests plus a complexity metric. It answers I3 and I4 too. It costs real model money, so this is the owner's call.

### I3. Re-test the in-loop RED → GREEN → REFACTOR ritual. The presence gate stays.

- **What.** Böckeler's experiment (5 small greenfield tasks, Sonnet 4.6, Opus as blind judge):
  - Non-TDD solutions ranked above TDD solutions in most batches.
  - No difference in mutation score. Coverage was 98–100% in both arms.
  - TDD cost 2.96× to 8.5× the tokens (cache reads inflate this).
  - Red steps were often skipped or faked, and TDD instructions "actively work against such an up front design step".
  - She has stopped asking agents to write tests first. She recommends mutation testing and outcome monitoring.
  - Counterpoint: Willison's *Red/green TDD* chapter (CLAIMED).
- **Conductor today.** `templates/.agents/rules/test-driven-law.md` plus `build.md` Step 2 (RED/GREEN/REFACTOR per increment), and the `pre-commit` TDD presence gate. Jain's R4 and the Goodhart boundary (no deleting or weakening tests) are ALREADY-HAVE.
- **Evidence.** MEASURED but very small. It does not justify a change on its own.
- **Classification.** It challenges a recorded design decision ("Test-Driven Law as an always-on rules/ file", CLAUDE.md). So it is a PO decision, not mine.
- **Recommendation.** Do not change it now. Put "Build with the ritual" against "Build with tests required but no red-first" into I2. Keep the presence gate either way, because it is deterministic and cheap.

### I4. A deterministic maintainability sensor on product code, with a recurring cleanup goal

- **What.** T3: every model accumulates complexity and duplication across staged changes (SlopCodeBench). OpenAI replaced a 20%-of-the-week manual cleanup with golden principles, lint, and recurring cleanup PRs. Refactoring cut the per-change input tokens 83% (Fowler, n=1).
- **Conductor today.**
  - `deepen` workflow (manual, brownfield).
  - `architecture-checklist` items with `check:` commands.
  - `context-bill` ratchets the *framework's* bytes, not the product's code.
  - No complexity, duplication or file-size ratchet on the code Conductor builds.
  - The time-based loop exists through the ignition contract (`how-it-works.md`, "The Four Loop Types").
- **Evidence.** MEASURED (directional), IMPLEMENTED (OpenAI).
- **Classification.** NEW for the ratchet. The cleanup cadence is ALREADY-HAVE through the cron ignition contract.
- **Recommendation.** If wanted, start with a `check:` recipe in `architecture-checklist` for largest file and duplicate blocks, reported in `conductor status`. No new gate. Medium cost. Value is uncertain until I2 shows decay on Conductor-built code.

### I5. Re-validate the framework's always-on text for each new model

- **What.** T1: components and rules expire. Cursor cut 66% of its prompt with no quality loss. The ETH study shows that context files mostly add cost. Claude Code's prompt audit flags "instructions written for older models".
- **Conductor today.**
  - `conductor context-bill` with byte ceilings that only ratchet down (`test/fixtures/context-budget.json`, always-on 15,153 bytes).
  - The project card was measured (−61% turns).
  - `test/evals` has sensitivity checks.
  - No step deletes a rule and checks whether behaviour changes on the current model.
- **Evidence.** MEASURED (Cursor vendor, ETH), IMPLEMENTED (Anthropic).
- **Classification.** Partly ALREADY-HAVE (`src/context-bill.js`). The deletion ablation is NEW.
- **Recommendation.** Add a "delete-one-rule" mutation mode to the existing evals when a new model generation ships: if an eval stays green without a rule, the rule is a candidate for removal. It reuses the `--mutate` machinery. Low cost.

### I6. A per-role model for the loop: cheap maker, frontier Checker

- **What.** T8: the gains come from a frontier lead or reviewer with a cheap executor, *provided* the handoff brief states constraints and the definition of done. Jain: a harness makes the cheap model reliable.
- **Conductor today.** The `model-routing` skill is prose. `src/loop/` has no per-role model setting (grep for `--model` in `src/loop` found nothing).
- **Evidence.** MEASURED (vendor).
- **Classification.** NEW in the loop.
- **Recommendation.** This changes run cost, so the owner decides. Small code change, needs a live run to prove.

### I7. Collaboration-quality numbers in `conductor status`

- **What.** Thoughtworks Radar: first-pass acceptance, iterations per task, post-merge rework, review burden. Cognition: lines changed is a weak proxy.
- **Conductor today.** `review-log` records findings and dispositions in 13 classes. Ship-log and status exist. There is no rework rate (fix commits on a shipped slice within N days).
- **Evidence.** CLAIMED.
- **Classification.** Partly ALREADY-HAVE (`src/commands/review-log.js`).
- **Recommendation.** Low priority. Revisit when the review-convergence measurement closes.

### I8. Expected-result-first in behaviour validation

- **What.** Cognition: annotate the expected behaviour before each action, and ground the test plan in source. Failure modes to block: invented paths, and setting state through JavaScript instead of the UI.
- **Conductor today.** The Evidence Rule, the `src/evidence/` ledger, `behavior-validator` (source-blind, anti-cheat probes), and visual review on request.
- **Evidence.** IMPLEMENTED.
- **Classification.** Mostly ALREADY-HAVE. "Expected before action" is a small prose addition, and prose is advisory by Conductor's own rule.
- **Recommendation.** Optional one-line addition to `behavior-validator`. Low value.

---

## 4. Ideas that confirm what Conductor already has

| Idea | Sources | Conductor |
|---|---|---|
| Hooks over prose, silent on success, corrective message on failure | Huntley, Radar *Feedback sensors*, HumanLayer, Claude Code docs | ALREADY-HAVE: `templates/.agents/hooks/` (`pre-commit`, `pre-push`), CLAUDE.md Operating Truth 3 |
| Clean-context reviewer, one writer | Cognition, Claude Code docs | ALREADY-HAVE: `skills/independent-review/reviewer.md`, the loop Checker, `src/loop/checker.js` |
| Do not chase every review finding | Claude Code docs | ALREADY-HAVE: Rubric v2 (quoted line plus confidence ≥ 7), `docs/roadmap/Review-Convergence-And-Harness-Alignment.md` |
| Do not let the agent change expected results | Jain R4 | ALREADY-HAVE: Goodhart boundary in `pre-commit` |
| Evidence, not assertion. Freshness bound to the tested tree | Claude Code docs, Jain R5, Cognition | ALREADY-HAVE: `src/evidence/`, `--stable-tree` (6.13.0) |
| Short AGENTS.md as a map, details on demand | OpenAI, Codex docs, Claude Code docs, ETH, Radar | ALREADY-HAVE: generated root `AGENTS.md`, `how-it-works.md` on demand, context-bill |
| Interview, then spec, then fresh session. Front-load product and design | Claude Code docs, HumanLayer, Every, Thariq | ALREADY-HAVE: `grilling`, Genesis / Grand PRD / Technical Vision / Spec-It, `handoff` |
| Vertical slices, tracer bullet first | HumanLayer WSFF | ALREADY-HAVE: `workflows/carve.md` lines 23–32 |
| Worktree per parallel task | Codex docs, Claude Code docs, Cursor | ALREADY-HAVE: `src/loop/worktree.js`, `skills/git-worktrees` |
| Subagents for context control, not job titles | HumanLayer, Claude Code docs, Codex docs | ALREADY-HAVE: `skills/subagent-isolation`. Personas are review lenses, not role subagents (`docs/roadmap/Persona-Team.md`) |
| Goal loop with an external evaluator and a turn cap | Claude Code `/goal`, Cursor `/goal` | ALREADY-HAVE: `conductor loop` beat cap plus Checker. The vendor `/goal` relies on a model verdict, Conductor on an exit code |
| Time-boxed subagents | (6.12.0 audit) | ALREADY-HAVE |

## 5. Declined, parked or hype

| Idea | Sources | Call |
|---|---|---|
| Parallel-writer swarms, many agents per task | Radar *Coding agent swarms* (Caution), Cognition (low adoption), Cursor (needed fresh restarts) | Confirms PARKED F8: `docs/roadmap/Swarm-Collision-Admission.md`. No new evidence to reopen |
| Self-improving harness, "compound" learning from feedback | Every (CLAIMED, no data), HumanLayer compounding memory demo (CLAIMED), Factory feedback loop (CLAIMED) | PARKED: memory `harness-rsi-paper-declined`, F2 held in `docs/roadmap/Peer-Framework-Harvest.md`. None meets the bar (independent evidence, fresh-task admission, evaluator outside the editable surface) |
| Agent Readiness score | Factory (no outcome data) | Not worth importing. `conductor survey` and `agents-md check` cover the useful facts |
| Blackboard channel outside git | Fowler, *Accidental Blackboard* (CLAIMED, one team, four days) | Not worth importing. `task-tracker.md` and `loop-state.json` already cover the single-writer case |
| Spec-first tool ceremony (Kiro, Spec Kit) | Secondary critiques | Reinforces Quick-Path and the "skip the plan if one sentence describes the diff" stance |
| Lights-off factory, no human review | OpenAI (agent-to-agent review, minimal blocking gates), HumanLayer against | Conductor's PR-gated merge and per-batch review match the cautious side. OpenAI's "minimal blocking merge gates" depends on throughput that Conductor users do not have. Do not import |
| Harness in the cloud, mods, Projects | Anthropic, Cursor, OpenAI | Watch. Vendors now ship goal loops and parallel cloud sessions. Conductor's lasting value is the methodology, the deterministic gates and the safety envelope, not the orchestration mechanics |

## 6. Not verified

- No Conductor change was made or run. I1 is a hypothesis from reading the sandbox profile and `merge.js`. It needs a live sandboxed beat.
- These pages were read through a summarising fetch tool, not in full: Cursor *scaling-agents*, the Factory pages, every.to. Their quotes come from that tool's extraction.
- OpenAI's *Harness engineering* post returned 403 and was read through r.jina.ai. The quotes match the article text that came back.
- Böckeler's TDD article carries no date on its page. 2026-08-10 is the date from the series index.
- Vendor numbers (Cursor, Cognition) have no sample sizes or variance.
