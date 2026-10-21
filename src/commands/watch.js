// src/commands/watch.js — `conductor watch [dir] [--once]` (Loop Monitor M2).
//
// What the latest loop run is doing, from its event log: each item, the beat
// in progress (stage, model, minutes so far), the last recorded fact, the run's
// beats and cost. Refreshes every 2 seconds in a terminal and stops once the
// run has ended; `--once` (or no terminal) prints one screen.

import { readFile } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
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

/** One product's block for the watch tower: its name, its run, its waiting questions. */
async function productBlock(root, now) {
  const path = eventsPath(root);
  const m = watchModel(readEvents(path ? await readFile(path, "utf8").catch(() => "") : ""));
  const { readRounds } = await import("./status.js");
  const rounds = await readRounds(root).catch(() => ({ waiting: [] }));
  const body = renderWatch(m, now).replace(/\n$/, "").replace(/^/gm, "  ");
  const waiting = rounds.waiting.length ? `\n    ${rounds.waiting.length} question round${rounds.waiting.length === 1 ? "" : "s"} waiting for you: ${rounds.waiting.join(", ")}` : "";
  const state = !m ? "idle" : m.ended ? (["awaiting_answers", "escalated"].includes(m.ended.status) ? "waiting" : "ended") : "running";
  return { state: rounds.waiting.length ? "waiting" : state, text: `  ── ${basename(root)} · ${root}\n${body}${waiting}\n` };
}

async function towerScreen(roots, now) {
  roots = await (async () => {
    const { access } = await import("node:fs/promises");
    const kept = [];
    for (const r of roots) if (await access(r).then(() => true, () => false)) kept.push(r);
    return kept;
  })();
  if (!roots.length) return "  No product registered for the loop on this machine. `conductor loop on <project>` (or `--backlog`) in a product registers it.\n";
  const blocks = [];
  for (const r of roots) blocks.push(await productBlock(r, now));
  const n = (s) => blocks.filter((b) => b.state === s).length;
  return `  ${roots.length} product${roots.length === 1 ? "" : "s"} · ${n("running")} running · ${n("waiting")} waiting for you\n\n${blocks.map((b) => b.text).join("\n")}`;
}

export async function watchCommand(args, { cwd, stdout }) {
  // The watch tower: every product the loop works on, or the folders named.
  const dirs = args.filter((a) => !a.startsWith("-"));
  if (args.includes("--all") || dirs.length > 1) {
    const { listLoopProjects } = await import("../loop/projects-registry.js");
    const roots = args.includes("--all") ? await listLoopProjects() : dirs.map((d) => resolve(cwd, d));
    if (!(stdout.isTTY && !args.includes("--once"))) {
      stdout.write(await towerScreen(roots, Date.now()));
      return 0;
    }
    for (;;) {
      stdout.write(`\x1b[2J\x1b[H  conductor watch --all · ${new Date().toTimeString().slice(0, 8)} · Ctrl-C to leave\n\n${await towerScreen(roots, Date.now())}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const dir = dirs[0];
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
