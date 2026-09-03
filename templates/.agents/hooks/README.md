# Conductor Enforcement Hooks

> **Why this exists:** the field consensus (Anthropic, Böckeler, Huntley, obra) is blunt — *prose rules are advisory; only code enforces.* Conductor's two headline laws were prose-only. These hooks make them **deterministic** at the git boundary, so they hold even when an agent ignores the prose. See `docs/adr/0001-enforcement-and-autonomy-rebalance.md` (D1). The prose rules stay as the guidance layer; these are the backstop.

## What's here

| Hook | Law | When it fires | Blocks when… |
|---|---|---|---|
| `pre-commit` | **Test-Driven Law** | `git commit` | implementation code is staged with no test change |
| `pre-commit` | **Eval-Driven Law** | `git commit` | code that calls an LLM provider is staged with no eval alongside (waiver: `CONDUCTOR_NO_EVAL="reason"`). See `skills/writing-evals/`. The two gates are independent — waiving one never skips the other. |
| `pre-push` | **Verification Iron Law** | `git push` | the configured verification command exits non-zero |
| `verification-stop-hook.sh` | Verification Iron Law (interactive) | Claude Code `Stop` | **opt-in** — code changed since HEAD and verify is red |
| `lib.sh` | — | sourced by the others | shared helpers |

## Enabling the git hooks

Automatic during `conductor init` / `conductor upgrade` when the target is a git repo (they point `core.hooksPath` at this directory). To (re)install or repair manually:

```bash
conductor install-hooks           # sets core.hooksPath → .agents/hooks
conductor install-hooks --uninstall
```

If you already use a custom `core.hooksPath`, install-hooks won't override it — wire these in yourself.

## Configuring verification

`pre-push` (and the optional Stop hook) run your **verification command**, resolved in this order:

1. `"verify"` in `conductor.config.json` — e.g. `"verify": "npm test && npm run lint"`
2. `npm test`, if `package.json` defines a `test` script
3. nothing → the push hook prints a notice and allows the push

Set it explicitly for real enforcement:

```json
{ "verify": "npm test" }
```

## Configuring evals (Eval-Driven Law run-gate)

If the repo has evalsets (an `evals/` file or `*.eval.*`), `pre-push` also runs your **eval command** — presence is gated at commit, *passing* is gated here. Resolved in this order:

1. `"eval"` in `conductor.config.json` — e.g. `"eval": "npm run eval"`
2. `npm run eval`, if `package.json` defines an `eval` script
3. nothing → the push hook notes that evalsets exist but no command is set, and allows the push (a gap to close, not a hard block)

```json
{ "verify": "npm test", "eval": "npm run eval" }
```

Non-LLM projects (no eval files) never see this gate.

## Escape hatches (never silent)

Determinism can over-block legitimate config/doc work, so every gate has a logged bypass:

```bash
CONDUCTOR_NO_TEST="config-only change"  git commit …    # TDD gate (pre-commit)
CONDUCTOR_NO_EVAL="stub, no eval surface" git commit …   # Eval presence gate (pre-commit)
CONDUCTOR_SKIP_VERIFY="hotfix, tests offline" git push … # verify gate (pre-push)
CONDUCTOR_SKIP_EVAL="eval infra down" git push …         # Eval run-gate (pre-push)
CONDUCTOR_HOOKS=off git commit …                         # disable all Conductor hooks
```

All four reasons are appended to `conductor/0-compass/ship-log.md` so bypasses stay auditable. Prefer these over `git commit --no-verify`, which silently skips *every* hook and leaves no trail.

## Optional: interactive Verification hook (Claude Code)

Off by default. To make Claude Code refuse to end a session "done" while your code is red, add to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.agents/hooks/verification-stop-hook.sh" } ] }
    ]
  }
}
```

It only engages when tracked implementation files differ from HEAD, so it won't nag on doc-only or exploratory sessions. Disable anytime with `CONDUCTOR_HOOKS=off` or by removing the entry.

### The stop hook needs your consent once

Hooks **bypass the permission system** — nothing prompts before this one runs your verification command. That command is read from a file *inside the repo* (`conductor.config.json` → `verify`, else the `test` npm script), so a cloned, forked, or contributed repo could name anything. The gate therefore stays inactive until you have read the command and recorded it:

```bash
conductor trust-verify            # shows the command, then records consent
conductor trust-verify --list     # what is trusted, on this machine
conductor trust-verify --revoke   # withdraw it for this repo
```

Trust is keyed on `realpath(repo root)` + `sha256(command)`, stored `0600` at `${CONDUCTOR_HOME:-~/.conductor}/verify-trust`, and every grant is appended to `verify-trust-grants.log`. **Edit the command and it must be trusted again.** Until then the stop hook allows the session to end with a one-line note, and never executes the command.

`pre-commit` and `pre-push` are deliberately *not* gated this way: there you typed `git commit` / `git push`, so a human action is already in the chain.

**Bounded re-entry.** Claude Code re-runs `Stop` hooks after a block. A re-entry is not a free pass — the check re-runs, so a red suite cannot be cleared by stopping again — but it is bounded at 3 blocks per episode, after which the hook allows the session to end with a loud `UNVERIFIED` warning rather than trapping it on a permanently broken check. A green run resets the counter.
