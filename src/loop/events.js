// src/loop/events.js
//
// Loop Monitor M1 (docs/roadmap/Loop-Monitor.md): the event log. The driver
// appends one JSON line per event to `<git dir>/conductor-loop-logs/events.ndjson`:
// run start and end, each beat's start and end (item, stage, role, model, time,
// cost), verify exit codes, review verdicts, question rounds, escalations, MRs.
// Every view reads this file; nothing else changes. Writing never fails a run.
// R2: a view shows what was recorded, never a guess.

import { appendFile, rename, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const EVENTS_FILE = "events.ndjson";
const ROTATE_BYTES = 5 * 1024 * 1024;

/** An `emit(type, data)` that appends to the run's event log, or does nothing without a directory. */
export function makeEmitter(dir, run, { now = () => Date.now() } = {}) {
  if (!dir) return async () => {};
  const path = join(dir, EVENTS_FILE);
  return async (type, data = {}) => {
    try {
      await mkdir(dir, { recursive: true });
      const size = await stat(path).then((s) => s.size).catch(() => 0);
      if (size > ROTATE_BYTES) await rename(path, `${path}.1`).catch(() => {});
      await appendFile(path, `${JSON.stringify({ run, at: new Date(now()).toISOString(), type, ...data })}\n`, "utf8");
    } catch {
      /* the monitor is measurement only */
    }
  };
}

/** Parse the log, skipping lines that are not JSON (a line cut by a crash). */
export function readEvents(text) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* skip */
    }
  }
  return out;
}

const STAGE_LABEL = { maker: "Build", checker: "Review", ship: "Ship", spec: "Spec", blueprint: "Blueprint" };
const describe = (e) => {
  switch (e.type) {
    case "beat_start":
      return `${STAGE_LABEL[e.kind] ?? e.kind} beat started${e.model ? ` (${e.model})` : ""}`;
    case "beat_end":
      return `${STAGE_LABEL[e.kind] ?? e.kind} beat ended after ${minutes(e.duration_s)}${e.cost_usd != null ? `, $${e.cost_usd.toFixed(2)}` : ""}`;
    case "verify":
      if (e.reused) return "verify reused: same content, already green";
      return `verify exit ${e.exit}${e.duration_s != null ? ` in ${minutes(e.duration_s)}` : ""}`;
    case "verdict":
      return `${e.phase ?? "code"} review ${e.approved ? "approved" : `rejected${e.reason ? `: ${e.reason}` : ""}`}`;
    case "questions":
      return `${e.count} question${e.count === 1 ? "" : "s"} for you`;
    case "escalated":
      return `escalated: ${e.reason ?? ""}`;
    case "merged":
      return `MR opened: ${[e.code_url, e.url].filter(Boolean).join(", ")}`;
    case "failed":
      return `failed: ${e.reason ?? ""}`;
    default:
      return e.type;
  }
};

function minutes(s) {
  if (s == null) return "?";
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/**
 * What the latest run is doing, from its events. Pure.
 * @returns {{run, started, ended: object|null, items: object[], beats: number, cost: number}}
 */
export function watchModel(events) {
  const runs = events.filter((e) => e.type === "run_start");
  const last = runs.at(-1);
  if (!last) return null;
  const mine = events.filter((e) => e.run === last.run);
  const items = new Map();
  let beats = 0;
  let cost = 0;
  for (const e of mine) {
    if (e.task) {
      const it = items.get(e.task) ?? { task: e.task, active: null, last: null, beats: {}, red: 0, rejected: 0 };
      if (e.type === "beat_start") it.active = { kind: e.kind, model: e.model ?? null, since: e.at };
      if (e.type === "step") {
        if (it.active) {
          it.active.steps = (it.active.steps ?? 0) + 1;
          it.active.lastStep = { at: e.at, text: `${e.tool}${e.detail ? `: ${e.detail}` : ""}` };
        }
        items.set(e.task, it);
        continue;
      }
      if (e.type === "verify" && e.exit !== 0) it.red += 1;
      if (e.type === "verdict" && !e.approved) it.rejected += 1;
      if (e.type === "beat_end") {
        it.beats[e.kind] = (it.beats[e.kind] ?? 0) + 1;
        it.active = null;
        beats += 1;
        cost += e.cost_usd ?? 0;
      }
      it.last = { at: e.at, text: describe(e) };
      if (["merged", "escalated", "failed", "questions"].includes(e.type)) it.done = e.type;
      if (e.type === "merged") it.mr = { url: e.url ?? null, code: e.code_url ?? null };
      items.set(e.task, it);
    }
  }
  return { run: last.run, started: last.at, ended: mine.find((e) => e.type === "run_end") ?? null, items: [...items.values()], beats, cost, planned: last.items ?? [] };
}

const hhmm = (iso) => new Date(iso).toTimeString().slice(0, 5);

/** The watch screen. `now` in ms. */
export function renderWatch(m, now) {
  if (!m) return "  No loop run recorded here yet. Start one with `conductor loop . --from-conductor`.\n";
  const lines = [`  Loop run started ${hhmm(m.started)} · ${Math.round((now - Date.parse(m.started)) / 60000)} min · ${m.beats} beat${m.beats === 1 ? "" : "s"} · ≈ $${m.cost.toFixed(2)} at list price`, ""];
  if (!m.items.length) lines.push(`  ${m.planned.length} item${m.planned.length === 1 ? "" : "s"} queued, no beat yet.`);
  for (const it of m.items) {
    lines.push(`  ${it.task}`);
    if (it.active) {
      lines.push(`    now: ${STAGE_LABEL[it.active.kind] ?? it.active.kind} beat${it.active.model ? ` on ${it.active.model}` : ""}, ${Math.round((now - Date.parse(it.active.since)) / 60000)} min so far${it.active.steps ? `, ${it.active.steps} step${it.active.steps === 1 ? "" : "s"}` : ""}`);
      if (it.active.lastStep) lines.push(`    last step ${hhmm(it.active.lastStep.at)}: ${it.active.lastStep.text}`);
    }
    const done = Object.entries(it.beats).map(([k, n]) => `${n} ${STAGE_LABEL[k] ?? k}`);
    const trouble = [it.red && `${it.red} red verify`, it.rejected && `${it.rejected} rejected review`].filter(Boolean);
    if (done.length) lines.push(`    so far: ${done.join(", ")}${trouble.length ? ` (${trouble.join(", ")})` : ""}`);
    if (it.last) lines.push(`    last news ${hhmm(it.last.at)}: ${it.last.text}`);
  }
  lines.push("");
  lines.push(m.ended ? `  Run ended ${hhmm(m.ended.at)}: ${m.ended.status}.` : "  Running. Steps come from the engine as they happen (claude); verdicts and MRs when they land.");
  return `${lines.join("\n")}\n`;
}
