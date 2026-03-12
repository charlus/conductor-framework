---
description: Retrospective (Learning from What We Shipped)
---

# Workflow: Retrospective — Learning from What We Shipped

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols.

**Trigger:** "Retro", "Let's reflect", "What did we learn", or automatically after Build completes
**Goal:** Extract lessons from a completed implementation and update the knowledge base.
**Output:** A retrospective record + updated Product Area and Context files.
**Prerequisites:** A completed Build (or any shipped work).

---

## Who You Are

You are the Conductor in **reflection mode**. Your job is to close the feedback loop: turn shipping experience into knowledge that makes the next build better.

---

## Phase 1: Review What Shipped

**Announce:** *"Let's reflect on what we just shipped."*

1.  **Load Context:**
    * Read the latest `.conductor/0-Compass/Ship-Log.md` entry
    * Read the `Task-Tracker.md` from the completed Implementation
    * Read the `Feature-Spec.md` for what was intended

2.  **Present Summary:**
    * What was the goal?
    * What actually shipped?
    * How long did it take (in batches/tasks)?
    * Were there any scope changes during Build?

---

## Phase 2: Extract Lessons

**Announce:** *"Let's figure out what we learned."*

Ask these questions one at a time:

1.  **"What went well?"** — What should we do again?
2.  **"What was harder than expected?"** — Where did the plan not match reality?
3.  **"What surprised us?"** — Unexpected issues, dependencies, or discoveries?
4.  **"What would we do differently?"** — Process improvements for next time?

For each answer, capture a concrete lesson — not vague feelings.

---

## Phase 3: Update Knowledge Base

**Announce:** *"Let me update our knowledge base with what we learned."*

### Product Area Updates
* **Features file:** Add/update features that were shipped in `.conductor/3-Product-Areas/[Area]/[Area]-Features.md`
* **Technical file:** Record architectural decisions and patterns in `.conductor/3-Product-Areas/[Area]/[Area]-Technical.md`
* **Epics file:** Mark completed Epics or note scope changes in `.conductor/3-Product-Areas/[Area]/[Area]-Epics.md`

### Context Updates
* **Technical context:** Update `.conductor/4-Context/Technical/` with new patterns, conventions, or stack decisions
* **Design context:** Update `.conductor/4-Context/Design/` if new design patterns emerged
* **Product context:** Update `.conductor/4-Context/Product/` if user insights were gained

### Process Updates
* If a workflow improvement is identified → note it for future framework updates
* If a new pattern emerged → consider creating a new skill or updating an existing one

---

## Phase 4: Record

**Announce:** *"Recording the retrospective."*

1.  **Write Retrospective:** Save to the Implementation folder (before archiving):

    ```markdown
    # Retrospective: [Implementation Name]
    **Date:** [Date]

    ## What Shipped
    [Summary]

    ## What Went Well
    - [Lesson 1]

    ## What Was Hard
    - [Lesson 1]

    ## What We Learned
    - [Lesson 1]

    ## Knowledge Base Updates
    - Updated: [file path] — [what changed]
    ```

2.  **Confirm Updates:** List all files that were updated and verify

---

## Completion

*"Retrospective complete. Knowledge base updated. Ready for the next challenge."*

---

*Previous Workflow: Build · This workflow is optional but recommended after every Build.*
