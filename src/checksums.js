import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Compute MD5 checksum of a file's contents.
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} Hex-encoded MD5 digest.
 */
function computeChecksum(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Recursively walk a directory and build a checksum manifest.
 * @param {string} dirPath  - Absolute path to the directory.
 * @param {string} [prefix] - Internal: relative path prefix for recursion.
 * @returns {Object<string, string>} Map of relative paths → MD5 checksums.
 */
function buildChecksumManifest(dirPath, prefix) {
    prefix = prefix || '';
    const manifest = {};
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const rel = prefix ? prefix + '/' + entry.name : entry.name;
        const abs = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // Skip the .checksums.json itself if it somehow appears as a dir
            Object.assign(manifest, buildChecksumManifest(abs, rel));
        } else if (entry.isFile()) {
            // Skip the checksums metadata file itself
            if (entry.name === '.checksums.json') continue;
            manifest[rel] = computeChecksum(abs);
        }
    }

    return manifest;
}

/**
 * Read and parse a checksums JSON file.
 * @param {string} checksumPath - Absolute path to .checksums.json.
 * @returns {Object<string, string>} The stored manifest, or empty object if missing.
 */
function readChecksumFile(checksumPath) {
    if (!fs.existsSync(checksumPath)) {
        return {};
    }
    const raw = fs.readFileSync(checksumPath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Write a checksums manifest to a JSON file.
 * @param {string} checksumPath - Absolute path to .checksums.json.
 * @param {Object<string, string>} manifest - Map of relative paths → checksums.
 */
function writeChecksumFile(checksumPath, manifest) {
    const sorted = {};
    for (const key of Object.keys(manifest).sort()) {
        sorted[key] = manifest[key];
    }
    fs.writeFileSync(checksumPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

export { 
    computeChecksum,
    buildChecksumManifest,
    readChecksumFile,
    writeChecksumFile,
 };
