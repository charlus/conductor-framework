#!/usr/bin/env bash
# ============================================================
# The Goodhart boundary + protected paths — pre-commit BEHAVIOR test (F9/F12).
#
# The Test-Driven Law proves a test CHANGE exists. It cannot tell a new test
# from a deleted one: `--diff-filter=ACM` never sees a deletion, and staging
# `.skip(` counts as a test change. So "all tests pass" was gameable by the two
# cheapest moves an unattended agent has — delete the failing test, or skip it.
# The boundary gate closes that, and the protected-path gate stops the agent
# editing the gates themselves (Build may not edit the acceptance conditions).
#
# Installs the REAL templates/.agents/hooks into a temp repo and exercises both.
# ============================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok() { echo "  [PASS] $1"; pass=$((pass+1)); }
no() { echo "  [FAIL] $1"; fail=$((fail+1)); }

fresh_repo() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/.agents/hooks" "$d/conductor/0-compass" "$d/src" "$d/test"
  cp "$REPO_ROOT/templates/.agents/hooks/"* "$d/.agents/hooks/"
  chmod +x "$d/.agents/hooks/pre-commit" "$d/.agents/hooks/pre-push" 2>/dev/null
  : > "$d/conductor/0-compass/ship-log.md"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.local
  git -C "$d" config user.name t
  git -C "$d" config core.hooksPath .agents/hooks
  printf '%s' "$d"
}

# A repo with a committed baseline: one impl file and one real test file.
seeded_repo() {
  local d; d="$(fresh_repo)"
  printf 'export const add = (a, b) => a + b;\n' > "$d/src/add.js"
  cat > "$d/test/add.test.js" <<'EOF'
import { add } from "../src/add.js";
test("adds", () => { expect(add(1, 2)).toBe(3); });
test("adds negatives", () => { expect(add(-1, -2)).toBe(-3); });
test("adds zero", () => { expect(add(0, 0)).toBe(0); });
EOF
  git -C "$d" add -A >/dev/null 2>&1
  CONDUCTOR_HOOKS=off git -C "$d" commit -q -m "baseline" >/dev/null 2>&1
  printf '%s' "$d"
}

echo "Goodhart boundary + protected paths — pre-commit:"

# ---- G1: deleting a test file → BLOCKED -----------------------------------
D="$(seeded_repo)"
git -C "$D" rm -q "test/add.test.js" >/dev/null 2>&1
if git -C "$D" commit -q -m "drop the failing test" >/dev/null 2>&1; then
  no "G1: a DELETED test file committed (the cheapest Goodhart move is open)"
else
  ok "G1: deleting a test file is BLOCKED"
fi
rm -rf "$D"

# ---- G2: adding .skip( to a test → BLOCKED --------------------------------
D="$(seeded_repo)"
sed -i 's/^test("adds negatives"/test.skip("adds negatives"/' "$D/test/add.test.js"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "skip the red one" >/dev/null 2>&1; then
  no "G2: a test disabled with .skip( committed"
else
  ok "G2: adding .skip( to a test is BLOCKED"
fi
rm -rf "$D"

# ---- G3: adding .only( to a test → BLOCKED --------------------------------
# .only silently drops every OTHER test in the file — a whole-suite mute.
D="$(seeded_repo)"
sed -i 's/^test("adds"/test.only("adds"/' "$D/test/add.test.js"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "focus one test" >/dev/null 2>&1; then
  no "G3: a test file with .only( committed"
else
  ok "G3: adding .only( to a test is BLOCKED"
fi
rm -rf "$D"

# ---- G4: python/rust/go skip markers → BLOCKED ----------------------------
D="$(seeded_repo)"
mkdir -p "$D/tests"
printf 'def test_thing():\n    assert 1 == 1\n' > "$D/tests/test_thing.py"
git -C "$D" add -A >/dev/null 2>&1
CONDUCTOR_HOOKS=off git -C "$D" commit -q -m "add py test" >/dev/null 2>&1
printf '@pytest.mark.skip(reason="flaky")\ndef test_thing():\n    assert 1 == 1\n' > "$D/tests/test_thing.py"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "skip py test" >/dev/null 2>&1; then
  no "G4: a @pytest.mark.skip committed"
