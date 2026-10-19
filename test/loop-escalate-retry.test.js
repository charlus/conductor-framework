// test/loop-escalate-retry.test.js
//
// Field findings from the first unattended crossing (eurassistant CHORE-2,
// 2026-10-19, docs/roadmap/Unattended-Crossing.md):
//   F3  the Maker said "blocked" in beat 1 and the loop ran nine more beats: it
//       needs an escalate signal that ends the run and reaches the human.
//   F8  the swarm hashed raw verify output for stall detection, so pytest's
//       "in 9.54s" changed the hash every beat and the guard never fired.
//   A13 a retry never received the reason it was rejected.
//   F4  `glab mr create --fill` pushes again and re-runs the push gate.
//   F5  a failed forge command lost its error text.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runSwarm, normalizeTask } from "../src/loop/swarm.js";
import { runLoop, normalizeState, TERMINAL_STATUSES } from "../src/loop/driver.js";
import { renderAssignment, renderAttempts } from "../src/loop/harvester.js";
import { prCommand, openPullRequest } from "../src/loop/merge.js";
import { parseLoopConfig, withRoleModels } from "../src/loop/config.js";

function swarmState(tasks, overrides = {}) {
  return {
    goal_description: "g",
    autonomy_level: "L3",
    sandbox: "container",
    phase: "execution",
    iterations: { current: 0, max_allowed: 100 },
    budget: { max_wall_clock_min: 120, started_at: null },
    concurrency: 1,
    roles: ["maker", "checker"],
    tasks: tasks.map((t) => normalizeTask(t)),
    ...overrides,
  };
}

function swarmDeps(overrides = {}) {
  let clock = 0;
  const inbox = [];
  const deps = {
    verifyCommand: "run-tests",
    runBeat: async () => ({ exitCode: 0 }),
    runVerify: async () => ({ exitCode: 0, output: "green" }),
    runChecker: async () => ({ exitCode: 0 }),
    merge: async ({ task }) => ({ ok: true, branch: `b/${task.id}`, prUrl: `http://pr/${task.id}` }),
    gitHead: async () => "sha",
    assignWorktree: async ({ task }) => ({ path: `/wt/${task.id}`, branch: `b/${task.id}` }),
    now: () => (clock += 1000),
    persist: async () => {},
    audit: async () => {},
    writeInbox: async (_s, reason) => inbox.push(reason),
    log: () => {},
    ...overrides,
  };
  return { deps, inbox };
}

// ---- F3: escalate ---------------------------------------------------------

test("swarm: a Maker that escalates ends its task after one beat, and its reason reaches the inbox", async () => {
  let beats = 0;
  let verified = 0;
  let checked = 0;
  const { deps, inbox } = swarmDeps({
    runBeat: async () => {
      beats += 1;
      return { exitCode: 0, signal: { escalate: true, reason: "poetry lock needs approval in a headless beat" } };
    },
    runVerify: async () => ((verified += 1), { exitCode: 0, output: "green" }),
    runChecker: async () => ((checked += 1), { exitCode: 0 }),
  });
  const s = await runSwarm(swarmState([{ id: "a" }]), deps);
  assert.equal(beats, 1);
  assert.equal(verified, 0, "an escalated beat is not verified");
  assert.equal(checked, 0, "an escalated beat costs no Checker");
  assert.equal(s.status, "escalated");
  assert.equal(s.tasks[0].status, "failed");
  assert.match(s.tasks[0].escalation.reason, /poetry lock/);
  assert.ok(inbox.some((l) => /a/.test(l) && /poetry lock needs approval/.test(l)));
});

test("pair: a Maker that escalates ends the run as escalated, with no verify and no Checker", async () => {
  const inbox = [];
  let verified = 0;
  let checked = 0;
  let clock = 0;
  const state = normalizeState({ phase: "execution", status: "idle", autonomy_level: "L3", sandbox: "container" });
  const final = await runLoop(state, {
    verifyCommand: "run-tests",
    runBeat: async () => ({ exitCode: 0 }),
    readMakerSignal: async () => ({ escalate: true, reason: "cannot install the new SDK" }),
    runVerify: async () => ((verified += 1), { exitCode: 0, output: "ok" }),
    runChecker: async () => ((checked += 1), { exitCode: 0 }),
    gitHead: async () => "sha",
    now: () => (clock += 1000),
    persist: async () => {},
    writeInbox: async (_s, reason) => inbox.push(reason),
    log: () => {},
  });
  assert.equal(final.status, "escalated");
  assert.ok(TERMINAL_STATUSES.includes("escalated"));
  assert.equal(verified, 0);
  assert.equal(checked, 0);
  assert.ok(inbox.some((l) => /cannot install the new SDK/.test(l)));
});

// ---- F8: swarm stall hash ignores runner timings --------------------------

test("swarm: beats whose verify output differs only in timing count as a stall", async () => {
  let n = 0;
  let beats = 0;
  const { deps } = swarmDeps({
    runBeat: async () => ((beats += 1), { exitCode: 0 }),
    runVerify: async () => ({ exitCode: 1, output: `1 failed, 639 passed in ${(9 + (n++ % 7) / 10).toFixed(2)}s` }),
  });
  const s = await runSwarm(swarmState([{ id: "a" }]), deps);
  assert.equal(s.tasks[0].status, "failed");
  assert.ok(beats <= 5, `stall guard must fire after 3 beats with no progress, ran ${beats}`);
});

// ---- A13: the next beat receives the rejection ----------------------------

