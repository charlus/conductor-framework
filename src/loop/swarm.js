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

import { hashString, computeStallHash, normalizeVerifyOutput, preflight, describeHalt, beatCeiling, classifyBeatResult } from "./driver.js";
import { costGate, costGateMessage } from "./usage.js";
import { runShipStage } from "./ship.js";
import { recordAttempt } from "./harvester.js";
import { orderMergeQueue } from "./conflict.js";
import { planMergeAction } from "./merge.js";

export const MAX_TASK_STALLS = 3;

/** Rejected beats after which a Maker beat asks for `loop.models.maker_escalation`. */
export const ESCALATE_MODEL_AFTER = 2;

/** The Maker's escalation, if this beat's signal carried one. */
function escalationOf(result) {
  const sig = result?.signal;
  if (!sig || sig.escalate !== true) return null;
  const reason = String(sig.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
  return reason || "the Maker escalated without a reason";
}

/** Same normalisation as the pair: runner timings must not move the stall hash. */
function verifyHash(output) {
  return hashString(normalizeVerifyOutput(output));
}

/** Task-graph terminal states. */
export const TASK_TERMINAL = Object.freeze(["merged", "failed"]);

export function isTaskTerminal(task) {
  return TASK_TERMINAL.includes(task.status);
}

/**
 * Infer an archetype from a role name: "…checker" → checker, "…test-author" →
 * test-author (the TDD-split contract phase). Everything else is a maker —
 * including the "implementer", which is just a maker briefed not to touch the
 * tests, so the implementation phase resolves identically to the non-split path.
 */
function inferArchetype(name) {
  const n = String(name);
  if (n.includes("checker")) return "checker";
  if (n.includes("test-author")) return "test-author";
  return "maker";
}

/** Normalize a role entry (string or object) into a descriptor. */
export function normalizeRole(role) {
  if (typeof role === "string") {
    return { name: role, archetype: inferArchetype(role), persona: null, claims: [] };
  }
  return {
    name: role.name ?? "role",
    archetype: role.archetype ?? inferArchetype(role.name),
    persona: role.persona ?? null,
    claims: Array.isArray(role.claims) ? role.claims : [],
  };
}

/**
 * Whether a task runs the opt-in TDD test-author → implementer split (ADR-0001
 * D4, unattended form of red-before-green). Per-task `contract_first` wins;
 * otherwise the swarm-wide `state.tdd_split` policy. Off by default — when off,
 * `processTask` runs exactly one maker archetype per beat, as before.
 */
export function splitForTask(task, state) {
  if (task.contract_first === true) return true;
  if (task.contract_first === false) return false;
  return state?.tdd_split === true;
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
    // Fleet-Bridge metadata (harvested from ./conductor/) — preserved so the beat
    // can render its assignment and write-back can update the right source item.
    title: task.title ?? null,
    source: task.source ?? null,
    route: task.route ?? null,
    priority: task.priority ?? null,
    details: task.details ?? "",
    // TDD split (opt-in): `contract_first` overrides the swarm-wide policy;
    // `phase` tracks contract → implementation across a task's beats.
    contract_first: typeof task.contract_first === "boolean" ? task.contract_first : null,
    phase: task.phase ?? null,
    deps: Array.isArray(task.deps) ? task.deps : [],
    role: task.role ?? null,
    // Per-task verify command: concurrent tasks run in isolated worktrees, so a
    // single repo-wide verify can't pass until EVERY task is done. A task may carry
    // its own scoped command (e.g. `node --test test/sum.test.js`); falls back to
    // the global verifyCommand when absent.
    verify: task.verify ?? null,
    worktree: task.worktree ?? null,
    iterations: {
      current: task.iterations?.current ?? 0,
      max_allowed: task.iterations?.max_allowed ?? defaults.perTaskMax ?? 10,
    },
    stall: { consecutive: task.stall?.consecutive ?? 0, last_beat_hash: task.stall?.last_beat_hash ?? null },
    evidence: task.evidence ?? null,
    merge: task.merge ?? null,
    // A13: the last rejected attempts, written by the driver and shown to the
    // next beat. `rejected_beats` counts every rejection for model escalation.
    attempts: Array.isArray(task.attempts) ? task.attempts : [],
    rejected_beats: task.rejected_beats ?? 0,
    escalation: task.escalation ?? null,
    rulings: Array.isArray(task.rulings) ? task.rulings : [],
    // Step 3: a slice's spec stage. spec_ready = the owner's spec was already
    // on the default branch; spec_reviewed = the loop wrote it and the Checker passed it.
    spec_ready: task.spec_ready === true,
    spec_reviewed: task.spec_reviewed === true,
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
async function processTask(task, { verifyCommand, runBeat, runVerify, runChecker, gitHead, changedFiles = null, now, budget, audit, roles = [], tddSplit = false, runSpec = null, specEvidence = null }) {
  const filesOf = async (from) => {
    if (!changedFiles) return [];
    try {
      return (await changedFiles({ task, from })) ?? [];
    } catch {
      return [];
    }
  };
  const reject = async ({ verifyExit, verifyOutput, checker = null, from }) => {
    task.status = "rejected";
    task.rejected_beats += 1;
    recordAttempt(task, {
      beat: task.iterations.current,
      verifyExit,
      verifyOutput,
      checkerReasons: checker?.reasons ?? [],
      checkerFindings: checker?.findings ?? [],
      files: await filesOf(from),
    });
  };
  // A14: a beat where the agent CLI hit its usage limit did no work. Refund it
  // and stop the whole run, as the pair does; the task resumes next run.
  const deadBeat = (result) => {
    const verdict = classifyBeatResult(result);
    if (!verdict.dead) return null;
    task.iterations.current -= 1;
    budget.beats -= 1;
    task.status = "pending";
    return { task, outcome: "usage_limit", resetHint: verdict.resetHint };
  };
  const escalated = async (result) => {
    const reason = escalationOf(result);
    if (!reason) return null;
    task.escalation = { reason, beat: task.iterations.current };
    await audit(`task ${task.id}: beat ${task.iterations.current} escalated by the Maker — ${reason}`);
    return { task, outcome: "escalated", reason };
  };
  task.status = "in_progress";
  if (tddSplit && !task.phase) task.phase = "contract";

  // Step 3: a slice whose spec is still blank gets the Spec-It stage first, a
  // fresh beat running spec-it.md (as the owner types `/spec-it`), then the
  // spec checked in code, then a fresh Checker reviewing it (D2). No Build
  // beat runs on a spec that did not pass.
  if (task.type === "slice" && !task.spec_ready && !task.spec_reviewed && runSpec) {
    let last = "";
    for (let i = 0; i < 2 && !task.spec_reviewed; i++) {
      if (budget.beats >= budget.maxBeats) return { task, outcome: "failed", reason: "global iteration ceiling" };
      task.iterations.current += 1;
      budget.beats += 1;
      const r = await runSpec({ task });
      const dead = classifyBeatResult(r);
      if (dead.dead) {
        task.iterations.current -= 1;
        budget.beats -= 1;
        task.status = "pending";
        return { task, outcome: "usage_limit", resetHint: dead.resetHint };
      }
      const stop = await (async () => {
        const reason = escalationOf(r);
        if (!reason) return null;
        task.escalation = { reason, beat: task.iterations.current };
        await audit(`task ${task.id}: the Spec beat escalated — ${reason}`);
        return { task, outcome: "escalated", reason };
      })();
      if (stop) return stop;
      const ev = specEvidence ? await specEvidence({ task }) : { ok: true, reasons: [] };
      if (!ev.ok) {
        recordAttempt(task, { beat: task.iterations.current, verifyExit: 0, checkerReasons: ev.reasons.map((x) => `spec evidence: ${x}`) });
        last = ev.reasons.join("; ");
        await audit(`task ${task.id}: spec beat: ${last}`);
        continue;
      }
      const c = runChecker ? await runChecker({ task, phase: "spec" }) : { exitCode: 0 };
      if ((c?.exitCode ?? 1) !== 0) {
        recordAttempt(task, { beat: task.iterations.current, verifyExit: 0, checkerReasons: c?.reasons ?? ["the Checker rejected the spec"], checkerFindings: c?.findings ?? [] });
        last = `the spec review rejected it${c?.reasons?.length ? `: ${c.reasons.join(" | ")}` : ""}`;
        await audit(`task ${task.id}: ${last}`);
        continue;
      }
      task.spec_reviewed = true;
      task.attempts = [];
      await audit(`task ${task.id}: spec written and reviewed`);
    }
    if (!task.spec_reviewed) return { task, outcome: "failed", reason: `spec stage: ${last}` };
  }
  while (task.iterations.current < task.iterations.max_allowed) {
    // Shared global budget across all concurrent tasks.
    if (budget.beats >= budget.maxBeats) return { task, outcome: "failed", reason: "global iteration ceiling" };
    if ((now() - budget.startedAt) / 60000 >= budget.maxWallClockMin)
      return { task, outcome: "failed", reason: "wall-clock budget" };

    task.iterations.current += 1;
    budget.beats += 1;

    // ---- Contract phase (opt-in TDD split): a test-author writes the failing
    // tests FIRST, in its own beat/context. Success here is RED, not green: the
    // suite must fail once the new tests land (no implementation yet). A green
    // verify means the contract is vacuous (tests assert nothing) → reject and
    // retry. Once RED is confirmed, hand off to the implementer.
    if (tddSplit && task.phase === "contract") {
      const authorRole = resolveRoleForTask(task, roles, "test-author").name;
      task.role = authorRole;
      const before = await gitHead({ task });
      const contractResult = await runBeat({ task, role: authorRole, phase: "contract", escalateModel: false });
      const dead = deadBeat(contractResult);
      if (dead) return dead;
      const stop = await escalated(contractResult);
      if (stop) return stop;
      const { exitCode, output } = await runVerify({ task, cmd: task.verify ?? verifyCommand });
      task.evidence = { exit_code: exitCode, output_hash: verifyHash(output), phase: "contract" };
      await audit(`task ${task.id}: contract beat (${authorRole}) verify exit=${exitCode}`);
      if (exitCode === 0) {
        // Tests pass with no implementation → vacuous contract.
        await reject({ verifyExit: exitCode, verifyOutput: output, from: before });
        continue;
      }
      task.phase = "implementation";
      task.role = resolveRoleForTask(task, roles, "maker").name; // implementer = a maker
      continue;
    }

    // ---- Implementation phase (or the non-split single maker). Identical
    // semantics to before: make it green, gated by verify then Checker.
    const before = await gitHead({ task });
    const result = await runBeat({
      task,
      role: task.role,
      phase: tddSplit ? "implementation" : null,
      escalateModel: task.rejected_beats >= ESCALATE_MODEL_AFTER,
    });
    const dead = deadBeat(result);
    if (dead) return dead;
    // F3: a Maker that says it is blocked ends the task now. No verify, no
    // Checker: another beat cannot get what only a human can give.
    const stop = await escalated(result);
    if (stop) return stop;

    // Per-task stall detection (driver-observable: this task's HEAD + verify out).
    const head = await gitHead({ task });
    const beatHash = computeStallHash({ gitHead: head, verifyOutput: task.evidence?.output_hash });
    task.stall.consecutive = beatHash === task.stall.last_beat_hash ? task.stall.consecutive + 1 : 0;
    task.stall.last_beat_hash = beatHash;
    if (task.stall.consecutive >= MAX_TASK_STALLS) return { task, outcome: "failed", reason: "stalled" };

    // A slice is many tasks over many beats: the tracker carries the work, and
    // the slice is judged only when the Maker says the whole of it is ship-ready.
    if (task.type === "slice" && result?.signal?.done !== true) continue;

    // Evidence Rule floor.
    const { exitCode, output } = await runVerify({ task, cmd: task.verify ?? verifyCommand });
    task.evidence = { exit_code: exitCode, output_hash: verifyHash(output) };
    await audit(`task ${task.id}: beat ${task.iterations.current} verify exit=${exitCode}`);
    if (exitCode !== 0) {
      await reject({ verifyExit: exitCode, verifyOutput: output, from: before });
      continue; // retry
    }
    // Independent Checker above the green floor.
    if (runChecker) {
      const cr = await runChecker({ task });
      if ((cr?.exitCode ?? 1) !== 0) {
        await reject({ verifyExit: exitCode, verifyOutput: output, checker: cr, from: before });
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
    predictConflict = null, // ({task}) → {conflicted, files[], method}
    gitHead,
    changedFiles = null, // ({task, from}) → string[]: files a beat changed (A13), optional
    assignWorktree = async () => null, // ({task}) → {path,branch}
    now,
    persist,
    audit = () => {},
    log = () => {},
    writeInbox = () => {},
    costAware = false, // loop.cost_aware: only then does budget.max_cost_usd act
    runShip = null, // ({task}) → beat result: the Ship beat (Unattended Lifecycle step 1)
    runSpec = null, // ({task}) → beat result: a slice's Spec-It beat (step 3)
    specEvidence = null, // ({task}) → {ok, reasons}: the spec and plan written (step 3)
    shipEvidence = null, // ({task}) → {ok, reasons, body}: Ship's bookkeeping, checked in code
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
    maxBeats: beatCeiling(state),
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
      // Below L3 execution a passed task is never merged, so its dependants can
      // never run. That is the human's review point, not a deadlock.
      if (state.tasks.some((t) => t.status === "passed")) {
        terminal = "awaiting_review";
        break;
      }
      // Nothing runnable but not all terminal → everything left is blocked.
      terminal = "stalled";
      await writeInbox(state, "swarm deadlocked: remaining tasks are blocked by failures");
      break;
    }

    // Global caps checked before dispatching a wave.
    if (budget.beats >= budget.maxBeats) { terminal = "max_iterations_exceeded"; break; }
    if ((now() - budget.startedAt) / 60000 >= budget.maxWallClockMin) { terminal = "budget_exceeded"; break; }
    const gate = costGate(state, { costAware });
    if (gate) await writeInbox(state, costGateMessage(state, gate));
    if (gate === "halt") { terminal = "budget_exceeded"; break; }

    const assigned = frontier.slice(0, concurrency);
    const wave = [];
    for (const t of assigned) {
      t.role = resolveRoleForTask(t, state.roles, "maker").name;
      t.worktree = (await assignWorktree({ task: t })) ?? t.worktree;
      // F2: no beat in a worktree whose loop.setup failed — verify would fail on
      // the missing dependencies, not on the task.
      if (t.worktree?.setup_error) {
        t.status = "failed";
        await writeInbox(state, `task ${t.id}: worktree setup failed — ${t.worktree.setup_error}`);
        await audit(`task ${t.id}: failed (worktree setup failed)`);
        continue;
      }
      wave.push(t);
    }
    state.iterations.current = budget.beats;
    await persist(state);

    // Parallel dispatch of the wave. TDD split (if enabled for the task) is
    // resolved per task: the contract phase uses a test-author role, the
    // implementation phase a maker.
    const results = await Promise.all(
      wave.map((t) =>
        processTask(t, {
          verifyCommand, runBeat, runVerify, runChecker, gitHead, changedFiles, now, budget, audit, runSpec, specEvidence,
          roles: state.roles,
          tddSplit: splitForTask(t, state),
        })
      )
    );
    state.iterations.current = budget.beats;

    const spent = results.find((r) => r.outcome === "usage_limit");
    if (spent) {
      const resetNote = spent.resetHint ? ` — resets ${spent.resetHint}` : "";
      await writeInbox(
        state,
        `agent CLI reported a usage/session limit${resetNote}. No work was done that beat; raise the limit or wait, then re-run to resume.`
      );
      await audit(`swarm: usage limit reached${resetNote}`);
    }
    for (const { task, outcome, reason } of results) {
      if (outcome === "usage_limit") continue; // already back to pending
      if (outcome === "escalated") {
        task.status = "failed";
        await writeInbox(state, `task ${task.id} escalated by the Maker (beat ${task.escalation?.beat ?? "?"}): ${reason}`);
        continue;
      }
      if (outcome !== "passed") {
        task.status = "failed";
        await audit(`task ${task.id}: failed (${outcome})`);
      }
    }

    if (spent) {
      terminal = "usage_limit_reached";
      // Tasks that passed in this wave still go through the merge queue below.
    }

    // Serialized, PR-gated merge queue. A collision used to be discovered only
    // HERE — after the worker had burned a beat, passed verify and passed the
    // Checker — and it reached the human as "merge failed: unknown". F7 asks
    // `git merge-tree` the same question against the object store first, so the
    // clean branches in the wave still land and the colliding one is escalated
    // with the exact file list instead of a doomed PR.
    //
    // Strictly additive: no predictor, a thrown predictor, or a "unknown"
    // verdict all leave the queue exactly as it was (wave order, merge
    // attempted). Prediction is an optimisation — the PR-gated merge is still
    // the gate.
    let passed = results.filter((r) => r.outcome === "passed");

    // Unattended Lifecycle step 1: a task bound for an MR is shipped first, the
    // way the owner would type `/ship`: a Ship beat, then verify and the
    // Checker again, then Ship's evidence checked in code. Below L3 there is no
    // MR, so no Ship beat: the branch waits for the human as before.
    if (runShip && planMergeAction({ autonomyLevel: state.autonomy_level, phase: state.phase }) === "pr") {
      const shipped = [];
      for (const r of passed) {
        const t = r.task;
        const s = await runShipStage(t, {
          runShip: () => runShip({ task: t }),
          verify: () => runVerify({ task: t, cmd: t.verify ?? verifyCommand }),
          check: () => (runChecker ? runChecker({ task: t, phase: "ship" }) : { exitCode: 0 }),
          evidence: () => (shipEvidence ? shipEvidence({ task: t }) : { ok: true, reasons: [] }),
          charge: () => {
            budget.beats += 1;
            t.iterations.current += 1;
          },
          beatNo: () => t.iterations.current,
          audit: (m) => audit(`task ${t.id}: ${m}`),
        });
        state.iterations.current = budget.beats;
        if (s.ok) {
          shipped.push(r);
          continue;
        }
        if (s.outcome === "usage_limit") {
          t.status = "pending";
          terminal = "usage_limit_reached";
          await writeInbox(state, `agent CLI reported a usage/session limit${s.resetHint ? ` — resets ${s.resetHint}` : ""} during task ${t.id}'s Ship beat. Re-run to resume.`);
          continue;
        }
        t.status = "failed";
        if (s.outcome === "escalated") {
          t.escalation = { reason: s.reason, beat: t.iterations.current };
          await writeInbox(state, `task ${t.id} escalated by its Ship beat: ${s.reason}`);
        } else {
          await writeInbox(state, `task ${t.id}: the Ship beat did not complete Ship's bookkeeping after ${t.iterations.current} beats: ${s.reason}. Branch ${t.worktree?.branch ?? "(unknown)"} kept, no MR opened.`);
        }
        await audit(`task ${t.id}: failed (ship: ${s.outcome})`);
      }
      passed = shipped;
    }

    // Same gate as the pair: a PR is opened only at L3 execution. Below that the
    // branch is kept for the human and nothing is pushed.
    if (planMergeAction({ autonomyLevel: state.autonomy_level, phase: state.phase }) !== "pr") {
      for (const { task } of passed) {
        task.status = "passed";
        await writeInbox(
          state,
          `task ${task.id} passed — no merge at ${state.autonomy_level} ${state.phase}. Branch ${task.worktree?.branch ?? "(unknown)"} kept for review.`
        );
        await audit(`task ${task.id}: passed, no merge at ${state.autonomy_level} ${state.phase}`);
      }
      await persist(state);
      continue;
    }

    for (const r of passed) {
      if (!predictConflict) continue;
      try {
        r.prediction = await predictConflict({ task: r.task });
      } catch (error) {
        await audit(`task ${r.task.id}: conflict prediction failed (${error?.message ?? "error"}) — merging anyway`);
        r.prediction = null;
      }
    }

    for (const { task, prediction } of orderMergeQueue(passed)) {
      if (!merge) {
        task.status = "failed";
        await writeInbox(state, `task ${task.id} passed but no merge capability`);
        continue;
      }
      if (prediction?.conflicted) {
        // Do NOT open the PR: an unmergeable PR raised unattended is noise the
        // human has to untangle. The branch and its worktree are preserved
        // (teardown never drops unmerged work), so nothing is lost.
        const files = prediction.files?.length ? prediction.files.join(", ") : "(files not reported)";
        task.status = "passed";
        terminal = "awaiting_review";
        await writeInbox(
          state,
          `task ${task.id} would conflict on merge — ${files}. Branch ${task.worktree?.branch ?? "(unknown)"} kept, no PR opened.`
        );
        await audit(`task ${task.id}: predicted merge conflict (${files}) → awaiting_review`);
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
    if (state.tasks.every((t) => t.status === "merged")) terminal = "completed";
    else if (state.tasks.some((t) => t.escalation)) terminal = "escalated";
    else terminal = "stalled";
  }
  state.status = terminal;
  await persist(state);
  log(`[CONDUCTOR SWARM] terminal: ${terminal}`);
  await audit(`swarm terminal: ${terminal}`);
  return state;
}
