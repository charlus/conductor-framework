// src/loop/merge.js
//
// PR-gated merge for the loop (ADR-0001 D4 / Phase 4). The driver NEVER pushes to
// a protected branch: on an L3 execution completion it pushes the Maker's worktree
// branch and opens a pull/merge request, gated by the green floor + Checker
// approval already established upstream. A human (or a separate CI merge policy)
// does the actual merge. Reuses the `gh` / `glab` CLIs (the same tools the
// git-hub-cli / git-lab-cli skills use), auto-detecting whichever is present.
//
// The `git(args) -> {ok, stdout}` runner is injected so the decision + command
// shape are testable without a real remote.

/** Pure: what should happen on completion at this level/phase? */
export function planMergeAction({ autonomyLevel, phase }) {
  const rank = { L0: 0, L1: 1, L2: 2, L3: 3 }[autonomyLevel] ?? 1;
  if (phase === "execution" && rank >= 3) return "pr";
  return "none"; // L1/L2 and non-execution hand off to the human without merging
}

/** Which forge CLI to use, given availability probes. */
export function pickForgeCli({ hasGh, hasGlab }) {
  if (hasGh) return "gh";
  if (hasGlab) return "glab";
  return null;
}

/** The argv for opening a PR/MR on the chosen forge (pure — for testing). */
export function prCommand(forge, { branch, title }) {
  if (forge === "gh") {
    return ["gh", ["pr", "create", "--head", branch, "--title", title, "--fill"]];
  }
  if (forge === "glab") {
    return ["glab", ["mr", "create", "--source-branch", branch, "--title", title, "--fill"]];
  }
  throw new Error(`Unknown forge '${forge}'`);
}

/**
 * Push the branch and open a PR/MR. Injected IO:
 *   git(args) -> {ok, stdout}
 *   run(cmd, args) -> {ok, stdout}   (for gh/glab)
 *   hasGh / hasGlab: booleans
 * @returns {Promise<{ok:boolean, branch?:string, prUrl?:string, reason?:string}>}
 */
export async function openPullRequest({ branch, title, git, run, hasGh, hasGlab }) {
  const forge = pickForgeCli({ hasGh, hasGlab });
  if (!forge) {
    return { ok: false, reason: "no 'gh' or 'glab' CLI on PATH to open a PR" };
  }

  // Push the branch (set upstream). Never touch a protected branch directly.
  const push = await git(["push", "-u", "origin", branch]);
  if (!push.ok) {
    return { ok: false, branch, reason: `git push failed for ${branch}` };
  }

  const [cmd, argv] = prCommand(forge, { branch, title });
  const pr = await run(cmd, argv);
  if (!pr.ok) {
    return { ok: false, branch, reason: `${forge} failed to open the PR/MR` };
  }
  // gh/glab print the PR/MR URL on stdout.
  const url = (pr.stdout || "").trim().split(/\s+/).find((t) => t.startsWith("http")) || null;
  return { ok: true, branch, prUrl: url };
}
