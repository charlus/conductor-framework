#!/usr/bin/env bash
# Conductor — the fact gate (F1). A Claude Code `PreToolUse` hook. OPT-IN.
#
# WHY THIS EXISTS. Every gate Conductor had fired AFTER the work: the
# Test-Driven Law and the Goodhart boundary at commit, the Verification Iron
# Law at push, the Checker after the beat. All of them catch a bad change once
# it exists. None of them stop the model writing it from a guess.
#
# Self-evaluation does not close that gap — ask a model "are you sure?" and the
# answer is always yes. Asking "which files import this one" does, because it
# cannot be answered without running a search, and running the search puts the
# answer in the context. The investigation is the point; the question is only
# the thing that forces it.
#
# WHAT IT DOES NOT DO. It cannot verify the facts were gathered — a PreToolUse
# hook sees the tool call, not the reasoning. It denies the first write to a
# target, names the facts, and allows the retry. What it buys is a pause and a
# prompt at the moment of action. Do not describe it as proof of anything.
#
#   DENY   the first Edit/Write per file, and every destructive Bash
#   FORCE  the specific facts to present
#   ALLOW  the retry
#
# Adapted from ECC's GateGuard, with three deliberate differences:
#   - the edit gate asks for the FAILING TEST, making red-before-green a
#     question at the moment of action rather than only at commit;
#   - the write gate asks what already does this, so "reuse before build" is
#     enforced by code instead of a line of prose nobody reads;
#   - routine Bash is NOT gated. ECC denies it once per session; our loop runs
#     many commands a beat and there is no investigation to buy there, only a
#     wasted turn.
#
# FAILS OPEN, always: no node, unparseable stdin, an unwritable state dir. A
# gate that cannot remember what it cleared would deny the same edit forever
# and wedge the session — worse than no gate.
#
# Wire it up in .claude/settings.json (see hooks/README.md):
#   "PreToolUse": [ { "matcher": "Edit|Write|Bash", "hooks": [ { "type": "command",
#     "command": "$CLAUDE_PROJECT_DIR/.agents/hooks/pretooluse-fact-gate.sh" } ] } ]
#
# Off switches: CONDUCTOR_FACT_GATE=off (this gate) or CONDUCTOR_HOOKS=off (all).
set -uo pipefail

[ "${CONDUCTOR_HOOKS:-on}" = "off" ] && exit 0
[ "${CONDUCTOR_FACT_GATE:-on}" = "off" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

# A PreToolUse hook sits in front of every tool call, so it must be bounded.
# Anything slow here is a bug whatever the cause — and at least one real one
# is not ours: on some kernels `mkdirSync(..., {recursive:true})` against a
# pathological path (a CONDUCTOR_HOME under /proc, say) never returns. The
# harness has its own timeout, but relying on it means the failure mode is
# "the session stalls" rather than "the gate stepped aside". Bound it here and
# fail OPEN on expiry.
run_bounded() {
  local rc
  if command -v timeout >/dev/null 2>&1; then
    timeout "${CONDUCTOR_HOOK_TIMEOUT:-5}" node -e "$1"
    rc=$?
    [ "$rc" = "124" ] && exit 0   # timed out → allow, never wedge the session
    exit "$rc"
  fi
  node -e "$1"
  exit $?
}

read -r -d '' CONDUCTOR_FACT_GATE_JS <<'NODE'
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const STATE_DIR = path.join(process.env.CONDUCTOR_HOME || path.join(os.homedir(), ".conductor"), "fact-gate");
// A session that has been idle this long is treated as new: its clearances
// describe a context the model no longer has.
const TTL_MS = 30 * 60 * 1000;
// Full fact blocks for the first N denials, then a condensed line. Identical
// repeated denials are what push a model into a degenerate repetition loop, so
// after the budget every denial carries its ordinal and differs from the last.
const FULL_DENIALS = (() => {
  const n = Number.parseInt(process.env.CONDUCTOR_FACT_GATE_FULL_DENIALS ?? "", 10);
  return Number.isInteger(n) && n >= 0 ? n : 3;
})();

const read = () => { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } };

// Commands that destroy something. Deliberately short: every entry must be a
// thing you cannot simply re-run. A long list here becomes noise, and noise is
// how a safety prompt gets trained out.
const DESTRUCTIVE = [
  /\brm\s+(-[A-Za-z]*\s+)*-[A-Za-z]*[rRf]/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+(-[A-Za-z]*\s+)*-[A-Za-z]*[fdx]/,
  /\bgit\s+push\s+.*--force(?!-with-lease)\b/,
  /\bgit\s+branch\s+-D\b/,
  /\bgit\s+worktree\s+remove\s+.*--force\b/,
  /\bdrop\s+(table|database)\b/i,
  /\btruncate\s+table\b/i,
  /\bmkfs\b|\bdd\s+if=/,
  /\bdocker\s+(system\s+prune|volume\s+rm)\b/,
];

