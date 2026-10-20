// src/loop/reconcile.js
//
// Unattended Lifecycle step 2 (docs/roadmap/Unattended-Lifecycle.md). State
// that depends on a merge is carried by the MR or derived from git, never
// written after the merge:
//   - claims come from git: a work item whose loop branch exists on the remote
//     is in progress or in review. Nothing is committed to mark it.
//   - cleanup on the next git touch: a loop worktree whose branch is merged
//     into the default branch is removed, with its local branch.
// Removal is conservative: only a branch provably contained in the default
// branch (`merge-base --is-ancestor`), only a worktree with no uncommitted
// change. A squash-merged branch is not provably merged, so it stays and is
// reported. `git(args) -> {ok, stdout}` is injected; nothing here fetches.

const WORKTREES = "/.agents/.worktrees/";
const LOOP_PREFIX = "conductor/loop/";

/** The default branch to compare with: origin/HEAD, else origin/main|master, else main|master. */
export async function defaultBranchRef(git) {
  const head = await git(["rev-parse", "--abbrev-ref", "origin/HEAD"]);
  if (head.ok && head.stdout && head.stdout !== "origin/HEAD") return head.stdout;
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    if ((await git(["rev-parse", "--verify", "-q", ref])).ok) return ref;
  }
  return null;
}

/** The loop's worktrees: path and branch, from `git worktree list --porcelain`. */
export async function loopWorktrees(git) {
  const list = await git(["worktree", "list", "--porcelain"]);
  if (!list.ok) return [];
  const out = [];
  let cur = {};
  for (const line of `${list.stdout}\n`.split("\n")) {
    if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (line === "") {
      if (cur.path && cur.branch?.startsWith(LOOP_PREFIX) && cur.path.includes(WORKTREES)) out.push(cur);
      cur = {};
    }
  }
  return out;
}

/** Loop worktrees whose branch is contained in the default branch. */
export async function mergedLoopWorktrees({ git }) {
  const base = await defaultBranchRef(git);
  if (!base) return [];
  const merged = [];
  for (const w of await loopWorktrees(git)) {
    if ((await git(["merge-base", "--is-ancestor", w.branch, base])).ok) merged.push({ ...w, base });
  }
  return merged;
}

/**
 * Remove merged loop worktrees and their local branches. A worktree with
 * uncommitted changes is kept, with the reason. Never throws.
 * @returns {Promise<{removed: object[], kept: object[]}>}
 */
export async function pruneMergedLoopWorktrees({ git }) {
  const removed = [];
  const kept = [];
  for (const w of await mergedLoopWorktrees({ git })) {
    const dirty = await git(["-C", w.path, "status", "--porcelain"]);
    if (!dirty.ok || dirty.stdout) {
      kept.push({ ...w, reason: dirty.ok ? "it has uncommitted changes" : "its status could not be read" });
      continue;
    }
    const rm = await git(["worktree", "remove", "--force", w.path]);
    if (!rm.ok) {
      kept.push({ ...w, reason: `git worktree remove failed${rm.stderr ? `: ${rm.stderr.split("\n")[0]}` : ""}` });
      continue;
    }
    await git(["branch", "-q", "-d", w.branch]);
    removed.push(w);
  }
  return { removed, kept };
}

/** The loop branches on the remote, from `git ls-remote`; null when it cannot be read. */
export async function remoteLoopBranches(git) {
  const r = await git(["ls-remote", "--heads", "origin", `${LOOP_PREFIX}*`]);
  if (!r.ok) return null;
  return new Set(
    r.stdout
      .split("\n")
      .map((l) => l.split("\t")[1])
      .filter(Boolean)
      .map((ref) => ref.replace(/^refs\/heads\//, ""))
  );
}

/** Of `branches`, the ones contained in the default branch. */
export async function mergedBranches(git, branches) {
  const base = await defaultBranchRef(git);
  const out = new Set();
  if (!base) return out;
  for (const b of branches) {
    if ((await git(["merge-base", "--is-ancestor", `origin/${b}`, base])).ok) out.add(b);
  }
  return out;
}

/**
 * Claims from git. Pure. An item whose loop branch is on the remote is in
 * progress or in review: skip it. If that branch is already merged but the item
 * is still open, its tick was lost (an MR opened by hand, or a ship before 6.23):
 * skip it too, and name it, so the owner can tick it.
 */
export function skipClaimed(queue, { remoteBranches, mergedBranches: merged = new Set(), branchFor }) {
  const out = { queue: [], inReview: [], mergedButOpen: [] };
  for (const t of queue) {
    const b = branchFor(t);
    if (!remoteBranches?.has(b)) out.queue.push(t);
    else if (merged.has(b)) out.mergedButOpen.push(t);
    else out.inReview.push(t);
  }
  return out;
}
