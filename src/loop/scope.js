// src/loop/scope.js
//
// `conductor loop <project>` (owner, 2026-10-22): "I open a terminal, go into the
// project folder and run the loop on a project. For the second project I open
// another terminal, same folder, run the loop on another project. I don't want
// to know about worktrees." The project named on the command line is the whole
// scope: its remaining Blueprint stages and its carved slices, never the backlog
// or the inbox, and the owner's conductor.config.json is not edited.
//
// Each project's run has its own state and lock in the repository's git
// directory (`conductor-loop-logs/runs/<project>/`), invisible in the owner's
// folder. Same project twice is refused by that lock; two projects run side by
// side, each in its own worktrees. The settings (autonomy, sandbox, budget,
// platform, verify) still come from the owner's loop-state.json.
// Pure except where a function says it reads the disk.

import { normalizeState } from "./driver.js";
import { BLUEPRINT_STAGES } from "./blueprint.js";

export const RUNS_DIR = "runs";

/** Options that take a value: their value is not a positional. */
const VALUE_FLAGS = new Set(["--platform", "--goal", "--event", "--priority", "--code-dir"]);

/** The positional arguments of `conductor loop`, skipping option values. */
export function positionals(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      if (VALUE_FLAGS.has(a)) i += 1;
      continue;
    }
    out.push(a);
  }
  return out;
}

/**
 * Is the first positional a project name rather than a folder? A name never
 * holds a slash, is not "." or "..", and is not an existing folder.
 * @param {string|undefined} token
 * @param {(t: string) => boolean} isDir
 */
export function looksLikeProject(token, isDir) {
  if (!token || token.includes("/") || token === "." || token === "..") return false;
  return !isDir(token);
}

/** Valid file-system name for a project's run directory. */
export function runKey(project) {
  return String(project).replace(/[^A-Za-z0-9._-]+/g, "-");
}

const SETTINGS = ["phase", "autonomy_level", "platform", "sandbox", "roles", "concurrency", "tdd_split", "checker_votes"];

/**
 * A project's run state: its own run fields, the owner's settings. The owner
 * changes autonomy, sandbox, budget or verify in loop-state.json once, for every
 * project.
 */
export function scopedState(rootRaw, projectRaw) {
  const root = normalizeState(rootRaw);
  const s = normalizeState(projectRaw ?? { status: "idle" });
  for (const k of SETTINGS) s[k] = root[k];
  s.iterations.max_allowed = root.iterations.max_allowed;
  s.budget.max_beats = root.budget.max_beats;
  s.budget.max_wall_clock_min = root.budget.max_wall_clock_min;
  s.budget.max_cost_usd = root.budget.max_cost_usd;
  s.verification.command = root.verification.command;
  return s;
}

/** The loop settings narrowed to one project: its Blueprint and slices, no backlog, no inbox. */
export function scopeLoopConfig(loopConfig, project) {
  return { ...loopConfig, slices: [project], blueprint: [project], inbox: false, requireReady: true, priorities: [] };
}

/**
 * What the run will build, in plain words. `item` is the harvested work item or
 * null, `openSlices` the number of slices still in implementations/,
 * `inReview` the item whose MRs are open, or null.
 * @returns {string[]}
 */
export function describeScope({ project, item, openSlices = 0, inReview = null, carved = false }) {
  const cmd = `conductor loop ${project}`;
  if (item?.type === "blueprint") {
    const done = new Set(item.stages_done ?? []);
    const left = BLUEPRINT_STAGES.filter((s) => !done.has(s.key));
    const names = left.map((s) => STAGE_NAME[s.key] ?? s.key);
    const doneNames = BLUEPRINT_STAGES.filter((s) => done.has(s.key)).map((s) => STAGE_NAME[s.key] ?? s.key);
    return [
      `${project}: ${names.join(", then ")}${doneNames.length ? ` (already done: ${doneNames.join(", ")})` : ""}.`,
      "It ends with one merge request. Merge it, then run the same command again: the loop builds the slices that the Carve made.",
    ];
  }
  if (item?.type === "slice") {
    return [
      `${project}: slice ${item.source?.slice} (${openSlices} slice${openSlices === 1 ? "" : "s"} left, this one included).`,
      "Each slice ends with merge requests for you. The next slice starts only after you merge them and run the same command again.",
    ];
  }
  if (inReview) {
    return [`${project}: nothing to build now. ${label(inReview)} waits for you to merge its merge requests. Merge them, then run \`${cmd}\` again.`];
  }
  if (carved && openSlices === 0) return [`${project}: nothing to build. Every carved slice is shipped.`];
  return [`${project}: nothing the loop can build yet. Its Discovery (Genesis and Storyboard) must be done first.`];
}

const STAGE_NAME = { "grand-prd": "Grand PRD", "ux-ui-brief": "UX/UI Brief", "technical-vision": "Technical Vision", carve: "Carve" };

const label = (t) => (t.type === "slice" ? `Slice ${t.source?.slice}` : t.type === "blueprint" ? "Its Blueprint" : t.title ?? t.id);

/** The Blueprint stages still to run, for the dry-run route. */
export function remainingRoute(item) {
  const done = new Set(item?.stages_done ?? []);
  return BLUEPRINT_STAGES.filter((s) => !done.has(s.key)).map((s) => s.workflow).join(" → ");
}
