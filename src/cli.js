import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { searchCommand } from "./commands/search.js";
import { installHooksCommand } from "./commands/install-hooks.js";
import { trustVerifyCommand } from "./commands/trust-verify.js";
import { evidenceCommand } from "./commands/evidence.js";
import { reviewLogCommand } from "./commands/review-log.js";
import { contextBillCommand } from "./commands/context-bill.js";
import { loopCommand } from "./commands/loop.js";

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
    "    conductor install-hooks [--uninstall]",
    "    conductor trust-verify [--revoke] [--list]",
    "    conductor evidence <run|check|list> …",
    "    conductor review-log <append|summary>",
    "    conductor context-bill [dir] [--all] [--json] [--budget <file>]",
    "    conductor loop [target-directory] [--goal <text> | --event <file.json> | --from-conductor]",
    "                   [--platform <name>] [--dry-run] [--unsafe-no-sandbox]",
    "",
    "  Commands:",
    "    init            Scaffold the Conductor framework in a new project",
    "    upgrade         Upgrade an existing project to the latest framework",
    "    add             Download a skill from the registry",
    "    remove          Remove an installed skill",
    "    list            List installed skills (or --remote for registry)",
    "    search          Search the registry for skills",
    "    install-hooks   Enable deterministic TDD/verification git hooks",
    "    trust-verify    Record operator consent for this repo's verify command",
    "    evidence        Record/grade verification evidence against the working tree",
    "    review-log      Record review findings + dispositions; summarise the rubric",
    "    context-bill    What the framework costs an agent per session (always-on vs eager)",
    "    loop            Run the deterministic autonomous loop driver",
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
    "    conductor loop --goal \"get all tests passing\" --dry-run",
    "    conductor loop --from-conductor --dry-run   # preview the fleet's backlog queue",
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
    case "install-hooks":
      return installHooksCommand(rest, context);
    case "trust-verify":
      return trustVerifyCommand(rest, context);
    case "evidence":
      return evidenceCommand(rest, context);
    case "review-log":
      return reviewLogCommand(rest, context);
    case "context-bill":
      return contextBillCommand(rest, context);
    case "loop":
      return loopCommand(rest, context);
    default:
      io.stderr.write(`Unknown command: ${command}\n${helpText()}\n`);
      return 1;
  }
}
