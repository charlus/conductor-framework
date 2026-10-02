// test/loop-field-report.test.js
//
// Regressions for the 6.5.0 field report (F2–F9). Each test names its finding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loopCommand } from "../src/commands/loop.js";

const STATE_REL = "conductor/1-workbench/loop-state.json";

function sink() {
  let text = "";
  return { write: (s) => (text += s), get text() { return text; } };
}

async function withState(state, fn) {
  const dir = await mkdtemp(join(tmpdir(), "conductor-field-"));
  try {
    await mkdir(join(dir, "conductor/1-workbench"), { recursive: true });
    await writeFile(join(dir, STATE_REL), JSON.stringify(state), "utf8");
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// F9: `conductor loop --help` printed the sandbox refusal instead of help.
for (const flag of ["--help", "-h"]) {
  test(`F9: 'loop ${flag}' prints the loop help and exits 0, even with sandbox none`, async () => {
    await withState({ schema_version: 2, sandbox: "none" }, async (dir) => {
      const stdout = sink();
      const stderr = sink();
      const code = await loopCommand([dir, flag], { cwd: dir, stdout, stderr });
      assert.equal(code, 0);
      assert.match(stdout.text, /conductor loop \[target-directory\]/);
      assert.match(stdout.text, /--dry-run/);
      assert.doesNotMatch(stderr.text, /UNSANDBOXED/);
    });
  });
}

test("F9: 'loop --help' works without a loop-state.json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "conductor-field-"));
  try {
    const stdout = sink();
    const code = await loopCommand(["--help"], { cwd: dir, stdout, stderr: sink() });
    assert.equal(code, 0);
    assert.match(stdout.text, /conductor loop/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
