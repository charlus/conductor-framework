// test/loop-resume.test.js
//
// Resume discipline (P1.4): reviveForResume rewinds mid-run working statuses to a
// clean entry point so a killed run resumes instead of deadlocking, WITHOUT
// redoing terminal (merged/failed) work. Pure — exercised directly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { reviveForResume } from "../src/loop/resume.js";
import { normalizeState } from "../src/loop/driver.js";
import { computeFrontier, normalizeTask } from "../src/loop/swarm.js";

test("revives in-flight swarm tasks (in_progress/passed/rejected → pending)", () => {
  const state = normalizeState({
    tasks: [
      { id: "a", status: "in_progress" },
      { id: "b", status: "passed" },
      { id: "c", status: "rejected" },
    ],
  });
  const r = reviveForResume(state);
  assert.equal(r.tasks, 3);
  assert.deepEqual(state.tasks.map((t) => t.status), ["pending", "pending", "pending"]);
  // …and the revived tasks are now re-selectable by the scheduler (the swarm
  // normalizes tasks before computing the frontier).
  assert.equal(computeFrontier(state.tasks.map((t) => normalizeTask(t))).length, 3);
});

test("never touches terminal task work (merged/failed preserved)", () => {
  const state = normalizeState({
    tasks: [
      { id: "done", status: "merged" },
      { id: "dead", status: "failed" },
      { id: "stuck", status: "in_progress" },
      { id: "fresh", status: "pending" },
    ],
  });
  const r = reviveForResume(state);
  assert.equal(r.tasks, 1); // only "stuck"
  assert.deepEqual(
    state.tasks.map((t) => t.status),
    ["merged", "failed", "pending", "pending"]
  );
});

test("clears the revived task's half-beat stall bookkeeping", () => {
  const state = normalizeState({
    tasks: [{ id: "a", status: "in_progress", stall: { consecutive: 2, last_beat_hash: "abc" } }],
  });
  reviveForResume(state);
  assert.deepEqual(state.tasks[0].stall, { consecutive: 0, last_beat_hash: null });
});

test("rewinds a mid-beat pair run status to a clean idle entry point", () => {
  const state = normalizeState({ status: "checking", current_worker: "checker", maker_reported_done: true });
  const r = reviveForResume(state);
  assert.equal(r.run, true);
  assert.equal(state.status, "idle");
  assert.equal(state.current_worker, null);
  assert.equal(state.maker_reported_done, false);
});

test("no-op on a clean idle state and on terminal run statuses", () => {
  const idle = normalizeState({ status: "idle" });
  assert.deepEqual(reviveForResume(idle), { tasks: 0, run: false });

  const done = normalizeState({ status: "completed" });
  const r = reviveForResume(done);
  assert.equal(r.run, false);
  assert.equal(done.status, "completed"); // terminal preserved
});
