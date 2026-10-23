// src/loop/owner-hints.js
//
// I1 (owner, 2026-10-23): "asking claude to read the loop report to guide me
// through the merge order and all manual steps (like cmd, backup, migration) is
// very helpful." The Ship beat writes an "Owner actions" section in the MR body;
// these hints are what the driver itself can read from the item's diff, so the
// report names them even when the beat forgot. Pure.

const MIGRATIONS = /(^|\/)(migrations|alembic\/versions|db\/migrate|prisma\/migrations|flyway|liquibase|migrate)\//i;
const ENV_EXAMPLE = /(^|\/)\.env\.(example|sample|template|dist)$|(^|\/)[^/]+\.env\.example$|(^|\/)env\.example$/i;
const DEPLOY = /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|\.gitlab-ci\.yml|[^/]+\.tf|Procfile|fly\.toml|app\.yaml|nginx[^/]*\.conf)$|(^|\/)(\.github\/workflows|k8s|helm|deploy|infra)\//i;

/** The keys an env example file declares. */
function envKeys(text) {
  const keys = new Set();
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

/**
 * @param {{changed: string[], envFiles?: {path: string, before: string, after: string}[], deps?: {ecosystem: string, name: string, version?: string}[]}} input
 *   `changed`: paths the item changed (code paths prefixed with the code folder, e.g. "repo/").
 * @returns {string[]} one plain line per action, in the order the owner does them.
 */
export function ownerHints({ changed = [], envFiles = [], deps = [] }) {
  const out = [];
  const migrations = changed.filter((f) => MIGRATIONS.test(f));
  if (migrations.length) out.push(`Back up the database, then run the new migration${migrations.length === 1 ? "" : "s"} where the product runs: ${migrations.map((f) => `\`${f}\``).join(", ")}.`);
  const newKeys = [];
  for (const f of envFiles) {
    const before = envKeys(f.before);
    for (const k of envKeys(f.after)) if (!before.has(k)) newKeys.push(k);
  }
  if (newKeys.length) out.push(`Set the new environment variable${newKeys.length === 1 ? "" : "s"} where the product runs, before you deploy: ${[...new Set(newKeys)].map((k) => `\`${k}\``).join(", ")}.`);
  if (deps.length) out.push(`Install the new dependenc${deps.length === 1 ? "y" : "ies"} where the product runs: ${deps.map((d) => `${d.name}${d.version ? ` ${d.version}` : ""} (${d.ecosystem})`).join(", ")}. The loop installed ${deps.length === 1 ? "it" : "them"} in its own worktree only.`);
  const deploy = changed.filter((f) => DEPLOY.test(f));
  if (deploy.length) out.push(`Deployment configuration changed, read it before you deploy: ${deploy.map((f) => `\`${f}\``).join(", ")}.`);
  return out;
}

/** True when a path is an env example file the hints read. */
export const isEnvExample = (path) => ENV_EXAMPLE.test(path);
