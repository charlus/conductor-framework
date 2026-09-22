#!/usr/bin/env bash
# ============================================================
# Hook-bypass blocker — PreToolUse BEHAVIOR test (F11).
#
# Every Conductor gate lives in a git hook, and `git commit --no-verify` skips
# all of them in one flag, silently, with no ship-log line. Our only defence
# was a sentence in hooks/README.md asking nicely. This hook makes it a block.
#
# Exercises the REAL templates/.agents/hooks/pretooluse-no-bypass.sh by feeding
# it Claude Code PreToolUse JSON on stdin. Exit 2 = blocked, 0 = allowed.
# ============================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$REPO_ROOT/templates/.agents/hooks/pretooluse-no-bypass.sh"
pass=0; fail=0
ok() { echo "  [PASS] $1"; pass=$((pass+1)); }
no() { echo "  [FAIL] $1"; fail=$((fail+1)); }

# Feed a Bash command to the hook; echo its exit code.
run_cmd() {
  printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$(node -e \
    'process.stdout.write(JSON.stringify(process.argv[1]))' "$1")" \
    | bash "$HOOK" >/dev/null 2>&1
  printf '%s' "$?"
}

blocked() {
  local code; code="$(run_cmd "$2")"
  if [ "$code" = "2" ]; then ok "$1"; else no "$1 (exit $code, expected 2)"; fi
}

allowed() {
  local code; code="$(run_cmd "$2")"
  if [ "$code" = "0" ]; then ok "$1"; else no "$1 (exit $code, expected 0)"; fi
}

if [ ! -f "$HOOK" ]; then
  echo "  [FAIL] pretooluse-no-bypass.sh does not exist"
  echo "STATUS: FAILED ❌"
  exit 1
fi

echo "Hook-bypass blocker — blocked commands:"

blocked "N1: git commit --no-verify"            'git commit --no-verify -m "x"'
blocked "N2: git commit -n (the shorthand)"     'git commit -n -m "x"'
blocked "N3: git push --no-verify"              'git push --no-verify origin main'
blocked "N4: -c core.hooksPath= override"       'git -c core.hooksPath=/dev/null commit -m "x"'
blocked "N5: an abbreviated --no-veri prefix"   'git commit --no-veri -m "x"'
blocked "N6: a bypass later in a chain"         'npm test && git commit --no-verify -m "x"'
blocked "N7: CONDUCTOR_HOOKS=off on a commit"   'CONDUCTOR_HOOKS=off git commit -m "x"'

echo ""
echo "Hook-bypass blocker — allowed commands:"

allowed "A1: an ordinary commit"                'git commit -m "feat: thing"'
allowed "A2: an ordinary push"                  'git push origin main'
allowed "A3: a logged Conductor waiver"         'CONDUCTOR_NO_TEST="config only" git commit -m "x"'
allowed "A4: -n on a command that is not commit" 'git clean -n'
allowed "A5: --no-verify inside a quoted string" 'git commit -m "document --no-verify here"'
allowed "A6: a non-git command"                 'npm run build --no-verify-ssl'
allowed "A7: reading the hook config"           'git config --get core.hooksPath'

echo ""
echo "Hook-bypass blocker — envelope:"

# E1: a non-Bash tool is none of this hook's business.
code="$(printf '{"tool_name":"Write","tool_input":{"file_path":"/tmp/x"}}' \
  | bash "$HOOK" >/dev/null 2>&1; printf '%s' "$?")"
if [ "$code" = "0" ]; then ok "E1: non-Bash tools pass through"; else no "E1: blocked a non-Bash tool (exit $code)"; fi

# E2: malformed stdin must FAIL OPEN. A hook that blocks on its own parse error
# would wedge every Bash call in the session.
code="$(printf 'not json at all' | bash "$HOOK" >/dev/null 2>&1; printf '%s' "$?")"
if [ "$code" = "0" ]; then ok "E2: malformed input fails open"; else no "E2: malformed input blocked the call (exit $code)"; fi

# E3: empty stdin must also fail open.
code="$(printf '' | bash "$HOOK" >/dev/null 2>&1; printf '%s' "$?")"
if [ "$code" = "0" ]; then ok "E3: empty input fails open"; else no "E3: empty input blocked the call (exit $code)"; fi

# E4: the denial must name the logged alternative, or the reader learns nothing.
out="$(printf '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m x"}}' \
  | bash "$HOOK" 2>&1)"
if printf '%s' "$out" | grep -q "CONDUCTOR_NO_TEST"; then
  ok "E4: the denial points at the logged waiver instead"
else
  no "E4: the denial does not tell the caller what to do instead"
fi

# E5: CONDUCTOR_HOOKS=off disables this hook too — one master switch, not two.
code="$(printf '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m x"}}' \
  | CONDUCTOR_HOOKS=off bash "$HOOK" >/dev/null 2>&1; printf '%s' "$?")"
if [ "$code" = "0" ]; then ok "E5: CONDUCTOR_HOOKS=off disables the hook"; else no "E5: hook still fired with CONDUCTOR_HOOKS=off (exit $code)"; fi

echo ""
echo "  Passed: $pass"
echo "  Failed: $fail"
[ "$fail" -eq 0 ] && echo "STATUS: PASSED ✅" || echo "STATUS: FAILED ❌"
exit "$fail"
