# ADR-0001: Enforcement & Autonomy Rebalance

> **Status:** Proposed — 2026-07-14
> **Deciders:** Charles Bonneau
> **Supersedes:** none
> **Related:** `docs/roadmap/Autonomous-Loop-Backend.md` (implementation plan), V5 Autonomous Loop Engine (commits `b953efc..bbe8f55`)

## Context

Conductor was benchmarked against the 2026 agentic-SWE field: Matt Pocock's `mattpocock/skills`, the "Best Practices, Framework Design, and Anti-Patterns (2026)" survey, and the primary-source opinions of Karpathy, Steinberger, Huntley (Ralph), Ronacher, Willison, Ball, Beck, Böckeler, Hashimoto, and Anthropic's own guidance.

Two findings converged strongly enough to act on:

1. **Conductor's philosophy is validated; its enforcement mechanism is the one thing the whole field agrees does not work.** Every credible practitioner endorses Conductor's *pillars* — spec-first, TDD, verification, human accountability, on-demand skills, progressive disclosure. But Conductor enforces its two headline laws (Verification Iron Law, Test-Driven Law) purely as `always_on` prose. The consensus is blunt that prose rules are unreliable:
   - Anthropic: *"Unlike CLAUDE.md instructions which are advisory, hooks are deterministic"* — and they recommend converting stubborn rules into hooks.
   - Böckeler: agents *"ultimately [do] not follow all the instructions."*
   - obra (the one practitioner who built a framework as heavy as ours): his skills are *"the very definition of prompt injection,"* reliable only after adversarial hardening.
   - Huntley: reliability comes from *tests and type systems as reinforcement*, not instructions.

2. **The weight and per-step gating are heavier than all but one practitioner recommend.** Anthropic names the *"over-specified"* instruction file as a failure mode; Böckeler calls heavy up-front process *"a sledgehammer to crack a nut."* Per-step approval gates are the single most-disliked feature (Huntley: *"asking for approval on every tool call would break the loop"*). Karpathy's model is a **tunable autonomy slider** plus *"enforce the invariants, not the process"* and a warning against *"overshooting the tooling w.r.t. present capability."*

Meanwhile, the **V5 Autonomous Loop Engine** (now merged to `master`) is a strong first draft of headless execution — a Maker/Checker generator–verifier split, a durable `loop-state.json` "Spine", iteration/anti-stall/evidence guardrails, and a Scoping Barrier that forbids headless *discovery*. **But its enforcement is prose too.** The only code, `scripts/run-conductor-loop.js`, runs a single beat via a hardcoded `antigravity run …`, does not loop, and does not enforce the iteration ceiling, stall detection, or the Evidence Rule — it trusts the agent to police itself. This makes the loop engine both the clearest symptom of finding (1) and the highest-value place to fix it.

## Decision

Adopt a single design principle and apply it framework-wide:

> **Enforce the few non-negotiable invariants deterministically (code: host runner, hooks, CI). Keep everything else light, on-demand, and human-tunable. Prose rules become the soft guidance layer, never the sole guarantee.**

Concretely, three moves — **add, subtract, and re-gate**:

### D1 — Make the non-negotiables deterministic (ADD)
The invariants — not the process — get code backing:
- **Verification Iron Law** → a completion claim is blocked unless a proving command was run in-session and exited `0`. Enforced by (a) the loop runner executing the verification command itself, and (b) an interactive-session hook (`PostToolUse` / stop-hook) that fails a "done" claim without fresh evidence.
- **Test-Driven Law** → a pre-commit hook that rejects commits touching implementation code with no corresponding test change, unless an explicit `no test:` reason is recorded in the tracker.
- **Loop guardrails** (iteration ceiling, anti-stall, Evidence Rule) → owned by the host runner in code, computed from state deltas between beats, not self-reported by the agent.

The existing prose (`rules/*.md`, `loop-guardrails.md`, Maker/Checker personas) is **kept** as agent-facing guidance — belt and suspenders. The runner/hooks are the backstop that holds when the prose is ignored.

