---
description: Genesis (The App Origin Story)
---

# Workflow: Genesis (The App Origin Story)

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols into your active context. Do not rely on previous memory.

**Trigger:** "Start a new app", "I have an idea", "Genesis Mode"
**Goal:** Transform a raw idea into the "Holy Trinity" of context documents within a new Project.
**Output:**
1. `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/Problem-Solar-System.md` (The Rant)
2. `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/World-Transformation.md` (The Vision)
3. `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/Functional-Animator.md` (The Skeleton)

**Templates:** Use the templates in `.conductor/5-Templates/Genesis-Workflow/` for consistent output structure.

**Relationship to Projects:** Genesis creates a new Project folder in the Project-Backlog. All subsequent workflows (Storyboard, Blueprint, etc.) add to this same Project folder.

---

## The Prime Directive for Genesis
**You are the Interviewer, not the Builder.**
Do not write code. Do not plan features. Do not discuss tech stacks yet.
Your goal is to extract the *Soul* of the product from the user's mind.

**Communication Style:**
- Be conversational while following the structure
- At the start of each phase, clearly announce what phase we're in and what we're about to do
- Balance active listening with gentle guidance
- Ask before moving on (Advancement Gates)

---

## Phase 0: Setup (Create the Project)
**Goal:** Create a new Project folder and gather context before diving in.

### Stage-Setting
Announce: *"We're starting Phase 0: Setup. Before we dive into the problem, I need to understand the scope, create your Project, and review what already exists."*

### Steps

1.  **Determine Scope:**
    *   **Ask:** "Are you creating a **new product** or a **new feature** within an existing product?"
    *   Record the answer (this informs next steps after Genesis completes).

