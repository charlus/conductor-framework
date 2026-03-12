import { initCommand } from "./commands/init.js";

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
    "",
    "  Commands:",
    "    init        Scaffold the Conductor framework in a project",
    "",
    "  Options:",
    "    -f, --force       Overwrite existing .agent directory",
    "    --agent-only      Only copy .agent/ (skip numbered folders)",
    "    -h, --help        Show this help message",
    "",
    "  Examples:",
    "    npx conductor-framework init",
    "    npx conductor-framework init ./my-project",
    "    npx conductor-framework init --agent-only",
    "    npx conductor-framework init --force",
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

  io.stderr.write(`Unknown command: ${command}\n${helpText()}\n`);
  return 1;
}
