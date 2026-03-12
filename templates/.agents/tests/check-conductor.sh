#!/usr/bin/env bash
# ============================================================
# Conductor Framework V4 — Self-Test Suite
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
echo " Conductor Framework V4 — Self-Test"
echo "========================================"
echo ""

# ---- 1. Core Structure ----
echo "1. Core Structure..."

required_dirs=(
  "$ROOT_DIR/.conductor/0-Compass"
  "$ROOT_DIR/.conductor/1-Workbench"
  "$ROOT_DIR/.conductor/2-Backlog"
  "$ROOT_DIR/.conductor/3-Product-Areas"
  "$ROOT_DIR/.conductor/4-Context"
  "$ROOT_DIR/.conductor/5-Templates"
  "$ROOT_DIR/.conductor/6-Archive"
  "$AGENT_DIR/workflows"
  "$AGENT_DIR/skills"
  "$AGENT_DIR/personas"
  "$AGENT_DIR/tests"
)

for dir in "${required_dirs[@]}"; do
  require_dir "$dir"
done

# ---- 2. Core Files ----
echo ""
echo "2. Core Files..."

required_files=(
  "$AGENT_DIR/How-It-Works.md"
  "$AGENT_DIR/AGENTS.md"
  "$ROOT_DIR/CHANGELOG.md"
)

for file in "${required_files[@]}"; do
  require_file "$file"
done

# ---- 3. Workflows ----
echo ""
echo "3. Workflows..."

workflows=(
  "Genesis" "Storyboard" "Grand-PRD" "UX-UI-Design-Brief"
  "Technical-Vision" "Carve" "Spec-It" "Build" "Quick-Path"
  "Retrospective" "Agentic-Flow"
)

for workflow in "${workflows[@]}"; do
  require_file "$AGENT_DIR/workflows/$workflow.md"
done

# ---- 4. Personas ----
echo ""
echo "4. Personas..."

personas=(
  "CTO" "Architect" "Product-Manager" "Tech-Lead"
  "Designer" "Conductor-Assistant" "Code-Archaeologist"
  "Security-Auditor" "Database-Architect" "Performance-Optimizer"
)

for persona in "${personas[@]}"; do
  require_file "$AGENT_DIR/personas/$persona.md"
done

# ---- 5. Skills ----
echo ""
echo "5. Skills..."

skills=(
  "Brain-Dump-to-Epics" "System-Janitor" "UX-Reviewer"
  "Verification-Gate" "Task-Tracker" "Code-Review" "Context-Updater"
  "Design-Md" "Enhance-Prompt" "Stitch-Loop" "React-Components"
  "Shadcn-UI" "Remotion"
  "Systematic-Debugging" "Clean-Code" "Testing-Patterns"
  "Frontend-Design" "Documentation-Templates" "Deployment-Procedures"
  "I18n-Localization" "Git-Worktrees"
  "Git-Workflow" "GitLab-CLI" "GitHub-CLI"
  "Architecture-Patterns"
)

for skill in "${skills[@]}"; do
  require_file "$AGENT_DIR/skills/$skill/SKILL.md"
done

# ---- 6. Naming Convention ----
echo ""
echo "6. Naming Convention (Title-Case-Kebab)..."

lowercase_found=0
for dir in "$AGENT_DIR/skills"/*/; do
  dirname=$(basename "$dir")
  if [[ "$dirname" =~ ^[a-z] ]]; then
    fail "Skill folder not Title-Case-Kebab: $dirname"
    lowercase_found=1
  fi
done

if [ "$lowercase_found" -eq 0 ]; then
  pass "All skill folders follow Title-Case-Kebab"
fi

# ---- 7. Version Check ----
echo ""
echo "7. Version Check..."

if grep -q "V4" "$AGENT_DIR/AGENTS.md"; then
  pass "AGENTS.md references V4"
else
  fail "AGENTS.md does not reference V4"
fi

if grep -q "V4" "$AGENT_DIR/How-It-Works.md"; then
  pass "How-It-Works.md references V4"
else
  fail "How-It-Works.md does not reference V4"
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
