// test/loop-driver.test.js
//
// Phase 1 acceptance: the driver's guarantees hold even against a deliberately
// misbehaving stub agent. No `claude` process is spawned — the adapter, verify
// runner, git HEAD, and clock are all injected. See Autonomous-Loop-Backend.md
// "Test harness (Phase 1 acceptance)".

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runLoop,
  normalizeState,
  resolveVerifyCommand,
  statusAfterVerify,
  computeStallHash,
  isTerminal,
} from "../src/loop/driver.js";

/** Build normalized state + a deps harness with sensible test defaults. */
function harness(overrides = {}) {
  const state = normalizeState({
    phase: "execution",
    status: "idle",
    goal_description: "test goal",
    // Multi-beat guardrail tests need a level that permits multiple beats.
    autonomy_level: "L3",
    sandbox: "container",
    iterations: { current: 0, max_allowed: overrides.max_allowed ?? 20 },
    budget: { max_wall_clock_min: overrides.max_wall_clock_min ?? 120 },
    ...overrides.state,
  });

  const persisted = [];
  let headCounter = 0;
  let clock = 0;

  const deps = {
    verifyCommand: overrides.verifyCommand === undefined ? "run-tests" : overrides.verifyCommand,
    runBeat: overrides.runBeat ?? (async () => ({ exitCode: 0, stdout: "", tokens: 0 })),
    runVerify: overrides.runVerify ?? (async () => ({ exitCode: 0, output: "ok" })),
    // Changing HEAD each beat by default so the anti-stall path doesn't fire.
    gitHead: overrides.gitHead ?? (async () => `sha-${headCounter++}`),
    merge: overrides.merge ?? (async () => ({ ok: true, branch: "b", prUrl: "http://pr" })),
    now: overrides.now ?? (() => (clock += 1000)),
    // Only set when a test exercises the empty-done guard; absent ⇒ guard skipped.
    branchHasWork: overrides.branchHasWork,
    persist: async (s) => persisted.push(s.status),
    writeInbox: async () => {},
    log: () => {},
  };

  return { state, deps, persisted };
}

// ---- Pure helpers ---------------------------------------------------------

test("statusAfterVerify: red exit forces reject, green is eligible to pass", () => {
  assert.equal(statusAfterVerify(1), "rejected_by_checker");
  assert.equal(statusAfterVerify(0), "passed_by_checker");
});

test("resolveVerifyCommand mirrors conductor_verify_cmd order", () => {
  assert.equal(resolveVerifyCommand({ stateCommand: "pytest", configVerify: "x", hasNpmTestScript: true }), "pytest");
  assert.equal(resolveVerifyCommand({ stateCommand: "", configVerify: "make check", hasNpmTestScript: true }), "make check");
  assert.equal(resolveVerifyCommand({ stateCommand: "", configVerify: "", hasNpmTestScript: true }), "npm test");
  assert.equal(resolveVerifyCommand({ stateCommand: "", configVerify: "", hasNpmTestScript: false }), null);
});

