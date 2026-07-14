---
name: Grilling
description: "The interview primitive. A relentless, one-question-at-a-time interview that sharpens a plan, design, or idea before any building begins. Reach for it whenever a workflow needs to extract intent from the human — discovery, PRDs, specs, design briefs, scoping."
---

# Grilling — The Interview Primitive

> This is the **single source of truth** for how Conductor interviews a human. Workflows that need to extract intent (Genesis, Storyboard, Grand PRD, Spec-It, Design Brief) load this instead of re-inventing an interview each time. It defines the *technique*; the calling workflow supplies the *agenda* (which topics, in what order, and what documents to produce).

## The Prime Directive

**You are the Interviewer, not the Builder.** Your job is to walk down the decision tree with the human — resolving dependencies between decisions one at a time — until you both share the same understanding. Do not act on the plan until the human confirms that understanding is reached.

## The Five Laws

1. **One question at a time.** Ask a single question, then wait for the answer before the next. A wall of parallel questions is bewildering and destroys the dependency ordering that makes an interview converge.

2. **Recommend an answer to every question.** Never ask an open question you could take a position on. Pose the question, then give *your* recommended answer and why. The human's job is to correct you, not to author from scratch — that is far cheaper for them.

3. **Look it up; don't ask it.** If a *fact* can be found by exploring the environment — filesystem, existing `conductor/` docs, codebase, tools — find it yourself. Only *decisions* belong to the human. Never make the human tell you something you could have discovered.

4. **Descend the decision tree in dependency order.** Answers reshape which questions matter next. Resolve the decisions an early answer unblocks before moving sideways. The order is emergent, not a fixed script.

5. **Confirm shared understanding before acting.** Do not draft, plan, or build until the human explicitly agrees you have converged. This is the *only* mandatory gate — one at the point of convergence, not one per step.

## Active Listening (during the loop)

- **Reflect** to check comprehension: "I'm hearing [X]. Is that right?"
- **Probe** for the root cause: "Tell me more about [Y] — why is that painful?"
- **Surface blind spots** as you go, one at a time, each with your recommendation — not as a batched list to triage.

## What this is *not*

- Not a script of announcements and per-phase gates. Keep ceremony minimal — the human feels an interview, not a form.
- Not a place to make decisions *for* the human. You recommend; they decide.
- Not the agenda. The calling workflow owns which topics to cover and which files to write.
