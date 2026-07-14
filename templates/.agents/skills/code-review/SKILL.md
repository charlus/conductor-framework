---
name: Code-Review
description: Use after implementing code to run a two-stage review — spec compliance first, then code quality. Order matters.
---

# Code Review — Two-Stage Quality Gate

## Core Principle

**Spec compliance FIRST, then code quality.** There's no point reviewing code quality if the implementation doesn't match the spec.

## When to Use

- After implementing each task in the Build workflow
- After completing Quick-Path Phase 4
- Whenever the user asks for a code review

## Stage 1: Spec Compliance

**Question:** "Did we build what was requested?"

### Checklist

1.  **Re-read the Feature Spec** (or acceptance criteria)
2.  **For each requirement, verify:**
    - Is it implemented? → Where? (cite the file and function)
    - Is it tested? → Where? (cite the test)
3.  **Check for over-building:**
    - Did we add anything NOT in the spec? → Flag it
    - Extra features, extra endpoints, extra UI elements? → Remove or flag
4.  **Check for under-building:**
    - Any requirement NOT implemented? → Flag it
    - Any edge case mentioned in the spec but not handled? → Flag it

### Output Format

```
## Spec Compliance Review

✅ Requirement 1: [Description] — Implemented in [file:line]
✅ Requirement 2: [Description] — Implemented in [file:line]
❌ Requirement 3: [Description] — NOT IMPLEMENTED
⚠️ Extra: [Description] — Not in spec, should we keep it?

Verdict: PASS / FAIL (with gaps listed)
```

**If FAIL:** Fix the gaps, then re-run Stage 1. Do NOT proceed to Stage 2 until Stage 1 passes.

---

## Stage 2: Code Quality

**Question:** "Is it well-built?"

Only run this AFTER Stage 1 passes. Code that doesn't match the spec is wasted code — quality doesn't matter yet.

### Checklist

1.  **Readability:**
    - Are names clear and descriptive?
    - Is the code easy to follow without comments?
    - Are complex sections commented?

2.  **Patterns:**
    - Does it follow existing codebase conventions?
    - Are there inconsistencies with how similar things are done elsewhere?

3.  **Error Handling:**
    - Are errors caught and handled appropriately?
    - Are error messages helpful?
    - Are edge cases handled?

4.  **Performance:**
    - Any obvious N+1 queries?
    - Any unnecessary re-renders or re-computations?
    - Any missing indexes on queried fields?

5.  **Security:**
    - Input validation present?
    - Auth checks in place?
    - No secrets in code?

6.  **Testing:**
    - Are tests meaningful (not just "it runs")?
    - Do tests cover the important paths?
    - Are test names descriptive?

7.  **Refactoring (cross-cutting):**
    - Now that the whole change is visible, is there duplication, a leaky abstraction, or a seam that per-task refactoring couldn't see?
    - This is a **second look, not the first.** The mandatory REFACTOR step already ran per increment inside the TDD loop (`workflows/tdd-cycle.md`, `rules/test-driven-law.md`); review-stage refactoring catches only what's visible across the assembled change. It never replaces the in-loop step, and any refactor here must keep the suite GREEN.

### The smell baseline

When judging quality, carry this fixed baseline of code smells (from Fowler). Each is a **judgement call, not a hard violation** — name it as "possible X" and pair it with the fix:

| Smell | What it is → how to fix |
|-------|-------------------------|
| Mysterious Name | Name doesn't say what it is/does → rename |
| Duplicated Code | Same structure in >1 place → extract |
| Long Function / Feature Envy | A function more interested in another module's data → move it there |
| Data Clumps / Primitive Obsession | The same fields travel together, or primitives model a domain concept → introduce a type |
| Repeated Switches | Same switch on a type in many places → polymorphism |
| Shotgun Surgery / Divergent Change | One change touches many modules, or one module changes for many reasons → regroup responsibilities |
| Speculative Generality | Abstraction for a need that never arrived → inline it (YAGNI) |
| Message Chains / Middle Man | `a.b().c().d()`, or a class that only delegates → collapse |

Two rules on top of the baseline:
- **The repo overrides.** Documented project conventions (`conductor/4-context/`, existing patterns) win over the baseline.
- **Skip what tooling enforces.** Don't hand-flag formatting, lint, or type errors the linter/formatter/compiler already catches — that's noise, not review.

### Output Format

```
## Code Quality Review

### Strengths
- [What's well done]

### Issues
- 🔴 Critical: [Must fix before merging]
- 🟡 Important: [Should fix]
- 🟢 Nit: [Nice to have]

Verdict: APPROVED / CHANGES REQUESTED
```

**If CHANGES REQUESTED:** Fix the issues, then re-run Stage 2. Repeat until approved.

---

## Review Loop Rules

1.  **Never skip re-review.** If you fixed issues, run the review again
2.  **Never combine stages.** Spec first, quality second. Always
3.  **Never self-approve silently.** Report the review output explicitly
4.  **Reviewer found issues = not done.** No exceptions
