// src/loop/swarm.js
//
// Swarm scheduler (ADR-0001 D4 / Phase 4, deferred track — now built, opt-in).
// One engine, pair → swarm: the pair (src/loop/driver.js) handles a single fuzzy
// goal; the swarm handles a task-graph blackboard (`state.tasks[]`) with N
// specialized Maker/Checker roles running concurrently, each in its own worktree,
// with a serialized PR-gated merge queue.
//
// EVIDENCE GATE: the swarm amplifies bad task decomposition (parallel garbage
// compounds). It is opt-in (requires L3 + sandbox + concurrency>1 + a task graph)
// and unproven on real work — do not rely on it until pair mode has driven real
// tickets to green unattended. Concurrency=1 reproduces the pair's per-task
// behavior exactly (regression guard).
//
// All IO (agent beats, verify, checker, merge, git, clock, persist) is injected
// so the whole scheduler is unit-testable with stubs — no processes spawned.

import { hashString, computeStallHash, preflight, describeHalt } from "./driver.js";

export const MAX_TASK_STALLS = 3;

/** Task-graph terminal states. */
export const TASK_TERMINAL = Object.freeze(["merged", "failed"]);

export function isTaskTerminal(task) {
  return TASK_TERMINAL.includes(task.status);
}

/** Normalize a role entry (string or object) into a descriptor. */
export function normalizeRole(role) {
  if (typeof role === "string") {
    // "maker" / "checker" → generic; "db-maker" → maker archetype by suffix.
    const archetype = role.endsWith("checker") ? "checker" : "maker";
    return { name: role, archetype, persona: null, claims: [] };
  }
  return {
    name: role.name ?? "role",
    archetype: role.archetype ?? (String(role.name).includes("checker") ? "checker" : "maker"),
    persona: role.persona ?? null,
    claims: Array.isArray(role.claims) ? role.claims : [],
  };
}

/**
 * Resolve the best role of a given archetype for a task: prefer a specialized
 * role whose `claims` include the task's type; fall back to the first generic
 * (claims=[]) role of that archetype; else the first of that archetype.
 */
export function resolveRoleForTask(task, roles, archetype) {
  const descriptors = (roles ?? []).map(normalizeRole).filter((r) => r.archetype === archetype);
  if (descriptors.length === 0) return { name: archetype, archetype, persona: null, claims: [] };
  const specialized = descriptors.find((r) => r.claims.includes(task.type));
  if (specialized) return specialized;
  const generic = descriptors.find((r) => r.claims.length === 0);
  return generic ?? descriptors[0];
}

/** Ensure a task has the fields the scheduler needs (additive defaults). */
export function normalizeTask(task, defaults = {}) {
  return {
    id: task.id,
    type: task.type ?? "general",
    status: task.status ?? "pending",
    deps: Array.isArray(task.deps) ? task.deps : [],
    role: task.role ?? null,
    worktree: task.worktree ?? null,
    iterations: {
      current: task.iterations?.current ?? 0,
      max_allowed: task.iterations?.max_allowed ?? defaults.perTaskMax ?? 10,
    },
    stall: { consecutive: task.stall?.consecutive ?? 0, last_beat_hash: task.stall?.last_beat_hash ?? null },
    evidence: task.evidence ?? null,
    merge: task.merge ?? null,
  };
}

/**
 * The frontier = pending tasks whose every dependency is already `merged`.
 * Pure and deterministic (input order preserved).
 */
export function computeFrontier(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks.filter(
    (t) => t.status === "pending" && t.deps.every((d) => byId.get(d)?.status === "merged")
  );
}

/** A task is permanently blocked if any dependency has failed. */
export function isBlocked(task, byId) {
  return task.deps.some((d) => byId.get(d)?.status === "failed");
}

/**
 * Run one task's Maker→verify→Checker chain, retrying on rejection up to the
 * per-task ceiling, sharing the global budget. Mutates the task; returns outcome.
 */
async function processTask(task, { verifyCommand, runBeat, runVerify, runChecker, gitHead, now, budget, audit }) {
  task.status = "in_progress";
  while (task.iterations.current < task.iterations.max_allowed) {
    // Shared global budget across all concurrent tasks.
    if (budget.beats >= budget.maxBeats) return { task, outcome: "failed", reason: "global iteration ceiling" };
    if ((now() - budget.startedAt) / 60000 >= budget.maxWallClockMin)
      return { task, outcome: "failed", reason: "wall-clock budget" };

    task.iterations.current += 1;
    budget.beats += 1;
    await runBeat({ task, role: task.role });

    // Per-task stall detection (driver-observable: this task's HEAD + verify out).
    const head = await gitHead({ task });
    const beatHash = computeStallHash({ gitHead: head, verifyOutput: task.evidence?.output_hash });
    task.stall.consecutive = beatHash === task.stall.last_beat_hash ? task.stall.consecutive + 1 : 0;
    task.stall.last_beat_hash = beatHash;
    if (task.stall.consecutive >= MAX_TASK_STALLS) return { task, outcome: "failed", reason: "stalled" };

    // Evidence Rule floor.
    const { exitCode, output } = await runVerify({ task, cmd: verifyCommand });
    task.evidence = { exit_code: exitCode, output_hash: hashString(output) };
    await audit(`task ${task.id}: beat ${task.iterations.current} verify exit=${exitCode}`);
    if (exitCode !== 0) {
      task.status = "rejected";
      continue; // retry
    }
    // Independent Checker above the green floor.
    if (runChecker) {
      const cr = await runChecker({ task });
      if ((cr?.exitCode ?? 1) !== 0) {
        task.status = "rejected";
        continue;
      }
    }
    task.status = "passed";
    return { task, outcome: "passed" };
  }
  return { task, outcome: "failed", reason: "per-task ceiling" };
}

