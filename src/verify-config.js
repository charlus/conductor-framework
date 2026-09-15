// src/verify-config.js
//
// Make sure a project's push gate has a command to run — or say loudly that it
// does not. Shared by `init` and `upgrade`.
//
// WHY. The Verification Iron Law is enforced by `pre-push` running the
// `verify` command from `conductor.config.json`. Measured 2026-09-15 across the
// maintainer's five live projects: ONE had a command. Everywhere else the hook
// printed a one-line "Skipping verify." and the framework's central enforcement
// bet was not running — and nobody noticed, because the message read as
// informational. The maintainer's reaction to the sibling eval message was
// "What should I do I don't understand".
//
// Two rules: derive when the files make it deterministic (`suggestVerifyCommand`),
// never guess; and when nothing can be derived, the warning names the key, the
// file, an example value, and what is NOT enforced until it is set.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { suggestVerifyCommand } from "./detect.js";

export const CONFIG_FILE = "conductor.config.json";

export const NO_VERIFY_WARNING =
  "\n⚠️  No verify command could be derived from this project's files.\n" +
  "   Until \"verify\" is set in conductor.config.json, pre-push cannot enforce the\n" +
  "   Verification Iron Law — pushes will go through untested.\n" +
  '   Add it now, e.g.  "verify": "npm test"   or   "verify": "python -m pytest -q"\n' +
  "   `conductor status` shows the push-gate state.\n";

/**
 * Read conductor.config.json, fill `verify` from the project's files when it is
 * empty and derivable, and report. Never overwrites a command that is set.
 *
 * @param {string} targetDir project root
 * @param {{write: (s: string) => void}} stdout
 * @returns {Promise<{command: string, source: "configured"|"derived"|"none"}>}
 */
export async function ensureVerifyCommand(targetDir, stdout) {
  const cfgPath = join(targetDir, CONFIG_FILE);
  let cfg = {};
  try {
    const parsed = JSON.parse(await readFile(cfgPath, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) cfg = parsed;
  } catch {
    cfg = {};
  }

  const current = typeof cfg.verify === "string" ? cfg.verify.trim() : "";
  if (current) {
    stdout.write(`\n🔒 Verify command (push gate): ${current}\n`);
    return { command: current, source: "configured" };
  }

  const derived = await suggestVerifyCommand(targetDir);
  if (derived) {
    cfg.verify = derived;
    await writeFile(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
    stdout.write(
      `\n🔒 Verify command set to: ${derived}\n` +
        `   Derived from this project's files — edit "verify" in ${CONFIG_FILE} if it is wrong.\n`,
    );
    return { command: derived, source: "derived" };
  }

  stdout.write(NO_VERIFY_WARNING);
  return { command: "", source: "none" };
}
