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

# Append a waiver line to the ship-log so bypasses are auditable, never silent.
conductor_log_waiver() {
  local root="$1" kind="$2" reason="$3"
  local log="$root/conductor/0-compass/ship-log.md"
  [ -f "$log" ] || return 0
  printf -- '- [%s] Hook waiver (%s): %s\n' "$(date '+%Y-%m-%d %H:%M')" "$kind" "$reason" >> "$log"
}
