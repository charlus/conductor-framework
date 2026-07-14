import { access, chmod, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";

const execFileAsync = promisify(execFile);

const HOOKS_REL = ".agents/hooks";
// Files that must be executable and are safe to chmod (the git-hook entry points).
const EXECUTABLE_HOOKS = ["pre-commit", "pre-push", "verification-stop-hook.sh", "lib.sh"];

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function git(args, cwd) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return { ok: true, stdout: stdout.trim() };
  } catch (error) {
    return { ok: false, stdout: "", error };
  }
}

/**
 * Install (or uninstall) Conductor's deterministic git hooks by pointing
 * git's core.hooksPath at .agents/hooks. Never clobbers a foreign hooksPath.
 */
export async function installHooksCommand(args, { cwd, stdout, stderr }) {
  const uninstall = args.includes("--uninstall");
  const positional = args.find((a) => !a.startsWith("-"));
  const targetDir = resolve(cwd, positional || ".");

  const inRepo = await git(["rev-parse", "--is-inside-work-tree"], targetDir);
  if (!inRepo.ok || inRepo.stdout !== "true") {
    stderr.write("Not a git repository — nothing to wire. Run this inside your project's git repo.\n");
    return 1;
  }

  const hooksDir = join(targetDir, HOOKS_REL);
  if (!(await exists(hooksDir))) {
    stderr.write(`No ${HOOKS_REL}/ found. Run 'conductor init' or 'conductor upgrade' first.\n`);
    return 1;
  }

  const current = await git(["config", "--local", "--get", "core.hooksPath"], targetDir);
  const currentPath = current.ok ? current.stdout : "";

  if (uninstall) {
    if (currentPath === HOOKS_REL) {
      await git(["config", "--local", "--unset", "core.hooksPath"], targetDir);
      stdout.write("✅ Conductor hooks disabled (core.hooksPath unset).\n");
    } else {
      stdout.write("ℹ️  Conductor hooks were not the active hooksPath; nothing changed.\n");
    }
    return 0;
  }

  // Make the hook entry points executable (copy may drop the bit).
  for (const name of EXECUTABLE_HOOKS) {
    const p = join(hooksDir, name);
    if (await exists(p)) {
      try {
        await chmod(p, 0o755);
      } catch {
        /* best-effort */
      }
    }
  }

  if (currentPath && currentPath !== HOOKS_REL) {
    stdout.write(
      `⚠️  core.hooksPath is already set to '${currentPath}'. Leaving it as-is.\n` +
        `   To use Conductor's hooks, wire them into that path, or run:\n` +
        `     git config --local core.hooksPath ${HOOKS_REL}\n`
    );
    return 0;
  }

  const set = await git(["config", "--local", "core.hooksPath", HOOKS_REL], targetDir);
  if (!set.ok) {
    stderr.write("Failed to set core.hooksPath.\n");
    return 1;
  }

  const present = new Set(await readdir(hooksDir));
  const wired = ["pre-commit", "pre-push"].filter((h) => present.has(h));
  stdout.write(
    `✅ Conductor enforcement hooks enabled (core.hooksPath → ${HOOKS_REL}): ${wired.join(", ")}\n` +
      `   Test-Driven Law on commit, Verification Iron Law on push. Bypass is logged; see ${HOOKS_REL}/README.md.\n`
  );
  return 0;
}
