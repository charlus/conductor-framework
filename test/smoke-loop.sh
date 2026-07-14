#!/usr/bin/env bash
# ============================================================
# Conductor Loop — end-to-end smoke test (no LLM)
# ============================================================
# Exercises the REAL pipeline — worktree isolation, a maker beat that makes a
# real git commit, the driver's own verification, the independent Checker reading
# a real verdict file, the maker completion signal, and terminal handoff — using
# a FAKE agent binary in place of `claude`. This proves the plumbing end-to-end
# without needing a configured model. A real-LLM run still needs manual
# validation (documented in Remaining work #10).
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
BIN="$WORK/bin"
PROJ="$WORK/proj"
trap 'rm -rf "$WORK"' EXIT

pass=0; fail=0
ok()   { echo "  [PASS] $1"; pass=$((pass+1)); }
no()   { echo "  [FAIL] $1"; fail=$((fail+1)); }

# ---- 1. A fake `claude` that plays both maker and checker ----
mkdir -p "$BIN"
cat > "$BIN/claude" <<'FAKE'
#!/usr/bin/env bash
# Fake agent. --version → ok. Otherwise the 2nd arg is the full prompt text; the
# 4th is the permission mode. cwd is the worktree the driver put us in.
if [ "${1:-}" = "--version" ]; then echo "fake-claude 1.0"; exit 0; fi
prompt="${2:-}"
case "$prompt" in
  *"You are the CHECKER"*)
    mkdir -p conductor/1-workbench
    printf '{"approved": true, "reason": "smoke: change looks complete"}' \
      > conductor/1-workbench/checker-verdict.json
    ;;
  *)
    # Maker: make a real change + commit, then signal completion.
    date > FEATURE.txt
    git add -A >/dev/null 2>&1
    git commit -q -m "feat: smoke feature" >/dev/null 2>&1 || true
    mkdir -p conductor/1-workbench
    printf '{"done": true}' > conductor/1-workbench/maker-signal.json
    ;;
esac
exit 0
FAKE
chmod +x "$BIN/claude"

# ---- 2. A conductor project ----
mkdir -p "$PROJ"
node "$REPO_ROOT/bin/conductor.js" init "$PROJ" --all >/dev/null 2>&1
cd "$PROJ"
git init -q
git config user.email smoke@test.local
git config user.name "Smoke Test"
git add -A >/dev/null 2>&1
git commit -q -m "init"

STATE="$PROJ/conductor/1-workbench/loop-state.json"
node -e "
const f='$STATE'; const s=require(f);
s.goal_description='smoke test goal';
s.phase='execution';
s.autonomy_level='L1';           // single beat → awaiting_review, no merge needed
s.verification={command:'test -f FEATURE.txt',last_exit_code:null,last_output_hash:null};
require('fs').writeFileSync(f, JSON.stringify(s,null,2));
"

# ---- 3. Run the loop with the fake agent on PATH ----
echo "Running: conductor loop (fake agent)..."
set +e
PATH="$BIN:$PATH" node "$REPO_ROOT/bin/conductor.js" loop "$PROJ" --unsafe-no-sandbox --platform claude > "$WORK/out.log" 2>&1
code=$?
set -e
sed 's/^/    /' "$WORK/out.log"

# ---- 4. Assertions ----
echo "Assertions:"
[ "$code" -eq 0 ] && ok "exit code 0 (clean handoff)" || no "exit code was $code"

status="$(node -e "console.log(require('$STATE').status)")"
[ "$status" = "awaiting_review" ] && ok "terminal status = awaiting_review" || no "status was '$status'"

WT="$PROJ/.agents/.worktrees/smoke-test-goal"
if [ -f "$WT/FEATURE.txt" ]; then ok "maker made a real commit in the isolated worktree"; else no "FEATURE.txt not found in worktree"; fi

if git -C "$PROJ" branch --list 'conductor/loop/smoke-test-goal' | grep -q .; then
  ok "maker worked on the dedicated loop branch"
else no "loop branch not created"; fi

SHIPLOG="$PROJ/conductor/0-compass/ship-log.md"
if [ -f "$SHIPLOG" ] && grep -q '\[loop\]' "$SHIPLOG"; then ok "auditable action trail written to ship-log"; else no "no ship-log audit trail"; fi

if grep -q 'checker: APPROVED' "$WORK/out.log"; then ok "independent Checker consumed its verdict file"; else no "checker verdict not consumed"; fi

echo ""
echo "  smoke: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
echo "  STATUS: PASSED ✅"
