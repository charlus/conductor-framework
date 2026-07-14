// test/loop-adapters.test.js
//
// Phase 2 acceptance: platform-adapter selection. The pure picker is unit-tested
// without spawning any CLI; the real resolveAdapter() probes PATH (IO) and is
// exercised indirectly by the `conductor loop --dry-run` integration check.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pickAdapterName, ADAPTERS, PRIORITY } from "../src/loop/adapters/index.js";

test("registry ships claude + antigravity, claude first in priority", () => {
  assert.deepEqual(Object.keys(ADAPTERS).sort(), ["antigravity", "claude"]);
  assert.equal(PRIORITY[0], "claude");
  for (const mod of Object.values(ADAPTERS)) {
    assert.equal(typeof mod.name, "string");
    assert.equal(typeof mod.isAvailable, "function");
    assert.equal(typeof mod.runBeat, "function");
  }
});

test("explicit preference is honoured when available", () => {
  const avail = { claude: true, antigravity: true };
  assert.equal(pickAdapterName("antigravity", avail), "antigravity");
  assert.equal(pickAdapterName("claude", avail), "claude");
});

test("explicit unknown platform throws", () => {
  assert.throws(
    () => pickAdapterName("codex", { claude: true, antigravity: false }),
    /Unknown platform 'codex'/
  );
});

test("explicit but unavailable platform throws (no silent fallback)", () => {
  assert.throws(
    () => pickAdapterName("antigravity", { claude: true, antigravity: false }),
    /not on PATH/
  );
});

test("auto-detect returns the first available by priority order", () => {
  assert.equal(pickAdapterName(null, { claude: true, antigravity: true }), "claude");
  assert.equal(pickAdapterName(null, { claude: false, antigravity: true }), "antigravity");
});

test("auto-detect returns null when nothing is available", () => {
  assert.equal(pickAdapterName(null, { claude: false, antigravity: false }), null);
});

test("custom priority order is respected in auto-detect", () => {
  const avail = { claude: true, antigravity: true };
  assert.equal(pickAdapterName(null, avail, ["antigravity", "claude"]), "antigravity");
});
