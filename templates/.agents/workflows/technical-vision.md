---
description: Technical Vision (Designing the Solution)
---

# Workflow: Technical Vision — Designing the Solution

> **System Instruction:** Upon triggering this workflow, you MUST read the entire content of this file again to load the latest protocols. Do not rely on previous memory.

**Trigger:** "Technical Vision", "Architecture", "How do we build this"
**Goal:** Define the architecture, data model, and tech stack — grounded in the PRD and Design.
**Output:** `blueprint/technical-vision.md`
**Prerequisites:** Grand PRD, UX/UI Design Brief.

---

## Who You Are

You are the Conductor wearing the **Architect hat**. You think in systems — boundaries, interfaces, data flow, and trade-offs. Your job is not to write code. Your job is to make the key decisions that will shape the code.

**Principles:**
- **Simple over Clever:** The best architecture is the one that's easy to change, not the one that anticipates everything.
- **Patterns:** Follow existing codebase conventions if applicable. Don't introduce novelty for novelty's sake.
- **Vision not Spec:** Capture the key decisions and their rationale. Implementation details come in *Spec-It*.
- **Lead with proposals:** You've read all the context — don't ask blank-canvas questions. Propose, then discuss.

**Technique:** Each phase runs `.agents/skills/collaborative-drafting/SKILL.md`'s four moves — propose a complete draft → discuss → coverage-check → converge — with one convergence per phase (a phase's decisions feed the next), not a gate per item. Two borrowed lenses sharpen the architecture:
- **Deep modules (the deletion test).** A good module has a *small interface hiding lots of implementation*. Mentally delete a proposed module: if the system's complexity vanishes, it was a pass-through — inline it; if that complexity would otherwise reappear across several callers, the module earns its place. Judge a boundary by how much its interface hides, not by its line count.
- **The ADR 3-test gate** (from the `domain-modeling` skill): only record a decision as an ADR when **all three** hold — hard to reverse, surprising without context, and the result of a real trade-off. Otherwise capture it inline and move on.

---

## Phase 0: Setup & Load Context

**Goal:** Load everything upstream workflows produced. Ground your decisions in reality.

**Announce:** *"We're entering Phase 0: Setup. Let me load the Blueprint context."*

1.  **Load Context** (Read in this order):
    * `blueprint/grand-prd.md` — The epics and product vision
    * `blueprint/ux-ui-design-brief.md` — The screens, navigation, and interactions
    * `genesis/problem-solar-system.md` — The problem landscape (for constraints and non-goals)
    * `genesis/world-transformation.md` — The vision (for guiding architectural decisions)
    * Any relevant `conductor/4-context/technical/` files (existing tech stack, conventions)

2.  **Analyze Existing System** (if not greenfield):
    * **Review Codebase:** Explore folder structure, patterns, current stack
    * **Identify Reuse:** What components, infrastructure, patterns can we leverage?
    * **Identify Gaps:** What's entirely new and needs to be built?

3.  **Present Context Summary:**
    * *"From the Grand PRD, I see [X] epics covering [scope]. The UX/UI Brief shows [Y] screens with [key interactions]. The problem landscape highlights [constraints]."*
    * Surface any concerns: *"I noticed [tension/gap] between the PRD and the Design."*

4.  **Confirm:** *"Context loaded. Ready to architect?"*
    * Wait for confirmation before proceeding.

---

## Phase 1: Tech Stack

**Goal:** Define the tools and justify each choice.

**Announce:** *"We're in Phase 1: Tech Stack. I'll propose a stack based on the requirements, then we'll discuss."*

1.  **AI Proposes First** — Present a complete stack proposal:

    | Layer | Technology | Rationale |
    |-------|-----------|-----------|
    | **Frontend** | [Framework] | Why this fits the UX/UI Brief |
    | **State Mgmt** | [Tool] | Why this complexity level |
    | **Styling** | [Approach] | Alignment with Design System |
    | **Backend** | [Framework] | Why this for the API patterns needed |
    | **API Style** | REST / GraphQL / tRPC | Trade-off analysis |
    | **Database** | [Technology] | Why this for the data model |
    | **ORM** | [Tool] | Developer experience rationale |
    | **Auth** | [Approach] | Security model basis |
    | **Hosting** | [Platform] | Cost, scalability, DX rationale |

2.  **Discuss Each Layer:**
    * For each: present the choice, the alternative considered, and why you chose this one
    * *"I considered [Alternative] but chose [Choice] because [rationale tied to a PRD/UX requirement]"*

3.  **Dependencies Decision:**
    * For any NEW library: explain why it's needed and what it replaces
    * Apply YAGNI: if you can build it in 20 lines, don't add a library

4.  **Gaps Check:** *"Is there anything about the stack that concerns you? Any constraints I'm missing?"*

5.  **Confirm:** Lock in the stack before moving to Phase 2.

6.  **Dynamic Skill Loading:** Once the stack is confirmed, you MUST autonomously run `conductor search <tech>` and `conductor add <skill-name>` for the chosen technologies. This ensures you have the exact domain skills loaded for the rest of the project.

---

## Phase 2: Data Model

**Goal:** Define the entities, relationships, and how data flows through the system.

**Announce:** *"We're in Phase 2: Data Model. First we'll agree on the language, then the entities."*

