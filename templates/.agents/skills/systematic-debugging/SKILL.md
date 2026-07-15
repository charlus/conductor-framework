---
name: systematic-debugging
description: 4-phase systematic debugging methodology with root cause analysis and evidence-based verification. Use when debugging complex issues.
allowed-tools: Read, Glob, Grep
---

# Systematic Debugging

> Source: obra/superpowers

## Overview
This skill provides a structured approach to debugging that prevents random guessing and ensures problems are properly understood before solving.

> **The prime move: build the red command first.** The heart of debugging is a *tight feedback loop* — a single command you can run that goes **red on this exact bug**. Everything after it (isolating, hypothesizing, fixing) is mechanical once the loop exists. **If you catch yourself reading code to build a theory before the red command exists, stop and build the command.**

## 4-Phase Debugging Process

### Phase 1: Reproduce — build a command that goes red on this bug
Before fixing, before theorizing, get a loop that fails on demand.

**Pick the tightest loop you can build, in rough preference order:**
1. A failing automated test 2. a `curl`/HTTP call 3. a CLI invocation + output snapshot 4. a headless-browser script 5. a replayed trace/log 6. a throwaway harness 7. a property/fuzz test 8. `git bisect` 9. a differential run (works-here vs breaks-there) 10. a human-in-the-loop script (last resort).

**Then tighten it like a product:** faster, sharper signal, more deterministic, runnable by an agent unattended. For a **non-deterministic** bug, don't chase a clean repro — raise the *reproduction rate* (loop it, seed it, remove noise) until the signal is reliable enough to act on.

```markdown
## The Red Command
- Command: [the one command that reproduces the bug]
- Red because: [the exact failing observation — assertion, status, output diff]
- Reproduction rate: Always / Often / Sometimes / Rare  → (if not Always, how it was raised)
```

### Phase 2: Isolate
Narrow down the source.

```markdown
## Isolation Questions
- When did this start happening?
- What changed recently?
- Does it happen in all environments?
- Can we reproduce with minimal code?
- What's the smallest change that triggers it?
```

### Phase 3: Understand
Find the root cause, not just symptoms.

**List 3–5 falsifiable hypotheses and rank them *before* testing any.** A hypothesis is falsifiable only if you can name the observation that would kill it. Tag any debug logging with a unique marker (e.g. `[DEBUG-a4f2]`) so a single grep removes it all afterward, and **instrument one variable per run** so no result is ever confounded.

**How to test them — one at a time, or fan out?**
- **Few hypotheses, cheap to check, or an obvious front-runner** → test against the red command **sequentially**, top-ranked first. This is the default and the graceful-degradation floor when no sub-agent primitive exists.
- **3–5 genuinely independent hypotheses, each non-trivial to investigate** → **fan out one empty-context scout per hypothesis** (`.agents/skills/subagent-isolation/SKILL.md`). Each scout gets *only* the red command, its *one* assigned hypothesis, and that hypothesis's kill-criterion — and runs in its **own isolated context (a separate git worktree if it instruments code)** so their probes never confound each other and no scout anchors on another's theory (the blind spots are the point). Each returns a verdict — **killed** (with the observation that killed it) or **survived** (with the supporting evidence) — *never* a "the fix is…" claim.

**Merge the verdicts (the orchestrator does this, not a scout):**
- **Exactly one survivor** → that's your lead; drive the 5 Whys on it.
- **None survived** → the hypothesis set was wrong. Run a completeness pass — *"what did none of us look at?"* — and generate a fresh ranked set.
- **Several survived** → either they aren't truly independent, or it's a compound cause. Refine and re-test; don't pick one arbitrarily.

**Re-confirm before trusting it.** A scout's verdict is a lead, not proof — the accountable agent re-runs the red command against the surviving hypothesis itself (`.agents/rules/verification-iron-law.md`). Route hard or high-stakes investigations to a strong model tier (`.agents/skills/model-routing/SKILL.md`); a weak scout that clears a hypothesis is a false all-clear. Then use the 5 Whys to drive from the confirmed symptom down to the root cause.

```markdown
## Hypotheses (ranked, falsifiable)
1. [Most likely] — killed if: [observation]  → tested [seq | scout]: killed / survived
2. [Next] — killed if: [observation]         → tested [seq | scout]: killed / survived
...

## Root Cause (via 5 Whys)
1. Why → ... 5. Why → [root cause]
```

### Phase 4: Fix & Verify
**Write the regression test *before* the fix** — it should go red now (it's your red command, promoted to a permanent test) and green once fixed. **If there's no correct seam to attach that test to, that itself is a finding:** the bug is telling you the architecture is wrong there — surface it (hand to `architecture-patterns` / a refactor) rather than forcing a brittle test. State the winning hypothesis in the fix commit message.

```markdown
## Fix Verification
- [ ] Regression test written first, went red, now green
- [ ] Bug no longer reproduces via the red command
- [ ] Related functionality still works
- [ ] No new issues introduced
- [ ] (If no seam existed) architectural finding recorded
```

## Debugging Checklist

```markdown
## Before Starting
- [ ] Can reproduce consistently
- [ ] Have minimal reproduction case
- [ ] Understand expected behavior

## During Investigation
- [ ] Check recent changes (git log)
- [ ] Check logs for errors
- [ ] Add logging if needed
- [ ] Use debugger/breakpoints

## After Fix
- [ ] Root cause documented
- [ ] Fix verified
- [ ] Regression test added
- [ ] Similar code checked
```

## Common Debugging Commands

```bash
# Recent changes
git log --oneline -20
git diff HEAD~5

# Search for pattern
grep -r "errorPattern" --include="*.ts"

# Check logs
pm2 logs app-name --err --lines 100
```

## Anti-Patterns

❌ **Random changes** - "Maybe if I change this..."
❌ **Ignoring evidence** - "That can't be the cause"
❌ **Assuming** - "It must be X" without proof
❌ **Not reproducing first** - Fixing blindly
❌ **Stopping at symptoms** - Not finding root cause
❌ **Confounded parallel probes** - Fanning out scouts that share one working tree; each needs its own isolated context or their instrumentation collides
❌ **Trusting a scout's "found it"** - A cleared hypothesis is a lead; re-run the red command yourself before acting on it
❌ **Fanning out a one-liner** - Parallel scouts for an obvious bug is overhead; sequential is the default
