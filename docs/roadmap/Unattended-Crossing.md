# Unattended Crossing — brainstorm, paused 2026-10-16

> **Status:** brainstorm, paused by the owner. Nothing decided, nothing built. Resume at **Where to resume**.
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
