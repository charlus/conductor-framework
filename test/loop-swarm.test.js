// test/loop-swarm.test.js
//
// Swarm scheduler + multi-vote Checker (the remaining roadmap work). Pure helpers
// and the full parallel scheduler are exercised with stub IO — no processes, no
// git. Concurrency=1 must reproduce the pair's per-task behavior (regression guard).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runSwarm,
  computeFrontier,
  resolveRoleForTask,
  normalizeRole,
  normalizeTask,
  isBlocked,
} from "../src/loop/swarm.js";
import { tallyVerdicts } from "../src/loop/checker.js";

function swarmState(tasks, overrides = {}) {
  return {
    goal_description: "g",
    autonomy_level: "L3",
    sandbox: "container",
    phase: "execution",
    iterations: { current: 0, max_allowed: overrides.maxBeats ?? 100 },
    budget: { max_wall_clock_min: overrides.maxWall ?? 120, started_at: null },
    concurrency: overrides.concurrency ?? 2,
    roles: overrides.roles ?? ["maker", "checker"],
    tasks: tasks.map((t) => normalizeTask(t)),
  };
}

function swarmDeps(overrides = {}) {
  let clock = 0;
  const heads = new Map();
  return {
    verifyCommand: "run-tests",
    runBeat: overrides.runBeat ?? (async ({ task }) => {
      heads.set(task.id, (heads.get(task.id) ?? 0) + 1); // progress each beat
      return { exitCode: 0 };
    }),
    runVerify: overrides.runVerify ?? (async () => ({ exitCode: 0, output: "green" })),
    runChecker: overrides.runChecker ?? (async () => ({ exitCode: 0 })),
    merge: overrides.merge ?? (async ({ task }) => ({ ok: true, branch: `b/${task.id}`, prUrl: `http://pr/${task.id}` })),
    gitHead: async ({ task }) => `sha-${task.id}-${heads.get(task.id) ?? 0}`,
    assignWorktree: async ({ task }) => ({ path: `/wt/${task.id}`, branch: `b/${task.id}` }),
    now: () => (clock += 1000),
    persist: async () => {},
    audit: async () => {},
    writeInbox: async () => {},
    log: () => {},
  };
}

// ---- Pure helpers ---------------------------------------------------------

test("normalizeRole: strings and objects → descriptors", () => {
  assert.deepEqual(normalizeRole("maker"), { name: "maker", archetype: "maker", persona: null, claims: [] });
  assert.equal(normalizeRole("db-maker").archetype, "maker");
  assert.equal(normalizeRole("security-checker").archetype, "checker");
  const o = normalizeRole({ name: "db-maker", archetype: "maker", persona: "database-architect", claims: ["schema"] });
  assert.deepEqual(o.claims, ["schema"]);
});

test("resolveRoleForTask: specialized claim beats generic", () => {
  const roles = [
    { name: "db-maker", archetype: "maker", claims: ["schema", "migration"] },
    { name: "logic-maker", archetype: "maker", claims: [] },
    { name: "security-checker", archetype: "checker", claims: ["auth"] },
  ];
  assert.equal(resolveRoleForTask({ type: "schema" }, roles, "maker").name, "db-maker");
  assert.equal(resolveRoleForTask({ type: "widget" }, roles, "maker").name, "logic-maker");
  assert.equal(resolveRoleForTask({ type: "auth" }, roles, "checker").name, "security-checker");
});

test("computeFrontier: only pending tasks whose deps are all merged", () => {
  const tasks = [
    { id: "a", status: "merged", deps: [] },
    { id: "b", status: "pending", deps: ["a"] },
    { id: "c", status: "pending", deps: ["b"] }, // blocked: b not merged
    { id: "d", status: "pending", deps: [] },
  ].map((t) => normalizeTask(t));
  const frontier = computeFrontier(tasks).map((t) => t.id);
  assert.deepEqual(frontier, ["b", "d"]);
});

test("isBlocked: a failed dependency blocks a task", () => {
  const byId = new Map([["a", normalizeTask({ id: "a", status: "failed" })]]);
  assert.equal(isBlocked(normalizeTask({ id: "b", deps: ["a"] }), byId), true);
});

// ---- Multi-vote Checker ----------------------------------------------------

test("tallyVerdicts: strict majority approves; tie/minority rejects", () => {
  const yes = { approved: true };
  const no = { approved: false };
  assert.equal(tallyVerdicts([yes], 1).approved, true);
  assert.equal(tallyVerdicts([yes, yes, no], 3).approved, true); // 2/3
  assert.equal(tallyVerdicts([yes, no], 2).approved, false); // tie fails safe
  assert.equal(tallyVerdicts([yes], 3).approved, false); // 2 missing votes count as reject
  assert.equal(tallyVerdicts([], 1).approved, false);
});

