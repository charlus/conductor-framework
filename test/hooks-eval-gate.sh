#!/usr/bin/env bash
# ============================================================
# Eval-Driven Law — pre-commit gate BEHAVIOR test (Track A).
# Installs the real templates/.agents/hooks into a temp repo and exercises the
# gate: LLM-feature code staged without an eval is blocked; with an eval (or a
# logged waiver) it commits; non-LLM code is untouched. Composes with the TDD
# gate — every case stages a test so only the EVAL dimension is under test.
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
  : > "$d/conductor/0-compass/ship-log.md"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.local
  git -C "$d" config user.name t
  git -C "$d" config core.hooksPath .agents/hooks
  printf '%s' "$d"
}

echo "Eval-Driven Law — pre-commit gate:"

# ---- T1: LLM-feature file + test but NO eval → BLOCKED --------------------
D="$(fresh_repo)"
printf 'import OpenAI from "openai";\nexport const c = new OpenAI();\n' > "$D/svc.ts"
printf 'test("x", () => {});\n' > "$D/svc.test.ts"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "llm feature, no eval" >/tmp/t1.out 2>&1; then
  no "T1: LLM-feature code committed WITHOUT an eval (gate did not fire)"
else
  ok "T1: LLM-feature code without an eval is BLOCKED"
fi
rm -rf "$D"

# ---- T2: LLM-feature file + test + eval → COMMITS -------------------------
D="$(fresh_repo)"
printf 'import OpenAI from "openai";\nexport const c = new OpenAI();\n' > "$D/svc.ts"
printf 'test("x", () => {});\n' > "$D/svc.test.ts"
printf 'export const evalset = [{input:"hi", rubric:"greets"}];\n' > "$D/svc.eval.ts"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "llm feature + eval" >/tmp/t2.out 2>&1; then
  ok "T2: LLM-feature code WITH an eval commits cleanly"
else
  no "T2: eval was staged but the commit was still blocked"; cat /tmp/t2.out | sed 's/^/      /'
fi
rm -rf "$D"

# ---- T3: non-LLM file + test, no eval → COMMITS (gate silent) -------------
D="$(fresh_repo)"
printf 'export const add = (a,b) => a+b;\n' > "$D/util.ts"
printf 'test("x", () => {});\n' > "$D/util.test.ts"
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "plain util" >/tmp/t3.out 2>&1; then
  ok "T3: non-LLM code needs no eval (gate silent)"
else
  no "T3: non-LLM code was wrongly blocked by the eval gate"; cat /tmp/t3.out | sed 's/^/      /'
fi
rm -rf "$D"

# ---- T4: LLM file + test, no eval, CONDUCTOR_NO_EVAL waiver → COMMITS -----
D="$(fresh_repo)"
printf 'from anthropic import Anthropic\nc = Anthropic()\n' > "$D/agent.py"
printf 'def test_x(): pass\n' > "$D/test_agent.py"
git -C "$D" add -A >/dev/null 2>&1
if CONDUCTOR_NO_EVAL="prototype, not shipping" git -C "$D" commit -q -m "waived" >/tmp/t4.out 2>&1; then
  ok "T4: CONDUCTOR_NO_EVAL waiver lets the commit through"
  if grep -qi "eval" "$D/conductor/0-compass/ship-log.md"; then
    ok "T4: the waiver was logged to the ship-log (auditable, not silent)"
  else
    no "T4: waiver was not logged to the ship-log"
  fi
else
  no "T4: CONDUCTOR_NO_EVAL waiver did not unblock the commit"; cat /tmp/t4.out | sed 's/^/      /'
fi
rm -rf "$D"

# ---- T6: gates are INDEPENDENT — an eval doesn't satisfy the TDD gate --------
D="$(fresh_repo)"
printf 'import OpenAI from "openai";\nexport const c = new OpenAI();\n' > "$D/svc.ts"
printf 'export const evalset = [{input:"hi", rubric:"greets"}];\n' > "$D/svc.eval.ts"  # eval present, NO test
git -C "$D" add -A >/dev/null 2>&1
if git -C "$D" commit -q -m "eval but no test" >/tmp/t6.out 2>&1; then
  no "T6: LLM code with an eval but NO test committed (TDD gate bypassed by the eval)"
else
  ok "T6: an eval does not satisfy the TDD gate — still blocked for the missing test"
fi
rm -rf "$D"

# ---- T5: files that only MENTION a provider (shell/docs/config) are NOT -----
# flagged — the framework's own lib.sh/pre-commit/eval-skill name providers.
# shellcheck source=/dev/null
. "$REPO_ROOT/templates/.agents/hooks/lib.sh"
D="$(mktemp -d)"
printf '# uses the openai and anthropic and cohere providers\n' > "$D/notes.md"
printf 'PROVIDERS="openai anthropic ollama"\n' > "$D/setup.sh"
cp "$REPO_ROOT/templates/.agents/hooks/lib.sh" "$D/lib.sh"   # the real regex string
t5=0
for f in notes.md setup.sh lib.sh; do
  if conductor_is_llm_feature_file "$D/$f"; then no "T5: '$f' (only mentions a provider) was wrongly flagged as an LLM feature"; t5=1; fi
done
[ "$t5" = "0" ] && ok "T5: shell/docs/config that only mention a provider are NOT flagged (impl-only)"
rm -rf "$D"

echo ""
echo "  hooks-eval-gate: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
echo "  STATUS: PASSED ✅"
