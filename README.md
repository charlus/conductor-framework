# 🎼 Conductor Framework

**The Conductor** — a framework for **disciplined, verifiable, autonomous AI software engineering**.

Conductor is a harness layer: it configures your AI coding assistant (Claude Code, Antigravity, Codex) with a full engineering methodology — Plan → Design → Build → Ship → Learn — and enforces the discipline in **code, not prose**, so AI output becomes something you can actually depend on.

**What makes it different:**

- **Laws enforced by code.** Deterministic git hooks gate every commit and push: no implementation without a test (Test-Driven Law), no LLM feature without an eval (Eval-Driven Law). Prose rules are advisory; a hook can't be reasoned around.
- **Evals for the non-deterministic surface.** Tests verify deterministic code; **evals** verify LLM output. A **ship-contract** (`architecture-checklist`) turns "follow the architecture" into checkable items the Checker verifies before anything merges.
- **An autonomous, multi-engine loop.** `conductor loop` drives a Maker/Checker build cycle unattended across Claude Code / `agy` / `codex`, with safety baked in: PR-gated merge (never a direct push), sandbox isolation, and an Evidence Rule — a model can't self-declare victory.

---

## Quick Install

```bash
npx github:charlus/conductor-framework init
```

This scaffolds the full Conductor Framework into your project:

```
your-project/
├── .agents/              # AI agent core (rules, workflows, skills, personas, hooks)
│   ├── AGENTS.md        # Routing table (quick reference)
│   ├── rules/           # Always-on laws (Prime Directive, Verification, Test-Driven)
│   ├── workflows/       # Genesis → Build → Ship pipeline
│   ├── skills/          # 31 modular skills
│   ├── personas/        # 12 thinking partners
│   ├── hooks/           # Deterministic enforcement (TDD + Eval git hooks)
│   ├── references/      # On-demand reference docs
│   └── tests/           # Framework self-test
├── conductor/           # Project state (all managed artifacts)
│   ├── 0-compass/       # North Star & Ship Log
│   ├── 1-workbench/     # Active work (scratchpad, inbox, loop-state.json)
│   ├── 2-backlog/       # Queued work
│   ├── 3-product-areas/ # Feature inventory
│   ├── 4-context/       # Tribal knowledge
│   ├── 5-templates/     # Document templates
│   └── 6-archive/       # Completed work
├── GEMINI.md            # Gemini auto-discovery stub
└── CLAUDE.md            # Claude auto-discovery stub
```

### Options

```bash
# Install into a specific directory
npx github:charlus/conductor-framework init ./my-project

# Only install .agents/ (for existing projects)
npx github:charlus/conductor-framework init --agent-only

# Overwrite an existing installation
npx github:charlus/conductor-framework init --force
```

### Upgrading

Already have Conductor installed? Upgrade to the latest:

```bash
npx github:charlus/conductor-framework upgrade
```

Upgrade works from **any prior version** (V4, V5, or a hand-copied install) on a single principle — **your `conductor/` project knowledge is preserved; the `.agents/` methodology is replaced.** It will:
- **Back up first** — the existing `.agents/` (and any migrated folders) are copied to a git-ignored `.conductor-backup/<timestamp>/` before anything changes; a failure mid-run auto-restores.
- **Replace the instructions** — `.agents/` framework files (workflows, skills, rules, personas) are overwritten with the current version, so a methodology upgrade actually lands. **Custom** skills/workflows you added are carried forward; new core capabilities (e.g. the interview primitives) install even if they postdate your original selection.
- **Refresh `conductor/5-templates/`** — the framework document scaffolding — while leaving all your knowledge in `0-compass`, `2-backlog`, `3-product-areas`, `4-context`, `6-archive` untouched.
- **Migrate structure & schema** — legacy `.agent/` / `.conductor/` / root numbered folders → the `conductor/` dashboard; `loop-state.json` → the current schema.
- **Refresh platform stubs** — the framework block in `CLAUDE.md`/`GEMINI.md` (between `<!-- conductor:managed -->` markers) is updated in place while your own notes outside it are kept; your `CHANGELOG.md` is never touched.
- **Stamp the version** — records the framework version for idempotent future upgrades.

