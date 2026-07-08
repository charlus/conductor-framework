import fs from 'fs';
import path from 'path';
import { 
    computeChecksum,
    buildChecksumManifest,
    readChecksumFile,
    writeChecksumFile,
 } from './checksums.js';

/**
 * @typedef {Object} UpdateAction
 * @property {'COPY'|'UPDATE'|'SKIP'|'KEEP'|'AVAILABLE'} action
 * @property {string} relativePath
 * @property {string} reason
 */

/**
 * Walk a directory recursively and return all relative file paths.
 * @param {string} dirPath - Absolute path to directory.
 * @param {string} [prefix] - Internal recursion prefix.
 * @returns {string[]} Relative file paths.
 */
function listFiles(dirPath, prefix) {
    prefix = prefix || '';
    const results = [];
    if (!fs.existsSync(dirPath)) return results;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const rel = prefix ? prefix + '/' + entry.name : entry.name;
        const abs = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            results.push(...listFiles(abs, rel));
        } else if (entry.isFile()) {
            if (entry.name === '.checksums.json') continue;
            if (entry.name === '.selections.json') continue;
            results.push(rel);
        }
    }
    return results;
}

/**
 * Read .selections.json from the target directory, if it exists.
 * @param {string} targetDir - Absolute path to target .agents directory.
 * @returns {{skills: string[], rules: string[], workflows: string[]}|null}
 */
function readSelections(targetDir) {
    const selectionsPath = path.join(targetDir, '.selections.json');
    if (!fs.existsSync(selectionsPath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(selectionsPath, 'utf8'));
}

/**
 * Check if a relative file path belongs to the user's installed selections.
 *
 * Rules:
 *   - If no .selections.json exists (legacy full install), everything is "selected"
 *   - registry.json is always selected
 *   - rules/<file>      → always selected, regardless of what was recorded at install
 *                          time. Unlike skills/workflows, every rule is `category: core`
 *                          — there is no optional/tech-specific rule tier — so a rule
 *                          added to the framework after a project's original install
 *                          (e.g. test-driven-law) must still land on `upgrade`, not get
 *                          silently stuck as AVAILABLE because it wasn't in the old
 *                          .selections.json (which has no way to distinguish "didn't
 *                          exist yet" from "user deselected it")
 *   - skills/<name>/... → name must be in selections.skills
 *   - workflows/<file>  → matched against selections.workflows
 *
 * @param {string} relativePath
 * @param {{skills: string[], rules: string[], workflows: string[]}|null} selections
 * @returns {boolean}
 */
function isSelected(relativePath, selections) {
    // No selections file → legacy "everything installed" mode
    if (!selections) return true;

    // registry.json is always part of the installation
    if (relativePath === 'registry.json') return true;

    const parts = relativePath.split('/');

    if (parts[0] === 'rules') return true;

    if (parts[0] === 'skills' && parts.length >= 2) {
        const skillName = parts[1];
        return selections.skills.includes(skillName);
    }

    if (parts[0] === 'workflows' && parts.length >= 2) {
        // Match by filename stem (e.g. "react.md" → "react")
        // Also check the full filename for registry entries with explicit `file` property
        const fileName = parts[1];
        const stem = fileName.replace(/\.md$/, '');
        return selections.workflows.includes(stem) || selections.workflows.includes(fileName);
    }

    // Unknown top-level path → treat as selected (don't filter out unexpected files)
    return true;
}

/**
 * Produce a plan of update actions by comparing source, target, and stored checksums.
 *
 * Decision matrix:
 *   Source present,  Target absent,  selected        → COPY  (new upstream file)
 *   Source present,  Target absent,  NOT selected    → AVAILABLE (not installed)
 *   Source present,  Target present, target==stored   → UPDATE (unmodified, safe to overwrite)
 *   Source present,  Target present, target!=stored   → SKIP  (local override kept)
 *   Source absent,   Target present                   → KEEP  (custom file detected)
 *
 * @param {string} sourceDir    - Absolute path to the source .agents directory.
 * @param {string} targetDir    - Absolute path to the target .agents directory.
 * @param {string} checksumPath - Absolute path to .agents/.checksums.json.
 * @returns {UpdateAction[]} Ordered list of actions.
 */
function planUpdate(sourceDir, targetDir, checksumPath) {
    const storedChecksums = readChecksumFile(checksumPath);
    const sourceFiles = new Set(listFiles(sourceDir));
    const targetFiles = new Set(listFiles(targetDir));
    const selections = readSelections(targetDir);

    /** @type {UpdateAction[]} */
    const plan = [];

    // 1. Process every file in source
    for (const rel of [...sourceFiles].sort()) {
        const targetPath = path.join(targetDir, rel);

        if (!targetFiles.has(rel)) {
            // Target absent — check if user selected this item
            if (isSelected(rel, selections)) {
                plan.push({ action: 'COPY', relativePath: rel, reason: 'new upstream file' });
            } else {
                plan.push({ action: 'AVAILABLE', relativePath: rel, reason: 'not installed — run init to add' });
            }
        } else {
            // Target exists — compare checksums
            const targetChecksum = computeChecksum(targetPath);
            const storedChecksum = storedChecksums[rel];

            if (storedChecksum && targetChecksum === storedChecksum) {
                // File unmodified since last init/update → safe to overwrite
                plan.push({ action: 'UPDATE', relativePath: rel, reason: 'unmodified — safe to overwrite' });
            } else {
                // File was modified (or no prior checksum exists) → keep local
                plan.push({ action: 'SKIP', relativePath: rel, reason: 'local override kept' });
            }
        }
    }

    // 2. Process files only in target (custom files)
    for (const rel of [...targetFiles].sort()) {
        if (!sourceFiles.has(rel)) {
            plan.push({ action: 'KEEP', relativePath: rel, reason: 'custom file detected' });
        }
    }

    return plan;
}

/**
 * Execute an update plan: copy files, and write the updated checksum manifest.
 *
 * @param {UpdateAction[]} plan       - The plan from planUpdate().
 * @param {string}         sourceDir  - Absolute path to source .agents directory.
 * @param {string}         targetDir  - Absolute path to target .agents directory.
 * @param {string}         checksumPath - Absolute path to .checksums.json.
 */
function executeUpdate(plan, sourceDir, targetDir, checksumPath) {
    for (const item of plan) {
        const src = path.join(sourceDir, item.relativePath);
        const dst = path.join(targetDir, item.relativePath);

        if (item.action === 'COPY' || item.action === 'UPDATE') {
            // Ensure parent directory exists
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(src, dst);
        }
        // SKIP, KEEP, and AVAILABLE → no file operations
    }

    // Rebuild checksum manifest from the NEW source (what we delivered)
    const newSourceManifest = buildChecksumManifest(sourceDir);
    // Merge: keep checksums for custom/skipped files from the target
    const finalManifest = {};

    for (const item of plan) {
        if (item.action === 'COPY' || item.action === 'UPDATE') {
            finalManifest[item.relativePath] = newSourceManifest[item.relativePath];
        } else if (item.action === 'SKIP') {
            // Store the SOURCE checksum so next update can detect if user
            // later reverts to upstream version
            finalManifest[item.relativePath] = newSourceManifest[item.relativePath];
        }
        // KEEP and AVAILABLE files are not tracked in checksums
    }

    writeChecksumFile(checksumPath, finalManifest);
}

export { 
    planUpdate,
    executeUpdate,
    listFiles,
    isSelected,
 };
