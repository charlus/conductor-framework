---
name: Verification-Gate
description: Use this skill when about to claim any work is done. Enforces the Verification Iron Law — evidence before assertions, always.
---

# Verification Gate

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command **in this message**, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## When to Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY positive statement about work state
- Completing a workflow phase
- Completing a build task
- Moving to next task
- Claiming a bug is fixed

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Phase complete | All acceptance criteria verified | "Tests pass" |

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Red Flags — STOP

If you catch yourself using any of these words without evidence, STOP:
- "should", "probably", "seems to"
- "Great!", "Perfect!", "Done!"
- "looks good", "seems fine"
- "I'm confident that..."

**The bottom line:** Run the command. Read the output. THEN claim the result.

This is non-negotiable.
