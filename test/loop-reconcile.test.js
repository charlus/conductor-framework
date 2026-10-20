// test/loop-reconcile.test.js
//
// Unattended Lifecycle step 2 (docs/roadmap/Unattended-Lifecycle.md):
//   - claims come from git: an item whose loop branch is on the remote is in
//     progress or in review, so the harvester skips it. The loop no longer
//     commits 🤖 claim markers into the owner's checkout.
//   - reconcile on the next git touch: loop worktrees and local branches already
//     merged into the default branch are removed. Never one with uncommitted
//     work, never one whose branch is not provably merged.
// Real git in temp repos: this is a git behaviour, not a stub's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pruneMergedLoopWorktrees, mergedLoopWorktrees, skipClaimed, defaultBranchRef } from "../src/loop/reconcile.js";

const G = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: "pipe" }).toString().trim();
const git = (cwd) => async (args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
};

function setup() {
  const base = mkdtempSync(join(tmpdir(), "reconcile-"));
  const bare = join(base, "origin.git");
  const repo = join(base, "repo");
  execFileSync("git", ["init", "-q", "--bare", "-b", "master", bare]);
  execFileSync("git", ["clone", "-q", bare, repo], { stdio: "pipe" });
  G(repo, "config", "user.email", "t@t");
  G(repo, "config", "user.name", "t");
  writeFileSync(join(repo, "a.txt"), "a\n");
  G(repo, "add", "-A");
  G(repo, "commit", "-qm", "init");
  G(repo, "push", "-q", "-u", "origin", "master");
  G(repo, "remote", "set-head", "origin", "master");
  return { base, repo };
}

function loopWorktree(repo, name) {
  const path = join(repo, ".agents/.worktrees", name);
  G(repo, "worktree", "add", "-q", "-b", `conductor/loop/${name}`, path);
  writeFileSync(join(path, `${name}.txt`), "work\n");
  G(path, "add", "-A");
  G(path, "commit", "-qm", `work ${name}`);
  G(path, "push", "-q", "-u", "origin", `conductor/loop/${name}`);
  return path;
}

