// src/loop/adapters/codex.js
//
// The Codex platform adapter (ADR-0001 Deferred track — "add Codex later"). Thin
// BYO-CLI wrapper like the others; owns only the CLI invocation. All loop
// guarantees live in the driver. Adjust the exec/flags to your Codex CLI if it
// differs — the interface is what matters.
//
// Interface: name, isAvailable(), runBeat({promptPath,cwd,permissionMode}), runChecker(...)

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export const name = "codex";

/** True if the `codex` CLI is on PATH. */
export async function isAvailable() {
  return await new Promise((resolve) => {
    const p = spawn("codex", ["--version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/** Run one beat: `codex exec <prompt>` (non-interactive) in `cwd`. */
export async function runBeat({ promptPath, cwd = process.cwd() }) {
  const prompt = await readFile(promptPath, "utf8");
  return await new Promise((resolve, reject) => {
    const child = spawn("codex", ["exec", prompt], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr, tokens: 0 }));
  });
}

export async function runChecker(opts) {
  return runBeat(opts);
}
