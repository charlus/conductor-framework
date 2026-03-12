import { access, cp, mkdir, rm, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

function getTemplateDir() {
  return fileURLToPath(new URL("../../templates", import.meta.url));
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseInitArgs(args) {
  const parsed = {
    target: ".",
    force: false,
    agentOnly: false,
  };
  let targetSet = false;

  for (const arg of args) {
    if (arg === "--force" || arg === "-f") {
      parsed.force = true;
      continue;
    }
    if (arg === "--agent-only") {
      parsed.agentOnly = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (targetSet) {
      throw new Error(
        "Too many positional arguments. Only one target directory is supported."
      );
    }
    parsed.target = arg;
    targetSet = true;
  }

  return parsed;
}

async function validateTargetDir(targetDir) {
  let targetStat;
  try {
    targetStat = await stat(targetDir);
  } catch {
    // Directory doesn't exist — create it
    await mkdir(targetDir, { recursive: true });
    return;
  }
  if (!targetStat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }
}

export async function initCommand(args, { cwd, stdout, stderr }) {
  let parsed;
  try {
    parsed = parseInitArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${message}\n`);
    return 1;
  }

  const targetDir = resolve(cwd, parsed.target);
  const agentDir = join(targetDir, ".agent");
  const templateDir = getTemplateDir();

  try {
    await validateTargetDir(targetDir);

    const templateExists = await exists(templateDir);
    if (!templateExists) {
      throw new Error(
        "Bundled templates are missing. This package may be corrupted."
      );
    }

    // Check if .agent/ already exists
    const agentExists = await exists(agentDir);
    if (agentExists && !parsed.force) {
      stderr.write(
        `.agent/ already exists at ${agentDir}\n` +
          `Re-run with --force to replace it.\n`
      );
      return 1;
    }

    if (agentExists && parsed.force) {
      await rm(agentDir, { recursive: true, force: true });
      stdout.write("Removed existing .agent/ directory.\n");
    }

    // Copy .agent/
    await cp(join(templateDir, ".agent"), agentDir, { recursive: true });

    // Copy .conductor/ (project state folders)
    if (!parsed.agentOnly) {
      const conductorDir = join(targetDir, ".conductor");
      const conductorExists = await exists(conductorDir);
      if (conductorExists && !parsed.force) {
        stdout.write("⏭️  Skipped .conductor/ (already exists)\n");
      } else {
        if (conductorExists && parsed.force) {
          await rm(conductorDir, { recursive: true, force: true });
        }
        await cp(join(templateDir, ".conductor"), conductorDir, { recursive: true });
        stdout.write("✅ Installed .conductor/ (project state folders)\n");
      }
    }
    stdout.write("✅ Installed .agent/ (workflows, skills, personas)\n");

    // Copy platform stubs
    for (const stub of ["GEMINI.md", "CLAUDE.md", "CHANGELOG.md"]) {
      const stubTarget = join(targetDir, stub);
      if (!(await exists(stubTarget))) {
        await cp(join(templateDir, stub), stubTarget);
        stdout.write(`✅ Created ${stub}\n`);
      }
    }

    // (numbered folders are now inside .conductor/, handled above)

    stdout.write("\n");
    stdout.write("🎼 Conductor Framework V4 initialized!\n");
    stdout.write("\n");
    stdout.write("Next steps:\n");
    stdout.write("  1. Run the self-test:  bash .agent/tests/check-conductor.sh\n");
    stdout.write('  2. Start building:     Tell your AI "Let\'s go"\n');
    stdout.write("\n");
    stdout.write("Docs: .agent/How-It-Works.md\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Init failed: ${message}\n`);
    return 1;
  }
}
