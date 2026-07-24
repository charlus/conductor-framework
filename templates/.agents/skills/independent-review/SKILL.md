---
name: Independent-Review
description: "The fresh-context review gate. When a workflow produces a consequential artifact — a PRD, an architecture, a spec, a carved plan, a diff — spawn a separate reviewer that did NOT produce it to decide whether it's ready, before it's saved or handed off. This is the Maker/Checker split applied to any artifact. Ship's Phase 4 is its reference implementation; blueprint workflows load it too."
category: core
---

# Independent Review (Fresh-Context Gate)

> The author cannot be their own last reviewer. A mind that just produced an artifact is anchored on the reasoning that produced it — it sees what it *meant*, not what it *wrote*. A reviewer in a **separate, clean context** reads only what's actually there, which is the whole point. This is Conductor's Maker/Checker split (`personas/checker.md`, `skills/subagent-isolation/SKILL.md`) applied to any consequential output, not just code.

## When to run it

Run this gate **once, when a consequential artifact is complete and about to be saved or handed to the next phase** — not per paragraph, not per step. One gate at the meaningful boundary, mirroring Ship's single Phase 4.

- **Run it for:** a Grand PRD, a Technical Vision, a Feature Spec + Implementation Plan, a Carve slicing, a shippable diff — anything a later phase will *build on* or a reader will *trust without re-deriving*.
- **Skip it for:** trivial or fully-reversible artifacts (a one-line copy fix, a scratch note). If getting it subtly wrong is cheap to undo and cheap to catch later, the gate is overhead.
- **Proportionality:** scale the reviewer to the stakes. A small spec earns a quick fresh-context pass; a data-migration architecture earns an isolated reviewer on a strong tier (`skills/model-routing/SKILL.md`) — a weak verifier on a high-stakes artifact is a false safety signal.

## The gate (four moves)

**1. Spawn the reviewer in isolation.** Per `skills/subagent-isolation/SKILL.md`, it must run in a separate, clean context so it isn't biased by the reasoning that produced the artifact:
- **Claude Code:** launch a subagent (Task tool).
- **Antigravity / others:** use the platform's sub-agent primitive.
- **No sub-agent primitive available (graceful degradation):** do a deliberate fresh-context pass yourself — clear the mental slate and re-read **only** the artifact and its source-of-truth inputs; do **not** reason from the conversation that produced it. Retro-compatible by design: the gate always runs, only its isolation strength scales with the platform.

**2. Brief it narrowly.** Give the reviewer exactly what it needs and nothing more:
- The **source-of-truth inputs** the artifact must satisfy (the upstream docs, the goal/spec, `goal_description` if this ran from the loop).
- The **artifact under review** (the specific file(s), or `git diff <merge-base>...HEAD` for a diff — not the whole repo).
- Its instructions: *adopt `.agents/personas/checker.md`, apply the review lens below, and be adversarial — look for the reason this is **not** ready.*

**3. Binary verdict with actionable findings.** The reviewer returns **`APPROVE`** or **`CHANGES REQUESTED`**, each finding specific and located (`file:line`, or the section/Epic/slice it concerns). Vague "looks fine" is not a verdict.

**4. Boundaries (non-negotiable).** The reviewer **only reports**. It does not save, merge, or edit the artifact. Verification stays with the accountable agent (`.agents/rules/verification-iron-law.md`) — a subagent's "it's fine" is never the proof.

## Triaging the findings

A fresh-context reviewer is *deliberately* blind to the constraints the artifact was built under. That blindness is the value — it re-opens decisions the author had stopped questioning — but it means findings arrive **unsorted**: some are latent problems the author rationalized away, some are legitimate decisions the reviewer simply couldn't see the reason for. Don't fix them all reflexively; **classify each finding first**, re-injecting the context the reviewer lacked:

| Class | What it is | What you do |
|---|---|---|
| **In-scope blocker** | Introduced by this artifact/diff, on the same boundary, fixable without changing an upstream contract | **Fix now**, in this cycle. |
| **Follow-up** | Real, but an adjacent bug class or cleanup the current work didn't introduce | **Don't fix inline** — capture it as a tracked follow-up (workbench backlog / an issue) and keep scope frozen. |
| **Stop-and-escalate** | Needs a protocol/API/contract change, different ownership, or a design decision outside the original request | **Stop.** Surface it to the accountable human; in the loop, halt to `awaiting_review` rather than absorbing it silently. |

Triage is adjudication: for each finding you decide *"deliberate tradeoff → dismiss with a one-line reason"* vs. *"I only told myself it was deliberate — the reviewer is right."* A dismissed finding is a valid outcome, not a failure of the gate; an **undismissable** finding you fix (if in scope) or escalate.

