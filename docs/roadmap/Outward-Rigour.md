# Outward Rigour — challenging the brief, not only the code

> **Status:** SHIPPED 2026-09-16, branch `feat/outward-rigour`. D1–D4 answered by the maintainer on PR #28, all four as recommended: enforce presence, extend `grilling`, non-blocking, current project only. D2 carried an addition that shaped the design — *"what's gold is the common understanding"* — so the shared understanding reached at convergence is now written into `feature-spec.md`, not merely agreed out loud.
> **In:** C1–C4 in the `grilling` primitive, the brief check in Genesis / Quick-Path / Spec-It, the `## Brief check` + shared-understanding section in the `feature-spec` template, and a `pre-commit` presence gate (`conductor_is_brief_doc` + `conductor_has_brief_check`, waiver `CONDUCTOR_NO_BRIEF`). Behaviour tests: `test/outward-rigour.test.js` (11) + `test/hooks-brief-gate.sh` (5).
> **Deferred:** the challenge ledger (see *Measurement*). Not folded into `review-log` because that ledger's ~10-ship review measurement started on 2026-09-15 and mixing C1–C4 rows into it would corrupt the numbers the maintainer is waiting on.
> Origin: the maintainer's framing, 2026-09-16 — *"the framework is here to ensure engineering rigour to a PO's ambition and vision. The agent acts as the engineering team a PO needs to ship a great product."*
> Companion: A3 shipped the input half (PR #27 — the interview asks product questions, the agent decides engineering). This is the output half.
> Depends on nothing. Blocks A4 (ship-report and PR-description shape), because what the report must carry is decided here.

## The one-line thesis

Every gate Conductor owns is **inward**: TDD, the Eval-Driven Law, the evidence ledger, `independent-review`, the Checker. All of them prove the code does what the spec says. **Nothing checks whether the spec was worth building.** A framework that only executes faithfully ships the PO's bad ideas with excellent test coverage.

## Why this matters more here than in a normal team

A PO with an engineering team gets challenged for free, constantly, by people who will have to live with the decision. A PO running 4–6 products against an agent fleet gets none of that. The agent is fast, compliant and has no stake in the outcome, so a contradiction between the March brief and the September brief simply gets implemented twice.

## What "outward rigour" is bounded to

The framework has already been burned once by an **unbounded** question. The independent-review gate never converged because the reviewer was asked something with no natural end (`memory/review-loop-root-cause.md`); rubric v2 fixed it by bounding what counts as a BLOCKER. Do not repeat the mistake here.

So the agent is **never** asked "is this a good idea?". It is asked to detect four specific, checkable conditions:

| # | Condition | How it is detectable |
|---|---|---|
| C1 | Contradicts a decision the human made earlier | Read prior `conductor/` docs — genesis, PRDs, specs, ship-logs. Conductor already stores them. This is the strongest signal and the cheapest. |
| C2 | Breaks something for existing users | Compare the brief against shipped acceptance criteria in `conductor/2-implementations/` and the codebase's current behaviour. |
| C3 | Cost or duration is far from what the brief assumes | The brief names a size or a deadline; the plan's phase count and the touched surface say otherwise. |
| C4 | We lack the data, the access or the rights | Named integration, dataset, credential or licence that is absent from `conductor/4-context/` and from the environment. |

Anything outside C1–C4 is not a challenge, it is an opinion, and the agent keeps it.

## Where it attaches

1. **Entry points** — Genesis, Quick-Path, Spec-It. Before the convergence gate, the agent states any C1–C4 hit it found, in two sentences, with the source it read. Then it proceeds with what the human confirms.
2. **The ship report** — currently reports green checks. Adds what the change costs to run and what risk remains unmitigated. (Implementation belongs to A4.)
3. **Nowhere else.** Build, Carve and the loop do not re-challenge a brief the human already confirmed.

## Decisions — answered on PR #28, all as recommended

- **D1 — enforced gate. ✅** Operating Truth 3 says enforce with code. "Is this the wrong thing to build" is semantic and not grep-able, but **presence** of a challenge section is, exactly as the Eval-Driven Law gates eval *presence* rather than eval *passing*. Recommendation: enforce presence, let the Checker judge quality. An entry-point workflow that produced no C1–C4 statement, not even "none found", fails.
- **D2 — extend `grilling`. ✅** Recommendation: extend `grilling`. It is already the single source of truth for how the framework talks to the human, and A3 just put the decision split there. A separate skill would be a second place to forget.
- **D3 — non-blocking. ✅** Recommendation: no. It states, the human answers in one line, work continues. A blocking challenge turns into the review-gate failure mode within a week.
- **D4 — current project only. ✅** A PO running 4–6 products contradicts himself *between* products less often than within one, and cross-product reads are expensive. Recommendation: within the current project only, for the first increment.

## Measurement, decided before building

A challenge that never fires is dead weight. A challenge that always fires is noise, and the human starts ignoring it — the exact drift that `review-log` was built to catch.

Reuse that machinery: log every challenge and its disposition (accepted / rejected / already-known). A condition rejected more than half the time is a **detector defect**, not a human defect, and gets retired or narrowed. `src/commands/review-log.js` already has the shape — `category` takes `C1`–`C4`, and `summary` already flags a class dismissed more than half the time.

**Deferred, deliberately.** It is not wired yet. The review ledger's own ~10-ship measurement only started on 2026-09-15, and appending C1–C4 rows to the same file would corrupt it. The brief check ships unmeasured for now; either give it its own ledger file or wait for the review measurement to close. **Until then C1–C4 are unproven — they may fire too often, too rarely, or on the wrong things.**

## What this is not

- Not a product-strategy opinion engine. C1–C4 are facts about consistency, breakage, cost and access. None of them require the agent to have taste.
- Not a second review gate. It runs once, at the entry point, before work starts — not after.
- Not a licence to refuse work. The agent states the conflict and builds what the human confirms.

## Cost

Roughly one extra read pass over `conductor/` at the entry point, which most entry workflows already do for their context scan. The marginal cost is the comparison, not the reading.
