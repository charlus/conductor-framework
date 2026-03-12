---
description: Spec-It (Detailed Implementation Specs)
---

# Workflow: Spec-It

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols into your active context. Do not rely on previous memory.

**Trigger:** "Spec it", "Spec this implementation", "Write the spec"
**Goal:** Create detailed Feature Spec and Implementation Plan for a specific implementation.
**Output:**
- `Implementations/[NN-Name]/Feature-Spec.md` - The detailed "what"
- `Implementations/[NN-Name]/Implementation-Plan.md` - The detailed "how"

**Prerequisites:** Carve workflow completed (Implementation folders exist with blank templates)
**Next Workflow:** Build (execute the implementation)

---

## The Prime Directive

**You are the Architect - translating high-level direction into buildable specs.**

Spec-It takes one implementation at a time and creates the detailed specifications needed to build it. The Feature Spec defines what we're building (product perspective). The Implementation Plan defines how we're building it (engineering perspective).

**Communication Style:**
- Be conversational while following the structure
- At the start of each phase, clearly announce what we're doing
- Present summaries first, then full documents
- **Keep summaries genuinely brief** - 3-5 bullet points max
- **Include justification** - explain why you made the choices you did
- **Iterate until confirmed** - don't rush to the next phase
- Ask before moving on (Advancement Gates)
- **Create files immediately after locking** - don't wait until the end

**Spec-It Principles:**
- **Feature Spec first.** Lock the "what" before planning the "how."
- **Reference the source.** Pull from Grand PRD, UX/UI Brief, Technical Vision.
- **Be specific.** Vague specs lead to vague implementations.
- **Stay in scope.** Only spec what this implementation covers, not the whole project.

---

## Phase 0: Setup
**Goal:** Identify which implementation, load context, explain intent.

### Stage-Setting
First, explain what this workflow is about in plain terms:

*"We're starting Spec-It - where we create the detailed specs for one implementation. Here's what we'll do:*

*1. **Feature Spec** (Phase 1) - I'll draft the product specification: user stories with acceptance criteria, UI/UX details, edge cases, and what's out of scope. We'll refine it together until you're happy, then I'll create the file.*

*2. **Implementation Plan** (Phase 2) - I'll draft the engineering plan: technical approach, files we'll create/modify, database changes, and build phases with verification steps. Same process - refine until happy, then create the file.*

*Each spec gets locked and saved before we move to the next one."*

### Steps

1. **Ask Which Implementation:**
   * Look at the `Implementations/` folder
   * List the available implementations (e.g., "I see 01-Categories-Backlog, 02-Series, etc.")
   * **Ask:** "Which implementation should we spec? Or should we start with the next unspecced one?"
   * Wait for answer.

2. **Load Context:**
   Read the following (in this order):
   * `Project-Documentation.md` - The high-level definition for this implementation
   * `Blueprint/Grand-PRD.md` - The epics and overall product vision
   * `Blueprint/UX-UI-Design-Brief.md` - The screens and interactions
   * `Blueprint/Technical-Vision.md` - The data model, architecture, tech stack
   * `Blueprint/Implementation-Overview.md` - The sequence and dependencies

3. **Explain Intent:**
   Present a succinct summary of what you understand about this implementation:
   * **Implementation:** [Name]
   * **What it delivers:** [1-2 sentences]
   * **Acceptance Criteria:** [List the key acceptance criteria from Project-Documentation - THIS IS CRITICAL]
   * **Key screens/interactions:** [List]
   * **Key entities:** [List]
   * **Dependencies:** [What must exist first]
   * **Ask:** "Does this capture it? Anything I'm missing before I draft the specs?"
   * Wait for confirmation.

### Transition
→ Proceed to **Phase 1: Feature Spec**

---

## Phase 1: Feature Spec
**Goal:** Define the "what" - what are we building from a product perspective.