## The fix loop

**Freeze a baseline before the first cycle:** the original request/goal, the artifact's intended scope, and its size (changed files + non-test LOC for a diff; section/Epic/slice count for a blueprint). Every later cycle is measured against it.

If the verdict is `CHANGES REQUESTED`:
1. Triage the findings (above), then address **every in-scope blocker**. Log follow-ups; escalate the rest.
2. Re-spawn a **fresh** reviewer (new context) and repeat. A reviewer that still finds in-scope blockers means *not ready* — no self-approval, no exceptions.
3. Only save the artifact / advance the phase once a fresh reviewer returns `APPROVE`.

**Convergence brakes (stop patching and escalate to a human — the Scoping Barrier applies).** The gate closes out an artifact; it is not licence to rewrite the task. Stop and surface the state when any of these trips:
- The fix has grown the artifact past **~2× its frozen scope** without explicit approval.
- **Two cycles** have passed without converging (each round still returns in-scope blockers).
- The best fix requires **defining a canonical contract first**, or otherwise leaves the original boundary.

Hitting a brake is a successful outcome of the gate, not a failure: it has found that the work is bigger than the request. In the autonomous loop this maps to the driver's Scoping Barrier and an `awaiting_review` halt.

## Review lenses (what "ready" means per artifact)

> **Rubric v1** — these lenses are the reviewer's rubric; versioned and calibrated (see Calibration in `skills/judge-panel/SKILL.md`). Editing a lens bumps the version; spot-check verdicts against human judgment.

The calling workflow supplies the lens. Defaults:

| Artifact | The reviewer asks |
|---|---|
| **Grand PRD** (`grand-prd`) | Are the Epics MECE and right-sized? Do they collectively deliver the full transformation — any Storyboard scene lost, any Main-Character outcome unaddressed? Any scope smuggled in that no Satellite justifies? |
| **Technical Vision** (`technical-vision`) | Does the architecture support **every** Epic and serve **every** screen? Is any complexity unjustified (deep-module / deletion test)? Are the ADRs sound and the data model internally consistent? Are the named risks the real ones? |
| **Feature Spec + Plan** (`spec-it`) | Is every acceptance criterion **testable** and unambiguous? Does the plan implement exactly the spec — nothing missing, nothing extra? Are the TDD seams the highest useful ones? Is it sliced into thin vertical increments? |
| **Carve slicing** (`carve`) | Does each Implementation deliver testable value on its own? Is the dependency order a valid DAG with no cycles or orphans? Is anything from the Blueprint uncarved, or any slice too big to build safely? |
| **Diff** (`ship`, loop execution) | Spec compliance first, then quality (`skills/code-review/SKILL.md`, Fowler smell baseline), plus the empathy lens (legible to the next human *and* the next agent?). Are the tests meaningful or reward-hacked (assertions weakened, failing tests deleted, mocks hardcoded to pass)? **If `conductor/0-compass/architecture-checklist.md` exists, verify the diff against every item** (`skills/architecture-checklist/SKILL.md`). For a runtime surface, pair this static review with a source-blind behavior check of the running artifact (`skills/behavior-validator/SKILL.md`). |

## In the autonomous loop

- This gate is the natural **blueprint (L2) review step**: when a Maker beat produces a spec/architecture, run the gate before the driver accepts the artifact.
- For **diffs in execution (L3)**, this same split is enforced out-of-process by the independent Checker (`workflows/loop-checker.md`, verdict via `checker-verdict.json`) above the driver's green-verify floor — same principle, deterministic wiring.
- Route the reviewer's model tier by stakes (`skills/model-routing/SKILL.md`); record it in `0-compass/ship-log.md` for autonomous runs so the gate stays auditable.

## Anti-patterns

- The author "reviewing" their own artifact in the same context they wrote it — that's proofreading, not an independent gate.
- A gate per step instead of one gate per artifact — turns review into ceremony and trains the team to rubber-stamp.
- Accepting a `CHANGES REQUESTED` verdict "with notes" and advancing anyway — a found *in-scope* issue means not ready.
- Letting the reviewer edit the artifact — it reports; the accountable agent fixes and re-verifies.
- **Fixing every finding reflexively instead of triaging** — a real-but-out-of-scope finding fixed inline is exactly how a narrow change balloons into a rewrite.
- **Absorbing a stop-and-escalate finding silently to keep the loop green** — a finding that needs a contract or ownership change is escalated, not quietly swallowed; that's how scope creep hides.
- **Looping the fix cycle without a brake** — an adversarial reviewer told to "find the reason this is not ready" will always find *something*; without the convergence brakes the gate never closes.
