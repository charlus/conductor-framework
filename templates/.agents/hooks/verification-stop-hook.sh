#!/usr/bin/env bash
# Conductor — Verification Iron Law for interactive Claude Code sessions (ADR-0001 D1,
# parallel track). Wire as a `Stop` hook in .claude/settings.json (see hooks/README.md).
# OPT-IN and OFF by default: interactive stop-gating can over-block, so you enable it
# deliberately. When enabled, it refuses to let the session end "done" while tracked
# source files differ from HEAD and the verification command is red.
#
# Claude Code passes hook JSON on stdin; exit 2 blocks the stop and feeds stderr back
# to the model. Any other non-zero is a non-blocking error shown to the user.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -z "$ROOT" ] && exit 0
# shellcheck source=/dev/null
. "$ROOT/.agents/hooks/lib.sh"

[ "${CONDUCTOR_HOOKS:-on}" = "off" ] && exit 0

# Only engage when implementation code actually changed since the last commit.
changed="$(cd "$ROOT" && git diff --name-only HEAD 2>/dev/null || true)"
touched_impl=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if conductor_is_impl_file "$f"; then touched_impl=1; break; fi
done <<< "$changed"
[ "$touched_impl" = "0" ] && exit 0

cmd="$(conductor_verify_cmd "$ROOT")"
[ -z "$cmd" ] && exit 0

if ( cd "$ROOT" && eval "$cmd" >/dev/null 2>&1 ); then
  exit 0
fi

echo "Verification Iron Law: you changed implementation code but the verification command (\`$cmd\`) is failing. Do not claim completion — run it, read the failure, and fix it before finishing." >&2
exit 2
