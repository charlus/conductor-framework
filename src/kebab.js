import { readdir, rename, stat, readFile, writeFile, access } from "node:fs/promises";
import { join, parse } from "node:path";
import { constants as fsConstants } from "node:fs";

const IGNORED_FILES = new Set([
  "AGENTS.md", "SKILL.md", "GEMINI.md", "CLAUDE.md", "CHANGELOG.md", "README.md", "package.json",
  // Files whose casing is canonical and must not be kebab-lowercased.
  "Dockerfile", "Dockerfile.sandbox",
]);

export function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function renameRecursive(dir, stdout) {
  if (!(await exists(dir))) return;
  
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    if (IGNORED_FILES.has(entry) || entry === ".checksums.json" || entry.startsWith(".")) {
      if (entry !== ".agents" && entry.startsWith(".")) continue;
    }
    
    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);
    
    let newEntry = entry;
    if (!IGNORED_FILES.has(entry) && entry !== ".agents") {
      const parsed = parse(entry);
      newEntry = toKebabCase(parsed.name) + parsed.ext.toLowerCase();
    }

    const newFullPath = join(dir, newEntry);

    let effectivePath = fullPath;
    if (newFullPath !== fullPath) {
      if (!(await exists(newFullPath))) {
        await rename(fullPath, newFullPath);
        effectivePath = newFullPath;
        if (stdout) stdout.write(`  📝 Renamed: ${entry} -> ${newEntry}\n`);
      } else {
        // Collision: the kebab-cased target already exists. Do NOT clobber —
        // leave the original in place (a backup is taken before upgrade anyway).
        if (stdout) stdout.write(`  ⚠️  Skipped rename (target exists): ${entry}\n`);
      }
    }

    if (stats.isDirectory()) {
      await renameRecursive(effectivePath, stdout);
    }
  }
}

// The framework-scaffolded numbered folders, Title-Case → kebab.
const NUMBERED_FOLDER_NAMES = [
  "0-Compass", "1-Workbench", "2-Backlog", "3-Product-Areas",
  "4-Context", "5-Templates", "6-Archive",
];

/**
 * Kebab-rename ONLY the known framework numbered folders at the top of
 * `conductor/`. Deliberately does not recurse — user knowledge files inside
 * these folders keep whatever names the user gave them.
 */
export async function renameNumberedFolders(conductorDir, stdout) {
  if (!(await exists(conductorDir))) return;
  for (const name of NUMBERED_FOLDER_NAMES) {
    const kebab = toKebabCase(name);
    if (name === kebab) continue;
    const src = join(conductorDir, name);
    const dst = join(conductorDir, kebab);
    if ((await exists(src)) && !(await exists(dst))) {
      await rename(src, dst);
      if (stdout) stdout.write(`  📝 ${name}/ → ${kebab}/\n`);
    }
  }
}

export function kebabCasePath(filePath) {
  return filePath.split('/').map(part => {
    if (IGNORED_FILES.has(part)) return part;
    const parsed = parse(part);
    return toKebabCase(parsed.name) + parsed.ext.toLowerCase();
  }).join('/');
}

export async function updateChecksumsKeys(checksumPath) {
  if (!(await exists(checksumPath))) return;
  
  try {
    const content = await readFile(checksumPath, "utf-8");
    const checksums = JSON.parse(content);
    const newChecksums = {};
    let changed = false;
    
    for (const [key, value] of Object.entries(checksums)) {
      const newKey = kebabCasePath(key);
      newChecksums[newKey] = value;
      if (key !== newKey) changed = true;
    }
    
    if (changed) {
      await writeFile(checksumPath, JSON.stringify(newChecksums, null, 2) + '\n');
    }
  } catch (e) {
    // ignore
  }
}