function stateFile(sessionId) {
  const key = crypto.createHash("sha256").update(String(sessionId)).digest("hex").slice(0, 16);
  return path.join(STATE_DIR, `${key}.json`);
}

function loadState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Date.now() - (s.last_active || 0) > TTL_MS) return { checked: [], denials: 0 };
    return { checked: Array.isArray(s.checked) ? s.checked : [], denials: Number(s.denials) || 0 };
  } catch {
    return { checked: [], denials: 0 };
  }
}

/** Persist atomically. Returns false when the store is unusable — the caller
 *  must then ALLOW, or a gate with no memory denies the same edit forever. */
function saveState(file, state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const tmp = `${file}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ ...state, last_active: Date.now() }));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

const EDIT_FACTS = (target) => [
  `Before editing ${target}, state these — each one looked up, not recalled:`,
  ``,
  `  1. Every file that imports or calls this one. Search for it (Grep/Glob);`,
  `     "probably none" is not an answer.`,
  `  2. The failing test or eval this change makes pass — name it and the`,
  `     assertion. If there is none yet, write it first: that is the`,
  `     Test-Driven Law, and this is the moment it applies.`,
  `  3. The user's current instruction, quoted verbatim.`,
];

const WRITE_FACTS = (target) => [
  `Before creating ${target}, state these — each one looked up, not recalled:`,
  ``,
  `  1. The file and line that will call this new one. If nothing will yet,`,
  `     say what will and when.`,
  `  2. What you searched to confirm nothing already does this — in this repo`,
  `     first, then the dependencies already installed. Reuse beats writing.`,
  `  3. The user's current instruction, quoted verbatim.`,
];

const BASH_FACTS = (cmd) => [
  `Before running this, state these:`,
  ``,
  `    ${cmd}`,
  ``,
  `  1. Exactly what it deletes or overwrites — list it, do not summarise it.`,
  `  2. The rollback: one line, the command that recovers this if it is wrong.`,
  `     If there is no rollback, say so plainly and explain why it is safe.`,
  `  3. The user's current instruction, quoted verbatim.`,
];

function deny(lines, ordinal, condensed) {
  const escape = `  Turn this gate off with CONDUCTOR_FACT_GATE=off if it is not earning its keep.`;
  if (condensed) {
    process.stderr.write(
      `\n🔍 Conductor fact gate (denial ${ordinal}): investigate first, then retry — ` +
        `importers, the failing test, and the instruction verbatim. ${escape.trim()}\n\n`
    );
  } else {
    process.stderr.write(`\n🔍 Conductor fact gate\n\n${lines.join("\n")}\n\n` +
      `  Present them, then make the same call again — the retry is allowed.\n` +
      `  This buys the investigation, not permission: the facts are not checked.\n\n${escape}\n\n`);
  }
  process.exit(2);
}

let data;
try { data = JSON.parse(read()); } catch { process.exit(0); }
if (!data || typeof data !== "object") process.exit(0);

const tool = data.tool_name;
const input = data.tool_input || {};
// Read/Grep/Glob are the investigation this gate demands. Blocking them would
// make the demand unsatisfiable.
if (!["Edit", "Write", "MultiEdit", "Bash"].includes(tool)) process.exit(0);

const sessionId = data.session_id || data.sessionId || process.env.CLAUDE_SESSION_ID || "no-session";
const file = stateFile(sessionId);
const state = loadState(file);

function gate(key, lines) {
  if (key && state.checked.includes(key)) process.exit(0); // already gated → allow
  const denials = state.denials + 1;
  const next = { checked: key ? [...state.checked, key] : state.checked, denials };
  // An unusable store means we cannot record the clearance, so the retry would
  // be denied too, forever. Allow instead.
  if (!saveState(file, next)) process.exit(0);
  deny(lines, denials, denials > FULL_DENIALS);
}

if (tool === "Bash") {
  const cmd = typeof input.command === "string" ? input.command : "";
  if (!cmd) process.exit(0);
  if (!DESTRUCTIVE.some((re) => re.test(cmd))) process.exit(0);
  // No clearance key: every destructive command destroys something different,
  // so each one is gated on its own.
  gate(null, BASH_FACTS(cmd));
}

// Edit / Write / MultiEdit
const target = input.file_path || input.filePath || (Array.isArray(input.edits) && input.edits[0]?.file_path);
if (typeof target !== "string" || !target) process.exit(0);
gate(`${tool === "Write" ? "write" : "edit"}:${target}`,
     tool === "Write" ? WRITE_FACTS(target) : EDIT_FACTS(target));
NODE

run_bounded "$CONDUCTOR_FACT_GATE_JS"
