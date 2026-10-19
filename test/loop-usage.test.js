// test/loop-usage.test.js
//
// A14 (docs/roadmap/Superlite-Imports.md): nobody knew what a loop run cost.
// Every adapter returned `tokens: 0`. The claude adapter now reads the JSON
// result of `claude -p --output-format json`; one accounting point records each
// Maker and Checker beat; `loop.cost_aware` (off by default, owner D2/D3) is the
// only thing that ever acts on cost. Also: the swarm counted a spent quota as a
// rejected attempt, where the pair halts with usage_limit_reached.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArgv, parseClaudeResult } from "../src/loop/adapters/claude.js";
import { recordUsage, costGate, usageSummary } from "../src/loop/usage.js";
import { runSwarm, normalizeTask } from "../src/loop/swarm.js";
import { runLoop, normalizeState } from "../src/loop/driver.js";
import { startNewRun } from "../src/loop/resume.js";
import { parseLoopConfig } from "../src/loop/config.js";

const RESULT = JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "Done. Committed the migration.",
  total_cost_usd: 0.4213,
  duration_ms: 51234,
  usage: { input_tokens: 1200, output_tokens: 3400, cache_creation_input_tokens: 20000, cache_read_input_tokens: 90000 },
  modelUsage: { "claude-sonnet-5-5": { costUSD: 0.4213 } },
});

test("the claude adapter asks for the JSON result", () => {
  const argv = buildArgv({ prompt: "p" });
  assert.equal(argv[argv.indexOf("--output-format") + 1], "json");
});

test("parseClaudeResult reads the text, tokens, cost and model", () => {
  const r = parseClaudeResult(RESULT);
  assert.equal(r.text, "Done. Committed the migration.");
  assert.equal(r.tokens, 1200 + 3400 + 20000 + 90000);
  assert.equal(r.costUsd, 0.4213);
  assert.equal(r.model, "claude-sonnet-5-5");
});

test("parseClaudeResult fails open on anything that is not a result object", () => {
  assert.equal(parseClaudeResult("You've hit your session limit · resets 3:00pm"), null);
  assert.equal(parseClaudeResult(""), null);
  assert.equal(parseClaudeResult("[1,2]"), null);
  assert.equal(parseClaudeResult('{"type":"system"}'), null);
});

test("recordUsage adds each beat to its role and to the run total; unknown cost stays unknown", () => {
  const state = normalizeState({});
  recordUsage(state, { role: "maker", result: { tokens: 1000, costUsd: 0.25 } });
  recordUsage(state, { role: "checker", result: { tokens: 500, costUsd: 0.5 } });
  recordUsage(state, { role: "maker", result: { tokens: null, costUsd: null } });
  assert.deepEqual(state.budget.usage.maker, { beats: 2, tokens: 1000, cost_usd: 0.25, unknown: 1 });
  assert.deepEqual(state.budget.usage.checker, { beats: 1, tokens: 500, cost_usd: 0.5, unknown: 0 });
  assert.equal(state.budget.tokens_spent, 1500);
  assert.equal(state.budget.cost_usd_spent, 0.75);
  assert.match(usageSummary(state), /\$0\.75/);
  assert.match(usageSummary(state), /maker 2 beats \$0\.25/);
});

test("costGate acts only with loop.cost_aware: warn once at 70%, halt at 100%", () => {
  const s = normalizeState({ budget: { max_cost_usd: 1 } });
  s.budget.cost_usd_spent = 5;
  assert.equal(costGate(s, { costAware: false }), null, "off by default: cost never acts");
  s.budget.cost_usd_spent = 0.71;
  assert.equal(costGate(s, { costAware: true }), "warn");
  assert.equal(costGate(s, { costAware: true }), null, "the warning is given once");
  s.budget.cost_usd_spent = 1.0;
  assert.equal(costGate(s, { costAware: true }), "halt");
  assert.equal(costGate(normalizeState({}), { costAware: true }), null, "no ceiling, no gate");
});

test("loop.cost_aware parses as a boolean, off by default", () => {
  assert.equal(parseLoopConfig({}).costAware, false);
  assert.equal(parseLoopConfig({ loop: { cost_aware: true } }).costAware, true);
  assert.ok(parseLoopConfig({ loop: { cost_aware: "yes" } }).errors.length > 0);
});