### D2 — Lighten the always-on surface (SUBTRACT)
- Keep only the truly universal laws `always_on`. `loop-guardrails.md` is **only** relevant during headless runs; demote it from `always_on` to a **loop-scoped** rule loaded by the `unattended-loop` workflow, so interactive sessions don't pay for it. (It was added as the 4th always-on rule; this reverses that.)
- Audit workflows/personas for per-phase ceremony that can be collapsed. No content is deleted — the goal is fewer *always-loaded* tokens, consistent with Progressive Disclosure.

### D3 — Replace per-step gates with a design-time gate + autonomy slider (RE-GATE)
- One **design-time sign-off** (plan approval) replaces per-phase "STOP and wait for approval" ceremony inside execution. This matches the accepted pattern (obra plan approval, Hashimoto plan/execute split).
- Introduce an explicit **autonomy slider** (Karpathy's model), defaulted conservative, configured in `loop-state.json` / project config:

  | Level | Name | Behavior |
  |---|---|---|
  | **L0** | Suggest | Interactive only; agent proposes, human drives every step. Today's default. |
  | **L1** | Single-beat | One Maker→Checker beat, then stop for human review/merge. |
  | **L2** | Unattended blueprint | Headless spec/carve work (blueprint phase); no code merged to a protected branch. |
  | **L3** | Unattended execution | Headless build up to `max_allowed` beats in a sandbox + worktree; merges gated by the deterministic Checker + PR. |

  Discovery is **never** headless at any level (the Scoping Barrier). The slider only ever *loosens* what a human explicitly opted into. **Default is L0/L1** (consistent with D-weight below); L3 requires explicit opt-in plus a sandbox and PR-gated merge.

### D4 — One engine, pair → swarm (multi-agent scaling)
The autonomy backend is a single engine that scales from a Maker/Checker pair to a specialized swarm with **no architectural discontinuity**, via three primitives:
1. **Two archetypes only** — *Maker* (produces) and *Checker* (verifies). The generator–verifier duality is the reliability guarantee; no third archetype.
2. **Specialization = archetype + persona + task-type filter.** The existing personas become the swarm's **specialization roster** (a "Database Maker" = Maker + Database Architect persona claiming schema tasks). Personas are kept and repurposed, not pruned.
3. **Task-graph blackboard + deterministic scheduler.** `loop-state.json` holds a task graph (Carve already emits dependency-noted vertical slices); the driver — not an LLM — computes the frontier, dispatches unblocked tasks to matching specialized Makers in isolated worktrees up to a concurrency cap, routes results to matching Checkers, and owns a serialized, PR-gated merge queue. Coordination is stigmergic (via the blackboard), never agent-to-agent chat.

Scaling is configuration: `roles=[maker,checker], concurrency=1` is the default pair; `roles=[…specialized…], concurrency=N` is the swarm. Guardrails scale with it (per-task ceiling/anti-stall, global token/wall-clock budget, worktree isolation). Detailed in the companion plan.

### D5 — Claude Code adapter surface: slash-command bridge (PLATFORM)
The framework's 14 workflows live in `.agents/workflows/*.md`. Antigravity invokes those files directly as slash commands; **Claude Code does not** — it only discovers custom slash commands from `.claude/commands/*.md`. Since `templates/` ships no `commands/` directory, in Claude Code only the natural-language classifier in `AGENTS.md` and the single native `/loop` work; `/build`, `/carve`, `/spec-it`, etc. silently don't exist. This is the first concrete deliverable of the "Claude Code first" adapter decision (Platform row below).

- **Fix:** `init`/`upgrade` **generate** a thin shim `.claude/commands/<name>.md` per workflow. Each shim carries no logic — it points Claude Code at the real workflow (`Read and execute .agents/workflows/<name>.md`) and forwards `$ARGUMENTS`, so the workflow file stays the single source of truth shared with Antigravity. `/loop` needs no shim (already native via `.claude/loop.md`).
- **Generated, not hand-maintained:** shims are derived from the workflow set so they never drift; a workflow added/renamed/removed reflects on the next `init`/`upgrade`. Detailed in the companion plan (Phase 2).

### Locked choices (2026-07-14)
| # | Decision | Choice |
|---|---|---|
| Weight | Default experience | **Light default** (Quick-Path/Task); full pipeline opt-in |
| Gates | Approval model | **Single design-time sign-off + autonomy slider**; drop per-phase STOPs |
| Autonomy | Ceiling & default | **Build to L3, default L0/L1**; L3 opt-in behind sandbox + PR-gated merge |
| Enforcement | Surface | **Layered** — driver owns loop guarantees, hooks for interactive sessions, prose as soft backstop |
| Multi-agent | Scaling | **One engine, pair→swarm** (D4 above); personas = specialization roster |
| Domain modeling | New capability | Add a **lightweight active domain-modeling skill** (Pocock-style ubiquitous language) |
| Runtime | Footprint | **Thin, optional, BYO-CLI driver**; moat = methodology + deterministic guarantees, not a runtime/GUI |
| Platform | Target order | **Adapter interface, Claude Code first** (framework was Antigravity-first; Claude Code is now primary) |
| Refactor | TDD placement | Keep RED→GREEN→REFACTOR; also reachable as a review-stage concern, if non-contradictory |
| Name | Namespace collision | **Parked** — personal tool for a small team, not a public product |

## Why this specific shape

- It **keeps what is genuinely Conductor's edge** — the human-browsable dashboard, the spec-first pipeline, the Ship/Retrospective tail — none of which the field offers.
- It **fixes the one mechanism the field says is broken** without throwing away the prose that makes the framework legible.
- It makes **safe autonomy possible**: Huntley's Ralph runs unattended precisely because tests/types are a hard reinforcement signal and the loop is a deterministic driver. Our L3 mirrors that, but adds Conductor's Checker-in-fresh-context and Scoping Barrier.
- It respects Karpathy's *"enforce the invariants, not the process"* and *"outsource thinking, not understanding"*: the human stays the accountable verifier via the design-time gate, the dashboard, and mandatory result review.

## Consequences

**Positive**
- The two headline laws become real guarantees, not aspirations — Conductor's biggest credibility gap closes.
- A robust, platform-portable autonomy backend (see companion plan) that is safe by construction, not by trust.
- Lighter always-on context; less of the "over-specified" failure mode.

**Negative / risks**
- **Enforcement surface is platform-specific.** Hooks differ across Claude Code / Codex / Antigravity; the runner needs a platform-adapter layer. Mitigation: the runner owns the portable guarantees (loop control, verification exit code, git state); hooks are a best-effort *additional* layer per platform.
- **Determinism can over-block.** A too-strict pre-commit/TDD hook frustrates legitimate config/doc work. Mitigation: the existing `no test:` escape hatch, kept explicit and logged.
- **A framework must not become a runtime it can't own.** Steinberger's critique of "thin wrappers around the SDK + worktree management" is a real hazard for the autonomy backend. Mitigation: ship the runner as a thin, optional, BYO-CLI driver — Conductor's value stays the methodology + deterministic guarantees, not a bespoke agent runtime or GUI.
- **Sandboxing is now in scope.** Unattended shell access mandates a sandbox (survey §5). This is new surface area and a hard dependency for L3.

**Neutral**
- Prose rules stay; they are demoted from "sole guarantee" to "guidance + soft backstop."

## Scope boundary

This ADR sets the principle and the autonomy slider. The **robust autonomy backend** — the deterministic loop runner, sandbox, platform adapters, and hardening of the V5 engine — is specified in `docs/roadmap/Autonomous-Loop-Backend.md`. The interactive-session hooks (Verification/TDD) are a parallel, lower-priority track tracked in that document's "Deferred" section.
