---
name: TDD-Cycle
description: "Use during execution to enforce the strict RED → GREEN → REFACTOR test-driven development loop."
---

# TDD Cycle (RED → GREEN → REFACTOR)

This workflow enforces the strict Test-Driven Development (TDD) cycle for all feature implementations.

## The Loop

1. **RED Phase**: 
   - Write a failing test for the next increment of functionality based on the specification.
   - Run the test and explicitly verify that it fails for the expected reason. Do not write implementation code yet.

2. **GREEN Phase**:
   - Write the *minimum* amount of code necessary to make the failing test pass.
   - Run the test and explicitly verify that it passes.

3. **REFACTOR Phase**:
   - Review the newly written code and test for quality, readability, and adherence to clean code standards.
   - Refactor without changing behavior.
   - Run the test suite again to ensure it remains GREEN.

## Rules

- **Never skip the RED phase.** You must prove the test can fail before making it pass.
- **Micro-commits**: Consider committing or using `using-git-worktrees` after a successful GREEN or REFACTOR phase.
- **Traceability**: If this code fulfills a specific requirement from `conductor/2-backlog/task-backlog.md`, ensure the commit message or the `trace.md` file references the exact task.
