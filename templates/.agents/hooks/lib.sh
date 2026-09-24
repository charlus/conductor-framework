#!/usr/bin/env bash
# Conductor enforcement hooks — shared helpers (ADR-0001 D1).
# Sourced by pre-commit / pre-push. Pure POSIX-ish bash; needs git + node (>=20).

# Repo root (empty if not in a git work tree).
conductor_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || true
}

# True (0) for test files. Covers *.test.*, *.spec.*, test_*.*, and tests/ dirs.
conductor_is_test_file() {
  printf '%s\n' "$1" | grep -Eiq '(\.|_)(test|spec)\.|(^|/)(tests?|__tests__|specs?)/|(^|/)test_[^/]*$'
}

# True (0) for implementation source files (and NOT test files).
conductor_is_impl_file() {
  conductor_is_test_file "$1" && return 1
  printf '%s\n' "$1" | grep -Eiq '\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|rb|php|c|h|cc|cpp|hpp|cs|swift|kt|kts|scala|ex|exs|dart|m|mm|vue|svelte)$'
}

# True (0) for eval files (Eval-Driven Law). Mirrors the test-file convention:
# a *.eval.* / *.evals.* infix, or an evals/ (eval/) directory.
conductor_is_eval_file() {
  printf '%s\n' "$1" | grep -Eiq '(\.|_)(eval|evals)\.|(^|/)evals?/'
}

# True (0) if the file's CONTENT calls an LLM provider — the non-deterministic
# surface that needs an eval, not just a test. Content-based (LLM calls live in
# ordinary app files), skipping test/eval files themselves. Full provider list,
# accepting occasional false positives (mitigated by the CONDUCTOR_NO_EVAL
# waiver) — a missed eval surface is the costlier error.
conductor_is_llm_feature_file() {
  local f="$1"
  [ -f "$f" ] || return 1
  conductor_is_eval_file "$f" && return 1
  # Only real SOURCE files can be an LLM feature. This excludes shell scripts,
  # docs, and config that merely *mention* a provider name — including the
  # framework's own hooks/skills — and is more correct (an eval covers code that
  # CALLS a provider). conductor_is_impl_file already excludes test files.
  conductor_is_impl_file "$f" || return 1
  grep -Eiq '(openai|@anthropic-ai|anthropic|langchain|langgraph|llama[-_]?index|google\.generativeai|@google/(genai|generative-ai)|generativeai|vertexai|bedrock-runtime|mistralai|cohere|ollama|huggingface|replicate|litellm)' "$f"
}

# True (0) if the path is a brief document — the artifact that records the
# shared understanding reached at convergence, and the first place work starts.
# Quick-Path and Spec-It both converge on `feature-spec.md`.
conductor_is_brief_doc() {
  printf '%s\n' "$1" | grep -Eiq '(^|/)feature-spec\.md$'
}

# True (0) if a brief document CONTAINS the brief-check section. Presence, not
# quality — the same call as the Eval-Driven Law's presence gate. A generic hook
# cannot judge whether a challenge is a good one; the Checker does that.
conductor_has_brief_check() {
  local f="$1"
  [ -f "$f" ] || return 1
  grep -Eiq '^#{1,6}[[:space:]]*Brief check' "$f"
}

# True (0) if the path is the project's ship-log.
conductor_is_ship_log() {
  printf '%s\n' "$1" | grep -Eiq '(^|/)ship-log\.md$'
}

