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

## Escape hatches (never silent)

Determinism can over-block legitimate config/doc work, so every gate has a logged bypass:

```bash
CONDUCTOR_NO_TEST="config-only change"  git commit …    # TDD hook
CONDUCTOR_SKIP_VERIFY="hotfix, tests offline" git push … # verify hook
CONDUCTOR_HOOKS=off git commit …                         # disable all Conductor hooks
```

`CONDUCTOR_NO_TEST` / `CONDUCTOR_SKIP_VERIFY` reasons are appended to `conductor/0-compass/ship-log.md` so bypasses stay auditable. Prefer these over `git commit --no-verify`, which silently skips *every* hook and leaves no trail.

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
