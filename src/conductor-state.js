// src/conductor-state.js
//
// ONE read of `conductor/`, shared by every human-facing surface.
//
// WHY THIS EXISTS. The autonomous loop already had a structured view of the
// human's `conductor/` folder: `src/loop/harvester.js` turns `inbox.md` and
// `task-backlog.md` into a ranked, typed work queue. The human had `ls`, `cat`
// and `vim`. That asymmetry is the actual problem with using this framework from
// a terminal — not the files themselves, which are what make the loop, the
// evidence ledger and PR review work at all.
//
// So this module is the human's read path, and it deliberately CALLS the
// harvester rather than re-parsing. A second parser would let the two views of
// the same backlog disagree, and the first time they did, the human would stop
// trusting both.
//
// Everything here is pure except `collectState`, which is the thin IO wrapper.
// That split is what makes the digest testable without a repo on disk.

import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename, sep } from "node:path";
import { harvestWorkQueue, parseInbox } from "./loop/harvester.js";
import { renderMarkdown, extractHeadings, documentTitle, plainText } from "./view/markdown.js";

export const CONDUCTOR_DIR = "conductor";
export const VIEWS_REL = "conductor/.views";
export const INBOX_REL = "conductor/1-workbench/inbox.md";
export const BACKLOG_REL = "conductor/2-backlog/task-backlog.md";
export const LOOP_STATE_REL = "conductor/1-workbench/loop-state.json";

/** The lifecycle, in order. This is the nav, so the folder tree is never browsed. */
export const SECTIONS = Object.freeze([
  { key: "0-compass", label: "Compass", blurb: "Vision, north star, ship log" },
  { key: "1-workbench", label: "Workbench", blurb: "Inbox, scratchpad, live loop state" },
  { key: "2-backlog", label: "Backlog", blurb: "Tasks, implementations, projects" },
  { key: "3-product-areas", label: "Product Areas", blurb: "Specs and notes per area" },
  { key: "4-context", label: "Context", blurb: "Product, technical, design, identity" },
  { key: "5-templates", label: "Templates", blurb: "Scaffolding for new documents" },
  { key: "6-archive", label: "Archive", blurb: "Completed work, kept for reference" },
]);

const SECTION_KEYS = new Set(SECTIONS.map((s) => s.key));

/** Folders that are meant to sit still, so age there is not a signal. */
const NEVER_STALE = new Set(["5-templates", "6-archive"]);

const DAY_MS = 86400000;

/** Which lifecycle folder a `conductor/…` path belongs to, or null. */
export function sectionForPath(relPath) {
  const parts = String(relPath ?? "").split("/");
  const key = parts[0] === CONDUCTOR_DIR ? parts[1] : parts[0];
  return SECTION_KEYS.has(key) ? key : null;
}

/**
 * Summarise `task-backlog.md` for display: the priority groups in file order,
 * each with its items, plus open/done counts.
 *
 * Distinct from the harvester's `parseBacklog`, which drops done items because
 * the loop cannot work on them. Here a done item is information — it is what
 * "we shipped that" looks like.
 */