# True (0) if the ship-log's NEWEST entry carries the `**For you**` block.
# Newest = the greatest `## YYYY-MM-DD` heading, not the last one in the file:
# one live log had 07-15 written after 07-16. Presence, not quality — a hook
# cannot judge whether an Impact line is any good.
# A log with no dated entry at all passes: there is nothing to report yet.
conductor_newest_entry_has_for_you() {
  local f="$1"
  [ -f "$f" ] || return 0
  local newest
  newest="$(grep -Eo '^## [0-9]{4}-[0-9]{2}-[0-9]{2}' "$f" | sort | tail -1)"
  [ -z "$newest" ] && return 0
  awk -v head="$newest" '
    index($0, head) == 1 { inentry = 1; next }
    inentry && /^## [0-9]{4}-[0-9]{2}-[0-9]{2}/ { inentry = 0 }
    inentry && /^[[:space:]]*\*\*For you\*\*/ { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "$f"
}

# Echo the project's verification command.
# Priority: conductor.config.json "verify" → package.json "test" script → empty.
conductor_verify_cmd() {
  local root="$1"
  local cmd=""
  if [ -f "$root/conductor.config.json" ]; then
    cmd="$(node -e "try{process.stdout.write((require('$root/conductor.config.json').verify||'').toString())}catch(e){}" 2>/dev/null || true)"
  fi
  if [ -z "$cmd" ] && [ -f "$root/package.json" ]; then
    if node -e "process.exit(require('$root/package.json').scripts&&require('$root/package.json').scripts.test?0:1)" 2>/dev/null; then
      cmd="npm test"
    fi
  fi
  printf '%s' "$cmd"
}

# Echo the project's EVAL command (Eval-Driven Law run-gate).
# Priority: conductor.config.json "eval" → package.json "eval" script → empty.
conductor_eval_cmd() {
  local root="$1"
  local cmd=""
  if [ -f "$root/conductor.config.json" ]; then
    cmd="$(node -e "try{process.stdout.write((require('$root/conductor.config.json').eval||'').toString())}catch(e){}" 2>/dev/null || true)"
  fi
  if [ -z "$cmd" ] && [ -f "$root/package.json" ]; then
    if node -e "process.exit(require('$root/package.json').scripts&&require('$root/package.json').scripts.eval?0:1)" 2>/dev/null; then
      cmd="npm run eval"
    fi
  fi
  printf '%s' "$cmd"
}

# True (0) if the repo tracks any eval file (same convention as conductor_is_eval_file).
conductor_has_eval_files() {
  local root="$1"
  git -C "$root" ls-files 2>/dev/null | grep -Eiq '(\.|_)(eval|evals)\.|(^|/)evals?/'
}

# ---------------------------------------------------------------------------
# The Goodhart boundary (F9).
#
# "All tests pass" is a gameable done-criterion, and the Test-Driven Law only
# proves a test CHANGE exists. It cannot tell a new test from a deleted one:
# `--diff-filter=ACM` never sees a deletion, and staging `.skip(` counts as a
# change. So the two cheapest moves an unattended agent has — delete the
# failing test, skip the failing test — both satisfied the gate. A third,
# gutting the assertions, satisfied it too.
#
# A done-criterion needs a boundary beside it: what the change must NOT do.
# These three helpers are that boundary, and they are deliberately syntactic —
# a hook cannot judge whether removing a test was right, only that it happened.

# Test-disabling markers, across the languages conductor_is_test_file covers.
# Only ever matched against ADDED lines inside files that are already tests.
CONDUCTOR_SKIP_MARKER_RE='\.(skip|only|todo|failing)\(|\bx(it|test|describe)\(|@pytest\.mark\.skip|@unittest\.skip|\bpytest\.skip\(|#\[ignore\]|\bt\.Skip(Now)?\(|@Ignore\b|@Disabled\b'

# What counts as an assertion — the thing a test actually proves.
CONDUCTOR_ASSERT_RE='expect\(|\bassert|\.should\b|\bEXPECT_|\bASSERT_|XCTAssert|\bt\.(is|deepEqual|truthy|throws)\(|\.to\.(be|equal|deep)'

# True (0) for a test file that is CODE. conductor_is_test_file counts any path
# under test/, which is right for the TDD gate (a fixture change is a test
# change) and wrong for deletions: removing test/fixtures/data.json or
# test/README.md is not removing a test.
conductor_is_test_code_file() {
  conductor_is_test_file "$1" || return 1
  printf '%s\n' "$1" | grep -Eiq '\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|rb|php|c|h|cc|cpp|hpp|cs|swift|kt|kts|scala|ex|exs|dart|m|mm|vue|svelte)$'
}

# Echo staged test files that stop being tests, one per line: deleted outright,
# or RENAMED to a path that is no longer test code (`add.test.js.bak`,
# `docs/add.test.js.txt`). To the suite the second is the same as the first —
# the test simply stops running — and the delta review found it walked straight
# past a deletion-only check. Rename detection is forced on with -M, so an
# ordinary rename between test paths is not read as removing a test.
conductor_deleted_test_files() {
  local root="$1" st a b
  git -C "$root" diff --cached --name-status -M --diff-filter=DR 2>/dev/null |
    while IFS=$'\t' read -r st a b; do
      [ -z "${a:-}" ] && continue
      case "$st" in
        D*) conductor_is_test_code_file "$a" && printf '%s\n' "$a" ;;
        R*) conductor_is_test_code_file "$a" && ! conductor_is_test_code_file "$b" &&
              printf '%s (renamed to %s, which is not a test)\n' "$a" "$b" ;;
      esac
    done
}

