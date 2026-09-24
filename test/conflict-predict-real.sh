#!/usr/bin/env bash
# ============================================================
# Conflict prediction against REAL git (F7).
#
# test/loop-conflict.test.js stubs git, so it proves the parser and nothing
# about the command. Operating Truth 1: a green stubbed suite is not evidence.
# This builds real repos, makes real conflicting commits, and runs the real
# predictConflicts against whatever git is installed — so it exercises the
# legacy path on git < 2.38 and the modern path on >= 2.38, and SAYS which.
#
# Every bug this class of code ever had passed the stubbed suite and died here.
# ============================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
ok() { echo "  [PASS] $1"; pass=$((pass+1)); }
no() { echo "  [FAIL] $1"; fail=$((fail+1)); }

echo "Conflict prediction — real git $(git --version | awk '{print $3}'):"

D="$(mktemp -d)"
cleanup() { rm -rf "$D"; }
trap cleanup EXIT

git -C "$D" init -q
git -C "$D" config user.email t@t.local
git -C "$D" config user.name t
# Ten lines, because git conflicts on ADJACENT changed lines, not only on the
# same line. C3 needs an edit far enough away that git genuinely merges it —
# a 3-line file cannot express that, and the first version of this fixture
# quietly tested the opposite of what it claimed.
printf 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n' > "$D/f.txt"
printf 'other\n' > "$D/g.txt"
git -C "$D" add -A
git -C "$D" commit -qm base
BASE_BRANCH="$(git -C "$D" rev-parse --abbrev-ref HEAD)"

# Two branches editing the SAME line — a genuine conflict.
git -C "$D" checkout -q -b feat-a
printf 'line1\nAAA\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n' > "$D/f.txt"
git -C "$D" commit -qam a

git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-b
printf 'line1\nBBB\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n' > "$D/f.txt"
git -C "$D" commit -qam b

# A branch touching a DIFFERENT file — must merge clean.
git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-clean
printf 'changed\n' > "$D/g.txt"
git -C "$D" commit -qam clean

# Two branches editing the same file on DIFFERENT lines — git merges this
# cleanly, and calling it a conflict would escalate work that is fine.
git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-far
printf 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nFAR\nline10\n' > "$D/f.txt"
git -C "$D" commit -qam far

# Review blocker: a branch ADDING a file whose content contains marker text.
# git merges it cleanly; a marker-string match called it a conflict.
git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-marker
printf 'const M = "<<<<<<<";\n<<<<<<< .our\n' > "$D/fixture.js"
git -C "$D" add -A
git -C "$D" commit -qm marker

# Review IMPORTANT: modify/delete. Real conflict, and it writes no markers.
git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-mod-g
printf 'changed by one side\n' > "$D/g.txt"
git -C "$D" commit -qam mod-g
git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-del-g
git -C "$D" rm -q g.txt
git -C "$D" commit -qm del-g
git -C "$D" checkout -q "$BASE_BRANCH"

# Delta review: a file that ALREADY contains an exact marker line, edited by
# both sides on lines far enough apart that git merges cleanly, but close
# enough that the marker falls inside the hunk's context and is printed. A
# first version of this fixture put the marker outside the context window, so
# it never appeared and the case passed against the buggy regex too.
git -C "$D" checkout -q "$BASE_BRANCH"
printf 'l1\nl2\nl3\nl4\nl5\n<<<<<<< .our\nl7\nl8\nl9\nl10\nl11\nl12\n' > "$D/h.txt"
git -C "$D" add -A; git -C "$D" commit -qm "file with a marker line"
git -C "$D" checkout -q -b feat-h-top;    sed -i 's/^l3$/L3/' "$D/h.txt"; git -C "$D" commit -qam top
git -C "$D" checkout -q "$BASE_BRANCH"
git -C "$D" checkout -q -b feat-h-bottom; sed -i 's/^l9$/L9/' "$D/h.txt"; git -C "$D" commit -qam bottom
git -C "$D" checkout -q "$BASE_BRANCH"

# Ask the real module, with a real git runner.
predict() {
  node --input-type=module -e "
    import { execFile } from 'node:child_process';
    import { promisify } from 'node:util';
    import { predictConflicts } from '${REPO_ROOT}/src/loop/conflict.js';
    const run = promisify(execFile);
    const git = async (args) => {
      try {
        const { stdout, stderr } = await run('git', ['-C', '$D', ...args], { maxBuffer: 1 << 24 });
        return { ok: true, stdout, stderr, exitCode: 0 };
      } catch (e) {
        return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code ?? 1 };
      }
    };
    const r = await predictConflicts({ git, base: '$1', branch: '$2' });
    process.stdout.write(JSON.stringify(r));
  " 2>/dev/null
}

