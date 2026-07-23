// src/loop/worktree.js
//
// Deterministic git-worktree lifecycle for the loop's Maker (ADR-0001 / Phase 3).
// The Maker runs in an isolated worktree so an unattended run never mutates the
// user's checkout directly; verification and the Checker run against that same
// isolated tree. Merging the branch back is Phase 4's PR-gated merge queue —
// this module deliberately does NOT merge. On teardown it removes the worktree
// only when it holds no unique commits; otherwise it is kept for the human /
// the merge queue and the caller is told.
//
// All git IO is injected as `git(argsArray) -> {ok, stdout}` so the pure naming
// logic and the lifecycle branching are unit-testable without a real repo.

import { join } from "node:path";

const WORKTREES_DIR = ".agents/.worktrees";

/** kebab-slug of a goal, bounded, safe for a branch/dir name. Deterministic. */
export function slugify(text, fallback = "loop") {
  const slug = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

/** Stable worktree branch + path for a run. No randomness (driver constraint). */
export function worktreePlan(root, goalDescription) {
  const slug = slugify(goalDescription);
  const branch = `conductor/loop/${slug}`;
  const path = join(root, WORKTREES_DIR, slug);
  return { branch, path, slug };
}

/**
 * Create (or reuse) the Maker's worktree on a dedicated branch.
 * @returns {Promise<{path:string, branch:string, created:boolean}>}
 */
export async function createWorktree({ root, goalDescription, git }) {
  const { branch, path } = worktreePlan(root, goalDescription);

  // Already registered? Reuse it (idempotent across resumes).
  const list = await git(["worktree", "list", "--porcelain"]);
  if (list.ok && list.stdout.includes(path)) {
    return { path, branch, created: false };
  }

  // Prefer a new branch; fall back to attaching if the branch already exists.
  let add = await git(["worktree", "add", "-b", branch, path]);
  if (!add.ok) add = await git(["worktree", "add", path, branch]);
  if (!add.ok) {
    throw new Error(`Failed to create worktree at ${path} (branch ${branch}).`);
  }
  return { path, branch, created: true };
}

/** True if `branch` has commits not reachable from `baseBranch` (unmerged work). */
export async function hasUniqueCommits({ git, branch, baseBranch = "HEAD" }) {
  const res = await git(["rev-list", "--count", `${baseBranch}..${branch}`]);
  if (!res.ok) return true; // unknown → err on the side of keeping it
  return Number.parseInt(res.stdout.trim() || "0", 10) > 0;
}

/**
 * Tear down the worktree — but ONLY if it has no unique commits. If it does, the
 * work is preserved for the human / Phase 4 merge queue.
 * @returns {Promise<{removed:boolean, reason:string}>}
 */
export async function teardownWorktree({ root, goalDescription, git, baseBranch = "HEAD" }) {
  const { branch, path } = worktreePlan(root, goalDescription);

  const list = await git(["worktree", "list", "--porcelain"]);
  if (!list.ok || !list.stdout.includes(path)) {
    return { removed: false, reason: "no worktree registered" };
  }

  // P0.2 (Loop-Robustness): never `--force`-drop uncommitted work. A dirty tree
  // is kept for the human regardless of commit count — a Maker that created files
  // but never committed them would otherwise have them destroyed here. If the
  // status probe itself fails we also keep, erring on the side of no data loss.
  const dirty = await git(["-C", path, "status", "--porcelain"]);
  if (!dirty.ok) {
    return { removed: false, reason: `could not check ${path} status — kept to avoid data loss` };
  }
  if (dirty.stdout.trim() !== "") {
    return { removed: false, reason: `worktree ${path} has uncommitted changes — kept (not force-removed)` };
  }

  if (await hasUniqueCommits({ git, branch, baseBranch })) {
    return {
      removed: false,
      reason: `worktree ${path} (branch ${branch}) has unmerged commits — kept for merge`,
    };
  }

  const rm = await git(["worktree", "remove", path, "--force"]);
  return rm.ok
    ? { removed: true, reason: `removed clean worktree ${path}` }
    : { removed: false, reason: `git worktree remove failed for ${path}` };
}
