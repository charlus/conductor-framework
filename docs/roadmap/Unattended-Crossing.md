# Unattended Crossing — brainstorm, paused 2026-10-16

> **Status:** first crossing done 2026-10-19 on eurassistant CHORE-2 (MR !48). Fixes built the same day, each verified live, in stacked PRs #71–#75 (6.15.0–6.19.0): F3, F4, F5 and a new F8 in #71; F2 in #73; F1 and F6 in #74. F7 is still open. Open questions Q2 and Q3 still stand.
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
- **F7. `upgrade` says "No waiver needed" and then commits a waiver line.** Open.
- **F8. The swarm's stall guard never fired** (found while fixing F3): it hashed raw verify output, so pytest's duration changed the hash every beat. Fixed in #71.

### What worked

The Evidence Rule and the opus Checker held: ten half-done beats were all rejected with precise reasons, and nothing was faked. The credential fix from 6.14.0 was in place. The push gate ran the live evals before the MR existed. The loop escalated the MR failure to the inbox.

### Cross-check with the superlite code read (2026-10-19)

The superlite session listed four gaps from reading `src/loop`. Against this run:
- Swarm ignores a spent quota: real, not hit in this run, fixed in #72.
- A dependency counts as merged once its PR is opened: real, not observed (one task), left to A11 under D1.
- A retry does not receive its rejection: real in both modes, fixed in #71 and proven live in pair mode. In run 1 it was not the cause: the Maker knew why it was blocked and needed F3.
- Every adapter returns `tokens: 0`: real, fixed in #72.
