// src/usage.js
//
// The one source for how to use the CLI: every command, its flags, the
// conductor.config.json keys it reads, and an example. `conductor help`,
// `conductor <command> --help`, the main help and the reference part of
// docs/Using-Conductor.md are all rendered from it. test/usage-reference.test.js
// fails when a command parses a flag, or the config reads a key, that is not
// here, and when the page's reference is not the rendering of this file.

const NPX = "npx -y github:charlus/conductor-framework";

/** Groups, in the order a product owner meets them. */
export const GROUPS = Object.freeze([
  ["start", "Start or upgrade a project"],
  ["daily", "Every day"],
  ["loop", "Run work unattended"],
  ["gates", "Gates and evidence"],
  ["skills", "Skills"],
  ["measure", "Measurement and upkeep"],
]);

export const COMMANDS = Object.freeze([
  {
    name: "init", group: "start", summary: "Install Conductor in a new project",
    usage: "conductor init [dir] [options]",
    flags: [
      ["--all", "Install every bundle without asking"],
      ["-f, --force", "Overwrite an existing .agents/ folder"],
      ["--agent-only", "Install .agents/ only, no conductor/ folders"],
      ["--no-detect", "Skip tech stack detection"],
    ],
    examples: [[`${NPX} init`, "install in the current folder"]],
  },
  {
    name: "upgrade", group: "start", summary: "Upgrade a project to the latest framework",
    usage: "conductor upgrade [dir] [options]",
    flags: [
      ["--dry-run", "Show what would change, write nothing"],
      ["--force", "Upgrade although the checks advise against it"],
      ["--no-backup", "Do not copy the old files to .conductor-backup/"],
      ["--no-commit", "Leave the upgrade uncommitted and print the commit to make"],
    ],
    examples: [[`${NPX} upgrade --dry-run`, "preview the upgrade"]],
  },
  {
    name: "survey", group: "start", summary: "Collect the facts about a codebase you inherited",
    usage: "conductor survey [dir] [options]",
    flags: [["--json", "Print JSON"], ["--out <file>", "Write the report to a file"]],
    examples: [["conductor survey --out survey.md", "facts for the onboarding interview"]],
  },
  {
    name: "status", group: "daily", summary: "One-screen digest: inbox, backlog, next up, waiting questions",
    usage: "conductor status [dir] [options]",
    flags: [
      ["--live", "Also fetch MR and deploy state from the forge"],
      ["--json", "Print the digest as JSON"],
      ["--no-color", "Plain text (also --no-colour; --color or --colour forces colour)"],
      ["--stale-days <n>", "Days after which an item counts as stale (default 30)"],
    ],
    config: ["deployCheck", "repos"],
    examples: [["conductor status --live", "what is on our plate, with MR state"]],
  },
  {
    name: "inbox", group: "daily", summary: "Capture a thought, or read the inbox",
    usage: "conductor inbox add <text> | conductor inbox list",
    flags: [],
    examples: [['conductor inbox add "rename the export button"', "capture without opening a file"]],
  },
  {
    name: "view", group: "daily", summary: "Render conductor/ as one HTML dashboard",
    usage: "conductor view [dir] [options]",
    flags: [["-o, --open", "Open it in the browser"], ["--out <file>", "Write it to this file"], ["--stale-days <n>", "Days after which an item counts as stale"]],
    examples: [["conductor view --open", "the full dashboard"]],
  },
  {
    name: "review", group: "daily", summary: "Show a document in the browser and wait for approve or request-changes",
    usage: "conductor review <file.md> [options]",
    flags: [["--no-open", "Print the URL, do not open a browser"], ["--timeout <min>", "Stop waiting after this many minutes"], ["--quiet", "No JSON on stdout"]],
    examples: [["conductor review conductor/2-backlog/project-backlog/x/blueprint/grand-prd.md", "review a PRD"]],
  },
  {
    name: "personas", group: "daily", summary: "Which domain personas (Designer, Security…) a change needs",
    usage: "conductor personas [paths…] [options]",
    flags: [["--base <ref>", "Compare with this ref instead of the working tree"], ["--json", "Print JSON"]],
    examples: [["conductor personas --base master", "personas for this branch"]],
  },
  {
    name: "design", group: "daily", summary: "Combine an old conductor/4-context/design/ folder into one DESIGN.md",
    usage: "conductor design migrate [dir] [options]",
    flags: [["--repo <path>", "The code repository that gets DESIGN.md"], ["--dry-run", "Show the result, write nothing"]],
    examples: [["conductor design migrate --dry-run", "preview DESIGN.md"]],
  },
  {
    name: "loop", group: "loop", summary: "Run the autonomous loop: beats, reviews, one MR per item",
    usage: "conductor loop [dir] [--from-conductor | --goal <text> | --event <file.json>] [options]\n  conductor loop on|off <project> [dir] [--yes] [--dry-run]\n  conductor loop doctor [dir] [--beat]",
    flags: [
      ["--from-conductor", "Take the work from conductor/: backlog, inbox, slices, Blueprints"],
      ["--dry-run", "Show what the run would pick up and do, write nothing"],
      ["--platform <name>", "Engine: claude | codex | antigravity (default: loop-state, then detected)"],
      ["--goal <text>", "One goal for this run, instead of conductor/"],
      ["--event <file.json>", "Start from a trigger payload (cron, CI, bot); untrusted text is clamped to L1"],
      ["--priority <P1[,P2]>", "With --from-conductor: only backlog items under these headings"],
      ["--no-inbox", "With --from-conductor: skip inbox lines"],
      ["--unsafe-no-sandbox", "Allow sandbox: none (only inside a VM you control)"],
      ["on", "List the projects, their stage, and which ones the loop can take"],
      ["on <project>", "Let the loop work on a project: shows each change in plain words, asks once, writes the settings"],
      ["on --yes", "Apply without asking (after you have seen the list)"],
      ["on --code-dir <dir>", "Name the nested code repository when there are several"],
      ["off <project>", "The loop no longer works on that project"],
      ["doctor", "Check the project before an unattended run"],
      ["doctor --beat", "Also run one real beat to prove the engine and sandbox"],
    ],
    config: ["verify", "loop.forge", "loop.setup", "loop.allowed_domains", "loop.require_ready", "loop.priorities", "loop.inbox", "loop.allow_nested_repo", "loop.models", "loop.cost_aware", "loop.slices", "loop.blueprint", "loop.code_dir"],
    examples: [
      ["conductor loop on km-workload-relief", "let the loop work on this project"],
      ["conductor loop doctor .", "is this project ready?"],
      ["conductor loop . --from-conductor --dry-run", "what would the next run do?"],
      ["conductor loop . --from-conductor", "the real run"],
    ],
  },
  {
    name: "verify", group: "gates", summary: "Show or set the command `git push` must pass",
    usage: "conductor verify [options]",
    flags: [
      ["--set <cmd>", "Set the push gate (runs it once first)"],
      ["--detect", "Find the command from the project"],
      ["--none", "This repository has no tests (also --off)"],
      ["--no-run", "With --set: do not run it first"],
      ["--repo <dir>", "A nested code repository"],
    ],
    config: ["verify", "repos"],
    examples: [['conductor verify --set "npm test"', "set the push gate"]],
  },
  {
    name: "install-hooks", group: "gates", summary: "Turn on the TDD and verification git hooks",
    usage: "conductor install-hooks [--uninstall]",
    flags: [["--uninstall", "Turn them off"]],
    examples: [["conductor install-hooks", "gates on"]],
  },
  {
    name: "trust-verify", group: "gates", summary: "Record your consent for this repository's verify command",
    usage: "conductor trust-verify [--revoke | --list]",
    flags: [["--revoke", "Withdraw consent"], ["--list", "List trusted repositories"]],
    examples: [["conductor trust-verify", "trust the current command"]],
  },
  {
    name: "evidence", group: "gates", summary: "Record and check verification evidence against the working tree",
    usage: "conductor evidence run --label <name> [--stable-tree] -- <cmd>\n  conductor evidence check --label <name> [options]\n  conductor evidence list",
    flags: [
      ["--label <name>", "Which evidence (repeatable for check)"],
      ["--stable-tree", "With run: fail when the command changes files"],
      ["--expect-cmd <cmd>", "With check: the evidence must come from this command"],
      ["--max-age <hours>", "With check: the evidence must be this recent"],
      ["--allow-paths <a,b>", "With check: changes to these paths keep the evidence fresh"],
    ],
    examples: [["conductor evidence run --label tests -- npm test", "record a test run"]],
  },
  {
    name: "add", group: "skills", summary: "Download a skill from the registry",
    usage: "conductor add <skill> [options]",
    flags: [["--registry <url>", "Use this registry"], ["--allow-unsafe", "Install although the scan found a critical issue"]],
    config: ["registry"],
    examples: [[`${NPX} add react-components`, ""]],
  },
  {
    name: "remove", group: "skills", summary: "Remove an installed skill",
    usage: "conductor remove <skill> [-f]",
    flags: [["-f, --force", "Remove without asking"]],
    examples: [["conductor remove react-components", ""]],
  },
  {
    name: "list", group: "skills", summary: "List installed skills, or the registry's",
    usage: "conductor list [options]",
    flags: [["-r, --remote", "List the registry"], ["--tier <tier>", "core | tech-vision | domain"]],
    config: ["registry"],
    examples: [["conductor list --remote", ""]],
  },
  {
    name: "search", group: "skills", summary: "Search the registry",
    usage: "conductor search <query> [options]",
    flags: [["--tag <tag>", "Only skills with this tag"], ["--tier <tier>", "Only this tier"]],
    config: ["registry"],
    examples: [["conductor search react", ""]],
  },
  {
    name: "review-log", group: "measure", summary: "Record review findings, and see which rules reviewers dismiss",
    usage: "conductor review-log append '<json>' | conductor review-log summary [--since <date>]",
    flags: [["--since <date>", "With summary: only findings after this date"]],
    examples: [["conductor review-log summary", ""]],
  },
  {
    name: "context-bill", group: "measure", summary: "What the framework costs an agent per session",
    usage: "conductor context-bill [dir] [options]",
    flags: [["--all", "List every file"], ["--json", "Print JSON"], ["--budget <file>", "Check against a budget file"], ["--capture", "Print a budget file for the current state"]],
    examples: [["conductor context-bill", ""]],
  },
  {
    name: "agents-md", group: "measure", summary: "The project card in AGENTS.md: print facts, refresh them, check it",
    usage: "conductor agents-md <facts|write|check> [dir]",
    flags: [],
    config: ["verify", "eval"],
    examples: [["conductor agents-md check", "is the card current?"]],
  },
]);

