/**
 * @typedef {Object} BundleEntry
 * @property {string}   name
 * @property {string}   description
 * @property {string}   [extends]    - Name of parent bundle to inherit from
 * @property {string[]} skills
 * @property {string[]} rules
 * @property {string[]} workflows
 */

/**
 * Build a lookup map of bundle name → bundle entry.
 * @param {Object} registry - Parsed registry.json
 * @returns {Map<string, BundleEntry>}
 */
function buildBundleMap(registry) {
    const map = new Map();
    const bundles = registry.bundles || [];
    for (const bundle of bundles) {
        map.set(bundle.name, bundle);
    }
    return map;
}

/**
 * Resolve a single bundle into its full set of items, following `extends` chains.
 * Prevents circular extends by tracking visited bundles.
 *
 * @param {string} bundleName
 * @param {Map<string, BundleEntry>} bundleMap
 * @param {Set<string>} [visited] - Internal: tracks visited bundles to prevent cycles
 * @returns {{skills: Set<string>, rules: Set<string>, workflows: Set<string>}}
 */
function resolveOneBundle(bundleName, bundleMap, visited) {
    visited = visited || new Set();

    const result = { skills: new Set(), rules: new Set(), workflows: new Set() };

    if (visited.has(bundleName)) return result; // cycle guard
    visited.add(bundleName);

    const bundle = bundleMap.get(bundleName);
    if (!bundle) return result;

    // Resolve parent first (if extends is set)
    if (bundle.extends) {
        const parent = resolveOneBundle(bundle.extends, bundleMap, visited);
        for (const s of parent.skills) result.skills.add(s);
        for (const r of parent.rules) result.rules.add(r);
        for (const w of parent.workflows) result.workflows.add(w);
    }

    // Add this bundle's own items
    for (const s of bundle.skills || []) result.skills.add(s);
    for (const r of bundle.rules || []) result.rules.add(r);
    for (const w of bundle.workflows || []) result.workflows.add(w);

    return result;
}

/**
 * Resolve one or more bundle names into a merged, deduplicated selections object.
 *
 * @param {string[]} bundleNames - Array of selected bundle names
 * @param {Object}   registry    - Parsed registry.json (must have `bundles` array)
 * @returns {{skills: string[], rules: string[], workflows: string[]}}
 */
function resolveBundles(bundleNames, registry) {
    const bundleMap = buildBundleMap(registry);

    const merged = { skills: new Set(), rules: new Set(), workflows: new Set() };

    for (const name of bundleNames) {
        const resolved = resolveOneBundle(name, bundleMap);
        for (const s of resolved.skills) merged.skills.add(s);
        for (const r of resolved.rules) merged.rules.add(r);
        for (const w of resolved.workflows) merged.workflows.add(w);
    }

    return {
        skills: [...merged.skills],
        rules: [...merged.rules],
        workflows: [...merged.workflows],
    };
}

/**
 * Extract bundle choices from the registry for use in a checklist prompt.
 *
 * @param {Object} registry - Parsed registry.json
 * @returns {Array<{name: string, description: string, default: boolean}>}
 */
function getBundleChoices(registry) {
    const bundles = registry.bundles || [];
    return bundles.map((b) => ({
        name: b.name,
        description: b.description,
        default: false,
    }));
}

export { 
    buildBundleMap,
    resolveOneBundle,
    resolveBundles,
    getBundleChoices,
 };
