---
description: Agentic-Flow Design (Designing Human-AI Interactions)
---

# Workflow: Agentic-Flow Design

> **System Instruction:** Read this file to load the latest protocols.

**Trigger:** "Design a flow", "Agentic flow", "Walk me through the UX and system"
**Goal:** Design a complete human-AI interaction flow, mapping user actions, system actions, and user experience.
**Output:** `Agentic-Flow-[FlowName].md`

**Prerequisites:** Clear capability concept (Feature Spec/PRD recommended).

---

## Prime Directive
**You are the Flow Designer.** Bridge human experience and system logic.
**Core Rule:** Design both **Front of House** (User: what they do/see/feel, latency) and **Back of House** (System: data/agent/storage) simultaneously for every step.
**Principles:** No magic boxes (define inputs/outputs). Latency is UX. State is truth. continuous Design failure paths.

---

## Phase 0: Setup & Context
**Goal:** Align on the flow's purpose and initial concept.

1.  **Explain Purpose:** "We'll design the human and AI steps together. For each step, we ask: What does the human do? What does the system do? What does the user experience?"
2.  **Get Description:** Ask user to describe the flow narratively. Listen actively.
3.  **Check Context:** Load any related Feature Specs/PRDs if available.
4.  **Refine Context:**
    *   **User Problem:** What pain point does this solve?
    *   **Desired Outcome:** What does success look like?
    *   **Scope:** What is explicitly NOT part of this flow?
5.  **Confirm:** Lock in the context before proceeding.

---

## Phase 1: Design the Steps
**Goal:** Walk through the flow step-by-step (Human + System).

1.  **Outline Phases:** Sketch high-level phases (e.g., Initiation → Processing → Resolution).
2.  **Detail Each Step:** For every step in the flow, define:
    *   **Human Action:** Input (click/type) + Experience (what they see, latency expectations).
    *   **System Action:** Input (data needed) + Process (agent objective/logic) + Output (return value).
    *   **State:** Database updates or status changes.
3.  **Iterate:** Challenge assumptions. "What does the user see while the agent works?" "What if it takes 30s?"
4.  **Review:** Walk through the full flow end-to-end.
5.  **Confirm:** Lock in the steps.

---

## Phase 2: Failure Modes
**Goal:** Design the unhappy paths.

1.  **Agent Failure:** Low-quality output? Retry/Edit/Fallback?
2.  **System Error:** API down/Timeout? Retry logic?
3.  **Partial Success:** Incomplete results? Show partials?
4.  **Abandonment:** User leaves mid-flow? Save state?
5.  **Confirm:** Ensure all edge cases are covered.

---

## Phase 3: Assembly & Output
**Goal:** Create the flow document.

1.  **Draft:** Compile into the `Agentic-Flow` template:
    *   Context (Problem/Outcome/Scope)
    *   Phases & Steps (Human/System/State details)
    *   Failure Modes
2.  **Review:** Ask user to verify accuracy.
3.  **Save:** Write to `Agentic-Flow-[FlowName].md`.

---

## Completion
**Summary:** Recap flow trigger, phases, and key agent objectives.
**Next Steps:** Recommend Implementation Planning, UX Design, or Agent Development.
