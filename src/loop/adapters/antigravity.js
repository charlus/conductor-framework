// src/loop/adapters/antigravity.js
//
// The Antigravity platform adapter. Conductor was originally Antigravity-first;
// the V5 stub hardcoded `antigravity run workflows/unattended-loop.md` inside the
// driver. Phase 2 demotes that to just another adapter behind the shared
// interface — the driver no longer knows any platform name.
//
// Interface (shared by all adapters):
//   name, isAvailable(), runBeat({ promptPath, cwd, permissionMode }), runChecker(...)

import { spawn } from "node:child_process";

export const name = "antigravity";

/** True if the `antigravity` CLI is on PATH. */
export async function isAvailable() {
  return await new Promise((resolve) => {
    const p = spawn("antigravity", ["--version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Run one beat: `antigravity run <promptPath>` in `cwd`. Antigravity discovers
 * the workflow file directly, so we pass the path (not the prompt body).
 * `permissionMode` is accepted for interface parity; Antigravity manages its own
 * permission surface, so it is currently advisory here.
 */
export async function runBeat({ promptPath, cwd = process.cwd() }) {
  return await new Promise((resolve, reject) => {
    const child = spawn("antigravity", ["run", promptPath], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr, tokens: 0 });
    });
  });
}

// Phase 3: a Checker in a separate fresh process for structural independence.
export async function runChecker(opts) {
  return runBeat(opts);
}
