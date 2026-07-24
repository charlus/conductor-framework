# Eval-Driven Law — evals for the app's non-deterministic surface

> **Status:** first increment SHIPPED (2026-07-24, branch `feat/eval-driven-law`). The pre-commit presence-gate + `lib.sh` helpers + `writing-evals` skill + Build/registry/docs wiring + `test/hooks-eval-gate.sh` (7 cases) are in. Approved design calls: skill-only how-to, full provider list (false positives mitigated by the waiver), hard-block-with-waiver. **Deferred (below):** v2 CI run-gate, P2.2 fusion, Level-C rubric versioning.
> Origin: the Google *New SDLC with Vibe Coding* analysis (see `MEMORY` › agentic-swe-2026-rubric). Its sharpest actionable gap: **tests ≠ evals.** Tests verify the deterministic parts of a system; **evals** verify the non-deterministic parts (did the LLM output meet the quality bar). Conductor enforces TDD but is blind to the eval surface of the apps it builds.

## The one-line thesis

When Conductor builds an app that itself calls an LLM for a feature, "the unit tests pass" is exactly the paper's dangerous false-confidence case. That feature needs an **evalset** (rubric/judge or property-based) alongside its tests — and the framework should make that **structural**, the same way the Test-Driven Law is, not advisory prose an agent forgets.

## Which "eval" this is (scope)

Three levels exist; we deliberately pick one:
- **Level A — eval Conductor's own coding agent** (did the loop's Maker take a good trajectory). **DECLINED** — golden coding-trajectories are brittle, expensive, low-ROI. The ship-log failure-miner (P2.1) is the only cheap trajectory signal we keep.
- **Level B — eval the LLM features inside the app Conductor builds.** **THIS DOC.** The tractable, high-value target.
- **Level C — eval Conductor's own LLM-judge gates** (judge-panel / Checker rubrics). Small honesty pass: version + spot-check those rubrics. Included as a stretch item, not the core.

## Design — mirror the Test-Driven Law exactly

The TDD enforcement already solved the hard problem, so we copy its shape:

| Concern | Test-Driven Law (today) | Eval-Driven Law (this) |
|---|---|---|
| Presence gate | `pre-commit`: impl file staged ⇒ a **test** must be staged | `pre-commit`: **LLM-feature** file staged ⇒ an **eval** must be staged |
| Run gate | `pre-push`/CI runs `conductor_verify_cmd` | CI runs `conductor_eval_cmd` (**deferred to v2**) |
| Escape hatch | `CONDUCTOR_NO_TEST="reason"` (waiver-logged) | `CONDUCTOR_NO_EVAL="reason"` (waiver-logged) |
| How-to | `tdd-cycle` skill | new `writing-evals` skill |
| Off switch | `CONDUCTOR_HOOKS=off` | same (shared) |

**Key insight that de-risks the whole thing:** the pre-commit gate checks *presence*, not *passing* — so a generic hook never needs to know the project's eval command (the same reason the TDD hook never runs the tests). The run-gate (which does need a command) is deferred to v2 and reuses the `conductor.config.json` `verify`→`eval` precedent.

