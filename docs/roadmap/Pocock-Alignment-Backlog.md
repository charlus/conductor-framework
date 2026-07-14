# Pocock-Alignment Backlog

> Task backlog derived from the in-depth comparison of Conductor's workflows against
> [Matt Pocock's skills](https://github.com/mattpocock/skills). Direction: **light-by-default,
> extract primitives, fewer gates.** Each task names the Pocock lever it borrows.
>
> Status legend: ☐ open · ◐ in progress · ☑ done

---

## Epic A — Extract interview/drafting primitives & migrate the interview family

The interview-family workflows duplicate four blocks (Communication Style, Advancement Gate,
Propose→Discuss→Gaps-Check→Confirm, Stage-Setting announcements). Kill the duplication by
extracting primitives and having the workflows *inherit* technique, keeping only their agenda +
templates. This mirrors the already-shipped `genesis` refactor.

- ☑ **A0 — `grilling` primitive + genesis refactor** *(shipped, PR #1)*
  Extracted the interview technique to `skills/grilling/SKILL.md`; genesis loads it, ~40% ceremony removed.

- ◐ **A1 — Extract `collaborative-drafting` primitive** — *P1, S*
  Factor the "AI proposes first → discussion round → gaps/coverage check → single confirm" quartet
  (present in carve, grand-prd, technical-vision, ux-ui, quick-path) into `skills/collaborative-drafting/SKILL.md`.
  This is the document-scale counterpart to grilling — "recommend, don't ask" (Pocock principle #1).
  *Acceptance:* skill exists, registered in `registry.json` + `check-conductor.sh`, self-test green.

- ◐ **A2 — Migrate `ux-ui-design-brief` onto the primitives** — *P1, M* — *highest-value single target*
  448 lines, **7 Advancement Gates**. Load `grilling` + `collaborative-drafting`; delete all 7 per-phase
  gates (replace with one convergence gate per saved document); collapse the 9 Stage-Setting scripts to
  one-line phase markers; keep the agenda (screens → nav → breakdown → interactions → components → flows →
  platform) and the design principles. *Lever:* fewer gates ("push right", Pocock #9).

- ◐ **A3 — Migrate `storyboard` onto the primitives** — *P1, M*
  Remove Communication Style block, 2 Advancement Gates + 2 "STOP: wait for approval" pairs → single
  per-doc gate; trim Stage-Setting/transition boilerplate. Keep Main Character + Scenes agenda and templates.

- ◐ **A4 — Migrate `grand-prd` onto the primitives** — *P1, M*
  Remove Communication Style block, 3 Advancement Gates; keep Path A/B/C context branching (it's real logic),
  Epic agenda and template. Load `grilling` + `collaborative-drafting`.

- ☐ **A5 — Point `quick-path` & `retrospective` interview bits at `grilling`** — *P2, S*
  Both already do "ask one at a time" inline and are otherwise light. Replace the inline instruction with a
  one-line load of the primitive. No structural change — just DRY.

---

## Epic B — Rethink spec-it (synthesize, don't re-interview)

- ☐ **B1 — Split `spec-it` into grill-then-synthesize** — *P2, M*
  Pocock splits this into `grilling` (interview) **then** `to-spec` (**synthesize the conversation — no
  interview**). Today spec-it re-interviews even when a grilling/blueprint session just happened. Rework so
  spec-it, when run with fresh context, drafts the Feature Spec + Implementation Plan from that context and
  only grills to fill genuine gaps. *Lever:* `to-spec` "no interview"; context hygiene (Pocock #9/#10).
  *Acceptance:* spec-it no longer duplicates the interview when context is present; still produces both docs.

---

## Epic C — Content upgrades to already-good execution workflows

These workflows are the right *shape* under the new direction; borrow sharper *content* only.

- ☐ **C1 — Sharpen `tdd-cycle` with Pocock `tdd`** — *P2, S* — *best ROI content borrow*
  Add: (1) **agree the test seams first** (highest useful seam, ideal count = 1), (2) **refactoring is NOT
  part of the red-green loop — it belongs to review**, (3) named anti-pattern tells: **implementation-coupled**
  (mocks internals, breaks on refactor w/o behavior change), **tautological** (assertion recomputes expected
  the way code does), **horizontal slicing** (all tests then all impl). Keep the file a light primitive.

- ☐ **C2 — Give `build` a two-axis review + Fowler smell baseline** — *P3, M*
  Pocock `code-review` runs spec-axis and standards-axis as **parallel sub-agents so contexts don't pollute**,
  with a fixed **12-Fowler-smell baseline** (each read as *what it is → how to fix*, always a judgement call,
  repo overrides). Fold into build's Two-Stage Review step.

- ☐ **C3 — Borrow smell baseline + merge-conflict discipline into `ship`** — *P3, S*
  Reuse the C2 smell baseline in ship's Empathy Audit; add `resolving-merge-conflicts` discipline (find primary
  sources for each side's intent; always resolve, never `--abort`) to the Git Flow phase.

- ☐ **C4 — `technical-vision`: deep-module vocabulary + ADR 3-test gate** — *P2, M*
  Borrow `codebase-design`'s **deletion test** and **"depth = interface, not line-count"** framing for
  architecture calls, and `domain-modeling`'s **ADR 3-test gate** (hard-to-reverse ∧ surprising ∧ real-trade-off)
  to decide *when* to record a decision. Also extract the shared quartet (A1) here.

- ☐ **C5 — `carve`: extract quartet + wide-refactor sequencing** — *P3, S*
  Adopt A1's `collaborative-drafting`; add `to-tickets`' **expand → migrate-in-batches → contract** sequencing
  for wide refactors and "work the frontier" language for dependency ordering.

- ☐ **C6 — Trim shared sediment across all workflows** — *P3, S*
  Collapse the 11× verbatim "re-read this file" header and the 11× Stage-Setting/Announce boilerplate to
  minimal form (Pocock "No-op"/"Sediment" failure modes). Do opportunistically as each file is touched.

---

## Epic D — Net-new skills Conductor lacks

- ☐ **D1 — Evaluate `diagnosing-bugs` vs `systematic-debugging`** — *P2, M*
  Pocock's framing: **"build a command that goes red on *this* bug first — that IS the skill; everything else is
  mechanical."** Plus 10 ranked repro methods and 3–5 falsifiable hypotheses *before* touching code. Compare to
  our `systematic-debugging` skill and adopt the sharper bits.

- ☐ **D2 — Add a `handoff` skill + context-hygiene rule for the loop** — *P2, M* — *V6-relevant*
  Pocock's `handoff` (fork to a fresh agent with a summary doc) + the **"smart zone (~120k tokens)"** rule —
  hand off *before* reasoning degrades; keep grill→spec→tickets in one window; each implement starts fresh.
  Directly useful to the V6 **unattended-loop** for context management. See `Autonomous-Loop-Backend.md`.

- ☐ **D3 — Adopt `to-tickets` tracer-bullet patterns** — *P3, S*
  "Each ticket cuts a narrow but complete vertical path, demoable alone, sized to one context window; declare
  blocking edges; work the frontier." Mostly reinforces carve (C5); consider a standalone reference.

---

## Epic E — Audit lens

- ☐ **E1 — Grade all skills/workflows with `writing-great-skills` failure modes** — *P3, M*
  Audit every `.agents/skill` and `workflow` for **No-op** (line the model already obeys), **Sediment** (stale
  layers), **Sprawl**, **Negation** ("don't do X" instead of the positive), **Premature completion** (fuzzy
  criteria). North star: **predictability of *process*, not output.** Produces a prune list.

---

## Priority summary

| Do now (P1) | Next (P2) | Later (P3) |
|---|---|---|
| A1, A2, A3, A4 | A5, B1, C1, C4, D1, D2 | C2, C3, C5, C6, D3, E1 |

**Sequencing note:** A1 → (A2, A3, A4) is the genesis pattern repeated and removes ~14 gates plus 4 duplicated
blocks in one pass. Everything in Epic C is additive and can follow independently.