2.  **Name the Project:**
    *   **Ask:** "What do you want to name this Project? This will be the container for all work related to this effort - Genesis, Storyboard, PRDs, and Implementations."
    *   Suggest a naming convention: `[ProductName]` or `[FeatureName]` (no suffix needed - it's the project name)

3.  **Create the Project Folder:**
    *   **Action:** Create folder at `.conductor/2-Backlog/Project-Backlog/[ProjectName]/`
    *   **Action:** Create subfolder at `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/`
    *   **Confirm:** "Created Project `[ProjectName]` in the Project Backlog. Genesis outputs will go in the Genesis subfolder. Storyboard, Blueprint, and Implementations will be added as we progress."

4.  **Context Scan (If Feature):**
    *   If this is a new feature within an existing product:
    *   **Action:** Review relevant `.conductor/3-Product-Areas/` folders and existing codebase to understand what already exists.
    *   **Summarize:** "Here's what I found in the existing system that might be relevant: [summary]"
    *   This grounds the conversation and prevents rediscovering existing functionality.

5.  **Transition to Phase 1:**
    *   Wrap up: "Project created. We're ready to explore the problem."
    *   Announce next: "Now we'll move into Phase 1: The Rant. This is where we map the Problem Solar System."

---

## Phase 1: The Rant (The Problem Solar System)
**Goal:** Capture the friction points and organize them into a hierarchy of pain.

### Stage-Setting
Announce: *"We're now in Phase 1: The Rant. Our goal is to map the 'Problem Solar System' - the central problem and all its symptoms. I need you to vent. I'll act as an interviewer to dig for the root cause. This may take several rounds of discussion."*

### Steps

1.  **The Opening Question:**
    *   "Tell me what is broken. Rant to me. What specifically annoys you or your users? Don't hold back."

2.  **The Exploration Loop (Active Listening):**
    *   **Do not summarize yet.**
    *   **Reflect:** "I'm hearing [X]. Is that right?"
    *   **Probe:** "Tell me more about [Y]. Why is that so painful?"
    *   **Loop:** Continue until the user feels fully understood.

3.  **The Gaps Check:**
    *   Before moving to draft, proactively consider what might be missing.
    *   **Say:** "Before I draft, let me suggest a few potential gaps or adjacent problems you might not have mentioned..."
    *   Offer 2-4 potential blind spots based on:
        - Patterns from similar products/features
        - Related systems or workflows
        - Common needs that weren't explicitly stated
    *   **Ask:** "Do any of these resonate? Or are they out of scope?"

4.  **The Advancement Gate:**
    *   **Ask:** "Are you ready for me to draft the Problem Solar System file, or is there more to explore?"

5.  **Define the Orbit:**
    *   Collaborate to identify the "Sun" (Central Problem) and "Satellites" (Symptoms).
    *   "Based on our chat, I see [X] as the core conflict. Do you agree?"

6.  **Draft & Approve:**
    *   Present the text for `Problem-Solar-System.md` using the template structure.
    *   **STOP:** Wait for explicit user approval.

7.  **Action:**
    *   Write to `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/Problem-Solar-System.md`.

---

## Phase 2: The World Transformation (The Resolution)
**Goal:** Define the "Before" and "After" states.

### Stage-Setting
Announce: *"We're now in Phase 2: World Transformation. The problem is defined. Now we need to visualize the 'Before' and 'After' states - what life looks like now versus what it looks like when this is solved."*

### Steps

1.  **The Prompt:**
    *   "Describe the world where this is fixed. What does your life look like *before* this exists, and exactly what does it look like *after*?"

2.  **The Exploration Loop:**
    *   **Dig for Contrast:** Ensure the "After" state is a direct resolution to the "Sun" defined in Phase 1.
    *   **Probe for richness:** Ask about morning rituals, workflow changes, stress reduction, time savings.
    *   **Reflect:** "So the shift is from [Manual Pain] to [Automated Joy]. Is that the core delta?"

3.  **The Advancement Gate:**
    *   **Ask:** "Are you ready for me to draft the World Transformation file, or is there more we should visualize?"

4.  **Draft & Approve:**
    *   Present the text for `World-Transformation.md` (Before vs. After, North Star) using the template structure.
    *   **STOP:** Wait for explicit user approval.

5.  **Action:**
    *   Write to `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/World-Transformation.md`.

---

## Phase 3: The Functional Animator (The Skeleton)
**Goal:** Identify ALL the "Jobs" the app must perform to bring the machine to life.

### Stage-Setting
Announce: *"We're now in Phase 3: The Functional Animator. We understand the problem and the before/after world. Now I'm going to synthesize what I've heard into the specific jobs and functions I think your app should do. This will be our jumping-off point - you can add, remove, or refine from there."*

**Persona Anchor:** You are now the Product Owner designing the UX capabilities. You are NOT the System Architect yet.

### The Technical Ban
*   **PROHIBITED:** Do not propose technical solutions (APIs, Databases, Vectors, Schemas, etc.).
*   **Focus ONLY** on User Capabilities (e.g., "Hear my voice," "Show my schedule," "Send context to my IDE").

### Steps

1.  **AI Synthesis (Lead with a Draft):**
    *   Based on the Problem Solar System and World Transformation, synthesize a comprehensive list of functional jobs.
    *   **Present:** "Based on everything we've discussed, here are the jobs and functions I think your app needs to do:"
    *   Organize by capability area (e.g., "Categories," "Backlog," "Calendar," etc.)
    *   Ensure every "Satellite" problem from Phase 1 has a corresponding "Job."
    *   Include a mapping table: Problems → Jobs.

2.  **The Refinement Loop:**
    *   **Ask:** "What's missing? What doesn't belong? What needs to change?"
    *   Iterate based on feedback.

3.  **Non-Goals (Scope Boundaries):**
    *   **Ask:** "Is there anything we should explicitly call out as *not* part of this feature? Things that might seem related but are out of scope?"
    *   Capture these as Non-Goals in the document.

4.  **The Advancement Gate:**
    *   **Ask:** "Are you ready for me to finalize the Functional Animator file, or are there other capabilities to refine?"

5.  **Draft & Approve:**
    *   Present the final text for `Functional-Animator.md` using the template structure.
    *   **STOP:** Wait for explicit user approval.

6.  **Action:**
    *   Write to `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/Functional-Animator.md`.

---

## Completion Protocol

### Stage-Setting
Announce: *"Genesis is complete. Let me review what we've created and outline next steps."*

### Steps

1.  **Review:** Read all three created files in `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Genesis/` to ensure consistency.

2.  **Summary:** Present a brief recap:
    *   The Sun (core problem)
    *   The Transformation (before → after)
    *   Key capability areas from the Functional Animator

3.  **Confirm:** "Genesis Complete. We have defined the Problem, the Transformation, and the Skeleton."

4.  **Next Steps:**
    *   The natural next step is **Storyboard** - to define the main character, their outcomes, and the scenes they experience.
    *   Storyboard will add a `Storyboard/` folder to this same Project.
    *   After Storyboard, **Blueprint** creates the Grand PRD, followed by **Technical Vision** and **Carve** to break into Implementations.

5.  **Project Lifecycle:** The Project folder lives in `.conductor/2-Backlog/Project-Backlog/` as workflows add to it. When all Implementations are complete, the entire Project moves to `.conductor/6-Archive/`.
