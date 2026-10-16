# Harvest 2026-10 — peers, harness changes and research

> **Status:** first batch shipped in 6.14.0 (2026-10-16, branch `fix/harvest-gates-2026-10`): R1 sandbox credentials, R3 skill names, A8 AGENTS.md shadow warning, Q5 interview rounds, Q4 `loop.models`. Q3 (one outcome eval) approved, not designed yet. Everything else below is open or parked.
>
> **Sources:** eight research passes on 2026-10-16 — Superpowers, Pocock skills and gstack, AG Kit / Antigravity Superpowers / Test in Prod / Ralph, ECC / AI-DLC / AGENTS.md / Stitch, 16 unaudited peers (Spec Kit, OpenSpec, Kiro, BMAD, Compound Engineering, GSD, Google Conductor and others), harness-engineering practice June–October 2026, research papers April–October 2026, and the Claude Code / Codex / agy changelogs. Third-party code was read, never run. Most peer measurements are author-run on small samples.

## What the field did

It subtracts. Superpowers, Pocock, gstack, AG Kit and Agent OS cut skills and prose. Cursor cut 66% of its system prompt, and the ETH context-file study and Huntley agree. A harness component encodes an assumption about the model and expires with the next generation, so remove one at a time and measure. Conductor stays ahead on enforcement in code, the PR-gated merge and evidence tied to the tested tree.

## Owner decisions (2026-10-16)

| | Decision |
|---|---|
| Q1 | Claude Code only for now: no Antigravity redirect skills before its 2026-10-19 workflow cut-off |
| Q2 | The Google Conductor name clash is handled in a separate session |
| Q3 | Run one outcome eval: Build against the bare harness, on two models. It also answers whether the TDD ritual and the skills pay (Böckeler, TDAD, SWE-Skills-Bench) |
| Q4 | No Pi / OpenCode adapters until one is used. Build only `loop.models` (shipped). A Checker from another vendor waits for a second account and Q3 |
| Q5 | Interview in rounds (shipped) |

## Shipped in 6.14.0

- **R1** sandbox withholds forge credentials (live-verified). The SSH push path itself was not probed: the auto-mode classifier blocked the probe, and the fix does not depend on it.
- **R3** skill `name:` equals folder (`test/skill-spec.test.js`).
- **A8** AGENTS.md shadow warning walks up the folders.
- **Q4** `loop.models`, live-verified for the Maker.
- **Q5** `grilling` rounds. Not measured.

## Open, ranked

- **A3** fail a green verify that ran zero tests (gstack `5b9b837`).
- **A4** TDD presence gate passes a test change with no assertion. Require a net assertion gain (Banik et al., 80% weak oracles in 86k agent patches).
- **A5** block gate-weakening edits: suppression pragmas, `continue-on-error`, `[skip ci]`, `--no-verify`, new TODO without an issue (gstack `review/gate-integrity.md`, GSD).
- **A6** Maker `escalate` signal. Strongest measured result: an abort option cut test-cheating 54% → 9% (ImpossibleBench, arXiv 2510.20270; Gomez, arXiv 2608.29460).
- **A7** Checker verdict as schema-checked stdout (`--json-schema`), read-only Checker. Deletes the verdict file and its retry.
- **A9** Correct the fact-gate docs to what was measured: ECC's pre-registered 336-trial study found no benefit and +35–45% cost.
- Antigravity loads `.agents/AGENTS.md` itself, so the framework block loads twice there. Low while Q1 stands.
- `claude -p` will default to `--bare` in a future release (no date). The adapter depends on CLAUDE.md, skills and hooks: watch the changelog.

## Parked, with the evidence

- Self-evolution: no source meets the bar (memory `harness-rsi-paper-declined`). Watch Meta-Harness for an independent rerun.
- Held-out eval fixtures and staged upgrade rollout: declined 2026-10-16.
- Swarm admission (F8), model overlays, the per-host compiler: no new evidence.
