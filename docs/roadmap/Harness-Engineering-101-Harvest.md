# Harness Engineering 101 harvest

> **Status:** F1–F4 shipped in 6.37.0 (2026-10-21, branch `feat/loop-truthful-signals`). F5 parked.
>
> **Source:** [IsuruMaduranga/harness-engineering-101](https://github.com/IsuruMaduranga/harness-engineering-101), version 1.1, October 2026: 16 chapters and 4 appendices on building an agent harness, read in full on 2026-10-20. Prose CC BY-NC-ND (ideas taken, no text copied), code MIT.

## What it is to Conductor

A primer for people who build a harness. Conductor configures harnesses and drives them, one level higher, and already does most of what the book recommends: hooks for what must always happen (ch. 11, 13), the Evidence Rule, worktree isolation and a PR-gated merge as the transaction (app. B), fail-closed verdicts, the untrusted-input envelope, skills loaded on demand and the context-bill ratchet (ch. 6, 11). Four gaps were found in `src/loop/`.

## Findings

| | Book | Gap in Conductor | Shipped |
|---|---|---|---|
| F1 | ch. 5, 12: `cache_read_input_tokens` is the vital sign; a cache break costs 10x and shows nowhere | `parseClaudeResult` summed cached and fresh input into one number | Cache share per beat (beat log) and per role (`conductor status`). Live: 0% → 70% → 99% over three consecutive beats |
| F2 | app. D: split permanent from transient failures; 401/403 means stop and tell the human | Only usage-limit banners stopped the run; a refused login ran until the stall detector and reported "stall" | Terminal status `auth_failed`, refunded beat, inbox and `Next:` say to log in. Live: real `claude -p` (`api_error_status: 401` in the JSON result) and `codex exec` (`ERROR: unexpected status 401`) with an invalid key |
| F3 | ch. 13: a model judging a model is evidence, not authority; a block must cite something that exists | Rubric v2 required a `quote` and never checked it | `groundFindings` looks for the quote in the file and its diff from the default branch. Only lowers `provenBlockers` and adds the WARNING; `approved` never changes. Unit-tested, not proven on a live Checker |
| F4 | app. A: a role whose report is trusted without a check must not be weaker than the doer | `loop.models` accepted `checker: haiku` under `maker: opus` silently | `loop doctor` warning (Claude families only) |
| F5 | app. C: flag execution that drifts from the approved plan | A slice may touch files its spec never names | Parked: overlaps the Goodhart boundary and protected paths, and needs a file list in every spec first |

## Not taken

Compaction, steering queues, deferred tool loading, streaming and retries belong to the harness (Claude Code, Codex), not to Conductor.
