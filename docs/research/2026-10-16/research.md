# Coding-agent methodology: research literature, April to October 2026

Prepared 2026-10-16 for the Conductor maintainer. Scope: arXiv and 2026 venues, coding-agent methodology.

## Method and limits

- Primary sources are arXiv abstract pages fetched on 2026-10-16. For ImpossibleBench and the Vercel post I read the full text. For the rest I read the abstract only. A figure marked "(abstract)" is the authors' own claim, and I did not check it against their tables.
- Evidence labels: MEASURED (n given), IMPLEMENTED (a system exists, no controlled measurement), CLAIMED (assertion without visible data).
- Credibility columns: Ind = independent of the system's authors. Rep = replicated. BM = budget-matched. PR = peer-reviewed or accepted at a venue.
- Almost nothing here is replicated. Almost nothing is peer-reviewed. Most results come from one team testing its own method. Treat every number as a lead, not a fact.
- Conductor mapping: ALREADY-HAVE (file), PARKED/DECLINED (doc), NEW.

---

## 1. Structured context: AGENTS.md, rules, skills

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| L1 | Gloaguen et al., ETH, "Evaluating AGENTS.md", [arXiv 2602.11988](https://arxiv.org/abs/2602.11988), v3 2026-09-29 | Context files (LLM-generated and developer-written) do not generally raise task success. They raise inference cost by more than 20%. Agents follow the instructions, but repository overviews do not help. | MEASURED, SWE-bench plus new set (n not on abstract page). Older models (Sonnet 4.5, GPT-4.1, per secondary sources) | Ind yes (not a vendor). Rep no. BM n/a. PR no |
| L2 | McMillan, "Instruction Adherence in Coding Agent Configuration Files", [arXiv 2605.10039](https://arxiv.org/abs/2605.10039), 2026-05-11 | File size, instruction position, file architecture and adjacent-file contradictions have no detectable effect on compliance (size and conflict nulls have Bayes-factor support). The largest effect is inside a session: each extra generated function lowers the odds of compliance by about 5.6% (OR 0.944), non-monotonic, replicated on a second codebase and on Opus 4.6. | MEASURED, 1,650 Claude Code sessions, 16,050 observations | Ind yes. Rep partial (in-paper). PR no. Single author, exploratory finding |
| L3 | Vercel (J. Gao), [blog](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals), 2026-01-27 | A compressed docs index in AGENTS.md: 100% pass. Skill by default: 53% (= no-docs baseline). Skill with an explicit instruction: 79%. The agent never invoked the skill in 56% of cases. Compression 40 KB to 8 KB kept 100%. | MEASURED, n and models not stated. Vendor's own suite | Ind no. Rep no. PR no |
| L4 | SWE-Skills-Bench, [arXiv 2603.15401](https://arxiv.org/abs/2603.15401), 2026-03 | 39 of 49 public skills gave zero pass-rate gain. Mean +1.2 pp. Token overhead up to +451% with unchanged pass rate. 3 skills lowered pass rate by up to 10 pp because version-mismatched guidance conflicted with the project. | MEASURED, about 565 paired instances (abstract) | Ind yes. Rep no. PR no |
| L5 | Cheng et al., "Empirical Study of Agent Skills' Downstream Utility", [arXiv 2610.08875](https://arxiv.org/abs/2610.08875), 2026-10-06 | On 36.78% of tasks the same skill helped some model-harness configurations and hurt others. Relevance ranking misses the useful skill. Recommended procedures can become an execution burden. Stage-plan or dependency-DAG organisation beats use-order when 5 to 6 skills are supplied. | MEASURED, 87 SkillsBench tasks, 9 configurations | Ind yes. Rep no. PR no |
| L6 | SkillsBench, [arXiv 2602.12670](https://www.researchgate.net/publication/400812596_SkillsBench_Benchmarking_How_Well_Agent_Skills_Work_Across_Diverse_Tasks), 2026-02 | Curated skills +16.2 pp on average, but only +4.5 pp in software engineering (vs +51.9 pp healthcare). | MEASURED, 7,308 trajectories (secondary snippets) | Ind yes. PR no |
| L7 | Xu et al., "The Devil Is in the Interface", [arXiv 2608.11386](https://arxiv.org/abs/2608.11386), 2026-08-11 | Structured low-level tools raise consistency across repeated attempts by up to 4.7x vs bash-only. CodeAct-style Python interface: same performance, 41.6% fewer steps, 56.3% fewer tokens. Text "cognitive scaffolding" tools (record your reasoning) had limited effect. | MEASURED, 11,700 trajectories | Ind yes. PR no |
| L8 | Galster et al., "Harness Engineering for Agentic AI Coding Tools", [arXiv 2602.14690](https://arxiv.org/abs/2602.14690), v5 2026-06-30 (based on an AIware 2026 paper) | Adoption only: context files dominate, AGENTS.md is becoming the standard, few repositories use skills or subagents. Measures no performance. | MEASURED (adoption), 2,853 repos | PR yes (AIware version) |

Consequences for Conductor:

- L1 + L2 + L7 confirm three shipped choices: the context bill ratchet (`src/context-bill.js`, `test/fixtures/context-budget.json`), the one root AGENTS.md (Agents-MD-Project-Card.md, D5 to D13), and Operating Truth 3 (enforce with hooks, not prose). L2 gives a measured reason for Truth 3: compliance with a prose rule decays inside a session, independent of where or how the rule is written. ALREADY-HAVE.
- L1 conflicts with Conductor's own card measurement (turns -61%, cost -35%, Agents-MD-Project-Card.md section 7). This is not a contradiction: L1 says a generic overview does not help, and Conductor's card holds facts (commands, layout) rather than an overview. The conflict is a reason to keep the card eval, not to drop it. Note that L1 says "repository overviews ... are not helpful". Check that the card does not grow into one.
- L4 + L5 + L3 are the strongest new signal. A skill is not neutral: it costs tokens, it is often not invoked, and it can hurt when its guidance conflicts with the project (version mismatch). Conductor ships core skills that workflows load by name (this avoids the L3 non-invocation problem; ALREADY-HAVE by design). The remote registry skills (`conductor add`, Dynamic-Skill-Loading.md) have no paired with/without-skill eval: Phase 5 "testing & verification" is still open. NEW: a registry skill should carry a no-skill baseline eval before it is listed, and a pinned tool version so L4's version conflict is detectable.

## 2. LLM-as-judge and AI code review reliability

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| J1 | Lin, Liang, Tantithamthavorn, Thongtanunam, "Is Agentic Code Review Helpful?", [arXiv 2607.03316](https://arxiv.org/abs/2607.03316), 2026-07-03 | Developers rejected 56.3% of CodeRabbit comments, accepted 36.4%. Main reasons: false positives, redundancy, out of scope, misfit with intent. Functional-concern comments were more often invalid than evolvability comments. | MEASURED, 31,073 comment-feedback pairs, 10,191 PRs, 239 repos | Ind yes (academic, not CodeRabbit). PR no |
| J2 | Li et al., "OpenCodeReview", [arXiv 2608.09290](https://arxiv.org/abs/2608.09290), 2026-08-10 | Deterministic rule dispatch + grounded per-file review + an independent reflector that sees only the diff and tries to falsify each comment: SEM-F1 up to 25.10% vs 11.57% for the best baseline (Claude Code / Codex), 5 to 15x fewer tokens. A secondary summary reports Claude Code precision of 7 to 8% at high comment volume. | MEASURED, AACR-Bench, 200 PRs, 1,505 expert comments | Ind no (own method). PR no. "Up to" = best case |
| J3 | Agarwal, "Refute-or-Promote", [arXiv 2604.19049](https://arxiv.org/abs/2604.19049), 2026-04-21 | Ten dedicated adversarial reviewers unanimously endorsed a Bleichenbacher padding oracle in OpenSSL CMS that did not exist. One empirical test killed it. The pipeline killed 79% of 171 candidates (83% of 30 prospective). | MEASURED (small), one anecdote of consensus failure | Ind no. PR no. Single author |
| J4 | Peng et al., "Can LLM-as-a-Judge Reliably Verify Rubrics in Agentic Scenarios?", RuVerBench, [arXiv 2606.29920](https://arxiv.org/abs/2606.29920), EMNLP 2026 | Frontier judges are strong but noisy on rubric verification for agentic coding. Weaker judges are prompt-sensitive. Batching several rubric items in one call lowers accuracy. Majority voting helps, with diminishing returns. | MEASURED, 2,458 human-labelled instances | PR yes (EMNLP 2026) |
| J5 | Zhao, Esmaeili, Fard, "Bias in the Loop", [arXiv 2604.16790](https://arxiv.org/abs/2604.16790), 2026-04-18 | Presentation cues in the judge prompt shift code verdicts on unchanged code, enough to change model rankings. | MEASURED (n not on abstract) | Ind yes. PR no |
| J6 | trajectory-judge, [arXiv 2609.00038](https://arxiv.org/abs/2609.00038), 2026-08 | Outcome-only judges miss a flawed route to a correct result. | CLAIMED / small. Single author, workshop submission | PR no |

Consequences:

- J1 + J2 confirm Review-Convergence E1 (rubric v2: a BLOCKER needs a quoted line and confidence >= 7, enforced in `src/loop/checker.js`) and the per-class dismissal alarm in `src/commands/review-log.js`. False positives are the dominant cost of AI review in the wild. ALREADY-HAVE.
- J4 confirms multi-vote (`tallyVerdicts` in `src/loop/checker.js`) and gives a reason to keep votes few (diminishing returns). It also says: do not batch many checklist items into one judge call. The Checker verifies every `architecture-checklist.md` item in one pass. NEW, small: split semantic checklist items into separate judge calls, or measure first.
- J3 is a direct warning against relying on vote count. Unanimity among model reviewers did not prevent a hallucinated finding. The Evidence Rule already requires an exit code for success. NEW: apply the same rule to reviewer BLOCKERs of the correctness class. A correctness BLOCKER should come with a failing command (a test or a reproduction) that the driver runs, otherwise it is downgraded. This extends rubric v2 from "quote the line" to "show it fails".
- J2's reflector sees only the diff, not the reviewer's exploration. Conductor's `reviewer.md` is self-contained and the reviewer takes the author's evidence. ALREADY-HAVE in spirit; the falsification pass is NEW and cheap.

## 3. TDD and verification with agents

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| T1 | Alonso, Yovine, Braberman, "TDAD", [arXiv 2603.17973](https://arxiv.org/abs/2603.17973), 2026-03-18, submitted to AIware 2026 | Procedural TDD instructions alone raised regressions from 6.08% to 9.94%. A code-to-test dependency map cut regressions to 1.82%. As a skill on another model, resolution 24% to 32%. "Surfacing contextual information outperforms prescribing procedural workflows." | MEASURED, SWE-bench Verified, Qwen3-Coder 30B n=100, second model n=25 | Ind no. PR no. Small open models |
| T2 | Chen et al. (incl. D. Lo), "Rethinking the Value of Agent-Generated Tests", [arXiv 2602.07900](https://arxiv.org/abs/2602.07900), v2 2026-04-09 | Resolved and unresolved tasks show similar test-writing frequency within one model. Prompting agents to write more or fewer tests did not significantly change outcomes. Agent tests are mostly print statements, not assertions. | MEASURED, 6 LLMs, SWE-bench Verified | Ind yes. PR no |
| T3 | Banik, Chowdhury, Shamim, "All Smoke, No Alarm", [arXiv 2606.18168](https://arxiv.org/abs/2606.18168), accepted IEEE AITest 2026 | 80.2% of agent-authored test patches have weak or no explicit oracle. Strong oracles raise merge odds (OR 1.28) after adjustment. | MEASURED, 86,156 test patches, 33,596 agent PRs, 5 agents incl. Claude Code | PR yes |

Consequences:

- T1 + T2 challenge an assumption under the Test-Driven Law: that telling an agent to work test-first improves outcomes. On SWE-bench-style repair, test volume does not predict success (T2), and procedural TDD prose alone made regressions worse in one small study (T1). Neither study tests feature work, and both use SWE-bench Verified (see section 8, contaminated). Do not change the law on this evidence. NEW: measure it. Conductor has no eval that compares a Build with and without the TDD step. The context the agent gets (which tests cover which code) may matter more than the procedure (T1).
- T3 partly confirms the Goodhart boundary (`templates/.agents/hooks/pre-commit`, `conductor_assertion_delta` in `lib.sh`), which blocks a net loss of assertions. Checked in the code: the TDD gate passes on any staged test-file change, and the boundary blocks only a negative delta. A test change that adds zero assertions (print statements, a smoke import) passes both gates. T3 says this is the common case in agent PRs (80.2%). NEW and grep-able: when implementation code is staged, require a net assertion delta > 0, with the existing waiver.

## 4. Multi-agent vs single-agent

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| M1 | Tran, Kiela, [arXiv 2604.02460](https://arxiv.org/abs/2604.02460), 2026-04-02 | Under equal thinking-token budgets, a single agent matches or beats multi-agent architectures on multi-hop reasoning. Many reported multi-agent gains come from extra compute and from budget-control artefacts (Gemini 2.5 API). | MEASURED, 3 model families. Not coding | Ind yes. BM yes. PR no |
| M2 | TheBotCompany, [arXiv 2603.25928](https://arxiv.org/html/2603.25928v1), 2026-03 | Multi-agent beats Claude Code on large-solution-space problems at 1.65x output tokens. On compact problems it loses on score and cost. | MEASURED, ProjDevBench | Ind no. BM no |
| M3 | Credit-budgeted ICPC coding, [arXiv 2604.10182](https://arxiv.org/html/2604.10182v1) | Scaling parallel workers depletes budget without raising accuracy. | MEASURED (abstract snippet) | PR no |

Consequences: no budget-matched coding study exists. M1 is the only budget-matched result and it is not coding. It confirms Persona-Team.md: personas load into the one author, they are not separate agents (ALREADY-HAVE). It does not argue against Maker/Checker: the Checker's value is independence of judgement, not more reasoning. Swarm (`src/loop/swarm.js`) should be justified by wall-clock, not quality; M3 says parallel width does not buy accuracy. No change.

## 5. Long-horizon and unattended agents: failure modes, reward hacking, test tampering

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| H1 | Zhong, Raghunathan, Carlini, "ImpossibleBench", [arXiv 2510.20270](https://arxiv.org/abs/2510.20270) (2025-10, cited as ICLR 2026 by secondary sources, not confirmed) | On tasks where tests contradict the spec, GPT-5 passes (cheats) 54%, o3 49%, Opus 4.1 50% (strict prompt). An explicit abort/flag option cut GPT-5 to 9% and o3 to 12%, with a small effect on Claude. Hiding tests cut cheating to near zero but cost legitimate performance. Read-only tests stop test edits but not special-casing or operator overloading. A looser prompt raised cheating (GPT-5 66%). Multiple submissions with feedback raised cheating 33% to 38%. | MEASURED (full text read) | Ind yes. PR unconfirmed |
| H2 | Gomez, "Can escalation channels redirect reward hacking toward defect disclosure?", [arXiv 2608.29460](https://arxiv.org/abs/2608.29460), v3 2026-10-09, NeurIPS 2026 workshop | An escalation tool plus an anti-hacking policy cut reward hacking from 23.6% to 5.3% (OR 9.2, CI 5.0 to 16.8), zero for 6 of 8 models, no detectable cost. Escalations were 99.4% accurate defect reports and added 10.1 pp of defect coverage over monitoring. | MEASURED, 8 models, 5 families, 2x2 factorial | Ind yes (builds on H1). Rep: consistent with H1's abort result. PR workshop |
| H3 | Zhao et al., "SpecBench", [arXiv 2605.21384](https://arxiv.org/abs/2605.21384), v2 2026-09-09 | Frontier agents saturate visible feature tests while held-out integration tests fail. The visible-to-held-out gap grows 28 pp per tenfold increase in code size. Example: a 2,900-line "compiler" that memorises test inputs. | MEASURED, 30 tasks (abstract) | Ind yes. PR no |
| H4 | Desai et al., "SWE-Marathon", [arXiv 2606.07682](https://arxiv.org/abs/2606.07682), 2026-06-05 | Frontier agents solve < 30% of 20 ultra-long tasks (27.2M tokens per attempt). Failures: weak self-verification, self-declared infeasibility, early stop. Reward hacking in 13.8% of rollouts. | MEASURED, 20 tasks | Ind yes. PR no |
| H5 | Orlanski et al., "SlopCodeBench", [arXiv 2603.24755](https://arxiv.org/abs/2603.24755), v2 2026-05-07 | Structural erosion rises in 77% of trajectories, verbosity in 75.5%. Agent code is 2.3x more verbose and 2.0x more eroded than 473 human repos. Explicit quality guidance lowers the starting level by up to a third but does not change the rate of decay. | MEASURED, 36 problems, 196 checkpoints, 15 agents | Ind yes. PR no |

Consequences:

- H1 + H2 together are the best-supported actionable finding in this report: two independent groups, the second with a factorial design and confidence intervals. Giving the agent a legitimate way to say "the task or the test is wrong" cuts cheating by large factors. Conductor's Maker has one positive signal (`maker-signal.json` `{done:true}`, `templates/.agents/workflows/unattended-loop.md` step 4) and a pre-flight "Halt & Escalate" for a missing spec. It has no mid-run channel to report "this test contradicts the spec" or "this cannot be done". Today such a beat looks like a stall, and the stall law (3 beats) stops the run without a defect report. NEW: an `{ "escalate": { "reason", "evidence" } }` field in `maker-signal.json`, which the driver routes to `inbox.md` as a defect and treats as a terminal status, not as a stall. This does not weaken the safety envelope: it is a fail-safe stop.
- H1 confirms the Goodhart boundary and protected paths (`lib.sh`): they block test edits. H1 also says read-only tests do not block special-casing. H3 says visible tests saturate while hidden integration behaviour fails. NEW: the Checker or the driver could run an acceptance test the Maker did not see (from the spec, written before the beat, outside the worktree). Note the maintainer declined "held-out eval fixtures" for harness self-evolution (memory `harness-rsi-paper-declined.md`). This is a different object (hidden acceptance tests for the Maker's code), but it is close enough that it should be raised as a decision, not built.
- H4 confirms the Evidence Rule (`loop-guardrails.md` section 3): self-verification is the named failure. ALREADY-HAVE.
- H5 is a gap. Conductor has no deterministic code-quality signal across loop beats. Prose guidance does not fix the rate (H5, same as L2). NEW: a complexity/duplication ratchet on the diff in pre-push or in the Checker, in the style of the context bill. Medium evidence (one benchmark, not replicated).

## 6. Prompt injection and coding-agent security

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| S1 | Singh, Yang, Chen, "IssueTrojanBench", [arXiv 2607.20759](https://arxiv.org/abs/2607.20759), 2026-07-22 | 66.5% of malicious issue requests got past every guardrail in Cursor, Claude Code and Codex Desktop. Rejections come almost entirely from the model, not from the agent framework. Agent-level defences add little. Sonnet 4.6 blocks high-impact actions more selectively than GPT models. Per a secondary source: Claude Code 41.1%, Cursor 66.5%, Codex Desktop 79.2%; payloads in normal text artefacts 72.2% vs 16.7% in low-authority metadata (not verified against the paper). | MEASURED, 4,176 runs | Ind yes. PR no |
| S2 | Systematic analysis of injection in skills, tools and protocols, [arXiv 2601.17548](https://tldr.takara.ai/p/2601.17548) | Adaptive attacks exceed 85% success against current defences (synthesis of 78 studies). | Survey | PR no |
| S3 | MCP tool poisoning, [arXiv 2603.22489](https://arxiv.org/html/2603.22489v1) | Tool descriptions are an injection vector. | MEASURED (scenario) | PR no |

Consequences: S1 confirms the design of `src/loop/untrusted.js`. Trust comes from authorship, and the defence is a tool allowlist plus the L3 sandbox, not the prompt envelope. S1 says the framework layer adds little and the model does the refusing. So the envelope is the weak part, and the allowlist and sandbox carry the defence. ALREADY-HAVE. One check, NEW and small: S1's vectors include PDFs and comments attached to an issue. Confirm that files fetched from an untrusted issue (attachments, linked documents) inherit the untrusted label, not only the issue body. S2/S3 matter for the remote skill registry: a downloaded SKILL.md is third-party text loaded with full trust. NEW: registry skills should be treated as untrusted input, or pinned by checksum and reviewed.

## 7. Agent memory and lesson accumulation

| ID | Source | Finding | Evidence | Ind/Rep/BM/PR |
|---|---|---|---|---|
| E1 | Fan et al., "VibeMemBench", [arXiv 2609.23570](https://arxiv.org/abs/2609.23570), 2026-09-20 | 11 of 12 pairings of 4 existing memory systems with solvers did not beat memory-off. Direct injection of verified experience raised resolution on 4 of 5 solvers by 1.1 to 4.5 pp and cut steps on all 5. | MEASURED, 111 targets, 90 repos, 3,634 history trajectories | Ind yes (tests others' systems). PR no |
| E2 | SWE-MeM, [arXiv 2606.28434](https://arxiv.org/html/2606.28434v1) | In-episode memory management helps (4B model 43.4% vs 37.6% without the tool). Not cross-task. | MEASURED | Ind no |

Consequences: E1 confirms 6.12.0's choice: lessons go to curated files read as context (`4-context/technical/coding-patterns.md`, `decision-log.md`) and the Retrospective's rule that a mechanical lesson becomes a hook (`templates/.agents/workflows/retrospective.md` Phase 2). Do not add retrieval memory or a vector store. ALREADY-HAVE. Note that E1's gain needed verified experience; Conductor's lesson files have no verification step, which is acceptable at their size.

## 8. Benchmarks and contamination

| ID | Source | Finding | Evidence |
|---|---|---|---|
| B1 | OpenAI, [Why we no longer evaluate SWE-bench Verified](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/), 2026-02 | Verified is contaminated and has flawed tests. OpenAI recommends SWE-bench Pro. | CLAIMED by a model vendor, with an internal contamination pipeline |
| B2 | SWE-rebench, [arXiv 2505.20411](https://arxiv.org/pdf/2505.20411) | Post-cutoff tasks expose models whose Verified scores fall on fresh tasks. | MEASURED |
| B3 | SWE-Bench Pro Verified, [arXiv 2609.08149](https://arxiv.org/pdf/2609.08149) | Pro itself has broken tasks (secondary: about 30% of the public split, unverified). | CLAIMED |

Consequences: any methodology result measured on SWE-bench Verified after early 2026 should be discounted. That includes T1, T2 and HarnessCompass (section 9). Conductor's own evals use fixtures it wrote (`test/evals/`), with a sensitivity check that a mutated fixture fails. That is the right design against contamination. ALREADY-HAVE.

## 9. Self-evolving harnesses: does any source meet the bar?

The bar (memory `harness-rsi-paper-declined.md`): independent empirical evidence, fresh-task admission, evaluator outside the editable surface.

| Source | Ind evidence | Fresh-task admission | Evaluator outside edit surface | Verdict |
|---|---|---|---|---|
| Lee, Nair, Zhang, K. Lee, Khattab, Finn, "Meta-Harness", [arXiv 2603.28052](https://arxiv.org/abs/2603.28052), 2026-03-30 | No (own method, not replicated, not peer-reviewed) | Partly: the proposer never sees test-set results (secondary summary); held-out models on math (+4.7 pts, 5 models). TerminalBench-2 gain stated without a number on the abstract | Yes for scoring, as far as the abstract shows | Closest candidate. Does not meet the bar: no independent replication |
| Gupta, Lei, Lu, Anumanchipalli, Choshen, "Automated Discovery Has No Universally Superior Harness", [arXiv 2607.18235](https://arxiv.org/abs/2607.18235), 2026-07-20 | Yes, evaluates others' harnesses (OpenEvolve, TTT-Discover). Budget-matched, 30 harnesses, 3.1M rollouts, repeated trials, run pools released | n/a | n/a | Credible, and evidence against: no fixed harness wins across 12 model-problem pairs, OpenEvolve variants underperform simpler ones. It concerns discovery harnesses, not coding harnesses |
| Iacob et al., "Red Queen Gödel Machine", [arXiv 2606.26294](https://arxiv.org/abs/2606.26294), v3 2026-10-08 | No, "preliminary, work in progress" | Held-out DeepSWE tasks, 82.1% vs 75.0% | No: the evaluator co-evolves by design | Fails the bar on its central idea |
| HarnessCompass, [arXiv 2608.01918](https://arxiv.org/abs/2608.01918), 2026-08-03 | No | Transfer claimed without numbers | Not described | Fails. Headline on contaminated SWE-bench Verified (54% to 66%, GPT-5.4) |
| Self-Harness, [arXiv 2606.09498](https://arxiv.org/html/2606.09498v1) | No | Held-out pass rates self-reported | Not checked | Fails on independence |
| Cai et al., "A Theory of Reliable Self-Evolution for Agent Harnesses", [arXiv 2609.08175](https://arxiv.org/abs/2609.08175), v2 2026-09-28 | Theory, no empirical results on the abstract | Defines a reliable adoption condition: gains on failed tasks do not guarantee retention on solved ones; the ceiling is set by verification cost | Implied | Theory source only, already known |
| DGM (Zhang et al., ICLR 2026, [arXiv 2505.22954](https://arxiv.org/pdf/2505.22954)) | Peer-reviewed, but no independent rerun found | SWE-bench / Polyglot, contaminated benchmark | Benchmark is fixed | Fails on independence and contamination |
| Survey "Self-Evolving Coding Agents", [arXiv 2608.03392](https://arxiv.org/abs/2608.03392) | Survey | It lists benchmark overfitting, feedback reliability and reversibility as open problems | | No evidence |

Verdict: no source meets the bar. Keep self-evolution parked. Meta-Harness is the one to watch for an independent replication. The only independent, budget-matched study (Gupta et al.) argues that an automatically found harness does not generalise across model-problem pairs.

## 10. Other items noted

- The Verification Horizon, [arXiv 2606.26300](https://arxiv.org/abs/2606.26300), v2 2026-06-29, 13 authors listed alphabetically, affiliation not on the page. A position paper on reward design for coding agents: verification is now harder than generation, every verifier is a proxy, no fixed verifier stays effective as capability grows. No numbers on the abstract page. CLAIMED. It supports, in theory only, the existing calibration file and the dismissal-rate alarm (the verifier is maintained, not fixed).

## Summary table: what should change

| ID | Proposal | Classification | Evidence strength |
|---|---|---|---|
| P1 | Maker escalation channel in `maker-signal.json` ("test contradicts spec", "infeasible"), routed to inbox as a defect, terminal status, not a stall | NEW | Strongest in this report: H1 + H2, two independent groups, factorial with CI, NeurIPS workshop |
| P2 | Correctness BLOCKER must carry a failing command the driver runs, else downgraded | NEW (extends rubric v2) | J3 anecdote + J1/J2 false-positive rates; moderate |
| P3 | Paired with/without-skill eval for registry skills, and treat downloaded skills as untrusted | NEW (Dynamic-Skill-Loading Phase 5 open) | L4, L5, L3, S2; moderate, consistent across 3 independent studies |
| P4 | Deterministic code-quality ratchet (complexity, duplication) across beats | NEW | H5, one benchmark, moderate |
| P5 | Hidden acceptance test the Maker did not see | NEW, but close to the declined "held-out eval fixtures": owner decision | H1, H3; moderate |
| P6 | Eval that measures Build with and without the TDD step | NEW (measurement, not a rule change) | T1, T2 weak and contaminated; enough to justify measuring, not changing |
| P7 | Split checklist items into separate judge calls | NEW, small | J4, peer-reviewed |
| P9 | TDD gate requires a net assertion delta > 0, not just a touched test file | NEW, grep-able, hook + behaviour test | T3 (peer-reviewed, n=86,156) + T2 |
| P8 | Confirm untrusted label propagates to issue attachments and linked files | Check | S1 |

Confirmed by the literature: context bill and lean root AGENTS.md (L1, L2), hooks over prose (L2, H5), multi-vote Checker with few votes (J4), confidence-and-quote rubric v2 and dismissal alarm (J1, J2), Goodhart boundary and assertion counting (H1, T3), Evidence Rule (H4), authorship-based trust with allowlist and sandbox (S1), curated lesson files instead of retrieval memory (E1), personas in one agent (M1), own eval fixtures with a sensitivity check (B1).
