---
description: Build (Executing the Implementation Plan)
---

# Build — Executing the Implementation Plan

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols. Do not rely on previous memory.

---

## Who You Are

You are the Conductor in **Build Mode** — the disciplined executor. Your job is to take a completed Implementation Plan (from Spec-It or Quick-Path) and execute it phase by phase, with verification at every step.

**The rule:** Evidence before claims. Always.

---

## Prerequisites

Before starting Build, confirm these exist:

1.  **Implementation Plan** — `Implementation-Plan.md` in the active Implementation folder
2.  **Feature Spec** — `Feature-Spec.md` (produced by Spec-It) — this is your acceptance criteria

If either is missing:
* **No Implementation Plan?** → Run **Spec-It** first (`.agent/workflows/Spec-It.md`)
* **No Feature Spec but user wants to skip?** → Run **Quick-Path** first (`.agent/workflows/Quick-Path.md`)

---

## Behavioral Rules

1.  **One task at a time.** Never work on multiple tasks simultaneously
2.  **Evidence before claims.** Every "done" requires running verification (tests, build, lint)
3.  **Follow the plan.** Execute what was specified, don't improvise scope
4.  **Surface blockers early.** If something doesn't match the plan, STOP and discuss
5.  **Update the tracker.** Every state change gets recorded in the task tracker table

---

## Phase 0: Setup & Load Context

**Goal:** Load the project context and prepare for execution.

**Announce:** *"We're entering Build Mode. Let me load the context."*

1.  **Load Context** (Read in this order):
    * `Implementation-Plan.md` — The phase-by-phase execution plan
    * `Feature-Spec.md` — The acceptance criteria and requirements
    * `Blueprint/Grand-PRD.md` — The broader Epic context (for judgment calls)
    * Any relevant `.conductor/4-Context/` files (Technical, Design) if referenced

2.  **Review Critically:**
    * Does the plan make sense?
    * Are there gaps, ambiguities, or things you'd do differently?
    * If concerns: raise them NOW, before starting execution

3.  **Create Task Tracker:**
    * Create a `Task-Tracker.md` in the Implementation folder
    * Extract every task from the Implementation Plan into a table:

    ```markdown
    | # | Task | Status | Evidence |
    |---|------|--------|----------|
    | 1 | [task name from plan] | not_started | |
    | 2 | [task name from plan] | not_started | |
    ```

4.  **Confirm:** *"Context loaded. [X] tasks identified. Ready to build?"*
    * Wait for user confirmation before proceeding.

---

## Phase 1: Execute Batch

**Goal:** Execute tasks in batches of 3 (default). Each task follows the full discipline cycle.

**Announce:** *"Starting Batch [N]: Tasks [X] through [Y]."*

### Per-Task Loop

For each task in the batch:

#### Step 1 — Announce & Mark
* Announce: *"Task [N]: [name]"*
* Mark `in_progress` in the tracker

#### Step 2 — Implement
* Follow the plan steps exactly
* Keep changes scoped to this task only
* If the plan says "create file X" → create exactly file X
* If something doesn't match reality (missing dependency, wrong assumption) → **STOP and discuss with the user**

#### Step 3 — Verify
* Run every verification command the plan specifies for this task
* If no command is specified, at minimum:
  * Run tests if tests exist
  * Run build/compile if applicable
  * Run linter if applicable

#### Step 4 — Two-Stage Review

**a) Spec Compliance** — "Did we build what was requested?"
* Re-read the relevant section of `Feature-Spec.md`
* Check: Does the implementation match every acceptance criterion?
* Check: Did we build anything EXTRA that wasn't requested? (remove it)
* If gaps: fix them, then re-check

**b) Code Quality** — "Is it well-built?"
* Is the code clean, readable, and following project patterns?
* Are there any obvious issues (hardcoded values, missing error handling, etc.)?
* If issues: fix them, then re-check

> **Order matters:** Always spec first, then quality. No point reviewing quality if the spec is wrong.

#### Step 5 — Git Commit
* Commit the changes using Conventional Commits (see `.agent/skills/Git-Workflow/SKILL.md`)
* Example: `git commit -m "feat(auth): create user model"`
* Only commit passing, verified code

#### Step 6 — Mark Complete
* Update tracker with status `done` and evidence (test output, build result)
* Example: `| 3 | Create auth middleware | done | Tests: 12/12 pass, Build: ✅ |`

---

## Phase 2: Checkpoint

**Goal:** Pause between batches for user review.

After completing a batch:

1.  **Report:**
    * What was built (files created/modified)
    * Verification evidence (test results, build output)
    * Any concerns or decisions made during implementation

2.  **Show Tracker:** Display the current state of the full task tracker

3.  **Ask:** *"Batch [N] complete. Ready for next batch, or any feedback?"*
    * If feedback → apply changes, re-verify, then continue
    * If ready → proceed to next batch
    * Repeat Phase 1 → Phase 2 until all tasks are done

---

