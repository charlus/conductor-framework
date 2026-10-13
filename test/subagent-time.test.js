// test/subagent-time.test.js
//
// F9 — a subagent works in the foreground, within a time budget.
//
// Real usage (autopportunity, 2026-10): a review agent ran the full test suite
// and was still going after 21 minutes ("Is everything OK?"); a ship-prep agent
// waited on its own background work for over an hour, and the owner had to
// power down the laptop. Nothing in the reviewer brief or the subagent skill
// set a time budget or forbade background waits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SK = join(new URL("..", import.meta.url).pathname, "templates", ".agents", "skills");
const REVIEWER = readFileSync(join(SK, "independent-review", "reviewer.md"), "utf8");
const ISOLATION = readFileSync(join(SK, "subagent-isolation", "SKILL.md"), "utf8");

test("the reviewer does not re-run the full suite and starts no background work", () => {
  assert.match(REVIEWER, /full (test )?suite/i);
  assert.match(REVIEWER, /background/i);
  assert.match(REVIEWER, /verification evidence/i);
});

test("every subagent brief carries a time budget and forbids background waits", () => {
  assert.match(ISOLATION, /time budget/i);
  assert.match(ISOLATION, /foreground/i);
  assert.match(ISOLATION, /background/i);
  assert.match(ISOLATION, /timeout/);
});
