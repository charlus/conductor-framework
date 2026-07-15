---
trigger: always_on
description: Red before green. No implementation code without a failing test first.
---

# Test-Driven Law

**RED BEFORE GREEN. NO IMPLEMENTATION CODE WITHOUT A FAILING TEST FIRST.**

This applies to every task in the Build workflow's per-task loop (`.agents/workflows/build.md`). For each increment of behavior:

1. **RED** — Write a test for the next increment. Run it. Confirm it fails, and fails for the expected reason. Do not write implementation code yet.
2. **GREEN** — Write the minimum code needed to make it pass. Run it. Confirm it passes.
3. **REFACTOR** — Clean up the code and test without changing behavior. Run the suite again to confirm it's still GREEN.

Full mechanics: `.agents/workflows/tdd-cycle.md`.

## The one exception

Some changes have no meaningful test surface — pure config, documentation, static copy, generated code. For these, and only these, skip the cycle — but say so explicitly in the task tracker (`no test: config-only change`), never silently. If you're unsure whether a change is testable, assume it is and write the test.

## Where this fits

TDD governs *how* code gets written, task by task. It's one of three layers — they don't overlap, and none replaces the others:

| Layer | When | Answers |
|---|---|---|
| `analyze-tests` skill | Before Build starts | What's the test strategy for the whole implementation? |
| **This law** | During Build, per task | Does this increment have a failing test before it has an implementation? |
| Ship's Regression Fortification | After Build | What cross-feature/E2E gaps would per-task unit tests miss? |

This is not a style preference, and it is not the `tdd-cycle` skill you invoke when you remember to. It is load-bearing, the same way the Verification Iron Law is: Build does not proceed past a task without it.

## Interactive vs. unattended

Interactively, **one mind runs the whole cycle** — the same agent writes the RED test and the GREEN code, learning from each increment. That tight loop is the default and is not changing.

In the **unattended swarm** (opt-in, L3 — see `.agents/workflows/unattended-loop.md`), the same law can be split across two fresh contexts: a **test-author** writes the failing tests (the contract), then a separate **implementer** makes them pass and is forbidden to touch the tests. RED-before-GREEN is identical; the split just makes reward-hacking structural — the agent that greens the code can't move the goalposts because it didn't write them. Use it when no human is watching; don't split the tight interactive loop, where the per-increment learning is worth more than the separation.
