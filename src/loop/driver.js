// src/loop/driver.js
//
// The deterministic DRIVER for the Conductor autonomous loop (ADR-0001, V6).
//
// Design principle: "the host runner is the authority; the agent is a fallible
// worker." Everything that must ALWAYS happen — the iteration ceiling, stall
// detection, the Evidence Rule (verification exit code), the Scoping Barrier,
// and the wall-clock budget — lives here in code the agent cannot reason around.
//
// This module is intentionally PURE-ish: all IO (spawning an agent, running the
// verify command, reading git HEAD, the clock, persisting state) is injected via
// `deps`, so `node --test` can drive the whole state machine with a stub adapter
// and never spawn a `claude` process. See test/loop-driver.test.js.

import { createHash } from "node:crypto";

/** Terminal statuses — once reached, the loop stops. Single source of truth. */
export const TERMINAL_STATUSES = Object.freeze([
  "completed",
  "awaiting_review",
  "stalled",
  "max_iterations_exceeded",
  "budget_exceeded",
  "halted_scoping",
  "halted_no_verification",
  "halted_sandbox_required",
  "halted_autonomy",
]);

/** Autonomy slider (ADR-0001 D3). Higher rank = more autonomy. */
export const LEVELS = Object.freeze({ L0: 0, L1: 1, L2: 2, L3: 3 });

export function levelRank(level) {
  return LEVELS[level] ?? LEVELS.L1;
}

/** Non-terminal working statuses the driver transitions between. */
export const WORKING_STATUSES = Object.freeze([
  "idle",
  "rejected_by_checker",
  "ready_for_check",
  "passed_by_checker",
]);

export const MAX_CONSECUTIVE_STALLS = 3;

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/** Stable hash of an arbitrary string (used for beat-progress + verify output). */
export function hashString(input) {
  return createHash("sha256").update(String(input ?? "")).digest("hex").slice(0, 16);
}

/**
 * The beat-progress hash — DRIVER-OBSERVABLE state only (git HEAD + verify
 * output). The V5 `last_tool+args` component is deliberately excluded: it lives
 * inside the agent process and is not observable without agent self-report,
 * which is exactly what the driver removes.
 */
export function computeStallHash({ gitHead, verifyOutput }) {
  return hashString(`${gitHead ?? ""}::${verifyOutput ?? ""}`);
}

/**
 * The Evidence Rule floor: a non-zero verification exit ALWAYS forces a reject;
 * exit 0 is necessary-but-not-sufficient (Phase 1 passes directly; Phase 3 will
 * additionally consult the independent Checker before `passed_by_checker`).
 */
export function statusAfterVerify(exitCode) {
  return exitCode === 0 ? "passed_by_checker" : "rejected_by_checker";
}

/**
 * Resolve the verification command, mirroring hooks/lib.sh `conductor_verify_cmd`
 * byte-for-byte so interactive (pre-push) and headless (driver) enforcement agree.
 * Pure: the command layer gathers the three inputs and passes them in.
 *   state.verification.command → config "verify" → `npm test` iff declared → null
 */
export function resolveVerifyCommand({ stateCommand, configVerify, hasNpmTestScript }) {
  const fromState = (stateCommand ?? "").trim();
  if (fromState) return fromState;
  const fromConfig = (configVerify ?? "").trim();
  if (fromConfig) return fromConfig;
  if (hasNpmTestScript) return "npm test";
  return null;
}

