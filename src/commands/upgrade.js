import { access, cp, mkdir, rename, rm, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { planUpdate, executeUpdate } from "../update.js";
import { renameRecursive, updateChecksumsKeys, renameNumberedFolders } from "../kebab.js";
import { generateClaudeCommands, generateClaudeSkills } from "../claude-commands.js";
import { installHooksCommand } from "./install-hooks.js";
import { ensureVerifyCommand } from "../verify-config.js";
import { normalizeState } from "../loop/driver.js";
import { packageVersion, readVersionStamp, writeVersionStamp, detectShape } from "../version.js";
import { createBackup, restoreBackup, ensureGitignore } from "../backup.js";
import { applyManagedStub } from "../stubs.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * The files an upgrade writes, and so the only files its commit may contain.
 * Anything outside this list is the user's, and is never swept in.
 */
const FRAMEWORK_PATHS = [
  ".agents", "CLAUDE.md", "GEMINI.md", "CHANGELOG.md", ".claude/commands",
  "conductor/5-templates", "conductor/1-workbench/loop-state.json",
  "conductor.config.json", ".gitignore",
];

async function git(args, cwd, env) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd, maxBuffer: 1 << 24, env: env ? { ...process.env, ...env } : process.env,
    });
    return { ok: true, stdout: stdout.trim() };
  } catch (e) {
    return { ok: false, stdout: String(e.stdout ?? "").trim(), stderr: String(e.stderr ?? "").trim() };
  }
}

/**
 * The repo's state BEFORE the upgrade writes anything, so the commit step can
 * tell the user's uncommitted edits from the upgrade's own.
 */
async function gitSnapshot(dir) {
  const inRepo = await git(["rev-parse", "--is-inside-work-tree"], dir);
  if (!inRepo.ok || inRepo.stdout !== "true") return { repo: false };
  const head = (await git(["rev-parse", "--verify", "-q", "HEAD"], dir)).ok;
  const busy = [];
  for (const marker of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]) {
    const where = (await git(["rev-parse", "--git-path", marker], dir)).stdout;
    if (where && (await exists(resolve(dir, where)))) busy.push(marker);
  }
  const dirty = (await git(["status", "--porcelain", "--", ...FRAMEWORK_PATHS], dir)).stdout
    .split("\n").filter(Boolean).map((l) => l.slice(3));
  return { repo: true, head, busy, dirty };
}

/**
 * Commit exactly the framework files the upgrade wrote — with the protected-
 * path waiver set, so the gate still logs it — or, when that is not safe, print
 * the one command that does it.
 *
 * WHY. An upgrade rewrites the enforcement hooks, so its commit needs
 * CONDUCTOR_NO_PROTECTED. Making every user discover and type that was the
 * friction the maintainer asked to remove. The push needs nothing: pre-push
 * recognises the official pre-commit it ships with.
 */
