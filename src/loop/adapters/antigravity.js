// src/loop/adapters/antigravity.js
//
// The Antigravity platform adapter. Conductor was originally Antigravity-first;
// the V5 stub hardcoded `antigravity run workflows/unattended-loop.md` inside the
// driver. Phase 2 demotes that to just another adapter behind the shared
// interface — the driver no longer knows any platform name.
//
// NB: the Antigravity CLI binary is `agy` (verified against agy 1.1.6), NOT
// `antigravity`, and there is no `run` subcommand — non-interactive execution is
// `agy --print "<prompt>"`. Its flag surface is claude-derived, so permission
// mode maps directly: claude `acceptEdits`/`plan` → agy `--mode accept-edits`/
// `plan`. This matters for the Checker: it must run write-capable or it can never
// write checker-verdict.json (the exact bug that bit the claude adapter live).
//
// Interface (shared by all adapters):
//   name, isAvailable(), runBeat({ promptPath, cwd, permissionMode, sandbox }), runChecker(...)

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export const name = "antigravity";

/** The actual CLI binary (the platform is "antigravity"; the binary is "agy"). */
export const CLI = "agy";

/** Map the shared permission mode onto agy's `--mode` values. Non-plan ⇒ writable
 *  (accept-edits) so makers AND checkers can write their signal/verdict files. */
export function mapMode(permissionMode) {
  return permissionMode === "plan" ? "plan" : "accept-edits";
}

/** Pure argv builder for one beat — unit-testable without spawning a process. */
export function beatArgs({ prompt, permissionMode = "acceptEdits", sandbox = false } = {}) {
  const argv = ["--print", prompt, "--mode", mapMode(permissionMode)];
  if (sandbox) argv.push("--sandbox");
  return argv;
}

/** True if the `agy` CLI is on PATH. */
export async function isAvailable() {
  return await new Promise((resolve) => {
    const p = spawn(CLI, ["--version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Run one beat: `agy --print "<prompt>" --mode <accept-edits|plan>` in `cwd`.
 * The prompt BODY is passed (agy has no workflow-file discovery), mirroring the
 * codex adapter. `sandbox: true` adds agy's `--sandbox` (terminal restrictions).
 */
export async function runBeat({ promptPath, cwd = process.cwd(), permissionMode = "acceptEdits", sandbox = false }) {
  const prompt = await readFile(promptPath, "utf8");
  return await new Promise((resolve, reject) => {
    const child = spawn(CLI, beatArgs({ prompt, permissionMode, sandbox }), {
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
