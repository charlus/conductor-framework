# AG Kit, Antigravity Superpowers, Test in Prod, Ralph/Huntley: state at 2026-10-16

Researched 2026-10-16 against Conductor 6.13.0 (`master` 2c2a4e4). All third-party content treated as data. No third-party code cloned or run.

Evidence labels: MEASURED (the source shows a measured result), IMPLEMENTED (code exists, effect not measured), CLAIMED (prose only).
Classes: ALREADY-HAVE, PREVIOUSLY-DECLINED/PARKED, NEW.

Earlier scan to respect: the 2026-09-15 upstream re-scan (CHANGELOG.md, 6.2.x section "three imports from the 2026-09-15 upstream re-scan") already covered Test in Prod, AG Kit and Antigravity Superpowers. It rejected AG Kit's lock file (the drift gate covers it), rollback, and a PreToolUse shell hook (no recorded incident).

---

## A. AG Kit (formerly Antigravity Kit), github.com/vudovn/ag-kit

The repository was renamed to `vudovn/ag-kit` (the old URL redirects). 8.2k stars. Last release v2026.8.31. Last push 2026-10-01, to a draft PR.

### Direction

From June to August 2026 it was a single-runtime kit (Antigravity first). It added release safety, integrity locks and native Antigravity hooks. Since 2026-09-26 the maintainer has had a large draft (PR #124) open. The draft deletes most of the catalogue and makes AG Kit runtime-neutral: 1 resident core, 18 skills, 4 agents, and one flow engine with QUICK, STANDARD and DEEP modes. It replaces 47 skills, 20 agents and 13 workflows. The draft is not merged, so v2 is IMPLEMENTED on a branch, not shipped.

### Timeline (primary: CHANGELOG.md on main, https://github.com/vudovn/ag-kit/blob/main/CHANGELOG.md)

| Release | What changed | Evidence |
|---|---|---|
| 2026.6.2 / 5.31 | "Accuracy audit". Removed fabricated benchmarks, prices and phantom skills, and stale tech references. | IMPLEMENTED |
| 2026.6.23 | Split the monolithic `GEMINI.md` into 6 rule files for conditional loading. | IMPLEMENTED |
| 2026.6.29 | DESIGN.md hard gate before any UI work, `design-spec` skill, taste-skill frontend rebuild. | IMPLEMENTED |
| 2026.7.10 | Self-validator, and security scanner high findings now return a failing exit code. Fixed "orchestration deadlocks caused by mandatory missing plan/CODEBASE files". | IMPLEMENTED |
| 2026.7.12 | Merge-aware `update`, three-way conflict detection, `ag-kit rollback`, OIDC trusted publishing. | IMPLEMENTED |
| 2026.7.18 | Component SemVer, `manifest.json` + `manifest.lock.json` (SHA-256), generated dependency graph, `--check` drift mode in CI. | IMPLEMENTED |
| 2026.7.26 | Antigravity-native runtime contract, `PreToolUse` destructive-command hook (fails open on bad payload), MCP sync helper, "doctor". | IMPLEMENTED |
| 2026.8.31 | DESIGN.md gate in `app-builder`. Orchestrator gets "finite agent, delegation-depth, turn/retry, timeout, cancellation, and no-progress controls" and "explicit trust boundaries for repository content, MCP responses, tool annotations, web content, logs, and subagent outputs" (commit 211561c, PR #115, 2026-07-30). | IMPLEMENTED (as prose in agent files, plus a structural test) |

### Open draft PRs (direction signals, not shipped)

- **#124 "runtime-neutral multi-runtime operating layer"** (vudovn, 2026-09-26, 332 commits, +17,975 / −15,724). https://github.com/vudovn/ag-kit/pull/124. Branch docs: `docs/ARCHITECTURE_V2.md`, `docs/PARITY_IJFW.md`, `MIGRATION.md` on `feat/lean-multiruntime-v2`.
  - Removed: `.agents/workflows/` ("Legacy `.agents/workflows/` is gone. QUICK, STANDARD, and DEEP are modes of one flow engine"), the 2026.7 managed-tree `init/update/rollback/status` lifecycle ("There is no generic managed-tree rollback command in v2"), and the Antigravity doctor, plugin builder and schemas from the generated tree. The stated reason is one source (`shared/`), with host trees as generated projections and "no primary runtime".
  - Resident budget: "1 resident skill (`ag-core`), 18 top-level shared skills (budget <=22), 4 permanent agents" (ARCHITECTURE_V2.md).
  - Explicitly modelled on a third party, "IJFW", for feature-class parity (PARITY_IJFW.md).
  - New mechanisms: "prompt-check" (a deterministic ambiguity check before subjective work), a cross-model audit "with calling-lineage exclusion", consensus/contested finding clustering, a "command sandbox: full output on disk, bounded summary in context", deterministic context compression "with measured byte reduction", session handoff artifacts, memory candidate→durable promotion with "two-session confirmation", and a local observability dashboard.
  - Self-declared restraint: "No fabricated token savings", "No capability-by-badge", "No paid-provider benchmark in the default release gate".
  - Evidence: IMPLEMENTED on a branch, unmerged. The only "benchmark receipts" are deterministic fixtures (memory, routing, lifecycle, compression), not agent-outcome measurements.
- **#118** "require approval before persisting inferred memory" (2026-08-09). Inferred observations stay session-local until the user approves them. Follows Gemini CLI's auto-memory inbox. https://github.com/vudovn/ag-kit/pull/118. CLAIMED/IMPLEMENTED (prose + contract test).
- **#117** Antigravity hook alignment: the earlier hook "could pass AG Kit's own Doctor and tests while not matching the current runtime contract", so the destructive-command gate may never have fired. https://github.com/vudovn/ag-kit/pull/117. This is the same lesson as Conductor's Operating Truth 1.
- **#116** ASD-STE100 "simple-english" skill wired into universal rules (community PR, open). https://github.com/vudovn/ag-kit/pull/116.
- **#120** bounded deep-research skill with an evidence ledger (closed, not merged). https://github.com/vudovn/ag-kit/pull/120.

### Classification against Conductor

| Idea | Class | Conductor reference |
|---|---|---|
| DESIGN.md gate before UI | ALREADY-HAVE | 6.8.0, `templates/.agents/skills/design-system/`, `src/design-md.js` |
| Manifest + SHA-256 lock + `--check` | PREVIOUSLY-DECLINED | 2026-09-15 re-scan (CHANGELOG): "AG Kit's lock file (the drift gate covers it)" |
| `rollback` command | PREVIOUSLY-DECLINED | same re-scan. AG Kit itself has now removed it in v2. |
| PreToolUse destructive-command hook | PREVIOUSLY-DECLINED (as a new hook). Opt-in `pretooluse-no-bypass.sh` exists. | re-scan, `templates/.agents/hooks/` |
| Finite delegation, turn caps, no-progress controls | ALREADY-HAVE, in code rather than prose | `src/loop/driver.js` (`MAX_CONSECUTIVE_STALLS`, budgets), `src/loop/swarm.js` |
| Trust boundaries for repo/MCP/tool/subagent output | ALREADY-HAVE, in code | `src/loop/untrusted.js` |
| Single source with per-host projections | ALREADY-HAVE | root AGENTS.md generated from `.agents/` (`src/agents-md.js`), multi-engine adapters `src/loop/adapters/` |
| Catalogue collapse 47→18 skills, workflows → one flow with modes | NEW as a direction. Conductor has Quick-Path vs the full chain, and the context-bill ratchet caps bytes but does not prove value. | `test/fixtures/context-budget.json`, README "32 skills, 18 workflows" |
| Cross-model audit with lineage exclusion | NEW. Conductor's Checker is multi-vote in a fresh process, but no config picks a different engine for the Checker than for the Maker (no match in `src/loop/checker.js` / `config.js`). | `src/loop/checker.js` |
| Approve-before-persist inferred memory | Partly ALREADY-HAVE: `src/loop/improver.js` proposes, never auto-appends. The interactive "where a lesson goes" rule (6.12.0) has no approval step. | `src/loop/improver.js` |
| Bounded command output (full log on disk) | NEW, low value | see D below |
| Prompt-check ambiguity gate | ALREADY-HAVE in spirit (Grilling, brief check C1–C4) | `templates/.agents/skills/grilling/`, `docs/roadmap/Outward-Rigour.md` |
| Observability dashboard, SQLite/vector memory, cross-project brain | NEW, noise for Conductor | contradicts the files-in-repo model |

---

## B. Antigravity Superpowers, github.com/skainguyen1412/antigravity-superpowers

### Direction

Dormant. All six commits are dated 2026-02-26 (last push 2026-02-26T08:48:22Z). No releases. One PR (#3, a bot account, closed unmerged 2026-03-21) tried to restore `subagent-driven-development` by using Antigravity's EXECUTION/VERIFICATION modes. Two open issues: a missing ripgrep dependency in `run-tests.sh`, and GEMINI.md confusion. 329 stars.
Sources: https://github.com/skainguyen1412/antigravity-superpowers/commits/main, https://github.com/skainguyen1412/antigravity-superpowers/pull/3

### Classification

Nothing new. What Conductor took (`check-conductor.sh` from `check-antigravity-profile.sh`, the `npx` install pattern) is ALREADY-HAVE (README Credits). For new Superpowers mechanisms, watch upstream `obra/superpowers` (another researcher's scope), not this port.

---

## C. Test in Prod, Conductor Framework V2 (Eric Before)

### Direction

Frozen. There is no V3. The author's own roadmap page marks "Conductor Framework: **Complete**" (https://ericbefore.com/roadmap). His effort has moved to "Experiment Zero" (career/shipping coaching, $20/mo calls) and a general YouTube channel.

### Evidence

- https://www.testinprod.co/ still says "CONDUCTOR FRAMEWORK V2". It serves the same Next.js asset hashes (`eb751fbafa0ec23e.css`, `b1a01f2bb23f7fb6.js`) as the only Wayback capture, 2026-01-10 (https://web.archive.org/cdx/search/cdx?url=testinprod.co*). So the page has not changed since at least January. `/feed` returns 404.
- The landing page describes a 0–8 folder layout (0-Compass … 8-Archive) and names 6 skills (Epic-Decomposer, PRD-Writer, Brain-Dump-to-Epics, Implementation-Planner, Engineering-Archaeologist, System-Janitor) and 7 workflows (Daily-Standup, Red-Team, Build-Mode, Ship-It, Triage, Story-Time, Post-Mortem). Its 3 adoption levels are Survival, Structure and Scale. Assumption: this is the earlier, simpler V2 packaging. The newer page https://ericbefore.com/conductor describes the Genesis → Storyboard → Blueprint (Grand PRD, UX/UI Brief, Technical Vision) → Carve → Spec-and-Build chain that Conductor inherited, plus the personas CTO, PM, Architect and Tech Lead. Neither page has a version history.
- Newer side assets: "Conductor's Log Template" and "Conductor's Bet Board", listed as free downloads on https://ericbefore.com. The download links point to "#", so the content cannot be checked.
- YouTube channel "Eric Before" (UC1EbMMyEyliGYvDNYmdRbRw, RSS feed): the last Conductor videos are 2025-12-23 and 2025-12-24. The last upload, 2026-06-16, is about YouTube monetisation. Blog RSS: last post 2026-02-07 ("Building With AI Agents"). It says "keep chains short and validate between steps", "approval gates before destructive actions", and "human-in-the-loop is not a weakness". All CLAIMED, and all ALREADY-HAVE.

### Classification

| Idea | Class | Reference |
|---|---|---|
| Daily-Standup ("start my day") briefing | ALREADY-HAVE | `conductor status` (`src/commands/status.js`) |
| Red-Team ("cynical senior engineer" on a plan) | ALREADY-HAVE | brief check C1–C4 (`docs/roadmap/Outward-Rigour.md`), `judge-panel`, independent-review |
| Triage of inbox | ALREADY-HAVE | `conductor inbox`, quick-capture classifier |
| System-Janitor (archive scratchpads monthly) | NEW but trivial. `conductor status` already shows stale documents. | `src/conductor-state.js` staleness |
| Adoption levels 1–3 (progressive disclosure) | NEW as packaging. The "init --all vs selective" choice is the nearest. | `src/selective-copy.js` |
| Bet Board | Unknown content. Not assessable. | — |

Nothing here is worth importing. The source has stopped evolving. Keep the credit as is.

---

## D. The Ralph loop, Geoffrey Huntley

### Direction since mid-2026

Huntley no longer argues for the loop itself. He says it is mainstream ("everything is a Ralph loop", Boris using it in Claude Code by November 2025). His thesis is now **verification as back pressure**: "Creation is now near-free. Verification/understanding is not, yet." He joined Antithesis (deterministic simulation testing) in July 2026. He pushes property-based testing (his `hegel-*` SDKs), simulator-first development, and pre-commit hooks that inspect generated code. He calls skill packs and AGENTS.md "astrology for software engineers" and says to delete them every few months unless evals show they help. Personally he pushes to main with sudo on a disposable NixOS box, and says "I don't do pull requests anymore".

### Posts read (all from https://ghuntley.com/rss/, full text)

| Date | Post | Content that matters |
|---|---|---|
| 2026-07-23 | engineer away the slop, https://ghuntley.com/slop/ | Joins Antithesis. Hypothesis: deterministic simulation + "adversarial code reviews by an LLM" + "language analyzers driven by pre-commit hooks" = the software-factory stack. CLAIMED. |
| 2026-10-02 | software doesn't need to be readable anymore, https://ghuntley.com/readable/ | "Types are a form of verification. They provide back pressure". "Building the simulator first, then driving the agent to validate everything through the simulator. That has kept the agent on the rails remarkably well." Use frontier models only where needed and cheap models elsewhere. CLAIMED. |
| 2026-10-09 | eighteen-month recap (Singapore talk), https://ghuntley.com/eighteen-month-recap/ | Mostly about society and organisations. "Removing waste from your organization and processes is a bigger accelerator than AI itself." No loop mechanics. |
| 2026-10-09 | --help is all you need, https://ghuntley.com/tier/ | Optimise a CLI's `--help` by measuring, in a loop, whether a model reaches outcomes "with the fewest tool calls". CLAIMED (method described, no result shown). |
| 2026-10-13 | here's what's left (4-part interview), https://ghuntley.com/agency/ | See the ideas below. Mainly: a pre-commit hook that fails and injects the fix instruction gave "ten out of ten" adherence where AGENTS.md drifted. "Did you try it without the skills?" "Delete your skills and your AGENTS.md every couple of months … unless you've invested in evals over all your traces". At the end of a loop, have the agent study its own traces. When it is stuck, tell it to "look at your previous tool calls … let's replan". Push to main, no PRs, integration tests gate commits. Deceptive test deletion "mostly gone". All CLAIMED (anecdote). |
| 2026-10-14 | closed to pull requests, open to remix, https://ghuntley.com/remix/ | "Ideas over patches." He disables PRs on his repos and asks for Nix overlays. Not relevant to Conductor's mechanisms. |
| 2026-10-16 | revisiting priors about openclaw, https://ghuntley.com/bot/ | Personal-assistant bots. Not relevant. |

Repos pushed since June (https://github.com/ghuntley?tab=repositories): `preflight` (a local proxy that redacts secrets from LLM requests and attachments, IMPLEMENTED), `nix-compact` ("Full build logs on disk. Small, useful output for humans and coding agents", bounded diagnostics, IMPLEMENTED), `hegel-erlang`/`hegel-lean` (property testing), `underclass` (subscription pooling proxy), `how-to-build-a-coding-agent` (workshop). There is no new Ralph repo of his own. The most active third-party derivative is `umputun/ralphex` (v1.7.0, 2026-09-07): fresh session per task, a 5-agent → codex → 2-agent review pipeline, worktree mode. All of these are ALREADY-HAVE in Conductor (`conductor loop`, swarm, Checker).

Side finding (cost of running): the ralphex README warns that Anthropic would move `claude -p` usage to a separate Agent SDK credit pool from 2026-06-15. Anthropic's article says this change was **paused**, and that on 2026-10-07 Max and Team plans gained monthly API credits that cover `claude -p` (https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan). `conductor loop` uses `claude -p` (`src/loop/adapters/claude.js:49`). No action today. It is a billing dependency to watch.

### Classification

| Idea | Evidence | Class | Reference |
|---|---|---|---|
| A hook fails the commit and tells the agent the exact fix | CLAIMED | ALREADY-HAVE as a principle (Operating Truth 3, pre-push messages with exact JSON, 6.2.x O6) | `templates/.agents/hooks/` |
| The improver should propose a **hook check**, not a prose rule, when the failure can be found with grep | CLAIMED | NEW. `src/loop/improver.js` only proposes `.agents/rules/*.md` prose (lines 7, 102, 118). This contradicts Conductor's own Operating Truth 3. | `src/loop/improver.js` |
| Skill/AGENTS.md ablation: run with and without, prune what does not help | CLAIMED | NEW as a routine. Partial: `persona-eval` ablates one Build step ("persona step cut from build.md"), and the sensitivity checks exist. No per-skill with/without eval. | `test/evals/README.md` |
| Stuck → "read your previous tool calls, replan" nudge before halting | CLAIMED | NEW. The driver halts at 3 identical beats and writes to the inbox (`src/loop/driver.js:413-415`). Beats 2–3 get no change of instruction. | `src/loop/driver.js` |
| The agent studies its own traces at the end of the loop | CLAIMED | ALREADY-HAVE (retrospective, harness lens C2, improver) | `templates/.agents/workflows/retrospective.md` |
| A different model for the reviewer ("play the models against each other") | CLAIMED | NEW (same as AG Kit's cross-model audit) | `src/loop/checker.js` |
| Property-based / simulator-first testing as back pressure | CLAIMED | Partly ALREADY-HAVE (TDD law, evidence rule). PBT is not named in `tdd-cycle`. | `templates/.agents/skills/tdd-cycle/` |
| Optimise `--help` with a measured agent loop | CLAIMED | NEW. Agents call `conductor review-log append`, `evidence`, `personas`, but no eval checks that `--help` is enough. | `test/evals/` |
| Bounded tool output, full log on disk | IMPLEMENTED (nix-compact) | NEW, low value. The Maker runs its own commands inside the harness. | — |
| Secret-redacting proxy | IMPLEMENTED (preflight) | NEW, out of scope. Prose redaction exists (C3, `systematic-debugging`). | — |
| Push to main, no PRs, sudo agent | CLAIMED | Contradicts Conductor's safety envelope (PR-gated merge). Do not take. | CLAUDE.md Operating Truth 4 |

---

## Ranked ideas for Conductor

1. **Improver proposes deterministic checks, not prose rules** (NEW. Huntley /agency, CLAIMED). `src/loop/improver.js` turns recurring loop failures into proposed `.agents/rules/*.md` paragraphs, the "prompts guide" layer that Conductor's own Operating Truth 3 calls advisory. When the failure can be found with grep (hook-bypass, protected path, forbidden import), the proposal should be a `lib.sh` check plus a behaviour test, with the rule paragraph as the fallback. Value: high, because it aligns the self-improvement path with the framework's core stance. Cost: small (proposal template plus a matcher → check map). It does not touch the safety envelope, because it still proposes and never auto-applies.
2. **Skill ablation as a periodic eval** (NEW. Huntley /agency CLAIMED, AG Kit #124 collapse 47→18 IMPLEMENTED). Two independent sources point the same way: catalogues grow, and nobody checks that each item helps. Conductor already has the harness (`test/evals/`, sensitivity arms, `persona-eval` step ablation) and a byte ratchet, but bytes are not value. Run a with/without arm for the eager skills that cost most (ship.md ~18.8 KB, grilling, independent-review), and retire or shrink what shows no delta. Value: high in the long term, and it guards against model updates de-tuning the framework. Cost: real token spend per run, so run it on a model change, not in CI.
3. **Cross-model Checker option** (NEW. AG Kit v2 IMPLEMENTED on a branch, Huntley CLAIMED). Allow `loop.checker.platform` to differ from the Maker's, so the vote does not share the Maker's blind spots. Value: medium, unmeasured anywhere. Multi-engine adapters already exist, so most of the cost is config plus a live run (P2.3 multi-engine parity is still open in `docs/roadmap/Loop-Robustness-Plan.md`). Conditional on P2.3.
4. **Replan nudge before the stall halt** (NEW. Huntley CLAIMED). At `stall.consecutive == 2`, the driver adds one line to the next beat prompt: "two beats made no progress, read your previous attempts and replan". This is cheap and driver-side only, so the interactive path stays byte-identical. Value: low-medium. Prove it with a live run on a seeded stuck task before keeping it.
5. **`--help` sufficiency eval for agent-facing commands** (NEW. Huntley /tier CLAIMED). Value: low-medium. It only matters if agents are seen misusing `conductor review-log append` or `evidence`. The review-log fix in 6.12.0 (unknown fields refused) is the existing defence.

Noise (do not take): AG Kit's observability dashboard, SQLite/vector memory and cross-project brain, the v2 "one flow engine" rewrite as a structure (it would break the byte-identical interactive path and every installed project), the PreToolUse destructive-command hook (already declined, and AG Kit's own #117 shows it was miswired), Test in Prod's System-Janitor and adoption levels, Huntley's push-to-main/no-PR posture, `preflight`/`nix-compact`, and the remix model.

Watch item: Anthropic's paused `claude -p` billing change. `conductor loop` depends on `claude -p`.