test("pair: with cost_aware the run halts between beats once the ceiling is reached", async () => {
  let clock = 0;
  const inbox = [];
  const state = normalizeState({ phase: "execution", status: "idle", autonomy_level: "L3", sandbox: "container", budget: { max_cost_usd: 1 } });
  let beats = 0;
  const final = await runLoop(state, {
    verifyCommand: "t",
    runBeat: async ({ state: s }) => {
      beats += 1;
      recordUsage(s, { role: "maker", result: { tokens: 10, costUsd: 0.6 } });
      return { exitCode: 0 };
    },
    runVerify: async () => ({ exitCode: 1, output: "red" }),
    gitHead: async () => `sha-${beats}`,
    now: () => (clock += 1000),
    persist: async () => {},
    writeInbox: async (_s, r) => inbox.push(r),
    costAware: true,
  });
  assert.equal(final.status, "budget_exceeded");
  assert.equal(beats, 2);
  assert.ok(inbox.some((l) => /cost ceiling/.test(l)));
});

test("swarm: a beat that hit the usage limit halts the run and is not a rejection", async () => {
  let clock = 0;
  let beats = 0;
  const inbox = [];
  const state = {
    goal_description: "g", autonomy_level: "L3", sandbox: "container", phase: "execution",
    iterations: { current: 0, max_allowed: 100 }, budget: { max_wall_clock_min: 120, started_at: null },
    concurrency: 1, roles: ["maker", "checker"], tasks: [normalizeTask({ id: "a" })],
  };
  const final = await runSwarm(state, {
    verifyCommand: "t",
    runBeat: async () => ((beats += 1), { exitCode: 1, stdout: "You've hit your session limit · resets 3:00pm" }),
    runVerify: async () => ({ exitCode: 0, output: "green" }),
    runChecker: async () => ({ exitCode: 0 }),
    gitHead: async () => "sha",
    assignWorktree: async ({ task }) => ({ path: `/wt/${task.id}`, branch: `b/${task.id}` }),
    now: () => (clock += 1000),
    persist: async () => {},
    audit: async () => {},
    writeInbox: async (_s, r) => inbox.push(r),
    log: () => {},
  });
  assert.equal(beats, 1, "no further beat after a spent quota");
  assert.equal(final.status, "usage_limit_reached");
  assert.equal(final.tasks[0].status, "pending", "the task resumes on the next run");
  assert.equal(final.tasks[0].rejected_beats, 0);
  assert.equal(final.tasks[0].iterations.current, 0, "the dead beat is refunded");
  assert.ok(inbox.some((l) => /usage\/session limit/.test(l) && /3:00pm/.test(l)));
});

test("a new run resets cost, usage and the previous run's attempts", () => {
  const s = normalizeState({ status: "completed" });
  s.budget.cost_usd_spent = 3;
  s.budget.usage = { maker: { beats: 1, tokens: 1, cost_usd: 3, unknown: 0 } };
  s.budget.cost_warned = true;
  s.attempts = [{ beat: 1 }];
  s.rejected_beats = 2;
  startNewRun(s);
  assert.equal(s.budget.cost_usd_spent, 0);
  assert.deepEqual(s.budget.usage, {});
  assert.equal(s.budget.cost_warned, false);
  assert.deepEqual(s.attempts, []);
  assert.equal(s.rejected_beats, 0);
});

test("conductor status shows what the last run cost, by role", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { collectState } = await import("../src/conductor-state.js");
  const { renderStatus } = await import("../src/view/status.js");
  const dir = await mkdtemp(join(tmpdir(), "usage-status-"));
  try {
    await mkdir(join(dir, "conductor/1-workbench"), { recursive: true });
    const state = normalizeState({ status: "completed", phase: "execution" });
    recordUsage(state, { role: "maker", result: { tokens: 10, costUsd: 0.42 } });
    recordUsage(state, { role: "checker", result: { tokens: 10, costUsd: 0.8 } });
    await writeFile(join(dir, "conductor/1-workbench/loop-state.json"), JSON.stringify(state));
    const out = renderStatus((await collectState(dir)).state, { color: false });
    assert.match(out, /≈ \$1\.22 at list price \(maker 1 beat \$0\.42, checker 1 beat \$0\.80\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