export function summariseBacklog(md) {
  const groups = [];
  const byPriority = {};
  let open = 0;
  let done = 0;
  let current = null;

  for (const raw of String(md ?? "").split(/\r?\n/)) {
    const heading = raw.match(/^#{1,6}\s+(P\d)\b(.*)$/i);
    if (heading) {
      current = {
        priority: heading[1].toUpperCase(),
        label: heading[2].replace(/^[\s\-–—:]+/, "").trim(),
        items: [],
      };
      groups.push(current);
      continue;
    }
    const box = raw.match(/^\s*[-*]\s+\[( |x|X)\]\s+(\S.*?)\s*$/);
    if (!box) continue;
    const isDone = box[1].toLowerCase() === "x";
    const item = { title: box[2].trim(), done: isDone, priority: current?.priority ?? null };
    if (isDone) done += 1;
    else {
      open += 1;
      if (current) byPriority[current.priority] = (byPriority[current.priority] ?? 0) + 1;
    }
    if (current) current.items.push(item);
    else {
      // Items above any priority heading still count, under a synthetic group.
      if (!groups.length || groups[0].priority !== null) {
        groups.unshift({ priority: null, label: "Unprioritised", items: [] });
      }
      groups[0].items.push(item);
    }
  }

  return { groups, byPriority, open, done };
}

/**
 * Which documents reference which. Generated at read time, when every file is
 * visible at once — which is exactly why the page can show backlinks and `cat`
 * cannot. A reference counts if the text mentions the other document's path or
 * its bare filename.
 */
export function computeBacklinks(docs) {
  const out = {};
  for (const target of docs) out[target.relPath] = [];

  for (const target of docs) {
    const name = basename(target.relPath);
    for (const source of docs) {
      if (source.relPath === target.relPath) continue;
      const text = String(source.raw ?? "");
      if (text.includes(target.relPath) || text.includes(name)) {
        out[target.relPath].push(source.relPath);
      }
    }
  }
  return out;
}

/**
 * Documents nobody has touched in a while — a signal the human used to get for
 * free from a file tree sorted by date.
 */
export function computeStale(docs, { now = Date.now(), days = 30 } = {}) {
  const cutoff = days * DAY_MS;
  return docs
    .filter((d) => !NEVER_STALE.has(sectionForPath(d.relPath) ?? ""))
    .map((d) => ({
      relPath: d.relPath,
      ageDays: Math.max(0, Math.floor((now - (d.mtimeMs ?? 0)) / DAY_MS)),
    }))
    .filter((d) => d.ageDays * DAY_MS >= cutoff)
    .sort((a, b) => b.ageDays - a.ageDays);
}

/**
 * Build the state object every surface renders from. Pure: give it the file
 * contents and it gives you the digest, the queue, the sections and the
 * rendered documents.
 *
 * @param {object} input
 * @param {string} input.root absolute repo root (for display only)
 * @param {string} input.projectName
 * @param {string} [input.inboxMd]
 * @param {string} [input.backlogMd]
 * @param {object|null} [input.loopState]
 * @param {Array<{relPath:string, raw:string, mtimeMs:number}>} input.docs
 * @param {number} [input.now]
 * @param {number} [input.staleDays]
 */
export function buildState({
  root,
  projectName,
  inboxMd = "",
  backlogMd = "",
  loopState = null,
  docs = [],
  now = Date.now(),
  staleDays = 30,
}) {
  const inboxItems = parseInbox(inboxMd).map((it) => ({ title: it.title }));
  const backlog = summariseBacklog(backlogMd);
  const queue = harvestWorkQueue({ inboxMd, backlogMd });
  const backlinks = computeBacklinks(docs);

  const prepared = docs
    .map((doc) => {
      const filename = basename(doc.relPath);
      const raw = String(doc.raw ?? "");
      const text = plainText(raw);
      return {
        relPath: doc.relPath,
        filename,
        title: documentTitle(raw, filename),
        section: sectionForPath(doc.relPath),
        folder: dirname(doc.relPath),
        mtimeMs: doc.mtimeMs ?? 0,
        ageDays: Math.max(0, Math.floor((now - (doc.mtimeMs ?? 0)) / DAY_MS)),
        html: renderMarkdown(raw),
        headings: extractHeadings(raw),
        words: text ? text.split(/\s+/).length : 0,
        text: text.slice(0, 4000),
        backlinks: backlinks[doc.relPath] ?? [],
      };
    })
    .sort((a, b) => a.relPath.localeCompare(b.relPath));

  const sections = SECTIONS.map((s) => ({
    ...s,
    docs: prepared
      .filter((d) => d.section === s.key)
      .sort((a, b) => a.title.localeCompare(b.title)),
  }));

  const stale = computeStale(docs, { now, days: staleDays })
    .map((s) => {
      const doc = prepared.find((d) => d.relPath === s.relPath);
      return { ...s, title: doc?.title ?? basename(s.relPath) };
    })
    .slice(0, 10);

  return {
    generatedAt: new Date(now).toISOString(),
    root,
    projectName,
    digest: {
      inboxCount: inboxItems.length,
      backlogOpen: backlog.open,
      backlogDone: backlog.done,
      byPriority: backlog.byPriority,
      docCount: prepared.length,
      staleCount: stale.length,
      queueLength: queue.length,
      loop: loopState,
    },
    inbox: { relPath: INBOX_REL, items: inboxItems },
    backlog: { relPath: BACKLOG_REL, ...backlog },
    queue,
    sections,
    stale,
    docs: prepared,
  };
}

// ---------------------------------------------------------------------------
// Writers and small platform helpers
// ---------------------------------------------------------------------------

/**
 * Append one thought to the inbox, VERBATIM.
 *
 * The zero-judgment rule is the point: `Inbox: X` exists so capture is as fast
 * as opening a file would have been. It was a prose rule in the always-on
 * classifier, which is why it did not fire reliably — prose competes for
 * attention, a command does not.
 *
 * Newlines are folded to spaces so one thought stays one bullet, and the
 * template's empty `- ` placeholder is consumed rather than stacked under.
 */
export function appendInboxLine(md, text) {
  const thought = String(text ?? "").trim().replace(/\s*\r?\n\s*/g, " ");
  if (!thought) throw new Error("refusing to append an empty inbox line");

  const bullet = `- ${thought}`;
  const lines = String(md ?? "").split(/\r?\n/);

  // Drop trailing blank lines so the bullet lands against the list.
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  // Consume a trailing empty placeholder bullet (`- ` with nothing after it).
  if (lines.length && /^\s*[-*]\s*$/.test(lines[lines.length - 1])) lines.pop();

  lines.push(bullet);
  return `${lines.join("\n")}\n`;
}

/** Add a `.gitignore` entry unless an exact line for it already exists. */
export function ensureGitignoreEntry(contents, entry) {
  const text = String(contents ?? "");
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(entry)) return text;
  const prefix = text && !text.endsWith("\n") ? "\n" : "";
  const spacer = text.trim() ? "\n" : "";
  return `${text}${prefix}${spacer}# Conductor's derived HTML views — regenerate with \`conductor view\`\n${entry}\n`;
}

