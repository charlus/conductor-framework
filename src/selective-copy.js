import fs from 'fs';
import path from 'path';
import { buildChecksumManifest, writeChecksumFile } from './checksums.js';

/**
 * @property {string[]} bundles    - Selected bundle names
 * @property {string[]} skills     - Selected skill directory names
 * @property {string[]} rules      - Selected rule item names
 * @property {string[]} workflows  - Selected workflow item names
 */

/**
 * Load and parse the registry.json from the source .agents directory.
 * @param {string} sourceAgentDir - Absolute path to source .agents directory.
 * @returns {Object} Parsed registry object.
 */
function loadRegistry(sourceAgentDir) {
    const registryPath = path.join(sourceAgentDir, 'registry.json');
    if (!fs.existsSync(registryPath)) {
        throw new Error(
            'registry.json not found in .agents directory. Ensure the package is up to date.'
        );
    }
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

/**
 * Resolve a registry entry to its filesystem path relative to .agents/.
 * Skills are directories under skills/<name>/.
 * Rules and workflows use their `file` property, or fall back to `<name>.md`.
 *
 * @param {'skills'|'rules'|'workflows'} section
 * @param {Object} registryEntry
 * @returns {string} Relative path prefix (for skills) or file path (for rules/workflows)
 */
function resolveEntryPath(section, registryEntry) {
    if (section === 'skills') {
        // Skills are entire directories: skills/<name>/
        return `skills/${registryEntry.dir || registryEntry.name}`;
    }
    // Rules and workflows are single files
    const file = registryEntry.file || `${registryEntry.name}.md`;
    return `${section}/${file}`;
}

/**
 * Build a mapping from item name → registry entry for a given section.
 * @param {Object} registry
 * @param {'skills'|'rules'|'workflows'} section
 * @returns {Map<string, Object>}
 */
function buildEntryMap(registry, section) {
    const map = new Map();
    for (const entry of registry[section]) {
        map.set(entry.name, entry);
    }
    return map;
}

/**
 * Copy a single file, creating parent directories as needed.
 * @param {string} src - Absolute source path
 * @param {string} dst - Absolute destination path
 */
function copyFile(src, dst) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

/**
 * Recursively copy a directory.
 * @param {string} srcDir - Absolute source directory
 * @param {string} dstDir - Absolute destination directory
 */
function copyDirRecursive(srcDir, dstDir) {
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(dstDir, { recursive: true });

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, dstPath);
        } else if (entry.isFile()) {
            copyFile(srcPath, dstPath);
        }
    }
}

/**
 * Perform a selective copy of .agents contents based on user selections.
 *
 * Copies:
 *   - registry.json (always — needed for future updates)
 *   - Selected skill directories (skills/<name>/)
 *   - Selected rule files (rules/<file>)
 *   - Selected workflow files (workflows/<file>)
 *
 * Writes:
 *   - .selections.json recording user's choices
 *   - .checksums.json for installed files only
 *
 * @param {string}     sourceAgentDir - Absolute path to source .agents/
 * @param {string}     targetAgentDir - Absolute path to target .agents/
 * @param {Selections} selections     - User's selections
 * @param {Object}     registry       - Parsed registry.json
 */
