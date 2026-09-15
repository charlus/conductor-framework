// test/review-completion.test.js
//
// C1 — a review that did not happen can never read as a pass.
//
// Evidence, autopportunity `SHIP-VERIFICATION-GAPS.md` (2026-08-05): the delta
// reviewer on two branches was killed by four consecutive API 529 errors and a
// fifth attempt "completed with a deliberately minimised scope". The author
// then wrote 6 KB of prose to reconstruct what had and had not been reviewed.
// The autonomous loop already fails safe here in code (`src/loop/checker.js`:
// a missing or malformed verdict is a rejection). The interactive gate did not:
// `independent-review/SKILL.md` and `reviewer.md` described the happy path only.
//
// gstack closed the same gap in 1.86/1.87 (`lib/outside-review-result.ts`:
// empty, refused or marker-less reviewer output is `completed:false`; reports
// open with `complete | partial | not assessed`). Taken for the interactive path
// because the problem is recorded in our own project, not because it is new.
//
// Pinned:
//   * the reviewer's report opens with `SCOPE: complete` or `SCOPE: partial`,
//     and partial coverage cannot carry APPROVE;
//   * the caller treats no `VERDICT:` line, empty, truncated or refused output
//     as "the round did not happen": re-spawn once, then stop and say the gate
//     did not run — never proceed as if it passed;
//   * Ship 4.3 says the same in one line.
// Structural on prose, and the brief stays under its 130-line cap.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const REVIEWER = readFileSync(
  join(ROOT, "templates", ".agents", "skills", "independent-review", "reviewer.md"),
  "utf8",
);
const SKILL = readFileSync(
  join(ROOT, "templates", ".agents", "skills", "independent-review", "SKILL.md"),
  "utf8",
);
const SHIP = readFileSync(join(ROOT, "templates", ".agents", "workflows", "ship.md"), "utf8");

describe("C1 — the reviewer states its coverage", () => {
  const verdictSection = REVIEWER.slice(
    REVIEWER.indexOf("## Your verdict"),
    REVIEWER.indexOf("## What a BLOCKER is"),
  );

  test("the report opens with a SCOPE line, complete or partial", () => {
    assert.ok(verdictSection.length > 0, "reviewer.md lost its verdict section");
    assert.match(verdictSection, /SCOPE: complete/, "no `SCOPE: complete` in the verdict section");
    assert.match(verdictSection, /SCOPE: partial/, "no `SCOPE: partial` in the verdict section");
  });

  test("partial coverage cannot carry APPROVE", () => {
    assert.match(
      verdictSection,
      /partial[^\n]*\n?[^\n]*(never|not|cannot)[^\n]*APPROVE|APPROVE[^\n]*(never|not|cannot)[^\n]*partial/i,
      "nothing says a partial review withholds APPROVE",
    );
  });

  test("the brief stays under its cap after the addition", () => {
    const n = REVIEWER.trimEnd().split("\n").length;
    assert.ok(n <= 130, `reviewer.md is ${n} lines (max 130)`);
  });
});

describe("C1 — the caller never mistakes a missing review for a pass", () => {
  const gate = SKILL.slice(SKILL.indexOf("## The gate"), SKILL.indexOf("## Disposing of the findings"));

  test("no VERDICT line, empty, truncated or refused output is not a round", () => {
    assert.ok(gate.length > 0, "SKILL.md lost 'The gate'");
    assert.match(gate, /no `VERDICT:` line|without a `VERDICT:` line|missing `VERDICT:`/i, "the no-verdict case is not named");
    assert.match(gate, /empty|truncated|refus/i, "empty/truncated/refused output is not named");
    assert.match(gate, /not a round|did not happen|has not run|did not run/i, "it must say the round did not happen");
  });

  test("re-spawn once, then stop and say the gate did not run — never proceed", () => {
    assert.match(gate, /re-?spawn[^\n]*once/i, "no bounded re-spawn");
    assert.match(gate, /never (proceed|treat|count)[^\n]*(pass|APPROVE|approved)/i, "nothing forbids proceeding as if it passed");
  });

  test("SCOPE: partial plus APPROVE is self-contradicting and reads as CHANGES REQUESTED", () => {
    assert.match(gate, /SCOPE: partial/, "the caller never reads the SCOPE line");
    assert.match(gate, /CHANGES REQUESTED/, "the caller does not say what a partial verdict becomes");
  });
});

describe("C1 — Ship 4.3 carries the same rule", () => {
  test("Ship's verdict-reading step names the missing-verdict case", () => {
    const step = SHIP.slice(SHIP.indexOf("### 4.3"), SHIP.indexOf("### 4.4"));
    assert.ok(step.length > 0, "ship.md lost 4.3");
    assert.match(step, /SCOPE:/, "4.3 never mentions the SCOPE line");
    assert.match(step, /no `VERDICT:`|without a verdict|no verdict/i, "4.3 does not say what a missing verdict means");
  });
});