/** Every conductor.config.json key the CLI reads. */
export const CONFIG_KEYS = Object.freeze([
  ["verify", "The command `git push` and the loop must pass (set it with `conductor verify --set`)"],
  ["eval", "The agent-layer eval command the push gate also runs"],
  ["deployCheck", "A command that says whether the latest merge is deployed (`status --live`)"],
  ["registry", "The skill registry URL for add, list and search"],
  ["repos", "Per nested code repository: { \"<dir>\": { \"verify\": …, \"deployCheck\": … } }"],
  ["loop.forge", "\"gh\" | \"glab\" (default: from the origin host)"],
  ["loop.setup", "Shell command run once in each new worktree, before the first beat"],
  ["loop.allowed_domains", "Extra hosts the sandbox may reach"],
  ["loop.require_ready", "true: only backlog items tagged loop-ready"],
  ["loop.priorities", "[\"P1\"]: only backlog items under these headings"],
  ["loop.inbox", "false: never take inbox lines"],
  ["loop.allow_nested_repo", "true: run although a gitignored nested git repository exists"],
  ["loop.models", "{ \"maker\": \"sonnet\", \"checker\": \"opus\", \"maker_escalation\": … }: a model per role (claude engine)"],
  ["loop.cost_aware", "true: budget.max_cost_usd in loop-state.json stops a run"],
  ["loop.slices", "[\"<Project>\"] or true: the project's carved slices are loop work, from spec to MR"],
  ["loop.blueprint", "[\"<Project>\"] or true: after Discovery, the project's Blueprint is loop work, one MR"],
  ["loop.code_dir", "\"repo\": the code is this nested repository (outer layout). Each item gets a code worktree and two MRs, code first; verify is repos.<code_dir>.verify"],
]);