function selectiveCopy(sourceAgentDir, targetAgentDir, selections, registry) {
    // Ensure target .agents directory exists
    fs.mkdirSync(targetAgentDir, { recursive: true });

    // 1. Always copy registry.json and core infrastructure
    const coreFiles = ['registry.json', 'AGENTS.md', 'how-it-works.md'];
    for (const file of coreFiles) {
        const src = path.join(sourceAgentDir, file);
        const dst = path.join(targetAgentDir, file);
        if (fs.existsSync(src)) copyFile(src, dst);
    }
    
    const coreDirs = ['personas', 'tests', 'hooks', 'sandbox'];
    for (const dir of coreDirs) {
        const srcDir = path.join(sourceAgentDir, dir);
        const dstDir = path.join(targetAgentDir, dir);
        if (fs.existsSync(srcDir)) copyDirRecursive(srcDir, dstDir);
    }

    // 2. Copy selected skills (entire directories)
    const skillMap = buildEntryMap(registry, 'skills');
    for (const skillName of selections.skills) {
        const entry = skillMap.get(skillName);
        if (!entry) continue;
        const relDir = resolveEntryPath('skills', entry);
        const srcDir = path.join(sourceAgentDir, relDir);
        const dstDir = path.join(targetAgentDir, relDir);
        copyDirRecursive(srcDir, dstDir);
    }

    // 3. Copy selected rules (single files)
    const ruleMap = buildEntryMap(registry, 'rules');
    // Ensure rules/ directory exists if any rules are selected
    if (selections.rules.length > 0) {
        fs.mkdirSync(path.join(targetAgentDir, 'rules'), { recursive: true });
    }
    for (const ruleName of selections.rules) {
        const entry = ruleMap.get(ruleName);
        if (!entry) continue;
        const relPath = resolveEntryPath('rules', entry);
        const src = path.join(sourceAgentDir, relPath);
        const dst = path.join(targetAgentDir, relPath);
        if (fs.existsSync(src)) {
            copyFile(src, dst);
        }
    }

    // 4. Copy selected workflows (single files)
    const workflowMap = buildEntryMap(registry, 'workflows');
    if (selections.workflows.length > 0) {
        fs.mkdirSync(path.join(targetAgentDir, 'workflows'), { recursive: true });
    }
    for (const wfName of selections.workflows) {
        const entry = workflowMap.get(wfName);
        if (!entry) continue;
        const relPath = resolveEntryPath('workflows', entry);
        const src = path.join(sourceAgentDir, relPath);
        const dst = path.join(targetAgentDir, relPath);
        if (fs.existsSync(src)) {
            copyFile(src, dst);
        }
    }

    // 5. Write .selections.json
    const selectionsPath = path.join(targetAgentDir, '.selections.json');
    const selectionsData = {
        version: 1,
        installedAt: new Date().toISOString(),
        bundles: selections.bundles || [],
        skills: selections.skills,
        rules: selections.rules,
        workflows: selections.workflows,
    };
    fs.writeFileSync(selectionsPath, JSON.stringify(selectionsData, null, 2) + '\n', 'utf8');

    // 6. Write checksums for installed files
    const checksumPath = path.join(targetAgentDir, '.checksums.json');
    const manifest = buildChecksumManifest(targetAgentDir);
    writeChecksumFile(checksumPath, manifest);
}

/**
 * Read the .selections.json from a target .agents directory.
 * @param {string} targetAgentDir - Absolute path to target .agents/
 * @returns {Selections|null} The stored selections, or null if not found.
 */
function readSelections(targetAgentDir) {
    const selectionsPath = path.join(targetAgentDir, '.selections.json');
    if (!fs.existsSync(selectionsPath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(selectionsPath, 'utf8'));
}

/**
 * Remove a file or directory recursively if it exists.
 * @param {string} targetPath - Absolute path to remove.
 */
function removePath(targetPath) {
    if (!fs.existsSync(targetPath)) return;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
        fs.unlinkSync(targetPath);
    }
}

/**
 * Synchronize the .agents directory based on new selections vs previously installed.
 *
 * - Items newly selected → copied from source
 * - Items deselected → removed from target
 * - Items unchanged → left as-is (not overwritten)
 * - .selections.json and .checksums.json are updated
 *
 * @param {string}     sourceAgentDir - Absolute path to source .agents/
 * @param {string}     targetAgentDir - Absolute path to target .agents/
 * @param {Selections} newSelections  - The user's new selections
 * @param {Selections} oldSelections  - The previously stored selections
 * @param {Object}     registry       - Parsed registry.json
 * @returns {{added: string[], removed: string[]}} Summary of changes
 */
