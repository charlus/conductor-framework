---
trigger: manual
description: "Loop-scoped safety limits (iteration ceiling, anti-stall, evidence rule). Loaded by the unattended-loop workflow — NOT always-on. Interactive sessions don't pay for it."
---

# Loop Guardrails (Strict Unattended Limits)

> **Loop-scoped, not always-on** (ADR-0001 D2). These constraints only apply during headless, loop-driven runs; the `unattended-loop` workflow loads this file explicitly at Step 0.
>
> **Who enforces these:** when the loop runs under the `conductor loop` driver, all three limits below are enforced **deterministically in code** (`src/loop/driver.js`) from state deltas the agent cannot fake — the driver is the authority, this prose is the soft guidance layer. When you run the loop *interactively* without the driver (e.g. native `/loop`), honor these yourself as guidance. Either way, the terminal-status vocabulary is: `completed` | `stalled` | `max_iterations_exceeded` | `budget_exceeded` | `halted_scoping` | `halted_no_verification`.

## 1. The Iteration Ceiling
* The driver increments `iterations.current` once per Maker beat and stops the loop with `status: max_iterations_exceeded` (writing `conductor/1-workbench/inbox.md`) once it reaches `iterations.max_allowed`. There is also a wall-clock budget (`budget.max_wall_clock_min`) that stops with `status: budget_exceeded`.
* **Do not increment the counter yourself.** Under the driver, doing so double-counts; interactively, simply stop when you reach the ceiling.

## 2. The No-Progress Law (Anti-Stall)
* Between beats the driver hashes **driver-observable state only** — the git HEAD plus the last verification output — and compares it to the previous beat.
* If nothing changed, it increments `stall.consecutive`; at **3** consecutive no-progress beats it stops with `status: stalled` and writes a summary to `conductor/1-workbench/inbox.md`. Any real progress resets the counter to `0`.
* (The V5 "compare your last tool + arguments" rule is retired: tool-level detail lives inside the agent and is not observable to the authority, so it can't be a deterministic signal. Just make real, verifiable progress each beat.)

## 3. The Evidence Rule (Anti-Hallucination)
* You MUST NOT self-verify success based on your own assertions or internal model confidence — your self-report is advisory only.
* Success is defined exclusively by objective, tool-based evidence. On `ready_for_check` the **driver itself** runs the resolved verification command and reads the exit code: non-zero **forces** `rejected_by_checker`; zero is necessary but not sufficient to pass.
* If no verification command can be resolved, the driver refuses to run and halts with `status: halted_no_verification` — it never claims success without a real signal.