async function commitUpgrade({ targetDir, version, snap, noCommit, structural, stdout }) {
  if (!snap.repo) return;
  const existing = [];
  for (const p of FRAMEWORK_PATHS) {
    if (!(await exists(join(targetDir, p)))) continue;
    // An explicitly named ignored path makes `git add` fail outright.
    if ((await git(["check-ignore", "-q", "--", p], targetDir)).ok) continue;
    existing.push(p);
  }
  const paths = existing.join(" ");
  const message = `chore: upgrade Conductor to ${version}`;
  const manual = structural
    ? `git add -A && CONDUCTOR_NO_PROTECTED="conductor upgrade" git commit -m "${message}"`
    : `git add -A -- ${paths} && CONDUCTOR_NO_PROTECTED="conductor upgrade" git commit -m "${message}" -- ${paths}`;
  const printManual = (why) => {
    stdout.write(`\n   Commit it with one command${why ? ` (${why})` : ""}:\n`);
    stdout.write(`     ${manual}\n`);
    stdout.write("   Then push as usual — the push needs no waiver.\n");
  };

  if (noCommit) return printManual("--no-commit");
  if (!snap.head) return printManual("the repo has no commits yet");
  if (snap.busy.length) return printManual(`a ${snap.busy.join("/")} is in progress`);
  if (structural) return printManual("legacy folders were moved — check `git status` first");
  if (snap.dirty.length) {
    return printManual(`you had uncommitted changes in ${snap.dirty.join(", ")}, and I will not commit your work for you`);
  }

  if (!existing.length) return;
  const add = await git(["add", "-A", "--", ...existing], targetDir);
  if (!add.ok) return printManual(`git add failed: ${add.stderr.split("\n")[0]}`);
  if ((await git(["diff", "--cached", "--quiet", "--", ...existing], targetDir)).ok) {
    stdout.write("\n   Nothing to commit — the framework files were already current.\n");
    return;
  }
  // `-- paths` commits ONLY these paths, so anything else the user had staged
  // stays staged and out of this commit.
  const commit = await git(["commit", "-q", "-m", message, "--", ...existing], targetDir, {
    CONDUCTOR_NO_PROTECTED: `conductor upgrade to ${version}`,
  });
  if (!commit.ok) {
    const why = (commit.stdout + "\n" + commit.stderr).split("\n").map((l) => l.trim()).filter(Boolean).slice(-1)[0];
    return printManual(`the commit was refused${why ? `: ${why}` : ""}`);
  }
  const sha = (await git(["rev-parse", "--short", "HEAD"], targetDir)).stdout;
  stdout.write(`\n   ✅ Committed the upgrade as ${sha}. Push as usual — no waiver needed.\n`);
}

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

// Framework numbered folders that may sit at the project root in a very old (V4) install.
const ROOT_FOLDER_NAMES = [
  "0-Compass", "1-Workbench", "2-Backlog", "3-Product-Areas", "4-Context", "5-Templates", "6-Archive",
  "0-compass", "1-workbench", "2-backlog", "3-product-areas", "4-context", "5-templates", "6-archive",
];

function planCounts(plan) {
  const c = { COPY: 0, UPDATE: 0, KEEP: 0, AVAILABLE: 0, REMOVE: 0 };
  for (const item of plan) c[item.action] = (c[item.action] || 0) + 1;
  return c;
}