0.  **Establish the ubiquitous language first.** Before naming a single entity, invoke the **`domain-modeling` skill** to agree on what the core concepts *are* and what they're *called*. Grill the Grand PRD and UX/UI Brief for nouns, resolve synonyms/homonyms, and capture the result in `conductor/4-context/meta/domain-model.md`. Every entity you propose below MUST use these canonical terms — the data model is the ubiquitous language expressed as tables, not a second, parallel vocabulary.

1.  **AI Proposes First** — Present entities derived from the Grand PRD and UX/UI Brief (named per the domain model):

    For each entity:
    | Field | Entity Name |
    |-------|------------|
    | **Purpose** | Why this entity exists (tied to which Epic) |
    | **Key Fields** | The essential attributes |
    | **Relationships** | How it connects to other entities |

2.  **Relationship Diagram:**
    ```
    [User] 1──N [Order]
    [Order] N──N [Product]
    [Product] 1──1 [Inventory]
    ```

3.  **Integration with Existing Schema** (if not greenfield):
    * Which existing tables/models does this extend?
    * Any migration considerations?

4.  **Discussion Round:**
    * *"Does this model cover every screen in the UX/UI Brief? Let me cross-check..."*
    * Walk through each major screen and verify the data model supports it
    * Surface any screen that needs data the model doesn't have

5.  **Gaps Check:** *"Any entities missing? Any relationships that feel wrong?"*

6.  **Confirm:** *"Data model covers all Epics and supports all screens?"*

---

## Phase 3: Architecture & Integration

**Goal:** Define how the system is structured — components, data flow, and boundaries.

**Announce:** *"We're in Phase 3: Architecture. I'll propose the structure and we'll validate it against the UX flows."*

1.  **Component/Module Breakdown:**
    * High-level modules and their responsibilities
    * Folder structure proposal (if relevant)
    * Component boundaries — what talks to what
    * Apply the **deletion test** to each proposed module (see Principles): keep the ones whose interface hides real, otherwise-duplicated complexity; collapse the shallow pass-throughs.

2.  **Data Flow:**
    * For the 2-3 most important user flows (from UX/UI Brief):
      * Trace the request from UI → API → DB → response
      * Identify where state lives at each step
    * API endpoint design (key endpoints, not exhaustive)

3.  **Integrations:**
    * External services/APIs needed
    * Connections to existing features
    * Event flows / webhooks / real-time needs

4.  **Auth & Permissions:**
    * Security model: who can do what
    * How auth state flows through the system
    * Permission boundaries

5.  **Cross-Check with UX/UI Brief:**
    * *"Let me verify: the UX Brief shows [navigation flow]. The architecture supports this via [component path]."*
    * Flag any UX flow that doesn't have a clear architectural path

6.  **Gaps Check:** *"Any flows that feel uncertain? Any integration concerns?"*

7.  **Confirm:** *"Architecture aligns with all UX flows?"*

---

## Phase 4: Risks & Requirements

**Goal:** Identify what could go wrong and what non-functional requirements matter.

**Announce:** *"We're in Phase 4: Risks & Requirements. Let me surface potential issues."*

1.  **Technical Risks:**
    * Complexity hotspots — parts of the system that are hardest to build
    * Performance bottlenecks —(tied to specific screens/flows from UX/UI Brief)
    * Dependency risks — libraries/services that might be unreliable

2.  **Key Decisions & Trade-offs:**
    * Document each significant decision made in Phases 1-3
    * For each: what was chosen, what was rejected, and why
    * *"We chose [X] over [Y] because [rationale]"*
    * Promote a decision to a standalone ADR only if it passes the **ADR 3-test gate** (hard to reverse ∧ surprising ∧ a real trade-off); otherwise it lives inline here.

3.  **Non-Functional Requirements:**
    * Performance targets (tied to user experience from Storyboard)
    * Scalability needs (from problem scope in Genesis)
    * Accessibility requirements
    * Offline / resilience needs
    * Security requirements beyond auth

4.  **Gaps Check:** *"Any risks I'm not seeing? Any requirements we should add?"*

5.  **Confirm:** *"All risks and constraints captured?"*

---

## Phase 5: Assembly & Review

**Goal:** Compile the Technical Vision document and verify it's complete.

**Announce:** *"Phase 5: Assembling the Technical Vision document."*

1.  **Draft the Document:**
    Compile into `blueprint/technical-vision.md` with these sections:
    * Overview (1 paragraph — what this architecture enables)
    * Tech Stack (table from Phase 1)
    * Data Model (entities + relationships from Phase 2)
    * Architecture (components, data flow, integrations from Phase 3)
    * Risks & Decisions (from Phase 4)
    * Non-Functional Requirements (from Phase 4)

2.  **Completeness Check:**
    * Cross-reference every Epic from Grand PRD — does the architecture support it?
    * Cross-reference every screen from UX/UI Brief — does the data model serve it?
    * If gaps: go back and fill them before saving

3.  **Persona Review (Optional):**
    * *"Want me to put on the CTO hat and stress-test the long-term viability of these decisions?"*
    * If yes: invoke `.agents/personas/CTO.md` for strategic review

4.  **Save:** Create/update `blueprint/technical-vision.md`
    * **Ask:** *"Ready for me to save the Technical Vision?"*

---

## Completion

**Summary:** Recap the stack, data model, key architectural decisions, and identified risks.

**Next Steps:**
- *"The Blueprint is now complete (Grand PRD + UX/UI + Technical Vision)."*
- *"Ready to continue to **Carve** to break this into buildable implementations? Just say 'Carve' when ready."*

---

*Previous Workflow: UX/UI Design Brief · Next Workflow: Carve*
