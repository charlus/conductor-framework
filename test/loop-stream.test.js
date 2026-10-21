// test/loop-stream.test.js
//
// Loop Monitor M3: the claude adapter reads the engine's stream
// (`--output-format stream-json`), reports each tool step while the beat runs,
// and reads its result from the final `result` line, exactly as before. R3: no
// final result line still fails safe (the beat's text is then only what was
// not JSON, such as a usage-limit banner). Fixture: a real 2.1.303 stream, cleaned.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArgv, parseClaudeResult, stepOf, runBeat } from "../src/loop/adapters/claude.js";

const STREAM = readFileSync(new URL("./fixtures/claude-stream.ndjson", import.meta.url), "utf8");

test("the beat asks for the stream", () => {
  const argv = buildArgv({ prompt: "p" });
  assert.equal(argv[argv.indexOf("--output-format") + 1], "stream-json");
  assert.ok(argv.includes("--verbose"), "stream-json needs --verbose with -p");
  assert.deepEqual(argv.slice(-2), ["--", "p"]);
});

test("the result comes from the stream's last result line, and a single JSON object still parses", () => {
  const r = parseClaudeResult(STREAM);
  assert.equal(r.text, "done");
  assert.ok(r.costUsd > 0);
  assert.ok(r.tokens > 0);
  const single = STREAM.trim().split("\n").at(-1);
  assert.equal(parseClaudeResult(single).text, "done");
  assert.equal(parseClaudeResult(STREAM.split("\n").slice(0, 5).join("\n")), null, "no result line: fail safe");
});

test("each tool step, with a short detail", () => {
  const steps = STREAM.split("\n").map(stepOf).filter(Boolean);
  assert.deepEqual(steps.map((s) => s.tool), ["Read", "Bash"]);
  assert.match(steps[0].detail, /a\.txt$/);
  assert.equal(steps[1].detail, "echo hi");
  assert.equal(stepOf('{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"' + "x".repeat(500) + '"}}]}}').detail.length, 120);
  assert.equal(stepOf("not json"), null);
});

test("runBeat reports the steps while the engine streams, and keeps its result", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stream-"));
  const PATH = process.env.PATH;
  try {
    writeFileSync(join(dir, "fixture.ndjson"), STREAM);
    // A stand-in claude that prints the real stream line by line.
    writeFileSync(join(dir, "claude"), `#!/bin/sh\nwhile IFS= read -r l; do printf '%s\\n' "$l"; sleep 0.05; done < "${join(dir, "fixture.ndjson")}"\n`, { mode: 0o755 });
    writeFileSync(join(dir, "prompt.md"), "p");
    process.env.PATH = `${dir}:${PATH}`;
    const steps = [];
    const r = await runBeat({ promptPath: join(dir, "prompt.md"), cwd: dir, onStep: (s) => steps.push(s) });
    assert.deepEqual(steps.map((s) => s.tool), ["Read", "Bash"]);
    assert.equal(r.stdout, "done");
    assert.ok(r.costUsd > 0);
    // The stream without its result line: no result, and the JSON lines are not the beat's text.
    writeFileSync(join(dir, "fixture.ndjson"), `${STREAM.split("\n").slice(0, 4).join("\n")}\nClaude usage limit reached. Your limit will reset at 5pm\n`);
    const cut = await runBeat({ promptPath: join(dir, "prompt.md"), cwd: dir });
    assert.equal(cut.costUsd, null);
    assert.match(cut.stdout, /usage limit reached/);
    assert.doesNotMatch(cut.stdout, /"type"/);
  } finally {
    process.env.PATH = PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
