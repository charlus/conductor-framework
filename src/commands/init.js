import { access, cp, mkdir, rm, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { detectTechStack } from "../detect.js";
import { resolveRegistry, fetchRegistryIndex, readLocalSkills } from "../registry.js";
import { runInteractiveSetup } from "../prompt.js";
import { selectiveCopy, syncSelections, readSelections } from "../selective-copy.js";

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
    all: false,
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
    if (arg === "--all") {
      parsed.all = true;
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
  const sourceAgentsDir = join(templateDir, ".agents");

  try {
    await validateTargetDir(targetDir);

    const templateExists = await exists(templateDir);
    if (!templateExists) {
      throw new Error("Bundled templates are missing. This package may be corrupted.");
    }

    // Clean legacy agent dir
    const legacyAgentDir = join(targetDir, ".agent");
    if (await exists(legacyAgentDir)) {
      await rm(legacyAgentDir, { recursive: true, force: true });
      stdout.write("🧹 Removed legacy .agent/ (replaced by .agents/)\n");
    }

    // Check if .agents/ exists
    const agentsExists = await exists(agentsDir);
    if (agentsExists && !parsed.force && !parsed.agentOnly) {
      stderr.write(`.agents/ already exists at ${agentsDir}\nRe-run with --force to replace it, or --agent-only to reconfigure it interactively.\n`);
      return 1;
    }

    if (agentsExists && parsed.force && !parsed.agentOnly) {
      await rm(agentsDir, { recursive: true, force: true });
      stdout.write("Removed existing .agents/ directory.\n");
    }

    // CLI Interactive Setup for .agents/
    const registryPath = join(sourceAgentsDir, "registry.json");
    if (!(await exists(registryPath))) {
       throw new Error("registry.json missing. Run build-registry.js first.");
    }
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    const existing = await exists(agentsDir) ? readSelections(agentsDir) : null;
    
    if (parsed.all) {
      // Install everything manually (legacy behavior)
      const allSelections = {
         skills: registry.skills.map(s => s.name),
         rules: registry.rules.map(r => r.name),
         workflows: registry.workflows.map(w => w.name),
         bundles: []
      };
      selectiveCopy(sourceAgentsDir, agentsDir, allSelections, registry);
      stdout.write("✅ Installed ALL .agents/ (workflows, skills, personas, rules)\n");
    } else {
      const setupOptions = existing ? { previousSelections: existing } : undefined;
      const selections = await runInteractiveSetup(registry, setupOptions);
      if (!selections) {
         process.exit(0);
      }

      if (existing) {
         const { added, removed } = syncSelections(sourceAgentsDir, agentsDir, selections, existing, registry);
         if (added.length === 0 && removed.length === 0) stdout.write('\n✅ No changes — selections are the same.\n');
         else stdout.write('\n✅ Reconfiguration complete!\n');
      } else {
         selectiveCopy(sourceAgentsDir, agentsDir, selections, registry);
         stdout.write("✅ Installed .agents/ based on selections\n");
      }
    }

    // Copy conductor/ (project state folders)
    if (!parsed.agentOnly) {
      const conductorDir = join(targetDir, "conductor");
      const conductorExists = await exists(conductorDir);
      if (conductorExists && !parsed.force) {
        stdout.write("⏭️  Skipped conductor/ (already exists)\n");
      } else {
        if (conductorExists && parsed.force) {
          await rm(conductorDir, { recursive: true, force: true });
        }
        await cp(join(templateDir, "conductor"), conductorDir, { recursive: true });
        stdout.write("✅ Installed conductor/ (project state folders)\n");
      }

      // Copy platform stubs and config
      for (const stub of ["GEMINI.md", "CLAUDE.md", "CHANGELOG.md", "conductor.config.json"]) {
        const stubTarget = join(targetDir, stub);
        if (!(await exists(stubTarget))) {
          await cp(join(templateDir, stub), stubTarget);
          stdout.write(`✅ Created ${stub}\n`);
        }
      }

      stdout.write("\n🎼 Conductor Framework V5 initialized!\n");

      if (!parsed.noDetect) {
        const detected = await detectTechStack(targetDir);
        if (detected.length > 0) {
          stdout.write("\n🔍 Detected tech stack:\n   " + detected.join(", ") + "\n");
          await suggestRegistrySkills(targetDir, detected, stdout);
        }
      }

      stdout.write("\nNext steps:\n  1. Update conductor.config.json with your registry URL\n  2. Run the self-test:  bash .agents/tests/check-conductor.sh\n  3. Start building:     Tell your AI \"Let's go\"\n\nDocs: .agents/AGENTS.md\n");
    }
    
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Init failed: ${message}\n`);
    return 1;
  }
}

async function suggestRegistrySkills(projectDir, detectedTech, stdout) {
  try {
    const { hostname, project } = await resolveRegistry(projectDir);
    const registry = await fetchRegistryIndex(hostname, project);
    const localSkills = await readLocalSkills(join(projectDir, ".agents", "skills"));
    const localNames = new Set(localSkills.map((s) => s.name));

    const suggestions = registry.skills.filter((skill) => {
      if (localNames.has(skill.name)) return false;
      if (!skill.techStack || skill.techStack.length === 0) return false;
      return skill.techStack.some((t) => detectedTech.includes(t));
    });

    if (suggestions.length > 0) {
      stdout.write("\n💡 Recommended skills from registry:\n");
      for (const skill of suggestions) {
        const matched = skill.techStack.filter((t) => detectedTech.includes(t));
        stdout.write(`   • ${skill.name} — ${skill.description}\n     matches: ${matched.join(", ")}\n`);
      }
      stdout.write(`\n   Install with: conductor add <skill-name>\n`);
    }
  } catch {}
}
