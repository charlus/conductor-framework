// src/commands/status.js
//
// `conductor status` — "what's on our plate for today", answered instantly.
//
// This replaces a chain of `ls`, `cd` and `vim` with one command, and it
// replaces asking the agent, which cost a whole turn plus context every time
// for the question asked most often in a day.

import { collectState } from "../conductor-state.js";
import { renderStatus } from "../view/status.js";
import { instructionWarningsFor } from "../claude-instructions.js";
import { cardState } from "./agents-md.js";

function parseArgs(args) {
  const opts = { color: null, json: false, staleDays: 30, dir: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--no-color" || arg === "--no-colour") opts.color = false;
    else if (arg === "--color" || arg === "--colour") opts.color = true;
    else if (arg === "--stale-days") opts.staleDays = Number(args[++i]) || 30;
    else if (!arg.startsWith("-") && !opts.dir) opts.dir = arg;
  }
  return opts;
}

/** True unless the caller asked otherwise, output is piped, or NO_COLOR is set. */
function wantsColour(opts, stdout, env) {
  if (opts.color !== null) return opts.color;
  if (env.NO_COLOR) return false;
  return Boolean(stdout.isTTY);
}

export async function statusCommand(args, context) {
  const opts = parseArgs(args);
  const root = opts.dir ? opts.dir : context.cwd;
  const env = process.env;

  const { ok, state } = await collectState(root, { staleDays: opts.staleDays });

  if (!ok) {
    context.stderr.write(
      `  No \`conductor/\` folder in ${root}\n` +
        "  Scaffold one with:  npx github:charlus/conductor-framework init\n"
    );
    return 1;
  }

  if (opts.json) {
    context.stdout.write(`${JSON.stringify(state.digest, null, 2)}\n`);
    return 0;
  }

  context.stdout.write(
    `${renderStatus(state, { color: wantsColour(opts, context.stdout, env) })}\n`
  );
  // The project card: every session loads it, so a draft or stale card is worth a line.
  const card = await cardState(root);
  if (card === "draft") context.stdout.write("  ⚠️  Project card in AGENTS.md is a draft. Run the agents-md workflow (/agents-md).\n");
  else if (card?.stale) context.stdout.write(`  ⚠️  Project card in AGENTS.md is stale: ${card.stale.join(", ")} changed. Run the agents-md workflow (/agents-md).\n`);
  // D9: anything that makes Claude Code skip the root AGENTS.md, and so the framework.
  for (const w of await instructionWarningsFor(root)) context.stdout.write(`  ⚠️  ${w}\n`);
  return 0;
}
