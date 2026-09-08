// src/view/status.js
//
// The terminal renderer over the shared state — `conductor status`.
//
// This is the surface that replaces "what's on our plate for today". It answers
// that question in one screen, instantly, for zero tokens and zero context: no
// agent turn, no `ls`, no `vim`. That cost difference is the reason state stays
// in the terminal while long documents go to the HTML view — asking an agent to
// summarise the backlog costs a whole turn every time, and it is the question
// asked most often.
//
// Reads the SAME state object `conductor view` renders, on purpose. Two parsers
// would eventually disagree and then neither surface would be trusted.

import { stripInlineMarkdown } from "./markdown.js";

const ANSI = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
};

const TYPE_COLOUR = { bugfix: "red", task: "blue", triage: "yellow", build: "magenta" };
const PRIORITY_COLOUR = { P1: "red", P2: "yellow", P3: "dim" };

/** Cap so the digest always fits one screen — the whole point of it. */
const MAX_QUEUE_ROWS = 6;
const MAX_STALE_ROWS = 3;

function painter(enabled) {
  return (text, ...styles) => {
    if (!enabled || !styles.length) return String(text);
    const codes = styles.map((s) => ANSI[s] ?? "").join("");
    return `${codes}${text}${ANSI.reset}`;
  };
}

/**
 * Fit a title to a column. Inline markup is stripped first: a real backlog line
 * is `**DB-1: fix it.** Add \`pool_pre_ping\``, and a terminal cannot render
 * that, so showing the markers is just noise in the one view meant to be
 * scannable at a glance.
 */
function truncate(text, width) {
  const s = stripInlineMarkdown(text);
  return s.length <= width ? s : `${s.slice(0, width - 1)}…`;
}

/**
 * One line describing the loop, read from the REAL v2 `loop-state.json` shape.
 *
 * `phase` leads because it is the field that gates a run: the driver refuses to
 * start in `discovery` (the Scoping Barrier), so someone checking status wants
 * that before anything else. The beat counter lives at `iterations.current`,
 * not a top-level `beat` — an earlier version of this function read the latter
 * and never rendered, because its test fixture was invented rather than taken
 * from the shipped file. The test now loads the template itself.
 */
function loopLine(loop) {
  if (!loop) return "not started";
  const parts = [];
  if (loop.phase) parts.push(loop.phase);
  if (loop.status) parts.push(loop.status);
  const current = loop.iterations?.current;
  if (Number.isFinite(Number(current))) {
    const max = loop.iterations?.max_allowed;
    parts.push(`beat ${current}${Number.isFinite(Number(max)) ? `/${max}` : ""}`);
  }
  if (loop.autonomy_level) parts.push(loop.autonomy_level);
  return parts.length ? parts.join(" · ") : "unknown";
}

/**
 * Render the digest.
 *
 * @param {object} state from buildState
 * @param {{color?: boolean, width?: number}} [opts]
 * @returns {string}
 */
export function renderStatus(state, { color = true, width = 78 } = {}) {
  const c = painter(color);
  const d = state.digest;
  const p = d.byPriority ?? {};
  const lines = [];
  const titleWidth = Math.max(24, width - 30);

  lines.push("");
  lines.push(
    `  ${c(state.projectName, "bold")} ${c("· conductor", "dim")}` +
      `  ${c(new Date(state.generatedAt).toLocaleString(), "dim")}`
  );
  lines.push("");

  const stat = (label, value, style) =>
    `${c(label.padEnd(9), "dim")}${c(String(value).padStart(3), ...(style ? [style, "bold"] : ["bold"]))}`;

  lines.push(
    `  ${stat("Inbox", d.inboxCount, d.inboxCount ? "cyan" : null)}   ` +
      `${stat("Backlog", d.backlogOpen)}   ${stat("Docs", d.docCount)}`
  );
  lines.push(
    `  ${stat("P1", p.P1 ?? 0, p.P1 ? "red" : null)}   ` +
      `${stat("P2", p.P2 ?? 0, p.P2 ? "yellow" : null)}   ${stat("P3", p.P3 ?? 0)}`
  );
  lines.push(`  ${c("Loop".padEnd(9), "dim")}${loopLine(d.loop)}`);

  if (state.queue.length) {
    lines.push("");
    lines.push(`  ${c("Next up", "bold")} ${c("— the order the loop would drain it", "dim")}`);
    state.queue.slice(0, MAX_QUEUE_ROWS).forEach((item, i) => {
      const type = c(item.type.padEnd(7), TYPE_COLOUR[item.type] ?? "blue");
      // Titles are padded to a fixed column so the priorities line up and the
      // eye can read down them — the thing a raw markdown list cannot do.
      const title = truncate(item.title, titleWidth).padEnd(titleWidth);
      const priority = item.priority
        ? c(item.priority, PRIORITY_COLOUR[item.priority] ?? "dim")
        : "";
      lines.push(`   ${c(String(i + 1).padStart(2), "dim")}  ${type} ${title} ${priority}`.trimEnd());
    });
    if (state.queue.length > MAX_QUEUE_ROWS) {
      lines.push(`   ${c(`   … ${state.queue.length - MAX_QUEUE_ROWS} more`, "dim")}`);
    }
  }

  if (state.stale.length) {
    lines.push("");
    lines.push(`  ${c("Not touched in a while", "bold")}`);
    state.stale.slice(0, MAX_STALE_ROWS).forEach((item) => {
      lines.push(
        `   ${c("·", "dim")}  ${truncate(item.title, titleWidth)} ${c(`${item.ageDays}d`, "dim")}`
      );
    });
  }

  if (!d.docCount && !d.inboxCount && !d.backlogOpen) {
    lines.push("");
    lines.push(`  ${c("Nothing here yet.", "bold")}`);
    lines.push(`  Capture an idea:  ${c('conductor inbox add "…"', "cyan")}   ${c("or /inbox in chat", "dim")}`);
    lines.push(`  Start something:  ${c("/genesis", "cyan")}`);
  }

  lines.push("");
  lines.push(
    `  ${c("conductor view --open", "cyan")}  ${c("full dashboard (rendered docs, search, backlinks)", "dim")}`
  );
  lines.push("");

  return lines.join("\n");
}
