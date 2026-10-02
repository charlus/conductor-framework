// src/loop/config.js
//
// The `loop` block of conductor.config.json: per-project settings the operator
// owns and `conductor upgrade` never overwrites (field report F2–F5).
//
//   forge            "gh" | "glab" — overrides the forge read from the origin host
//   setup            shell command run once per new worktree, before the first beat
//   allowed_domains  extra hosts merged into the cli-native sandbox network list
//   require_ready    true → only backlog items tagged `loop-ready` are harvested
//   priorities       ["P1", …] → only backlog items under these headings
//   inbox            false → inbox lines are not harvested
//   allow_nested_repo true → run even though a gitignored nested git repo exists
//
// The driver reads this file from the ROOT checkout only, never from a worktree,
// so a beat cannot widen its own sandbox or change its own setup. All helpers are
// pure; the IO lives in src/commands/loop.js.

const FORGES = ["gh", "glab"];
// A hostname, optionally with one leading "*." wildcard label. No scheme, path,
// port or bare "*": a domain entry widens the sandbox, so it must be exact.
const DOMAIN_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** Parse and validate the `loop` block. Invalid values are reported, never dropped. */
export function parseLoopConfig(config) {
  const raw = config && typeof config === "object" && config.loop && typeof config.loop === "object" ? config.loop : {};
  const errors = [];
  const out = { forge: null, setup: null, allowedDomains: [], requireReady: false, priorities: [], inbox: true, allowNestedRepo: false, errors };

  if (raw.forge !== undefined && raw.forge !== null) {
    if (FORGES.includes(raw.forge)) out.forge = raw.forge;
    else errors.push(`loop.forge must be "gh" or "glab", got ${JSON.stringify(raw.forge)}`);
  }
  if (raw.setup !== undefined && raw.setup !== null) {
    if (typeof raw.setup === "string" && raw.setup.trim()) out.setup = raw.setup.trim();
    else errors.push("loop.setup must be a non-empty shell command string");
  }
  if (raw.allowed_domains !== undefined) {
    if (!Array.isArray(raw.allowed_domains)) errors.push("loop.allowed_domains must be an array of hostnames");
    else
      for (const d of raw.allowed_domains) {
        if (typeof d === "string" && DOMAIN_RE.test(d)) out.allowedDomains.push(d.toLowerCase());
        else errors.push(`loop.allowed_domains: '${d}' is not a hostname (use e.g. "pypi.org" or "*.example.com")`);
      }
  }
  if (raw.require_ready !== undefined) {
    if (typeof raw.require_ready === "boolean") out.requireReady = raw.require_ready;
    else errors.push("loop.require_ready must be true or false");
  }
  if (raw.priorities !== undefined) {
    const parsed = parsePriorities(raw.priorities);
    if (parsed.error) errors.push(`loop.priorities: ${parsed.error}`);
    else out.priorities = parsed.priorities;
  }
  if (raw.allow_nested_repo !== undefined) {
    if (typeof raw.allow_nested_repo === "boolean") out.allowNestedRepo = raw.allow_nested_repo;
    else errors.push("loop.allow_nested_repo must be true or false");
  }
  if (raw.inbox !== undefined) {
    if (typeof raw.inbox === "boolean") out.inbox = raw.inbox;
    else errors.push("loop.inbox must be true or false");
  }
  return out;
}

/** `["p1","P2"]` or `"P1,P2"` → `["P1","P2"]`; anything not `P<digit>` is an error. */
export function parsePriorities(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!list) return { error: "must be a list such as [\"P1\"]" };
  const priorities = [];
  for (const p of list) {
    const v = String(p).trim().toUpperCase();
    if (!/^P\d$/.test(v)) return { error: `'${p}' is not a priority (use P1, P2, …)` };
    if (!priorities.includes(v)) priorities.push(v);
  }
  return { priorities };
}

/** The host of a git remote URL (https, ssh:// or scp-like), or null. */
function remoteHost(url) {
  const u = String(url ?? "").trim();
  if (!u) return null;
  const withScheme = u.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/:]+)/i);
  if (withScheme) return withScheme[1].toLowerCase();
  const scp = u.match(/^(?:[^@/]+@)?([^/:]+):(?!\/)/);
  if (scp) return scp[1].toLowerCase();
  return null;
}

/** F4: github.com → gh, any other host → glab (self-hosted GitLab included). */
export function forgeFromRemote(url) {
  const host = remoteHost(url);
  if (!host) return null;
  return { forge: host === "github.com" ? "gh" : "glab", host };
}

/** The forge to open the PR/MR with: `loop.forge`, then the origin host. `host`
 *  scopes the pre-run auth check to the instance the PR will go to. */
export function resolveForge({ override, remoteUrl }) {
  const r = forgeFromRemote(remoteUrl);
  if (override) return { forge: override, source: "loop.forge", host: r?.host ?? null };
  if (r) return { forge: r.forge, source: `origin host ${r.host}`, host: r.host };
  return {
    forge: null,
    error: "cannot tell the forge from 'git remote get-url origin'. Set loop.forge to \"gh\" or \"glab\" in conductor.config.json.",
  };
}

/** F3: the template sandbox settings plus the project's domains. Never mutates the template. */
export function mergeSandboxSettings(template, extraDomains = []) {
  const out = JSON.parse(JSON.stringify(template ?? {}));
  out.sandbox ??= {};
  out.sandbox.network ??= {};
  const base = Array.isArray(out.sandbox.network.allowedDomains) ? out.sandbox.network.allowedDomains : [];
  out.sandbox.network.allowedDomains = [...new Set([...base, ...extraDomains])];
  return out;
}
