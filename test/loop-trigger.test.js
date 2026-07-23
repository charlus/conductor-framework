// test/loop-trigger.test.js
//
// The ignition contract (src/loop/trigger.js): an external trigger can SEED the
// loop's goal but can NEVER escalate autonomy past the operator-set ceiling.
// Pure functions — no IO, fixed clock.

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "../src/loop/driver.js";
import {
  parseTriggerPayload,
  clampAutonomy,
  applyTrigger,
  renderTriggerDoc,
} from "../src/loop/trigger.js";

const fixedNow = () => 0; // → 1970-01-01T00:00:00.000Z

test("parseTriggerPayload: bare string becomes the goal", () => {
  assert.deepEqual(parseTriggerPayload("triage new bugs"), { goal: "triage new bugs" });
});

test("parseTriggerPayload: JSON object passes through", () => {
  const p = parseTriggerPayload('{"goal":"g","source":"schedule:x"}');
  assert.deepEqual(p, { goal: "g", source: "schedule:x" });
});

test("parseTriggerPayload: empty/whitespace → null", () => {
  assert.equal(parseTriggerPayload(""), null);
  assert.equal(parseTriggerPayload("   \n "), null);
  assert.equal(parseTriggerPayload(null), null);
});

test("parseTriggerPayload: malformed JSON throws", () => {
  assert.throws(() => parseTriggerPayload("{not json"), /not valid JSON/);
});

test("parseTriggerPayload: a JSON array is rejected (must be object or bare string)", () => {
  assert.throws(() => parseTriggerPayload('["a","b"]'), /object or a bare goal string/);
});

test("clampAutonomy: escalation is refused, de-escalation allowed, unknown ignored", () => {
  assert.equal(clampAutonomy("L1", "L3"), "L1"); // refuse escalation
  assert.equal(clampAutonomy("L3", "L1"), "L1"); // allow de-escalation
  assert.equal(clampAutonomy("L2", "L2"), "L2"); // equal ok
  assert.equal(clampAutonomy("L1", "nonsense"), "L1"); // unknown → ceiling
  assert.equal(clampAutonomy("L2", ""), "L2"); // absent → ceiling
});

test("applyTrigger: sets goal + phase and records provenance", () => {
  const state = normalizeState({ autonomy_level: "L3", phase: "discovery" });
  const { provenance } = applyTrigger(
    state,
    { goal: "ship the fix", phase: "execution", source: "cron:nightly", context: "issue #42" },
    { now: fixedNow }
  );
  assert.equal(state.goal_description, "ship the fix");
  assert.equal(state.phase, "execution");
  assert.equal(provenance.source, "cron:nightly");
  assert.equal(provenance.context, "issue #42");
  assert.equal(provenance.received_at, "1970-01-01T00:00:00.000Z");
  assert.deepEqual(provenance.changes.sort(), ["goal", "phase"]);
  // Durable breadcrumb lands on the Spine.
  assert.equal(state.last_trigger.source, "cron:nightly");
  assert.deepEqual(state.last_trigger.changes.sort(), ["goal", "phase"]);
});

test("applyTrigger: CANNOT escalate autonomy above the operator ceiling", () => {
  const state = normalizeState({ autonomy_level: "L1" });
  const { provenance } = applyTrigger(
    state,
    { goal: "do it all unattended", autonomy_level: "L3" },
    { now: fixedNow }
  );
  assert.equal(state.autonomy_level, "L1", "ceiling holds — escalation refused");
  assert.equal(provenance.requested_autonomy, "L3");
  assert.equal(provenance.effective_autonomy, "L1");
  assert.equal(provenance.clamped_from, "L3");
  assert.ok(!provenance.changes.includes("autonomy_level"));
});

test("applyTrigger: CAN de-escalate autonomy", () => {
  const state = normalizeState({ autonomy_level: "L3" });
  applyTrigger(state, { goal: "cautious run", autonomy_level: "L1" }, { now: fixedNow });
  assert.equal(state.autonomy_level, "L1");
});

test("applyTrigger: empty payload leaves state untouched but still stamps provenance", () => {
  const state = normalizeState({ autonomy_level: "L2", goal_description: "prior" });
  const { provenance } = applyTrigger(state, {}, { now: fixedNow });
  assert.equal(state.goal_description, "prior");
  assert.equal(state.autonomy_level, "L2");
  assert.equal(provenance.source, "external");
  assert.deepEqual(provenance.changes, []);
});

test("renderTriggerDoc: includes goal, source, and clamp note; omits empty context", () => {
  const doc = renderTriggerDoc({
    source: "slack:#feedback",
    received_at: "1970-01-01T00:00:00.000Z",
    goal: "triage bugs",
    context: "",
    effective_autonomy: "L1",
    clamped_from: "L3",
    changes: ["goal"],
  });
  assert.match(doc, /# Loop Trigger/);
  assert.match(doc, /slack:#feedback/);
  assert.match(doc, /triage bugs/);
  assert.match(doc, /clamped down from requested `L3`/);
  assert.ok(!/## Context/.test(doc), "no context section when context is empty");
});
