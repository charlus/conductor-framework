---
description: Storyboard (Shaping the Experience)
---

# Workflow: Storyboard (Shaping the Experience)

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols into your active context. Do not rely on previous memory.

**Trigger:** "Storyboard", "Shape the experience", "Who's the main character?"
**Goal:** Define the main character, their desired outcomes, and the scenes they experience to achieve them.
**Output:**
1. `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Storyboard/Main-Character.md` (Who they are, what they want)
2. `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Storyboard/Storyboard.md` (The scenes they go through)

**Templates:** Use the templates in `.conductor/5-Templates/Storyboard-Workflow/` for consistent output structure.

**Relationship to Projects:** Storyboard adds to an existing Project folder. If no Project exists, Genesis should be run first to create one. Storyboard outputs go in the `Storyboard/` subfolder within the Project.

---

## The Prime Directive for Storyboard
**You are the Director, not the Engineer.**
You're shaping the experience, not building the system. Focus on what the main character sees, feels, and does - not on how it's implemented.

**Communication Style:**
- Be conversational while following the structure
- At the start of each phase, clearly announce what phase we're in and what we're about to do
- Walk the conductor through each step - never assume, always explain
- Ask before moving on (Advancement Gates)

---

## Phase 0: Setup (Orient and Connect)
**Goal:** Explain the workflow, check for existing Project, and establish the Storyboard folder.

### Stage-Setting
Announce: *"We're starting the Storyboard workflow. This is where we shape the experience - who's the main character, what outcomes do they want, and what scenes do they go through to get there."*

### Steps

1.  **Explain the Workflow:**
    *   "Storyboarding produces two documents:"
    *   "First, the **Main Character** - who they are, their situation, and the outcomes they want."
    *   "Second, the **Storyboard** - the scenes they experience to achieve those outcomes."
    *   "By the end, you'll have a clear picture of what using this thing actually feels like."

2.  **Check for Existing Project:**
    *   Look for an existing Project folder in `.conductor/2-Backlog/Project-Backlog/` that relates to this work.
    *   **If found:** "I see you have a Project called [ProjectName] with Genesis already completed. I'll add Storyboard to this Project and use Genesis as context."
    *   **If not found:** "I don't see a Project for this yet. We should run Genesis first to create the Project and define the problem space. Would you like to do that now?"
    *   If user wants to proceed without Genesis, create a new Project: "Okay, I'll create a new Project. What would you like to name it?"

3.  **Create Storyboard Folder:**
    *   **Action:** Create folder at `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Storyboard/`
    *   **Confirm:** "Created Storyboard folder in Project `[ProjectName]`. This is where Main-Character.md and Storyboard.md will live."

4.  **Load Context (if Genesis exists):**
    *   Read the Genesis documents (Problem-Solar-System, World-Transformation, Functional-Animator)
    *   Briefly summarize: "From Genesis, I see the core problem is [X] and the transformation is [Y]. The main capabilities are [Z]. I'll use this as we shape the experience."

5.  **Transition to Phase 1:**
    *   Wrap up: "Setup is complete. We have our folder and context loaded."
    *   Announce next: "Now we'll move into Phase 1, where we define the Main Character - who they are, their situation, and the outcomes they want."

---

## Phase 1: The Main Character
**Goal:** Define who the main character is, their situation, and the outcomes they want.

### Stage-Setting
Announce: *"We're now in Phase 1: The Main Character. This is where we define who we're building for - not demographics, but their real situation and what outcomes they're after."*

### Steps

1.  **Offer a Starting Point:**
    *   The blank canvas can be intimidating. Offer to lead if helpful.
    *   **If Genesis exists:** "Based on what we captured in Genesis, I can propose a first draft of the main character for you to react to. Or if you'd prefer, you can describe them and I'll capture it. Which works better for you?"
    *   **If no Genesis:** "Would you like to describe the main character, or would you like me to ask some questions to help draw them out?"

2.  **The Opening Questions (if conductor leads):**
    *   "Who is the main character? Tell me about them - not their age or job title, but their situation. What's their world like?"
    *   "When do they show up to use this? What's their mindset? Are they stressed, planning ahead, in the middle of chaos?"

3.  **The AI Proposal (if AI leads):**
    *   Based on Genesis context, propose a draft main character.
    *   **Say:** "Based on Genesis, here's who I think our main character might be..."
    *   Describe their situation, when they show up, their emotional state.
    *   **Ask:** "Does this resonate? What would you change or add?"

4.  **The Exploration Loop:**
    *   **Reflect:** "So they're someone who [X], and they typically show up when [Y]. Is that right?"
    *   **Probe:** "Tell me more about what that moment feels like for them."
    *   **Loop:** Continue until the main character feels real and vivid.

5.  **The Outcomes:**
    *   **Ask:** "What outcomes does this main character want? Not features - outcomes. What do they want their life to look like?"
    *   Frame as "I want..." statements from the main character's perspective.
    *   **Probe:** "Why does that outcome matter to them? What changes if they get it?"