/** Ensure a loaded state object has every v2 field the driver relies on. */
export function normalizeState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    schema_version: 2,
    goal_description: s.goal_description ?? "",
    phase: s.phase ?? "discovery",
    autonomy_level: s.autonomy_level ?? "L1",
    platform: s.platform ?? null,
    sandbox: s.sandbox ?? "none",
    status: s.status ?? "idle",
    current_worker: s.current_worker ?? null,
    maker_reported_done: s.maker_reported_done ?? false,
    iterations: {
      current: s.iterations?.current ?? 0,
      max_allowed: s.iterations?.max_allowed ?? 20,
    },
    budget: {
      max_beats: s.budget?.max_beats ?? s.iterations?.max_allowed ?? 20,
      max_wall_clock_min: s.budget?.max_wall_clock_min ?? 120,
      // v1 → v2 migration: telemetry.tokens_spent folds into budget.
      tokens_spent: s.budget?.tokens_spent ?? s.telemetry?.tokens_spent ?? 0,
      started_at: s.budget?.started_at ?? null,
    },
    verification: {
      command: s.verification?.command ?? "",
      last_exit_code: s.verification?.last_exit_code ?? null,
      last_output_hash: s.verification?.last_output_hash ?? null,
    },
    stall: {
      // v1 → v2 migration: telemetry.consecutive_stalls folds into stall.
      consecutive: s.stall?.consecutive ?? s.telemetry?.consecutive_stalls ?? 0,
      last_beat_hash: s.stall?.last_beat_hash ?? null,
    },
    tasks: Array.isArray(s.tasks) ? s.tasks : [],
    roles: Array.isArray(s.roles) ? s.roles : ["maker", "checker"],
    concurrency: s.concurrency ?? 1,
    merge: s.merge ?? null, // { branch, pr_url } once a PR is opened (L3)
    history: Array.isArray(s.history) ? s.history : [],
  };
}

/**
 * Autonomy-slider enforcement (Phase 4 — pair; swarm deferred behind an evidence
 * gate). Returns a terminal status if the level does not permit this run, else null.
 *   L0  — interactive only; the headless loop does not run.
 *   L1  — single beat, any permitted phase, no merge (human reviews after).
 *   L2  — multi-beat blueprint only; no code merged.
 *   L3  — multi-beat execution in a sandbox; merges via a PR (never a direct push).
 * Concurrency > 1 (swarm) is refused everywhere: the scheduler is not built yet.
 */
export function autonomyPreflight(state) {
  const rank = levelRank(state.autonomy_level);
  if (rank === LEVELS.L0) return "halted_autonomy"; // interactive-only
  if ((state.concurrency ?? 1) > 1) return "halted_autonomy"; // swarm not implemented
  if (state.autonomy_level === "L2" && state.phase === "execution") {
    return "halted_autonomy"; // L2 is blueprint-only; execution needs L3
  }
  return null;
}

/** Human-readable reason for a terminal halt (for logs + inbox). */
export function describeHalt(state, status) {
  switch (status) {
    case "halted_scoping":
      return "phase is 'discovery' — the Scoping Barrier forbids headless discovery. Define requirements with a human first.";
    case "halted_no_verification":
      return "no verification command could be resolved (state.verification.command, conductor.config.json 'verify', or an npm test script). Refusing to run without a real success signal.";
    case "halted_sandbox_required":
      return "autonomy_level L3 requires sandbox='container' (see .agents/sandbox/). Refusing unattended execution without isolation.";
    case "halted_autonomy":
      if (levelRank(state.autonomy_level) === LEVELS.L0)
        return "autonomy_level L0 is interactive-only; raise it to run the loop headless.";
      if ((state.concurrency ?? 1) > 1)
        return "concurrency>1 (swarm) is not yet implemented; set concurrency:1 (swarm scheduling is deferred behind an evidence gate).";
      if (state.autonomy_level === "L2" && state.phase === "execution")
        return "autonomy_level L2 is blueprint-only; use L3 for headless execution.";
      return "autonomy policy refused this run.";
    default:
      return status;
  }
}

/**
 * Pre-flight guards that must pass BEFORE any beat runs. Returns a terminal
 * status string if the loop must not start, else null.
 *   - Scoping Barrier: discovery phase is never headless.
 *   - Evidence Rule precondition: no resolvable verify command → fail safe.
 */
export function preflight(state, { verifyCommand }) {
  // Order: scoping (never headless) → safety (sandbox) → autonomy policy → config.
  if (state.phase === "discovery") return "halted_scoping";
  // L3 (unattended execution) is only permitted inside a sandbox (Q2: document-only).
  // Refuse unsafe autonomy before quibbling about config.
  if (state.autonomy_level === "L3" && state.sandbox !== "container") {
    return "halted_sandbox_required";
  }
  const autonomyHalt = autonomyPreflight(state);
  if (autonomyHalt) return autonomyHalt;
  if (!verifyCommand) return "halted_no_verification";
  return null;
}

