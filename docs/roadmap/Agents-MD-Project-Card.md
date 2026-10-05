# Root AGENTS.md and the Project Card (D2, D3)

> **Status:** design, approved in principle 2026-10-05 (D2, D3). Not built.
> **Scope:** make every harness load the same instructions from one standard file, and give
> every session a short, current description of the project.
> **Out of scope:** nested AGENTS.md per code directory (D4), shrinking the framework text.
>
> Facts marked *verified* were checked against primary sources or the code on 2026-10-05.
> Facts marked *to verify* need a live run before we depend on them.

---

## 1. The problem

1. **No project knowledge loads by default.** Every session loads framework instructions only.
   `conductor/` holds the project knowledge, and one prose rule (`prime-directive.md`, "Context
   First") asks the agent to read it. Compliance depends on the model and the task. *Verified.*
2. **The framework itself does not load reliably outside Antigravity.** `trigger: always_on`
   in `.agents/rules/*.md` and `.agents/AGENTS.md` is an Antigravity convention. Claude Code
   loads `CLAUDE.md`, and our `CLAUDE.md` only says, in prose, "Read and follow
   `.agents/AGENTS.md`". Codex reads root `AGENTS.md`, which we do not ship. So on the two most
   used harnesses, the classifier and the four laws (TDD, verification, prime directive, loop
   guardrails) load only if the agent obeys a sentence. *Verified in the templates.*
3. **We do not follow the standard file.** AGENTS.md (stewarded by the AAIF, Linux Foundation)
   goes "at the root of the repository", with nested files in packages, "the closest one takes
   precedence". About 25 tools read it. *Verified, agents.md.*
4. **Claude Code reads root AGENTS.md only without a CLAUDE.md**, or when `CLAUDE.md` contains
   `@AGENTS.md` (v2.1.277+). *Verified, code.claude.com/docs/en/memory.*

Cost today, measured on the templates: 16.5 KB (~4,000 tokens) counted as always-on framework,
0 bytes of project. Each session that needs the project spends turns finding it again.

## 2. Target layout

```
AGENTS.md            ← the one standard file every harness reads
  [managed: framework]   generated from .agents/ (classifier + always-on rules), refreshed by upgrade
  [managed: project card] ≤ 3 KB, written by an agent, checked by code
  (user content)          anything outside the markers, never touched
CLAUDE.md            ← "@AGENTS.md" + Claude-only notes (slash commands); managed block
GEMINI.md            ← pointer to AGENTS.md + Gemini-only notes; managed block
.agents/             ← unchanged: still the single source for rules, skills, workflows, personas
.agents/skills/      ← already the Agent Skills location Codex scans; .claude/skills shims stay
```

- `.agents/` stays the source of truth. Root `AGENTS.md`'s framework block is **generated** from
  it, so nobody edits the same rule in two places.
- The framework block contains the classifier and the always-on rules **inline**: AGENTS.md has
  no import syntax for Codex and the other tools. Size is the same 16.5 KB the context-budget
  ratchet already tracks, now actually loaded everywhere.
- `CLAUDE.md` imports with `@AGENTS.md`, which is deterministic, unlike today's prose pointer.
- `.agents/AGENTS.md` stays as the source file. Eleven references in templates and `src/` keep
  working.

## 3. The project card

### Content (fixed headings, in this order)

| Heading | Content | Source |
|---|---|---|
| Purpose | 2–3 sentences: what the product is, for whom | `0-compass/north-star.md` |
| Stack | languages, frameworks, datastore, hosting | `4-context/technical/tech-stack.md`, survey facts |
| Commands | install, run, test, verify, build | `conductor.config.json` `verify`, `loop.setup`, manifests |
| Layout | ≤ 10 lines: top-level directories and what they hold | survey facts, `architecture.md` |
| Conventions | ≤ 5 bullets that change how code is written | `4-context/technical/coding-patterns.md` |
| Product areas | one line per area, with its path | `3-product-areas/*/` |
| Read more | links to the `conductor/` documents above | fixed |

Limit: **3,072 bytes**. That is under a fifth of the framework block, and enough for the table
above. A card that needs more is a sign the detail belongs in `conductor/`.

### Who does what

Writing the card is a summary, so an agent writes it. You were right that code cannot. But
everything around the writing is deterministic, so code owns it:

| Step | Owner | How |
|---|---|---|
| Collect facts (verify command, setup, manifests, directory list, area list) | code | `conductor agents-md facts` (reuses `src/survey.js`) |
| Write Purpose, Stack, Layout, Conventions, area one-liners | agent | workflow `agents-md.md` |
| Enforce headings, order, size, markers | code | `conductor agents-md check`, exit 0/1 |
| Stamp freshness | code | `check` writes a fingerprint of the source files into the card's begin marker |
| Detect drift | code | `conductor status` compares the fingerprint with the sources: "project card is stale" |

The workflow's last step is `conductor agents-md check`, and the Evidence Rule applies: the
agent may claim the card is done only on exit 0. The agent cannot widen the limit: the check
reads it from code, not from the card.

### Freshness without a model on every commit

The fingerprint covers `north-star.md`, `4-context/technical/*.md`, the list of
`3-product-areas/*`, and the `verify` and `loop.setup` values. When any of them changes:

- `conductor status` shows the card as stale and names the changed sources.
- The interactive classifier in `AGENTS.md` gets one line: when the card is stale and the task
  touches the product, run the `agents-md` workflow after the task.
- No hook regenerates it automatically: that would need a model call on commit.

## 4. Migration

### What `upgrade` does (code, deterministic)

| Repo state | Action |
|---|---|
| No root `AGENTS.md` | Create it: framework block + an empty card block marked `status: draft` |
| Root `AGENTS.md` written by the team | Insert both managed blocks at the top. Keep their text below, untouched |
| `CLAUDE.md` / `GEMINI.md` | Refresh the managed block as today (`src/stubs.js`). New block content: `@AGENTS.md` / pointer. User notes below the marker stay |
| Scaffold gitignored (agent files not shared) | `AGENTS.md` follows `CLAUDE.md`: if `CLAUDE.md` is ignored, add `AGENTS.md` to the same ignore. A shared root `AGENTS.md` written by the team stays shared, and then the card goes in `CLAUDE.local.md` instead (*to verify*) |
| Loop worktrees | Add `AGENTS.md` to `CONTEXT_ANCHORS` in `src/loop/worktree.js` |

Then `upgrade` prints one line: "Project card is empty. Run the `agents-md` workflow (`/agents-md`
in Claude Code)." `conductor status` keeps showing it until the card passes `check`.

