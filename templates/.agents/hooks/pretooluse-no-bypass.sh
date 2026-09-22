#!/usr/bin/env bash
# Conductor — hook-bypass blocker (F11). A Claude Code `PreToolUse` hook.
#
# WHY THIS EXISTS. Every Conductor gate lives in a git hook: the Test-Driven
# Law, the Eval-Driven Law, the Goodhart boundary and protected paths on
# commit; the Verification Iron Law on push. `git commit --no-verify` skips all
# of them, in one flag, silently, with no ship-log line. Until now the only
# thing standing in its way was a sentence in hooks/README.md asking nicely —
# and prose is advisory, which is the whole reason these gates are code.
#
# The rule this enforces is not "never bypass". It is "every bypass is
# logged". Conductor already ships a named, ship-logged waiver for each gate;
# this hook refuses the unlogged shortcut and names the logged one instead.
#
# CONTRACT. stdin is Claude Code PreToolUse JSON; exit 2 blocks the tool call
# and shows stderr to the agent, exit 0 allows it. FAIL OPEN on anything
# unexpected — no node, unparseable stdin, an unknown shape: a hook that
# blocks on its own errors would wedge every Bash call in the session.
#
# REACH. PreToolUse is a Claude Code mechanism, so this guards that harness
# only. On Codex and Antigravity the fallback is after the fact, not before:
# `src/loop/autocommit.js` records a bypassed commit and `improver.js` surfaces
# the recurring pattern. Detection, not prevention — state it, don't claim it.
#
# Wire it up (see hooks/README.md) in .claude/settings.json:
#   "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
#     "command": "$CLAUDE_PROJECT_DIR/.agents/hooks/pretooluse-no-bypass.sh" } ] } ]
#
# Disable with CONDUCTOR_HOOKS=off, like every other Conductor hook.
set -uo pipefail

[ "${CONDUCTOR_HOOKS:-on}" = "off" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

read -r -d '' CONDUCTOR_NO_BYPASS_JS <<'NODE'
const read = () => { try { return require("fs").readFileSync(0, "utf8"); } catch { return ""; } };

// Git commands whose hooks a flag can skip, and what each gate's logged
// alternative is. A denial that does not name the alternative just teaches
// the reader to find a different way around.
const GATED = {
  commit: 'CONDUCTOR_NO_TEST / CONDUCTOR_NO_EVAL / CONDUCTOR_NO_BOUNDARY / CONDUCTOR_NO_PROTECTED="reason" git commit …',
  push: 'CONDUCTOR_SKIP_VERIFY / CONDUCTOR_SKIP_EVAL="reason" git push …',
  merge: 'CONDUCTOR_HOOKS=off (whole-repo, and deliberate) — prefer the per-gate waivers',
  am: 'CONDUCTOR_HOOKS=off (whole-repo, and deliberate) — prefer the per-gate waivers',
};

// git accepts any unambiguous prefix. `--no-v` already resolves to
// --no-verify on these subcommands, so anything shorter is not a bypass.
const isNoVerify = (t) => t.length >= "--no-v".length && "--no-verify".startsWith(t);

// Options that swallow the next token. Needed so the subcommand scan does not
// mistake an option's VALUE for the subcommand.
const TAKES_VALUE = new Set(["-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]);

// Blank out quoted spans so a command that merely MENTIONS --no-verify in a
// message or a doc string is not read as using it.
function stripQuoted(s) {
  let out = "", quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) { quote = null; out += c; } else out += " "; continue; }
    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    out += c;
  }
  return out;
}

const segments = (s) => s.split(/\|\||&&|[;\n|]/g);

function verdict(command) {
  for (const raw of segments(stripQuoted(command))) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;

    // Leading VAR=value assignments belong to the segment, not to argv.
    let i = 0;
    let hooksOff = false;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) {
      const [name, ...rest] = tokens[i].split("=");
      if (name === "CONDUCTOR_HOOKS" && /^(off|0|false)$/i.test(rest.join("="))) hooksOff = true;
      i++;
    }
    if (i >= tokens.length) continue;
    if (tokens[i].split("/").pop() !== "git") continue;
    i++;

    // Pre-subcommand options, where -c core.hooksPath=… hides.
    let hooksPath = false, sub = null;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "-c" && i + 1 < tokens.length) {
        if (/^core\.hookspath=/i.test(tokens[i + 1])) hooksPath = true;
        i += 2; continue;
      }
      if (/^-c./.test(t) && /^-ccore\.hookspath=/i.test(t)) { hooksPath = true; i++; continue; }
      if (TAKES_VALUE.has(t)) { i += 2; continue; }
      if (t.startsWith("-")) { i++; continue; }
      sub = t; i++; break;
    }
    if (hooksPath) return { sub: sub || "commit", how: "-c core.hooksPath= overrides where git looks for hooks" };
    if (!sub || !(sub in GATED)) continue;

    for (const t of tokens.slice(i)) {
      if (t === "--") break;
      if (isNoVerify(t)) return { sub, how: `${t} skips the ${sub} hooks` };
      // -n is --no-verify on commit; on push it means --dry-run, which is safe.
      if (t === "-n" && sub === "commit") return { sub, how: "-n is the shorthand for --no-verify on commit" };
    }
    if (hooksOff) return { sub, how: "CONDUCTOR_HOOKS=off disables every gate and writes no ship-log line" };
  }
  return null;
}

let data;
try { data = JSON.parse(read()); } catch { process.exit(0); }
if (!data || typeof data !== "object") process.exit(0);
if (data.tool_name !== "Bash") process.exit(0);
const command = data.tool_input && data.tool_input.command;
if (typeof command !== "string" || !command) process.exit(0);

const hit = verdict(command);
if (!hit) process.exit(0);

process.stderr.write(
  `\n🛑 Conductor: hook bypass blocked.\n\n` +
  `  ${hit.how}.\n\n` +
  `  Those hooks are the Test-Driven Law, the Eval-Driven Law, the Goodhart\n` +
  `  boundary, protected paths and the Verification Iron Law. Skipping them\n` +
  `  here leaves no trace that they were skipped, which is the actual problem —\n` +
  `  not the bypass itself.\n\n` +
  `  Every gate has a waiver that COMMITS and gets written to the ship-log:\n` +
  `    ${GATED[hit.sub] || GATED.commit}\n\n` +
  `  Use the one that matches why you are bypassing. If none of them does, the\n` +
  `  gate is probably telling you something true.\n\n`
);
process.exit(2);
NODE

node -e "$CONDUCTOR_NO_BYPASS_JS"
exit $?