function syncSelections(sourceAgentDir, targetAgentDir, newSelections, oldSelections, registry) {
    const added = [];
    const removed = [];

    // Always update registry.json and core infrastructure
    const coreFiles = ['registry.json', 'AGENTS.md', 'how-it-works.md'];
    for (const file of coreFiles) {
        const src = path.join(sourceAgentDir, file);
        const dst = path.join(targetAgentDir, file);
        if (fs.existsSync(src)) copyFile(src, dst);
    }
    
    const coreDirs = ['personas', 'tests', 'hooks', 'sandbox'];
    for (const dir of coreDirs) {
        const srcDir = path.join(sourceAgentDir, dir);
        const dstDir = path.join(targetAgentDir, dir);
        if (fs.existsSync(srcDir)) copyDirRecursive(srcDir, dstDir);
    }

    // ── Skills ─────────────────────────────────────────────────────────────────
    const skillMap = buildEntryMap(registry, 'skills');
    const oldSkills = new Set(oldSelections.skills || []);
    const newSkills = new Set(newSelections.skills || []);

    // Add newly selected skills
    for (const name of newSkills) {
        if (!oldSkills.has(name)) {
            const entry = skillMap.get(name);
            if (!entry) continue;
            const relDir = resolveEntryPath('skills', entry);
            copyDirRecursive(
                path.join(sourceAgentDir, relDir),
                path.join(targetAgentDir, relDir)
            );
            added.push(`skills/${name}`);
        }
    }

    // Remove deselected skills
    for (const name of oldSkills) {
        if (!newSkills.has(name)) {
            const entry = skillMap.get(name);
            if (!entry) continue;
            const relDir = resolveEntryPath('skills', entry);
            removePath(path.join(targetAgentDir, relDir));
            removed.push(`skills/${name}`);
        }
    }

    // ── Rules ──────────────────────────────────────────────────────────────────
    const ruleMap = buildEntryMap(registry, 'rules');
    const oldRules = new Set(oldSelections.rules || []);
    const newRules = new Set(newSelections.rules || []);

    for (const name of newRules) {
        if (!oldRules.has(name)) {
            const entry = ruleMap.get(name);
            if (!entry) continue;
            const relPath = resolveEntryPath('rules', entry);
            const src = path.join(sourceAgentDir, relPath);
            if (fs.existsSync(src)) {
                copyFile(src, path.join(targetAgentDir, relPath));
                added.push(relPath);
            }
        }
    }

    for (const name of oldRules) {
        if (!newRules.has(name)) {
            const entry = ruleMap.get(name);
            if (!entry) continue;
            const relPath = resolveEntryPath('rules', entry);
            removePath(path.join(targetAgentDir, relPath));
            removed.push(relPath);
        }
    }

    // ── Workflows ──────────────────────────────────────────────────────────────
    const workflowMap = buildEntryMap(registry, 'workflows');
    const oldWorkflows = new Set(oldSelections.workflows || []);
    const newWorkflows = new Set(newSelections.workflows || []);

    for (const name of newWorkflows) {
        if (!oldWorkflows.has(name)) {
            const entry = workflowMap.get(name);
            if (!entry) continue;
            const relPath = resolveEntryPath('workflows', entry);
            const src = path.join(sourceAgentDir, relPath);
            if (fs.existsSync(src)) {
                copyFile(src, path.join(targetAgentDir, relPath));
                added.push(relPath);
            }
        }
    }

    for (const name of oldWorkflows) {
        if (!newWorkflows.has(name)) {
            const entry = workflowMap.get(name);
            if (!entry) continue;
            const relPath = resolveEntryPath('workflows', entry);
            removePath(path.join(targetAgentDir, relPath));
            removed.push(relPath);
        }
    }

    // ── Update metadata ────────────────────────────────────────────────────────
    const selectionsPath = path.join(targetAgentDir, '.selections.json');
    const selectionsData = {
        version: 1,
        installedAt: new Date().toISOString(),
        bundles: newSelections.bundles || [],
        skills: newSelections.skills,
        rules: newSelections.rules,
        workflows: newSelections.workflows,
    };
    fs.writeFileSync(selectionsPath, JSON.stringify(selectionsData, null, 2) + '\n', 'utf8');

    // Rebuild checksums for current state
    const checksumPath = path.join(targetAgentDir, '.checksums.json');
    const manifest = buildChecksumManifest(targetAgentDir);
    writeChecksumFile(checksumPath, manifest);

    return { added, removed };
}

export { 
    loadRegistry,
    resolveEntryPath,
    buildEntryMap,
    copyFile,
    copyDirRecursive,
    removePath,
    selectiveCopy,
    readSelections,
    syncSelections,
 };

