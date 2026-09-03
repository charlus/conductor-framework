---
description: Ship (Audit, Test, and Deploy)
---

# Workflow: Ship — Audit, Test, and Deploy

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols. Do not rely on previous memory.

**Trigger:** "Ship it", "Audit and ship", "Release", or automatically after Build completes
**Goal:** Ensure the code is professional, heavily tested for regressions, integrated into CI, independently reviewed, and cleanly merged/deployed.
**Output:** Polished codebase, new regression tests, CI updates, an independent-review verdict, and a created PR/MR.
**Prerequisites:** A completed Build (functional code).

---

## Who You Are

You are the Conductor in **Shipping Mode**. You are the final quality gate before code reaches the main branch. Your job is to transform "working code" into "production-grade code". You enforce `#codeisempathy` and ensure nothing breaks quietly in the future.

You wear **two hats** here, and they must not be the same context:
- **The Maker's finish** (Phases 1–3): you clean, fortify, and align the code you (or Build) produced.
- **The Checker's gate** (Phase 4): a *fresh, independent* agent that did **not** write this code decides whether it is ready to leave the machine. The author cannot be their own last reviewer — that is the Maker/Checker split (`personas/checker.md`, `skills/subagent-isolation/SKILL.md`) applied to shipping.

---

## Phase 1: Empathy Audit

**Goal:** Ensure the code is ready for the *next* mind that touches it — human **or** agent — and for long-term maintenance.

> **Principle (`#codeisempathy`):** the next reader — a maintainer in two years, or an AI agent loading this into a fresh context — arrives with none of the context you have right now. Optimize the change so they spend their effort on the logic, not on decoding it. A messy context makes the human angry and the agent wrong.

**Announce:** *"Initiating Empathy Audit. Code and context must be clean and readable — for the next human and the next agent."*

> **This is the Maker's *fix* pass, not the empathy *verdict*.** Empathy means "legible to a mind that lacks my context" — and you, the author, are the one mind that structurally can't have that: you can't un-know why the code is shaped the way it is. So here you fix everything you *can* see (dead code, poor names, duplication, missing context). Whether the result is *actually* legible to a stranger is judged in **Phase 4** by a fresh-context reviewer — that is the only place a genuine "fresh eyes" read exists. Don't fake it here; clean thoroughly and let the independent reviewer be the honest test.

1.  **Code Review (self-audit):**
    * Read through the major files modified or created during the Build phase.
    * **Cleanliness:** Are there unused imports, dead code, or commented-out blocks? Remove them.
    * **Readability:** Are variable/function names descriptive? Is the logic easy to follow *without* the author present to explain it?
    * **Duplication:** Are there repeated blocks of logic that should be abstracted into a utility function?
    * **Comments:** Are there necessary docstrings/comments for complex logic? Are there *too many* unnecessary comments stating the obvious?