test("a merged loop worktree is removed; unmerged and dirty ones are kept", async () => {
  const { base, repo } = setup();
  try {
    const merged = loopWorktree(repo, "merged");
    const open = loopWorktree(repo, "open");
    const dirty = loopWorktree(repo, "dirty");
    // The owner merges two MRs on the forge; the third stays open.
    G(repo, "merge", "-q", "--no-ff", "-m", "merge", "conductor/loop/merged", "conductor/loop/dirty");
    G(repo, "push", "-q", "origin", "master");
    writeFileSync(join(dirty, "uncommitted.txt"), "not committed\n");
    G(repo, "fetch", "-q", "origin");

    assert.equal(await defaultBranchRef(git(repo)), "origin/master");
    const found = await mergedLoopWorktrees({ git: git(repo) });
    assert.deepEqual(found.map((w) => w.branch).sort(), ["conductor/loop/dirty", "conductor/loop/merged"]);

    const pruned = await pruneMergedLoopWorktrees({ git: git(repo) });
    assert.deepEqual(pruned.removed.map((w) => w.branch), ["conductor/loop/merged"]);
    assert.deepEqual(pruned.kept.map((w) => w.branch), ["conductor/loop/dirty"]);
    assert.match(pruned.kept[0].reason, /uncommitted/);
    assert.equal(existsSync(merged), false);
    assert.equal(existsSync(open), true, "an open MR's worktree stays");
    assert.equal(existsSync(dirty), true, "uncommitted work is never removed");
    assert.equal(G(repo, "branch", "--list", "conductor/loop/merged"), "", "the merged local branch is deleted");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("skipClaimed leaves out items whose loop branch is on the remote, and names merged-but-open ones", () => {
  const queue = [{ id: "task:a" }, { id: "task:b" }, { id: "task:c" }];
  const branchFor = (t) => `conductor/loop/loop-${t.id.replace(/[^a-z0-9]+/g, "-")}`;
  const r = skipClaimed(queue, {
    remoteBranches: new Set(["conductor/loop/loop-task-a", "conductor/loop/loop-task-c"]),
    mergedBranches: new Set(["conductor/loop/loop-task-c"]),
    branchFor,
  });
  assert.deepEqual(r.queue.map((t) => t.id), ["task:b"]);
  assert.deepEqual(r.inReview.map((t) => t.id), ["task:a"]);
  assert.deepEqual(r.mergedButOpen.map((t) => t.id), ["task:c"]);
});

test("the post-merge hook removes a merged loop worktree when the owner pulls", () => {
  const { base, repo } = setup();
  try {
    const hooks = join(repo, ".agents/hooks");
    execFileSync("mkdir", ["-p", hooks]);
    for (const f of ["post-merge", "lib.sh"]) {
      writeFileSync(join(hooks, f), execFileSync("cat", [new URL(`../templates/.agents/hooks/${f}`, import.meta.url).pathname]));
    }
    execFileSync("chmod", ["+x", join(hooks, "post-merge")]);
    const path = loopWorktree(repo, "shipped");
    // The merge happens on the forge, here a second clone.
    const forge = join(base, "forge");
    execFileSync("git", ["clone", "-q", join(base, "origin.git"), forge], { stdio: "pipe" });
    G(forge, "config", "user.email", "t@t");
    G(forge, "config", "user.name", "t");
    G(forge, "merge", "-q", "--no-ff", "-m", "merge MR", "origin/conductor/loop/shipped");
    G(forge, "push", "-q", "origin", "master");
    G(repo, "config", "core.hooksPath", ".agents/hooks");
    const out = execFileSync("git", ["pull", "-q", "--no-rebase", "origin", "master"], { cwd: repo, stdio: "pipe" }).toString();
    assert.equal(existsSync(path), false, `the worktree is still there; hook said: ${out}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("conductor status names merged loop worktrees and deletes nothing", async () => {
  const { base, repo } = setup();
  try {
    const { initCommand } = await import("../src/commands/init.js");
    const { statusCommand } = await import("../src/commands/status.js");
    const sink = () => ({ text: "", write(s) { this.text += s; } });
    await initCommand([repo, "--all", "--no-detect"], { cwd: tmpdir(), stdout: sink(), stderr: sink() });
    const path = loopWorktree(repo, "done");
    G(repo, "merge", "-q", "--no-ff", "-m", "merge", "conductor/loop/done");
    G(repo, "push", "-q", "origin", "master");
    G(repo, "fetch", "-q", "origin");
    const out = sink();
    await statusCommand([repo, "--no-color"], { cwd: repo, stdout: out, stderr: sink() });
    assert.match(out.text, /1 merged loop worktree \(conductor\/loop\/done\)/);
    assert.equal(existsSync(path), true, "status never deletes");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("step 7: a merged outer worktree that still holds a code worktree is kept, by the loop and by the post-merge hook", async () => {
  const { base, repo } = setup();
  try {
    const hooks = join(repo, ".agents/hooks");
    execFileSync("mkdir", ["-p", hooks]);
    for (const f of ["post-merge", "lib.sh"]) writeFileSync(join(hooks, f), execFileSync("cat", [new URL(`../templates/.agents/hooks/${f}`, import.meta.url).pathname]));
    execFileSync("chmod", ["+x", join(hooks, "post-merge")]);
    const path = loopWorktree(repo, "slice");
    // The code worktree of another repository, inside the outer one (gitignored there).
    const code = join(base, "code");
    G(base, "init", "-q", "-b", "main", "code");
    G(code, "config", "user.email", "t@t");
    G(code, "config", "user.name", "t");
    writeFileSync(join(code, "a.py"), "a\n");
    G(code, "add", "-A");
    G(code, "commit", "-qm", "init");
    G(code, "worktree", "add", "-q", "-b", "conductor/loop/slice", join(path, "repo"));
    const forge = join(base, "forge");
    execFileSync("git", ["clone", "-q", join(base, "origin.git"), forge], { stdio: "pipe" });
    G(forge, "config", "user.email", "t@t");
    G(forge, "config", "user.name", "t");
    G(forge, "merge", "-q", "--no-ff", "-m", "merge state MR", "origin/conductor/loop/slice");
    G(forge, "push", "-q", "origin", "master");
    G(repo, "fetch", "-q", "origin");

    const keep = async (w) => (existsSync(join(w.path, "repo", ".git")) ? "its code worktree is still open" : null);
    const pruned = await pruneMergedLoopWorktrees({ git: git(repo), skip: keep });
    assert.deepEqual(pruned.removed, []);
    assert.match(pruned.kept[0].reason, /code worktree/);

    G(repo, "config", "core.hooksPath", ".agents/hooks");
    execFileSync("git", ["pull", "-q", "--no-rebase", "origin", "master"], { cwd: repo, stdio: "pipe" });
    assert.equal(existsSync(join(path, "repo", "a.py")), true, "the pull did not delete the open code worktree");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
