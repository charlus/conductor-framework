# Personas as an engineering team

> **Status (2026-10-06):** built on `feat/persona-lens-map` (change 1) and `feat/persona-team` (change 2, stacked). Unit and self-test suites green. **Not verified in a live agent run**: no eval proves an agent follows the new workflow steps.

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

## Open

- A live eval (`test/evals/`) that an agent in Build actually runs `conductor personas` and reads the listed personas.
- The path rules are a guess. Performance by path is weak. Projects tune them under `personas` in `conductor.config.json`.
