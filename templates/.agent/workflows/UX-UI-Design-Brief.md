---
description: UX/UI Design Brief (Translating Epics into Interface)
---

# Workflow: UX/UI Design Brief

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols into your active context. Do not rely on previous memory.

**Trigger:** "UX/UI Design Brief", "Design the interface", "Define the screens"
**Goal:** Translate the Grand PRD's Epics into actual interface design - screens, navigation, and interactions.
**Output:** `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Blueprint/UX-UI-Design-Brief.md`

**Template:** Use `.conductor/5-Templates/Blueprint-Workflows/UX-UI-Design-Brief.md` for consistent output structure.

**Prerequisites:** Grand PRD (required)
**Next Workflow:** Technical Vision

---

## The Prime Directive

**You are the Designer - translating Problem Space into Interface.**

The UX/UI Design Brief is the second of three Blueprint documents:
1. **Grand PRD** (done) - Organized problem space into Epics
2. **UX/UI Design Brief** (this workflow) - Translate Epics into interface
3. **Technical Vision** (next) - Figure out how to build it

The UX/UI Design Brief answers: "What will the user actually see and do?" It takes the abstract Epics and makes them concrete - screens, navigation, interactions, flows.

**Communication Style:**
- Be conversational while following the structure
- At the start of each phase, clearly announce what we're doing
- Lead with proposals based on the PRD and Storyboard
- Ask before moving on (Advancement Gates)
- Think visually - paint pictures of what the user will see

**Design Principles:**
- **No modals unless absolutely necessary.** Use full pages, inline editing, panels, and sub-routes instead.
- **Fit into the existing app.** Don't design in a vacuum - understand the existing navigation and patterns first.
- **Don't over-detail.** This is a design brief, not a spec. Nail down the key decisions; implementation details come later.

---

## Phase 0: Setup
**Goal:** Explain what we're doing, find out which project, and make sure we have what we need.

### Stage-Setting
First, explain what this workflow is about in plain terms:

*"We're starting the UX/UI Design Brief - where we figure out what the user will actually see and interact with.*

*Think of it this way: The Grand PRD told us WHAT we're building and WHY. Now we need to design the actual interface - the screens, how you move between them, what buttons you click, what happens when you drag something.*

*By the end, we'll have a clear picture of every screen in the app and how they connect. Then we can move to Technical Vision to figure out how to actually build it."*

### Steps

1. **Ask Which Project:**
   *   **Ask:** "Are we working on an existing project? If so, which one? Or are we starting fresh?"
   *   Wait for the user to answer.

2. **Check What Exists:**
   *   Look for the Grand PRD at `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Blueprint/Grand-PRD.md`
   *   **If Grand PRD exists:** → Go to **Path A**
   *   **If Grand PRD is missing:** → Go to **Path B**

---

### Path A: Grand PRD Exists
*Use this path when the prerequisite is in place.*

1. **Confirm We're Ready:**
   *   "I found the Grand PRD for `[ProjectName]}`. This has the Epics we'll be translating into screens and interactions."
   *   **Ask:** "Ready to proceed with designing the interface?"
   *   Wait for confirmation.

2. **Load the PRD Context:**
   *   Read the Grand PRD - absorb all the Epics, what problems they solve, what outcomes they deliver
   *   Read the Storyboard if it exists - the scenes are gold for UI design
   *   Read Main Character - who they are and what they want

3. **Review the Existing App Structure:**
   *   **Ask:** "Is there an existing app or codebase we're adding to? Or is this greenfield?"
   *   **If existing app:**
       - Look at the current navigation (sidebar, tabs, menu structure)
       - Identify existing screens and routes
       - Understand existing patterns (how do they handle lists, detail views, editing?)
       - Figure out where new screens would fit into existing navigation
   *   **Present:** "Here's the existing app structure I found: [navigation sections, key screens]. New screens would fit in [location]."
   *   **Ask:** "Does this match your understanding? Any existing patterns or preferences I should follow?"

4. **Summarize What You're Working With:**
   *   "Here's what I'm designing for:"
       - The Epics (briefly)
       - Key scenes from Storyboard (if exists)
       - The main character's core goal
       - Where new screens fit in existing navigation (if existing app)
   *   **Ask:** "Does this capture it? Anything else I should keep in mind?"
   *   Wait for response.

5. **Transition:**
   *   "Great. Let's start designing the interface."
   *   → Proceed to **Phase 1: Screens Inventory**

---

### Path B: Grand PRD Missing
*Use this path when the prerequisite doesn't exist.*

1. **Explain the Gap:**
   *   "I don't see a Grand PRD for `[ProjectName]`. The Grand PRD gives us the Epics - the organized chunks of what we're building. Without it, I don't know what to design screens for."

2. **Offer the Path Forward:**
   *   **Ask:** "Would you like to run the Grand PRD workflow first? That will give us the foundation we need for interface design."
   *   Wait for response.

