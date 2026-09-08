// src/commands/view.js
//
// `conductor view` — render `conductor/` into ONE self-contained HTML file.
//
// WHAT THIS IS FOR. The methodology's read path was built for an IDE: browse a
// file tree, read markdown in a rendered preview, edit in place. Working from a
// CLI agent removes all three. This command restores the reading half without
// touching the storage half: markdown files stay the single source of truth, and
// this is a projection of them.
//
// So the output is DERIVED and must never be committed. The command adds the
// ignore entry itself on every run, which also fixes installs that predate it.

import { writeFile, mkdir, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import {
  collectState,
  ensureGitignoreEntry,
  openerFor,
  clickableUrl,
  VIEWS_REL,
} from "../conductor-state.js";
import { renderPage, VIEW_FILENAME } from "../view/render.js";

function parseArgs(args) {
  const opts = { open: false, out: null, staleDays: 30, dir: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--open" || arg === "-o") opts.open = true;
    else if (arg === "--out") opts.out = args[++i];
    else if (arg === "--stale-days") opts.staleDays = Number(args[++i]) || 30;
    else if (!arg.startsWith("-") && !opts.dir) opts.dir = arg;
  }
  return opts;
}

/**
 * Keep the derived views out of git. Done here rather than only in `init` so
 * that an existing install picks it up the first time it renders a view.
 */
async function ignoreViews(root, stdout) {
  const path = join(root, ".gitignore");
  let current = "";
  try {
    current = await readFile(path, "utf8");
  } catch {
    current = "";
  }
  const next = ensureGitignoreEntry(current, `${VIEWS_REL}/`);
  if (next === current) return false;
  await writeFile(path, next, "utf8");
  stdout?.write(`  ✅ Added ${VIEWS_REL}/ to .gitignore — the views are derived, never committed\n`);
  return true;
}

function openInBrowser(file, stderr) {
  const opener = openerFor();
  try {
    const child = spawn(opener, [file], { detached: true, stdio: "ignore" });
    child.on("error", () => {
      stderr?.write(`  (could not run \`${opener}\` — open the file above yourself)\n`);
    });
    child.unref();
  } catch {
    stderr?.write(`  (could not run \`${opener}\` — open the file above yourself)\n`);
  }
}

export async function viewCommand(args, context) {
  const opts = parseArgs(args);
  const root = resolve(opts.dir ? opts.dir : context.cwd);

  const { ok, state } = await collectState(root, { staleDays: opts.staleDays });
  if (!ok) {
    context.stderr.write(
      `  No \`conductor/\` folder in ${root}\n` +
        "  Scaffold one with:  npx github:charlus/conductor-framework init\n"
    );
    return 1;
  }

  const outPath = opts.out ? resolve(opts.out) : join(root, VIEWS_REL, VIEW_FILENAME);
  const html = renderPage(state);

  await mkdir(join(outPath, ".."), { recursive: true });
  await writeFile(outPath, html, "utf8");
  if (!opts.out) await ignoreViews(root, context.stdout);

  const { size } = await stat(outPath);
  const kb = (size / 1024).toFixed(0);

  // Print a link the human's BROWSER can resolve, not just a path this process
  // can. On WSL those are different, so print the native path as well — it is
  // the one to hand to `cat` or an editor.
  const url = clickableUrl(outPath);
  const nativePath = `file://${outPath}`;
  context.stdout.write(
    `  ✅ ${state.digest.docCount} document${state.digest.docCount === 1 ? "" : "s"} rendered · ${kb} KB\n` +
      `     ${url}\n` +
      (url === nativePath ? "" : `     path: ${outPath}\n`)
  );

  if (opts.open) openInBrowser(outPath, context.stderr);
  else context.stdout.write(`     open it with:  conductor view --open\n`);

  return 0;
}
