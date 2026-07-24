// src/loop/autocommit.js
//
// Commit-before-teardown backstop (Loop-Robustness P0.1). The single fix that
// closes the observed data-loss chain: a Maker that creates files but skips its
// `git commit` would otherwise (a) let verify pass on the working tree while the
// committed diff stays empty, (b) leave the Checker with no diff to review, and
// (c) have its work destroyed when the worktree is force-removed on teardown.
//
// After every Maker beat the IO shell calls this to capture any uncommitted
// change into a commit, so the rest of the pipeline sees real, durable work. It
// is a no-op when the tree is already clean (the Maker committed properly).
//
// Inspired by agentctl's `ag-merge` auto_commit (stage → conventional message →
// commit). Pure over an injected git runner: `git(args) -> {ok, stdout}`.

/** Build a conventional-commit message for an auto-captured beat. Deterministic. */
export function autoCommitMessage({ role = "maker", beat, goal } = {}) {
  const scope = role || "loop";
  const g = String(goal ?? "").trim().replace(/\s+/g, " ");
  const subject = g ? g.slice(0, 60) : "unattended beat";
  const beatStr = beat != null ? ` (beat ${beat})` : "";
  return `chore(${scope}): auto-capture ${subject}${beatStr}`;
}

/**
 * Stage and commit any uncommitted changes reachable by `git`. No-op on a clean
 * tree. If a commit hook (e.g. the TDD pre-commit) rejects the commit, the work
 * is captured anyway with `--no-verify` and the bypass is reported — the backstop
 * exists to prevent LOSS; the Checker + `awaiting_review` remain the quality gate
 * (mirrors the enforcement hooks' own logged-bypass philosophy).
 *
 * @param {{git:(args:string[])=>Promise<{ok:boolean,stdout:string}>, message:string}} opts
 * @returns {Promise<{committed:boolean, bypassedHooks:boolean, reason:string}>}
 */
export async function autoCommit({ git, message }) {
  const status = await git(["status", "--porcelain"]);
  if (!status.ok) return { committed: false, bypassedHooks: false, reason: "git status failed" };
  if (status.stdout.trim() === "") {
    return { committed: false, bypassedHooks: false, reason: "working tree clean — nothing to capture" };
  }
  const add = await git(["add", "-A"]);
  if (!add.ok) return { committed: false, bypassedHooks: false, reason: "git add failed" };

  const commit = await git(["commit", "-m", message]);
  if (commit.ok) {
    return { committed: true, bypassedHooks: false, reason: "captured uncommitted maker changes" };
  }
  // A hook or other pre-commit check rejected it. Losing the work is worse than
  // capturing it for review — commit anyway, flagged, so the bypass is auditable.
  const forced = await git(["commit", "--no-verify", "-m", `${message} [hook-bypassed]`]);
  return forced.ok
    ? { committed: true, bypassedHooks: true, reason: "captured maker changes (commit hook bypassed to avoid work loss)" }
    : { committed: false, bypassedHooks: false, reason: "git commit failed even with --no-verify" };
}
