# F8 — Agent-proximity admission control

> **Status:** blocked on an input we do not have, 2026-09-22. **Not built, and
> deliberately so.** The merge-time half of the value already shipped as F7
> (`8587ab4`). What remains needs either a declared file scope per task or a
> mid-beat checkpoint, and this repo has neither. Recorded so the next person
> does not rediscover it, or worse, build the metric anyway.

## The idea, and why it looked right

ECC's `scripts/lib/agent-proximity/` is the one genuine invention in that repo:
a collision metric for several agents working one codebase. Each agent has a
working set of files, edited line ranges and a recency weight; pairwise risk is
computed over three channels — line-range overlap (Szymkiewicz–Simpson),
import-graph coupling decaying with graph distance, and directory-tree
proximity — combined with a noisy-OR, then escalated as a traffic advisory and
a resolution advisory before the git layer ever sees a conflict. It is MIT, it
is fully computed, and it answers a question our swarm never asks: **may these
two workers run concurrently at all?**

## Why it does not fit our dispatch model

ECC computes proximity for agents that are **already running** — their working
sets are observable because they have already edited things. Our swarm decides
concurrency **before** anything has been edited:

```
computeFrontier(tasks) → wave = frontier.slice(0, concurrency) → Promise.all(dispatch)
```

At the moment `wave` is chosen, a task is `{id, type, title, source, route,
priority, deps, role, verify, worktree}`. Verified by reading `normalizeTask`
in `src/loop/swarm.js`: **there is no file scope on a task, and nothing
produces one.** `carve.md` slices by user-visible value and records "Screens
Involved", never paths. The harvester carries no paths either.

So the metric has no input. Building it now would produce exactly what this
programme criticised ECC for twice: a well-engineered library with no consumer
(`eval-harness/`, `agent-proximity/` itself — computed, served, never acted on).

The other intervention point does not exist either. A wave runs to completion
under `Promise.all` and merges afterwards, so there is no mid-flight moment at
which two running workers could be deconflicted. Between waves, nothing is in
flight.

## What actually closed the gap

F7 took the merge-time half: `git merge-tree` against the object store, clean
branches land first, the colliding one is escalated by name with no doomed PR.
That is where the *detectable* collision lives today, and it needed no new
input because by then the branches exist.

What F7 does **not** buy is the wasted work: two workers can still spend a full
beat each on the same file and only then be told one of them collided.

## The two ways to unblock it, and which is right

**A — declare the scope.** Have `carve` / `spec-it` emit an expected file scope
per slice, and admit a wave only when the pairwise scopes are disjoint.
Cheap to implement, and wrong in the way this framework is usually wrong: it
trusts a self-report. An agent's guess at which files it will touch is exactly
the kind of claim the Evidence Rule exists to distrust, and a confident wrong
scope is worse than none — it would green-light the collision it was added to
prevent.

**B — observe the first beat.** Split the wave: run beat 1 for every task, then
read each worktree's real diff (`git -C <wt> diff --name-only` plus
`--porcelain` for untracked), compute proximity on **facts**, and pause the
lower-priority task before beat 2. No declaration, no guessing — the same
stance as the evidence ledger, which grades a run by its exit code rather than
its self-report.

**B is the right answer** and it is not small: it means restructuring
`runSwarm`'s wave from one `Promise.all` into a checkpointed loop, with the
budget and stall accounting following it. That is a change to the orchestrator's
core scheduling, which is the part the safety envelope rests on.

## Recommendation

Leave F8 unbuilt until the swarm has driven real parallel work and the wasted
beats are *measured* rather than assumed. The swarm is still opt-in and marked
unproven on real tickets in `src/loop/swarm.js`'s own header; adding
checkpointed scheduling to an unproven scheduler optimises a cost nobody has
paid yet.

When it is measured and the cost is real, build B, and take ECC's channel model
rather than inventing one — the noisy-OR over overlap, import coupling and tree
distance is sound, and the right-of-way rule (more progress, then earlier
start, then stable id) makes the two sides pick different moves without
negotiating. Do not take the advisory/resolution staging: it is a two-stage
protocol for aircraft that cannot stop, and our workers can simply wait.
