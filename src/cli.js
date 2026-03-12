import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";

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
    "",
    "  Commands:",
    "    init        Scaffold the Conductor framework in a new project",
    "    upgrade     Upgrade an existing project to the latest framework",
    "",
    "  Init Options:",
    "    -f, --force       Overwrite existing .agent directory",
    "    --agent-only      Only copy .agents/ (skip .conductor/ folders)",
    "    -h, --help        Show this help message",
    "",
    "  Examples:",
    "    npx conductor-framework init",
    "    npx conductor-framework init ./my-project",
    "    npx conductor-framework upgrade",
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

  if (command === "init") {
    return initCommand(rest, {
      cwd: io.cwd?.() ?? process.cwd(),
      stdout: io.stdout,
      stderr: io.stderr,
    });
  }

  if (command === "upgrade") {
    return upgradeCommand(rest, {
      cwd: io.cwd?.() ?? process.cwd(),
      stdout: io.stdout,
      stderr: io.stderr,
    });
  }

  io.stderr.write(`Unknown command: ${command}\n${helpText()}\n`);
  return 1;
}
