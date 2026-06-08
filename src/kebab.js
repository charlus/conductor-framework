import { readdir, rename, stat, readFile, writeFile, access } from "node:fs/promises";
import { join, parse } from "node:path";
import { constants as fsConstants } from "node:fs";

const IGNORED_FILES = new Set(["AGENTS.md", "SKILL.md", "GEMINI.md", "CLAUDE.md", "CHANGELOG.md", "README.md", "package.json"]);

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
    
    if (newFullPath !== fullPath) {
      if (!(await exists(newFullPath))) {
        await rename(fullPath, newFullPath);
        if (stdout) stdout.write(`  📝 Renamed: ${entry} -> ${newEntry}\n`);
      } else {
        // Fallback: lowercase exists, just overwrite
        await rename(fullPath, newFullPath);
      }
    }
    
    if (stats.isDirectory()) {
      await renameRecursive(newFullPath, stdout);
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
