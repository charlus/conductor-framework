// test/loop-beat-log.test.js
//
// F11: an agent beat's output was kept nowhere, so a beat that did nothing could
// not be diagnosed once teardown removed its clean worktree. Each beat's output
// is now saved in the main repo's git dir, outside every worktree and never
// committed, and old logs are pruned.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeBeatLog, beatLogName } from "../src/loop/beat-log.js";

test("F11: beatLogName is sortable by time and safe as a file name", () => {
  const name = beatLogName({ now: Date.parse("2026-10-02T10:28:05.382Z"), label: "task:fix-login maker" });
  assert.equal(name, "2026-10-02T10-28-05-382Z-task-fix-login-maker.log");
});

test("F11: writeBeatLog saves exit code, cwd, stdout and stderr, and returns the path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "beatlog-"));
  try {
    const p = await writeBeatLog(dir, {
      now: Date.parse("2026-10-02T10:28:05.382Z"),
      label: "maker beat 2",
      cwd: "/repo/.agents/.worktrees/x",
      result: { exitCode: 0, stdout: "I did nothing.", stderr: "warn: sandbox" },
    });
    const text = await readFile(p, "utf8");
    assert.match(text, /^# maker beat 2/m);
    assert.match(text, /exit code: 0/);
    assert.match(text, /cwd: \/repo\/\.agents\/\.worktrees\/x/);
    assert.match(text, /## stdout\n\nI did nothing\./);
    assert.match(text, /## stderr\n\nwarn: sandbox/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("F11: writeBeatLog keeps only the newest `keep` logs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "beatlog-"));
  try {
    for (let i = 0; i < 5; i++) await writeFile(join(dir, `2026-01-0${i + 1}T00-00-00-000Z-old.log`), "x");
    await writeFile(join(dir, "not-a-log.txt"), "keep me");
    await writeBeatLog(dir, { now: Date.parse("2026-10-02T00:00:00Z"), label: "new", cwd: "/r", result: { exitCode: 1 }, keep: 3 });
    const names = (await readdir(dir)).sort();
    assert.deepEqual(names, [
      "2026-01-04T00-00-00-000Z-old.log",
      "2026-01-05T00-00-00-000Z-old.log",
      "2026-10-02T00-00-00-000Z-new.log",
      "not-a-log.txt",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