# Echo the staged test paths the boundary checks must diff, one per line:
# every added, copied or modified test file, and for a RENAME both the old and
# the new path. Two reasons, both from the independent review (B6):
#   - status R is not in --diff-filter=ACM, so a test that was renamed AND
#     disabled in one commit never reached the checks at all;
#   - diffing only the new path of a rename shows the whole file as added, so
#     with diff.renames=false a pure rename read as new .skip( lines.
# Passing both paths with an explicit -M pairs them, whatever the config, and
# leaves only the lines that really changed.
conductor_staged_test_paths() {
  local root="$1" st a b
  git -C "$root" diff --cached --name-status -M --diff-filter=ACMR 2>/dev/null |
    while IFS=$'\t' read -r st a b; do
      [ -z "${a:-}" ] && continue
      case "$st" in
        R*) conductor_is_test_file "$b" && printf '%s\n%s\n' "$a" "$b" ;;
        *)  conductor_is_test_file "$a" && printf '%s\n' "$a" ;;
      esac
    done
}

# Echo "file: marker" for each staged test file that ADDS a disabling marker.
# Arguments are the paths from conductor_staged_test_paths.
conductor_added_skip_markers() {
  local root="$1" f line hit seen=""
  shift
  [ "$#" -eq 0 ] && return 0
  # awk only labels each ADDED line with its file (from the +++ header); the
  # matching stays in grep -E, whose \b awk does not share.
  git -C "$root" diff --cached -M -U0 -- "$@" 2>/dev/null |
    awk '/^\+\+\+ /{f=substr($0,5); sub(/^b\//,"",f); next}
         /^---/{next}
         /^\+/{print f "\t" substr($0,2)}' |
    while IFS=$'\t' read -r f line; do
      case " $seen " in *" $f "*) continue ;; esac
      hit="$(printf '%s\n' "$line" | grep -Eo "$CONDUCTOR_SKIP_MARKER_RE" | head -1)"
      if [ -n "$hit" ]; then
        printf '%s: %s\n' "$f" "$hit"
        seen="$seen $f"
      fi
    done
}

# Echo the NET change in assertion count across the given staged test paths.
# Negative means this commit removed more proof than it added. Summed across
# files on purpose: moving assertions between test files nets to zero. One
# rename-paired diff, so a renamed file contributes only its real line changes.
conductor_assertion_delta() {
  local root="$1" d a r
  shift
  if [ "$#" -eq 0 ]; then printf '0'; return 0; fi
  d="$(git -C "$root" diff --cached -M -U0 -- "$@" 2>/dev/null)"
  a="$(printf '%s\n' "$d" | grep -E '^\+' | grep -Ev '^\+\+\+' | grep -Ec "$CONDUCTOR_ASSERT_RE")"
  r="$(printf '%s\n' "$d" | grep -E '^-' | grep -Ev '^---' | grep -Ec "$CONDUCTOR_ASSERT_RE")"
  printf '%s' "$((a - r))"
}

# ---------------------------------------------------------------------------
# Protected paths (F12).
#
# "Build may not edit the acceptance conditions" is the one rule every
# plan/build/judge loop rests on, and we enforced it nowhere: a maker beat
# could edit the hooks that gate it, the rules that bind it, the sandbox that
# contains it, or the reviewer brief that judges it. The more a loop can
# rewrite its own constraints, the stricter the human review it needs — so
# this surface is frozen behind a logged, deliberate waiver.
#
# Scoped to the ENFORCEMENT surface only. Workflows, skills and project
# knowledge stay freely editable; freezing those would make the gate a tax.
conductor_is_protected_path() {
  printf '%s\n' "$1" |
    grep -Eq '^\.agents/(hooks|rules|sandbox)/|^\.agents/skills/independent-review/'
}