### What the agent does (workflow `agents-md.md`)

1. Run `conductor agents-md facts`. Use these facts as given, never re-derive them.
2. Read the sources in the table in §3. Also read the user sections of `CLAUDE.md` and `GEMINI.md`:
   on existing installs, teams often described the project there. Move that description into the
   card. Never delete user text: report what you moved, and let the human remove the duplicate.
3. Write the card under the fixed headings. Where a source is empty (fresh install, or `conductor/`
   never filled), write "Unknown — fill `<path>`" rather than invent.
4. Run `conductor agents-md check`. Fix and repeat until exit 0.
5. Show the human the card and the moved text. One confirmation, then commit with the rest of
   the work.

Same workflow for the first migration and every refresh: on a refresh, step 2 only reads the
sources the stale message named.

## 5. Harness support

| Harness | Reads | After this change | Status |
|---|---|---|---|
| Claude Code | `CLAUDE.md` (+ `@AGENTS.md`) | framework + card, deterministic | verified (docs) |
| Codex | root `AGENTS.md`, nearest wins | framework + card | verified (agents.md, Codex docs) |
| Copilot, Cursor, Zed, Jules… | root `AGENTS.md` | framework + card | verified (agents.md list) |
| Antigravity 2.0 / agy | `.agents/rules` always-on, `GEMINI.md` | as today, plus card through the pointer | *to verify*: does it also read root `AGENTS.md`? If yes, the rules load twice (~4,000 extra tokens) and the framework block must be skipped for it |
| Gemini CLI | `GEMINI.md`, `AGENTS.md` if configured | as today, plus card through the pointer | *to verify* |

## 6. Enforcement and tests

- `conductor agents-md check`: behaviour tests for size, missing heading, wrong order, missing
  markers, stale fingerprint.
- `upgrade` tests for each row of the §4 table, including "team-owned AGENTS.md keeps every byte
  outside the markers".
- `test/context-budget.test.js`: framework block counted once, card ceiling 3,072 bytes.
- Agent-layer eval (`test/evals/`): given a filled `conductor/`, the workflow produces a card that
  passes `check` and names the real verify command. A sensitivity case with an empty
  `conductor/` must produce "Unknown — fill …" lines, not invented facts.
- Live: one Claude Code session and one Codex session on a migrated repo, each asked "what does
  this project do and how do I run its tests?" without reading any file first.

## 7. Delivery

1. `AGENTS.md` generation + stub changes + `upgrade` migration + `CONTEXT_ANCHORS` (code only,
   card block empty). Live check on Claude Code and Codex.
2. `conductor agents-md facts|check`, `status` drift line.
3. Workflow `agents-md.md`, slash shim, classifier line, eval.
4. Release note: what a team sees in its repo after `upgrade` (a new root `AGENTS.md`), and the
   one workflow to run.

## 8. Open questions

- Q1. Antigravity and Gemini CLI: do they read root `AGENTS.md`? Decides whether the framework
  block is skipped for them (§5).
- Q2. Private setups with a shared, team-owned root `AGENTS.md`: is `CLAUDE.local.md` loaded
  reliably in Claude Code today? Decides where the card goes in that case (§4).
- Q3. 3,072 bytes is a starting value. Measure on two real projects before release.
