// test/retro-harness-lens.test.js
//
// C2 — the retrospective asks what the HARNESS got wrong, not only the product.
//
// Twelve retrospectives across four live projects (2026-03 to 2026-07) produced
// product and codebase lessons and exactly zero framework changes, although four
// of them named a workflow gap in prose. Phase 2 asked four questions about the
// work and none about the environment the agent worked in, so a missing guardrail
// or a rule the agent read and ignored had no question to surface under.
//
// Matt Pocock's in-progress `retro` skill (skills/in-progress/retro, 2026-09)
// frames a session review around environment fixes — guardrails, navigation
// pointers, tool economy, no-op instructions, information access — and routes
// anything mechanical to lint/hook/CI rather than prose. That last rule is our
// Operating Truth 3 already; the categories are what our retro lacked. Taken
// because our own retros show the gap, not because the idea is new.
//
// Pinned: Phase 2 carries a harness question with the five categories, tells
// the agent that a mechanical standard becomes a hook/test/CI check and not a
// paragraph, and routes the answer to the ship-log's `Framework lesson:` line.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const RETRO = readFileSync(join(ROOT, "templates", ".agents", "workflows", "retrospective.md"), "utf8");
const PHASE2 = RETRO.slice(RETRO.indexOf("## Phase 2"), RETRO.indexOf("## Phase 3"));

describe("C2 — Phase 2 has a harness lens", () => {
  test("a question about the harness exists", () => {
    assert.ok(PHASE2.length > 0, "retrospective.md lost Phase 2");
    assert.match(PHASE2, /harness|environment the agent worked in|got in the way/i, "no harness question in Phase 2");
  });

  test("the five categories are named", () => {
    for (const cat of [/guardrail/i, /navigation|could not find|pointer/i, /tool economy|manual step|could be a command/i, /no-op|read and ignored|ignored/i, /information access|lived in (a|someone's) head|not written down/i]) {
      assert.match(PHASE2, cat, `Phase 2 lacks the category ${cat}`);
    }
  });

  test("mechanical standards go to code, and the answer goes to the Framework lesson line", () => {
    assert.match(PHASE2, /hook|lint|CI/, "nothing routes mechanical standards to a hook/lint/CI");
    assert.match(PHASE2, /Framework lesson/, "the harness answer has no destination");
  });
});
