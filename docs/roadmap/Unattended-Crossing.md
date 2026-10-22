# Unattended Crossing — brainstorm, paused 2026-10-16

> **Status:** first crossing done 2026-10-19 on eurassistant CHORE-2 (MR !48). Fixes built the same day, each verified live, in stacked PRs #71–#75 (6.15.0–6.19.0): F3, F4, F5 and a new F8 in #71; F2 in #73; F1 and F6 in #74. F7 fixed in 6.20.0, with the stale main-checkout check found during the eurassistant upgrade (MR !49). Open questions Q2 and Q3 still stand. Third crossing 2026-10-20/21 on autopportunity, the first in the outer layout: F10–F19, fixed in 6.34.0–6.36.0. 2026-10-21: orchestrators compared ([`../research/2026-10-21/orchestrators.md`](../research/2026-10-21/orchestrators.md)); owner decisions: Conductor is the discipline under any orchestrator (D4), `conductor loop` stays the engine (D5), loop features frozen (D1), a Claude Code session as the owner's channel to be tested (D8); the gates as a required CI check scheduled then dropped, so nothing of the framework reaches the teams' CI ([`Server-Side-Gates.md`](Server-Side-Gates.md)). Fourth crossing 2026-10-21, four products in parallel: C4-F1 fixed in 6.43.0, C4-F2 and C4-F3 in 6.44.0, C4-F4 in 6.45.0.
> **Evidence:** ten research reports from 2026-10-16 in [`docs/research/2026-10-16/`](../research/2026-10-16/), mainly `meta-landscape.md` (30 tools) and `meta-omnigent-paperclip.md`. Third-party code was read, never run.
> **Related:** [`Harvest-2026-10.md`](Harvest-2026-10.md) (PR #67), the Q3 outcome eval approved there.

## The question

The owner has steered Claude Code interactively with Conductor's skills and workflows, and sometimes Claude Code's built-in `/loop`. He wants to cross to unattended development, and asked whether "I've been slowly adding loop features but never crossed that path" is a fair statement. It is.

## What Conductor is (agreed framing)

Three layers over one shared state:

1. **Methodology inside the harness**: root AGENTS.md, skills, workflows, personas. Advice, not enforcement.
2. **Enforcement the harness cannot skip**: git hooks (TDD presence, Goodhart boundary, protected paths, verify on push) and the Evidence Rule.
3. **An outer orchestrator**, `conductor loop`: Maker/Checker, worktree per task, PR-gated merge, sandbox, swarm.
4. Underneath: **`conductor/`**, the product state the owner and the agents share.

## Where Conductor sits in the landscape

| | Interactive | Unattended |
|---|---|---|
| **Plumbing** | Conductor.build, Claude Squad, Vibe Kanban, Codex app, Cursor, Claude agent view | Claude routines/cloud, Codex cloud, Jules, Devin, Amp, OpenHands, paperclip |
| **Discipline** | Spec Kit, BMAD, Kiro, Google's Gemini "Conductor" (prose only) | Factory, Copilot cloud agent, omnigent (tool policy only), **Conductor** (hooks and evidence) |

- Conductor is the only tool found that is multi-harness, unattended and enforces discipline in code.
- **Layer 3 is commoditising**: vendors ship worktree per task, unattended runs to a PR, "the agent cannot merge", sandboxes and triggers. What stays distinctive there: the Evidence Rule, fail-safe on a missing verdict, the autonomy clamp.
- **Layer 1 is partly commoditised**: prose methods are crowded (Spec Kit, BMAD). Distinctive only where it ties into the gates and `conductor/`.
- **Layer 2 and `conductor/` are distinctive**: nobody else enforces test-first or refuses self-report with evidence tied to the tested tree.
- omnigent (Databricks-led) ≈ the owner's **dots**: an agent runtime and control plane. paperclip ≈ **agentctl**: role-based orchestration. Neither verifies by exit code. paperclip's managed connection passes `--setting-sources user`, which drops project-level Claude Code hooks (not verified live).

## Strategic option on the table (not decided)

Position Conductor as **the engineering discipline that holds under any orchestrator**: interactive Claude Code, dots, paperclip, omnigent or Claude cloud sessions. Keep `conductor loop` as the reference orchestrator, but stop competing on orchestration features. The highest-leverage gap found is a **server-side twin of the gates**: evidence plus TDD presence as a required status check, so the gate holds for agents Conductor never launches.

## Why the crossing has not happened

- The loop has been built and hardened but never run on a real backlog item. Every live run on record is a test fixture.
- autopportunity and website use the nested-repo layout, which the loop refuses (owner decision 2026-10-02). Only **eurassistant** and **evalapp-v2** are single-repo projects where the loop runs today.

## Where to resume

The recommendation made when the brainstorm paused: stop adding loop features and do one real crossing.

1. Pick one small, well-specified backlog item in evalapp-v2 or eurassistant, and tag it `loop-ready`.
2. Run `conductor loop --from-conductor` at L2 or L3 in the cli-native sandbox, with `loop.models` (cheaper Maker, opus Checker). The owner reviews the PR it opens.
3. Record every break and every intervention. That list becomes the unattended roadmap, as the 2026-10 usage audit was for the interactive path. Run the approved Q3 outcome eval on the same item.

**Open questions for the owner**
- Which project for the first crossing, evalapp-v2 or eurassistant, and which item?
- Does the positioning above (discipline under any orchestrator, loop no longer the centre) match the intent?
- Should dots' `dev` capability, which merges on green CI without a human, become a Conductor-governed orchestrator instead of a separate path?

## First crossing — eurassistant CHORE-2, 2026-10-19

Item: migrate the EOL `google-generativeai` SDK to `google-genai` (15 files). L3, cli-native sandbox, sonnet Maker, opus Checker. Prep MR !47, result MR !48.

| Run | Result | Time |
|---|---|---|
| 1 | stalled after 10 beats: the Maker could not run Poetry and stopped honestly each beat; the Checker rejected each half-migration | 12 min |
| 2 | approved in one beat; the push gate passed 641 unit tests and 29 live Gemini evals on the new SDK; no old-SDK reference left; the MR step failed | 8 min |

The Maker's work was sound. It also found call sites the backlog had missed (the judge, `reshape_query`, six test files).

### Friction, ranked (the unattended roadmap)

- **F1. Preparation needs knowledge more than time.** Six project facts had to be known: the sandbox write limits, Poetry, the Python from mise, `.env` for the live evals, `require_ready`, and the upgrade to 6.14.0. A `conductor loop doctor` that probes a worktree setup, the verify command and the eval key would turn this into a checklist.
- **F2. Headless permission flow.** A command that starts with a variable assignment (`FOO=bar cmd`) needs approval even when sandboxed, and a headless beat cannot answer. Every project whose tools need environment variables hits this. Fix in Conductor: allow rules in the sandbox profile, with `allowUnsandboxedCommands: false` so an allow rule cannot approve an unsandboxed retry.
- **F3. No escalate signal (harvest A6, now confirmed live).** The Maker said "blocked, here is what I need" in beat 1; the loop ran nine more identical beats, each with an opus Checker.
- **F4. `glab mr create --fill` pushes again.** It re-runs the push gate (2.5 min with live evals) and the MR step failed in the loop. Open the MR with `--title`/`--description` and no `--fill`, as the driver has already pushed.
- **F5. A failed forge command is logged without its error.** The ship-log said only "glab failed to open the PR/MR". Keep the forge's stderr in the reason.
- **F6. Prep notes are only proven by a live run.** The first notes told the Maker to use the one command form the loop cannot run.
- **F7. `upgrade` says "No waiver needed" and then commits a waiver line.** Fixed in 6.20.0: the message names the waiver commit.
- **F9. After a loop MR changes dependencies, the main checkout's environment is stale** and the owner's next push fails at import (eurassistant MR !49). `conductor loop doctor` warns about it since 6.20.0.
- **F8. The swarm's stall guard never fired** (found while fixing F3): it hashed raw verify output, so pytest's duration changed the hash every beat. Fixed in #71.

### What worked

The Evidence Rule and the opus Checker held: ten half-done beats were all rejected with precise reasons, and nothing was faked. The credential fix from 6.14.0 was in place. The push gate ran the live evals before the MR existed. The loop escalated the MR failure to the inbox.

### Cross-check with the superlite code read (2026-10-19)

The superlite session listed four gaps from reading `src/loop`. Against this run:
- Swarm ignores a spent quota: real, not hit in this run, fixed in #72.
- A dependency counts as merged once its PR is opened: real, not observed (one task), left to A11 under D1.
- A retry does not receive its rejection: real in both modes, fixed in #71 and proven live in pair mode. In run 1 it was not the cause: the Maker knew why it was blocked and needed F3.
- Every adapter returns `tokens: 0`: real, fixed in #72.

## Second crossing — evalapp-v2, 2026-10-19

The product is live and supports the yearly evaluation, so the item was chosen off that path: component tests for MR !49's advisory banner and coverage strip, tests only. Risk check before the run: production deploys only by a manual click; the loop's branch triggers no deploy; the tests use a local SQLite file. The cloud logins were readable in the sandbox (R2), fixed first in 6.21.0.

| | Result |
|---|---|
| Prep | 7 minutes with `conductor loop doctor`, against two runs and manual fixes on eurassistant. The doctor found the phase, the sandbox, the version, the missing setup and a 30-item queue; the test-database recipe was in `.gitlab-ci.yml`. |
| Run | Approved in one beat, 7 minutes, ≈ $0.73 at list price (Maker $0.30, Checker $0.43). |
| Work | Tests only. The Maker found the coverage strip already pinned by `DeliberationDashboard.test.tsx`, logged that as a ruling (verified true) and covered the banner in both states. MR !105, prep MR !104. |

### Friction (fixed in 6.22.0)

- **F10.** The MR title was the item's whole first line, over GitLab's 255-character limit.
- **F11.** GitLab answered "source branch does not exist" just after the push.
- **F12.** `.agents/.worktrees/` was not ignored, so `git add -A` would sweep the worktrees into a commit.
- **F13.** The loop's `[loop]` audit lines made the report-shape gate block the owner's next commit.
- **F14.** The one fact the doctor could not find lived in the CI file; the doctor now points there.

## Third crossing — autopportunity, outer layout, 2026-10-20 and 21

The first run of the outer layout (`loop.code_dir`, 6.31.0) on a team repository: an outer Conductor repository with the team's code nested in `repo/`, a 2-minute unit suite in an untracked venv, live secrets in `.env`, and the owner working on another branch in the same checkout. One backlog item: "KB: retire the 'Use case without customer' KM queue" (19 files, −581 lines in the code, a docs commit in the outer repository).

### Friction, in the order it showed

| | Found by | What happened | Fix |
|---|---|---|---|
| C3-F10 | first `loop doctor` | `"verify": "none"` (no tests on purpose) was run as a command | 6.34.0 |
| C3-F11 | first `loop doctor` | `--from-conductor` would have taken all 70 backlog and inbox items | 6.34.0: `loop on` sets `require_ready`, no inbox |
| C3-F12 | first `loop doctor` | three failures for one cause: the loop was never set up there | 6.34.0 |
| C3-F13 | the test itself | no command to set the loop up for backlog items only | 6.34.0: `loop on --backlog` |
| C3-F14 | dry run | the outer worktree would start from the owner's checked-out branch, so the state MR would carry their work in progress | 6.35.0 |
| — | doctor | the unit tests need `.env`, which holds live secrets: the setup copies `.env.example`, as CI does | 6.35.0: the doctor recommends it |
| C3-F15 | run 1 | the sandbox makes only the working directory's git store writable: the Maker could not commit in `repo/` and escalated after a 75-minute beat, with the work done | 6.36.0: a narrow write grant (objects, refs, logs, worktrees; never config or hooks) |
| C3-F16 | run 1 | the auto-capture had to bypass the Eval-Driven Law gate, whose waiver only the Maker can give | solved by C3-F15: the Maker commits with its waiver |
| C3-F17 | runs 1, 2 | each Build beat took 67 to 75 minutes: the Maker re-ran the whole suite inside the sandbox, where six Gemini-calling test files hang on the blocked network; the driver's own verify takes 2.5 minutes outside it | 6.36.0: test what you changed; the driver runs the full suite |
| C3-F18 | run 2, stopped at 17:40 | the owner had to close the laptop during Ship; a resume would have redone the Build beat although the same code had passed verify and review | 6.36.0: a passed review records its head; unchanged, the run resumes at Ship |
| C3-F19 | logs | Maker and Checker ran on Opus (no `loop.models`): slower and dearer per beat | the owner's cost choice |
| C3-F21 | the code MR | the team sees the loop's plumbing: the MR title starts "Conductor task task:kb-retire…", and the history holds a `chore(maker): auto-capture … [hook-bypassed]` commit from run 1 | 6.40.0: the item's own title, GitLab squash on merge, auto-capture messages without the task id |
| C3-F20 | the resume, next morning | a resume keeps the interrupted run's clock, so the night counted against the 120-minute cap and the run stopped at once with `budget_exceeded` | 6.36.0: a resume restarts the wall clock; spent beats still count |

### Lessons

- **Scratch tests in Claude Code's temporary folder hide sandbox limits.** The sandbox lets a beat write in `/tmp/claude-<uid>` (not the rest of `/tmp`, which is read-only there): step 7's scratch run passed in it and failed here. Live tests now run outside it (CLAUDE.md).
- **The loop is bound by the machine it runs on.** On eurassistant and evalapp-v2 a task took minutes; here a real item took hours on a business laptop that closes at day's end. A run must either fit the owner's day (say the expected end before starting) or survive being stopped (C3-F18, C3-F20), and long work wants a server (owner's thought, 2026-10-20: a VM or a scheduled pipeline, with its own forge and Claude logins).
- **The run, end to end:** four runs over two days (escalated, stopped by hand, `budget_exceeded`, completed), ≈ $7.90 at list price, about 3 hours of beats, most of it the Maker re-running the full suite in the sandbox (C3-F17). The last run resumed at Ship (C3-F18) and finished in 32 minutes: code MR innovation/Autopportunity!259 (20 files, −594 lines), state MR !79 (ship-log, rulings, backlog tick, Nexus product area, and the km-workload-relief handoff kept true about the retired script).
- **What the Checker caught, a person would have too:** System Health changes a label users see (rated low by the Maker), and two "assign a customer" endpoints no screen uses any more. Both went to the owner as decisions, not blocks.

## Fourth crossing — four products in parallel, 2026-10-21

The first run of several products at once on one machine (20 cores, 30 GB), after the owner gave the loop two backlog items in each of autopportunity, eurassistant, evalapp-v2 and website (the website loop works in its nested `website-v2026` repository; `website-cms` stays interactive). Followed on the watch tower (`conductor watch --all`, 6.42.0).

| Product | Items | Wall time | Cost (list price) | MRs |
|---|---|---|---|---|
| eurassistant | 2 | 8 min | $2.88 | !52, !53 |
| evalapp-v2 | 2 | 12 min | $3.28 | !109, !110 |
| website | 2 | 22 min | $7.60 | code !29, !30 · state !26, !27 |
| autopportunity | 2 | 87 min | $7.71 | code !260, !261 · state !83, !84 |

Eight items, twelve MRs, no rejected review, no failure, every role on the owner's default model.

### Lessons

- **Four loops in parallel hold on one laptop.** The limit is each product's own test time, not the machine.
- **On autopportunity, Ship dominated, not Build:** Build 17 and 4 minutes, Ship 27 and 30 minutes. The cause (C4-F1): the driver's verify ran the unit suite in 124–141 s outside the sandbox, but the Checker (618 s) and the Ship beat (605 s, twice) re-ran it inside the sandbox, where some tests probably wait on a blocked network. Fixed in 6.43.0: one full run, the driver's.
- **One Ship beat missed the ship-log's For you block** and was retried once (4 minutes). The existing check caught it.
- **The bottleneck moves to the owner:** twelve MRs to review, code before state in the outer layout.
- **Found on the way:** a test run had written a scratch folder into the owner's real watch-tower list; every test script now gets its own `CONDUCTOR_HOME` (6.42.0).
- **After the merges (2026-10-22), the owner's checkouts needed hand work.** C4-F2: the driver had appended `[loop]` audit lines to the tracked ship-log, so the owner's checkouts were dirty and a rebasing `git pull` refused. C4-F3: the twelve loop worktrees stayed, because a squash-merged branch is never contained in the default branch and GitLab deletes it; they were removed by hand. Both fixed in 6.44.0: the audit trail lives in `.git/conductor-loop-logs/audit.md`, and the cleanup asks the forge whether the branch's MR merged at the local head. C4-F4: the `(loop-ready)` tags were uncommitted edits to the tracked backlog, with the same effect on a pull. Owner choice 2026-10-22: a local queue in the git dir, filled with `conductor loop take "<item>"` (6.45.0).
- **Outside Conductor:** the slowness of autopportunity's suite itself (and its network-dependent tests) is investigated in that project's own session.

