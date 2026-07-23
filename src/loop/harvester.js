// src/loop/harvester.js
//
// Fleet Bridge FB-1 + FB-4 (Loop-Robustness-Plan §5). Turns the ONE source of
// truth — the human's `./conductor/` folder — into a typed work queue the swarm
// can drain, and maps each work type onto the workflow a beat should run. This is
// what makes the autonomous fleet (Client B) read from the same `conductor/` that
// the interactive agent (Client A) reads and writes; there is no second database.
//
// All parsers are PURE (string in, work-items out) so they unit-test without a
// repo. The IO wrapper that reads the actual files lives in the command shell
// (src/commands/loop.js), which passes their contents here.

/** kebab-slug, bounded — mirrors worktree.slugify so ids/branches line up. */
export function slugify(text, fallback = "item") {
  const s = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || fallback;
}

/** Stable, human-readable task id from a work item. Stable across re-harvests
 * (idempotent claims depend on this) as long as the item's title is unchanged. */
export function workItemId(type, title) {
  return `${type}:${slugify(title)}`;
}

const BUG_RE = /\b(bug|fix|broken|crash|error|regression|fails?|failing|incorrect|wrong)\b/i;

/** Classify a backlog line into a work type. Bug-ish → bugfix; else a task. */
export function classifyBacklog(title) {
  return BUG_RE.test(title) ? "bugfix" : "task";
}

/**
 * Parse `1-workbench/inbox.md` into `triage` items. Every non-empty `- ` bullet
 * below the intro is an unprocessed thought the fleet should triage (decide its
 * home and file it). The template's empty `- ` placeholder is skipped.
 */
export function parseInbox(md) {
  const items = [];
  for (const raw of String(md ?? "").split("\n")) {
    const m = raw.match(/^\s*[-*]\s+(\S.*?)\s*$/);
    if (!m) continue;
    const title = m[1].trim();
    if (!title || title.startsWith(">")) continue;
    items.push({ type: "triage", title });
  }
  return items;
}

/**
 * Parse `2-backlog/task-backlog.md`. Open checkboxes (`- [ ]`) become work items,
 * tagged with the priority heading (`## P1 …`) they sit under; done (`- [x]`) is
 * skipped. Bug-ish titles route to `bugfix`, the rest to `task`.
 */
export function parseBacklog(md) {
  const items = [];
  let priority = null;
  for (const raw of String(md ?? "").split("\n")) {
    const h = raw.match(/^#{1,6}\s+(P\d)\b/i);
    if (h) {
      priority = h[1].toUpperCase();
      continue;
    }
    const box = raw.match(/^\s*[-*]\s+\[( |x|X)\]\s+(\S.*?)\s*$/);
    if (!box) continue;
    if (box[1].toLowerCase() === "x") continue; // already done
    const title = box[2].trim();
    items.push({ type: classifyBacklog(title), title, priority });
  }
  return items;
}

/**
 * Combine parsed sources into a normalized, deterministically-ordered work queue.
 * Priority order: bugfix > task (backlog) then triage (inbox); within a source,
 * input order is preserved. Each item gets a stable id, a `source` pointer for
 * write-back, and the workflow route for the beat. Duplicate ids are dropped
 * (first wins) so re-harvesting is idempotent.
 *
 * @param {{inboxMd?:string, backlogMd?:string}} sources
 * @returns {Array<{id,type,title,priority,source,route,status,deps}>}
 */
export function harvestWorkQueue({ inboxMd = "", backlogMd = "" } = {}) {
  const backlog = parseBacklog(backlogMd).map((it) => ({ ...it, sourceKind: "backlog" }));
  const inbox = parseInbox(inboxMd).map((it) => ({ ...it, sourceKind: "inbox" }));
  const rank = { bugfix: 0, task: 1, triage: 2, build: 1 };
  const ordered = [...backlog, ...inbox].sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9));

  const seen = new Set();
  const queue = [];
  for (const it of ordered) {
    const id = workItemId(it.type, it.title);
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push({
      id,
      type: it.type,
      title: it.title,
      priority: it.priority ?? null,
      source: { kind: it.sourceKind, title: it.title },
      route: workflowForType(it.type),
      status: "pending",
      deps: [], // harvested items are independent; carve produces real DAGs
    });
  }
  return queue;
}

/** FB-4: map a work type onto the workflow (and any skill) a beat should run. */
export const ROUTING = Object.freeze({
  triage: {
    workflow: null,
    brief:
      "Triage this inbox thought: decide its home (a backlog task, a product-area note, a new Implementation, or discard) and file it there. Do not implement.",
  },
  task: { workflow: ".agents/workflows/build.md", brief: "Implement this backlog task end-to-end following the Build workflow (per-task TDD)." },
  bugfix: {
    workflow: ".agents/workflows/build.md",
    brief:
      "Fix this bug: first reproduce it with a failing test (systematic-debugging skill), then make it pass following the Build workflow. Never claim fixed without a reproduction that now passes.",
  },
  build: { workflow: ".agents/workflows/build.md", brief: "Build this Implementation's next steps following the Build workflow (per-task TDD)." },
});

export function workflowForType(type) {
  // Known types keep their workflow verbatim — including triage's intentional
  // `null` (no workflow, brief only). Only an UNKNOWN type falls back to Build.
  if (type in ROUTING) return ROUTING[type].workflow;
  return ".agents/workflows/build.md";
}

/** Render the per-beat assignment a fleet agent reads to know its work item. */
export function renderAssignment(task) {
  const route = ROUTING[task.type] ?? ROUTING.task;
  return [
    "# Loop Assignment (this beat)",
    "",
    "> The driver assigned you ONE work item from `./conductor/` this beat. Do exactly this, commit, then write `conductor/1-workbench/maker-signal.json` `{ \"done\": true }` only if the whole item is complete.",
    "",
    `- **Task id:** ${task.id}`,
    `- **Type:** ${task.type}`,
    `- **Item:** ${task.title}`,
    `- **Source:** ${task.source?.kind ?? "conductor"} (\`${task.source?.title ?? task.title}\`)`,
    route.workflow ? `- **Run workflow:** \`${route.workflow}\`` : "- **Run workflow:** (none — follow the brief)",
    "",
    `**Brief:** ${route.brief}`,
  ].join("\n");
}