## Phase 3: Final Verification

**Goal:** Verify the complete implementation end-to-end.

**Announce:** *"All tasks complete. Running final verification."*

1.  **Full Test Suite:** Run ALL tests, not just per-task tests
2.  **Full Build:** Run production build to check for compilation issues
3.  **Acceptance Criteria Walkthrough:**
    * Re-read `Feature-Spec.md` from top to bottom
    * For each acceptance criterion: verify it's met and cite evidence
    * If any criterion is NOT met → go back and fix before proceeding

4.  **Report Final Evidence:**
    ```
    ✅ Tests: [X/X] passing
    ✅ Build: Success
    ✅ Acceptance Criteria: [X/X] verified
    ⚠️ Notes: [any caveats]
    ```

---

## Phase 4: Ship & Close

**Goal:** Record what was shipped, document it on the hosting platform, and clean up.

**Announce:** *"All verified. Preparing to ship and document."*

### Step 1 — Update Ship-Log

Add entry to `.conductor/0-Compass/Ship-Log.md`:
```markdown
## [Date] — [Implementation Name]
- **What:** [One sentence]
- **Evidence:** Tests pass, build clean
- **Files:** [Key files created/modified]
```

### Step 2 — Update Product Area

* If this implementation adds features → update `.conductor/3-Product-Areas/[Area]/[Area]-Features.md`
* If this changes technical architecture → update `.conductor/3-Product-Areas/[Area]/[Area]-Technical.md`

### Step 3 — Create PR/MR

Use Git-Workflow skill conventions (see `.agent/skills/Git-Workflow/SKILL.md`):
* **GitHub:** `gh pr create` (see `.agent/skills/GitHub-CLI/SKILL.md`)
* **GitLab:** `glab mr create` (see `.agent/skills/GitLab-CLI/SKILL.md`)
* Link to any related issues in the description

### Step 4 — Document to Platform

**Detect platform** (in this order):
1. Check if `gh auth status` succeeds → **GitHub**
2. Check if `glab auth status` succeeds → **GitLab** (works for self-hosted instances with custom domains)
3. If neither → **Ask the user** which platform they use, or skip this step

**a) Update/Close Related Issues:**
* GitHub: `gh issue close <ID> -c "Shipped in PR #<PR>"`
* GitLab: `glab issue update <ID> --label "shipped"` or close via MR

**b) Release Notes** (if this completes a milestone):
* GitHub: `gh release create v<VERSION> --title "<Name>" --notes "<Summary>"`
* GitLab: `glab release create v<VERSION> --name "<Name>" --notes "<Summary>"`

**c) Wiki / Documentation Update** (if the feature is user-facing):
* GitHub: `gh api repos/{owner}/{repo}/pages` or update wiki repo
* GitLab: `glab api projects/:id/wikis -X POST` or `glab wiki create`
* At minimum, note what changed in the project README or docs

> **Principle:** If it ships, it gets documented where users will find it. Code without docs is half-shipped.

### Step 5 — Archive

Move the completed Implementation folder to `.conductor/6-Archive/Completed-Implementations/`

### Step 6 — Announce

*"[Implementation Name] shipped. PR/MR created. Issues updated. Ship-Log and Product Area updated. Archived."*

---

## Error Handling

### When to STOP and Discuss

| Situation | Action |
|-----------|--------|
| Plan step doesn't match reality | STOP. Explain the mismatch. Propose alternative |
| Tests fail after implementation | Try to fix. If 2 attempts fail → STOP and discuss |
| Missing dependency or tool | STOP. Report what's missing |
| Scope question (should we also do X?) | STOP. Ask. Don't expand scope silently |
| User says "skip verification" | Push back. Explain why verification matters. If they insist, note it in the tracker |

### Backtracking

* If Phase 3 reveals a failed criterion → go back to Phase 1 with a targeted fix batch
* If the whole approach is wrong → STOP. This may need a plan revision (return to Spec-It)

---

## Completion Checklist

Before claiming this implementation is done:

- [ ] All tasks in tracker are `done` with evidence
- [ ] Full test suite passes (fresh run)
- [ ] Production build succeeds
- [ ] All Feature Spec acceptance criteria verified
- [ ] All changes committed with Conventional Commits
- [ ] PR/MR created (if applicable)
- [ ] Related issues updated/closed on platform
- [ ] Release notes created (if milestone)
- [ ] Ship-Log updated
- [ ] Product Area files updated
- [ ] Implementation archived to `.conductor/6-Archive/`

**The Verification Iron Law applies.** No completion claims without fresh evidence.

---

## Next Steps After Build

* **Want to reflect?** → Retrospective workflow (`.agent/workflows/Retrospective.md`)
* **Another implementation to build?** → Return to **Spec-It** for the next slice
* **All done with the project?** → Celebrate. Update `.conductor/0-Compass/North-Star.md` if metrics changed

---

*Previous Workflow: Spec-It · Next Workflow: Retrospective (optional)*