const pad = (s, n) => (s.length >= n ? `${s}  ` : s.padEnd(n));

/** `conductor <name> --help`. */
export function commandHelp(name) {
  const c = COMMANDS.find((x) => x.name === name);
  if (!c) return null;
  const lines = ["", `  ${c.summary}`, "", "  Usage:", `    ${c.usage.replace(/\n {2}/g, "\n    ")}`];
  if (c.flags.length) {
    lines.push("", "  Options:");
    for (const [f, d] of c.flags) lines.push(`    ${pad(f, 24)}${d}`);
  }
  if (c.config?.length) {
    lines.push("", "  Reads from conductor.config.json:");
    for (const k of c.config) lines.push(`    ${pad(k, 24)}${CONFIG_KEYS.find(([x]) => x === k)?.[1] ?? ""}`);
  }
  lines.push("", "  Examples:");
  for (const [e, why] of c.examples) lines.push(`    ${e}${why ? `    # ${why}` : ""}`);
  lines.push("", "  Full guide: docs/Using-Conductor.md", "");
  return lines.join("\n");
}

/** `conductor help`: the commands by what you want to do. */
export function mainHelp() {
  const lines = ["", "  Conductor: the AI software engineering framework.", "", "  Run it with:  conductor <command>   or   " + NPX + " <command>", ""];
  for (const [g, title] of GROUPS) {
    lines.push(`  ${title}:`);
    for (const c of COMMANDS.filter((x) => x.group === g)) lines.push(`    ${pad(c.name, 16)}${c.summary}`);
    lines.push("");
  }
  lines.push("  Details:     conductor help <command>   or   conductor <command> --help", "  Full guide:  docs/Using-Conductor.md", "");
  return lines.join("\n");
}

/** The generated reference part of docs/Using-Conductor.md. */
export function renderReference() {
  const out = ["## Command reference", "", "Generated from `src/usage.js`. `conductor <command> --help` prints the same.", ""];
  for (const [g, title] of GROUPS) {
    out.push(`### ${title}`, "");
    for (const c of COMMANDS.filter((x) => x.group === g)) {
      out.push(`#### \`conductor ${c.name}\``, "", `${c.summary}.`, "", "```", c.usage.replace(/\n {2}/g, "\n"), "```", "");
      if (c.flags.length) {
        out.push("| Option | What it does |", "|---|---|");
        for (const [f, d] of c.flags) out.push(`| \`${f}\` | ${d.replace(/\|/g, "\\|")} |`);
        out.push("");
      }
      if (c.config?.length) out.push(`Reads: ${c.config.map((k) => `\`${k}\``).join(", ")}.`, "");
      out.push(...c.examples.map(([e, why]) => `- \`${e}\`${why ? `: ${why}` : ""}`), "");
    }
  }
  out.push("## Settings in `conductor.config.json`", "", "| Key | What it does |", "|---|---|");
  for (const [k, d] of CONFIG_KEYS) out.push(`| \`${k}\` | ${d.replace(/\|/g, "\\|")} |`);
  out.push("");
  return out.join("\n");
}

export const REFERENCE_START = "<!-- usage-reference:start (generated by scripts/write-usage-reference.js) -->";
export const REFERENCE_END = "<!-- usage-reference:end -->";
