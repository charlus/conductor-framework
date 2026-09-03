# Loop Dead-Beat & Session-Limit Robustness (P3)

> **Status:** shipped (2026-07-27), branch `fix/loop-deadbeat-robustness`. Motivated by the
> second multi-hour live `conductor loop` run (JuRaph, L3), which hit the Claude subscription's
> **session limit** and then burned **47 of 60 beats doing nothing** before stopping with the
> wrong terminal status. Continues `Loop-Robustness-Plan.md` — the same "the fully-stubbed
> test suite is blind to the adapter layer; only a live run exposes these" theme.
>
> **Shipped:** three driver/miner fixes (A, B, C below), each red→green behaviour-tested
> through the real state machine. **Deferred:** a real token budget (D). **Zero `templates/`
> changes** — the interactive path is untouched.

## The incident (verified against source, not just the auto-report)

A live L3 run drove 13 productive beats (4.5h) and then the Claude account hit
`You've hit your session limit`. From that point every beat was a 3–7s no-op that only
printed the limit banner — **no tool calls** — yet the loop kept spending beats until the
iteration ceiling (60), stopping as `max_iterations_exceeded`. No work was lost (the branch
held 22 commits, verify green), but ~4.5h of clock and 47 beats were wasted, and the stop
reason misrepresented an external outage as "ran too long."

The auto-generated `loop-improvements.md` then **misdiagnosed** it: it counted 47
`checker rejected: no verdict file` lines and proposed a *content* rule for a *missing
acceptance criterion* — when in fact the Checker never ran. A human caught it; the miner
should have.

Two guardrails were structurally neutralized, plus one miner defect:

| # | Defect | Root cause |
|---|---|---|
| A | Dead beats invisible | Driver read only `result.tokens`, discarding the CLI's exitCode/stdout/stderr ([driver.js](../../src/loop/driver.js) maker branch). A `claude -p` that printed the limit banner in 3s looked like a successful beat. |
| B | Stall detector decorative | The verify-output hash fed the beat-progress hash; vitest/jest/vite print a changing `Duration`/`Start at`/`built in` line every run, rotating the hash every beat → `stall.consecutive` reset to 0 forever → `MAX_CONSECUTIVE_STALLS` never fired. Affects nearly every project. |
| C | Miner conflated outage with rejection | `loop.js` flattened both `parseCheckerVerdict` outcomes ("no verdict file" vs "did not approve") into one `checker rejected:` audit line; `improver.js` then clustered the outage as a `checker-rejection` content pattern. |

## Fixes

### A — dead-beat / usage-limit detection (`src/loop/driver.js`)
- New terminal status `usage_limit_reached` in `TERMINAL_STATUSES`.
- `USAGE_LIMIT_PATTERNS` (specific, anchored to "hit your … limit" so ordinary output that
  merely mentions a limit does not false-trip) + pure `classifyBeatResult(result)` → checks
  stdout **and** stderr, returns `{ dead, kind:"usage_limit", resetHint }`.
- Maker branch: on a dead beat, **refund** the iteration (it did no work), set
  `usage_limit_reached`, write the reset time to the inbox, audit, stop. A non-zero CLI exit
  that isn't a usage limit is logged/audited for diagnosis (repetition is bounded by the now-working stall detector), not given its own terminal state.
- No adapter change: `adapters/claude.js` already returns `{exitCode, stdout, stderr}`.

**Acceptance:** first beat returns the session-limit banner → run stops `usage_limit_reached`,
`iterations.current` not inflated, reset time in the inbox. (`test/loop-driver.test.js` (k) + pure test.)

### B — deterministic stall hash (`src/loop/driver.js`)
- Pure `normalizeVerifyOutput(output)`: strips ANSI + runner timing/timestamp tokens
  (`Start at`, `Duration`, `built in`, `Time:`, bare `Nms`/`N s`, `HH:MM:SS`) before hashing.
  A genuine change (a test flips red) still alters the normalized text.
- Verify hashing uses `hashString(normalizeVerifyOutput(output))`.
- Fixes every project centrally — obviates per-project verify massaging (the report's "fix D").

**Acceptance:** frozen git HEAD + a `Duration` line that changes every beat → stall fires
within `MAX_CONSECUTIVE_STALLS` (was: ran to the iteration ceiling). (`test/loop-driver.test.js` (j) + pure test.)

### C — miner: outage ≠ rejection (`checker.js` + `loop.js` + `improver.js`)
- `checker.js`: pure `isInfraReason(reason)` (matches the two non-substantive
  `parseCheckerVerdict` outcomes: "no verdict file", "not valid json").
- `loop.js`: when every checker vote's reason is infra, audit `checker infra-failure:` instead
  of `checker rejected:`.
- `improver.js`: new `checker-infra` signal kind (matched before `checker-rejection`) with a
  suggestion that explicitly says *this is an outage — do NOT write a content rule; investigate
  the driver/adapter/CLI.*

**Acceptance:** `checker infra-failure: …` classifies as `checker-infra`, never
`checker-rejection`; the rendered proposal steers away from a content rule.
(`test/loop-improver.test.js` + `test/loop-phase3.test.js` `isInfraReason` cases.)

## D — token budget (DEFERRED, documented)

The incident was token exhaustion, and Conductor is structurally blind to token consumption:
`adapters/claude.js` hardcodes `tokens: 0`, so `budget.tokens_spent` is always 0, and the
driver has **no** token-budget guard anyway (only iteration + wall-clock ceilings). The correct
fix for *this* incident is a truthful terminal status (Fix A), not a token cap. A real budget
needs reliable per-beat usage accounting (parse `claude -p --output-format json`) and a policy
decision (cap vs. warn; per-run vs. per-account). Deferred as a follow-up; tracked here so the
dead `tokens: 0` / unused `tokens_spent` isn't mistaken for a working budget.

## Verification

- `npm run test:unit && npm test && npm run test:smoke && npm run test:hooks` — all green.
- Interactive-path invariant: `git diff --name-only master..HEAD -- templates/.agents/workflows/ | grep -v unattended-loop` → empty.
- **Live (Operating Truth #1):** a disposable target with a no-committing maker + a verify command
  that prints a timestamp halts `stalled` in ~4 beats (was: ran to the ceiling). A *real* session
  limit can't be forced on demand, so Fix A is proven by the behaviour test through the real state
  machine — stated honestly rather than claimed as a live usage-limit run.
