// test/loop-robustness.test.js
//
// Loop-Robustness P0/P1 regression guards (docs/roadmap/Loop-Robustness-Plan.md).
// Covers the data-loss chain from the first real end-to-end run: the commit
// backstop, the teardown dirty-tree guard, and diagnosable Checker verdicts. All
// pure / stub-injected git — no real repo, no agent CLI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { autoCommit, autoCommitMessage } from "../src/loop/autocommit.js";
import { teardownWorktree } from "../src/loop/worktree.js";
import { tallyVerdicts } from "../src/loop/checker.js";

/** A scripted git runner: maps args[0] (or a matcher) to canned {ok,stdout}. */
function stubGit(script) {
  const calls = [];
  const git = async (args) => {
    calls.push(args.join(" "));
    for (const rule of script) {
      if (rule.match(args)) return rule.result(args, calls);
    }
    return { ok: true, stdout: "" };
  };
  git.calls = calls;
  return git;
}

// ---- P0.1 autoCommit -------------------------------------------------------

test("autoCommit: clean tree is a no-op (nothing to capture)", async () => {
  const git = stubGit([{ match: (a) => a[1] === "--porcelain" && a[0] === "status", result: () => ({ ok: true, stdout: "" }) }]);
  const r = await autoCommit({ git, message: "m" });
  assert.equal(r.committed, false);
  assert.match(r.reason, /clean/);
  assert.ok(!git.calls.some((c) => c.startsWith("commit")), "must not commit a clean tree");
});

test("autoCommit: dirty tree is staged and committed", async () => {
  const git = stubGit([
    { match: (a) => a[0] === "status", result: () => ({ ok: true, stdout: " M hello.txt" }) },
    { match: (a) => a[0] === "add", result: () => ({ ok: true, stdout: "" }) },
    { match: (a) => a[0] === "commit", result: () => ({ ok: true, stdout: "" }) },
  ]);
  const r = await autoCommit({ git, message: "capture" });
  assert.equal(r.committed, true);
  assert.equal(r.bypassedHooks, false);
  assert.ok(git.calls.includes("add -A"));
  assert.ok(git.calls.some((c) => c.startsWith("commit -m")));
});

test("autoCommit: a rejecting commit hook is bypassed to avoid work loss (flagged)", async () => {
  let commitAttempts = 0;
  const git = stubGit([
    { match: (a) => a[0] === "status", result: () => ({ ok: true, stdout: "?? new.js" }) },
    { match: (a) => a[0] === "add", result: () => ({ ok: true, stdout: "" }) },
    {
      match: (a) => a[0] === "commit",
      result: (a) => {
        commitAttempts++;
        // First attempt (hooked) fails; the --no-verify retry succeeds.
        return a.includes("--no-verify") ? { ok: true, stdout: "" } : { ok: false, stdout: "pre-commit rejected" };
      },
    },
  ]);
  const r = await autoCommit({ git, message: "capture" });
  assert.equal(r.committed, true);
  assert.equal(r.bypassedHooks, true);
  assert.equal(commitAttempts, 2);
});

test("autoCommit: a failing git status fails safe (does not commit)", async () => {
  const git = stubGit([{ match: (a) => a[0] === "status", result: () => ({ ok: false, stdout: "" }) }]);
  const r = await autoCommit({ git, message: "m" });
  assert.equal(r.committed, false);
});

test("autoCommitMessage: deterministic, bounded, conventional", () => {
  const m = autoCommitMessage({ role: "maker", beat: 3, goal: "x".repeat(200) });
  assert.match(m, /^chore\(maker\): auto-capture /);
  assert.match(m, /\(beat 3\)$/);
  // subject is bounded to 60 chars of goal
  assert.ok(m.length < 120, `message should be bounded, got ${m.length}`);
  assert.equal(autoCommitMessage(), "chore(maker): auto-capture unattended beat");
});

// ---- P0.2 teardown dirty-tree guard ---------------------------------------

const WT = "/repo/.agents/.worktrees/add-search";

test("teardownWorktree: a DIRTY worktree is kept, even with zero unique commits", async () => {
  const git = stubGit([
    { match: (a) => a[0] === "worktree" && a[1] === "list", result: () => ({ ok: true, stdout: `worktree ${WT}` }) },
    { match: (a) => a[0] === "-C" && a.includes("status"), result: () => ({ ok: true, stdout: " M hello.txt" }) },
    { match: (a) => a[0] === "rev-list", result: () => ({ ok: true, stdout: "0" }) },
    { match: (a) => a[0] === "worktree" && a[1] === "remove", result: () => ({ ok: true, stdout: "" }) },
  ]);
  const r = await teardownWorktree({ root: "/repo", goalDescription: "Add search", git });
  assert.equal(r.removed, false);
  assert.match(r.reason, /uncommitted changes/);
  assert.ok(!git.calls.some((c) => c.startsWith("worktree remove")), "must NOT force-remove a dirty worktree");
});

test("teardownWorktree: an unreadable status keeps the worktree (no data loss)", async () => {
  const git = stubGit([
    { match: (a) => a[0] === "worktree" && a[1] === "list", result: () => ({ ok: true, stdout: `worktree ${WT}` }) },
    { match: (a) => a[0] === "-C" && a.includes("status"), result: () => ({ ok: false, stdout: "" }) },
  ]);
  const r = await teardownWorktree({ root: "/repo", goalDescription: "Add search", git });
  assert.equal(r.removed, false);
  assert.match(r.reason, /could not check/);
});

test("teardownWorktree: a CLEAN worktree with no unique commits is still removed", async () => {
  const git = stubGit([
    { match: (a) => a[0] === "worktree" && a[1] === "list", result: () => ({ ok: true, stdout: `worktree ${WT}` }) },
    { match: (a) => a[0] === "-C" && a.includes("status"), result: () => ({ ok: true, stdout: "" }) },
    { match: (a) => a[0] === "rev-list", result: () => ({ ok: true, stdout: "0" }) },
    { match: (a) => a[0] === "worktree" && a[1] === "remove", result: () => ({ ok: true, stdout: "" }) },
  ]);
  const r = await teardownWorktree({ root: "/repo", goalDescription: "Add search", git });
  assert.equal(r.removed, true);
});

// ---- P1.2 diagnosable checker verdicts ------------------------------------

test("tallyVerdicts: exposes per-vote reasons in order", () => {
  const t = tallyVerdicts(
    [
      { approved: false, reason: "no verdict file written by Checker" },
      { approved: false, reason: "Checker did not approve" },
    ],
    2
  );
  assert.equal(t.approved, false);
  assert.deepEqual(t.reasons, ["no verdict file written by Checker", "Checker did not approve"]);
});

test("tallyVerdicts: still approves on a strict majority (regression)", () => {
  const yes = { approved: true, reason: "ok" };
  const no = { approved: false, reason: "gap" };
  assert.equal(tallyVerdicts([yes, yes, no], 3).approved, true);
  assert.equal(tallyVerdicts([yes, no], 2).approved, false);
});
