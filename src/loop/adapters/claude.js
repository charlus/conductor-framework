// src/loop/adapters/claude.js
//
// The Claude Code platform adapter. It owns EXACTLY ONE thing: turning a beat
// request into a headless `claude -p` invocation and returning its raw result.
// Every guarantee (loop control, verification, stall, budget) lives in the
// driver — the adapter is deliberately minimal (BYO-CLI, "thin wrapper", D7).
//
// Interface (shared by all adapters):
//   runBeat({ promptPath, cwd, permissionMode, role, state }) -> { exitCode, stdout, tokens? }
//   runChecker(...)  // separate fresh process — Phase 3, not yet used

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export const name = "claude";

/** True if the `claude` CLI is on PATH (used for default adapter auto-detect). */
export async function isAvailable() {
  return await new Promise((resolve) => {
    const p = spawn("claude", ["--version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Build the `claude` argv for one beat. Pure — extracted so the flag contract
 * is unit-testable without spawning a CLI.
 *
 * `--settings <file>` loads a Conductor-supplied sandbox profile WITHOUT
 * touching the user's own .claude/settings.json. When it enables Anthropic's
 * bubblewrap sandbox with `failIfUnavailable: true`, an unsandboxed beat can't
 * silently happen: claude exits non-zero if the sandbox can't start.
 *
 * `--allowed-tools` is an ALLOWLIST, passed only for a run seeded by untrusted
 * input (E4, `src/loop/untrusted.js`). Every published bypass of this class of
 * agent defeated a *blocklist*, so there is deliberately no blocklist path here.
 *
 * @param {{prompt: string, permissionMode?: string, settingsPath?: string|null,
 *          allowedTools?: string[]|null}} opts
 * @returns {string[]}
 */
export function buildArgv({
  prompt,
  permissionMode = "acceptEdits",
  settingsPath = null,
  allowedTools = null,
}) {
  const argv = ["-p", prompt, "--permission-mode", permissionMode];
  if (settingsPath) argv.push("--settings", settingsPath);
  // An empty array is NOT passed: `--allowed-tools` with no values would be a
  // dangling flag that swallows the next argument.
  if (Array.isArray(allowedTools) && allowedTools.length > 0) {
    argv.push("--allowed-tools", ...allowedTools);
  }
  return argv;
}

/**
 * Run one beat: `claude -p "<prompt>" --permission-mode <mode>` in `cwd`.
 * The agent re-reads the workflow prompt each beat (the soft layer); the driver
 * wraps this call with all deterministic guards.
 */
export async function runBeat({
  promptPath,
  cwd = process.cwd(),
  permissionMode = "acceptEdits",
  settingsPath = null,
  allowedTools = null,
}) {
  const prompt = await readFile(promptPath, "utf8");
  return await new Promise((resolve, reject) => {
    const argv = buildArgv({ prompt, permissionMode, settingsPath, allowedTools });
    const child = spawn("claude", argv, { cwd, stdio: ["ignore", "pipe", "pipe"] });
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
