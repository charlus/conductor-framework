# Loop-Engineering Alignment

> **Status:** Analysis + Phase 1 shipped (the ignition contract). 2026-07-23.
> **Trigger:** Anthropic's *Loop Engineering* guide, via Joe Njenga's Medium write-up (`inbox/`).
> **Grounded in:** the 2026 agentic-SWE rubric, the practitioner-consensus notes, and the V6 loop backend (`docs/roadmap/Autonomous-Loop-Backend.md`, `docs/adr/0001-…`).
> **Extended 2026-09-03 (E2/E4):** verification evidence is now bound to a working-tree content fingerprint (`src/evidence/`, consumed by `pre-push`), and untrusted trigger input is clamped, enveloped and tool-allowlisted (`src/loop/untrusted.js`). See `docs/roadmap/Review-Convergence-And-Harness-Alignment.md`.

## 1. What the source says

Anthropic frames autonomous work as **loop engineering**: instead of single-mode prompting (prompt → read → prompt, where *the human is the verification step*), you design a system that runs until a stop condition is met. Three moves: hand off the check, set the stop condition/trigger, let the agent run. It defines four loop types:

| # | Loop | Command (Claude Code native) | Essence |
|---|------|------------------------------|---------|
| 1 | **Turn-based** | every prompt | Agent acts + self-checks; **you** are still the verifier. *Upgrade: encode verification in a `SKILL.md`.* |
| 2 | **Goal-based** | `/goal … stop after N tries` | Iterate until a measurable condition is met or a turn cap is hit; an **evaluator model** checks after each attempt. |
| 3 | **Time-based** | `/loop 2m …`, `/schedule …` | Same task, changing inputs, on a recurring trigger. `/loop` is local; `/schedule` moves it to the cloud. |
| 4 | **Proactive** | `/schedule` + `/goal` + skills + workflows + auto | Event/schedule trigger + stop condition + self-verification + parallel-worktree exploration with an adversarial judge, unattended. |

Cost note: loops cost more (each iteration re-reads context); the author measured **~3× tokens** vs a single turn. Advice: pilot on a small slice, set explicit turn caps, route routine loops to cheaper models.

## 2. Assessment

**The article itself is thin** (a secondhand Medium repackaging with a newsletter pledge). **The underlying taxonomy is valuable** — and it is almost entirely a *restatement of conclusions Conductor already reached independently*:

- *"You are the verification step"* ⇒ our #1 field invariant ("value lives in verification of output").
- *"Encode verification in a `SKILL.md`"* ⇒ our `verification-iron-law`, `independent-review`, `behavior-validator`. **Conductor goes one rung harder:** the article's upgrade is still a *prompt* (a `SKILL.md`), whereas we make it a **deterministic git hook** (`.agents/hooks/{pre-commit,pre-push}`) — invariant #3, "prompts guide; deterministic controls enforce." The guide stops exactly where the 2026 anti-pattern list says prompt-only safety fails.
- Turn caps / pilot-small / cheaper models ⇒ our `budget.max_beats` + `max_wall_clock_min` ceiling and the `model-routing` skill.
- The whole posture is Huntley's *"sit on the loop, not in it."*

**Net:** the guide contributes *vocabulary and a maturity ladder*, not a technique we were missing. It is useful external validation that the V6 rebalance aimed at the right target, and it sharpens where the one real gap is.

## 3. Readiness map — Conductor against the four loops

| Loop | Conductor status | Backing |
|------|------------------|---------|
| **1. Turn-based** + self-verify | **Exceeds** | `verification-iron-law` (always-on rule), TDD pre-commit + verify pre-push **hooks** (deterministic, stronger than a `SKILL.md`), `independent-review`, `behavior-validator` |
| **2. Goal-based** | **Native / meets–exceeds** | `src/loop/driver.js` *is* a goal loop: `goal_description`, `budget.max_beats` (turn cap), wall-clock budget, Evidence Rule via verify exit code, and a **multi-vote adversarial Checker in a fresh process** = the guide's "evaluator," but stronger |
| **3. Time-based** | **Gap → closed by composition (see §4)** | The driver runs *until goal/ceiling/budget*; it has **no scheduler and no cloud persistence** by design. Filled by seeding it from native `/schedule` or cron. |
| **4. Proactive** | **All execution pieces present; trigger was the missing half** | Have: worktree isolation (`worktree.js`), swarm, **`judge-panel`** (literally "explore three solutions, judge adversarially"), autonomy slider L3 + PR-gated merge, `awaiting_review`. Missing was the **inbound trigger** — now addressed by the ignition contract. |

