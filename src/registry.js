/**
 * registry.js — Shared utility for skills registry operations.
 *
 * Uses `glab api` to interact with the GitLab-hosted skills registry.
 * Requires GitLab CLI (`glab`) to be installed and authenticated.
 */

import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

const exec = promisify(execFile);

// Default registry project path on GitLab
const DEFAULT_REGISTRY = "conductor/skills-registry";
const DEFAULT_HOSTNAME = "your-gitlab-instance.com";

/**
 * Check if glab CLI is installed and authenticated for the target hostname.
 * @returns {{ ok: boolean, error?: string }}
 */
export async function checkGlabAuth(hostname = DEFAULT_HOSTNAME) {
  try {
    const { stdout } = await exec("glab", ["auth", "status", "--hostname", hostname], {
      timeout: 10_000,
    });
    // glab auth status outputs to stderr on success, stdout may be empty
    return { ok: true };
  } catch (err) {
    // glab auth status exits non-zero if not authenticated
    const message = err.stderr || err.message || "Unknown error";
    if (message.includes("not found") || err.code === "ENOENT") {
      return { ok: false, error: "GitLab CLI (glab) is not installed. Install it: https://gitlab.com/gitlab-org/cli" };
    }
    return { ok: false, error: `Not authenticated to ${hostname}. Run: glab auth login --hostname ${hostname}` };
  }
}

/**
 * Resolve registry settings from conductor.config.json or defaults.
 * @param {string} projectDir - The project root directory
 * @returns {{ project: string, hostname: string }}
 */
export async function resolveRegistry(projectDir) {
  const configPath = join(projectDir, "conductor.config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (config.registry) {
      // Parse URL: https://your-gitlab-instance.com/conductor/skills-registry
      const url = new URL(config.registry);
      return {
        hostname: url.hostname,
        project: url.pathname.replace(/^\//, "").replace(/\/$/, ""),
      };
    }
  } catch {
    // No config or invalid — use defaults
  }
  return { hostname: DEFAULT_HOSTNAME, project: DEFAULT_REGISTRY };
}

/**
 * Fetch the registry.json index from GitLab.
 * @returns {object} Parsed registry index
 */
export async function fetchRegistryIndex(hostname, project) {
  const encodedProject = encodeURIComponent(project);
  const endpoint = `projects/${encodedProject}/repository/files/registry.json/raw?ref=main`;

  const { stdout } = await exec("glab", [
    "api", endpoint,
    "--hostname", hostname,
  ], { timeout: 30_000 });

  return JSON.parse(stdout);
}

/**
 * Download a single skill folder from the registry.
 * Uses GitLab's archive API with path parameter for selective download.
 * @param {string} hostname - GitLab hostname
 * @param {string} project - Project path (e.g., "conductor/skills-registry")
 * @param {string} skillName - Skill directory name in the registry
 * @param {string} targetDir - Where to extract (e.g., ".agents/skills")
 * @returns {string} Path to the installed skill
 */
export async function downloadSkill(hostname, project, skillName, targetDir) {
  const encodedProject = encodeURIComponent(project);
  const tmpFile = join(tmpdir(), `conductor-skill-${skillName}-${Date.now()}.tar.gz`);

  try {
    // Download the skill subdirectory as a tar.gz archive
    await exec("glab", [
      "api", `projects/${encodedProject}/repository/archive.tar.gz`,
      "--hostname", hostname,
      "--input", `/dev/null`,
      "--output", tmpFile,
      "--", `path=skills/${skillName}`,
    ], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });

    // Ensure target directory exists
    const skillTargetDir = join(targetDir, skillName);
    await mkdir(skillTargetDir, { recursive: true });

    // Extract — strip the archive root + "skills/<name>" prefix
    // GitLab archives have a root folder like "skills-registry-main-<hash>"
    // We need to find the right strip level dynamically
    await exec("tar", [
      "-xzf", tmpFile,
      "-C", skillTargetDir,
      "--strip-components", "2",
      "--wildcards", `*/skills/${skillName}/*`,
    ], { timeout: 30_000 });

    return skillTargetDir;
  } finally {
    // Clean up temp file
    try {
      await rm(tmpFile, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Read locally installed skills from .agents/skills/.
 * @param {string} skillsDir - Path to .agents/skills/
 * @returns {Array<{ name: string, dir: string, manifest: object|null }>}
 */
export async function readLocalSkills(skillsDir) {
  let entries;
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    let manifest = null;
    try {
      const raw = await readFile(join(skillsDir, entry.name, "skill.json"), "utf-8");
      manifest = JSON.parse(raw);
    } catch {
      // No manifest — legacy skill
    }

    skills.push({
      name: manifest?.name || entry.name.toLowerCase(),
      dir: entry.name,
      manifest,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if a path exists.
 */
export async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