test("computeStallHash ignores tool detail — only git HEAD + verify output", () => {
  const a = computeStallHash({ gitHead: "h1", verifyOutput: "o1" });
  const b = computeStallHash({ gitHead: "h1", verifyOutput: "o1" });
  const c = computeStallHash({ gitHead: "h2", verifyOutput: "o1" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("normalizeState migrates v1 telemetry into v2 stall/budget", () => {
  const s = normalizeState({
    telemetry: { tokens_spent: 42, consecutive_stalls: 2 },
    current_task: "legacy",
  });
  assert.equal(s.schema_version, 2);
  assert.equal(s.budget.tokens_spent, 42);
  assert.equal(s.stall.consecutive, 2);
  assert.deepEqual(s.roles, ["maker", "checker"]);
});

// ---- (a) ceiling stop -----------------------------------------------------

test("(a) stops at the iteration ceiling regardless of agent behaviour", async () => {
  // Maker always claims success, but verify always fails → endless retries,
  // capped by the ceiling the driver owns.
  const { state, deps } = harness({
    max_allowed: 3,
    runBeat: async ({ state }) => {
      state.maker_reported_done = true; // lying stub
      return { exitCode: 0 };
    },
    runVerify: async () => ({ exitCode: 1, output: "boom" }),
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "max_iterations_exceeded");
  assert.equal(final.iterations.current, 3);
  assert.ok(isTerminal(final.status));
});

// ---- (b) stall stop -------------------------------------------------------

test("(b) stops after 3 no-progress beats (constant HEAD + verify output)", async () => {
  const { state, deps } = harness({
    max_allowed: 50,
    gitHead: async () => "frozen-sha", // no progress ever
    runVerify: async () => ({ exitCode: 1, output: "same-failure" }),
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "stalled");
  assert.equal(final.stall.consecutive, 3);
});

// ---- (c) red verification overrides a lying "success" claim ---------------

test("(c) a red verification forces reject even when the stub claims done", async () => {
  const statuses = [];
  const { state, deps } = harness({
    max_allowed: 2,
    runBeat: async ({ state }) => {
      state.maker_reported_done = true; // agent insists it is finished
      return { exitCode: 0, stdout: "all done!!" };
    },
    runVerify: async () => ({ exitCode: 2, output: "tests red" }),
  });
  deps.persist = async (s) => statuses.push(s.status);
  const final = await runLoop(state, deps);
  assert.notEqual(final.status, "completed"); // the key guarantee
  assert.equal(final.status, "max_iterations_exceeded");
  assert.ok(!statuses.includes("completed"));
  assert.ok(statuses.includes("rejected_by_checker"));
});

// ---- (d) Scoping Barrier --------------------------------------------------

test("(d) discovery phase halts before any beat runs", async () => {
  let beats = 0;
  const { state, deps } = harness({
    state: { phase: "discovery" },
    runBeat: async () => {
      beats++;
      return { exitCode: 0 };
    },
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "halted_scoping");
  assert.equal(beats, 0);
});

// ---- (e) wall-clock budget stop -------------------------------------------

test("(e) wall-clock budget stops the loop before dispatching a beat", async () => {
  let beats = 0;
  // First now() call stamps started_at (t=0); the next (budget check) is +2 min.
  let ticks = 0;
  const { state, deps } = harness({
    max_wall_clock_min: 1,
    now: () => (ticks++ === 0 ? 0 : 2 * 60000),
    runBeat: async () => {
      beats++;
      return { exitCode: 0 };
    },
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "budget_exceeded");
  assert.equal(beats, 0);
});

// ---- (f) no verification configured → fail safe ---------------------------

test("(f) no resolvable verify command halts before any beat", async () => {
  let beats = 0;
  const { state, deps } = harness({
    verifyCommand: null,
    runBeat: async () => {
      beats++;
      return { exitCode: 0 };
    },
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "halted_no_verification");
  assert.equal(beats, 0);
});

// ---- (g) happy path: green verify + reported done → completed -------------

test("(g) green verification with maker_reported_done reaches completed", async () => {
  const { state, deps } = harness({
    runBeat: async ({ state }) => {
      state.maker_reported_done = true;
      return { exitCode: 0 };
    },
    runVerify: async () => ({ exitCode: 0, output: "green" }),
  });
  const final = await runLoop(state, deps);
  assert.equal(final.status, "completed");
  assert.equal(final.verification.last_exit_code, 0);
  assert.equal(final.iterations.current, 1);
});

// ---- (h) empty done-claim guard: reported done but no committed work -------
// Defense-in-depth for the "done-claimed-but-no-commit" gap. Even with green
// verify AND (here) no Checker to catch it, a done-claim on a branch that carries
// no committed work must NEVER open a PR — there is nothing to ship. The driver
// re-prompts a maker beat; the stall detector bounds a maker that keeps lying.

test("(h) L3 done-claim with no committed work is never merged — re-prompts, then bounds out", async () => {
  let mergeCalls = 0;
  const { state, deps } = harness({
    gitHead: async () => "sha-const", // maker never lands a commit…
    runBeat: async ({ state }) => {
      state.maker_reported_done = true; // …but insists it's done every beat
      return { exitCode: 0 };
    },
    runVerify: async () => ({ exitCode: 0, output: "green" }),
    merge: async () => {
      mergeCalls++;
      return { ok: true, branch: "b", prUrl: "http://pr" };
    },
    branchHasWork: async () => false, // the branch has no unique commits
  });
  const final = await runLoop(state, deps);
  assert.equal(mergeCalls, 0, "must never open a PR for an empty done-claim");
  assert.notEqual(final.status, "completed");
  assert.ok(isTerminal(final.status), "the run must terminate (bounded), not loop forever");
  assert.equal(final.status, "stalled"); // constant HEAD + verify → stall detector fires
});

// ---- (i) the guard does NOT false-block real work -------------------------

test("(i) L3 done-claim WITH committed work still merges to completed", async () => {
  let mergeCalls = 0;
  const { state, deps } = harness({
    runBeat: async ({ state }) => {
      state.maker_reported_done = true;
      return { exitCode: 0 };
    },
    runVerify: async () => ({ exitCode: 0, output: "green" }),
    merge: async () => {
      mergeCalls++;
      return { ok: true, branch: "b", prUrl: "http://pr" };
    },
    branchHasWork: async () => true, // real commits on the branch
  });
  const final = await runLoop(state, deps);
  assert.equal(mergeCalls, 1);
  assert.equal(final.status, "completed");
});
