#!/usr/bin/env bash
# ============================================================
# Conductor Framework V5 — Self-Test Suite
# ============================================================
# Validates that all framework files exist, have proper naming,
# and the framework is structurally intact.
#
# Usage:
#   bash .agents/tests/check-conductor.sh
#
# Adapted from Antigravity Superpowers' check-antigravity-profile.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$AGENT_DIR/.." && pwd)"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo "  [PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "  [FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

require_file() {
  local path="$1"
  if [ -f "$path" ]; then
    pass "File exists: $(basename "$path")"
  else
    fail "Missing file: $path"
  fi
}

require_dir() {
  local path="$1"
  if [ -d "$path" ]; then
    pass "Dir exists: $(basename "$path")"
  else
    fail "Missing dir: $path"
  fi
}

echo "========================================"
echo " Conductor Framework V5 — Self-Test"
echo "========================================"
echo ""

# ---- 1. Core Structure ----
echo "1. Core Structure..."

required_dirs=(
  "$ROOT_DIR/conductor/0-compass"
  "$ROOT_DIR/conductor/1-workbench"
  "$ROOT_DIR/conductor/2-backlog"
  "$ROOT_DIR/conductor/3-product-areas"
  "$ROOT_DIR/conductor/4-context"
  "$ROOT_DIR/conductor/5-templates"
  "$ROOT_DIR/conductor/6-archive"
  "$AGENT_DIR/workflows"
  "$AGENT_DIR/skills"
  "$AGENT_DIR/personas"
  "$AGENT_DIR/rules"
  "$AGENT_DIR/tests"
)

for dir in "${required_dirs[@]}"; do
  require_dir "$dir"
done

# ---- 2. Core Files ----
echo ""
echo "2. Core Files..."

required_files=(
  "$AGENT_DIR/AGENTS.md"
  "$AGENT_DIR/how-it-works.md"
  "$ROOT_DIR/CHANGELOG.md"
  "$ROOT_DIR/conductor/1-workbench/loop-state.json"
)

for file in "${required_files[@]}"; do
  require_file "$file"
done

# ---- 3. Workflows ----
echo ""
echo "3. Workflows..."

workflows=(
  "genesis" "storyboard" "grand-prd" "ux-ui-design-brief"
  "technical-vision" "carve" "spec-it" "build" "quick-path"
  "retrospective" "agentic-flow" "ship" "tdd-cycle" "unattended-loop"
)

for workflow in "${workflows[@]}"; do
  require_file "$AGENT_DIR/workflows/$workflow.md"
done

# ---- 4. Personas ----
echo ""
echo "4. Personas..."

personas=(
  "cto" "architect" "product-manager" "tech-lead"
  "designer" "conductor-assistant" "code-archaeologist"
  "security-auditor" "database-architect" "performance-optimizer"
  "maker" "checker"
)

for persona in "${personas[@]}"; do
  require_file "$AGENT_DIR/personas/$persona.md"
done

# ---- 5. Skills ----
echo ""
echo "5. Skills..."

skills=(
  "brain-dump-to-epics" "system-janitor" "ux-reviewer"
  "verification-gate" "task-tracker" "code-review" "context-updater"
  "systematic-debugging" "clean-code" "testing-patterns"
  "frontend-design" "documentation-templates" "deployment-procedures"
  "i18n-localization" "git-worktrees"
  "git-workflow" "git-lab-cli" "git-hub-cli"
  "architecture-patterns"
  "lint-and-validate"
  "analyze-tests" "trace-documentation"
  "context-engineering" "discovery-phase" "blueprint-phase" "execution-phase" "shipping-phase"
  "skill-registry" "grilling"
)

for skill in "${skills[@]}"; do
  require_file "$AGENT_DIR/skills/$skill/SKILL.md"
done

# ---- 6. Rules ----
echo ""
echo "6. Rules..."

rules=(
  "prime-directive" "verification-iron-law" "test-driven-law" "loop-guardrails"
)

for rule in "${rules[@]}"; do
  require_file "$AGENT_DIR/rules/$rule.md"
done

# ---- 7. Naming Convention ----
echo ""
echo "7. Naming Convention (kebab-case)..."

uppercase_found=0
for dir in "$AGENT_DIR/skills"/*/; do
  dirname=$(basename "$dir")
  if [[ "$dirname" =~ [A-Z] ]]; then
    fail "Skill folder not kebab-case: $dirname"
    uppercase_found=1
  fi
done

if [ "$uppercase_found" -eq 0 ]; then
  pass "All skill folders follow kebab-case"
fi

# ---- 8. Version Check ----
echo ""
echo "8. Version Check..."

if grep -q "Conductor Framework" "$AGENT_DIR/AGENTS.md"; then
  pass "AGENTS.md references Conductor Framework"
else
  fail "AGENTS.md does not reference Conductor Framework"
fi

# ---- 9. Dead Path References ----
# Guards against the exact bug the V5 kebab-case migration introduced once:
# renaming files/folders without updating the prose that points at them.
echo ""
echo "9. Dead Path References..."

dead_refs=$(grep -rEl '\.?conductor/[0-9]-[A-Z]|\.agents/workflows/[A-Z][a-zA-Z-]*\.md|\.agents/skills/[A-Z][a-zA-Z-]*/SKILL\.md' "$AGENT_DIR" 2>/dev/null || true)

if [ -z "$dead_refs" ]; then
  pass "No dead Title-Case path references found"
else
  fail "Dead Title-Case path references found in:"
  echo "$dead_refs" | while read -r f; do echo "         $f"; done
fi

# ---- Summary ----
echo ""
echo "========================================"
echo " Summary"
echo "========================================"
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "STATUS: FAILED"
  exit 1
fi

echo "STATUS: PASSED ✅"