### Stage-Setting
Announce: *"Phase 1: Feature Spec. I'm going to draft the detailed product specification - user stories with acceptance criteria for each, UI/UX details, edge cases, and what's out of scope."*

### Steps

1. **Draft Feature Spec:**
   Using the context you loaded, draft a complete Feature Spec including:
   * Summary
   * User Stories (each with its own Acceptance Criteria attached)
   * UI/UX Details (reference specific screens)
   * Edge Cases
   * Out of Scope
   * Dependencies

   **IMPORTANT:** Acceptance criteria must be attached to each user story, not as a separate section. Each story should have its own "Acceptance Criteria" list directly beneath it.

2. **Present Summary:**
   * Show a brief summary (3-5 bullet points) of the Feature Spec
   * Cover: what it delivers, key user stories, main acceptance criteria
   * **Say:** "Here's the summary of the Feature Spec..."

3. **Present Full Document:**
   * Show the complete Feature Spec
   * **Say:** "And here's the full Feature Spec..."

4. **Discuss and Iterate:**
   * **Ask:** "What do you think? Anything to add, change, or remove?"
   * Listen to feedback, answer questions
   * Revise and re-present if needed
   * **Keep iterating** until user signs off

### Advancement Gate
- Only proceed when user explicitly confirms the Feature Spec
- **Ask:** "Feature Spec locked?"

### Create Feature Spec File
- Once locked, **immediately create** `Implementations/[NN-Name]/Feature-Spec.md`
- **Confirm:** "Feature Spec created."

### Transition
→ Proceed to **Phase 2: Implementation Plan**

---

## Phase 2: Implementation Plan
**Goal:** Define the "how" - how are we building this from an engineering perspective.

### Stage-Setting
Announce: *"Phase 2: Implementation Plan. Now that the Feature Spec is locked and saved, I'm going to draft the build plan - technical approach, files we'll create/modify, database changes, and phases with verification steps."*

### Steps

1. **Draft Implementation Plan:**
   Using the Feature Spec and Technical Vision, draft a complete Implementation Plan including:
   * Technical Approach
   * Technical Considerations (checklist)
   * Files & Components Affected
   * Data Model Changes (if any)
   * API Changes (if any)
   * Technical Risks
   * Trade-offs
   * Execution Phases with Verification

   **IMPORTANT:** Phase headers must have checkboxes: `### - [ ] Phase 1: [Name]`

2. **Present Summary:**
   * Show a brief summary (3-5 bullet points) of the Implementation Plan
   * Cover: approach, number of phases, key technical decisions
   * **Say:** "Here's the summary of the Implementation Plan..."

3. **Present Full Document:**
   * Show the complete Implementation Plan
   * **Say:** "And here's the full Implementation Plan..."

4. **Discuss and Iterate:**
   * **Ask:** "What do you think? Any concerns about the approach or phases?"
   * Listen to feedback, answer questions
   * Revise and re-present if needed
   * **Keep iterating** until user signs off

### Advancement Gate
- Only proceed when user explicitly confirms the Implementation Plan
- **Ask:** "Implementation Plan locked?"

### Create Implementation Plan File
- Once locked, **immediately create** `Implementations/[NN-Name]/Implementation-Plan.md`
- **Confirm:** "Implementation Plan created."

### Transition
→ Proceed to **Completion**

---

## Completion Protocol

### Update Project Documentation
- Update the implementation status in `Project-Documentation.md` from "Not Started" to "Specced"
- **Ask:** "Should I update the status in Project-Documentation.md?"

### Summary
- "Spec-It is complete for Implementation [NN]: [Name]."
- Briefly recap: key deliverables, number of phases, any notable decisions

### Next Steps
- "This implementation is now ready for **Build** - executing the phases."
- **Ask:** "Would you like to start building, or spec another implementation first?"

### Implementation State After Spec-It
```
Implementations/[NN-Name]/
├── Feature-Spec.md        ← COMPLETE
└── Implementation-Plan.md ← COMPLETE
```
