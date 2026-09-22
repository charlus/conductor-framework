# Peer-Framework Harvest (ECC) — F1–F15

> **Status:** F9, F11, F12 shipped 2026-09-22 (`943fee5`). F1, F7, F3 are next.
> F4, F8, F10, F15 need a design pass first. F2, F5, F6, F13, F14 are parked or
> dropped with a reason.
>
> **Source:** a source audit of **ECC** (`github.com/affaan-m/ecc`, `ecc-universal`
> 2.2.1, read at `bf70150`, 2026-09-22) — 68 agents, 292 skills, 94 command shims,
> ~53 hook scripts, adapters for 7+ harnesses, 320 test files, an 80% coverage gate.
>
> **The finding that mattered** was not a feature to copy. It was that ECC's
> `loop-design-check` names five ways an agent loop misfires, and Conductor was
> open to three of them. Our own envelope had holes we had not looked for because
> we were looking at theirs. Everything shipped here closes one of ours.
>
> **Not verified:** nothing in ECC was executed. Every claim about it is from
> reading source. Our own three gates are proven by behaviour tests that install
> the real hooks into a temp repo and run real `git`; the PreToolUse hook is
> proven against its stdin contract, not yet inside a live Claude Code session.

---

## 1. What ECC actually is, and what it is not

A **toolbox and distribution play**, not a methodology. The pitch —
`plan → test → implement → review → verify → remember → improve` — sits over a
pile of skills rather than a lifecycle. Its canonical loop skill
(`continuous-agent-loop`) is 46 lines of ASCII diagram and bullet lists. There
is no PR-gated merge, no evidence rule and no sandbox gate in code.

Two corrections to a first, shallower read of the repo, both worth recording
because they cut in opposite directions:

- **The hook layer is the best-engineered part**, not an advisory afterthought.
  GateGuard denies through Claude Code's JSON `permissionDecision` protocol
  (which an exit-code grep misses), keeps per-session state with atomic writes
  and a 30-minute reset, classifies destructive commands quote-aware, and is
  covered by a 3,120-line behaviour test.
- **The sophisticated libraries have no consumers.** `eval-harness/` — a
  hash-linked capsule journal, effect classes SE0–SE4, offline receipts, replay
  fixtures — is referenced only by its own skill. `agent-proximity/` is computed
  and served to a read-only view; the TCAS hook that would act on it is a design
  doc that opens "nothing in this document is implemented". Read the repo as:
  hooks and installer are the product, `lib/` is one person's R&D.

Also true: 292 skills validated for YAML frontmatter only; roughly a third are
one person's client work published as skills (energy procurement, customs
compliance, visa translation, a "taste" skill for hyperpop music videos).
GateGuard's headline "+2.25 points vs ungated" is two tasks scored out of ten.

**Where Conductor is ahead**, verified by reading both: our evidence ledger is a
*gate* (the child's exit code is always the wrapper's, `cmd_sha256` + `wtree`
binding, machine-local, per-branch) where their capsule is a *journal*. Our
driver already has stall detection, a wall-clock budget, refund-on-no-work and a
propose-only improver — what their GAN harness and `loop-design-check` prescribe.
Rubric v2 and their reviewer's Pre-Report Gate converged on the same rules
independently. Always-on context: our 16.4 KB ceiling against their ~31 KB before
language rules. Their prompt-injection defence is a paragraph pasted into 67 of
68 agent files; ours is `src/loop/untrusted.js`.

---

## 2. The holes in our own envelope

Found by running ECC's loop-failure taxonomy against `src/loop/` and
`templates/.agents/hooks/`. All three are now closed.

### G1 — no Goodhart boundary (→ F9, shipped)

`pre-commit` proved a test *change* existed via `--diff-filter=ACM`. Deletions
are invisible to that filter, and adding `.skip(` **is** a change. `checker.js`
had no test-deletion or weakening check. So the two cheapest routes to "all
tests pass" were open, and so was a third: keep the test, remove what it proves.

This is `loop-design-check`'s failure mode 3 — *only gates on "all tests pass",
so the agent deletes the tests* — and it was live in our unattended loop.

### G2 — hook bypass was prose-only (→ F11, shipped)

`git commit --no-verify` skips every gate we install. Our defence was one
sentence in `hooks/README.md`. Our own `autocommit.js` uses the flag as a
reported backstop, which normalises it.

### G3 — no protected paths (→ F12, shipped)

Nothing stopped a maker beat editing `.agents/hooks/`, `.agents/rules/`,
`.agents/sandbox/` or `reviewer.md`. That is *Build may not edit the acceptance
conditions*, plus the self-modification red line, enforced nowhere.

---

## 3. What shipped (2026-09-22, `943fee5`)

