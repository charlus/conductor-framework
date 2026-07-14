// test/loop-phase3.test.js
//
// Phase 3 acceptance: sandbox gate, the independent Checker (necessary-but-not-
// sufficient), worktree lifecycle, and the fail-safe verdict contract. All pure /
// stub-injected — no container, no git repo, no agent CLI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runLoop, normalizeState, preflight } from "../src/loop/driver.js";
import { parseCheckerVerdict, verdictToExitCode } from "../src/loop/checker.js";
import {
  slugify,
  worktreePlan,
  createWorktree,
  teardownWorktree,
} from "../src/loop/worktree.js";

function harness(overrides = {}) {
  const state = normalizeState({
    phase: "execution",
    status: "idle",
    goal_description: "test goal",
    autonomy_level: "L3",
    sandbox: "container",
    iterations: { current: 0, max_allowed: overrides.max_allowed ?? 20 },
    ...overrides.state,
  });
  let headCounter = 0;
  let clock = 0;
  const deps = {
    verifyCommand: overrides.verifyCommand === undefined ? "run-tests" : overrides.verifyCommand,
    runBeat: overrides.runBeat ?? (async ({ state }) => {
      state.maker_reported_done = true;
      return { exitCode: 0 };
    }),
    runVerify: overrides.runVerify ?? (async () => ({ exitCode: 0, output: "green" })),
    runChecker: overrides.runChecker, // may be undefined
    merge: overrides.merge ?? (async () => ({ ok: true, branch: "b", prUrl: "http://pr" })),
    gitHead: async () => `sha-${headCounter++}`,
    now: () => (clock += 1000),
    persist: async () => {},
    writeInbox: async () => {},
    log: () => {},
  };
  return { state, deps };
}

// ---- Sandbox gate ---------------------------------------------------------

test("preflight: L3 without a container sandbox is refused", () => {
  const s = normalizeState({ phase: "execution", autonomy_level: "L3", sandbox: "none" });
  assert.equal(preflight(s, { verifyCommand: "x" }), "halted_sandbox_required");
});

test("preflight: L3 WITH a container sandbox is allowed", () => {
  const s = normalizeState({ phase: "execution", autonomy_level: "L3", sandbox: "container" });
  assert.equal(preflight(s, { verifyCommand: "x" }), null);
});

test("preflight: L1 without a sandbox is fine (gate only applies to L3)", () => {
  const s = normalizeState({ phase: "execution", autonomy_level: "L1", sandbox: "none" });
  assert.equal(preflight(s, { verifyCommand: "x" }), null);
});

test("runLoop halts an L3/no-sandbox run before any beat", async () => {
  let beats = 0;
  const { state, deps } = harness({
    state: { autonomy_level: "L3", sandbox: "none" },
    runBeat: async () => {
      beats++;
      return { exitCode: 0 };
    },
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "halted_sandbox_required");
  assert.equal(beats, 0);
});

// ---- Independent Checker: necessary-but-not-sufficient ---------------------

test("green verify but Checker REJECTS → rejected_by_checker (not completed)", async () => {
  const statuses = [];
  const { state, deps } = harness({
    max_allowed: 2,
    runChecker: async () => ({ exitCode: 1 }), // Checker refuses the green diff
  });
  deps.persist = async (s) => statuses.push(s.status);
  const final = await runLoop(state, deps);
  assert.notEqual(final.status, "completed"); // green tests are not enough
  assert.ok(statuses.includes("rejected_by_checker"));
});

test("green verify AND Checker APPROVES → completed", async () => {
  const { state, deps } = harness({
    runChecker: async () => ({ exitCode: 0 }),
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "completed");
});

test("red verify short-circuits: Checker is never consulted", async () => {
  let checkerCalls = 0;
  const { state, deps } = harness({
    max_allowed: 1,
    runVerify: async () => ({ exitCode: 1, output: "red" }),
    runChecker: async () => {
      checkerCalls++;
      return { exitCode: 0 };
    },
  });
  await runLoop(state, deps);
  assert.equal(checkerCalls, 0); // the red floor decides alone
});

// ---- Verdict contract (fail-safe) -----------------------------------------

test("parseCheckerVerdict: explicit approval", () => {
  const v = parseCheckerVerdict('{"approved": true, "reason": "looks complete"}');
  assert.equal(v.approved, true);
  assert.equal(verdictToExitCode(v), 0);
});

test("parseCheckerVerdict: missing / empty / malformed all reject", () => {
  for (const bad of [null, "", "   ", "not json", "{}", '{"approved": false}', '{"approved": "yes"}']) {
    const v = parseCheckerVerdict(bad);
    assert.equal(v.approved, false, `should reject: ${JSON.stringify(bad)}`);
    assert.equal(verdictToExitCode(v), 1);
  }
});

// ---- Worktree lifecycle (stub git) ----------------------------------------

test("slugify + worktreePlan are deterministic and bounded", () => {
  assert.equal(slugify("Implement OAuth Login!!"), "implement-oauth-login");
  assert.equal(slugify(""), "loop");
  const plan = worktreePlan("/repo", "Add search");
  assert.equal(plan.branch, "conductor/loop/add-search");
  assert.ok(plan.path.endsWith("/.agents/.worktrees/add-search"));
});

test("createWorktree: creates a new branch, and is idempotent on reuse", async () => {
  const calls = [];
  const gitNew = async (args) => {
    calls.push(args.join(" "));
    if (args[0] === "worktree" && args[1] === "list") return { ok: true, stdout: "" };
    return { ok: true, stdout: "" };
  };
  const created = await createWorktree({ root: "/repo", goalDescription: "Add search", git: gitNew });
  assert.equal(created.created, true);
  assert.ok(calls.some((c) => c.startsWith("worktree add -b conductor/loop/add-search")));

  const gitExisting = async (args) =>
    args[1] === "list"
      ? { ok: true, stdout: "worktree /repo/.agents/.worktrees/add-search" }
      : { ok: true, stdout: "" };
  const reused = await createWorktree({ root: "/repo", goalDescription: "Add search", git: gitExisting });
  assert.equal(reused.created, false);
});

test("teardownWorktree: keeps a worktree with unmerged commits, removes a clean one", async () => {
  const path = "/repo/.agents/.worktrees/add-search";
  const gitDirty = async (args) => {
    if (args[1] === "list") return { ok: true, stdout: `worktree ${path}` };
    if (args[0] === "rev-list") return { ok: true, stdout: "3" }; // 3 unique commits
    return { ok: true, stdout: "" };
  };
  const kept = await teardownWorktree({ root: "/repo", goalDescription: "Add search", git: gitDirty });
  assert.equal(kept.removed, false);
  assert.match(kept.reason, /unmerged commits/);

  const gitClean = async (args) => {
    if (args[1] === "list") return { ok: true, stdout: `worktree ${path}` };
    if (args[0] === "rev-list") return { ok: true, stdout: "0" };
    if (args[0] === "worktree" && args[1] === "remove") return { ok: true, stdout: "" };
    return { ok: true, stdout: "" };
  };
  const removed = await teardownWorktree({ root: "/repo", goalDescription: "Add search", git: gitClean });
  assert.equal(removed.removed, true);
});
