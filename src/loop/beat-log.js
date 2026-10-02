// src/loop/beat-log.js
//
// F11: keep each agent beat's output. Without it, a beat that did nothing left
// no trace once teardown removed its clean worktree. Logs go in the main repo's
// git dir (`.git/conductor-loop-logs/`): outside every worktree, never committed,
// and untouched by `conductor upgrade`. The newest KEEP logs are kept.

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const BEAT_LOG_DIR = "conductor-loop-logs";
const KEEP = 200;

/** `<ISO time>-<label>.log`: sorts by time, safe as a file name. */
export function beatLogName({ now, label }) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  const slug = String(label ?? "beat").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${stamp}-${slug || "beat"}.log`;
}

/** Write one beat's log into `dir`, prune old logs, and return the log's path. */
export async function writeBeatLog(dir, { now, label, cwd, result = {}, keep = KEEP }) {
  await mkdir(dir, { recursive: true });
  const path = join(dir, beatLogName({ now, label }));
  const text = [
    `# ${label}`,
    "",
    `- time: ${new Date(now).toISOString()}`,
    `- cwd: ${cwd}`,
    `- exit code: ${result.exitCode ?? "(none)"}`,
    "",
    "## stdout",
    "",
    String(result.stdout ?? "").trimEnd() || "(empty)",
    "",
    "## stderr",
    "",
    String(result.stderr ?? "").trimEnd() || "(empty)",
    "",
  ].join("\n");
  await writeFile(path, text, "utf8");
  const logs = (await readdir(dir)).filter((n) => n.endsWith(".log")).sort();
  for (const old of logs.slice(0, Math.max(0, logs.length - keep))) await rm(join(dir, old), { force: true });
  return path;
}