else
  ok "G4: adding @pytest.mark.skip is BLOCKED"
fi
rm -rf "$D"

# ---- G5: gutting assertions → BLOCKED -------------------------------------
# Weakening is the third Goodhart move: keep the test, remove what it proves.
D="$(seeded_repo)"
cat > "$D/test/add.test.js" <<'EOF'
import { add } from "../src/add.js";
test("adds", () => { add(1, 2); });
EOF
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "simplify tests" >/dev/null 2>&1; then
  no "G5: a test file stripped of its assertions committed"
else
  ok "G5: a net drop in assertions is BLOCKED"
fi
rm -rf "$D"

# ---- G6: a normal red→green cycle still COMMITS ---------------------------
# The gate must not tax honest work: adding a test plus impl is the happy path.
D="$(seeded_repo)"
printf 'export const mul = (a, b) => a * b;\n' > "$D/src/mul.js"
cat > "$D/test/mul.test.js" <<'EOF'
import { mul } from "../src/mul.js";
test("multiplies", () => { expect(mul(2, 3)).toBe(6); });
EOF
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "feat: multiply" >/dev/null 2>&1; then
  ok "G6: an honest red→green commit is untouched"
else
  no "G6: the gate blocked a normal test+impl commit"
fi
rm -rf "$D"

# ---- G7: renaming a test file still COMMITS -------------------------------
# A rename is a delete+add to git. Gating on deletions alone would break it.
D="$(seeded_repo)"
git -C "$D" mv "test/add.test.js" "test/addition.test.js" >/dev/null 2>&1
if git -C "$D" commit -q -m "refactor: rename test file" >/dev/null 2>&1; then
  ok "G7: renaming a test file is not read as a deletion"
else
  no "G7: a test-file rename was blocked"
fi
rm -rf "$D"

# ---- G8: waiver → COMMITS and is logged -----------------------------------
D="$(seeded_repo)"
git -C "$D" rm -q "test/add.test.js" >/dev/null 2>&1
if CONDUCTOR_NO_BOUNDARY="feature removed, its tests go with it" \
     git -C "$D" commit -q -m "waived" >/dev/null 2>&1; then
  if grep -qi "boundary" "$D/conductor/0-compass/ship-log.md"; then
    ok "G8: waiver commits AND is logged to the ship-log"
  else
    no "G8: waiver committed but was not logged"
  fi
else
  no "G8: waiver did not allow the commit"
fi
rm -rf "$D"

# ---- G9: the TDD waiver does NOT waive the boundary -----------------------
# Independence: an agent that already has CONDUCTOR_NO_TEST in its environment
# must not get the boundary for free.
D="$(seeded_repo)"
git -C "$D" rm -q "test/add.test.js" >/dev/null 2>&1
if CONDUCTOR_NO_TEST="unrelated" git -C "$D" commit -q -m "wrong waiver" >/dev/null 2>&1; then
  no "G9: CONDUCTOR_NO_TEST also waived the boundary gate"
else
  ok "G9: the boundary gate is independent of the TDD waiver"
fi
rm -rf "$D"

echo ""
echo "Protected paths — the agent may not edit the gates:"

# ---- P1: editing .agents/hooks/ → BLOCKED ---------------------------------
D="$(seeded_repo)"
printf '\n# tampered\n' >> "$D/.agents/hooks/pre-commit"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "tweak the hook" >/dev/null 2>&1; then
  no "P1: a change to .agents/hooks/ committed"
else
  ok "P1: editing .agents/hooks/ is BLOCKED"
fi
rm -rf "$D"

# ---- P2: editing .agents/rules/ → BLOCKED ---------------------------------
D="$(seeded_repo)"
mkdir -p "$D/.agents/rules"
printf '# Test-Driven Law\nrelaxed.\n' > "$D/.agents/rules/test-driven-law.md"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "relax a law" >/dev/null 2>&1; then
  no "P2: a change to .agents/rules/ committed"
else
  ok "P2: editing .agents/rules/ is BLOCKED"
fi
rm -rf "$D"