Preview any upgrade with `upgrade --dry-run` (prints the plan, writes nothing).

### Skill Registry (optional)

Beyond the 31 core skills bundled in `templates/`, Conductor can download tech-specific or domain skills on demand from a registry you configure:

```bash
npx conductor-framework list --remote          # browse the registry
npx conductor-framework search react           # search by keyword
npx conductor-framework add react-components    # install a skill
npx conductor-framework remove react-components # uninstall a skill
```

This requires a `conductor.config.json` (scaffolded by `init`) pointing at your own skills registry — there is no public registry yet, so this is aimed at teams running a private one (e.g. on GitLab, via `glab`).

---

## How It Works

Tell your AI assistant what you need. The Conductor classifies and routes:

| You say... | Conductor routes to |
|:---|:---|
| "I have an idea" | **Genesis** workflow → full problem exploration |
| "Build it" | **Build** workflow → verified execution |
| "Quick path" | **Quick-Path** → skip discovery, go fast |
| "Loop", "Unattended" | **Unattended-Loop** workflow → headless autonomous run |
| "CTO mode" | **CTO** persona → strategic thinking partner |
| "Security mode" | **Security Auditor** persona → vulnerability analysis |

### The Pipeline

```
Genesis → Storyboard → Grand PRD → UX/UI Design Brief → Technical Vision → Carve → Spec-It → Build → Ship → Retrospective
   ↑                                                                                                  ↑
   └── Discovery Phase ─────────────────────────────────────────────── Execution Phase ──────────────┘
```

### What's Inside

- **16 Workflows** — From Genesis (ideation) to Build (verified execution) to Ship, plus the headless **Unattended-Loop** orchestrator and its independent **Loop-Checker**
- **31 Skills** — including the `grilling` and `collaborative-drafting` interview/drafting primitives, `writing-evals` + `architecture-checklist` (the ship-contract), `handoff` (context hygiene), Verification Gate, Code Review, Systematic Debugging, and more
- **12 Personas** — Including the strategic thinking partners and loop-execution specialists (**Maker** and **Checker**)

Full documentation: [`AGENTS.md`](templates/.agents/AGENTS.md)

*Note: Conductor uses **Progressive Disclosure**. IDEs only load a tiny `prime-directive.md` which points them to `AGENTS.md` for routing. This keeps your context window clean and lightning fast!*

---

## The Verification Iron Law

> **No completion claims without fresh verification evidence.**

Before claiming any work is done, the agent must run a check, read the output, confirm it matches, and only then claim completion. "Should work" is not evidence.

Conductor backs its laws with **code, not just prose** — deterministic git hooks (`.agents/hooks/`, wired by `conductor install-hooks`), because prose rules are advisory and only code enforces:

- **Test-Driven Law** — a `pre-commit` gate blocks implementation code staged with no test.
- **Eval-Driven Law** — tests verify the deterministic surface; **evals** verify the non-deterministic LLM-output surface of the apps you build. If a feature calls an LLM provider, a `pre-commit` gate requires an evalset alongside it and a `pre-push` gate runs it — see the `writing-evals` skill (three grading modes). The **ship-contract** extends this: `architecture-checklist` turns "follow the architecture" into checkable items the Checker verifies. Every escape hatch is logged, never silent.

**And the law now has a memory.** "Fresh evidence" used to mean *fresh at the moment of the check* — after that the result was trusted indefinitely, which is why a review round would re-run the whole suite to prove something it had already proven. `conductor evidence` binds a verification run to a **content fingerprint of the working tree**:

```bash
conductor evidence run --label tests -- npm test     # run it, and record what it ran against
conductor evidence check --label tests               # FRESH / STALE / MISSING
```

Commit exactly the code that was tested and the evidence stays **FRESH**. Add an untracked source file and it goes **STALE**. `pre-push` uses this to skip a re-run it does not need — and only ever to *skip* one: no ledger, no CLI, or any doubt at all, and the command runs. The ledger can never satisfy the gate on its own.

