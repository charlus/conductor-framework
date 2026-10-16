// test/loop-models.test.js
//
// loop.models picks a model per loop role (Maker, Checker) on the claude engine.
// Unset, nothing changes: the CLI's own default model runs every beat.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLoopConfig, withRoleModels } from "../src/loop/config.js";
import { buildArgv } from "../src/loop/adapters/claude.js";

test("loop.models absent → no model for either role", () => {
  const c = parseLoopConfig({});
  assert.deepEqual(c.models, { maker: null, checker: null });
  assert.deepEqual(c.errors, []);
});

test("loop.models accepts model ids and aliases per role", () => {
  const c = parseLoopConfig({ loop: { models: { maker: "sonnet", checker: "claude-opus-5-5[1m]" } } });
  assert.deepEqual(c.models, { maker: "sonnet", checker: "claude-opus-5-5[1m]" });
  assert.deepEqual(c.errors, []);
});

test("loop.models rejects unknown roles, non-strings and values that could carry a flag", () => {
  for (const models of [{ planner: "opus" }, { maker: 5 }, { maker: "" }, { checker: "--dangerous" }, { maker: "a b" }, "opus"]) {
    const c = parseLoopConfig({ loop: { models } });
    assert.ok(c.errors.length > 0, `expected an error for ${JSON.stringify(models)}`);
  }
});

test("buildArgv passes --model only when one is given", () => {
  assert.ok(!buildArgv({ prompt: "p" }).includes("--model"));
  const argv = buildArgv({ prompt: "p", model: "sonnet" });
  assert.equal(argv[argv.indexOf("--model") + 1], "sonnet");
});

test("withRoleModels gives the maker and the checker their own model", async () => {
  const calls = [];
  const adapter = {
    name: "claude",
    runBeat: async (o) => (calls.push(["maker", o.model]), { exitCode: 0 }),
    runChecker: async (o) => (calls.push(["checker", o.model]), { exitCode: 0 }),
  };
  const wrapped = withRoleModels(adapter, { maker: "sonnet", checker: "opus" });
  await wrapped.runBeat({ cwd: "/x" });
  await wrapped.runChecker({ cwd: "/x" });
  assert.deepEqual(calls, [["maker", "sonnet"], ["checker", "opus"]]);
});

test("withRoleModels leaves the adapter untouched when no model is set", () => {
  const adapter = { name: "claude", runBeat: () => {}, runChecker: () => {} };
  assert.equal(withRoleModels(adapter, { maker: null, checker: null }), adapter);
});