test("swarm: the second beat receives the first beat's Checker reason and verify tail", async () => {
  const seen = [];
  let round = 0;
  const { deps } = swarmDeps({
    runBeat: async ({ task }) => (seen.push(structuredClone(task.attempts ?? [])), { exitCode: 0 }),
    gitHead: async () => `sha-${round}`,
    runVerify: async () => ({ exitCode: 0, output: "all green" }),
    runChecker: async () => {
      round += 1;
      return round === 1
        ? { exitCode: 1, reasons: ["Only pyproject.toml changed; poetry.lock still pins the old SDK"], findings: [{ severity: "BLOCKER", quote: "poetry.lock" }] }
        : { exitCode: 0 };
    },
  });
  const s = await runSwarm(swarmState([{ id: "a" }]), deps);
  assert.equal(s.tasks[0].status, "merged");
  assert.deepEqual(seen[0], []);
  assert.equal(seen[1].length, 1);
  assert.equal(seen[1][0].beat, 1);
  assert.equal(seen[1][0].verify_exit, 0);
  assert.match(seen[1][0].checker_reason, /poetry.lock still pins/);
  assert.equal(seen[1][0].checker_findings.length, 1);
});

test("swarm: a red verify is recorded too, and only the last 3 attempts are kept", async () => {
  let beats = 0;
  const { deps } = swarmDeps({
    runBeat: async () => ((beats += 1), { exitCode: 0 }),
    gitHead: async () => `sha-${beats}`,
    runVerify: async () => ({ exitCode: 1, output: `FAILED test_${beats}` }),
  });
  const state = swarmState([{ id: "a", iterations: { current: 0, max_allowed: 5 } }]);
  const s = await runSwarm(state, deps);
  const attempts = s.tasks[0].attempts;
  assert.equal(attempts.length, 3);
  assert.deepEqual(attempts.map((a) => a.beat), [3, 4, 5]);
  assert.equal(attempts[2].verify_exit, 1);
  assert.match(attempts[2].verify_tail, /FAILED test_5/);
});

test("renderAttempts bounds what it passes on and wraps it as untrusted", () => {
  const long = Array.from({ length: 200 }, (_, i) => `line ${i} ${"x".repeat(60)}`).join("\n");
  const out = renderAttempts([{ beat: 1, verify_exit: 1, verify_tail: long, checker_reason: null, checker_findings: [] }]);
  assert.match(out, /Previous attempts were rejected/);
  assert.match(out, /DATA/); // inside the untrusted envelope
  assert.ok(out.includes("line 199"));
  assert.ok(!out.includes("line 100 "), "only the tail of the verify output is kept");
  assert.ok(out.length < 6000);
  assert.equal(renderAttempts([]), "");
});

test("renderAssignment includes the attempts and tells the Maker how to escalate", () => {
  const text = renderAssignment({
    id: "bugfix:x",
    type: "bugfix",
    title: "Fix x",
    attempts: [{ beat: 1, verify_exit: 0, checker_reason: "half-migrated", checker_findings: [] }],
  });
  assert.match(text, /Previous attempts were rejected/);
  assert.match(text, /half-migrated/);
  assert.match(text, /"escalate": true/);
});

// ---- A13: escalation model after two rejections ---------------------------

test("swarm: after two rejected beats the next beat asks for the escalation model", async () => {
  const flags = [];
  let round = 0;
  const { deps } = swarmDeps({
    runBeat: async (o) => (flags.push(o.escalateModel === true), { exitCode: 0 }),
    gitHead: async () => `sha-${round}`,
    runChecker: async () => ((round += 1), { exitCode: round <= 2 ? 1 : 0, reasons: ["no"] }),
  });
  await runSwarm(swarmState([{ id: "a" }]), deps);
  assert.deepEqual(flags, [false, false, true]);
});

test("loop.models.maker_escalation is accepted and used only when a beat asks for it", async () => {
  const c = parseLoopConfig({ loop: { models: { maker: "sonnet", maker_escalation: "opus" } } });
  assert.deepEqual(c.errors, []);
  assert.equal(c.models.maker_escalation, "opus");
  const seen = [];
  const wrapped = withRoleModels({ name: "claude", runBeat: async (o) => seen.push(o.model), runChecker: async () => {} }, c.models);
  await wrapped.runBeat({});
  await wrapped.runBeat({ escalateModel: true });
  assert.deepEqual(seen, ["sonnet", "opus"]);
});

// ---- F4 / F5: the MR step --------------------------------------------------

test("glab opens the MR without --fill, which would push and run the push gate again", () => {
  const [, argv] = prCommand("glab", { branch: "b", title: "t", body: "d" });
  assert.ok(!argv.includes("--fill"));
  assert.ok(!argv.includes("--push"));
  assert.ok(argv.includes("--yes"));
  assert.equal(argv[argv.indexOf("--description") + 1], "d");
  assert.equal(argv[argv.indexOf("--title") + 1], "t");
});

test("a failed push keeps git's error text in the reason", async () => {
  const res = await openPullRequest({
    branch: "b",
    title: "t",
    forge: "gh",
    git: async () => ({ ok: false, stdout: "", stderr: "fatal: 'origin' does not appear to be a git repository" }),
    run: async () => ({ ok: true, stdout: "http://pr" }),
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /'origin' does not appear to be a git repository/);
});

test("a failed forge command keeps its error text in the reason", async () => {
  const res = await openPullRequest({
    branch: "b",
    title: "t",
    forge: "glab",
    git: async () => ({ ok: true, stdout: "" }),
    run: async () => ({ ok: false, stdout: "", stderr: "403 Forbidden: you cannot create merge requests in this project" }),
  });
  assert.equal(res.ok, false);
  assert.match(res.reason, /403 Forbidden: you cannot create merge requests/);
});
