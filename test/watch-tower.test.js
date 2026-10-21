// test/watch-tower.test.js
//
// The watch tower (A4a): one live screen for every product the loop works on.
// `conductor loop on` registers a product on this machine; `conductor watch
// --all` shows each one's run, beat in progress, last news and waiting questions.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { addLoopProject, listLoopProjects } from "../src/loop/projects-registry.js";

test("the registry adds a product once, by absolute path, outside every repository", async () => {
  const home = mkdtempSync(join(tmpdir(), "reg-"));
  const env = { CONDUCTOR_HOME: home };
  try {
    assert.deepEqual(await listLoopProjects(env), []);
    assert.equal(await addLoopProject("/w/app", env), true);
    assert.equal(await addLoopProject("/w/app/", env), false, "the same folder twice is one product");
    await addLoopProject("/w/site", env);
    assert.deepEqual(await listLoopProjects(env), ["/w/app", "/w/site"]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

const REPO = new URL("..", import.meta.url).pathname;
const at = (min) => new Date(Date.now() - (60 - min) * 60000).toISOString();

function product(base, name, events, round = null) {
  const dir = join(base, name);
  mkdirSync(join(dir, ".git", "conductor-loop-logs"), { recursive: true });
  execFileSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, ".git", "conductor-loop-logs", "events.ndjson"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  if (round) {
    mkdirSync(join(dir, "conductor/1-workbench/questions"), { recursive: true });
    writeFileSync(join(dir, "conductor/1-workbench/questions/task-a.md"), round);
  }
  return dir;
}

test("`conductor loop on` registers the product for the tower, even when nothing else changes", () => {
  const base = mkdtempSync(join(tmpdir(), "tower-reg-"));
  try {
    const root = join(base, "app");
    execFileSync("node", [join(REPO, "bin/conductor.js"), "init", root, "--all", "--no-detect"], { stdio: "pipe" });
    execFileSync("git", ["init", "-q", root]);
    const env = { ...process.env, CONDUCTOR_HOME: join(base, "home") };
    execFileSync("node", [join(REPO, "bin/conductor.js"), "loop", "on", "--backlog", root, "--yes"], { stdio: "pipe", env });
    const r = spawnSync("node", [join(REPO, "bin/conductor.js"), "watch", "--all", "--once"], { encoding: "utf8", env });
    assert.match(r.stdout, /1 product · /);
    assert.match(r.stdout, /── app ·/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("`conductor watch --all --once`: one block per registered product, its run, its beat, its waiting questions", () => {
  const base = mkdtempSync(join(tmpdir(), "tower-"));
  const home = join(base, "home");
  try {
    const a = product(base, "alpha", [
      { run: "r1", at: at(0), type: "run_start", items: ["task:a"] },
      { run: "r1", at: at(30), type: "beat_start", task: "task:a", kind: "maker", model: "sonnet" },
      { run: "r1", at: at(31), type: "step", task: "task:a", kind: "maker", tool: "Bash", detail: "npm test" },
    ]);
    const b = product(base, "beta", [
      { run: "r2", at: at(0), type: "run_start", items: ["task:b"] },
      { run: "r2", at: at(10), type: "questions", task: "task:b", count: 1 },
      { run: "r2", at: at(10), type: "run_end", status: "awaiting_answers" },
    ], "# Questions: task:b (build)\n\n## Q1. Which?\nC.\n\n1. A — a\n2. B — b\n\n**Recommendation:** 1, because c\n**If wrong:** d\n\nAnswer:\n");
    const c = join(base, "gamma");
    mkdirSync(c);
    execFileSync("git", ["init", "-q", c]);
    const env = { ...process.env, CONDUCTOR_HOME: home };
    for (const d of [a, b, c]) {
      mkdirSync(home, { recursive: true });
    }
    writeFileSync(join(home, "loop-projects.json"), JSON.stringify({ projects: [a, b, c, join(base, "deleted-since")] }));
    const r = spawnSync("node", [join(REPO, "bin/conductor.js"), "watch", "--all", "--once"], { encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /alpha[\s\S]*now: Build beat on sonnet[\s\S]*last step \d\d:\d\d: Bash: npm test/);
    assert.match(r.stdout, /beta[\s\S]*Run ended \d\d:\d\d: awaiting_answers[\s\S]*1 question round waiting for you/);
    assert.match(r.stdout, /gamma[\s\S]*No loop run recorded/);
    assert.match(r.stdout, /3 products · 1 running · 1 waiting for you/);
    const none = spawnSync("node", [join(REPO, "bin/conductor.js"), "watch", "--all", "--once"], { encoding: "utf8", env: { ...process.env, CONDUCTOR_HOME: join(base, "empty") } });
    assert.match(none.stdout, /No product registered[\s\S]*conductor loop on/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