6.  **Connect to Genesis (if exists):**
    *   Check that the outcomes align with the World Transformation.
    *   "These outcomes feel connected to the transformation we defined in Genesis - moving from [before] to [after]. Does that feel right?"

7.  **The Advancement Gate:**
    *   **Ask:** "Are you ready for me to draft the Main Character document, or is there more to explore about who they are and what they want?"

8.  **Draft & Approve:**
    *   Present the text for `Main-Character.md` using the template structure.
    *   **STOP:** Wait for explicit approval.

9.  **Action:**
    *   Write to `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Storyboard/Main-Character.md`.

10. **Transition to Phase 2:**
    *   Wrap up: "Phase 1 is complete. We've defined our main character and captured their outcomes."
    *   Announce next: "Now we'll move into Phase 2: The Scenes. This is where we walk through the key moments they experience to achieve those outcomes."

---

## Phase 2: The Scenes
**Goal:** Walk through the key scenes the main character experiences to achieve their outcomes.

### Stage-Setting
Announce: *"We're now in Phase 2: The Scenes. We know who our main character is and what they want. Now let's walk through the scenes they experience - what they do, what they see, and how they move toward those outcomes."*

### Steps

1.  **Check Existing Functionality:**
    *   Before proposing scenes, understand what already exists.
    *   **Ask:** "Is there any existing functionality in the app that relates to what we're building? Things that already work that we should build on or integrate with?"
    *   This prevents proposing scenes that describe already-built features as new.

2.  **Offer a Starting Point:**
    *   **Ask:** "Would you like to propose the key scenes, or should I take a first pass based on the outcomes and you can refine from there?"

3.  **Scene Discovery - AI Leads (if AI proposes):**
    *   Based on the Main Character outcomes and Genesis (if exists), propose the key scenes.
    *   **Say:** "Based on what our main character wants, I think the key scenes might be something like:"
    *   List 4-8 major scenes/moments (e.g., "Opening the app in the morning," "Capturing a new idea," "Looking at the week ahead," etc.)
    *   **Ask:** "Does this feel right? What's missing? What doesn't belong?"

4.  **Gaps Check:**
    *   After the initial scene list is agreed on, check for gaps.
    *   Review each outcome from Main Character - is there a scene that delivers it?
    *   **Say:** "Let me check these scenes against the outcomes... I want to make sure we're not missing anything."
    *   If gaps found: "I notice outcome [X] doesn't have a clear scene. Should we add one?"

5.  **Scene Exploration Loop:**
    *   For each scene, explore:
    *   **What triggers it?** "What brings them to this moment?"
    *   **What do they see?** "What's on the screen? What are they looking at?"
    *   **What do they do?** "What action do they take?"
    *   **What happens next?** "Where does this lead them?"
    *   Keep it narrative, not technical. "They see their week laid out" not "They see a calendar component with..."
    *   **Simplicity check:** If a scene is getting complicated, pause and ask: "Am I overcomplicating this? What's the simplest version?"

6.  **Connect the Scenes:**
    *   **Ask:** "How do these scenes connect? What's the flow between them?"
    *   Identify the major views/places in the app and how the character moves between them.

7.  **Final Validation Against Outcomes:**
    *   Check that the scenes actually deliver the outcomes.
    *   "Let's do a final check - if our main character goes through these scenes, do they get all the outcomes they wanted?"
    *   For each outcome, trace which scenes deliver it.

8.  **The Advancement Gate:**
    *   **Ask:** "Are you ready for me to draft the Storyboard document, or are there more scenes to explore?"

9.  **Draft & Approve:**
    *   Present the text for `Storyboard.md` using the template structure.
    *   **STOP:** Wait for explicit approval.

10. **Action:**
    *   Write to `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Storyboard/Storyboard.md`.

11. **Transition to Completion:**
    *   Wrap up: "Phase 2 is complete. We've defined all the scenes and validated them against the outcomes."
    *   Announce next: "Now let's wrap up and review what we've created."

---

## Completion Protocol

### Stage-Setting
Announce: *"Storyboard is complete. Let me review what we've created and talk about what comes next."*

### Steps

1.  **Review:** Read both documents to ensure consistency between Main Character and Scenes.

2.  **Summary:** Present a brief recap:
    *   Who the main character is
    *   Their key outcomes
    *   The major scenes/views they experience

3.  **Connect to Genesis (if exists):**
    *   "Looking back at Genesis, the scenes we've defined should deliver the transformation from [before] to [after]. Does it feel like we've closed that loop?"

4.  **Confirm:** "Storyboard Complete. We have defined the Main Character, their Outcomes, and the Scenes they experience."

5.  **Next Steps:**
    *   The natural next step is **Blueprint** - to create the Grand PRD that synthesizes everything.
    *   Blueprint will add a `Grand-PRD.md` to this same Project.
    *   After Blueprint, **Technical Vision** explores architecture, followed by **Carve** to break into Implementations.
    *   **Ask:** "Would you like to proceed with Blueprint?"

6.  **Project Lifecycle:** The Project folder lives in `.conductor/2-Backlog/Project-Backlog/` as workflows add to it. When all Implementations are complete, the entire Project moves to `.conductor/6-Archive/`.
