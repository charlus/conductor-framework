import { access, cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { planUpdate, executeUpdate } from "../update.js";
import { renameRecursive, updateChecksumsKeys } from "../kebab.js";

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

const NUMBERED_FOLDERS = [
  "0-compass",
  "1-workbench",
  "2-backlog",
  "3-product-areas",
  "4-context",
  "5-templates",
  "6-archive",
  "0-Compass",
  "1-Workbench",
  "2-Backlog",
  "3-Product-Areas",
  "4-Context",
  "5-Templates",
  "6-Archive",
];

export async function upgradeCommand(args, { cwd, stdout, stderr }) {
  const targetDir = resolve(cwd, args[0] || ".");
  const agentsDir = join(targetDir, ".agents");
  const legacyAgentDir = join(targetDir, ".agent");
  const conductorDir = join(targetDir, "conductor");
  const legacyConductorDir = join(targetDir, ".conductor");
  const templateDir = getTemplateDir();
  const sourceAgentsDir = join(templateDir, ".agents");
  const checksumPath = join(agentsDir, ".checksums.json");

  try {
    const hasAgents = await exists(agentsDir);
    const hasLegacyAgent = await exists(legacyAgentDir);
    const hasConductor = await exists(conductorDir);
    const hasLegacyConductor = await exists(legacyConductorDir);
    const hasRootFolders = await exists(join(targetDir, "0-Compass")) || await exists(join(targetDir, "0-compass"));

    if (!hasAgents && !hasLegacyAgent && !hasRootFolders && !hasLegacyConductor && !hasConductor) {
      stderr.write(
        "This doesn't look like a Conductor project.\n" +
          "No .agents/, .agent/, or numbered folders found.\n" +
          'Run "conductor init" to set up a new project instead.\n'
      );
      return 1;
    }

    stdout.write("🎼 Conductor Framework — Upgrade\n\n");

    // ---- Step 1: Structural Migrations ----
    stdout.write("Step 1: Structural Migrations...\n");
    if (hasLegacyAgent && !hasAgents) {
      await rename(legacyAgentDir, agentsDir);
      stdout.write("  📁 .agent/ → .agents/\n");
    } else if (hasLegacyAgent && hasAgents) {
      await rm(legacyAgentDir, { recursive: true, force: true });
    }

    if (hasLegacyConductor && !hasConductor) {
      await rename(legacyConductorDir, conductorDir);
      stdout.write("  📁 .conductor/ → conductor/\n");
    } else if (hasLegacyConductor && hasConductor) {
      await rm(legacyConductorDir, { recursive: true, force: true });
    }

    if (hasRootFolders && !(await exists(conductorDir))) {
      await mkdir(conductorDir, { recursive: true });
      for (const folder of NUMBERED_FOLDERS) {
        const srcPath = join(targetDir, folder);
        const dstPath = join(conductorDir, folder);
        if (await exists(srcPath)) {
          await cp(srcPath, dstPath, { recursive: true });
          await rm(srcPath, { recursive: true, force: true });
          stdout.write(`  📁 ${folder}/ → conductor/${folder}/\n`);
        }
      }
    } else if (!(await exists(conductorDir))) {
      await cp(join(templateDir, "conductor"), conductorDir, { recursive: true });
      stdout.write("  ✅ Created conductor/ from templates\n");
    }

    // Ensure loop-state.json is installed in conductor/1-workbench/ if missing
    const targetStateFile = join(conductorDir, "1-workbench", "loop-state.json");
    if (!(await exists(targetStateFile))) {
      const templateStateFile = join(templateDir, "conductor", "1-workbench", "loop-state.json");
      if (await exists(templateStateFile)) {
        await mkdir(join(conductorDir, "1-workbench"), { recursive: true });
        await cp(templateStateFile, targetStateFile);
        stdout.write("  ✅ Created conductor/1-workbench/loop-state.json\n");
      }
    }

    // ---- Step 2: Global Kebab-Case Rename Engine ----
    stdout.write("\nStep 2: Formatting repository to kebab-case...\n");
    await renameRecursive(agentsDir, stdout);
    await renameRecursive(conductorDir, stdout);
    await updateChecksumsKeys(checksumPath);

    // ---- Step 3: Safe Upgrade .agents/ via checksums ----
    stdout.write("\nStep 3: Safely upgrading .agents/ Engine...\n");

    const plan = planUpdate(sourceAgentsDir, agentsDir, checksumPath);
    if (plan.length === 0) {
      stdout.write("  ✅ Everything is up to date.\n");
    } else {
      const counts = { COPY: 0, UPDATE: 0, SKIP: 0, KEEP: 0, AVAILABLE: 0 };
      for (const item of plan) {
          counts[item.action] = (counts[item.action] || 0) + 1;
      }
      
      stdout.write(`  📦 Summary: `);
      if (counts.COPY) stdout.write(`${counts.COPY} new, `);
      if (counts.UPDATE) stdout.write(`${counts.UPDATE} updated, `);
      if (counts.SKIP) stdout.write(`${counts.SKIP} skipped (local override), `);
      if (counts.KEEP) stdout.write(`${counts.KEEP} kept (custom)\n`);
      
      executeUpdate(plan, sourceAgentsDir, agentsDir, checksumPath);
      stdout.write(`  ✅ .agents/ upgraded safely.\n`);
    }

    // ---- Step 4: Platform stubs ----
    stdout.write("\nStep 4: Platform stubs...\n");
    for (const stub of ["GEMINI.md", "CLAUDE.md", "CHANGELOG.md"]) {
      const stubPath = join(targetDir, stub);
      if (!(await exists(stubPath))) {
        await cp(join(templateDir, stub), stubPath);
        stdout.write(`  ✅ Created ${stub}\n`);
      } else {
        stdout.write(`  ⏭️  ${stub} exists (kept yours)\n`);
      }
    }

    // ---- Done ----
    stdout.write("\n🎼 Upgrade complete!\n\nVerify: bash .agents/tests/check-conductor.sh\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Upgrade failed: ${message}\n`);
    return 1;
  }
}
