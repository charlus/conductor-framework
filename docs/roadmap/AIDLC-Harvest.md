# AI-DLC Harvest — A1–A7

> **Status:** A1–A3 built on `feat/aidlc-harvest-a1-a3` (6.13.0), not merged. A4–A7 parked.
>
> **Source:** a source audit of **AI-DLC** (`github.com/awslabs/aidlc-workflows`, 2.11.0, read at `0bb0075`, 2026-10-15): a Bun engine of about 215k lines of TypeScript, 500k lines of tests, 33 stages in 5 phases, 11 scopes, 14 agents, 7 harnesses. 1,558 commits since 2025-11-13, 857 of them in 2026-10-01..15, about 70% by one author working with coding agents.
>
> **Not verified:** nothing in AI-DLC was executed. Every claim about it is from reading source.

## What it is, against Conductor

- **Control.** An engine (`aidlc-orchestrate.ts next/report`) decides every step and emits a typed directive. The agent never edits state. Conductor routes with prose workflows and enforces with git hooks, the CLI and the PR gate.
- **Human approval.** Every stage has a gate. A UserPromptSubmit hook records human turns, and approval needs one after the gate opened. Their docs say this proves "presence and ordering, not authorship". Conductor's Build runs to ship-ready (6.9.0), and a human merges the PR.
- **Unattended.** None: the engine never starts an agent. Conductor has `conductor loop`.
- **Context.** About 60–85k tokens of instruction text per stage (50 KB skill, 90 KB protocol, the whole knowledge folder of the lead agent). Conductor: 15 KB always on, one workflow of at most 20 KB, ratcheted by test.
- **Testing.** Nightly live runs on real harnesses gate each stable release, checking only what lands on disk. The one model-judged eval is on demand. Conductor's evals have a sensitivity check but run on demand.
- **Personas.** Static per stage, generic. The multi-agent mode is on only in the `enterprise` scope. Conductor chooses personas from the paths a change touches.

## Taken

| | What | Where |
|---|---|---|
| A1 | `Compatibility:` line on each release entry | `test/changelog-compatibility.test.js` |
| A2 | A verify run that changes files while it runs fails, and is never FRESH | `src/evidence/ledger.js`, `evidence run --stable-tree`, `hooks/pre-push`, `test/hooks-verify-stable-tree.sh` |
| A3 | Hook heartbeat against the reflog: status names commits and pushes that skipped the hooks | `src/heartbeat.js`, both hooks, `install-hooks`, `test/hooks-heartbeat.test.js` |

A3 limits, by design: it errs towards silence. A commit in a linked worktree on a detached HEAD is not seen. Two pushes in the same second count as one. A blocked commit attempt leaves a heartbeat that can cover a later `--no-verify` commit inside the 30-minute window.

## Parked

- **A4. Claim-source tags on specs.** Each statement in a Spec-It or Grand-PRD output carries `[Q3]`, `[desc]`, `[memory:…]` or `[assumption]`, and a CLI check resolves every tag. AI-DLC applies it to one stage (`intent-capture`).
- **A5. Machine-checked traceability.** Acceptance-criterion IDs map to test files in a JSON file, checked at Ship. It proves an ID maps to a file, not that the file implements it.
- **A6. Content-hash marker on lessons** appended to `conductor/`, so a replay or a parallel session does not duplicate a lesson.
- **A7. Ownership hashes at install**, so `upgrade` names each framework file the user edited before it replaces it. It adds to the 6.0.0 rule and does not reverse it.
- **Nightly live-eval lane gating releases.** A product decision: it costs money to run.

## Left

The engine that routes every step, a gate per stage, the composer's "Autonomy Risk Score" (LLM-scored inputs, weights its authors call uncalibrated), wholesale knowledge loading, static personas, and more harnesses without a user asking for them.