/**
 * Run the swarm to a terminal status over `state.tasks[]`.
 * @returns the mutated state.
 */
export async function runSwarm(state, deps) {
  const {
    verifyCommand,
    runBeat,
    runVerify,
    runChecker = null,
    merge = null,
    gitHead,
    assignWorktree = async () => null, // ({task}) → {path,branch}
    now,
    persist,
    audit = () => {},
    log = () => {},
    writeInbox = () => {},
  } = deps;

  // Same deterministic gates as the pair (scoping, sandbox, autonomy, verify) —
  // swarm mode must NOT bypass them. This is what stops an L1/no-sandbox swarm
  // from ever dispatching an agent.
  const halt = preflight(state, { verifyCommand });
  if (halt) {
    state.status = halt;
    await persist(state);
    const reason = describeHalt(state, halt);
    log(`[CONDUCTOR SWARM] Pre-flight halt: ${halt} — ${reason}`);
    await audit(`swarm pre-flight halt: ${halt} — ${reason}`);
    return state;
  }

  state.tasks = state.tasks.map((t) => normalizeTask(t));
  const concurrency = Math.max(1, state.concurrency ?? 1);
  if (!state.budget.started_at) state.budget.started_at = new Date(now()).toISOString();
  const budget = {
    beats: state.iterations.current ?? 0,
    maxBeats: state.iterations.max_allowed ?? 20,
    startedAt: Date.parse(state.budget.started_at),
    maxWallClockMin: state.budget.max_wall_clock_min ?? 120,
  };

  await audit(`swarm start: ${state.tasks.length} tasks, concurrency=${concurrency}`);

  let terminal = null;
  while (!terminal) {
    const byId = new Map(state.tasks.map((t) => [t.id, t]));

    // Fail any pending task whose dependency failed (cascade), so we don't spin.
    for (const t of state.tasks) {
      if (t.status === "pending" && isBlocked(t, byId)) {
        t.status = "failed";
        await audit(`task ${t.id}: failed (blocked by a failed dependency)`);
      }
    }

    if (state.tasks.every(isTaskTerminal)) break;

    const frontier = computeFrontier(state.tasks);
    if (frontier.length === 0) {
      // Nothing runnable but not all terminal → everything left is blocked.
      terminal = "stalled";
      await writeInbox(state, "swarm deadlocked: remaining tasks are blocked by failures");
      break;
    }

    // Global caps checked before dispatching a wave.
    if (budget.beats >= budget.maxBeats) { terminal = "max_iterations_exceeded"; break; }
    if ((now() - budget.startedAt) / 60000 >= budget.maxWallClockMin) { terminal = "budget_exceeded"; break; }

    const wave = frontier.slice(0, concurrency);
    for (const t of wave) {
      t.role = resolveRoleForTask(t, state.roles, "maker").name;
      t.worktree = (await assignWorktree({ task: t })) ?? t.worktree;
    }
    state.iterations.current = budget.beats;
    await persist(state);

    // Parallel dispatch of the wave.
    const results = await Promise.all(
      wave.map((t) => processTask(t, { verifyCommand, runBeat, runVerify, runChecker, gitHead, now, budget, audit }))
    );
    state.iterations.current = budget.beats;

    // Serialized, PR-gated merge queue (deterministic order = wave order).
    for (const { task, outcome } of results) {
      if (outcome !== "passed") {
        task.status = "failed";
        await audit(`task ${task.id}: failed (${outcome})`);
        continue;
      }
      if (!merge) {
        task.status = "failed";
        await writeInbox(state, `task ${task.id} passed but no merge capability`);
        continue;
      }
      const m = await merge({ task });
      if (m?.ok) {
        task.status = "merged";
        task.merge = { branch: m.branch ?? null, pr_url: m.prUrl ?? null };
        await audit(`task ${task.id}: merged (PR ${m.prUrl ?? "n/a"})`);
      } else {
        // Conflict / PR failure → pause and escalate (do not silently drop).
        task.status = "passed";
        terminal = "awaiting_review";
        await writeInbox(state, `task ${task.id} PR-gated merge failed: ${m?.reason ?? "unknown"}`);
        await audit(`task ${task.id}: merge failed → awaiting_review`);
      }
    }
    await persist(state);
    if (terminal) break;
  }

  if (!terminal) {
    terminal = state.tasks.every((t) => t.status === "merged") ? "completed" : "stalled";
  }
  state.status = terminal;
  await persist(state);
  log(`[CONDUCTOR SWARM] terminal: ${terminal}`);
  await audit(`swarm terminal: ${terminal}`);
  return state;
}