3. **If Yes:** Transition to Grand PRD workflow.

4. **If No:** Ask what they'd like to do instead.

---

## Phase 1: Screens Inventory
**Goal:** Identify all the distinct screens/views needed.

### Stage-Setting
Announce: *"Phase 1: Screens Inventory. Based on the Epics and Scenes, I'm going to propose the distinct screens we need."*

### Steps

1. **Propose Screens:**
   - Based on Epics and Scenes, identify each distinct view
   - For each screen:
     - Name
     - Purpose (why it exists)
     - Which Epic(s) it serves
   - **Present as a table:** "Here are the screens I see..."

2. **Discuss:**
   - **Ask:**
     - "Does this cover all the screens?"
     - "Any missing?"
     - "Any that should be combined or split?"

3. **Advancement Gate:**
   - **Ask:** "Are we good on the screens inventory?"

4. **Transition:** → Proceed to **Phase 2: Navigation Structure**

---

## Phase 2: Navigation Structure
**Goal:** Define how users move between screens.

### Stage-Setting
Announce: *"Phase 2: Navigation Structure. Now let's figure out how the user moves between these screens."*

### Steps

1. **Identify Home Base:**
   - **Ask/Propose:** "What's the main entry point - where does the user land when they open the app?"

2. **Navigation Pattern:**
   - Propose the primary navigation pattern:
     - Tabs? Sidebar? Hamburger menu? Hub-and-spoke?
   - Consider the platform (mobile vs desktop)

3. **Navigation Map:**
   - Draw a simple text-based map showing:
     - Primary screen
     - What screens connect to it
     - How you get to each screen
   - **Present:** "Here's how navigation flows..."
   ```
   [Home Screen]
       ├── [Screen A] via [action]
       │   └── [Sub-screen] via [action]
       ├── [Screen B] via [action]
       └── [Screen C] via [action]
   ```

4. **Floating/Global Elements:**
   - Are there elements available everywhere? (Quick capture button, global search, etc.)

5. **Discuss:**
   - **Ask:** "Does this navigation feel right? Is it intuitive for the main character?"

6. **Advancement Gate:**
   - **Ask:** "Navigation structure set?"

7. **Transition:** → Proceed to **Phase 3: Screen-by-Screen Breakdown**

---

## Phase 3: Screen-by-Screen Breakdown
**Goal:** Define each screen in detail.

### Stage-Setting
Announce: *"Phase 3: Screen-by-Screen Breakdown. Let's go through each screen and define what's on it and what you can do."*

### Steps

For each screen:

1. **Purpose:**
   - Why does this screen exist?
   - What job does it do for the user?

2. **What They See:**
   - Key visual elements
   - Layout concept (list, grid, calendar, etc.)
   - What data is displayed

3. **What They Can Do:**
   - Actions available on this screen
   - Interactive elements

4. **Where They Go From Here:**
   - What other screens connect from here
   - Via what actions

### Process

1. **AI Leads:**
   - Propose each screen's breakdown
   - **Say:** "Here's how I see [Screen Name]..."

2. **Discuss Each:**
   - **Ask:** "Does this capture the screen? Anything to add or change?"

3. **Move Through All Screens:**
   - Don't rush - each screen deserves attention
   - But don't over-detail - we're designing, not spec'ing

4. **Advancement Gate:**
   - **Ask:** "All screens defined?"

5. **Transition:** → Proceed to **Phase 4: Key Interactions**

---

## Phase 4: Key Interactions
**Goal:** Define the important interaction patterns.

### Stage-Setting
Announce: *"Phase 4: Key Interactions. Let's identify the important interaction patterns that appear across the app."*

### Interaction Types to Consider

- **Drag and Drop** - What can be dragged? Where can it be dropped? What happens?
- **Create/Edit Patterns** - How do you create new things? Modal? Inline? New page?
- **Filtering and Sorting** - How do you narrow down lists?
- **Selection Patterns** - Single select? Multi-select? What happens when selected?
- **Modals and Panels** - When do things open in overlay vs inline vs new page?
- **Special Interactions** - Anything unique to this product

### Steps

1. **Propose Interactions:**
   - **Present:** "Here are the key interaction patterns I see..."
   - For each:
     - What the interaction is
     - Where it happens (which screens)
     - How it works
     - What happens as a result

2. **Discuss:**
   - **Ask:** "Do these feel right? Any interactions missing?"

3. **Consistency Check:**
   - "Are we using consistent patterns? (Same action works same way everywhere)"

4. **Advancement Gate:**
   - **Ask:** "Interactions defined?"

5. **Transition:** → Proceed to **Phase 5: Component Inventory**

---

## Phase 5: Component Inventory
**Goal:** Identify reusable UI components.

