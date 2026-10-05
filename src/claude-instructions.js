// src/claude-instructions.js
//
// D9: Conductor's instructions live in the root AGENTS.md. Claude Code reads it
// natively only from v2.1.277, and only when no CLAUDE.md / CLAUDE.local.md sits
// in the working folder: either file makes Claude read CLAUDE files instead, and
// the framework is silently skipped. These warnings name the cause and the fix.
// Pure, plus one IO helper for the commands.

import { access } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const MIN_CLAUDE_VERSION = "2.1.277";

/** `2.1.289 (Claude Code)` → [2, 1, 289]; anything else → null. */
export function parseClaudeVersion(text) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ""));
  return m ? m.slice(1, 4).map(Number) : null;
}

function below(v, min) {
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] < min[i];
  return false;
}

/**
 * @param {{claudeVersion: string|null, files: string[]}} input
 *   claudeVersion: raw `claude --version` output, null when claude is not installed
 *   files: which of CLAUDE.md / CLAUDE.local.md exist in the working folder
 */
export function instructionWarnings({ claudeVersion, files }) {
  const out = [];
  const v = parseClaudeVersion(claudeVersion);
  if (v && below(v, parseClaudeVersion(MIN_CLAUDE_VERSION))) {
    out.push(
      `Claude Code ${v.join(".")} does not read AGENTS.md, so it will not see Conductor. Update to ${MIN_CLAUDE_VERSION} or later (claude update).`
    );
  }
  if (files.includes("CLAUDE.md")) {
    out.push("CLAUDE.md is here: Claude Code reads it instead of AGENTS.md. Put the line @AGENTS.md at its top, or move its content into AGENTS.md and delete it.");
  }
  if (files.includes("CLAUDE.local.md")) {
    out.push("CLAUDE.local.md is here: Claude Code then reads CLAUDE files instead of AGENTS.md. Put the line @AGENTS.md at its top.");
  }
  return out;
}

/** The warnings for the folder `dir`, probing `claude --version` (never throws). */
export async function instructionWarningsFor(dir) {
  const probe = spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 10000 });
  const claudeVersion = probe.status === 0 ? probe.stdout : null;
  const files = [];
  for (const f of ["CLAUDE.md", "CLAUDE.local.md"]) {
    try {
      await access(join(dir, f));
      files.push(f);
    } catch {
      /* absent */
    }
  }
  return instructionWarnings({ claudeVersion, files });
}
