// Conflict prediction + merge-queue ordering (F7).
//
// The swarm discovered conflicts at MERGE time: a worker burned a whole beat,
// passed verify and the Checker, and only then collided — reported as
// "merge failed: unknown". `git merge-tree` answers the same question without
// touching a working tree, so the queue can land the clean branches first and
// escalate the colliding one with the exact file list.
//
// These are the PARSER and ORDERING tests with git injected. The real-git run
// lives in test/conflict-predict-real.sh — per Operating Truth 1, a green test
// here is not evidence that the command behaves as assumed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  parseLegacyMergeTree,
  parseModernMergeTree,
  predictConflicts,
  orderMergeQueue,
} from "../src/loop/conflict.js";

// Verbatim from git 2.34.1. Legacy merge-tree exits 0 either way, so the
// markers are the only signal — reading the exit code would report every
// conflict as clean.
const LEGACY_CONFLICT = `changed in both
  base   100644 83db48f84ec878fbfb30b46d16630e944e34f205 f.txt
  our    100644 f80d8ff774d980e0c4b0899c6f0e6a737b06938e f.txt
  their  100644 39aa102c5896143ea31aaf3404efe59b6b91f62e f.txt
@@ -1,3 +1,7 @@
 line1
+<<<<<<< .our
 AAA
+=======
+BBB
+>>>>>>> .their
 line3
`;

const LEGACY_CLEAN = `merged
  result 100644 5ea2ed416fbd4a4cbe227b75fe255dd7fa6bd4d6 g.txt
  our    100644 e45c9c2666d44e0327c1f9c239a74c508336053e g.txt
@@ -1 +1 @@
-other
+changed
`;

// Both sides changed the same file, but on non-overlapping lines: git merges
// it cleanly. "changed in both" is NOT by itself a conflict.
const LEGACY_BOTH_CHANGED_NO_CONFLICT = `changed in both
  base   100644 aaaaaaa f.txt
  our    100644 bbbbbbb f.txt
  their  100644 ccccccc f.txt
@@ -1,5 +1,5 @@
 line1
-line2
+ours
 line3
-line9
+theirs
`;

describe("F7 — legacy merge-tree parsing (git < 2.38)", () => {
  test("a conflict is detected, and names the colliding file", () => {
    const r = parseLegacyMergeTree(LEGACY_CONFLICT);
    assert.equal(r.conflicted, true);
    assert.deepEqual(r.files, ["f.txt"]);
  });

  test("a clean merge is not reported as a conflict", () => {
    const r = parseLegacyMergeTree(LEGACY_CLEAN);
    assert.equal(r.conflicted, false);
    assert.deepEqual(r.files, []);
  });

  test("'changed in both' without markers is a clean merge", () => {
    // The trap: gating on the section header rather than the markers would
    // report every parallel edit to a shared file as a collision, and the
    // swarm would escalate work that merges fine.
    const r = parseLegacyMergeTree(LEGACY_BOTH_CHANGED_NO_CONFLICT);
    assert.equal(r.conflicted, false);
    assert.deepEqual(r.files, []);
  });

  test("only the conflicted file is named when several changed", () => {
    const r = parseLegacyMergeTree(LEGACY_BOTH_CHANGED_NO_CONFLICT + LEGACY_CONFLICT);
    assert.equal(r.conflicted, true);
    assert.deepEqual(r.files, ["f.txt"]);
  });

  test("empty output is clean", () => {
    assert.deepEqual(parseLegacyMergeTree(""), { conflicted: false, files: [] });
  });
});

describe("F7 — modern merge-tree parsing (git >= 2.38)", () => {
  // NOT exercised against a real git on this machine (2.34.1). The shape is
  // from the documented --write-tree --name-only contract: tree oid on line 1,
  // conflicted paths after it, exit 1 on conflict.
  test("exit 1 means conflict; the paths follow the tree oid", () => {
    const stdout = "a1b2c3d4e5f6\nsrc/api/users.js\nsrc/api/session.js\n";
    const r = parseModernMergeTree(stdout, 1);
    assert.equal(r.conflicted, true);
    assert.deepEqual(r.files, ["src/api/users.js", "src/api/session.js"]);
  });

  test("exit 0 means clean, whatever is on stdout", () => {
    const r = parseModernMergeTree("a1b2c3d4e5f6\n", 0);
    assert.equal(r.conflicted, false);
    assert.deepEqual(r.files, []);
  });

  test("a blank line terminates the path list", () => {
    const stdout = "a1b2c3\nsrc/one.js\n\nAuto-merging src/one.js\n";
    assert.deepEqual(parseModernMergeTree(stdout, 1).files, ["src/one.js"]);
  });
});

