// Supply-chain safety scan for skills downloaded from a remote registry
// (rubric gap: the registry downloads SKILL.md = an injection/secret vector with no
// checks). Heuristic, deliberately conservative: it flags for a human, it does not
// promise to catch everything. `critical` findings block install by default; `warn`
// findings are surfaced but allowed.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const RULES = [
  // Prompt injection — attempts to override the agent's instructions.
  { severity: "critical", category: "prompt-injection",
    re: /\b(ignore|disregard|forget)\b[^.\n]{0,30}\b(previous|prior|above|earlier|all)\b[^.\n]{0,20}\b(instruction|prompt|rule|directive)/i },
  { severity: "critical", category: "prompt-injection",
    re: /\byou are now\b|\bnew system prompt\b|\boverride (your|the) (system|safety)\b|\bact as (an? )?(unrestricted|jailbroken|DAN)\b/i },
  { severity: "warn", category: "prompt-injection",
    re: /\b(system prompt|developer message)\b/i },

  // Secrets / credentials accidentally (or maliciously) shipped in a skill.
  { severity: "critical", category: "secret",
    re: /-----BEGIN (RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----/ },
  { severity: "critical", category: "secret", re: /\bAKIA[0-9A-Z]{16}\b/ },          // AWS access key
  { severity: "critical", category: "secret", re: /\b(ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}\b/ }, // GitHub token
  { severity: "critical", category: "secret", re: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },   // GitLab PAT
  { severity: "critical", category: "secret", re: /\bsk-[A-Za-z0-9]{20,}\b/ },        // OpenAI-style key
  { severity: "warn", category: "secret",
    re: /\b(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"]{6,}['"]/i },

  // Dangerous shell — remote-code-execution / destructive patterns.
  { severity: "critical", category: "dangerous-shell",
    re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/i },                          // curl … | sh
  { severity: "critical", category: "dangerous-shell",
    re: /\brm\s+-rf\s+(\/|~|\$HOME|\*)/ },
  { severity: "critical", category: "dangerous-shell",
    re: /\b(eval|exec)\s*\(\s*(atob|base64|Buffer\.from)/i },
  { severity: "warn", category: "dangerous-shell",
    re: /\bbase64\s+(-d|--decode)\b|\bchmod\s+\+x\b/i },
];

const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".ico", ".woff", ".woff2"]);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      await walk(p, out);
    } else if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Scan a downloaded skill directory. Returns { findings, criticalCount, warnCount }.
 * Each finding: { severity, category, file, line, snippet }.
 */
export async function scanSkillDir(dir) {
  const findings = [];
  let files = [];
  try {
    files = await walk(dir);
  } catch {
    return { findings, criticalCount: 0, warnCount: 0 };
  }

  for (const file of files) {
    const lower = file.toLowerCase();
    if ([...SKIP_EXT].some((e) => lower.endsWith(e))) continue;
    let content;
    try {
      if ((await stat(file)).size > 1_000_000) continue; // skip >1MB blobs
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      for (const rule of RULES) {
        if (rule.re.test(lines[i])) {
          findings.push({
            severity: rule.severity,
            category: rule.category,
            file: file.slice(dir.length + 1),
            line: i + 1,
            snippet: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
  }

  // Dedupe by file:line:category, keeping the highest severity (a single line can
  // legitimately trip two rules of the same category, or a critical + a warn).
  const best = new Map();
  for (const f of findings) {
    const key = `${f.file}:${f.line}:${f.category}`;
    const prev = best.get(key);
    if (!prev || (prev.severity === "warn" && f.severity === "critical")) {
      best.set(key, f);
    }
  }
  const deduped = [...best.values()];

  return {
    findings: deduped,
    criticalCount: deduped.filter((f) => f.severity === "critical").length,
    warnCount: deduped.filter((f) => f.severity === "warn").length,
  };
}

/** Format findings for the CLI. */
export function formatFindings(findings) {
  return findings
    .map(
      (f) =>
        `   [${f.severity.toUpperCase()}] ${f.category} — ${f.file}:${f.line}\n     ${f.snippet}`
    )
    .join("\n");
}
