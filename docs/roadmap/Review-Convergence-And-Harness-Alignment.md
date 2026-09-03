# Review Convergence & Harness Alignment (E1–E5)

> **Status:** E1–E5 shipped 2026-09-03 (PRs #12–#16, plus #17 fixing a stale budget ceiling).
> Motivated by a real cost the maintainer was paying on every ship: the independent-review
> gate rarely finished in one or two rounds, the reviewer always found at least one BLOCKER,
> and the workflow stopped after 3–4 unsatisfied reviews to ask for human help — each round
> re-running the whole suite.
>
> Informed by a source audit of two peer harnesses (**gstack** `1.79.0.0`, **agentctl** `main`
> @2026-08-31) and a web survey of 2026 harness-engineering practice.
>
> **Shipped:** E1 review convergence, E2 measurement, E3 agent-layer proof, E4 untrusted-input
> hardening, E5 drift gate. **Descoped on evidence:** E5's per-host compiler. **Deferred:**
> model overlays; the context bill's sibling-file blind spot.
> **Not yet known:** whether E1 actually shortened the loop — that needs E2's ledger over ~10
> real ships. Every claim below is either measured and cited, or labelled as a prediction.

---

## 1. The problem, and why the obvious diagnosis was wrong

Two hypotheses fit the symptom "a blocker every round":

- **H1** the Maker writes bad code, or
- **H2** the reviewer's question has no terminating answer.

H1 was implausible (the Maker is Opus 5) and, more importantly, **the mechanism did not need
it**. The gate was closed by construction. Four instructions compounded:

| Where | What it said |
|---|---|
| `personas/checker.md` | "run the full test suite yourself", "zero warnings", binary verdict |
| `workflows/loop-checker.md` | "If you are unsure … write `approved: false`" |
| `skills/code-review/SKILL.md` | "Reviewer found issues = not done. **No exceptions**" — no severity floor, no evidence requirement, no suppression list |
| `workflows/ship.md` Phase 4 | "Be adversarial: look for the reason this is **not** done", then re-spawn a fresh reviewer over the whole diff |

Our own `independent-review` skill already stated the consequence in its anti-patterns:
*"an adversarial reviewer told to find the reason this is not ready will always find
something."* The behaviour was the design working as written.

**agentctl reached the same conclusion independently, with numbers.** Its `nexus` project
took 15–21 review loops per step; one step spent **86 hours and 5.44M output tokens over 15
loops for 1,430 lines of product**, producing 48,238 lines of archived review (≈40:1 prose to
product). Their root-cause commits name the causes precisely:

- `eb084f2` — the reviewer had **no definition of done**: *"the agent deciding whether a step
  is finished had never been told what finished means, so it was asked an unbounded question
  every round and answered it honestly every round."*
- `ffe9c91` — **discovery was serial**: reviewers reported one instance per class per round, the
  fixer closed exactly that class, the next reviewer found a different one. *"One round per
  class discovered, which is the loop count."*
- `9b8d7ac` — of ~18 defects, **only 3 were attributable to a previous fix**. Not churn, not
  incomplete fixing: latent defects found one round at a time.
- `a8ffc6b` — the test reviewer's criterion *"can this assertion be stronger"* is true of every
  assertion ever written, so it cannot terminate.
- `8063333` — **loop count tracked the size of the process apparatus, not the step**: steps with
  0–118 lines of rules closed in one loop; steps with 1,662–4,830 lines took 15–21.

So: **H2**, with two independent sources. E1 acts on it.

### What the peers do instead

Neither peer loops review until clean, and neither does any production harness surveyed:

- **gstack** runs **one** pass then *fix-first*: mechanical findings are auto-fixed, judgement
  findings are batched into a single question, then it ships. Every finding carries a 1–10
  confidence, and **a finding that cannot quote the motivating line is forced below the display
  threshold** — they report this killed a whole false-positive class. Plus an explicit
  "DO NOT flag" list, and cost gating by diff size (no specialists under 50 lines) and by
  measured hit rate (a specialist with 0 findings in 10+ dispatches is auto-gated off).
- **Anthropic's Mar-2026 harness** uses one planner / generator / evaluator pass per unit of
  work against a **sprint contract negotiated before implementation**, and reports that for work
  inside the model's capability *"the evaluator became unnecessary overhead"* — it earns its
  cost only at the edge. Their evaluator failed the **opposite** way to ours: *"Claude is a poor
  QA agent … it would identify legitimate issues, then talk itself into deciding they weren't a
  big deal and approve the work anyway."*

That last point set E1's calibration design: an LLM judge drifts in **both** directions, and the
two failures look nothing alike.

---

## 2. E1 — a review gate that converges (PR #12)

**One reviewer brief**, `skills/independent-review/reviewer.md`, 116 lines, handed to the
reviewer verbatim and self-contained. Capped and tested at ≤130 lines because loop count tracks
the size of the instruction corpus (`8063333`); the brief must not become a chain of skills.

| Cause | Fix |
|---|---|
| No definition of done | The reviewer's first input is the acceptance criteria (or `goal_description`) plus `architecture-checklist.md`, walked as a checklist |
| No evidence bar | `BLOCKER` needs a **quoted line** and **confidence ≥ 7**; an unquotable finding is downgraded to IMPORTANT, never promoted |
| No severity floor | `APPROVE` = zero blockers. IMPORTANT and NIT are reported and do not withhold it |
| Serial discovery | The reviewer sweeps the class, reports the complete `also:` list, and states its sweep method and any gap |
| No exclusions | Explicit "Not a finding" list: already-addressed, tooling-enforced, `conductor/` process artefacts, test-structure opinions, harmless redundancy, consistency-only, work beyond scope |
| Uncapped loop | **One** delta round, briefed with round-1 findings *plus the author's dispositions* and the fix commits' diff only; then one batched question to the human |
| "The spec is wrong" restated forever | A single `SCOPE:` finding, **once**, routed to the human |

**`calibration.md`** — 7 graded cases pinning both drift directions: over-rejection (C2 a false
positive killed by the quote rule, C3 criteria-met-but-more-could-be-built, C6 a test-structure
opinion) and under-rejection (C1 a quotable defect with a one-line fix is *still* a BLOCKER, C4
a reward-hacked test, C5 an unsatisfied checklist item). C7 is the `SCOPE:` case.

**Deliberate divergence from agentctl.** They rejected severity thresholds and any deferral
mechanism outright — *"follow-up lists rot and are never acted on"* — requiring every defect
found to be fixed. We keep the severity split but adopt their objection: **no follow-up backlog
from review**. A proven in-scope defect is fixed in this cycle or written into the PR body under
**Known gaps**, where the person merging reads it. Filing it into a backlog nobody re-reads is
the failure they describe.

**Proportionality:** Ship Phase 4 skips the subagent below 50 changed non-test lines *and* no
risk path (auth, payments, migrations, API contracts, security, CI, hooks). LOC alone is not a
risk proxy — a five-line auth change takes the full gate.

**Honest limitation.** E1 is prose, so its 28 tests are **drift guards**, not behaviour tests;
the file says so. A green run is not evidence the gate converges.

---

## 3. E2 — measurement (PR #14)

Three instruments, because E1 is an argument until something counts.

**Working-tree fingerprint** (`src/evidence/wtree.js`). A git tree hash via a temp index
(copy the real index to keep the stat cache → `add -A` → `write-tree`). Every cheaper option is
wrong and the tests pin why: `HEAD^{tree}` ignores uncommitted work; hashing `git diff` misses an
untracked new file; hashing `status --porcelain` is content-blind. Properties asserted:

- **Keystone:** committing identical content does **not** move it — otherwise every ship
  invalidates its own test run at commit time.
- An untracked new source file **does** move it.
- `.gitignored` scratch does not, so a run that writes its own log cannot invalidate itself.
- Amend/reword do not. The user's index is never touched.

The racy-git subtlety is handled explicitly: the index copy's mtime is restored, and a **failed**
restore falls back to the slower `read-tree HEAD` seed rather than proceeding — proceeding would
silently reopen the hole where a same-second, same-size rewrite keeps a stale stat-cache entry.

**Evidence ledger** (`conductor evidence run|check|list`). Transparency invariant: the child's
exit code is always the wrapper's, and every bookkeeping failure is a warning — a wrapper whose
job is recording runs must never turn a green run red. `--expect-cmd` binds a label to the real
suite (without it, `evidence run --label tests -- echo ok` satisfies the gate). `--allow-paths`
keeps evidence FRESH when only release files changed, with the residual risk stated in the code.
Machine-local under `CONDUCTOR_HOME` and per-branch: a synced record claiming a run happened on a
machine where it did not is worse than no record.

Wired into `pre-push`, fail-safe by construction — no CLI, no ledger, any doubt runs the command.
The ledger can only ever **skip a redundant run**, never satisfy the gate.

*Measured live* (real repo, real hooks, an observably slow verify command):

| Push | Change | Result |
|---|---|---|
| 1 | cold | ran the suite — 2.3s |
| 2 | commit reworded, content identical | **skipped — 0.15s** |
| 3 | `CHANGELOG.md` only | **skipped — 0.15s** |
| 4 | source changed | **re-ran — 2.25s** |

**Context bill + ratchet** (`src/context-bill.js`, `conductor context-bill`). Progressive
Disclosure was a paragraph; it is now **16,442 bytes ≈ 4.4k tokens** with a committed ceiling.
Two ledgers: ALWAYS-ON (classifier + always-on rules + every skill's frontmatter — multiplied by
every session forever) and EAGER (paid on invocation). CI fails on growth past the fixture **and
on a new skill or workflow with no budget entry**, so adding context cannot be a default. A hard
cap (24 KB) sits above the ratchet so growth cannot be accepted forever one re-capture at a time.

Ceilings are in **bytes**, not tokens, deliberately: exact and machine-independent, no model
call. gstack calibrates a token divisor against `count_tokens`; a ratchet that drifts when a
tokenizer changes is worse than no ratchet. Token figures print with their divisor.

**Review ledger** (`conductor review-log`). Records each finding with its disposition and reports
rounds to APPROVE, dismissal rate per class, and blockers by category. A class dismissed >50% of
the time (n≥3) is flagged a **rubric suspect** — fix `calibration.md`, not the author. It
enforces the rubric-v2 bar at write time, so the measurement is not taken with a different ruler
than the gate.

---

## 4. E3 — proving the agent layer (PR #15)

Two halves of the same gap: nothing in this repo could fail because of how an *agent* behaves.

**The evidence bar in code.** `parseCheckerVerdict` now enforces rubric v2 and returns
`findings`, `malformedFindings`, `provenBlockers`. **Direction is everything** — the bar may only
make the gate stricter:

- A malformed BLOCKER does **not** become an approval; it stays a rejection. Otherwise "write a
  sloppy finding to get waved through" inverts the point.
- `approved:true` while listing a BLOCKER is self-contradicting and fails safe to reject.
- `approved:true` with only IMPORTANT/NIT still approves — APPROVE means zero *blockers*.
- A junk `findings` field degrades to `[]` and never flips a clean verdict.

What the bar buys is a **diagnostic**: the audit trail can distinguish an evidenced rejection
from a Checker rejecting on vibes, and the second is a Checker problem. Red→green: 12 of 19
assertions failed before the change.

**The routing eval** (`test/evals/routing-eval.mjs`, `CONDUCTOR_EVALS=1`). Spawns a real
`claude -p` in a throwaway project and asks whether a fresh model routes to the right workflow.
One turn, `--allowed-tools Read`, graded as an exact filename so there is no judge in the loop.

Two suites, two artifacts: `classifier` (the `AGENTS.md` table is present; a failure means the
table is wrong) and `descriptions` (**the table is removed**; a failure means a workflow's own
description no longer says what it is for). Removing the table is the single most useful thing
found in gstack: they shipped this exact suite *with* the table in the fixture and discovered in
a 2026-08 audit that **it could not fail** — a regressed description still routed correctly
because the lookup table rescued it.

Negative controls are graded too. A router that sends everything to a workflow is as broken as
one that sends nothing.

**Sensitivity.** `--mutate` blinds the fixture to one workflow and **inverts the exit code**: the
case must fail, or the eval is not measuring routing.

*Measured live 2026-09-03:* `classifier` 16/16, `descriptions` 16/16, negative controls 3/3 both
times; blinding `deepen.md` → FAIL (answered `genesis.md`, the correct *fallback* under
mutation), as it must.

---

## 5. E4 — untrusted trigger input (PR #13)

`conductor loop --event` can be seeded from an issue body, a PR comment or a chat message, so
anyone who can file an issue can put text in front of an unattended agent holding credentials.
**Live attack class, not hypothetical:** Feb 2026 turned one malicious Cline issue *title* into
an npm supply-chain compromise; April 2026 disclosed the same shape in Claude Code's
security-review action (CVSS 9.4), Gemini CLI Action and Copilot's coding agent. Every write-up
names the same root cause — untrusted content processed in the same context as trusted
instructions. Before this, our driver clamped autonomy correctly but the issue text reached the
Maker unlabelled, inside the instruction stream.

1. **Trust** — from *authorship*, not transport. A third-party source with no operator-level
   `author_association`, or any payload setting `untrusted: true`, is untrusted; an
   operator-configured transport (`cron:nightly`, `ci:release`, the CLI) keeps full trust.
   Clamping those would buy no security and would silently drop every existing cron-driven run
   to the floor, so the explicit marker exists instead. Untrusted is forced to the **L1 no-merge
   floor through `clampAutonomy`**, which only de-escalates — a lower operator ceiling still wins.
2. **Envelope** — always wraps (a clean scan is not proof of safety); injection-matching lines get
   an `[INJECTION-PATTERN]` prefix; NFKC + `\p{Cf}` stripping defeat fullwidth/zero-width evasion
   **during matching only**, so emitted text is never rewritten; a forged copy of our own banner
   is defused with a ZWSP.
3. **Allowlist, not blocklist** — `Read Edit Write Glob Grep TodoWrite`. No `Bash`, no `WebFetch`,
   no `WebSearch`. Every published bypass defeated a *blocklist* (`/proc/*/environ` instead of
   `env`, `git push` instead of `curl`), so no blocklist path exists in the code.

**Plus the Stop hook's trust boundary.** Hooks bypass the permission system, so
`verification-stop-hook.sh` was executing a command read from a file *inside the repo* with no
human in the chain. It now runs only what the operator recorded via `conductor trust-verify`
(realpath + sha256, 0600 store, append-only grant log). Untrusted **fails open** with a one-line
note — refusing to run an unvetted command must not become a way to hold a session hostage, and
`pre-push` still enforces the Iron Law where the operator typed `git push`. Stop-hook re-entry is
bounded: a red check still blocks, but at 3 blocks it releases with a loud `UNVERIFIED` warning
rather than trapping the session.

*Measured live:* a hostile payload (injection + forged `END` banner + an L3 escalation request)
produced `trigger_trust=untrusted`, autonomy L3→L1 with merge disabled, the injection line
labelled, and the forged banner defused while the real one still closed the envelope.

---

## 6. E5 — descoped on evidence (PR #16)

E5 was planned as gstack's model: host configs with path and tool-name rewrites, suppressed
sections, and model overlays. **Measured first; we mostly do not have the problem.**

| gstack's problem | Ours |
|---|---|
| Installs to `~/.claude/skills/gstack`, hardcodes that path throughout → needs a per-host rewrite | We install `.agents/`, the cross-tool convention. The only `.claude/` references are 5 files that legitimately *wire up* Claude Code (`settings.json`, `.claude/commands/`) |
| Rewrites `use the Bash tool` → `use the exec tool` across 56 templates | **Three** "Task tool" occurrences, each already carrying an "Antigravity / others: use the platform's sub-agent primitive" fallback |

Building the compiler anyway would be the speculative abstraction CLAUDE.md forbids. Both
properties are now **pinned by tests** (E5.5) so they cannot erode silently.

**What was built instead: the drift gate.** `registry.json` and `how-it-works.md` are
hand-maintained against 31 skills, 16 workflows and 4 rules and nothing kept them honest. A
*generator* would be the wrong fix — those files carry the most valuable prose in the repo and
generating them destroys information. A *gate* keeps the prose and catches the drift: 60
assertions covering registry↔disk both ways, non-empty descriptions, **path-level reachability**
(excluding `registry.json` and `check-conductor.sh` — both inventories, and being in a stock list
is not a route), link validity, skill frontmatter, and host-path containment.

**Two real bugs on its first run.** `agentic-flow.md` shipped in every install and *was*
documented, but nothing pointed at its path and it had **no classifier trigger** — "design a
flow" could never reach it. And `loop-checker.md` / `unattended-loop.md` had **empty registry
descriptions**. Both fixed.

---

## 7. What is deferred, and why

| Item | Why not now |
|---|---|
| **Model overlays** (per-model behavioural patches with inheritance) | Real value — gstack's `gpt-5.6-sol.md` exists to bound their own "Boil the Ocean" ethos — but they need a delivery point (where an overlay is injected into a beat prompt) that does not exist yet. Inventing one to match gstack's shape would be guessing. |
| **Context bill counts only `SKILL.md` per skill dir** | So E1's `reviewer.md` (116 lines) and `calibration.md` are **not billed**, despite being real eager cost when the gate runs. Under-reporting is exactly the failure mode a ratchet must not have. Small fix: count sibling `.md` files as eager, re-capture. |
| **Ship Phase 4 citing FRESH evidence** instead of re-running | The `pre-push` consumer landed in E2; the Phase-4 prose consumer did not. |
| **agentctl's own fix is unvalidated** | Their last convergence commit is 2026-08-28 with nothing after it confirming the loop got shorter. We borrowed their *diagnosis*, not a proven result. |

## 8. What we do NOT take from the peers

- **gstack's `ETHOS.md` §1 "Boil the Ocean"** (build the complete version because completeness is
  cheap). They then had to ship a per-model overlay instructing the model that *"the explicit task
  is the lake"* — a documented self-inflicted wound. It contradicts our scope discipline.
