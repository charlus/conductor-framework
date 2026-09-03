// test/checker-verdict-schema.test.js
//
// E3 — enforce the rubric-v2 evidence bar IN CODE, not just in prose.
//
// E1 changed the Checker's rubric: a BLOCKER needs a quoted line and
// confidence >= 7, so an unsure Checker downgrades instead of rejecting. That
// is prose, and prose is advisory (Operating Truth 3). This suite makes the
// driver's verdict parser enforce it, red->green.
//
// THE DIRECTION MATTERS, and it is the thing to get right (Operating Truth 4).
// The bar must only ever make the gate STRICTER or leave it unchanged:
//
//   * A malformed BLOCKER does NOT become an approval. It is malformed, so the
//     driver fails safe to reject — exactly as it does for a missing verdict.
//     If the bar could turn a rejection into an approval it would be a way to
//     wave work through by writing a sloppy finding, which is the opposite of
//     the intent.
//   * An approval with no findings still approves. The bar constrains what a
//     REJECTION must prove, never what an approval must contain.
//
// Everything the old contract guaranteed is re-asserted here so the safety
// envelope cannot regress silently.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseCheckerVerdict, verdictToExitCode, tallyVerdicts } from "../src/loop/checker.js";

const blocker = (over = {}) => ({
  severity: "BLOCKER",
  confidence: 9,
  file: "src/db.js",
  line: 42,
  quote: "db.raw(`SELECT ${id}`)",
  class: "sql-injection",
  ...over,
});

const verdict = (obj) => parseCheckerVerdict(JSON.stringify(obj));

describe("E3.1 — the pre-existing fail-safe contract still holds", () => {
  test("an explicit approval approves", () => {
    const v = parseCheckerVerdict('{"approved": true, "reason": "complete"}');
    assert.equal(v.approved, true);
    assert.equal(verdictToExitCode(v), 0);
  });

  test("missing, empty and malformed all reject", () => {
    for (const bad of [null, undefined, "", "   ", "not json", "{}", '{"approved": false}', '{"approved": "yes"}']) {
      const v = parseCheckerVerdict(bad);
      assert.equal(v.approved, false, `should reject: ${JSON.stringify(bad)}`);
      assert.equal(verdictToExitCode(v), 1);
    }
  });

  test("a non-object JSON value rejects", () => {
    for (const bad of ["[]", '"approved"', "3", "true", "null"]) {
      assert.equal(parseCheckerVerdict(bad).approved, false, `should reject: ${bad}`);
    }
  });
});

describe("E3.2 — a REJECTION must carry evidence", () => {
  test("a rejection with a well-formed BLOCKER rejects, and says why", () => {
    const v = verdict({ approved: false, reason: "sql injection", findings: [blocker()] });
    assert.equal(v.approved, false);
    assert.equal(v.findings.length, 1);
    assert.equal(v.malformedFindings.length, 0);
    assert.match(v.reason, /sql injection/);
  });

  test("a BLOCKER with NO quote is malformed — and still rejects", () => {
    const v = verdict({ approved: false, reason: "x", findings: [blocker({ quote: undefined })] });
    assert.equal(v.approved, false, "a malformed finding must never flip a rejection to an approval");
    assert.equal(v.malformedFindings.length, 1);
    assert.match(v.malformedFindings[0].problem, /quote/i);
  });

  test("a BLOCKER with confidence < 7 is malformed — and still rejects", () => {
    const v = verdict({ approved: false, reason: "x", findings: [blocker({ confidence: 5 })] });
    assert.equal(v.approved, false);
    assert.match(v.malformedFindings[0].problem, /confidence/i);
  });

  test("a BLOCKER with no file location is malformed", () => {
    const v = verdict({ approved: false, reason: "x", findings: [blocker({ file: undefined })] });
    assert.equal(v.malformedFindings.length, 1);
    assert.match(v.malformedFindings[0].problem, /file/i);
  });

  test("an empty or whitespace quote does not count as a quote", () => {
    for (const q of ["", "   ", "\n"]) {
      const v = verdict({ approved: false, reason: "x", findings: [blocker({ quote: q })] });
      assert.equal(v.malformedFindings.length, 1, `quote ${JSON.stringify(q)} should not satisfy the bar`);
    }
  });

  test("IMPORTANT and NIT need no quote — the bar is only on blockers", () => {
    const v = verdict({
      approved: false,
      reason: "x",
      findings: [
        { severity: "IMPORTANT", file: "a.js", class: "naming" },
        { severity: "NIT", file: "b.js", class: "style" },
      ],
    });
    assert.equal(v.malformedFindings.length, 0);
  });

  test("a rejection whose ONLY blocker is malformed is reported as unproven", () => {
    // The diagnostic the driver needs: this Checker rejected without evidence,
    // which is a Checker problem to fix, not a Maker problem.
    const v = verdict({ approved: false, reason: "vibes", findings: [blocker({ quote: undefined })] });
    assert.equal(v.approved, false);
    assert.equal(v.provenBlockers, 0);
    assert.match(v.reason, /unproven|no quoted evidence|malformed/i);
  });

  test("a rejection with one proven and one malformed blocker keeps the proven one", () => {
    const v = verdict({
      approved: false,
      reason: "two issues",
      findings: [blocker(), blocker({ quote: undefined, file: "src/other.js" })],
    });
    assert.equal(v.provenBlockers, 1);
    assert.equal(v.malformedFindings.length, 1);
  });
});