/**
 * Run the deterministic control loop to a terminal status.
 *
 * @param {object} state     normalized v2 loop state (mutated + returned)
 * @param {object} deps
 *   @param {(o)=>Promise<{exitCode:number,stdout?:string,tokens?:number}>} deps.runBeat
 *          spawn one agent beat (the ONLY thing the platform adapter owns)
 *   @param {(cmd)=>Promise<{exitCode:number,output:string}>} deps.runVerify
 *          run the verify command, capture exit code + output
 *   @param {()=>string|Promise<string>} deps.gitHead  current git HEAD sha
 *   @param {()=>number} deps.now                        epoch ms (injectable clock)
 *   @param {(state)=>void|Promise<void>} deps.persist   atomic state write (each transition)
 *   @param {(o)=>Promise<{exitCode:number}>} [deps.runChecker]  Phase 3: independent
 *          Checker in a SEPARATE process; exit 0 approves a green diff, non-zero rejects.
 *          Omit for deterministic-only mode (green verify passes directly).
 *   @param {(o)=>Promise<{ok:boolean,branch?:string,prUrl?:string,reason?:string}>} [deps.merge]
 *          Phase 4: PR-gated merge at L3 execution completion. Never a direct push.
 *   @param {(msg:string)=>void|Promise<void>} [deps.audit]  append to the ship-log trail
 *   @param {(msg)=>void} [deps.log]
 *   @param {string} deps.verifyCommand                  pre-resolved verify command
 *   @param {(state,reason)=>void|Promise<void>} [deps.writeInbox]  escalation note
 */
