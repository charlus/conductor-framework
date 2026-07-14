---
description: Ship (Audit, Test, and Deploy)
---

# Workflow: Ship — Audit, Test, and Deploy

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols. Do not rely on previous memory.

**Trigger:** "Ship it", "Audit and ship", "Release", or automatically after Build completes
**Goal:** Ensure the code is professional, heavily tested for regressions, integrated into CI, and cleanly merged/deployed.
**Output:** Polished codebase, new regression tests, CI updates, and a created PR/MR.
**Prerequisites:** A completed Build (functional code).

---

## Who You Are

You are the Conductor in **Shipping Mode**. You are the final quality gate before code reaches the main branch. Your job is to transform "working code" into "production-grade code". You enforce `#codeisempathy` and ensure nothing breaks quietly in the future.

---

## Phase 1: Empathy Audit

**Goal:** Ensure the code is ready for human eyes and long-term maintenance.

**Announce:** *"Initiating Empathy Audit. Code must be clean and readable."*

1.  **Code Review:**
    * Read through the major files modified or created during the Build phase.
    * **Cleanliness:** Are there unused imports, dead code, or commented-out blocks? Remove them.
    * **Readability:** Are variable/function names descriptive? Is the logic easy to follow?
    * **Duplication:** Are there repeated blocks of logic that should be abstracted into a utility function?
    * **Comments:** Are there necessary docstrings/comments for complex logic? Are there *too many* unnecessary comments stating the obvious?

2.  **Refactor:**
    * If issues are found, refactor the code.
    * Verify that the refactored code still works (run existing tests/build).

---

## Phase 2: Regression Fortification

**Goal:** Lock in the value just built so it cannot be quietly broken in the future.

This is not a repeat of Build's per-task TDD (`.agents/rules/test-driven-law.md`) — those tests already cover each task's unit-level behavior. This phase covers what per-task tests structurally can't: cross-feature interactions, end-to-end flows, and edge cases that only became visible once the whole implementation was assembled.

**Announce:** *"Fortifying with regression tests."*

1.  **Identify the Gap:** Re-read the task tracker's test coverage. What critical paths span *multiple* tasks, or touch other features, that no single task's tests exercised?
2.  **Choose Framework:** Identify the testing framework used in this stack (e.g., `pytest` for Python, `jest`/`vitest` for JS/TS, `go test` for Go).
3.  **Write Tests:**
    * Write targeted regression/integration/E2E tests for the gaps identified above — not a duplicate of what Build already wrote.
    * Ensure edge cases and success paths are covered.
4.  **Verify Tests:**
    * Run the new tests. Ensure they pass.
    * *(Optional)* Temporarily break the code intentionally to verify the test actually catches the failure, then revert.

---

## Phase 3: CI Pipeline Alignment

**Goal:** Ensure the machines enforce these tests automatically.

**Announce:** *"Checking CI pipeline alignment."*

1.  **Review CI Definitions:**
    * Check files like `.gitlab-ci.yml`, `.github/workflows/*.yml`, etc.
2.  **Verify Test Execution:**
    * Ensure that the command used to run the newly created regression tests is included in the CI test stage.
3.  **Update if Necessary:**
    * If the tests require a new environment variable, a new service (like a database), or a modified command, update the CI definition file.
    * If no changes are needed, explicitly confirm that the current CI pipeline will catch these tests.

---

## Phase 4: Git Flow & Platform Integration

**Goal:** Commit, push, and create the merge/pull request following standard Git Flow based on available tools.

**Announce:** *"Integrating with Git and creating the release."*

1.  **Platform Discovery:**
    * Before creating a Pull Request (PR) or Merge Request (MR), determine the current platform and available CLI tools.
    * Check if `gh` (GitHub CLI) or `glab` (GitLab CLI) is installed and authenticated (`gh auth status` or `glab auth status`).
    * If neither is available, fallback to standard Git operations and instruct the user to create the PR/MR manually via the web UI.
2.  **Commit:**
    * Stage all changes (refactors, tests, CI updates).
    * Commit using Conventional Commits (e.g., `chore: empathy audit and regression tests for [feature]`).
3.  **Push:**
    * Push the branch to the remote repository.
    * **On merge/rebase conflicts:** don't `--abort` reflexively. For each conflicting hunk, recover *intent* from primary sources (the commit messages, PR/MR, linked issues) on both sides, then resolve preserving both where possible; where incompatible, keep the side matching this ship's goal and note the trade-off. Re-run the project's checks (typecheck → tests → format) before finishing the merge.
4.  **Create MR/PR:**
    * If `glab` is available and authenticated: Use `glab mr create`.
    * If `gh` is available and authenticated: Use `gh pr create`.
    * If no CLI tool is available, provide the URL to the user to open the PR/MR manually.
    * Link to related issues in the description.
5.  **Release Notes (Optional):**
    * If this marks a significant milestone, generate release notes or update `CHANGELOG.md`.

---

## Phase 5: Conductor Cleanup

**Goal:** Record the shipment and clean up the workspace.

**Announce:** *"Logging the shipment and archiving."*

1.  **Update Ship-Log:**
    Add an entry to `conductor/0-compass/ship-log.md`:
    ```markdown
    ## [Date] — [Implementation Name]
    - **What:** [One sentence summary]
    - **Quality:** Empathy audit passed, [X] regression tests added
    - **Platform:** MR/PR created
    ```

2.  **Update Product Area:**
    * Update `conductor/3-product-areas/[area]/[area]-features.md` or `[area]-technical.md` with the newly shipped capabilities.

3.  **Archive:**
    * Move the completed Implementation folder from `conductor/1-workbench/` to `conductor/6-archive/completed-implementations/`.

---

## Completion Checklist

Before claiming this workflow is done:
- [ ] Empathy audit complete (code is clean, readable, no duplicates)
- [ ] Regression tests written and passing
- [ ] CI pipeline definition verified/updated
- [ ] Changes committed and pushed
- [ ] MR/PR created (via CLI or manually)
- [ ] Ship-Log and Product Area updated
- [ ] Implementation archived

---

## Next Steps After Shipping

* **Want to reflect?** → Trigger the **Retrospective** workflow (`.agents/workflows/retrospective.md`)
* **Next feature?** → Return to **Genesis** or **Spec-It**

---

*Previous Workflow: Build · Next Workflow: Retrospective (optional)*
