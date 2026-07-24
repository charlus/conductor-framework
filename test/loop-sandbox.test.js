// test/loop-sandbox.test.js
//
// The L3 sandbox gate accepts any recognized provider — `cli-native` (the agent
// CLI vendor's own maintained sandbox; the recommended, no-Docker default) or a
// BYO `container` — and refuses `none`. Guards the generalization away from the
// old hard-coded `sandbox === "container"` requirement.

import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight, normalizeState, SANDBOX_PROVIDERS } from "../src/loop/driver.js";

const L3 = (sandbox) => normalizeState({ phase: "execution", autonomy_level: "L3", sandbox });

test("SANDBOX_PROVIDERS: cli-native + container qualify; none does not", () => {
  assert.deepEqual([...SANDBOX_PROVIDERS], ["cli-native", "container"]);
  assert.ok(!SANDBOX_PROVIDERS.includes("none"));
});

test("preflight: L3 + cli-native is allowed (no Docker path)", () => {
  assert.equal(preflight(L3("cli-native"), { verifyCommand: "npm test" }), null);
});

test("preflight: L3 + container is allowed", () => {
  assert.equal(preflight(L3("container"), { verifyCommand: "npm test" }), null);
});

test("preflight: L3 + none is refused", () => {
  assert.equal(preflight(L3("none"), { verifyCommand: "npm test" }), "halted_sandbox_required");
});

test("preflight: the sandbox gate is L3-only (L1 + none is fine)", () => {
  const s = normalizeState({ phase: "execution", autonomy_level: "L1", sandbox: "none" });
  assert.equal(preflight(s, { verifyCommand: "npm test" }), null);
});

test("preflight order: sandbox is checked before the verify command", () => {
  // L3 + none with NO verify command still surfaces the sandbox halt first.
  assert.equal(preflight(L3("none"), { verifyCommand: null }), "halted_sandbox_required");
});
