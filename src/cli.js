import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { searchCommand } from "./commands/search.js";

function helpText() {
  return [
    "",
    "  conductor-framework",
    "",
    "  The Conductor — AI Software Engineering framework",
    "  for the full development lifecycle.",
    "",
    "  Usage:",
    "    conductor init [target-directory] [options]",
    "    conductor upgrade [target-directory]",
    "    conductor add <skill-name> [--registry <url>]",
    "    conductor remove <skill-name> [--force]",
    "    conductor list [--remote] [--tier <tier>]",
    "    conductor search <query> [--tag <tag>]",
    "",
    "  Commands:",
    "    init        Scaffold the Conductor framework in a new project",
    "    upgrade     Upgrade an existing project to the latest framework",
    "    add         Download a skill from the registry",
    "    remove      Remove an installed skill",
    "    list        List installed skills (or --remote for registry)",
    "    search      Search the registry for skills",
    "",
    "  Init Options:",
    "    -f, --force       Overwrite existing .agent directory",
    "    --agent-only      Only copy .agents/ (skip .conductor/ folders)",
    "    --no-detect       Skip tech stack detection",
    "    -h, --help        Show this help message",
    "",
    "  Examples:",
    "    npx conductor-framework init",
    "    npx conductor-framework init ./my-project",
    "    npx conductor-framework upgrade",
    "    npx conductor-framework add react-components",
    "    npx conductor-framework list --remote",
    "    npx conductor-framework search react",
    "",
  ].join("\n");
}

export async function runCli(args, io = process) {
  const [command, ...rest] = args;

  if (
    !command ||
    command === "-h" ||
    command === "--help" ||
    command === "help"
  ) {
    io.stdout.write(`${helpText()}\n`);
    return 0;
  }

  const context = {
    cwd: io.cwd?.() ?? process.cwd(),
    stdout: io.stdout,
    stderr: io.stderr,
  };

  switch (command) {
    case "init":
      return initCommand(rest, context);
    case "upgrade":
      return upgradeCommand(rest, context);
    case "add":
      return addCommand(rest, context);
    case "remove":
      return removeCommand(rest, context);
    case "list":
      return listCommand(rest, context);
    case "search":
      return searchCommand(rest, context);
    default:
      io.stderr.write(`Unknown command: ${command}\n${helpText()}\n`);
      return 1;
  }
}