### Stage-Setting
Announce: *"Phase 5: Component Inventory. Let's identify the reusable UI elements that appear across screens."*

### Component Types

- **Cards** - Idea card, project card, event card, etc.
- **Badges/Tags** - Category tags, status badges, etc.
- **Controls** - Filter dropdowns, search bars, toggles, etc.
- **List Items** - Row types for different lists
- **Calendar Elements** - Day cells, event blocks, etc.
- **Buttons/Actions** - Primary, secondary, icon buttons, etc.

### Steps

1. **Propose Components:**
   - Group by type (Cards, Controls, Badges, etc.)
   - For each:
     - Name
     - What it shows/does
     - Where it's used

2. **Discuss:**
   - **Ask:** "Any components missing? Any that should be combined?"

3. **Advancement Gate:**
   - **Ask:** "Component inventory complete?"

4. **Transition:** → Proceed to **Phase 6: Key User Flows**

---

## Phase 6: Key User Flows
**Goal:** Map out critical paths through the interface.

### Stage-Setting
Announce: *"Phase 6: Key User Flows. Let's map out 3-5 critical user flows step-by-step."*

### What Makes a Good Flow

Choose flows that:
- Exercise core functionality
- Represent common tasks
- Touch multiple screens
- Demonstrate the key interactions

### Flow Structure

For each flow:
- **Name:** What the user is trying to do
- **Start:** Where/when this flow begins
- **Steps:** Numbered sequence of actions and results
- **End:** What state they're in when done

### Steps

1. **Propose Flows:**
   - Identify 3-5 key flows based on Epics and Scenes
   - **Present:** "Here are the key user flows..."

2. **Walk Through Each:**
   - For each flow, detail the steps
   - Which screens are involved
   - What actions they take
   - What happens at each step

3. **Discuss:**
   - **Ask:** "Do these flows capture the main ways people will use this?"

4. **Gaps Check:**
   - Review against Storyboard scenes - is every scene represented in a flow?
   - Review against Epics - does each Epic have flows that exercise it?

5. **Advancement Gate:**
   - **Ask:** "Flows complete?"

6. **Transition:** → Proceed to **Phase 7: Platform Considerations**

---

## Phase 7: Platform Considerations
**Goal:** Capture platform-specific considerations.

### Stage-Setting
Announce: *"Phase 7: Platform Considerations. Quick check on platform-specific needs."*

### Steps

1. **Primary Platform:**
   - **Ask:** "What's the primary platform? Web, mobile, desktop, or all?"

2. **Responsive Behavior:**
   - If web: How does it adapt to different screen sizes?
   - Mobile-first or desktop-first?

3. **Platform-Specific Notes:**
   - Any constraints? (iOS vs Android, browser support, etc.)
   - Any platform-specific patterns to follow?

4. **Capture:** Document any relevant notes.

5. **Transition:** → Proceed to **Phase 8: Assembly**

---

## Phase 8: Assembly
**Goal:** Compile and save the UX/UI Design Brief.

### Stage-Setting
Announce: *"Phase 8: Assembly. I'm compiling everything into the UX/UI Design Brief."*

### Document Structure

1. **Overview** - What this document covers
2. **Screens Inventory** - Table of all screens
3. **Navigation Structure** - Home base, pattern, map
4. **Screen-by-Screen Breakdown** - Each screen detailed
5. **Key Interactions** - Interaction patterns
6. **Component Inventory** - Reusable UI elements
7. **Key User Flows** - Step-by-step flows
8. **Platform Considerations** - Platform-specific notes

### Steps

1. **Draft:**
   - Compile all content into the structure
   - **Present:** "Here's the complete UX/UI Design Brief..."

2. **Review:**
   - **Ask:** "Does this capture everything?"
   - Make adjustments as needed.

3. **Completeness Check:**
   - Every Epic has screens that deliver it?
   - Every Scene is represented in a flow?

4. **Advancement Gate:**
   - **Ask:** "Ready for me to save the UX/UI Design Brief?"

5. **Save:**
   - Write to `.conductor/2-Backlog/Project-Backlog/[ProjectName]/Blueprint/UX-UI-Design-Brief.md`
   - **Confirm:** "UX/UI Design Brief saved."

---

## Completion Protocol

### Summary
- "UX/UI Design Brief is complete for Project `[ProjectName]`."
- Briefly recap: [N] screens, [key navigation], [key interactions]

### Next Steps
- "We now have the WHAT (PRD) and the INTERFACE (UX/UI)."
- "Next is the **Technical Vision** workflow - where we figure out how to build this interface."
- **Ask:** "Ready to continue to Technical Vision? Just say 'Technical Vision' when you're ready."

### Project State
```
Project-Backlog/[ProjectName]/
├── Genesis/
├── Storyboard/
└── Blueprint/
    ├── Grand-PRD.md
    └── UX-UI-Design-Brief.md  ← We are here
```