export async function upgradeCommand(args, { cwd, stdout, stderr }) {
  const dryRun = args.includes("--dry-run");
  const noBackup = args.includes("--no-backup");
  const noCommit = args.includes("--no-commit");
  const positional = args.filter((a) => !a.startsWith("--"));
  const targetDir = resolve(cwd, positional[0] || ".");

  const agentsDir = join(targetDir, ".agents");
  const legacyAgentDir = join(targetDir, ".agent");
  const conductorDir = join(targetDir, "conductor");
  const legacyConductorDir = join(targetDir, ".conductor");
  const templateDir = getTemplateDir();
  const sourceAgentsDir = join(templateDir, ".agents");
  const source5Templates = join(templateDir, "conductor", "5-templates");
  const checksumPath = join(agentsDir, ".checksums.json");
  const target5Templates = join(conductorDir, "5-templates");
  const loopStateRel = join("conductor", "1-workbench", "loop-state.json");

  try {
    const hasAgents = await exists(agentsDir);
    const hasLegacyAgent = await exists(legacyAgentDir);
    const hasConductor = await exists(conductorDir);
    const hasLegacyConductor = await exists(legacyConductorDir);
    const rootFolders = [];
    for (const f of ROOT_FOLDER_NAMES) if (await exists(join(targetDir, f))) rootFolders.push(f);
    const hasRootFolders = rootFolders.length > 0;

    if (!hasAgents && !hasLegacyAgent && !hasRootFolders && !hasLegacyConductor && !hasConductor) {
      stderr.write(
        "This doesn't look like a Conductor project.\n" +
          "No .agents/, .agent/, or numbered folders found.\n" +
          'Run "conductor init" to set up a new project instead.\n'
      );
      return 1;
    }

    const version = packageVersion();
    // Core/default skills always land on upgrade (like rules/workflows), so new
    // primitives arrive even if they postdate the user's .selections.json.
    let coreSkills = new Set();
    try {
      const reg = JSON.parse(await readFile(join(sourceAgentsDir, "registry.json"), "utf8"));
      coreSkills = new Set((reg.skills || []).filter((s) => s.default || s.category === "core").map((s) => s.dir));
    } catch { /* registry unreadable → fall back to selections only */ }

    const stamp = readVersionStamp(agentsDir);
    const shape = stamp ? `stamped ${stamp.frameworkVersion}` : detectShape(targetDir);
    const doesStructuralMigration = hasLegacyAgent || hasLegacyConductor || hasRootFolders;

    stdout.write(`🎼 Conductor Framework — Upgrade${dryRun ? " (dry run)" : ""}\n\n`);
    stdout.write(`  Detected: ${shape}  →  target ${version}\n`);
    if (stamp && stamp.frameworkVersion === version && !doesStructuralMigration) {
      stdout.write(`  Already on ${version}; refreshing derived artifacts only.\n`);
    }

    // ---- Dry run: compute and print the plan, write nothing ----
    if (dryRun) {
      if (doesStructuralMigration) {
        stdout.write(`  Structural: normalize legacy layout (`);
        stdout.write([hasLegacyAgent && ".agent/", hasLegacyConductor && ".conductor/", hasRootFolders && "root numbered folders"].filter(Boolean).join(", "));
        stdout.write(")\n");
      }
      stdout.write(`  Backup:   .conductor-backup/<ts>/ (.agents/${(await exists(target5Templates)) ? ", conductor/5-templates/" : ""}${doesStructuralMigration ? ", legacy dirs" : ""})\n`);
      if (hasAgents) {
        const c = planCounts(planUpdate(sourceAgentsDir, agentsDir, checksumPath, { coreSkills }));
        stdout.write(`  .agents/  REPLACE ${c.UPDATE} framework · ADD ${c.COPY} new · PRUNE ${c.REMOVE} dropped · CARRY ${c.KEEP} custom · ${c.AVAILABLE} optional (not selected)\n`);
      } else {
        stdout.write(`  .agents/  fresh install\n`);
      }
      if (await exists(target5Templates)) {
        const c5 = planCounts(planUpdate(source5Templates, target5Templates, ""));
        stdout.write(`  conductor/5-templates/  REFRESH ${c5.UPDATE + c5.COPY} · CARRY ${c5.KEEP} custom\n`);
      }
      const lsPath = join(targetDir, loopStateRel);
      stdout.write(`  ${loopStateRel}  ${(await exists(lsPath)) ? "MIGRATE schema → v2" : "CREATE"}\n`);
      stdout.write(`  Preserve: conductor/ knowledge (0-compass,2-backlog,3-product-areas,4-context,6-archive) untouched\n`);
      stdout.write(`  Stubs: refresh CLAUDE.md/GEMINI.md managed block (keep your edits + CHANGELOG.md)\n`);
      stdout.write(`  Then: regenerate .claude/commands, git hooks; stamp ${version}\n`);
      stdout.write(`\nNo changes written (dry run). Re-run without --dry-run to apply.\n`);
      return 0;
    }

    // Before anything is written: what in the framework files is already the
    // user's own uncommitted work? The commit step must never sweep it in.
    const snap = await gitSnapshot(targetDir);

    // ---- Backup first (unless opted out) ----
    let backup = null;
    const backupPaths = [];
    if (hasAgents) backupPaths.push(".agents");
    if (await exists(target5Templates)) backupPaths.push(join("conductor", "5-templates"));
    if (await exists(join(targetDir, loopStateRel))) backupPaths.push(loopStateRel);
    for (const stub of ["CLAUDE.md", "GEMINI.md"]) {
      if (await exists(join(targetDir, stub))) backupPaths.push(stub);
    }
    if (doesStructuralMigration) {
      if (hasLegacyAgent) backupPaths.push(".agent");
      if (hasLegacyConductor) backupPaths.push(".conductor");
      for (const f of rootFolders) backupPaths.push(f);
    }
    if (!noBackup && backupPaths.length) {
      backup = createBackup(targetDir, backupPaths);
      ensureGitignore(targetDir);
      stdout.write(`\nStep 0: Backed up ${backup.copied.length} path(s) → ${backup.backupRoot.replace(targetDir + "/", "")}\n`);
    }

    // Everything past here is restorable from the backup on failure.
    try {
      // ---- Step 1: Structural migrations (legacy layout → current) ----
      stdout.write("\nStep 1: Structural migrations...\n");
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
      if (hasRootFolders) {
        await mkdir(conductorDir, { recursive: true });
        for (const folder of rootFolders) {
          const src = join(targetDir, folder);
          const dst = join(conductorDir, folder);
          if (!(await exists(dst))) {
            await cp(src, dst, { recursive: true });
            await rm(src, { recursive: true, force: true });
            stdout.write(`  📁 ${folder}/ → conductor/${folder}/\n`);
          } else {
            stdout.write(`  ⚠️  Left ${folder}/ at root (conductor/${folder}/ already exists — merge manually)\n`);
          }
        }
      } else if (!(await exists(conductorDir))) {
        await cp(join(templateDir, "conductor"), conductorDir, { recursive: true });
        stdout.write("  ✅ Created conductor/ from templates\n");
      }

      // ---- Step 2: Normalize casing (framework names only) ----
      stdout.write("\nStep 2: Normalizing framework names to kebab-case...\n");
      await renameRecursive(agentsDir, stdout);        // all of .agents/ is framework
      await renameNumberedFolders(conductorDir, stdout); // only the numbered folders, no user files
      if (await exists(target5Templates)) await renameRecursive(target5Templates, stdout);
      await updateChecksumsKeys(checksumPath);

      // ---- Step 3: Replace .agents/ framework files (carry forward custom) ----
      stdout.write("\nStep 3: Upgrading .agents/ instructions...\n");
      const plan = planUpdate(sourceAgentsDir, agentsDir, checksumPath, { coreSkills });
      const c = planCounts(plan);
      executeUpdate(plan, sourceAgentsDir, agentsDir, checksumPath);
      stdout.write(`  ✅ Replaced ${c.UPDATE} framework files, added ${c.COPY} new, pruned ${c.REMOVE} dropped upstream, carried ${c.KEEP} custom (${c.AVAILABLE} optional not installed).\n`);

      // ---- Step 4: Refresh conductor/5-templates (framework scaffolding) ----
      stdout.write("\nStep 4: Refreshing conductor/5-templates/...\n");
      await mkdir(target5Templates, { recursive: true });
      const plan5 = planUpdate(source5Templates, target5Templates, "");
      const c5 = planCounts(plan5);
      executeUpdate(plan5, source5Templates, target5Templates, "", { writeChecksums: false });
      stdout.write(`  ✅ Refreshed ${c5.UPDATE + c5.COPY} template files, carried ${c5.KEEP} custom.\n`);

      // ---- Step 5: Migrate loop-state.json schema (v1 → v2) ----
      stdout.write("\nStep 5: Loop-state schema...\n");
      const targetStateFile = join(conductorDir, "1-workbench", "loop-state.json");
      await mkdir(join(conductorDir, "1-workbench"), { recursive: true });
      if (await exists(targetStateFile)) {
        let raw = {};
        try { raw = JSON.parse(await readFile(targetStateFile, "utf8")); } catch { raw = {}; }
        const wasV2 = raw.schema_version === 2;
        const migrated = normalizeState(raw);
        await writeFile(targetStateFile, JSON.stringify(migrated, null, 2) + "\n");
        stdout.write(wasV2 ? "  ✅ loop-state.json already v2 (normalized).\n" : "  ✅ Migrated loop-state.json → schema v2.\n");
      } else {
        const templateStateFile = join(templateDir, "conductor", "1-workbench", "loop-state.json");
        if (await exists(templateStateFile)) {
          await cp(templateStateFile, targetStateFile);
          stdout.write("  ✅ Created loop-state.json.\n");
        }
      }

      // ---- Step 6: Platform stubs ----
      stdout.write("\nStep 6: Platform stubs...\n");
      // CLAUDE.md / GEMINI.md carry a Conductor-managed block — refresh it in place,
      // preserving anything the user wrote outside the markers.
      for (const stub of ["CLAUDE.md", "GEMINI.md"]) {
        const outcome = applyManagedStub(join(targetDir, stub), join(templateDir, stub));
        stdout.write(`  ${outcome === "unchanged" ? "⏭️ " : "✅"} ${stub} ${outcome} (managed block)\n`);
      }
      // CHANGELOG.md is the user's own project changelog — create only if absent.
      const changelogPath = join(targetDir, "CHANGELOG.md");
      if (!(await exists(changelogPath))) {
        await cp(join(templateDir, "CHANGELOG.md"), changelogPath);
        stdout.write("  ✅ Created CHANGELOG.md\n");
      } else {
        stdout.write("  ⏭️  CHANGELOG.md exists (kept yours — it's your changelog)\n");
      }

      // ---- Step 7: Claude Code slash commands ----
      stdout.write("\nStep 7: Claude Code slash commands...\n");
      const { written } = await generateClaudeCommands(targetDir, { stdout });
      if (written === 0) stdout.write("  ⏭️  No workflows found; skipped .claude/commands/\n");
      await generateClaudeSkills(targetDir, { stdout });

      // ---- Step 8: Enforcement hooks ----
      stdout.write("\nStep 8: Enforcement hooks...\n");
      if (await exists(join(targetDir, ".git"))) {
        await installHooksCommand([targetDir], { cwd, stdout, stderr });
      } else {
        stdout.write("  ⏭️  Not a git repo; skipped hook wiring.\n");
      }

      // ---- Step 9: Version stamp ----
      const stampWritten = writeVersionStamp(agentsDir);
      stdout.write(`\nStep 9: Stamped .agents/.conductor-version.json → ${stampWritten.frameworkVersion}\n`);
    } catch (stepError) {
      if (backup) {
        stdout.write("\n⚠️  Upgrade failed mid-run — restoring from backup...\n");
        restoreBackup(targetDir, backup.backupRoot, backup.copied);
        stdout.write("  ✅ Restored. Your project is unchanged.\n");
      }
      throw stepError;
    }

    // An upgraded install with no verify command is one where the Iron Law is
    // still off. Derive it if the files allow, otherwise say so — never silently.
    await ensureVerifyCommand(targetDir, stdout);

    stdout.write("\n🎼 Upgrade complete!\n");
    await commitUpgrade({ targetDir, version, snap, noCommit, structural: doesStructuralMigration, stdout });
    if (backup) stdout.write(`   Old instructions backed up in ${backup.backupRoot.replace(targetDir + "/", "")} (git-ignored).\n`);
    stdout.write("   Your conductor/ project knowledge was preserved.\n");
    stdout.write("   Verify: bash .agents/tests/check-conductor.sh\n");
    stdout.write("   Autonomous loop: `conductor loop --dry-run` (npm i -g github:charlus/conductor-framework) or `npx github:charlus/conductor-framework loop --dry-run`.\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`Upgrade failed: ${message}\n`);
    return 1;
  }
}
