---
name: Handoff
description: "Compact the current conversation into a handoff document a fresh agent (or a later session) can pick up cleanly. Use when context is getting long, before reasoning quality degrades, or when passing work between loop iterations or sessions."
---

# Handoff — Pass the Baton Cleanly

A long conversation degrades: the more tokens in context, the worse the reasoning near the end. The fix is to **hand off before that happens** — write down what matters, then let a fresh agent continue with a clean context.

## The smart zone

Effective reasoning lives in a **smart zone** — roughly the first ~120k tokens of a context window. Past it, recall and judgement fall off even when the window technically has room. So:

- **Hand off *before* you leave the smart zone**, not after quality has already dropped.
- **Keep one coherent chain of work in one window.** A discovery → spec → tickets chain wants continuity — do it in one session. But a fresh *build* of a well-specced ticket should start clean: the spec is the contract, the exploration that produced it is noise.
- Prefer **many short, focused sessions** over one sprawling one.

## When to hand off

- Context is long and you're mid-task (approaching the smart zone).
- You're moving from *planning* to *doing* (the planning transcript is dead weight for the doer).
- The loop is starting a new iteration/implementation that doesn't need the last one's transcript.
- A human or another agent will take over.

## Writing the handoff

Write a self-contained handoff document — the reader has **none** of your context. Save it to the workbench (`conductor/1-workbench/handoff-[topic].md`) so it survives the session; for a throwaway fork, a temp path is fine.

Include:
1. **Goal** — what we're ultimately trying to achieve (one paragraph).
2. **State** — what's done, what's in progress, what's left. Be concrete.
3. **Key decisions** — what was decided and *why*, so the next agent doesn't relitigate. Link the relevant `conductor/` docs, ADRs, and files **by path — do not paste their contents**; the next agent reads them fresh.
4. **Next action** — the single most important thing to do next, stated so precisely the reader could start without asking a question.
5. **Suggested skills/workflows** — which Conductor workflow or skill fits the next step (e.g. "run `build.md` on implementation 03").
6. **Traps** — anything that already burned time; what not to retry.

Rules:
- **Reference, don't duplicate.** Point at artifacts by path/URL; never copy large content into the handoff.
- **Redact secrets** — no tokens, keys, or credentials in the document.
- **The next action must be unambiguous** — if a fresh reader would have to ask "what did you mean?", it isn't done.

## In the autonomous loop

The unattended loop (`.agents/workflows/unattended-loop.md`) should hand off between iterations rather than carry an ever-growing transcript: persist the durable state (see `loop-state.json`), write a handoff for anything not captured there, and let the next iteration start in the smart zone. This keeps long headless runs reasoning at full strength instead of degrading over time.