export async function runLoop(state, deps) {
  const {
    runBeat,
    runVerify,
    gitHead,
    now,
    persist,
    verifyCommand,
    runChecker = null, // Phase 3: independent Checker in a separate process
    merge = null, // Phase 4: PR-gated merge at L3 (async → { ok, branch, prUrl, reason })
    audit = () => {}, // Phase 4: append to the human-auditable ship-log trail
    log = () => {},
    writeInbox = () => {},
  } = deps;

  const halt = preflight(state, { verifyCommand });
  if (halt) {
    state.status = halt;
    await persist(state);
    const reason = describeHalt(state, halt);
    log(`[CONDUCTOR LOOP] Pre-flight halt: ${halt} — ${reason}`);
    await audit(`pre-flight halt: ${halt} — ${reason}`);
    return state;
  }
  await audit(`run start: phase=${state.phase} autonomy=${state.autonomy_level} sandbox=${state.sandbox}`);

  if (!state.budget.started_at) state.budget.started_at = new Date(now()).toISOString();

  while (!isTerminal(state.status)) {
    // ---- Guardrails the driver owns, checked BEFORE dispatching a beat ----
    if (state.iterations.current >= state.iterations.max_allowed) {
      state.status = "max_iterations_exceeded";
      await writeInbox(state, "iteration ceiling reached");
      await persist(state);
      break;
    }
    const elapsedMin = (now() - Date.parse(state.budget.started_at)) / 60000;
    if (elapsedMin >= state.budget.max_wall_clock_min) {
      state.status = "budget_exceeded";
      await writeInbox(state, "wall-clock budget exhausted");
      await persist(state);
      break;
    }

    switch (state.status) {
      case "idle":
      case "rejected_by_checker": {
        // Maker's turn. A maker attempt IS a beat → driver increments the counter.
        state.iterations.current += 1;
        state.current_worker = "maker";
        await persist(state);

        const result = await runBeat({ role: "maker", state });
        state.budget.tokens_spent += result?.tokens ?? 0;

        // Stall detection: driver-observable progress only.
        const head = await gitHead();
        const beatHash = computeStallHash({
          gitHead: head,
          verifyOutput: state.verification.last_output_hash,
        });
        if (beatHash === state.stall.last_beat_hash) {
          state.stall.consecutive += 1;
        } else {
          state.stall.consecutive = 0;
        }
        state.stall.last_beat_hash = beatHash;
        state.current_worker = null;

        if (state.stall.consecutive >= MAX_CONSECUTIVE_STALLS) {
          state.status = "stalled";
          await writeInbox(state, "no progress across 3 consecutive beats");
          await persist(state);
          break;
        }

        state.status = "ready_for_check";
        state.history.push({
          beat: state.iterations.current,
          status: "ready_for_check",
          evidence: null,
          ts: new Date(now()).toISOString(),
        });
        await audit(`beat ${state.iterations.current}: maker → ready_for_check`);
        await persist(state);
        break;
      }

      case "ready_for_check": {
        // The Evidence Rule, in code — the driver runs verify itself (the FLOOR).
        const { exitCode, output } = await runVerify(verifyCommand);
        state.verification.last_exit_code = exitCode;
        state.verification.last_output_hash = hashString(output);

        let checkerExit = null;
        if (exitCode !== 0) {
          // Red floor: forced reject, no Checker consulted.
          state.status = "rejected_by_checker";
        } else if (runChecker) {
          // Green is necessary-but-not-sufficient: an INDEPENDENT Checker in a
          // separate fresh process reviews the diff (Phase 3). Its exit code is
          // the verdict — the driver reads a signal, never a self-report.
          state.current_worker = "checker";
          await persist(state);
          const cr = await runChecker({ role: "checker", state });
          checkerExit = cr?.exitCode ?? 1;
          state.current_worker = null;
          state.status = checkerExit === 0 ? "passed_by_checker" : "rejected_by_checker";
        } else {
          // No Checker injected (Phase 1 / unit harness): green passes directly.
          state.status = "passed_by_checker";
        }

        state.history.push({
          beat: state.iterations.current,
          status: state.status,
          evidence: {
            exit_code: exitCode,
            output_hash: state.verification.last_output_hash,
            checker_exit: checkerExit,
          },
          ts: new Date(now()).toISOString(),
        });
        // L1 (single-beat): one Maker→Checker cycle, then hand off to the human
        // for review/merge — regardless of pass or fail.
        if (levelRank(state.autonomy_level) === LEVELS.L1) {
          state.status = "awaiting_review";
        }
        log(
          `[CONDUCTOR LOOP] verify exit=${exitCode}` +
            (checkerExit !== null ? `, checker exit=${checkerExit}` : "") +
            ` → ${state.status}`
        );
        await audit(
          `beat ${state.iterations.current}: verify exit=${exitCode}` +
            (checkerExit !== null ? `, checker exit=${checkerExit}` : "") +
            ` → ${state.status}`
        );
        await persist(state);
        break;
      }

      case "passed_by_checker": {
        // Advance. The driver owns STOPPING; the agent owns the positive "done"
        // signal (it cannot be deterministically derived for a fuzzy goal).
        if (!state.maker_reported_done) {
          state.status = "idle"; // more work to do → next beat (L2/L3 multi-beat)
          await persist(state);
          break;
        }
        // Goal reported complete. How we finish depends on the autonomy level.
        if (state.phase === "execution" && levelRank(state.autonomy_level) >= LEVELS.L3) {
          // L3 execution: never a silent push to a protected branch — open a PR,
          // gated by the green floor + Checker approval already established above.
          if (merge) {
            const m = await merge({ state });
            if (m?.ok) {
              state.merge = { branch: m.branch ?? null, pr_url: m.prUrl ?? null };
              state.status = "completed";
              await audit(`merge: PR opened ${m.prUrl ?? "(url n/a)"} for ${m.branch ?? "branch"}`);
            } else {
              state.status = "awaiting_review";
              await writeInbox(state, `PR-gated merge failed: ${m?.reason ?? "unknown"}`);
              await audit(`merge failed: ${m?.reason ?? "unknown"} → awaiting_review`);
            }
          } else {
            // No merge capability wired — cannot open a PR; hand off to the human.
            state.status = "awaiting_review";
            await writeInbox(state, "goal complete but no merge/PR capability available");
          }
        } else {
          // L2 blueprint completion (or any non-execution done): specs are ready
          // for the design-time sign-off. No code merge.
          state.status = "awaiting_review";
        }
        await persist(state);
        break;
      }

      default:
        // Unknown non-terminal status — fail safe rather than spin.
        log(`[CONDUCTOR LOOP] Unknown status '${state.status}' — halting.`);
        state.status = "stalled";
        await writeInbox(state, `unknown status '${state.status}'`);
        await persist(state);
        break;
    }
  }

  log(`[CONDUCTOR LOOP] Terminal status: ${state.status}`);
  await audit(`terminal: ${state.status}`);
  return state;
}
