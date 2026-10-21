// src/commands/watch.js — `conductor watch [dir] [--once]` (Loop Monitor M2).
//
// What the latest loop run is doing, from its event log: each item, the beat
// in progress (stage, model, minutes so far), the last recorded fact, the run's
// beats and cost. Refreshes every 2 seconds in a terminal and stops once the
// run has ended; `--once` (or no terminal) prints one screen.

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { readEvents, watchModel, renderWatch, EVENTS_FILE } from "../loop/events.js";
import { BEAT_LOG_DIR } from "../loop/beat-log.js";

function eventsPath(root) {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return join(common, BEAT_LOG_DIR, EVENTS_FILE);
  } catch {
    return null;
  }
}

export async function watchCommand(args, { cwd, stdout }) {
  const dir = args.find((a) => !a.startsWith("-"));
  const root = resolve(cwd, dir || ".");
  const path = eventsPath(root);
  const screen = async () => renderWatch(watchModel(readEvents(path ? await readFile(path, "utf8").catch(() => "") : "")), Date.now());
  const live = stdout.isTTY && !args.includes("--once");
  if (!live) {
    stdout.write(await screen());
    return 0;
  }
  for (;;) {
    const text = await screen();
    stdout.write(`\x1b[2J\x1b[H  conductor watch · ${root} · Ctrl-C to leave\n\n${text}`);
    if (/Run ended|No loop run recorded/.test(text)) return 0;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
