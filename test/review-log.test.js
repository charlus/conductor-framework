// test/review-log.test.js
//
// E2 — the review findings ledger. This is the instrument that settles the
// question E1 answered with an argument: is the reviewer's rubric too strict,
// or does the Maker write bad code? Both hypotheses predict "a blocker every
// round"; only the data separates them.
//
// The ledger enforces the SAME bar as rubric v2 at the write boundary, so it
// cannot record a finding the rubric would have refused — otherwise the
// measurement would be taken with a different ruler than the gate.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeFinding, summarise } from "../src/commands/review-log.js";

const at = () => 0;

describe("E2.7 — the ledger enforces the rubric bar at write time", () => {
  test("a BLOCKER with a quote and confidence >= 7 is accepted", () => {
    const r = normalizeFinding(
      {
        severity: "BLOCKER",
        confidence: 9,
        category: "sql-injection",
        file: "src/db.js",
        line: 42,
        quote: "db.raw(`SELECT ${id}`)",
        action: "fixed",
      },
      { now: at },
    );
    assert.equal(r.ok, true, r.error);
    assert.equal(r.record.severity, "BLOCKER");
    assert.equal(r.record.fingerprint, "src/db.js:42:sql-injection");
  });

  test("a BLOCKER with confidence < 7 is REFUSED", () => {
    const r = normalizeFinding({ severity: "BLOCKER", confidence: 5, quote: "x", action: "fixed" });
    assert.equal(r.ok, false);
    assert.match(r.error, /confidence >= 7/);
  });

  test("a BLOCKER with no quote is REFUSED", () => {
    const r = normalizeFinding({ severity: "BLOCKER", confidence: 9, action: "fixed" });
    assert.equal(r.ok, false);
    assert.match(r.error, /quoted line/);
  });

  test("IMPORTANT and NIT need no quote — only blockers carry the bar", () => {
    for (const severity of ["IMPORTANT", "NIT"]) {
      const r = normalizeFinding({ severity, action: "dismissed", category: "style" });
      assert.equal(r.ok, true, `${severity}: ${r.error}`);
    }
  });

  test("an unknown severity or action is refused", () => {
    assert.equal(normalizeFinding({ severity: "CRITICAL", action: "fixed" }).ok, false);
    assert.equal(normalizeFinding({ severity: "NIT", action: "ignored" }).ok, false);
  });

  test("a non-object is refused rather than silently recorded", () => {
    for (const bad of [null, "x", 3, []]) {
      assert.equal(normalizeFinding(bad).ok, false);
    }
  });

  test("a long quote is truncated, not rejected — the ledger must not lose a finding", () => {
    const r = normalizeFinding({
      severity: "BLOCKER",
      confidence: 8,
      quote: "x".repeat(5000),
      action: "fixed",
    });
    assert.equal(r.ok, true);
    assert.equal(r.record.quote.length, 400);
  });
});

describe("E2.8 — the summary answers the questions the plan asked", () => {
  const records = [
    { severity: "BLOCKER", category: "sql", action: "fixed", round: 1 },
    { severity: "BLOCKER", category: "sql", action: "fixed", round: 1 },
    { severity: "IMPORTANT", category: "test-structure", action: "dismissed", round: 1 },
    { severity: "IMPORTANT", category: "test-structure", action: "dismissed", round: 2 },
    { severity: "NIT", category: "test-structure", action: "dismissed", round: 2 },
    { severity: "NIT", category: "naming", action: "fixed", round: 2 },
  ];
  const s = summarise(records);

  test("counts findings, blockers and rounds", () => {
    assert.equal(s.findings, 6);
    assert.equal(s.blockers, 2);
    assert.equal(s.maxRound, 2);
  });

  test("computes the dismissal rate", () => {
    assert.equal(s.dismissed, 3);
    assert.equal(s.dismissalRate, 0.5);
  });

  test("flags a class dismissed most of the time as a RUBRIC suspect", () => {
    // This is the point of the ledger: three findings in `test-structure`, all
    // dismissed, means the rubric is wrong there — not that the author is
    // ignoring real defects.
    assert.deepEqual(s.rubricSuspects.map((c) => c.name), ["test-structure"]);
  });

  test("does NOT flag a class with real, fixed blockers", () => {
    assert.ok(!s.rubricSuspects.some((c) => c.name === "sql"));
  });

  test("needs at least 3 findings before calling a class a suspect", () => {
    const thin = summarise([
      { severity: "NIT", category: "one-off", action: "dismissed", round: 1 },
      { severity: "NIT", category: "one-off", action: "dismissed", round: 1 },
    ]);
    assert.deepEqual(thin.rubricSuspects, [], "two dismissals is noise, not a pattern");
  });

  test("an empty ledger summarises to zeros, not NaN", () => {
    const empty = summarise([]);
    assert.equal(empty.findings, 0);
    assert.equal(empty.dismissalRate, 0);
    assert.equal(empty.maxRound, 0);
  });
});
