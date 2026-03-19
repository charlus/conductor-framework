import { access, cp, mkdir, rm, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { detectTechStack } from "../detect.js";
import { resolveRegistry, fetchRegistryIndex, readLocalSkills } from "../registry.js";

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
    noDetect: false,
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
    if (arg === "--no-detect") {
      parsed.noDetect = true;
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
  const agentsDir = join(targetDir, ".agents");
  const templateDir = getTemplateDir();

  try {
    await validateTargetDir(targetDir);

    const templateExists = await exists(templateDir);
    if (!templateExists) {
      throw new Error(
        "Bundled templates are missing. This package may be corrupted."
      );
    }

    // Check if .agents/ already exists
    const agentsExists = await exists(agentsDir);
    if (agentsExists && !parsed.force) {
      stderr.write(
        `.agents/ already exists at ${agentsDir}\n` +
          `Re-run with --force to replace it.\n`
      );
      return 1;
    }

    if (agentsExists && parsed.force) {
      await rm(agentsDir, { recursive: true, force: true });
      stdout.write("Removed existing .agents/ directory.\n");
    }

    // Also clean up legacy .agent/ (without 's') if present
    const legacyAgentDir = join(targetDir, ".agent");
    if (await exists(legacyAgentDir)) {
      await rm(legacyAgentDir, { recursive: true, force: true });
      stdout.write("🧹 Removed legacy .agent/ (replaced by .agents/)\n");
    }

    // Copy .agents/
    await cp(join(templateDir, ".agents"), agentsDir, { recursive: true });
    stdout.write("✅ Installed .agents/ (workflows, skills, personas, rules)\n");

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

    // Copy platform stubs and config
    for (const stub of ["GEMINI.md", "CLAUDE.md", "CHANGELOG.md", "conductor.config.json"]) {
      const stubTarget = join(targetDir, stub);
      if (!(await exists(stubTarget))) {
        await cp(join(templateDir, stub), stubTarget);
        stdout.write(`✅ Created ${stub}\n`);
      }
    }

    stdout.write("\n");
    stdout.write("🎼 Conductor Framework V5 initialized!\n");

    // ---- Tech Stack Detection ----
    if (!parsed.noDetect) {
      const detected = await detectTechStack(targetDir);

      if (detected.length > 0) {
        stdout.write("\n");
        stdout.write("🔍 Detected tech stack:\n");
        stdout.write(`   ${detected.join(", ")}\n`);

        // Try to suggest skills from registry
        await suggestRegistrySkills(targetDir, detected, stdout);
      }
    }

    stdout.write("\n");
    stdout.write("Next steps:\n");
    stdout.write("  1. Update conductor.config.json with your registry URL\n");
    stdout.write("  2. Run the self-test:  bash .agents/tests/check-conductor.sh\n");
    stdout.write('  3. Start building:     Tell your AI "Let\'s go"\n');
    stdout.write("\n");
    stdout.write("Docs: .agents/How-It-Works.md\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Init failed: ${message}\n`);
    return 1;
  }
}

/**
 * Suggest registry skills that match the detected tech stack.
 * Silently skips if registry is not configured or unreachable.
 */
async function suggestRegistrySkills(projectDir, detectedTech, stdout) {
  try {
    const { hostname, project } = await resolveRegistry(projectDir);
    const registry = await fetchRegistryIndex(hostname, project);

    // Find skills whose techStack overlaps with detected tech
    const localSkills = await readLocalSkills(join(projectDir, ".agents", "skills"));
    const localNames = new Set(localSkills.map((s) => s.name));

    const suggestions = registry.skills.filter((skill) => {
      if (localNames.has(skill.name)) return false; // Already installed
      if (!skill.techStack || skill.techStack.length === 0) return false;
      return skill.techStack.some((t) => detectedTech.includes(t));
    });

    if (suggestions.length > 0) {
      stdout.write("\n");
      stdout.write("💡 Recommended skills from registry:\n");
      for (const skill of suggestions) {
        const matched = skill.techStack.filter((t) => detectedTech.includes(t));
        stdout.write(`   • ${skill.name} — ${skill.description}\n`);
        stdout.write(`     matches: ${matched.join(", ")}\n`);
      }
      stdout.write(`\n   Install with: conductor add <skill-name>\n`);
    }
  } catch {
    // Registry not configured or unreachable — skip silently
    // This is expected when conductor.config.json still has placeholder URL
  }
}
