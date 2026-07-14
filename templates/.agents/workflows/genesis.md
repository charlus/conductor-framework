---
description: Genesis (The App Origin Story)
---

# Workflow: Genesis (The App Origin Story)

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols into your active context. Do not rely on previous memory.

**Trigger:** "Start a new app", "I have an idea", "Genesis Mode"
**Goal:** Transform a raw idea into the "Holy Trinity" of context documents within a new Project.
**Output:**
1. `conductor/2-backlog/project-backlog/[ProjectName]/genesis/problem-solar-system.md` (The Rant)
2. `conductor/2-backlog/project-backlog/[ProjectName]/genesis/world-transformation.md` (The Vision)
3. `conductor/2-backlog/project-backlog/[ProjectName]/genesis/functional-animator.md` (The Skeleton)

**Templates:** Use the templates in `conductor/5-templates/genesis-workflow/` for consistent output structure.

**Interview technique:** This workflow is one long interview. **Load `.agents/skills/grilling/SKILL.md` and conduct every phase by its Five Laws** — one question at a time, recommend an answer to each, look facts up instead of asking, descend in dependency order, and gate only at convergence. Genesis supplies the *agenda* below; Grilling supplies the *how*.

**Relationship to Projects:** Genesis creates a new Project folder in the project-backlog. All subsequent workflows (Storyboard, Blueprint, etc.) add to this same Project folder.

---

## The Prime Directive for Genesis
**You are the Interviewer, not the Builder.**
Do not write code. Do not plan features. Do not discuss tech stacks yet. Your goal is to extract the *Soul* of the product from the user's mind.

Everything about *how* to interview lives in the Grilling primitive. This file only adds two Genesis-specific constraints:
- **Altitude:** Stay on problem, vision, and user-facing capability. Technology is out of scope until Blueprint.
- **One approval per document:** Each phase ends with a single draft-and-approve gate on its file — no separate "ready to draft?" pre-gate. Recommend the draft; let the user correct it.

---

## Phase 0: Setup (Create the Project)
**Goal:** Create the Project folder and gather existing context before diving in.

1.  **Scope (decision):** New product, or a new feature within an existing product? Recommend based on anything you already know, then confirm.
2.  **Name (decision):** Propose a `[ProjectName]` and confirm. This is the container for all work — Genesis, Storyboard, PRDs, Implementations.
3.  **Create the folders (fact/action):** `conductor/2-backlog/project-backlog/[ProjectName]/` and its `genesis/` subfolder. Confirm creation.
4.  **Context scan (fact — do not ask, look it up):** Read the relevant `conductor/3-product-areas/` folders, existing genesis/PRD docs, and codebase yourself. Summarize what already exists so the interview never rediscovers known ground: "Here's what I found that's relevant: [summary]." Do this for features *and* new products — there is almost always prior context to mine.

---

## Phase 1: The Rant (The Problem Solar System)
**Goal:** Map the central problem ("Sun") and its symptoms ("Satellites") into a hierarchy of pain.

1.  **Open:** "Tell me what's broken. Rant to me — what annoys you or your users? Don't hold back."
2.  **Grill:** Reflect and probe toward the root cause (Grilling's active-listening loop). Surface adjacent problems and blind spots one at a time, each with your read on whether it's in scope — not as a batch.
3.  **Define the Orbit:** Propose the Sun and Satellites: "I see [X] as the core conflict, with [A, B, C] orbiting it. Agree?"
4.  **Draft & approve:** Present `problem-solar-system.md` (template structure). **STOP** for explicit approval, then write it.

---

## Phase 2: The World Transformation (The Resolution)
**Goal:** Contrast the "Before" and "After" states, anchored to the Sun.

1.  **Prompt:** "Describe the world where this is fixed. What does life look like *before* this exists, and exactly what does it look like *after*?"
2.  **Grill:** Dig for contrast so the "After" directly resolves the Sun from Phase 1. Probe for concrete texture — rituals, workflow changes, stress and time saved. Reflect the delta: "So the shift is from [Manual Pain] to [Automated Joy] — is that the core delta?"
3.  **Draft & approve:** Present `world-transformation.md` (Before vs. After, North Star). **STOP** for approval, then write it.

---

## Phase 3: The Functional Animator (The Skeleton)
**Goal:** Enumerate ALL the "Jobs" the app must perform to bring the machine to life.

**Persona Anchor:** You are the Product Owner designing UX capabilities — NOT the System Architect.
**The Technical Ban:** Do not propose technical solutions (APIs, databases, vectors, schemas). Focus ONLY on user capabilities ("Hear my voice," "Show my schedule," "Send context to my IDE").

1.  **Lead with a draft (recommend-per-question at scale):** From the Problem Solar System and World Transformation, synthesize a comprehensive list of functional jobs organized by capability area. Ensure every Satellite from Phase 1 maps to a Job, and include the Problems → Jobs mapping table. Present it as the starting point, not a questionnaire.
2.  **Refine:** "What's missing? What doesn't belong? What needs to change?" Iterate one thread at a time.
3.  **Non-Goals:** Propose what to explicitly exclude — things that seem related but are out of scope — and confirm. Capture as Non-Goals.
4.  **Draft & approve:** Present the final `functional-animator.md` (template structure). **STOP** for approval, then write it.

---

## Completion Protocol

1.  **Review:** Read all three files in `genesis/` to ensure they're consistent with each other.
2.  **Recap:** The Sun (core problem), the Transformation (before → after), and the key capability areas.
3.  **Confirm:** "Genesis complete. We've defined the Problem, the Transformation, and the Skeleton."
4.  **Next step:** **Storyboard** — define the main character, their outcomes, and the scenes they experience (adds a `storyboard/` folder to this Project). Then **Blueprint** (Grand PRD) → **Technical Vision** → **Carve** into Implementations.
5.  **Lifecycle:** The Project folder lives in `conductor/2-backlog/project-backlog/` as workflows add to it; when all Implementations complete, the whole Project moves to `conductor/6-archive/`.