# True (0) once the enforcement surface is COMMITTED. Until then the commit in
# hand is the install itself (`conductor init` stages .agents/ wholesale), and
# blocking it would mean a fresh project cannot make its first commit. You
# cannot weaken a gate that does not exist yet; from the next commit on, every
# touch of these paths — add, modify, delete — is a change to the rules.
conductor_enforcement_installed() {
  git -C "$1" cat-file -e HEAD:.agents/hooks/pre-commit 2>/dev/null
}

# Echo staged changes to protected paths, whatever their status. Deletions and
# renames matter as much as edits here: removing pre-commit disables the gate
# just as surely as rewriting it, and only a full name-status scan sees that.
conductor_protected_changes() {
  local root="$1" line status path
  conductor_enforcement_installed "$root" || return 0
  git -C "$root" diff --cached --name-status --find-renames 2>/dev/null |
    while IFS=$'\t' read -r status path dest; do
      [ -z "${path:-}" ] && continue
      # A rename reports old and new; either side landing in a protected path
      # is a change to the enforcement surface.
      for candidate in "$path" "${dest:-}"; do
        [ -z "$candidate" ] && continue
        conductor_is_protected_path "$candidate" &&
          printf '%s (%s)\n' "$candidate" "$(printf '%s' "$status" | cut -c1)"
      done
    done
}

# Append a waiver line to the ship-log so bypasses are auditable, never silent.
conductor_log_waiver() {
  local root="$1" kind="$2" reason="$3"
  local log="$root/conductor/0-compass/ship-log.md"
  [ -f "$log" ] || return 0
  printf -- '- [%s] Hook waiver (%s): %s\n' "$(date '+%Y-%m-%d %H:%M')" "$kind" "$reason" >> "$log"
}

# ---------------------------------------------------------------------------
# Verify-command trust store (E4).
#
# The Stop hook runs the project's declared verification command. Hooks BYPASS
# the permission system, so that command executes with no human in the loop —
# and it is read from a file inside the repo. A cloned or contributed repo can
# therefore name any command. The gate is that a declared command never runs
# until the operator has recorded it once:
#
#   conductor trust-verify        (run from inside the repo)
#
# Store: ${CONDUCTOR_HOME:-$HOME/.conductor}/verify-trust, one
# "realpath<TAB>sha256" line per repo, mode 0600, rewritten atomically. Editing
# the declared command changes its hash and invalidates trust until re-run.
# pre-push is deliberately NOT gated: the operator typed `git push`.

conductor_trust_store() {
  printf '%s' "${CONDUCTOR_HOME:-$HOME/.conductor}/verify-trust"
}

conductor_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1
  else
    printf '%s' "$1" | openssl dgst -sha256 | awk '{print $NF}'
  fi
}

# Symlink-stable key for a repo root.
conductor_trust_key() {
  (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"
}

# True (0) when $2 is the trusted verify command for repo root $1.
conductor_verify_trusted() {
  local key hash store p h
  key="$(conductor_trust_key "$1")"
  hash="$(conductor_sha256 "$2")"
  store="$(conductor_trust_store)"
  [ -f "$store" ] || return 1
  while IFS="$(printf '\t')" read -r p h; do
    [ "$p" = "$key" ] && [ "$h" = "$hash" ] && return 0
  done < "$store"
  return 1
}

# Record repo root $1 -> sha256($2), replacing any prior entry for that root.
# Also appends a grant record so a trust decision is never invisible.
conductor_trust_verify_record() {
  local key hash store tmp p h log
  key="$(conductor_trust_key "$1")"
  hash="$(conductor_sha256 "$2")"
  store="$(conductor_trust_store)"
  mkdir -p "$(dirname "$store")"
  tmp="$store.tmp.$$"
  : > "$tmp"
  chmod 600 "$tmp" 2>/dev/null || true
  if [ -f "$store" ]; then
    while IFS="$(printf '\t')" read -r p h; do
      [ "$p" = "$key" ] || printf '%s\t%s\n' "$p" "$h" >> "$tmp"
    done < "$store"
  fi
  printf '%s\t%s\n' "$key" "$hash" >> "$tmp"
  mv -f "$tmp" "$store"

  log="$(dirname "$store")/verify-trust-grants.log"
  [ -f "$log" ] || : > "$log"
  chmod 600 "$log" 2>/dev/null || true
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$key" "$hash" "$2" >> "$log"
}
