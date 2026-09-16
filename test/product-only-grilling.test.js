// test/product-only-grilling.test.js
//
// A3 — the interview asks the human product questions only.
//
// Grilling's Law 3 split the world in two: facts the agent looks up, and
// "decisions" that all belong to the human. That binary is why a PO running
// several products gets asked about tech stacks, testing seams and refactor
// candidates — an engineering team decides those and reports them. The split
// is three-way, not two-way: facts (look up), engineering decisions (decide,
// then report in one line), product decisions (ask).
//
// The escalation triggers are the one-way-door set: what a user sees, what the
// product costs to run, what cannot be undone cheaply, a contradiction with an
// earlier decision, a scope or priority trade-off. Everything else is the
// agent's to decide.
//
// Pinned here: the primitive carries the three-way split and the triggers;
// the workflows that fed technical questions to the human (Quick-Path's
// constraints question, Spec-It's plan sign-off, Deepen's candidate loop)
// report instead of asking.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (...p) => readFileSync(join(ROOT, "templates", ".agents", ...p), "utf8");

const GRILLING = read("skills", "grilling", "SKILL.md");
const DRAFTING = read("skills", "collaborative-drafting", "SKILL.md");
const QUICK = read("workflows", "quick-path.md");
const SPEC = read("workflows", "spec-it.md");
const DEEPEN = read("workflows", "deepen.md");

describe("A3 — Grilling carries the three-way split", () => {
  test("the split names facts, engineering decisions and product decisions", () => {
    assert.match(GRILLING, /engineering decision/i, "no engineering-decision category");
    assert.match(GRILLING, /product decision/i, "no product-decision category");
    assert.match(GRILLING, /look (it|them) up|find (it|them) yourself/i, "lost the look-it-up rule");
  });

  test("engineering decisions are decided by the agent, not offered to the human", () => {
    assert.match(
      GRILLING,
      /decide it yourself|you decide|decide (it|them) and report/i,
      "nothing tells the agent to decide engineering questions itself",
    );
    assert.match(GRILLING, /one line|a single line/i, "no one-line reporting rule for decisions taken alone");
  });

  test("the escalation triggers are the one-way-door set", () => {
    for (const trigger of [
      /user (sees|experiences)|what a user/i,
      /cost/i,
      /cannot be undone|irreversible|one-way/i,
      /contradicts/i,
      /scope or priority|priority trade-?off/i,
    ]) {
      assert.match(GRILLING, trigger, `no escalation trigger matching ${trigger}`);
    }
  });

  test("Collaborative-Drafting defers to the same split", () => {
    assert.match(DRAFTING, /engineering decision/i, "drafting primitive does not reference the split");
  });
});

describe("A3 — workflows stop asking the human technical questions", () => {
  test("Quick-Path's constraints question drops tech stack", () => {
    const questions = QUICK.slice(QUICK.indexOf("### The Three Questions"), QUICK.indexOf("### Scope Summary"));
    assert.ok(questions.length > 0, "quick-path.md lost its questions section");
    assert.doesNotMatch(questions, /tech stack preferences/i, "still asks the human for tech stack preferences");
  });

  test("Spec-It's plan phase reports engineering decisions instead of seeking sign-off on them", () => {
    const phase2 = SPEC.slice(SPEC.indexOf("## Phase 2"), SPEC.indexOf("## Completion Protocol"));
    assert.ok(phase2.length > 0, "spec-it.md lost Phase 2");
    assert.match(phase2, /engineering decision/i, "Phase 2 does not distinguish engineering decisions");
  });

  test("Deepen decides its own candidates and escalates only user-visible ones", () => {
    assert.match(DEEPEN, /engineering decision|decide (the|these) candidates|yours to decide/i,
      "Deepen still grills the human on architecture candidates");
  });
});
