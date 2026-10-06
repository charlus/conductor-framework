# Personas as an engineering team

> **Status (2026-10-06):** shipped in 6.8.0 (#53 `conductor personas`; #54 team behaviour and the Architect, #55 DESIGN.md, both landed on master through #56 with the UX brief changes and the eval). Measured by `test/evals/persona-eval.mjs`: results below.

## Problem

No workflow loaded a persona file except Deepen (Code Archaeologist), the loop Checker, and an optional CTO offer whose path was wrong. Build wrote UI without the Designer and auth code without the Security Auditor. The product owner saw working but ugly software. Second cause: no workflow filled `conductor/4-context/design/design-system.md` before Build.

## Decisions

| | Decision |
|---|---|
| Change 1 | `conductor personas [paths…]` maps changed paths to Designer, Security Auditor, Database Architect, Performance Optimizer (`src/personas.js`). Build loads them per task and asks for a design system first when the file is still the template. The reviewer gets only each persona's **Review Lens** lines, so `reviewer.md` stays one file and Rubric v2 is unchanged. |
| Change 1 | Maker and Tech Lead removed: Build and code-review already carry them. The Architect was removed too, then restored as a challenger (below). |
| O1 | Spec-It turns each triggered persona's Review Lens into acceptance criteria, so Build writes tests for them. |
| O2 | Technical Vision loads `architecture-patterns` in Phase 3 and runs a Lens Pass with the Architect first (modularity, coupling, portability, failure modes), then Database Architect, Security Auditor, Performance Optimizer, and CTO when the stack adds a vendor. Replaces the optional "want the CTO hat?" question. |
| O3 | Genesis and Grand PRD run the Lens Pass with the Product Manager only. The technical ban holds. |
| O4 / D3 | Grilling's **Lens Pass**: one agent, one persona at a time, at most two questions per persona. Engineering answers become recorded **Lens decisions**, not questions. |
| D1 | Conflicting findings: the author settles them in the order security and data integrity, acceptance criteria, architecture, performance, design (`PRECEDENCE` in `src/personas.js`). The review log refuses a reversed override without `po_decision: true`. |
| Architect | Restored as a challenger, not an author: the Technical Vision author designs, nobody challenged modularity or portability. Triggered in Build and Ship by a dependency manifest change. Ranked after acceptance criteria, before performance: maintainability outlives an optimisation that can come later behind a good boundary. |
| D2 | The product owner is asked only when every option changes what the user sees or does. |
| D4 | `conductor review-log summary` shows per persona how many findings lost a conflict. A lens that loses more than half (n ≥ 3) is a calibration defect. |
| R1 | After the delta round, only security and data-loss blockers go to the human. Others are fixed or recorded as known gaps in the PR. The autonomous loop is unchanged: its Checker verdict and fail-safe are as before. |

## DESIGN.md (change 3, `feat/design-md`)

| | Decision |
|---|---|
| D5 | One `DESIGN.md` at the code repository root (the nested repo in the outer layout) replaces `conductor/4-context/design/` and its three files. It travels with the code. Values live once in the token file that DESIGN.md names. |
| D6 | The UX/UI Brief creates it (Phase 8), approved by the product owner with the brief. Build creates it as a fallback (brownfield: extracted from the code). |
| Skill | `design-system`: greenfield, brownfield and migration modes. Tool-agnostic successor of the Stitch `design-md` skill, which came from google-labs-code/stitch-skills and was removed in `2886fab`. |
| Migration | `conductor design migrate` maps every section of the old files to the DESIGN.md structure by heading, drops sections still equal to the shipped template (`src/retired-design-templates.json`), refuses to overwrite a DESIGN.md, and turns each migrated file into a pointer. Upgrade never touches `conductor/`: it prints a hint. |

## Measured (2026-10-06, `test/evals/persona-eval.mjs`)

- Agents follow the persona step: Designer and design rules read before the first write 9/9 on the branch, 0/9 on master. Cutting the step from `build.md` drops it to 0/3 (sensitivity).
- No difference in CSS quality: both arms wrote token-only CSS in every scenario (n=3 to 9). The drift scenario's graded metric failed.
- Reported, not graded: with no written rules, the branch added an empty state 3/3 (master 0/3) and created DESIGN.md first 3/3.
- **F13 found and fixed:** Build never read the UX/UI Brief, so the screen design reached code only through the spec's summary. Build's Phase 0 now reads the brief for the screens it touches, and the Designer's Review Lens checks layout order and hierarchy against it.

## From a real project (autopportunity, 2026-10-06)

Twelve slices built, then 20 production screenshots, 30 findings, five rework slices. Root causes: Build never read the brief (fixed, F13); the brief specified function, not experience (A1); the design docs were a philosophy, not a system (A2); unknown values shown as answers and one-off components (A3); nobody looked at a rendered screen before the owner (A4). A1 to A3 shipped. **A4, the per-slice visual review, is off by default by owner decision (cost and speed)**: Build offers it in one line, `ux-reviewer` holds the how.

## Open

- A UX eval: a screen-sized task with a UX brief, deterministic structure checks, and a blind side-by-side judgement by the product owner. The current eval cannot see layout, hierarchy or flow.
- The path rules are a guess. Performance by path is weak. Projects tune them under `personas` in `conductor.config.json`.
