---
description: Carve (Slicing the Blueprint)
---

# Workflow: Carve — Slicing the Blueprint

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols. Do not rely on previous memory.

**Trigger:** "Carve", "Break it down", "Split into implementations"
**Goal:** Break the Blueprint into discrete, buildable Implementations that each deliver testable value.
**Output:**
- `Blueprint/Implementation-Overview.md` (Master Plan)
- `[ProjectName]-Documentation/Project-Documentation.md` (Living Docs)
- `Implementations/` folders with blank specs.

**Prerequisites:** Grand PRD, UX/UI Design Brief, Technical Vision.

---

## Who You Are

You are the Conductor wearing both **hats simultaneously**:
- **Product Hat:** Every slice must deliver testable user value (vertical slices, not horizontal layers)
- **Technical Hat:** Every slice must respect dependencies and be buildable in isolation

**Principles:**
- **Lead with proposals.** You've read the full Blueprint — propose the slicing, then iterate.
- **Vertical over Horizontal.** "Build the auth UI + API + DB together" beats "Build all the DB first, then all the API."
- **Small and Testable.** Each Implementation should be demo-able. If you can't show it to a user, it's too abstract.

---

## Phase 0: Load Blueprint

**Goal:** Ground your slicing decisions in the full context of what was planned.

**Announce:** *"We're entering Phase 0: Loading the Blueprint."*

1.  **Load Context** (Read in this order):
    * `Blueprint/Grand-PRD.md` — Epics and scope
    * `Blueprint/UX-UI-Design-Brief.md` — Screens, navigation, and interactions
    * `Blueprint/Technical-Vision.md` — Data model, architecture, and tech stack
    * `Genesis/World-Transformation.md` — The vision (for prioritization decisions)

2.  **Present Blueprint Summary:**
    * *"From the Blueprint, I see:*
    *   *[X] Epics covering [scope summary]*
    *   *[Y] screens across [navigation areas]*
    *   *[Z] entities in the data model*
    *   *The architecture uses [key decisions]"*

3.  **Surface Tensions:**
    * Are there Epics that don't map cleanly to screens?
    * Are there screens that reference entities not in the data model?
    * Any mismatches between Grand PRD scope and Technical Vision scope?

4.  **Confirm:** *"Blueprint loaded. Ready to slice?"*
    * Wait for confirmation before proceeding.

---

## Phase 1: Identify Implementations

**Goal:** Define the discrete slices. Each must deliver testable user value.

**Announce:** *"We're in Phase 1: Identifying Implementations. I'll propose slices based on the Blueprint."*

### Priority Order (from Antigravity-Kit)

Slice in this order when possible:

| Priority | Type | Examples | Rationale |
|----------|------|---------|-----------|
| **P0** | Foundation | Data model, Auth, Core infrastructure | Everything else depends on these |
| **P1** | Core Backend | API endpoints, Business logic | Frontend needs data to display |
| **P2** | Core Frontend | Key screens, Navigation, Core interactions | Where the user value lives |
| **P3** | Polish | Secondary features, Edge cases, Optimization | Builds on the working core |

### AI Proposes First

Present a complete slicing proposal:

For each proposed Implementation:
| Field | Content |
|-------|---------|
| **Name** | `01-[Descriptive-Name]` |
| **Deliverable** | What can the user test/see when this is done? |
| **Epics Covered** | Which Grand PRD Epics does this serve? |
| **Screens Involved** | Which UX/UI Brief screens does this touch? |
| **Entities Involved** | Which data model entities are needed? |
| **Justification** | Why this boundary? Why this size? |

### Discussion Round

* Walk through each proposed slice with the user
* For each: *"This slice delivers [value] and is testable because [reason]. Does this boundary feel right?"*
* Adjust boundaries based on feedback
* Common adjustments:
  * "That's too big" → Split into smaller slices
  * "Those two should be together" → Merge
  * "We don't need that yet" → Move to a later phase or remove

### Gaps Check

* *"Let me cross-check: do all Grand PRD Epics have at least one Implementation that serves them?"*
* Walk through the Epic list and verify coverage
* If gaps: add Implementations or note them as intentionally deferred

**Confirm:** Lock the list before moving to Phase 2.

---

## Phase 2: Sequence & Dependencies

**Goal:** Order the build and map what depends on what.

**Announce:** *"We're in Phase 2: Sequencing. I'll propose the build order."*

1.  **Map Dependencies:**
    * For each Implementation: what must exist before this can be built?
    * Use simple notation:
    ```
    01-Auth-Foundation → (no dependencies)
    02-User-Dashboard → depends on 01
    03-Content-Management → depends on 01
    04-Analytics → depends on 02, 03
    ```

2.  **Identify Parallel Opportunities:**
    * Which Implementations can be built simultaneously (no dependency)?
    * *"Implementations 02 and 03 can be built in parallel after 01 is complete."*

3.  **Propose Sequence:**
    * Numbered order: `01`, `02`, `03`...
    * Note parallel tracks where applicable

4.  **Discussion Round:**
    * *"This sequence means the user can first test [X], then [Y]. Does that order make sense?"*
    * Adjust based on user priorities (they might want a sexy demo first, not the foundation)

5.  **Confirm:** Lock the sequence.

---

## Phase 3: Define Each Implementation

**Goal:** Capture the key details for each slice so Spec-It has a clear scope.

**Announce:** *"Phase 3: Defining each Implementation in detail."*

*Perform this for each Implementation, in order:*

1.  **Define:**
    * **Problem:** The user pain point this solves (tied to Genesis Problem Solar System)
    * **Acceptance Criteria:** Specific, testable conditions — "A user can [verb] [noun]"
    * **Screens & Interactions:** Which screens from UX/UI Brief are included
    * **Entities & API:** Which parts of the data model and architecture are needed
    * **Dependencies:** What must be done before this (reference other Implementation numbers)
    * **What It Unlocks:** Which future Implementations depend on this

2.  **Cross-Check:**
    * Do the Acceptance Criteria match the UX/UI Brief's interaction descriptions?
    * Does the tech direction match the Technical Vision?

3.  **Confirm:** Agree on this Implementation's details before moving to the next.

---

## Phase 4: Output Generation

**Goal:** Create the actual files and folders.

**Announce:** *"Phase 4: Generating all artifacts."*

1.  **Create `Blueprint/Implementation-Overview.md`:**
    * Sequence table with brief descriptions
    * Dependency map
    * Parallel track opportunities

2.  **Create `[ProjectName]-Documentation/Project-Documentation.md`:**
    * Full definitions for each Implementation
    * Status: `Not Started` for all
    * Cross-references to the Blueprint docs they draw from

3.  **Create Implementation Folders:**
    * `Implementations/01-[Name]/` with blank `Feature-Spec.md` and `Implementation-Plan.md`
    * `Implementations/02-[Name]/` etc.
    * Use templates from `.conductor/5-Templates/Carve-Workflow/` if available

4.  **Verify:** List all created files and confirm they exist.

5.  **Confirm:** *"All artifacts created. [X] Implementations ready for Spec-It."*

---

## Completion

**Summary:** Recap:
* How many Implementations were carved
* The build sequence
* Any parallel opportunities
* Which Implementation is recommended to start with

**Next Steps:**
- *"Ready to continue to **Spec-It** to detail implementation 01? Just say 'Spec it' when ready."*
- *"Or if you want to jump straight to a later implementation, tell me which one."*

---

*Previous Workflow: Technical Vision · Next Workflow: Spec-It*