// ---- Full scheduler --------------------------------------------------------

test("swarm: independent tasks all merge → completed", async () => {
  const state = swarmState([
    { id: "t1", type: "schema" },
    { id: "t2", type: "ui" },
    { id: "t3", type: "logic" },
  ]);
  const final = await runSwarm(state, swarmDeps());
  assert.equal(final.status, "completed");
  assert.ok(final.tasks.every((t) => t.status === "merged"));
});

test("swarm: respects dependencies (dependent runs only after dep merges)", async () => {
  const order = [];
  const state = swarmState([
    { id: "base", type: "schema", deps: [] },
    { id: "dependent", type: "logic", deps: ["base"] },
  ]);
  const deps = swarmDeps({
    runBeat: async ({ task }) => {
      order.push(task.id);
      return { exitCode: 0 };
    },
  });
  const final = await runSwarm(state, deps);
  assert.equal(final.status, "completed");
  assert.ok(order.indexOf("base") < order.indexOf("dependent"), "base must run before dependent");
});

test("swarm: a task failing its ceiling cascades to block dependents", async () => {
  const state = swarmState(
    [
      { id: "base", type: "schema", deps: [], iterations: { current: 0, max_allowed: 2 } },
      { id: "child", type: "logic", deps: ["base"] },
    ],
    { concurrency: 1 }
  );
  // base can never pass (verify always red) → fails ceiling → child blocked.
  const deps = swarmDeps({ runVerify: async ({ task }) => ({ exitCode: task.id === "base" ? 1 : 0, output: "x" }) });
  const final = await runSwarm(state, deps);
  assert.equal(final.status, "stalled");
  const base = final.tasks.find((t) => t.id === "base");
  const child = final.tasks.find((t) => t.id === "child");
  assert.equal(base.status, "failed");
  assert.equal(child.status, "failed"); // blocked by failed dep
});

test("swarm: green-but-Checker-rejects never merges (necessary-but-not-sufficient)", async () => {
  const state = swarmState([{ id: "t1", type: "logic", iterations: { current: 0, max_allowed: 2 } }], { concurrency: 1 });
  let merges = 0;
  const deps = swarmDeps({
    runChecker: async () => ({ exitCode: 1 }), // always reject
    merge: async () => (merges++, { ok: true }),
  });
  const final = await runSwarm(state, deps);
  assert.equal(merges, 0);
  assert.equal(final.tasks[0].status, "failed");
});

test("swarm: a failed merge pauses and escalates to awaiting_review", async () => {
  const state = swarmState([{ id: "t1", type: "logic" }], { concurrency: 1 });
  const deps = swarmDeps({ merge: async () => ({ ok: false, reason: "conflict" }) });
  const final = await runSwarm(state, deps);
  assert.equal(final.status, "awaiting_review");
});

test("swarm: global iteration ceiling stops the whole run", async () => {
  const state = swarmState([{ id: "t1", type: "a" }, { id: "t2", type: "b" }], { concurrency: 1, maxBeats: 1 });
  // verify always red so tasks keep retrying and burn the global budget.
  const deps = swarmDeps({ runVerify: async () => ({ exitCode: 1, output: "x" }) });
  const final = await runSwarm(state, deps);
  assert.ok(["max_iterations_exceeded", "stalled"].includes(final.status));
});

test("swarm honors preflight gates — L1 + concurrency>1 halts before any beat", async () => {
  let beats = 0;
  const state = swarmState([{ id: "t1", type: "a" }], { concurrency: 3 });
  state.autonomy_level = "L1"; // concurrency>1 requires L3
  const deps = swarmDeps({ runBeat: async () => (beats++, { exitCode: 0 }) });
  const final = await runSwarm(state, deps);
  assert.equal(final.status, "halted_autonomy");
  assert.equal(beats, 0);
});

test("swarm honors the sandbox gate — L3 without a container halts before any beat", async () => {
  let beats = 0;
  const state = swarmState([{ id: "t1", type: "a" }], { concurrency: 2 });
  state.sandbox = "none";
  const deps = swarmDeps({ runBeat: async () => (beats++, { exitCode: 0 }) });
  const final = await runSwarm(state, deps);
  assert.equal(final.status, "halted_sandbox_required");
  assert.equal(beats, 0);
});

test("swarm concurrency=1 reproduces per-task pair behavior (regression guard)", async () => {
  const state = swarmState([{ id: "solo", type: "logic" }], { concurrency: 1 });
  const final = await runSwarm(state, swarmDeps());
  assert.equal(final.status, "completed");
  assert.equal(final.tasks[0].status, "merged");
  assert.equal(final.tasks[0].iterations.current, 1); // one beat, like the pair
});
