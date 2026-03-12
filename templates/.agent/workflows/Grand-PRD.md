---
description: Grand PRD (Organizing the Problem Space)
---

# Workflow: Grand PRD

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols into your active context. Do not rely on previous memory.

**Trigger:** "Grand PRD", "Blueprint PRD", "Create PRD", "Define the epics"
**Goal:** Transform Genesis and Storyboard content into a Grand PRD that organizes the problem space into Epics.
**Output:** `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Blueprint/Grand-PRD.md`

**Template:** Use `.conductor/5-Templates/Blueprint-Workflows/Grand-PRD.md` for consistent output structure.

**Prerequisites:** Genesis (required), Storyboard (recommended)
**Next Workflow:** UX/UI Design Brief

---

## The Prime Directive

**You are the Architect - organizing the Problem Space.**

The Grand PRD is the first of three Blueprint documents:
1. **Grand PRD** (this workflow) - Organize the problem space into Epics
2. **UX/UI Design Brief** (next) - Translate Epics into interface
3. **Technical Vision** (last) - Figure out how to build it

The Grand PRD answers: "What are we building and why?" It organizes the messy problem space into coherent Epics - logical groupings that tell complete "problem → solution → outcome" stories.

**Communication Style:**
- Be conversational while following the structure
- At the start of each phase, clearly announce what we're doing
- Lead with proposals - you've read all the context, so offer a starting point
- Ask before moving on (Advancement Gates)
- Read source documents carefully - don't skim, don't miss things

---

## Phase 0: Setup
**Goal:** Orient the user, determine which project, and load context.

### Stage-Setting
Announce and explain:

*"We're starting the Grand PRD workflow - the first of three Blueprint documents.*

*The Grand PRD organizes your Genesis and Storyboard work into Epics. An Epic is a coherent chunk of the problem space that addresses specific problems and delivers related outcomes. We'll identify the right Epics, size them properly, and define each one fully.*

*When we're done, you'll have a Grand PRD that captures the 'what and why' of your project. Then we can move to UX/UI design."*

### Steps

1. **Ask Which Project:**
   - **Ask:** "Are we working on an existing project? If so, which one? Or are we starting fresh?"
   - Wait for the user to answer.

2. **Verify Context:**
   - Check `.conductor/2-Backlog/Project-Backlog/[ProjectName]/` for Genesis and Storyboard.
   - **If both exist:** → Proceed to **Path A: With Full Context**
   - **If Genesis only:** → Proceed to **Path B: Genesis Only**
   - **If neither exists:** → Proceed to **Path C: Fresh Start**

---

### Path A: With Full Context
*Genesis and Storyboard both exist.*

1. **Confirm:**
   - "I found Project `[ProjectName]` with both Genesis and Storyboard. I'll use these as the foundation. Sound good?"
   - Wait for confirmation.

2. **Load All Context:**
   - Read all Genesis documents (Problem-Solar-System, World-Transformation, Functional-Animator)
   - Read all Storyboard documents (Main-Character, Storyboard)
   - **Read carefully** - absorb every scene, every outcome, every functional job.

3. **Context Summary:**
   - Present a brief synthesis:
   - "Here's what I'm working with:"
     - The core problem (the Sun)
     - The transformation (before → after)
     - The main character and their outcomes
     - The key scenes they experience
     - The functional jobs
   - **Ask:** "Does this capture the essence? Anything I should keep in mind?"

4. **Transition:** → Proceed to **Phase 1: Epic Discovery**

---

### Path B: Genesis Only
*Genesis exists but no Storyboard.*

1. **Offer Choice:**
   - "I found Genesis for `[ProjectName]` but no Storyboard. Storyboard adds valuable user perspective - the scenes and outcomes."
   - "Would you like to:"
     - "**Option 1:** Run Storyboard first (recommended)"
     - "**Option 2:** Proceed with Genesis only"

2. **If Storyboard first:** Transition to Storyboard workflow.

3. **If proceed:** Load Genesis, summarize, and continue to Phase 1.

---

### Path C: Fresh Start
*No Genesis or Storyboard exists.*

1. **Acknowledge:**
   - "I don't see any existing Genesis or Storyboard for this project."
   - **Offer options:**
     - "**Option 1 (Recommended):** Run Genesis first to properly explore the problem space."
     - "**Option 2:** We can do condensed context gathering right now - faster but less thorough."

2. **If Genesis first:** Transition to Genesis workflow.

3. **If condensed:**
   - Create Project folder
   - Ask essential questions about problem, transformation, main character, capabilities
   - Summarize and proceed to Phase 1

---

## Phase 1: Epic Discovery
**Goal:** Identify and right-size the Epics.

### Stage-Setting
Announce: *"We're now in Phase 1: Epic Discovery. I'm going to propose an initial breakdown of Epics based on everything I've read. Then we'll discuss whether these are the right groupings and the right size."*

