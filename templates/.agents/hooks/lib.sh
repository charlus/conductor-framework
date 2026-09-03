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