describe("E3.3 — the bar can never be used to APPROVE", () => {
  test("approved:true with a malformed blocker does not silently approve", () => {
    // A Checker that says "approved" while listing a blocker is contradicting
    // itself. Fail safe: the blocker wins.
    const v = verdict({ approved: true, reason: "fine", findings: [blocker()] });
    assert.equal(v.approved, false, "an approval listing a BLOCKER must not approve");
    assert.match(v.reason, /contradict|blocker/i);
  });

  test("approved:true with only IMPORTANT/NIT findings still approves", () => {
    // Rubric v2: APPROVE means zero blockers, not zero findings.
    const v = verdict({
      approved: true,
      reason: "no blockers",
      findings: [{ severity: "IMPORTANT", file: "a.js", class: "naming" }],
    });
    assert.equal(v.approved, true);
  });

  test("approved:true with no findings array still approves (back-compatible)", () => {
    const v = verdict({ approved: true, reason: "complete" });
    assert.equal(v.approved, true);
    assert.deepEqual(v.findings, []);
  });

  test("a findings field of the wrong type does not crash or approve wrongly", () => {
    for (const bad of ["findings", 3, { a: 1 }]) {
      const v = verdict({ approved: true, reason: "ok", findings: bad });
      assert.equal(v.approved, true, "a junk findings field must not flip a clean approval");
      assert.deepEqual(v.findings, []);
    }
    const r = verdict({ approved: false, reason: "no", findings: "junk" });
    assert.equal(r.approved, false);
  });
});

describe("E3.4 — multi-vote tally still fails safe", () => {
  test("a strict majority approves", () => {
    const t = tallyVerdicts([{ approved: true }, { approved: true }, { approved: false }], 3);
    assert.equal(t.approved, true);
  });

  test("a tie fails safe to reject", () => {
    const t = tallyVerdicts([{ approved: true }, { approved: false }], 2);
    assert.equal(t.approved, false);
  });

  test("a missing vote counts as a reject", () => {
    const t = tallyVerdicts([{ approved: true }], 3);
    assert.equal(t.approved, false);
    assert.equal(t.votes, 3);
  });

  test("unproven rejections are visible in the tally reasons", () => {
    const unproven = verdict({ approved: false, reason: "vibes", findings: [blocker({ quote: undefined })] });
    const t = tallyVerdicts([{ approved: true }, unproven], 2);
    assert.equal(t.approved, false);
    assert.match(t.reasons.join(" "), /unproven|malformed|no quoted evidence/i);
  });
});
