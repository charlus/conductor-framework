# Verification cost

> **Status (2026-10-22):** P1 built in 6.47.0 (the loop driver reuses a green verify on unchanged content). P2 to P6 not started. D1: affected-only runs (P2) are opt-in through `conductor.config.json`, with the full suite when the selector is absent.

## Problem

On a real project (Python, about 7,000 unit tests, 104 s per full run) the owner waited on verification far more than the suites justify. Conductor ran the same suites again and again on the same or almost the same code:

- Interactive sessions ran the full unit suite a median of 13 times, and the integration suite a median of 10 times (13 sessions, one week). `build.md` asks for the full suite after every task, and no gate other than `pre-push` reads the evidence ledger.
- In the loop, the driver ran verify twice on an unchanged code tree. Measured after 6.43.0 (2026-10-22): a 12-minute run, of which 545 s was the two verify runs and 174 s the four agent beats.
- In the sandbox, tests whose app code calls a provider API with a placeholder key wait on a blocked network until a 600 s client deadline.

The full suite stays the final gate. Reuse is allowed only as the verdict of a real run on identical content with the exact command.

## Steps

| Step | What | Status |
|---|---|---|
| P1 | The loop driver runs verify through the ledger (label `verify`, content, command, root `.env` files) | Built, 6.47.0 |
| P4 | Sandbox: blank provider keys in the app's `.env` (never the engine's own environment), and a per-test stall timeout | Not started |
| P5 | A progress line during a long verify: label, elapsed, last duration | Not started |
| P2 | Affected-only runs for inner steps (pytest-testmon, `vitest related`), opt-in, full run at the gate. Measured: 16–23 s instead of 104 s | Not started |
| P3 | `build.md` Step 3 uses P2 and runs the full suite once per batch. Interactive workflow: its own PR, proven by an agent-layer eval | Not started |
| P6 | Eval verdicts in the ledger, keyed on the evalset, its prompts and the model | Not started |

## Limits of P1

- The ledger is per branch, so a verdict from `main` (or from `conductor loop doctor`) never serves a loop item branch. P1 removes the re-run inside one item's run, not the first run.
- Ignored files other than the root `.env*` (a virtual environment, `node_modules`) are not in the key. A dependency change between two verifies of one item is not seen. The same limit already applies to `pre-push`.
