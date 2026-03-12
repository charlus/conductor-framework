---
description: Quick-Path (Fast-Track Implementation)
---

# Workflow: Quick-Path — Fast-Track Implementation

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols. Do not rely on previous memory.

**Trigger:** "Quick path", "Just build this", "Skip discovery", "I know what I want"
**Goal:** Take a clear, scoped implementation request directly to spec and build — skipping the full Genesis → Storyboard → Blueprint pipeline.
**Output:** A Feature Spec, Implementation Plan, and built implementation.
**Prerequisites:** A clear user request. That's it.

---

## When to Use

Use Quick-Path when the user:
- Knows exactly what they want to build
- Has a scoped, standalone request (not a full product)
- Wants to skip discovery and go straight to building
- Is adding a feature to an existing codebase

**Don't use Quick-Path when:**
- The user is exploring an idea → use **Genesis**
- The scope is unclear or multi-epic → use **Grand PRD**
- The user says "I'm not sure what I need" → use **Genesis** or **Brainstorm**

---

## Phase 1: Scope Lock

**Goal:** Lock the scope in 3 questions or less. Inspired by Antigravity-Kit's Socratic Gate.

**Announce:** *"Quick-Path mode. Let me ask a few questions to lock the scope."*

### The Three Questions

Ask these one at a time. Stop as soon as scope is clear.

1.  **"What are you building?"**
    * Get a clear description of the feature/change
    * If vague: ask a follow-up to sharpen it
    * If clear: move to question 2

2.  **"What does 'done' look like?"**
    * Get specific acceptance criteria
    * *"When this is done, what should a user be able to do that they can't do now?"*
    * If unclear: propose criteria and iterate

3.  **"Any constraints?"**
    * Tech stack preferences/requirements
    * Existing patterns to follow
    * Files/folders that should or shouldn't be touched
    * Time constraints

### Scope Summary

After the questions, present a scope summary:

```markdown
## Scope Lock
- **What:** [One sentence]
- **Done when:** [Acceptance criteria list]
- **Constraints:** [Any constraints]
- **Estimated size:** [Small / Medium / Large]
```

**Confirm:** *"Is this scope correct?"*

---

## Phase 2: Quick Spec

**Goal:** Create a lightweight Feature Spec. No 12-page PRD — just enough to build.

**Announce:** *"Scope locked. Let me draft a quick spec."*

### AI Proposes First

Draft a Feature Spec with only these sections:

```markdown
# Feature Spec: [Name]

## What We're Building
[2-3 sentences]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Approach
- [Key technical decisions]
- [Files to create/modify]
- [Patterns to follow]

## Out of Scope
- [What we're NOT building]
```

### Discussion Round
* *"Does this spec capture what you want? Anything to add or remove?"*
* Iterate until approved

### Save
* Save to the active Implementation folder as `Feature-Spec.md`
* Or to `.conductor/1-Workbench/` if no Implementation folder exists yet

---

## Phase 3: Quick Plan

**Goal:** Create a bite-sized Implementation Plan. Each step should be 2-5 minutes of work.

**Announce:** *"Spec approved. Let me create the implementation plan."*

### AI Proposes First

Draft an Implementation Plan:

```markdown
# Implementation Plan: [Name]

## Phase 1: [Foundation]
- [ ] Task 1: [Specific action] — [File path]
- [ ] Task 2: [Specific action] — [File path]

## Phase 2: [Core]
- [ ] Task 3: [Specific action] — [File path]
- [ ] Task 4: [Specific action] — [File path]

## Phase 3: [Verification]
- [ ] Run tests: [exact command]
- [ ] Verify acceptance criteria: [how]
```

### Rules
* Each task is one atomic action
* Every task names exact file paths
* Every test step has an exact command
* Keep it SHORT — Quick-Path should stay quick

### Confirm
* *"Plan ready. Want to review it or shall I start building?"*

---

## Phase 4: Build

**Goal:** Execute the plan using the Build workflow's discipline.

**Announce:** *"Starting build."*

* Follow the **Build** workflow (`.agent/workflows/Build.md`) with one adjustment:
  * **Batch size = all tasks** (since Quick-Path implementations are small)
  * Still do per-task verification
  * Still do the two-stage review (spec compliance → code quality)
  * Still update the task tracker

---

## Completion

* Verify all acceptance criteria from Phase 2
* Update Ship-Log if applicable
* *"Done. [Feature name] is built and verified."*

---

*This workflow can be entered at any time. It does not require any upstream workflows.*