# ---- C1: a real conflict is predicted, with the right file ----------------
OUT="$(predict feat-a feat-b)"
if printf '%s' "$OUT" | grep -q '"conflicted":true' && printf '%s' "$OUT" | grep -q 'f.txt'; then
  ok "C1: a real same-line conflict is predicted, naming f.txt"
else
  no "C1: real conflict NOT predicted — got: $OUT"
fi

# ---- C2: a genuinely clean merge is not flagged ---------------------------
OUT="$(predict feat-a feat-clean)"
if printf '%s' "$OUT" | grep -q '"conflicted":false'; then
  ok "C2: a clean merge (different files) is not flagged"
else
  no "C2: clean merge wrongly flagged — got: $OUT"
fi

# ---- C3: same file, different lines → still clean -------------------------
# The over-reporting trap. git merges this; so must we.
OUT="$(predict feat-a feat-far)"
if printf '%s' "$OUT" | grep -q '"conflicted":false'; then
  ok "C3: same file / different lines merges clean, not flagged"
else
  no "C3: non-overlapping edits wrongly flagged — got: $OUT"
fi

# ---- C4: the prediction agrees with what git ACTUALLY does ----------------
# The claim under test is "this predicts the merge". Prove it by performing
# the merge for real in a throwaway clone and comparing the verdicts.
actual_conflict() {
  local c; c="$(mktemp -d)"
  git clone -q "$D" "$c" 2>/dev/null
  git -C "$c" checkout -q "$1"
  if git -C "$c" merge --no-commit --no-ff "origin/$2" >/dev/null 2>&1; then
    printf 'clean'
  else
    printf 'conflict'
  fi
  rm -rf "$c"
}

for pair in "feat-a feat-b" "feat-a feat-clean" "feat-a feat-far" "feat-a feat-marker" "feat-mod-g feat-del-g" "feat-h-top feat-h-bottom"; do
  set -- $pair
  PRED="$(predict "$1" "$2" | grep -o '"conflicted":[a-z]*' | cut -d: -f2)"
  ACTUAL="$(actual_conflict "$1" "$2")"
  EXPECT="clean"; [ "$PRED" = "true" ] && EXPECT="conflict"
  if [ "$EXPECT" = "$ACTUAL" ]; then
    ok "C4: prediction matches the real merge for $1 + $2 ($ACTUAL)"
  else
    no "C4: predicted $EXPECT but git actually said $ACTUAL for $1 + $2"
  fi
done

# ---- C7: marker TEXT in content is not a conflict (review blocker) --------
OUT="$(predict feat-a feat-marker)"
if printf '%s' "$OUT" | grep -q '"conflicted":false'; then
  ok "C7: a file containing marker text merges clean and is not flagged"
else
  no "C7: marker text in content produced a FALSE conflict — got: $OUT"
fi

# ---- C8: modify/delete is a real conflict with no markers -----------------
OUT="$(predict feat-mod-g feat-del-g)"
if printf '%s' "$OUT" | grep -q '"conflicted":true' && printf '%s' "$OUT" | grep -q 'g.txt'; then
  ok "C8: a modify/delete conflict is predicted, naming g.txt"
else
  no "C8: modify/delete conflict NOT predicted — got: $OUT"
fi

# ---- C5: report which form ran, so a green run is not mistaken for both ---
METHOD="$(predict feat-a feat-b | grep -o '"method":"[^"]*"' | cut -d'"' -f4)"
if [ "$METHOD" = "merge-tree" ] || [ "$METHOD" = "merge-tree-legacy" ]; then
  ok "C5: a real form was used and reported ($METHOD)"
  [ "$METHOD" = "merge-tree-legacy" ] &&
    echo "         note: git < 2.38 here — the MODERN path is NOT covered by this run"
else
  no "C5: no usable merge-tree form (method=$METHOD) — prediction is inert on this git"
fi

# ---- C6: an unknown ref fails open, never a false conflict ----------------
OUT="$(predict feat-a no-such-branch)"
if printf '%s' "$OUT" | grep -q '"conflicted":false'; then
  ok "C6: an unresolvable branch fails open (no false conflict)"
else
  no "C6: an unresolvable branch produced a conflict verdict — got: $OUT"
fi

echo ""
echo "  Passed: $pass"
echo "  Failed: $fail"
[ "$fail" -eq 0 ] && echo "STATUS: PASSED ✅" || echo "STATUS: FAILED ❌"
exit "$fail"