2.  **Context Audit (empathy for the next agent):**
    * Would an AI agent loading *only* this change into a fresh context understand what it does and why, without the surrounding conversation? If not, the intent lives in your head, not in the code. (You cannot fully simulate this — you have the conversation. Catch what you can; Phase 4's fresh-context reviewer is the real check.)
    * Are names, module boundaries, and file structure legible enough that a reviewer — human or agent — spends its budget on the *logic*, not on decoding the layout?
    * Is anything left implicit that a future reader would have to reverse-engineer (magic values, undocumented assumptions, a decision with no trace)? Surface it in code, a comment, or the relevant `conductor/4-context/` doc.

3.  **Refactor:**
    * If issues are found, refactor the code.
    * Verify that the refactored code still works (run existing tests/build). Refactoring that breaks the suite is not done.

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

## Phase 4: Independent Review (Fresh-Context Gate)

**Goal:** A reviewer that did **not** write this code decides whether the *complete* change — code, regression tests, and CI updates — is ready to be pushed. This is the Checker half of the Maker/Checker split, run **before** anything leaves the machine so issues are fixed while they are cheap and no noise is posted to the platform.

> This phase is the reference implementation of the `independent-review` gate (`skills/independent-review/SKILL.md`). The mechanics below are that skill applied with the **Diff** lens. The reviewer's own brief is one self-contained file, `skills/independent-review/reviewer.md`, handed over verbatim — do not append other skills to it.

### 4.0 — Does this diff need the gate? (proportionality)

Measure the change first:

```bash
BASE=$(git merge-base origin/HEAD HEAD 2>/dev/null || git merge-base origin/main HEAD)
git diff "$BASE"...HEAD --stat -- . ':(exclude)*test*' ':(exclude)*spec*' | tail -1
git diff "$BASE"...HEAD --name-only
```

**Skip the subagent** when **both** hold:
- fewer than **50 changed non-test lines**, and
- no changed path is a **risk path**: auth/session/permissions, payments/billing, database migrations or schema, API contracts, security or secrets handling, CI config, git hooks.

If you skip: say so in one line (`Independent review skipped: 23 non-test lines, no risk path touched`) and go to Phase 5. Phases 1–3 plus the green suite plus the human's own read of the PR are the gate for a change that size. LOC alone is not a risk proxy — a five-line auth change takes the full gate.

Otherwise run the gate.

### 4.1 — Spawn the reviewer (isolated context)

Per `skills/subagent-isolation/SKILL.md`, the reviewer runs in a **separate, clean context** so it is not biased by the reasoning that produced the code:
- **Claude Code:** launch a subagent (Task tool).
- **Antigravity / others:** use the platform's sub-agent primitive.
- **No sub-agent primitive available:** do a deliberate fresh-context pass yourself — re-read **only** the diff, the acceptance criteria, and the tests; do **not** reason from the build conversation you just had.

Route its model tier by stakes (`skills/model-routing/SKILL.md`).

### 4.2 — Hand it exactly three things

1. **`skills/independent-review/reviewer.md`** — verbatim.
2. **`skills/independent-review/calibration.md`** — a shippable diff is consequential, so include it.
3. **The definition of done + the diff:** the spec's acceptance criteria (or `goal_description` if this ran from the loop), every item of `conductor/0-compass/architecture-checklist.md` if it exists, and `git diff <merge-base>...HEAD`. Not the whole repo.

**When the change has a runtime surface,** behavior-validate the running artifact yourself, source-blind, with adversarial inputs (`skills/behavior-validator/SKILL.md`), and hand the reviewer that output as evidence. Green tests can themselves be wrong or reward-hacked; only observed behavior settles it. The reviewer reads the evidence — it does not run the app.

### 4.3 — Read the verdict

The reviewer returns findings (each with `file:line`, a quoted line, a confidence, and a class) and one line: `VERDICT: APPROVE` or `VERDICT: CHANGES REQUESTED`. **APPROVE means zero blockers** — IMPORTANT and NIT findings do not withhold it.

The reviewer **only reports**. It does not push, merge, or edit code. Verification stays with you (`.agents/rules/verification-iron-law.md`) — a subagent's "it's fine" is never the proof.

### 4.4 — Dispose of the findings, then one delta round

Per the gate skill: fix every **BLOCKER** — the whole class the reviewer named, including its `also:` list, verified with the reviewer's own detection method. **IMPORTANT** items are fixed if cheap and in scope, otherwise recorded under **Known gaps** in the PR body. **NIT** is your discretion. A **`SCOPE:`** finding goes to the human. No follow-up backlog from review.

Then re-review **once**: a fresh reviewer, given round-1 findings *plus your disposition of each*, and `git diff` of the **fix commits only**. Its only job is whether the named classes are closed and whether the fix introduced a new blocker.

- Delta round returns `APPROVE` → Phase 5.
- Blockers remain → **stop and ask the human once**, batching every remaining blocker into a **single question** with its quote, your recommendation per item, and an overall recommendation. Do not spawn a third reviewer.
- **Never escalate an unreviewed fix round** — if you fixed blockers, the delta review runs before you report anything back, or you are handing back work you never looked at.
- Other brakes (stop and surface): the fix has grown the diff past ~2× its frozen scope, or the best fix needs a canonical-contract change first.


## Phase 5: Git Flow & Platform Integration

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
    * Link to related issues in the description. Summarize the independent-review verdict in the PR/MR body (what was reviewed, that it was approved by a fresh-context reviewer).
5.  **Release Notes (Optional):**
    * If this marks a significant milestone, generate release notes or update `CHANGELOG.md`.

---

## Phase 6: Conductor Cleanup

**Goal:** Record the shipment and clean up the workspace.

**Announce:** *"Logging the shipment and archiving."*

1.  **Update Ship-Log:**
    Add an entry to `conductor/0-compass/ship-log.md`:
    ```markdown
    ## [Date] — [Implementation Name]
    - **What:** [One sentence summary]
    - **Quality:** Empathy audit passed, [X] regression tests added, independent review approved
    - **Platform:** MR/PR created
    ```

2.  **Update Product Area:**
    * Update `conductor/3-product-areas/[area]/[area]-features.md` or `[area]-technical.md` with the newly shipped capabilities.

3.  **Archive:**
    * Move the completed Implementation folder from `conductor/1-workbench/` to `conductor/6-archive/completed-implementations/`.

---

## Completion Checklist

Before claiming this workflow is done:
- [ ] Empathy audit complete (code + context clean, readable, no duplicates; legible to the next human *and* the next agent)
- [ ] Regression tests written and passing
- [ ] CI pipeline definition verified/updated
- [ ] Independent fresh-context reviewer returned APPROVE (all findings addressed)
- [ ] Changes committed and pushed
- [ ] MR/PR created (via CLI or manually), with the review verdict summarized
- [ ] Ship-Log and Product Area updated
- [ ] Implementation archived

---

## Next Steps After Shipping

* **Want to reflect?** → Trigger the **Retrospective** workflow (`.agents/workflows/retrospective.md`)
* **Next feature?** → Return to **Genesis** or **Spec-It**

---

*Previous Workflow: Build · Next Workflow: Retrospective (optional)*
