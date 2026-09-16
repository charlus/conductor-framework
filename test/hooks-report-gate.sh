#!/usr/bin/env bash
# ============================================================
# Report shape — pre-commit gate BEHAVIOR test (A4).
# Installs the real templates/.agents/hooks into a temp repo: a ship-log whose
# NEWEST entry has no "**For you**" block is blocked; with the block, with a
# waiver, with no dated entry at all, or with hooks off, it commits. Newest is
# by date, not by file order — one live log had 07-15 written after 07-16.
# ============================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok() { echo "  [PASS] $1"; pass=$((pass+1)); }
no() { echo "  [FAIL] $1"; fail=$((fail+1)); }

fresh_repo() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/.agents/hooks" "$d/conductor/0-compass"
  cp "$REPO_ROOT/templates/.agents/hooks/"* "$d/.agents/hooks/"
  chmod +x "$d/.agents/hooks/pre-commit" "$d/.agents/hooks/pre-push" 2>/dev/null
  git -C "$d" init -q
  git -C "$d" config user.email t@t.local
  git -C "$d" config user.name t
  git -C "$d" config core.hooksPath .agents/hooks
  printf '%s' "$d"
}
LOG=conductor/0-compass/ship-log.md
WITH_BLOCK=$'## 2026-09-16 — Thing\n\n**For you**\n- **Impact:** users can page results\n- **Cost:** none\n- **Risk:** none\n- **Decide:** none\n\n**For the record**\n- **Quality:** review APPROVE\n'
NO_BLOCK=$'## 2026-09-16 — Thing\n- **What:** something\n- **Quality:** review APPROVE\n'

echo "Report shape — pre-commit gate:"

# ---- R1: newest entry without the block → BLOCKED -------------------------
D="$(fresh_repo)"; printf '%s' "$NO_BLOCK" > "$D/$LOG"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "ship-log without For you" >/dev/null 2>&1; then
  no "R1: ship-log committed WITHOUT a For-you block (gate did not fire)"
else
  ok "R1: ship-log whose newest entry lacks the block is BLOCKED"
fi
rm -rf "$D"

# ---- R2: newest entry with the block → COMMITS ----------------------------
D="$(fresh_repo)"; printf '%s' "$WITH_BLOCK" > "$D/$LOG"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "ship-log with For you" >/dev/null 2>&1; then
  ok "R2: ship-log with the block COMMITS"
else
  no "R2: ship-log with the block was blocked"
fi
rm -rf "$D"

# ---- R3: newest is by DATE, not file order --------------------------------
# An older, block-less entry written AFTER the newest one must not trip the gate.
D="$(fresh_repo)"
{ printf '%s' "$WITH_BLOCK"; printf '\n## 2026-07-15 — Older\n- **What:** legacy\n'; } > "$D/$LOG"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "older entry last in file" >/dev/null 2>&1; then
  ok "R3: newest is chosen by date, not by position in the file"
else
  no "R3: gate fired on an older entry that appears last in the file"
fi
rm -rf "$D"

# ---- R4: waiver → COMMITS and is logged -----------------------------------
D="$(fresh_repo)"; printf '%s' "$NO_BLOCK" > "$D/$LOG"
git -C "$D" add -A >/dev/null 2>&1
if CONDUCTOR_NO_REPORT="editing a pre-A4 entry" git -C "$D" commit -q -m "waived" >/dev/null 2>&1; then
  if grep -qi "report" "$D/$LOG"; then
    ok "R4: waiver commits AND is logged to the ship-log"
  else
    no "R4: waiver committed but was not logged"
  fi
else
  no "R4: waiver did not allow the commit"
fi
rm -rf "$D"

# ---- R5: a log with no dated entry is not gated ---------------------------
D="$(fresh_repo)"; printf '# Ship Log\n\nNothing shipped yet.\n' > "$D/$LOG"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "empty ship-log" >/dev/null 2>&1; then
  ok "R5: a ship-log with no dated entry commits"
else
  no "R5: gate fired on a ship-log with nothing shipped yet"
fi
rm -rf "$D"

# ---- R6: hooks off → gate silent ------------------------------------------
D="$(fresh_repo)"; printf '%s' "$NO_BLOCK" > "$D/$LOG"
git -C "$D" add -A >/dev/null 2>&1
if CONDUCTOR_HOOKS=off git -C "$D" commit -q -m "hooks off" >/dev/null 2>&1; then
  ok "R6: CONDUCTOR_HOOKS=off disables the gate"
else
  no "R6: gate still fired with CONDUCTOR_HOOKS=off"
fi
rm -rf "$D"

echo ""
echo "  Passed: $pass"
echo "  Failed: $fail"
[ "$fail" -eq 0 ] && echo "STATUS: PASSED ✅" || echo "STATUS: FAILED ❌"
exit "$fail"