---

## 🤖 Autonomous Loop Backend (V6)

Conductor drives headless, unattended building through a **deterministic loop backend** — a pure state machine (`src/loop/driver.js`), not a prose-only prompt. Run it with `conductor loop`, or trigger the **Unattended-Loop** workflow from a recursive harness.

The driver reads and writes **The Spine** (a durable JSON ledger, `conductor/1-workbench/loop-state.json` — v2 schema) and enforces the guardrails in code, not just advice:
* **Iteration Ceiling & wall-clock budget** — bound token spend on headless runs.
* **Driver-observable stall detection** — halts when progress stops instead of looping forever.
* **The Evidence Rule** — task completion resolves from the verify command's exit code, fail-safe; a model can't self-declare victory.
* **The Scoping Barrier** — headless runs are refused during `discovery` (that phase needs a human).

Around the driver:
* **Platform adapters** (`src/loop/adapters/`) — Claude Code (primary), Antigravity (`agy`), and Codex (`codex`), each verified against the installed CLI; selected via `--platform` → `loop-state.json` → auto-detect.
* **Maker/Checker split** — the Maker builds in an isolated git worktree; an **independent Checker** process verifies via a multi-vote verdict (`checker-verdict.json`, fail-safe reject).
* **Sandbox gate** — real headless runs are gated behind a sandbox (`--unsafe-no-sandbox` to override); L3 requires `cli-native` (the CLI vendor's own sandbox — Anthropic bubblewrap for `claude`, no Docker image needed) or a container.
* **Swarm scaling & autonomy slider (L0–L3)** — parallelize independent work with a PR-gated merge queue.

**Ignition contract** — the driver is a *goal* loop with no scheduler of its own (by design). Seed it from an external trigger and it composes into the **time-based** and **proactive** loops of Anthropic's Loop-Engineering taxonomy:

```bash
# recurring (drive from Claude Code /schedule or host cron)
conductor loop --goal "check for new TODO comments and address them"
# event-driven (a webhook/CI shim writes the payload, then fires the loop)
conductor loop --event ./event.json
```

A trigger can seed the goal but is **clamped to the operator's autonomy ceiling** — a payload (which may come from an untrusted source) can de-escalate but never escalate. Every driver guardrail still binds.

### Triggers from outside are treated as untrusted

`--event` lets an issue body, a PR comment or a chat message seed a run — which means anyone who can file an issue can put text in front of an unattended agent holding your credentials. That is a live attack class, not a hypothetical: in 2026 a single malicious issue *title* was turned into an npm supply-chain compromise, and the same shape was disclosed in three major coding agents.

So privilege comes from **you**, never from the event:

- **Trust follows authorship, not transport.** A third-party source without operator-level access is untrusted. A `cron` or CI trigger carrying text *you* wrote keeps full trust. A shim forwarding third-party text marks it with `author_association` or `"untrusted": true`.
- An untrusted run is clamped to the **no-merge floor**, so the worst case is a branch you review.
- Its goal and context are **enveloped and labelled as data, never instructions**, with injection attempts flagged inline and fullwidth/zero-width evasion folded for matching.
- It gets an explicit **tool allowlist** — read and edit, no shell, no network. An allowlist, because every published bypass of this agent class defeated a blocklist.

**▶ How to run it on your repo:** see the step-by-step guide [`docs/Running-The-Loop.md`](docs/Running-The-Loop.md) — configure The Spine (`loop-state.json`), `--dry-run` to preview, then `conductor loop <dir> --platform claude --unsafe-no-sandbox`.

See also [`docs/roadmap/Autonomous-Loop-Backend.md`](docs/roadmap/Autonomous-Loop-Backend.md), [`docs/roadmap/Loop-Engineering-Alignment.md`](docs/roadmap/Loop-Engineering-Alignment.md), [`docs/roadmap/Loop-Robustness-Plan.md`](docs/roadmap/Loop-Robustness-Plan.md), and [`docs/adr/0001-enforcement-and-autonomy-rebalance.md`](docs/adr/0001-enforcement-and-autonomy-rebalance.md).

---

## Review That Finishes

An independent fresh-context reviewer checks every consequential artifact before it ships — a PRD, an architecture, a spec, a diff. The hard part is making that gate **terminate**: a reviewer told to "find the reason this is not ready" will always find something, so review-until-clean never converges and the cost lands on you as a fourth round and a request for help.

Conductor's answer (**Rubric v2**) is one short, self-contained reviewer brief with a bar on the *rejection*, not on the approval:

- A **BLOCKER** needs the **quoted line that proves it** and confidence **≥ 7**. Cannot quote it? It is reported as IMPORTANT — never promoted to clear the bar.
- **`APPROVE` means zero blockers, not zero findings.** IMPORTANT and NIT are reported and the change still ships.
- The reviewer judges the **acceptance criteria as a checklist**, so "is this finished?" is a bounded question with a reachable answer.
- It reports the **whole class**, not one instance — otherwise every instance costs a round.
- An explicit **"Not a finding"** list: already fixed in this diff, anything the linter enforces, process artefacts, test-structure opinions, consistency-only churn.
- **One** delta round, then a single batched question to you. No follow-up backlog — a proven defect is fixed now or written into the PR body under *Known gaps*.

The bar is enforced in code (`src/loop/checker.js`), not just prose, and it can only ever make the gate stricter: a malformed blocker is still a rejection, and a verdict that approves while listing a blocker fails safe.

### It measures itself

A rubric is config: change it and every verdict changes. So the gate keeps a ledger and tells you when **it** is the problem:

```bash
conductor review-log summary
```

```
Review findings: 4 (1 blockers)
Dismissal rate:  75%

By class:
     3    0 blk  100% dismissed  test-structure
     1    1 blk    0% dismissed  sql

Rubric suspects (dismissed >50% of the time, n>=3):
  test-structure — add a worked case to skills/independent-review/calibration.md
```

A class you keep dismissing is a **rubric** defect, not a discipline problem. Fix the rubric.

---

## Progressive Disclosure, With a Number

A methodology that loads everything up front is just a big prompt. Conductor loads a compact classifier plus a handful of always-on rules; skills and workflows are pulled in on demand. That is only true if something enforces it:

```bash
conductor context-bill
```

```
ALWAYS-ON (every session pays this): 16.1 KB ≈ 4409 tokens
     3.8 KB  classifier         AGENTS.md
     2.6 KB  rule               rules/test-driven-law.md
     ...
EAGER (paid only when invoked): 31 skills, 16 workflows
```

CI fails on growth past a committed ceiling **and** on a new skill or workflow with no budget entry at all — so adding context is a visible decision, never a default. Ceilings are in bytes: exact, and they do not drift when a tokenizer changes.

---

## Self-Test

Validate your installation:

```bash
bash .agents/tests/check-conductor.sh
```

---

## Credits & Acknowledgments

Conductor was built by standing on the shoulders of giants. This framework incorporates ideas, patterns, and direct inspiration from:

- **[Conductor Framework](https://www.testinprod.co/)** by Test in Prod — The original framework that started it all. Conductor is an evolution of their pioneering ASE methodology.

- **[Antigravity Kit](https://github.com/vudovn/antigravity-kit)** by vudovn — A comprehensive skill library (36 skills, 18 agents, 10 workflows) that contributed engineering skills, design patterns, and the multi-file skill architecture.

- **[Antigravity Superpowers](https://github.com/skainguyen1412/antigravity-superpowers)** by skainguyen1412 — Contributed the self-test infrastructure, the npx install pattern, and rich debugging sub-docs.

- **[Superpowers](https://github.com/obra/superpowers)** by obra — The original inspiration for Antigravity Superpowers and many AI agent patterns in the ecosystem.

We believe in building on each other's work. If you find value in Conductor, consider contributing back.

---

## License

MIT