- Browser daemon, GBrain, iOS QA, the hash-chained egress ledger and the 22 MB ML injection
  classifier — right for their threat model and surface (82 binaries, 41 MB, Bun + Chromium),
  wrong for ours.

## 9. The measurement that decides whether E1 worked

**None of this is known yet.** After ~10 real ships, `conductor review-log summary` gives:

- **rounds to APPROVE** — target median 1, p90 2 (was 3–4)
- **suite runs per ship** — target 1 per content state
- **dismissal rate per finding class** — >50% in one class (n≥3) means the *rubric* is wrong there; add a case to `calibration.md`
- **blockers by category** — if real, evidenced blockers cluster in one area, **H1 was right for that project** and the rubric should be re-tightened rather than defended
- **reviewer-brief bytes vs rounds** — tests agentctl's `8063333` finding on our own data

The honest position: E1 changed the gate on a well-evidenced diagnosis from two independent
sources, and the instrument to check it is now in place. The check has not been run.

---

## Sources

- **gstack** `1.79.0.0` — `review/checklist.md`, `scripts/resolvers/confidence.ts`,
  `review-army.ts`, `ship/SKILL.md.tmpl`, `bin/gstack-wtree`, `bin/gstack-evidence`,
  `bin/gstack-verify-gate`, `lib/tracker-guard.ts`, `lib/context-bill.ts`,
  `test/context-budget-ratchet.test.ts`, `test/skill-routing-e2e.test.ts`, `hosts/define-host.ts`,
  `model-overlays/`, `ETHOS.md`
- **agentctl** `main` @2026-08-31 — `config/roles/code_reviewer.md`, `process_improver.md`,
  `orchestrator.py`, and commits `eb084f2` `d70fd7b` `ffe9c91` `9b8d7ac` `cfbda94` `a8ffc6b`
  `fdf63d0` `0bcda07` `2c0b146` `8063333`
- [Anthropic — Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Fowler — Harness engineering](https://martinfowler.com/articles/harness-engineering.html)
- [Vercel — AGENTS.md outperforms skills in our agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- [OpenAI — Testing agent skills systematically with evals](https://developers.openai.com/blog/eval-skills)
- [The Verification Horizon (arXiv 2606.26300)](https://arxiv.org/abs/2606.26300)
- [Harness Engineering for Agentic AI Coding Tools (arXiv 2602.14690)](https://arxiv.org/abs/2602.14690)
- [Augment — Recall vs precision in agent code review](https://www.augmentcode.com/guides/deep-code-review-recall-vs-precision)
- [Prompt injection via GitHub comments — Claude Code / Gemini CLI / Copilot](https://cybersecuritynews.com/prompt-injection-via-github-comments/)