| ID | Gate | Where | Test |
|---|---|---|---|
| F9 | Goodhart boundary | `hooks/lib.sh`, `hooks/pre-commit` | `test/hooks-boundary-gate.sh` G1–G9 |
| F12 | Protected paths | `hooks/lib.sh`, `hooks/pre-commit` | `test/hooks-boundary-gate.sh` P1–P7 |
| F11 | Hook-bypass blocker | `hooks/pretooluse-no-bypass.sh` | `test/hooks-no-bypass.sh` N1–N7, A1–A7, E1–E5 |

Three design decisions worth keeping:

1. **The boundary is independent of `CONDUCTOR_NO_TEST`.** That waiver means
   "this change has no test surface", which is not a licence to remove proof
   that already exists. Pinned by G9.
2. **Protected paths arm only once the enforcement surface is committed.** A
   fresh `conductor init` stages `.agents/` wholesale; blocking that would mean
   a new project can never make its first commit. You cannot weaken a gate that
   does not exist yet. Pinned by P4c — and this was found by a *regression in an
   existing suite*, not by the new tests.
3. **The bypass blocker fails open.** No node, unparseable stdin, unknown shape
   → exit 0. A hook that blocks on its own errors wedges every Bash call in the
   session. Pinned by E2/E3.

**Reach limit, stated not implied:** `PreToolUse` is a Claude Code mechanism, so
F11 guards one harness. On Codex and Antigravity the protection stays after the
fact — `autocommit.js` records a bypassed commit, `improver.js` surfaces the
recurring pattern. Detection, not prevention.

---

## 4. The rest of the backlog

**Next, in order.** Each lands inside code that already exists.

| ID | What | Lands in | Effort |
|---|---|---|---|
| F1 | GateGuard's three-stage pre-action gate: DENY the first Edit/Write/Bash per target → FORCE a named fact list → ALLOW on retry | new PreToolUse hook | M |
| F7 | Worktree lifecycle: classify each tree (dirty/merge-ready/conflict/merged/stale/idle), predict conflicts with `git merge-tree` without touching the tree, refuse to clean anything dirty or unmerged | `src/loop/swarm.js`, `worktree.js` | S |
| F3 | Hook metadata sidecar: stable IDs, each fingerprinting its matcher and command; CI fails on drift or a reorder that swaps IDs | `templates/.agents/hooks/`, CI | S |

Two notes for F1 when it starts. Import ECC's **denial dampening**: emit the
full fact block only for the first three denials per session, then a condensed
line carrying the denial ordinal, because textually identical denials push the
model into a repetition loop (their code says this was measured). And gate it
with our own eval in `test/evals/` before it ships — adopting their mechanism on
their two-task evidence would be inheriting exactly the standard this framework
exists to reject.

**Design pass first.**

| ID | What | Why it waits |
|---|---|---|
| F8 | Agent-proximity admission control: may these two swarm workers run concurrently at all? Three channels (line-range overlap via Szymkiewicz–Simpson, import-graph coupling decaying with graph distance, tree proximity) combined with a noisy-OR, then hold/steer right-of-way | The only genuine invention in ECC, and MIT. Needs adapting to our dispatch shape, not copying. Roadmap doc before code. |
| F4 | Plan Canvas: the human annotates a plan in a browser by pointing at an element, returns `approve`/`request-changes` as JSON to a blocked CLI call | Highest PO value, biggest job. We already render HTML in `src/view/`; this is the missing return path. |
| F10 | PreCompact handoff snapshot into `1-workbench/` | Today `handoff` relies on the agent remembering to run it. Interactive-path change — needs care. |
| F15 | Brownfield spec extraction: flat Requirement/Invariant blocks, `id` anchored to the enforcement point so it survives renames, optional test anchors | We have no spec-from-code path. `deepen` is deep modules; `trace-documentation` is backlog links. |

**Parked or dropped.**

| ID | What | Call |
|---|---|---|
| F2 | Instincts: atomic YAML units, 0.3–0.9 confidence, scoped by hash of the git remote, promoted to global after 2+ projects | **Hold** until the review-convergence measurement closes. Adding a second unmeasured learning surface buys two unmeasured things. |
| F5 | `rules-distill`: find principles recurring across skills, distil into a rule file | Opportunistic — fold into whatever touches skills next. |
| F13 | Research-and-reuse step before net-new code | Prose only. Zero hits for "existing library" / "gh search" in our templates today. |
| F14 | Delete-zone for intentional removals | Prose only. Prevents re-creating something deliberately removed. |
| F6 | Rationalisation-tell regex in the Stop hook | **Dropped.** Four patterns, warn-only, trivially evaded. Not worth the surface. |

**Not importing:** the 292-skill catalogue, the seven-harness adapter layer, the
commercial direction (hosted scanning, org policy, SOC2 evidence packs). Breadth
is their product and would be our liability.

**One operational note if ECC is ever installed for real:** its `hooks.json`
embeds a minified plugin-root resolver that then executes node scripts from a
path discovered at runtime. Executable config with a hairy resolution path.