describe("F7 — predictConflicts picks a supported form and fails OPEN", () => {
  const gitStub = (responses) => {
    const calls = [];
    const git = async (args) => {
      calls.push(args.join(" "));
      for (const [match, res] of responses) {
        if (args.join(" ").includes(match)) return res;
      }
      return { ok: false, stdout: "", stderr: "", exitCode: 1 };
    };
    return { git, calls };
  };

  test("uses the modern form when git supports it", async () => {
    const { git, calls } = gitStub([
      ["merge-tree --write-tree", { ok: false, exitCode: 1, stdout: "oid\nsrc/a.js\n", stderr: "" }],
    ]);
    const r = await predictConflicts({ git, base: "main", branch: "feat" });
    assert.equal(r.conflicted, true);
    assert.deepEqual(r.files, ["src/a.js"]);
    assert.equal(r.method, "merge-tree");
    assert.ok(!calls.some((c) => c.startsWith("merge-base")), "should not fall back");
  });

  test("falls back to legacy when --write-tree is unsupported", async () => {
    // git 2.34 answers exit 129 + "usage:" — the real signal on this machine.
    const { git, calls } = gitStub([
      ["merge-tree --write-tree", { ok: false, exitCode: 129, stdout: "", stderr: "usage: git merge-tree <base-tree> <branch1> <branch2>" }],
      ["merge-base", { ok: true, exitCode: 0, stdout: "basesha\n", stderr: "" }],
      ["merge-tree basesha", { ok: true, exitCode: 0, stdout: LEGACY_CONFLICT, stderr: "" }],
    ]);
    const r = await predictConflicts({ git, base: "main", branch: "feat" });
    assert.equal(r.method, "merge-tree-legacy");
    assert.equal(r.conflicted, true);
    assert.deepEqual(r.files, ["f.txt"]);
    assert.ok(calls.some((c) => c.startsWith("merge-base")));
  });

  test("an unusable git reports 'unknown', never a false conflict", async () => {
    // Prediction is an optimisation, not a safety gate: the PR-gated merge is
    // still the real one. Guessing 'conflicted' here would strand good work.
    const { git } = gitStub([]);
    const r = await predictConflicts({ git, base: "main", branch: "feat" });
    assert.equal(r.conflicted, false);
    assert.equal(r.method, "unknown");
  });

  test("a missing merge base reports 'unknown', never a false conflict", async () => {
    const { git } = gitStub([
      ["merge-tree --write-tree", { ok: false, exitCode: 129, stdout: "", stderr: "usage: git merge-tree" }],
      ["merge-base", { ok: false, exitCode: 1, stdout: "", stderr: "" }],
    ]);
    const r = await predictConflicts({ git, base: "main", branch: "feat" });
    assert.equal(r.conflicted, false);
    assert.equal(r.method, "unknown");
  });
});

describe("F7 — merge-queue ordering", () => {
  const clean = (id) => ({ task: { id }, prediction: { conflicted: false, files: [] } });
  const collide = (id, files) => ({ task: { id }, prediction: { conflicted: true, files } });

  test("clean branches merge before colliding ones", () => {
    const ordered = orderMergeQueue([collide("t1", ["a.js"]), clean("t2"), clean("t3")]);
    assert.deepEqual(ordered.map((r) => r.task.id), ["t2", "t3", "t1"]);
  });

  test("wave order is preserved within each group (deterministic)", () => {
    // The driver forbids randomness: the same wave must always merge the same
    // way, or a resumed run diverges from the one it is resuming.
    const ordered = orderMergeQueue([
      clean("a"), collide("b", ["x"]), clean("c"), collide("d", ["y"]),
    ]);
    assert.deepEqual(ordered.map((r) => r.task.id), ["a", "c", "b", "d"]);
  });

  test("an unknown prediction is treated as clean, not as a conflict", () => {
    const unknown = { task: { id: "u" }, prediction: { conflicted: false, method: "unknown", files: [] } };
    const ordered = orderMergeQueue([collide("c", ["x"]), unknown]);
    assert.deepEqual(ordered.map((r) => r.task.id), ["u", "c"]);
  });

  test("ordering does not mutate the input array", () => {
    const input = [collide("t1", ["a"]), clean("t2")];
    orderMergeQueue(input);
    assert.deepEqual(input.map((r) => r.task.id), ["t1", "t2"]);
  });
});