/**
 * A `file://` URL the human can click in their terminal, correct for the
 * platform the BROWSER runs on — which is not always the platform this process
 * runs on.
 *
 * WSL is why this function exists. The generated page sits on the Linux
 * filesystem, but the browser that opens it is a Windows one, and Windows
 * cannot resolve `file:///home/...`. It can resolve the UNC host
 * `wsl.localhost/<distro>`. Emitting the wrong one hands over a link that
 * silently does nothing, which is worse than printing a bare path.
 *
 * (On Windows 10 builds predating the `wsl.localhost` host the equivalent is
 * `wsl$`. Not emitted here: the modern host is what current builds resolve, and
 * offering two links to the same file is its own kind of confusion.)
 *
 * @param {string} absPath absolute path to the file
 * @param {string} [platform] as `process.platform`
 * @param {object} [env] as `process.env`
 */
export function clickableUrl(absPath, platform = process.platform, env = process.env) {
  // encodeURI leaves `/` and the Windows drive colon alone but escapes spaces.
  // It also leaves `#` and `?`, either of which would truncate the URL.
  const encode = (p) => encodeURI(p).replace(/#/g, "%23").replace(/\?/g, "%3F");

  if (platform === "win32") {
    const forward = String(absPath).replace(/\\/g, "/").replace(/^\/+/, "");
    return `file:///${encode(forward)}`;
  }

  const distro = env.WSL_DISTRO_NAME;
  if (distro && platform === "linux") {
    return `file://wsl.localhost/${encode(distro)}${encode(absPath)}`;
  }

  return `file://${encode(absPath)}`;
}

/**
 * The command that opens a local file in the platform's browser.
 * WSL is the case that matters here: `xdg-open` has nothing to open on a
 * distro with no desktop, while `wslview` hands the file to Windows.
 */
export function openerFor(platform = process.platform, env = process.env) {
  if (platform === "darwin") return "open";
  if (platform === "win32") return "start";
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return "wslview";
  return "xdg-open";
}

// ---------------------------------------------------------------------------
// IO wrapper
// ---------------------------------------------------------------------------

async function readIfPresent(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Every markdown file under `conductor/`, excluding the derived views. */
async function walkDocs(root) {
  const base = join(root, CONDUCTOR_DIR);
  const out = [];

  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // .views, .gitkeep, etc.
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const [raw, st] = await Promise.all([readFile(abs, "utf8"), stat(abs)]);
      out.push({
        relPath: abs.slice(root.length + 1).split(sep).join("/"),
        raw,
        mtimeMs: st.mtimeMs,
      });
    }
  };

  await walk(base);
  return out;
}

/**
 * Read `conductor/` from disk and build the shared state.
 * Returns `{ ok: false }` when the folder is not there, so callers can print a
 * useful message instead of an empty dashboard.
 */
export async function collectState(root, { now = Date.now(), staleDays = 30 } = {}) {
  const [inboxMd, backlogMd, loopRaw] = await Promise.all([
    readIfPresent(join(root, INBOX_REL)),
    readIfPresent(join(root, BACKLOG_REL)),
    readIfPresent(join(root, LOOP_STATE_REL)),
  ]);

  let loopState = null;
  if (loopRaw) {
    try {
      loopState = JSON.parse(loopRaw);
    } catch {
      loopState = { status: "unreadable", note: "loop-state.json is not valid JSON" };
    }
  }

  const docs = await walkDocs(root);
  const present = inboxMd !== null || backlogMd !== null || docs.length > 0;

  return {
    ok: present,
    state: buildState({
      root,
      projectName: basename(root),
      inboxMd: inboxMd ?? "",
      backlogMd: backlogMd ?? "",
      loopState,
      docs,
      now,
      staleDays,
    }),
  };
}

/**
 * Append to the inbox on disk, creating `inbox.md` from a stub if the install
 * has none yet.
 *
 * It will NOT create `conductor/` itself. Capture is meant to be
 * failure-proof INSIDE a Conductor project; run from anywhere else it would
 * otherwise silently scatter a half-empty state folder into an unrelated repo,
 * which is worse than a clear refusal.
 */
export async function captureInbox(root, text) {
  const path = join(root, INBOX_REL);
  const existing = await readIfPresent(path);

  if (existing === null) {
    let hasInstall = false;
    try {
      hasInstall = (await stat(join(root, CONDUCTOR_DIR))).isDirectory();
    } catch {
      hasInstall = false;
    }
    if (!hasInstall) {
      throw new Error(
        `no \`conductor/\` folder in ${root} — run \`conductor init\` first, or capture from the project root`
      );
    }
  }

  const base =
    existing ??
    "# Inbox\n\nDump anything here. Ideas, tasks, thoughts. Process later into the right place.\n\n---\n\n- \n";
  const next = appendInboxLine(base, text);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next, "utf8");
  return { path, relPath: INBOX_REL, created: existing === null };
}
