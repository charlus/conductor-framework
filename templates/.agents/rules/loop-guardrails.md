---
trigger: manual
description: "Loop-scoped safety limits (iteration ceiling, anti-stall, evidence rule). Loaded by the unattended-loop workflow — NOT always-on. Interactive sessions don't pay for it."
---

# Loop Guardrails (Strict Unattended Limits)

> **Loop-scoped, not always-on** (ADR-0001 D2). These constraints only apply during headless, loop-driven runs; the `unattended-loop` workflow loads this file explicitly at Step 0. The host runner (`scripts/run-conductor-loop.js`) is the deterministic backstop for the same limits — this prose is the agent-facing guidance layer.

When running in an unattended, loop-driven environment, you MUST adhere to the following safety constraints to prevent context pollution, repetition, and budget wastage.

## 1. The Iteration Ceiling
* On every iteration (beat), check `conductor/1-workbench/loop-state.json`.
* If `iterations.current` equals or exceeds `iterations.max_allowed`, you MUST immediately write a failure report to `conductor/1-workbench/inbox.md`, set `status` to `max_iterations_exceeded` in `loop-state.json`, and terminate execution.

## 2. The No-Progress Law (Anti-Stall)
* Compare your planned action and arguments with the `telemetry.last_tool_invoked` and `telemetry.last_tool_arguments` in `loop-state.json`.
* If you are invoking the **same tool with identical arguments** (or performing a functionally identical action) as the previous turn without a change in file structure or test output:
  1. Increment `telemetry.consecutive_stalls` by 1.
  2. If `consecutive_stalls` reaches **3**, write a detailed summary of the block to `conductor/1-workbench/inbox.md`, set `status` to `stalled`, and terminate execution to escalate to a human.
* If progress is made, reset `telemetry.consecutive_stalls` to **0**.

## 3. The Evidence Rule (Anti-Hallucination)
* You MUST NOT self-verify success based on your own assertions or internal model confidence.
* Success is defined exclusively by objective, tool-based evidence (passing test execution outputs, successful linters, compilations).
* If objective evidence is missing, you MUST treat the step as failed.