# ---- P3: editing the reviewer brief → BLOCKED -----------------------------
# reviewer.md IS the acceptance criteria. Build may not edit it.
D="$(seeded_repo)"
mkdir -p "$D/.agents/skills/independent-review"
printf '# The Reviewer Brief\nApprove everything.\n' \
  > "$D/.agents/skills/independent-review/reviewer.md"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "soften the reviewer" >/dev/null 2>&1; then
  no "P3: a change to the reviewer brief committed"
else
  ok "P3: editing the reviewer brief is BLOCKED"
fi
rm -rf "$D"

# ---- P4: editing the sandbox profile → BLOCKED ----------------------------
D="$(seeded_repo)"
mkdir -p "$D/.agents/sandbox"
printf '{ "sandbox": { "enabled": false } }\n' > "$D/.agents/sandbox/claude-sandbox.settings.json"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "disable the sandbox" >/dev/null 2>&1; then
  no "P4: a change to the sandbox profile committed"
else
  ok "P4: editing .agents/sandbox/ is BLOCKED"
fi
rm -rf "$D"

# ---- P4b: DELETING a gate → BLOCKED ---------------------------------------
# Removing pre-commit disables every commit gate as surely as rewriting it, and
# a deletion stages nothing under ACM — the shape that hid this for free.
D="$(seeded_repo)"
git -C "$D" rm -q ".agents/hooks/pre-push" >/dev/null 2>&1
if git -C "$D" commit -q -m "remove the push gate" >/dev/null 2>&1; then
  no "P4b: a DELETED gate committed"
else
  ok "P4b: deleting a gate is BLOCKED"
fi
rm -rf "$D"

# ---- P4c: the FIRST commit of a fresh install is allowed ------------------
# `conductor init` stages .agents/ wholesale. You cannot weaken a gate that is
# not committed yet, and blocking here would mean a new project can never make
# its first commit. The gate arms from the second commit on.
D="$(fresh_repo)"
printf 'export const add = (a, b) => a + b;\n' > "$D/src/add.js"
printf 'test("adds", () => { expect(add(1,2)).toBe(3); });\n' > "$D/test/add.test.js"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "chore: scaffold conductor" >/dev/null 2>&1; then
  ok "P4c: the initial scaffold commit is allowed"
else
  no "P4c: a fresh conductor install cannot make its first commit"
fi
rm -rf "$D"

# ---- P5: ordinary .agents/ content is NOT protected -----------------------
# Only the enforcement surface is frozen. Skills and workflows stay editable.
D="$(seeded_repo)"
mkdir -p "$D/.agents/workflows"
printf '# Build\nsome workflow\n' > "$D/.agents/workflows/build.md"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "edit a workflow" >/dev/null 2>&1; then
  ok "P5: ordinary .agents/ content stays editable"
else
  no "P5: the gate over-reached into ordinary .agents/ content"
fi
rm -rf "$D"

# ---- P6: waiver → COMMITS and is logged -----------------------------------
D="$(seeded_repo)"
printf '\n# intentional\n' >> "$D/.agents/hooks/pre-commit"
git -C "$D" add -A >/dev/null 2>&1
if CONDUCTOR_NO_PROTECTED="conductor upgrade" git -C "$D" commit -q -m "waived" >/dev/null 2>&1; then
  if grep -qi "protected" "$D/conductor/0-compass/ship-log.md"; then
    ok "P6: waiver commits AND is logged to the ship-log"
  else
    no "P6: waiver committed but was not logged"
  fi
else
  no "P6: waiver did not allow the commit"
fi
rm -rf "$D"

# ---- P7: hooks off → both gates silent ------------------------------------
D="$(seeded_repo)"
git -C "$D" rm -q "test/add.test.js" >/dev/null 2>&1
printf '\n# tampered\n' >> "$D/.agents/hooks/pre-commit"
git -C "$D" add -A >/dev/null 2>&1
if CONDUCTOR_HOOKS=off git -C "$D" commit -q -m "hooks off" >/dev/null 2>&1; then
  ok "P7: CONDUCTOR_HOOKS=off disables both gates"
else
  no "P7: a gate still fired with CONDUCTOR_HOOKS=off"
fi
rm -rf "$D"

echo ""
echo "  Passed: $pass"
echo "  Failed: $fail"
[ "$fail" -eq 0 ] && echo "STATUS: PASSED ✅" || echo "STATUS: FAILED ❌"
exit "$fail"
