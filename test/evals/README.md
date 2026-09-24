# Agent-layer evals

Everything in `test/*.test.js` stubs the agent. These evals do not: they spawn a
real agent CLI and measure what it actually does. That distinction is the whole
point — a green `test:unit` says nothing about whether routing works
(CLAUDE.md Operating Truth 1).

Gated behind `CONDUCTOR_EVALS=1` because they cost real money and need a live
CLI on PATH. They are never part of `npm run test:unit`.

## routing-eval

Does a fresh model, given Conductor's always-on context, route a request to the
right place?

```bash
CONDUCTOR_EVALS=1 npm run eval:routing                          # classifier suite
CONDUCTOR_EVALS=1 npm run eval:routing -- --suite descriptions  # descriptions suite
CONDUCTOR_EVALS=1 npm run eval:routing -- --case ship --verbose  # one case
CONDUCTOR_EVALS=1 npm run eval:routing:sensitivity               # can it fail?
```

**Two suites, two different artifacts under test.**

| Suite | Fixture | A failure means |
|---|---|---|
| `classifier` | `AGENTS.md` routing table present | the table is wrong |
| `descriptions` | table **removed**, only workflow descriptions remain | a workflow's own description no longer says what it is for |

The `descriptions` suite removes the table on purpose. gstack shipped this
exact suite with the routing table still in the fixture and found in an audit
that it could not fail: a badly regressed description still routed correctly
because the lookup table rescued it. Removing the answer key is what makes the
suite able to detect the regression it selects for.

**Negative controls** (`neg-*`) matter as much as the positives. A router that
sends everything to a workflow is as broken as one that sends nothing, and only
the negatives catch it.

## Sensitivity — a green eval proves nothing on its own

`--mutate <workflow.md>` blinds the fixture to one workflow (drops its
classifier row, guts its description) and **inverts the exit code**: the case is
expected to fail. If a mutated run still passes, the eval is not measuring
routing and a green run means nothing.

Measured 2026-09-03 against `claude`:

```
classifier    16/16 (negative controls 3/3)  32s wall
descriptions  16/16 (negative controls 3/3)  28s wall
sensitivity   blinding deepen.md → FAIL (got genesis.md), as it must
```

`genesis.md` is the right *fallback* under mutation — it is what the classifier's
"Not sure? → genesis" row prescribes — which is why the mutation has to be
graded as a failure of the mutated case rather than of the framework.

## Adding a case

Add to `CASES` in `routing-eval.mjs`: an `id`, the `prompt` a human would type,
and the `expect` (a workflow filename, `ANSWER_DIRECTLY`, or `INBOX`). Add a
negative control whenever a new entry point could plausibly over-trigger.

`last-run-<suite>.json` is written after every run so two runs can be diffed.
It is a run artifact, not committed.

## fact-gate

Does the fact gate (`hooks/pretooluse-fact-gate.sh`, F1) change what the agent
actually does?

```bash
CONDUCTOR_EVALS=1 npm run eval:factgate                    # 3 runs per arm
CONDUCTOR_EVALS=1 npm run eval:factgate -- --runs 5 --verbose
CONDUCTOR_EVALS=1 npm run eval:factgate:sensitivity        # can it fail?
```

Two arms on the same fixture: gated, and the identical repo with
`CONDUCTOR_FACT_GATE=off`. The fixture's `src/config.js` is imported by three
files that each transform its value, so doubling the timeout silently doubles a
budget and a probe interval. The measure is whether the agent **names the files
its change affects** — no judge, a string match on the final answer.

**Measured 2026-09-22 against `claude` 2.1.278, n=4 per arm:**

```
gated     surfaced impact 4/4 (100%)
control   surfaced impact 0/4 (0%)          delta +100pp
sensitivity (two identical ungated arms)    delta  +25pp   → noise floor
```

The effect is four times the measured noise. n=4 is small; treat the direction
as established and the magnitude as approximate.

### Two ways the first version of this eval was worthless

Recorded because both are easy to repeat.

1. **It scored the gate against its own denial.** The metric was "did a search
   happen before the first Edit". A gated run's first Edit is the one the gate
   *denies* — by construction it always looked like editing before searching.
   The gate appeared to make things 33pp *worse*.
2. **The metric was at the ceiling.** The control already searched 3/3 on a
   task that obvious, so there was no headroom for any effect to appear. A
   measure pinned at 100% cannot detect anything in either direction.

Both were invisible until the eval ran and produced a result that did not make
sense. A green eval proves nothing on its own; a red one is only useful if you
read the runs rather than the verdict.
