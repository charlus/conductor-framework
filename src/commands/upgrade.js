import { access, cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
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
  const conductorDir = join(targetDir, ".conductor");
  const templateDir = getTemplateDir();

  try {
    // Verify target is a Conductor project
    const hasAgents = await exists(agentsDir);
    const hasLegacyAgent = await exists(legacyAgentDir);
    const hasConductor = await exists(conductorDir);
    const hasRootFolders = await exists(join(targetDir, "0-Compass"));

    if (!hasAgents && !hasLegacyAgent && !hasRootFolders) {
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
      stdout.write("Step 1: Directory migration...\n");
      stdout.write("  ⚠️  Both .agent/ and .agents/ exist. Removing legacy .agent/\n");
      await rm(legacyAgentDir, { recursive: true, force: true });
    } else {
      stdout.write("Step 1: Directory migration... ✅ Already using .agents/\n");
    }

    // ---- Step 2: Upgrade .agents/ ----
    stdout.write("\nStep 2: Upgrading .agents/ (framework code)...\n");

    // Count skills before upgrade for diff
    let oldSkillCount = 0;
    const oldSkillsDir = join(agentsDir, "skills");
    if (await exists(oldSkillsDir)) {
      const oldSkills = await readdir(oldSkillsDir);
      oldSkillCount = oldSkills.filter((s) => !s.startsWith(".")).length;
    }

    // Replace .agents/ with latest
    await rm(agentsDir, { recursive: true, force: true });
    await cp(join(templateDir, ".agents"), agentsDir, { recursive: true });

    // Count skills after upgrade
    const newSkills = await readdir(join(agentsDir, "skills"));
    const newSkillCount = newSkills.filter((s) => !s.startsWith(".")).length;

    stdout.write(`  ✅ .agents/ replaced with latest\n`);
    if (oldSkillCount > 0) {
      const diff = newSkillCount - oldSkillCount;
      if (diff > 0) {
        stdout.write(`  📦 Skills: ${oldSkillCount} → ${newSkillCount} (+${diff} new)\n`);
      } else if (diff < 0) {
        stdout.write(`  📦 Skills: ${oldSkillCount} → ${newSkillCount} (${diff} removed)\n`);
      } else {
        stdout.write(`  📦 Skills: ${newSkillCount} (no change)\n`);
      }
    } else {
      stdout.write(`  📦 Skills: ${newSkillCount}\n`);
    }

    // ---- Step 3: Migrate numbered folders ----
    if (hasRootFolders && !hasConductor) {
      stdout.write("\nStep 3: Migrating to .conductor/ structure...\n");
      await mkdir(conductorDir, { recursive: true });

      for (const folder of NUMBERED_FOLDERS) {
        const srcPath = join(targetDir, folder);
        const dstPath = join(conductorDir, folder);
        if (await exists(srcPath)) {
          await cp(srcPath, dstPath, { recursive: true });
          await rm(srcPath, { recursive: true, force: true });
          stdout.write(`  📁 ${folder}/ → .conductor/${folder}/\n`);
        }
      }
      stdout.write("  ✅ Migration complete\n");
    } else if (hasRootFolders && hasConductor) {
      stdout.write("\nStep 3: Folder migration...\n");
      stdout.write("  ⚠️  Both root folders and .conductor/ exist.\n");
      stdout.write("     Keeping .conductor/ (already migrated). Old root folders left untouched.\n");
    } else if (hasConductor) {
      stdout.write("\nStep 3: Folder migration... ✅ Already using .conductor/\n");
    } else {
      stdout.write("\nStep 3: Creating .conductor/ (project state)...\n");
      await cp(join(templateDir, ".conductor"), conductorDir, { recursive: true });
      stdout.write("  ✅ Created .conductor/ from templates\n");
    }

    // ---- Step 4: Platform stubs ----
    stdout.write("\nStep 4: Platform stubs...\n");
    for (const stub of ["GEMINI.md", "CLAUDE.md"]) {
      const stubPath = join(targetDir, stub);
      if (!(await exists(stubPath))) {
        await cp(join(templateDir, stub), stubPath);
        stdout.write(`  ✅ Created ${stub}\n`);
      } else {
        stdout.write(`  ⏭️  ${stub} exists (kept yours)\n`);
      }
    }

    // ---- Done ----
    stdout.write("\n🎼 Upgrade complete!\n\n");
    stdout.write("Verify: bash .agents/tests/check-conductor.sh\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Upgrade failed: ${message}\n`);
    return 1;
  }
}