## 4. Decision — build the *ignition*, not a scheduler

Conductor was strongly ready for loops **1 and 2** and out-rigors the guide on enforcement. What it lacked was the **trigger layer** that turns a goal loop (2) into a time loop (3) or an event-driven proactive loop (4). We built the *engine and the safety rails*; we never built the *ignition*.

**We deliberately do NOT build our own scheduler or cloud runtime.** The practitioner consensus is explicit — *"simplest thing that works; add structure only when it demonstrably pays"* and Karpathy's *"don't overshoot the tooling."* Claude Code already ships `/schedule`; cron exists on every host. A home-grown scheduler is plumbing that competes with the platform for zero methodology gain.

**Conductor's differentiated value is what happens inside the beat** — spec-first, TDD-hook-enforced, Maker/Checker fresh-context split, worktree isolation, PR gate, `judge-panel`. So the right primitive is a thin **ignition contract**: make `conductor loop` cleanly *invokable by* an external trigger and able to *consume an event payload as its goal input*. Loops 3 and 4 then arise by **composition**, not new subsystems.

## 5. What shipped (Phase 1 — ignition contract)

`conductor loop` accepts an external trigger that seeds the run's goal:

```bash
# Time-based (rung 3): drive from native /schedule or cron
conductor loop --goal "check for new TODO comments and address them"

# Proactive (rung 4): a webhook/CI shim writes a payload, then fires the loop
conductor loop --event ./event.json
```

`--goal "<text>"` is a bare-string trigger; `--event <file.json>` is a JSON payload:

```json
{
  "goal": "triage every bug report found this run",
  "source": "schedule:project-feedback-hourly",
  "context": "3 new reports since last run …",
  "phase": "execution",
  "autonomy_level": "L2"
}
```

- **`src/loop/trigger.js`** (pure) — `parseTriggerPayload` (JSON object *or* bare goal string), `applyTrigger` (seeds `goal_description` / `phase`, records provenance), `clampAutonomy`, `renderTriggerDoc`.
- **Safety — the load-bearing property.** A payload may arrive from untrusted input (a Slack message, a GitHub issue body — the injection vector in rubric §5.5). So a trigger may **set the goal/phase/context** and may **request** an autonomy level, but the level is **clamped to the operator ceiling already in `loop-state.json`** — a trigger can *de-escalate* but **never escalate**. Privilege comes from the operator, not the event. The context is written to the workbench as *data* for the Maker, never spliced into the driver's control flow.
- **Auditability** — the effective goal + provenance are persisted to the Spine (`last_trigger`), written to `conductor/1-workbench/loop-trigger.md` (the Maker's brief for the run), and logged to `0-compass/ship-log.md`. A refused escalation is recorded explicitly.
- **`--dry-run`** previews the seeded goal, the effective autonomy, and any refused escalation without mutating state.
- Tests: `test/loop-trigger.test.js` (11 `node:test` cases, incl. the escalation-refusal guard).

**All guardrails still bind.** The ignition seeds the goal; the deterministic driver still owns the iteration ceiling, wall-clock budget, stall detection, the Evidence Rule, the Scoping Barrier, the sandbox gate, and PR-gated merge. A trigger cannot reach around any of them.

## 6. Documentation adopted

- `templates/.agents/how-it-works.md` gained a **"Four loop types"** section mapping each rung to the Conductor primitive that serves it — a genuinely good on-ramp — plus the `SKILL.md`-vs-hook distinction as a place Conductor is *ahead* of the published guidance.
- `README.md` documents the ignition contract in the Autonomous Loop Backend section.

## 7. Not doing (and why)

- **A Conductor-owned scheduler / cron / cloud runtime** — ride native `/schedule` + host cron (see §4).
- **`stdin` piping for `--event`** — a natural nicety, deferred; a file path or inline `--goal` covers the scheduler/webhook cases today.
- **Auto-escalation of autonomy from an event** — deliberately impossible (the clamp). Raising the ceiling stays a manual operator act, consistent with design-time sign-off.
