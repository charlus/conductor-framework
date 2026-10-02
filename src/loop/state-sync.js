// src/loop/state-sync.js
//
// F15: give an agent beat the driver's LIVE loop-state.json. A worktree checks
// out the committed state file, not the driver's live one, so with conductor/
// tracked (the common setup) the agent read an old goal and phase and refused to
// work. The driver copies the live state into the worktree before every maker
// and checker beat, and hides the copy from git so it never reaches a commit or
// a PR:
//   tracked     → `git update-index --skip-worktree` (per-worktree index)
//   gitignored  → already invisible
//   untracked   → listed in info/exclude
// The driver never reads the worktree copy back: the root file stays the truth.
// The driver's signal files (maker-signal.json, checker-verdict.json) are hidden
// the same way (F18).

import { copyFile, mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { VERDICT_REL } from "./checker.js";

export const STATE_REL = "conductor/1-workbench/loop-state.json";
export const MAKER_SIGNAL_REL = "conductor/1-workbench/maker-signal.json";

// F18: the driver's own files in a worktree. The auto-capture commit used to
// sweep the signal files into the branch, so the PR carried them.
const DRIVER_FILES = [STATE_REL, MAKER_SIGNAL_REL, VERDICT_REL];

/**
 * Copy the root's live loop-state.json into the worktree at `cwd`, and hide it
 * and the driver's signal files from git. `git(args) -> {ok, stdout}` runs in
 * `cwd`. No-op when `cwd` is the root.
 */
export async function syncLoopStateInto({ root, cwd, git }) {
  if (resolve(cwd) === resolve(root)) return;
  const dst = join(cwd, STATE_REL);
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(join(root, STATE_REL), dst);
  for (const rel of DRIVER_FILES) await hideFromGit(rel, { cwd, git });
}

/** Make `rel` invisible to git in this worktree, whether tracked, ignored or untracked. */
async function hideFromGit(rel, { cwd, git }) {
  if ((await git(["ls-files", "--error-unmatch", "--", rel])).ok) {
    await git(["update-index", "--skip-worktree", "--", rel]);
    return;
  }
  if ((await git(["check-ignore", "-q", "--", rel])).ok) return;

  const excludeRel = await git(["rev-parse", "--git-path", "info/exclude"]);
  if (!excludeRel.ok) return;
  const exclude = resolve(cwd, excludeRel.stdout);
  const line = `/${rel}`;
  let current = "";
  try {
    current = await readFile(exclude, "utf8");
  } catch {
    await mkdir(dirname(exclude), { recursive: true });
  }
  if (!current.split("\n").includes(line)) {
    await appendFile(exclude, `${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`, "utf8");
  }
}
