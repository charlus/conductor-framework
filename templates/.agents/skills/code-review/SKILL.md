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