### Detection — `conductor_is_llm_feature_file` (new `lib.sh` helper)
Content-based (LLM calls live in ordinary app files, so path regex won't do). Grep the staged file for provider SDK surfaces:
```
openai | @anthropic-ai | anthropic | langchain | google.generativeai | @google/genai
| genai | vertexai | bedrock-runtime | mistralai | cohere | ollama | replicate
```
Honest tradeoff: content-grep yields occasional false positives (a comment mentioning "openai"). Mitigation = the `CONDUCTOR_NO_EVAL` waiver, exactly as TDD handles untestable config. We accept false positives over false negatives (a missed eval surface is the costly error).

### Eval artifact — `conductor_is_eval_file` (new `lib.sh` helper)
Path convention mirroring test files: an `evals/` (or `eval/`) directory, or a `.eval.`/`.evals.` infix (`answer.eval.ts`, `rag.evals.json`).

### The gate (extend `templates/.agents/hooks/pre-commit`)
If the staged diff contains an LLM-feature file and **no** eval file is staged → block with guidance, unless `CONDUCTOR_NO_EVAL` is set (logged). Composes with — does not replace — the TDD gate: LLM-feature code needs **both** a test (deterministic glue) and an eval (non-deterministic output). Silent no-op for every non-LLM project (most of them).

### How-to — new `writing-evals` skill (loaded on demand)
**No new always-on rule.** Eval-Driven applies only to the minority of projects with LLM features; an always-on rule would bloat every install's static context (the over-specified-rules anti-pattern). Enforcement is the (silent-when-irrelevant) hook; the *how* is a skill the Build workflow loads when it detects LLM-feature work. The skill teaches the **three grading modes** — which kills the "we have no labelled data" excuse:
1. **Reference-based** — compare to golden outputs (needs a labelled set).
2. **Rubric + LM-judge** — score against written criteria; **no golden set** (the paper's emphasis).
3. **Property/assertion** — "valid JSON", "cites a real package", "no PII". No dataset.

## Composition (no overlap)
- **Tests** (TDD) → deterministic parts.
- **Evals** (this) → the built app's non-deterministic LLM outputs.
- **judge-panel / independent-review** → Conductor's *own* artifacts (specs, architecture) — unchanged.
- **Level C** → version Conductor's own judge rubrics so the watchers are themselves checkable.

## First increment (what gets built after this doc is approved)
1. `lib.sh`: `conductor_is_llm_feature_file` + `conductor_is_eval_file`.
2. `pre-commit`: the presence gate + `CONDUCTOR_NO_EVAL` escape hatch + waiver log.
3. `skills/writing-evals/SKILL.md`: the three grading modes + eval structure; referenced from `build.md`.
4. `how-it-works.md`: Reference Library + hook docs updated.
5. Self-test (`check-conductor.sh`) coverage; hook unit coverage.

## Deferred (follow-ups, explicitly out of the first increment)
- ~~**v2 run-gate**: `conductor_eval_cmd` (config `eval` field) run in CI/pre-push.~~ **SHIPPED (2026-07-24).** `pre-push` runs the configured `eval` command when the repo has evalsets — presence gated at commit, passing gated at push. `lib.sh` `conductor_eval_cmd` (config `eval` → `npm run eval` → empty) + `conductor_has_eval_files`; escape hatch `CONDUCTOR_SKIP_EVAL` (logged); non-LLM repos never see it. `test/hooks-eval-gate.sh` R1–R5.
- ~~**P2.2 fusion**: fold the architecture-checklist into a single machine-readable ship-contract the Checker verifies.~~ **SHIPPED (2026-07-24).** `skills/architecture-checklist` + the ship-contract framing (deterministic half = TDD/Eval hooks + `check:` items; semantic half = Checker/independent-review). Produced by technical-vision, verified by loop-checker + independent-review. Semantic-by-nature, so no new hook stage — the teeth are the Checker + optional `check:` commands.
- ~~**Level C**: version + spot-check Conductor's own judge-panel/Checker rubrics.~~ **SHIPPED (2026-07-24).** Every judge surface (judge-panel, loop-checker, independent-review, behavior-validator) carries a `Rubric vN` stamp; judge-panel documents the **Calibration** discipline (version the rubric, spot-check against human judgment, diverse lenses). Self-test asserts all four are versioned.

## Open questions for review
1. **Always-on vs skill-only** for the how-to — this doc says skill-only (progressive disclosure). Agree?
2. **Detection breadth** — start with the provider list above, or narrower (only the SDKs we've seen) to reduce false positives?
3. **Block vs warn** in v1 — hard block (like TDD) or a warning-only first release to gather signal before enforcing? (Recommendation: hard block with the waiver, consistent with TDD; a warn-only gate trains people to ignore it.)