### What is an Epic?
An Epic is a coherent chunk of the problem space that:
- Addresses a specific cluster of problems
- Delivers a set of related outcomes
- Contains related scenes/functionality
- Could eventually become one or more implementations

Epics are NOT:
- Technical components (that's architecture)
- Prioritized (that comes later)
- Implementation details (that's Spec-It)

### Steps

1. **AI Proposes Initial Epics:**
   - Based on all the context, propose 4-8 initial Epics.
   - For each Epic, give:
     - A name
     - A concrete picture of what it covers (paint the scenario, not just a description)
     - Which scenes/functional jobs it encompasses
   - **Present:** "Based on everything I've read, here's how I'd organize this into Epics..."

2. **Sizing Discussion:**
   - **Ask:** "Let's talk about sizing:"
     - "Does any Epic feel too big? Should it be split?"
     - "Does any Epic feel too small? Should it be combined?"
     - "Are the boundaries in the right places?"
   - Discuss and adjust based on feedback.

3. **Gaps Check:**
   - Review functional jobs from Genesis - is every job covered by an Epic?
   - Review scenes from Storyboard - is every scene represented?
   - Review outcomes from Main Character - does each outcome have a home?
   - **Say:** "Let me check for gaps..."
   - If gaps found: "I notice [X] doesn't have a clear home. Should we add an Epic or fold it into an existing one?"

4. **Scope Check:**
   - **Ask:** "Is there anything that should be explicitly OUT of scope?"
   - Capture non-goals and things to defer.

5. **Refinement Loop:**
   - Continue until the breakdown feels right.
   - **Reflect:** "So we have [N] Epics: [list them]. Does this feel like the right organization?"

6. **Advancement Gate:**
   - **Ask:** "Are you happy with these Epic boundaries?"

7. **Transition:** → Proceed to **Phase 2: Epic Definition**

---

## Phase 2: Epic Definition
**Goal:** Define each Epic fully with problem/why/what/outcome.

### Stage-Setting
Announce: *"We're now in Phase 2: Epic Definition. For each Epic, we'll define the complete story - what problem it solves, why it matters, what the user experiences, and what outcomes it delivers."*

### Steps

1. **Epic-by-Epic Definition:**
   For each Epic, work through:

   **The Problem It Solves**
   - Which satellites from the Problem Solar System does this address?
   - What pain points does it eliminate?

   **Why It Matters**
   - How does this connect to the transformation?
   - What part of the "after" world does this enable?

   **What The User Experiences**
   - Which scenes from Storyboard are part of this Epic?
   - What can the user do when this exists?
   - Paint a concrete picture - not just features, but scenarios.

   **Outcomes Delivered**
   - Which outcomes from Main Character does this fulfill?
   - Frame as: "After this Epic, the main character can..."

2. **AI Leads with Drafts:**
   - For each Epic, propose the full definition first.
   - **Say:** "Here's how I see Epic [Name]..."
   - **Ask:** "Does this capture it? What would you adjust?"

3. **Completeness Check:**
   - After all Epics defined:
   - "Do they collectively deliver the full transformation?"
   - "Any outcome not addressed? Any scene lost?"

4. **Advancement Gate:**
   - **Ask:** "Are all Epics fully defined?"

5. **Transition:** → Proceed to **Phase 3: Grand PRD Assembly**

---

## Phase 3: Grand PRD Assembly
**Goal:** Assemble and save the Grand PRD document.

### Stage-Setting
Announce: *"We're now in Phase 3: Grand PRD Assembly. I'm compiling everything into the Grand PRD."*

### Grand PRD Structure

1. **Project Overview** - Name and one-paragraph summary
2. **The Problem** - The Sun and Satellites
3. **The Transformation** - Before, After, North Star
4. **The Main Character** - Who, when, outcomes
5. **The Epics** - Each with problem/why/what/outcomes
6. **Non-Goals** - What's explicitly out of scope

### Steps

1. **Draft the Grand PRD:**
   - Compile all content into the structure.
   - **Present:** "Here's the Grand PRD..."

2. **Review:**
   - **Ask:** "Does this accurately capture everything we've discussed?"
   - Make any requested adjustments.

3. **Advancement Gate:**
   - **Ask:** "Ready for me to save the Grand PRD?"

4. **Save:**
   - Create Blueprint folder if needed: `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Blueprint/`
   - Write to `Blueprint/Grand-PRD.md`
   - **Confirm:** "Grand PRD saved."

---

## Completion Protocol

### Summary
- "Grand PRD is complete for Project `[ProjectName]`."
- Briefly recap: [N] Epics covering [key areas]

### Next Steps
- "The Grand PRD captures the WHAT and WHY."
- "Next is the **UX/UI Design Brief** workflow - where we translate these Epics into actual screens, navigation, and interactions."
- **Ask:** "Ready to continue to UX/UI design? Just say 'UX/UI Design Brief' when you're ready."

### Project State
```
Project-Backlog/[ProjectName]/
├── Genesis/
├── Storyboard/
└── Blueprint/
    └── Grand-PRD.md  ← We are here
```
