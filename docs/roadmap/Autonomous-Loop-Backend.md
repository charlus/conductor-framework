# Robust Autonomy Backend (Ralph-hardened Loop Engine)

> **Status:** Proposed — 2026-07-14
> **Priority:** High — flagship of the V6 "Enforcement & Autonomy Rebalance"
> **Decision:** `docs/adr/0001-enforcement-and-autonomy-rebalance.md`
> **Builds on:** V5 Autonomous Loop Engine (`b953efc..bbe8f55`)

## Progress so far (already shipped — do NOT re-implement)

The **non-loop track** of ADR-0001 is done and in the tree (uncommitted as of 2026-07-14). A fresh agent should treat these as complete and build Phase 1 on top:

- ✅ **D5 slash-command bridge** (was Phase 2's first item) — `src/claude-commands.js`, wired into `init`/`upgrade`.
- ✅ **D2 loop-guardrails demotion** (was Phase 5) — `rules/loop-guardrails.md` is now `trigger: manual`, loaded by `workflows/unattended-loop.md` Step 0; `registry.json` + `check-conductor.sh` updated.
- ✅ **D1 interactive enforcement hooks** (was Deferred) — `templates/.agents/hooks/{pre-commit,pre-push,verification-stop-hook.sh,lib.sh}` + `conductor install-hooks`. **Reuse these:** the pre-push hook already resolves a verification command from `conductor.config.json`'s `verify` field via `conductor_verify_cmd()`. The driver's "Evidence Rule in code" (Phase 1) should read the **same** `verify` field so interactive and headless enforcement agree.
- ✅ **Registry supply-chain scanning** (was Deferred) — `src/skill-scan.js`, wired into `conductor add`.

**Remaining = the loop backend itself: Phases 1, 3, 4** (Phase 2's adapter interface minus the shipped bridge; Phase 5 minus the shipped demotion). That is what this document must be sufficient to build — see **Implementation handoff** below.

## Vision

Turn the V5 Loop Engine from a **prose-driven** headless workflow into a **deterministically-driven** autonomy backend, modelled on Geoff Huntley's Ralph loop (`while :; do cat PROMPT.md | agent; done`) but hardened with Conductor's Maker/Checker split, Scoping Barrier, and a real host-side control loop.

**One engine, pair → swarm.** The same backend runs a simple Maker/Checker pair (default) *and* a swarm of specialized agents (opt-in, L3) — the difference is configuration, not code (see "Role model" below).

**Claude Code first.** The framework was originally built for Antigravity (`run-conductor-loop.js` hardcodes `antigravity run`); Claude Code is now the primary target. The driver is refactored behind a platform-adapter interface with the Claude Code adapter (headless `claude -p` + native `/loop`) shipped first.

The governing rule (from ADR-0001): **the host runner is the authority; the agent is a fallible worker.** Anything that must always happen — iteration limits, stall detection, "success = green tests" — lives in code the agent cannot reason around, per Anthropic's *"hooks are deterministic, instructions are advisory."*

## What V5 already ships (keep)

| Asset | Role | Verdict |
|---|---|---|
| `personas/maker.md` + `personas/checker.md` | Generator / independent verifier split | **Keep** — matches Ralph + obra + "verification is load-bearing" |
| `workflows/unattended-loop.md` | Agent-facing state machine + Scoping Barrier | **Keep**, tighten (below) |
| `rules/loop-guardrails.md` | Iteration ceiling, anti-stall, Evidence Rule (prose) | **Keep as guidance**; ✅ already demoted `always_on` → loop-scoped |
| `conductor/1-workbench/loop-state.json` | "The Spine" — durable external state | **Keep**, extend schema |
| `scripts/run-conductor-loop.js` | Host runner | **Rewrite** — it's the fatal gap |
| `CLAUDE.md` native `/loop` block | Claude Code entry point | **Keep** as the L1/L2 interactive path |

## The gap V5 leaves (fix)

The V5 runner is a stub. It runs **one** beat, hardcodes `antigravity run …`, and enforces **nothing** — the iteration ceiling, anti-stall, and Evidence Rule are prose the agent is trusted to obey. Ralph's whole point is that the *loop and its limits live in the driver*, not in the model. Additional gaps:

1. No actual loop (no `while` / re-invocation).
2. No deterministic verification — nobody runs the test command and checks the exit code.
3. No deterministic stall detection (git SHA / test-output deltas between beats).
4. Platform lock-in (`antigravity` hardcoded) + typo `CONDUCUTOR`.
5. No sandbox; unattended shell access with no isolation (survey §5 mandates it).
6. Checker "independence" is prose, not a separate fresh-context process.
7. Auto-merge to a branch with no PR/clean-state gate.
8. State-schema drift: `loop-guardrails.md` writes `status: max_iterations_exceeded`; the runner only checks `completed`/`stalled`; defaults use `idle`/`stalled`/`completed`. Unify.
9. `telemetry.tokens_spent` is never populated; no time/token budget cap.

## Architecture

```
run-conductor-loop.js  (the deterministic DRIVER = scheduler + authority)
        │  reads/writes  ┌───────────────────────────────────────────┐
        ├───────────────▶│ conductor/1-workbench/loop-state.json      │
        │                │   THE SPINE = task-graph blackboard        │
        │                │   tasks[]: {id,type,status,deps,role,       │
        │                │             worktree,evidence}             │
        │                └───────────────────────────────────────────┘
        │  enforces: frontier scheduling · concurrency cap · per-task ceiling/stall
        │            · global token+wall-clock budget · Scoping Barrier · clean-git · merge queue
        │
        ├─▶ dispatch frontier task → specialized MAKER   ── isolated worktree + SANDBOX, headless
        │      (archetype=maker + persona + type filter)
        │
        ├─▶ verify(task.verification_cmd) → exit code     ── THE Evidence Rule, in code (not prose)
        │
        ├─▶ specialized CHECKER (SEPARATE fresh process)  ── true independence, not an in-context sub-agent
        │
        └─▶ PlatformAdapter  claude(first) | codex | antigravity   ── swappable; owns the CLI invocation only
```

The agent still reads `unattended-loop.md` + Maker/Checker personas each beat (soft layer). The driver is the hard layer: even if the agent ignores every rule, the driver stops at the ceiling, halts on a stall, refuses to advance state on a non-zero verification exit, and never merges outside the queue.

## Role model: pair → swarm (ADR-0001 D4)

Three primitives make the same engine span N=2 to N-large:

1. **Two archetypes only** — *Maker* (produces) and *Checker* (verifies). No third archetype; the generator–verifier duality is the guarantee.
2. **Specialization = archetype + persona + task-type filter.** The existing 10 personas become the **specialization roster**. Examples: `db-maker` (Maker + Database Architect, claims `schema|migration`), `security-checker` (Checker + Security Auditor, audits `auth|middleware` diffs), `ui-maker` (Maker + Designer, claims `component|style`).
3. **Task-graph blackboard + deterministic scheduler.** Carve already emits dependency-noted vertical slices → that is the task graph. The driver computes the **frontier** (unblocked + unclaimed), dispatches to matching Makers up to a concurrency cap, routes results to matching Checkers, and serializes merges through a PR-gated queue. Coordination is stigmergic (read/write the blackboard); agents never talk to each other.

Scaling is configuration:

```jsonc
// pair (default, L1)                     // swarm (opt-in, L3)
"roles": ["maker","checker"],             "roles": ["db-maker","logic-maker","ui-maker",
"concurrency": 1                                    "security-checker","quality-checker"],
                                          "concurrency": 4
```

**Risk:** swarms amplify bad task decomposition — parallel garbage compounds. Mitigation is upstream: Carve/blueprint quality + the single design-time sign-off (D2) is where the human validates the slicing *before* the swarm runs; the Checker layer + PR gate catch bad output after.

## Phased plan

### Phase 1 — Deterministic driver (the core; no new platforms yet)
Rewrite `scripts/run-conductor-loop.js` into a real control loop that owns the guarantees:
- **Loop:** `while state.status not terminal AND state.iterations.current < max_allowed`. Increment the counter **in the driver**, not the agent.
- **Evidence Rule in code:** after a `maker`/`checker` beat, the driver runs `state.verification_command` itself, captures exit code + output. Exit `0` ⇒ may transition to `passed_by_checker`; non-zero ⇒ force `rejected_by_checker`. The agent's self-assessment is advisory only.
- **Stall detection in code:** hash `(git rev-parse HEAD, verification output, last_tool+args)` at beat end; if unchanged vs previous beat, increment `consecutive_stalls`; at 3 → `stalled`, write `inbox.md`, exit.
- **Scoping Barrier in code:** refuse to start if `phase == "discovery"`; print the human-requirements request and exit.
- **Clean-git precondition:** abort a beat if the worktree is dirty in an unexpected way; never merge with conflicts.
- **Unify state schema + fix typo:** single terminal-status vocabulary (`completed` | `stalled` | `max_iterations_exceeded` | `halted_scoping`); reconcile `loop-guardrails.md`, `loop-state.json`, and the runner. Fix `CONDUCUTOR`→`CONDUCTOR`.
- **Budget:** add `budget: { max_beats, max_wall_clock_min, tokens_spent }`; driver enforces wall-clock + beat caps even if the agent misreports tokens.
- Tests: unit-test the driver's state machine and guardrail math with fixture `loop-state.json` files (Node's built-in `node:test`).

### Phase 2 — Platform adapter interface (Claude Code first)
- **Slash-command bridge (shipped first, ADR-0001 D5):** `init`/`upgrade` generate a thin `.claude/commands/<name>.md` shim per `.agents/workflows/*.md` so Conductor's workflows are invocable as native Claude Code slash commands (`/build`, `/carve`, …). Shims are derived from the workflow set (no drift) and only redirect to the real workflow file — the workflow stays the single source of truth shared with Antigravity. `/loop` is already native and needs no shim.
- Define the adapter interface: `runBeat(promptPath, {sandbox, permissionMode}) → {stdout, exitCode, tokens?}` and `runChecker(...)`.
- **Ship the Claude Code adapter first** (it is the primary target): headless `claude -p` with a scoped permission mode; wire to the existing `.claude/loop.md` / native `/loop` path. Phase 1's driver is built directly against this adapter.
- Reduce Antigravity to just another adapter (`scripts/adapters/antigravity.js`); add Codex later. Remove the hardcoded `antigravity run` from the driver.
- Select adapter via `loop-state.json.platform` or a CLI flag; default auto-detect.
- The adapter is deliberately minimal and BYO-CLI — directly answering Steinberger's "thin wrapper, no moat" critique (D7): the value is the driver's guarantees, not the wrapper or a GUI.

### Phase 3 — Sandbox & isolation (hard dependency for L3)
- **Maker** runs in an isolated **git worktree** (V5 already calls `using-git-worktrees`; make the driver create/tear it down deterministically).
- **Process/network sandbox** for unattended runs: default-deny network, workspace-only filesystem, per-beat CPU/time limits (survey §5.1). Start with a documented container profile; expose `sandbox: none|container` with `none` disallowed at L3.
- **Checker as a separate process** with a fresh context (structural independence), not an in-context sub-agent.

### Phase 4 — Autonomy slider + swarm scaling + merge gating
- Implement L0–L3 (ADR-0001 D3) as `loop-state.json.autonomy_level`; driver refuses actions above the set level. **Default L0/L1**; swarm/concurrency only unlocks at L3.
- **Swarm scheduling (D4):** promote the Spine to the task-graph blackboard; implement frontier computation, `roles[]` + `concurrency` config, and specialized role resolution (archetype + persona + type filter) from the persona roster. Concurrency=1 reproduces the pair exactly (regression guard).
- **Merge queue:** parallel Makers each in their own worktree; the driver serializes merges, each gated by its specialized Checker (green) + a PR/MR (reuse `git-hub-cli`/`git-lab-cli`). Never a silent push to a protected branch; conflicts pause and escalate.
- Per-task ceiling/anti-stall; single global token + wall-clock budget pool across all concurrent roles.
- Log every autonomous action to `0-compass/ship-log.md` (human-auditable trail = Karpathy's "auditable actions").

### Phase 5 — Rebalance cleanup (from ADR-0001 D2)
- Demote `loop-guardrails.md` from `always_on` to loop-scoped (loaded by `unattended-loop.md`); update `registry.json` + `check-conductor.sh`.
- Sweep for per-step approval ceremony collapsible into a single design-time gate.

### Deferred (parallel track, lower priority)
- ✅ ~~Interactive-session hooks (Verification stop-hook + TDD pre-commit)~~ — **shipped** (see Progress so far).
- ✅ ~~Registry supply-chain scanning for downloaded `SKILL.md`~~ — **shipped** (`src/skill-scan.js`).
- Multi-vote / adversarial Checker for high-stakes tickets (survey's "verify with N skeptics") — still open.
- Codex adapter (after the Claude Code adapter proves the interface) — still open.

## Implementation handoff (read this to start Phase 1)

Everything a fresh agent needs to begin without re-deriving decisions. Where this section and the prose above differ, this section wins.

### Where the driver lives (resolves Open Q1)

**Decision: ship the driver as a `conductor loop` CLI subcommand** (`src/commands/loop.js`, routed in `src/cli.js` exactly like `install-hooks`), operating on the current project's `conductor/1-workbench/loop-state.json`. Rationale: the loop runs in the *user's* project, and Conductor is already an npm CLI — a subcommand means no per-project script copy and one code path to maintain (consistent with D7 "thin BYO-CLI driver"). The V5 `scripts/run-conductor-loop.js` is a throwaway prototype: port its intent, then **delete it** (and its `antigravity`/`CONDUCUTOR` typo). Keep the driver's pure logic (state machine, guardrail math) in a testable module (`src/loop/driver.js`) that the command thins over, so `node:test` can exercise it without spawning an agent.

### Target `loop-state.json` schema (v2)

The current file (`templates/conductor/1-workbench/loop-state.json`) is the v1 minimum. Extend to this, keeping existing field names; new fields are additive so old state files still parse (driver fills defaults):

```jsonc
{
  "schema_version": 2,
  "goal_description": "",
  "phase": "discovery",              // discovery | blueprint | execution | shipping
  "autonomy_level": "L1",            // L0 | L1 | L2 | L3  (Phase 4; driver refuses actions above it)
  "status": "idle",                  // see state machine below
  "current_worker": null,
  "iterations": { "current": 0, "max_allowed": 20 },
  "budget": {                         // NEW — driver-enforced, not agent-reported
    "max_beats": 20,
    "max_wall_clock_min": 120,
    "tokens_spent": 0,
    "started_at": null                // ISO string; driver stamps on first beat
  },
  "verification": {                   // NEW — source of truth for the Evidence Rule
    "command": "",                    // if empty, driver falls back to conductor.config.json "verify", then `npm test`
    "last_exit_code": null,
    "last_output_hash": null
  },
  "stall": {                          // promoted out of telemetry for clarity
    "consecutive": 0,
    "last_beat_hash": null            // hash(git HEAD + verify output + last tool+args)
  },
  "tasks": [],                        // Phase 4 task-graph blackboard; [] = simple pair mode
  "roles": ["maker", "checker"],      // Phase 4; default pair
  "concurrency": 1,                   // Phase 4; >1 only at L3
  "history": []                       // append-only beat log: {beat, status, evidence, ts}
}
```

Fix the v1 typo path where present and unify terminal-status vocabulary (below). `telemetry.last_tool_invoked/arguments` from v1 fold into `stall.last_beat_hash`.

### State machine (explicit — the driver owns transitions)

| status | who acts this beat | on success → | on failure → | terminal? |
|---|---|---|---|---|
| `idle` | Maker | `ready_for_check` | `stalled` | no |
| `rejected_by_checker` | Maker (retry) | `ready_for_check` | — | no |
| `ready_for_check` | driver runs `verification.command`; then Checker | `passed_by_checker` (exit 0) | `rejected_by_checker` (exit ≠ 0) | no |
| `passed_by_checker` | driver merges/advances | `idle` (next task) or `completed` | — | no |
| `completed` | — | — | — | **yes** |
| `stalled` | — (3 consecutive no-progress beats; write inbox.md) | — | — | **yes** |
| `max_iterations_exceeded` | — (`iterations.current ≥ max_allowed`) | — | — | **yes** |
| `halted_scoping` | — (`phase == discovery`; Scoping Barrier) | — | — | **yes** |

The **Evidence Rule is a driver step, not an agent claim**: on `ready_for_check` the driver runs `verification.command` itself, records `last_exit_code`, and *forces* the next status from the exit code — the agent's self-report is advisory. A deliberately-lying stub agent must still be routed to `rejected_by_checker` on a red exit; that is the key Phase 1 test.

### The beat contract & Claude Code adapter (Phase 2)

One **beat** = one agent invocation that reads state, does the phase-appropriate work for the current `status`, writes files, and updates `loop-state.json`. The driver wraps each beat with the deterministic guards.

Adapter interface (Phase 1 builds directly against the Claude Code impl):
```js
// src/loop/adapters/claude.js
async function runBeat({ promptPath, cwd, permissionMode }) → { exitCode, stdout, tokens? }
async function runChecker({ ... })  // separate fresh process for structural independence (Phase 3)
```
Claude Code invocation (headless): `claude -p "$(cat <promptPath>)" --permission-mode <mode>` run in `cwd`, capturing exit code + stdout. `promptPath` is `.agents/workflows/unattended-loop.md` (the agent re-reads it each beat — the soft layer). Adapter selection via `loop-state.json` (add a `platform` field) or a `--platform` flag; default auto-detect (Claude Code if `claude` is on PATH). Keep the adapter to *only* the CLI invocation — all guarantees live in the driver.

Between beats the driver — not the agent — increments `iterations.current`, recomputes the stall hash, checks the budget wall-clock, and enforces the Scoping Barrier before dispatching.

### Test harness (Phase 1 acceptance)

Inject the adapter (`{ runBeat }`) into `driver.js` so tests pass a **stub adapter** that returns canned `{exitCode, stdout}` and mutates a fixture `loop-state.json` — no `claude` process. Cover with `node:test`: (a) ceiling stop, (b) stall stop after 3 no-progress beats, (c) red verification forces `rejected_by_checker` even when the stub "claims" success, (d) `phase:discovery` → `halted_scoping` before any beat, (e) budget wall-clock stop. Add a `check-conductor.sh` section asserting the driver module + schema fields exist.

## Acceptance criteria

- `node scripts/run-conductor-loop.js` drives a real multi-beat loop to a terminal status with **no** reliance on the agent honoring the guardrails (provable by a test where a deliberately-misbehaving stub agent still gets stopped at the ceiling / on a stall / on a red verification).
- A discovery-phase state halts before any beat runs.
- L3 never merges on a non-zero verification exit; merges go through a PR.
- `bash templates/.agents/tests/check-conductor.sh` stays green; new checks cover the driver + schema.
- Works on ≥2 platforms via adapters (Claude Code + one other).

## Open questions

1. ✅ **Resolved:** ship the driver as a `conductor loop` CLI subcommand (see Implementation handoff → *Where the driver lives*), not a per-project script.
2. **Sandbox baseline (Phase 3):** document-only (user brings Docker) vs. bundle a profile. **Recommendation: document-only for v1** — ship a documented container profile + `sandbox: none|container` in state, `none` disallowed at L3. Revisit only if L3 adoption needs a turnkey sandbox. (Still needs a final call before Phase 3.)
3. ✅ **Resolved: both, split by autonomy level.** Native Claude Code `/loop` (via `.claude/loop.md`) is the interactive **L1/L2** path — no custom driver, human sits on the loop. The `conductor loop` driver is the unattended **L3** path where deterministic guarantees are load-bearing. They share `unattended-loop.md` + `loop-state.json`, so state is portable between them.

> **Only Q2 remains open, and it doesn't block Phase 1.** Phases 1–2 are fully specified above; decide the sandbox baseline before starting Phase 3.
