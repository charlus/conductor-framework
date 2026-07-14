import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Platform stubs (CLAUDE.md, GEMINI.md) carry a Conductor-managed region wrapped
// in these markers. `upgrade` refreshes only what's between them, so anything the
// user writes outside the block survives.
const BEGIN = "<!-- conductor:managed:begin";
const END_TOKEN = "<!-- conductor:managed:end -->";

const PRESERVED_NOTE =
  "<!-- ⬆ Conductor manages the block above (refreshed on upgrade). " +
  "⬇ Preserved from your previous file — you may delete any duplicated framework text here. -->";

/** Split content into { before, block, after } around the managed markers, or null. */
function splitManaged(content) {
  const b = content.indexOf(BEGIN);
  if (b === -1) return null;
  const e = content.indexOf(END_TOKEN, b);
  if (e === -1) return null;
  const end = e + END_TOKEN.length;
  return { before: content.slice(0, b), block: content.slice(b, end), after: content.slice(end) };
}

/** Leading YAML frontmatter (`---\n…\n---\n`) if present, else "". */
function leadingFrontmatter(content) {
  const m = content.match(/^---\n[\s\S]*?\n---\n/);
  return m ? m[0] : "";
}

/**
 * Merge the template's managed block into an existing stub.
 *   - No template markers        → return the template as-is (nothing to manage).
 *   - Fresh install (no existing) → return the template verbatim.
 *   - Existing HAS markers        → replace only the managed region; keep the rest.
 *   - Existing has NO markers      → insert the block (below any frontmatter) and
 *                                    preserve the old content beneath a note.
 * Pure and idempotent.
 */
export function renderStub(templateContent, existingContent) {
  const tpl = splitManaged(templateContent);
  if (!tpl) return templateContent;
  if (existingContent == null) return templateContent;

  const cur = splitManaged(existingContent);
  if (cur) return cur.before + tpl.block + cur.after;

  // Legacy file with no markers — keep the user's content, add the managed block.
  const fm = leadingFrontmatter(existingContent);
  const rest = existingContent.slice(fm.length).replace(/^\n+/, "");
  const head = fm ? fm + "\n" : "";
  return head + tpl.block + "\n\n" + PRESERVED_NOTE + "\n\n" + rest;
}

/**
 * Refresh a managed stub on disk from its template.
 * Returns "created" | "refreshed" | "unchanged".
 */
export function applyManagedStub(targetPath, templatePath) {
  const template = readFileSync(templatePath, "utf8");
  const existed = existsSync(targetPath);
  const existing = existed ? readFileSync(targetPath, "utf8") : null;
  const next = renderStub(template, existing);
  if (existed && next === existing) return "unchanged";
  writeFileSync(targetPath, next);
  return existed ? "refreshed" : "created";
}
