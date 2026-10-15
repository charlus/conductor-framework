// test/changelog-compatibility.test.js
//
// Every release entry says, in one line under its heading, what the upgrade
// asks of each project. The product owner upgrades many installs and reads
// this line to decide whether an upgrade is a one-command job.
//
// Taken from AI-DLC (awslabs/aidlc-workflows), whose `t68` pins the same line.
// Entries up to and including 6.12.0 stay as they shipped.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const VALUES = ["upgrade only", "upgrade plus a step", "breaking for scripts"];
const FIRST_CHECKED = [6, 12, 0]; // strictly newer versions are checked

const newer = (v, base) => {
  for (let i = 0; i < 3; i += 1) if (v[i] !== base[i]) return v[i] > base[i];
  return false;
};

/** Problems with the Compatibility lines of a changelog, one string each. */
export function compatibilityProblems(md) {
  const problems = [];
  const parts = md.split(/^(?=## \[)/m).filter((p) => p.startsWith("## ["));
  for (const entry of parts) {
    const m = /^## \[(\d+)\.(\d+)\.(\d+)\]/.exec(entry);
    if (!m) continue; // [Unreleased]
    const version = m.slice(1, 4).map(Number);
    if (!newer(version, FIRST_CHECKED)) continue;
    const name = version.join(".");
    const firstLine = entry.split("\n").slice(1).find((l) => l.trim() !== "") ?? "";
    const value = /^Compatibility: (.+)$/.exec(firstLine.trim())?.[1];
    if (!VALUES.includes(value)) {
      problems.push(`${name}: the first line under the heading must be "Compatibility: <${VALUES.join(" | ")}>"`);
      continue;
    }
    if (value === "upgrade plus a step" && !/^### Note — upgrading/m.test(entry))
      problems.push(`${name}: "upgrade plus a step" needs a "### Note — upgrading" section naming the step`);
    if (/^- \*\*Breaking for scripts:\*\*/m.test(entry) && value !== "breaking for scripts")
      problems.push(`${name}: a "Breaking for scripts" bullet needs "Compatibility: breaking for scripts"`);
  }
  return problems;
}

describe("AIDLC-A1 — CHANGELOG Compatibility line", () => {
  test("every release entry after 6.12.0 has a valid Compatibility line", () => {
    const md = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    assert.deepEqual(compatibilityProblems(md), []);
  });

  test("the check catches a missing, a wrong and an inconsistent line (sensitivity)", () => {
    const entry = (v, body) => `## [${v}] — 2026-10-20 — T\n\n${body}\n\n---\n\n`;
    assert.equal(compatibilityProblems(entry("6.12.0", "### Fixed\n- x")).length, 0, "6.12.0 is exempt");
    assert.equal(compatibilityProblems(entry("6.13.0", "### Fixed\n- x")).length, 1, "missing line");
    assert.equal(compatibilityProblems(entry("6.13.0", "Compatibility: maybe")).length, 1, "unknown value");
    assert.equal(compatibilityProblems(entry("6.13.0", "Compatibility: upgrade plus a step\n\n### Fixed\n- x")).length, 1, "step not named");
    assert.equal(
      compatibilityProblems(entry("7.0.0", "Compatibility: upgrade only\n\n- **Breaking for scripts:** flag renamed")).length,
      1,
      "breaking bullet under a non-breaking value",
    );
    assert.equal(compatibilityProblems(entry("6.13.0", "Compatibility: upgrade only\n\n### Fixed\n- x")).length, 0);
  });
});
