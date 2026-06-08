import { access, cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { planUpdate, executeUpdate } from "../update.js";

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
    const hasRootFolders = await exists(join(targetDir, "0-Compass"));

    if (!hasAgents && !hasLegacyAgent && !hasRootFolders && !hasLegacyConductor) {
      stderr.write(
        "This doesn't look like a Conductor project.\n" +
          "No .agents/, .agent/, or numbered folders found.\n" +
          'Run "conductor init" to set up a new project instead.\n'
      );
      return 1;
    }

    stdout.write("🎼 Conductor Framework — Upgrade\n\n");

    // ---- Step 1: Migrate .agent/ → .agents/ ----
    if (hasLegacyAgent && !hasAgents) {
      stdout.write("Step 1: Migrating .agent/ → .agents/...\n");
      await rename(legacyAgentDir, agentsDir);
      stdout.write("  📁 .agent/ → .agents/ (Antigravity convention)\n");
    } else if (hasLegacyAgent && hasAgents) {
      stdout.write("Step 1: Directory migration...\n  ⚠️  Both .agent/ and .agents/ exist. Removing legacy .agent/\n");
      await rm(legacyAgentDir, { recursive: true, force: true });
    } else {
      stdout.write("Step 1: Directory migration... ✅ Already using .agents/\n");
    }

    // ---- Step 2: Safe Upgrade .agents/ via checksums ----
    stdout.write("\nStep 2: Safely upgrading .agents/ Engine...\n");

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

    // ---- Step 3: Migrate numbered folders & legacy .conductor ----
    if (hasLegacyConductor && !hasConductor) {
      stdout.write("\nStep 3: Migrating legacy .conductor/ to visible conductor/...\n");
      await rename(legacyConductorDir, conductorDir);
      stdout.write("  📁 .conductor/ → conductor/ (Dropped the dot for UX)\n");
    } else if (hasLegacyConductor && hasConductor) {
      stdout.write("\nStep 3: Directory migration...\n  ⚠️  Both .conductor/ and conductor/ exist. Removing legacy .conductor/\n");
      await rm(legacyConductorDir, { recursive: true, force: true });
    }

    if (hasRootFolders && !hasConductor && !hasLegacyConductor) {
      stdout.write("\nStep 3: Migrating root folders to conductor/ structure...\n");
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
      stdout.write("  ✅ Migration complete\n");
    } else if (hasRootFolders && (hasConductor || hasLegacyConductor)) {
      stdout.write("\nStep 3: Folder migration...\n  ⚠️  Both root folders and conductor/ exist.\n     Keeping conductor/ (already migrated). Old root folders left untouched.\n");
    } else if (hasConductor) {
      stdout.write("\nStep 3: Folder migration... ✅ Already using conductor/\n");
    } else if (!hasLegacyConductor) {
      stdout.write("\nStep 3: Creating conductor/ (project state)...\n");
      await cp(join(templateDir, "conductor"), conductorDir, { recursive: true });
      stdout.write("  ✅ Created conductor/ from templates\n");
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
