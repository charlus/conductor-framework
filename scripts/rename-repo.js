import { readdir, rename, stat } from "node:fs/promises";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const IGNORED_FILES = new Set(["AGENTS.md", "SKILL.md", "GEMINI.md", "CLAUDE.md", "CHANGELOG.md", "README.md", "package.json"]);

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

async function renameRecursive(dir) {
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    if (IGNORED_FILES.has(entry) || entry.startsWith(".")) {
      if (entry !== ".agents" && entry.startsWith(".")) continue;
    }
    
    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);
    
    let newEntry = entry;
    if (!IGNORED_FILES.has(entry) && entry !== ".agents") {
      const parsed = parse(entry);
      // Only kebab-case the filename, not the extension
      const kebabName = toKebabCase(parsed.name) + parsed.ext.toLowerCase();
      newEntry = kebabName;
    }

    const newFullPath = join(dir, newEntry);
    
    if (newFullPath !== fullPath) {
      await rename(fullPath, newFullPath);
      console.log(`Renamed: ${entry} -> ${newEntry}`);
    }
    
    // If it's a directory, recurse into it
    // Note: We recurse into the NEW path if it was renamed
    if (stats.isDirectory()) {
      await renameRecursive(newFullPath);
    }
  }
}

async function main() {
  const templatesDir = fileURLToPath(new URL("../templates", import.meta.url));
  await renameRecursive(templatesDir);
  console.log("Repository rename complete.");
}

main().catch(console.error);
