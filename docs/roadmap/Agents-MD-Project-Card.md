# Root AGENTS.md and the Project Card

> **Status:** decisions D5–D13 approved 2026-10-05. R4 and R5 verified live. Delivery steps 1–4
> built: F21 (#48), root `AGENTS.md` generation and migration (#50), `conductor agents-md
> facts|write|check` + `status` drift line + the `agents-md` workflow. Live: the workflow wrote a
> 2,284-byte card on a real project, passing `check`. Step 5 eval done: the card cut turns by 61%
> and cost by 35% (§7); full card kept. Released in 6.7.0.
> **Scope:** one standard instruction file that every harness loads, a leaner framework text,
> and a short, current description of the project in every session.
> **Out of scope:** nested AGENTS.md per code directory (D4).
>
> *Verified* = checked against primary sources, the code, or a live run on 2026-10-05.
> *Assumed* = accepted without proof, by decision.

---

## 1. The problem

1. **No project knowledge loads by default.** Sessions load framework text only. `conductor/`
   holds the project knowledge, and one prose rule asks the agent to read it. *Verified.*
2. **The framework does not load reliably outside Antigravity.** `trigger: always_on` is an
   Antigravity convention. Our `CLAUDE.md` says, in prose, "Read and follow `.agents/AGENTS.md`".
   The Claude Code docs: with such a sentence, "Claude sees `AGENTS.md` only if it decides to open
   the file". Codex reads root `AGENTS.md`, which we do not ship. So on the two most used harnesses
   the classifier and the laws load only if the agent obeys one sentence. *Verified.*
3. **Our `CLAUDE.md` hides the team's instructions (F20).** By default Claude Code reads no
   `AGENTS.md` at all when a `CLAUDE.md` exists in the working directory or above, including a
   team's `repo/AGENTS.md` in a subdirectory. *Verified, docs.*
4. **We do not follow the standard.** AGENTS.md (AAIF, Linux Foundation) goes "at the root of the
   repository"; nested files in packages, "the closest one takes precedence". *Verified.*

What matters is not the token price: the always-loaded text is served from the prompt cache after
the first turn. It is **adherence** ("Longer files consume more context and reduce adherence",
target under 200 lines, Claude Code docs) and the **turns** an agent spends finding the project.

## 2. Layout rule

The harness always starts in the folder that holds `conductor/` and `.agents/`. Conductor writes
only there, never inside a nested repository.

| Layout | Working folder | Root `AGENTS.md` is seen by |
|---|---|---|
| Embedded (solo) | the code repository | you only: the repository is yours |
| Outer (team) | your private outer repository; the team's code is in a subfolder | you only: the team repository is untouched |

In the outer layout, with no `CLAUDE.md` in the working folder, Claude Code also reads the team's
`repo/AGENTS.md` when it opens a file there (unless `repo/` has its own `CLAUDE.md`, which then
loads instead). This fixes F20. *Verified, docs.* Codex started in the outer folder reads only the
outer file (R6, documented limit). The loop refuses the outer layout (D1), unchanged.

## 3. Target files

```
AGENTS.md        the only instruction file
  [managed: framework]     generated from .agents/, refreshed by upgrade
  [managed: project card]  facts from code + summary from an agent, checked by code
  (user content)           outside the markers, never touched
.agents/         unchanged: the only place framework text is edited
```

- `CLAUDE.md` and `GEMINI.md` are removed from the templates (D5). Claude Code ≥ 2.1.277 reads
  `AGENTS.md` when no `CLAUDE.md` exists (D9). Antigravity is assumed to read `AGENTS.md` (D7).
- Claude Code reads nothing under `.agents/`, and Codex has no import syntax, so the framework text
  is **inline** in the generated block.
- `trigger: always_on` is removed from `.agents/rules/*.md`: `AGENTS.md` now carries them, and
  Antigravity would otherwise load them twice.

## 4. Three loading levels

| Level | Loaded | Content | Size |
|---|---|---|---|
| 1. Always | every session, every harness | framework block + project card | ~6.3 KB + card (measured) |
| 2. Discovered | names and descriptions by the harness, body on use | skills (`.agents/skills/`, `.claude/skills` shims) | unchanged |
| 3. On demand | through links in level 1 | `how-it-works.md`, workflows, personas, `conductor/` documents | unchanged |

### Level 1 content (F21: from 8.3 KB to 6.0 KB, measured)

Correction: `loop-guardrails.md` was already loop-scoped (`trigger: manual`), so it was never in
the always-loaded set; the "~11 KB" estimate counted it. The generated block measures ~6.3 KB with
its markers, the D11 precedence line and the D13 wording.

| Source | Keeps | Moves to |
|---|---|---|
| `.agents/AGENTS.md` (4.1 KB) | boundaries, request classifier | "Hybrid Architecture" and "Quick Reference" → `how-it-works.md` (rules are inline, links to them are dead weight) |
| `prime-directive.md` (0.9 KB) | all | — |
| `test-driven-law.md` (2.7 KB) | the law and its one exception | "Where this fits" → `how-it-works.md`; "Interactive vs. unattended" → loop prompt |
| `verification-iron-law.md` (0.6 KB) | all | — |
| `loop-guardrails.md` (2.8 KB) | — | the loop prompt: it applies only to unattended runs |
| new | the D11 precedence line | — |

Where a hook enforces a rule (TDD presence, protected paths, verify on push), the prose shrinks to
the rule plus "enforced by the `pre-commit` hook" (F22). Hooks are installed by default (D10):
`init` and `upgrade` already wired them in any git repo before this design.

**D12, D13 (prime directive):** no visible `<thinking>` block; confirmation only before destructive
or hard-to-undo actions and product decisions, and unattended runs follow `unattended-loop.md`.

**D11, precedence in the outer layout:** the team's instructions win for code style and repository
process (branches, commit format, review). Conductor wins for its own process (TDD, verification,
`conductor/` state).

## 5. The project card

| Heading | Written by | Source |
|---|---|---|
| Commands | code | `conductor.config.json` (`verify`, `loop.setup`), manifests |
| Stack | code | manifests, `src/survey.js` |
| Layout | code | top-level directories, survey |
| Product areas (list + paths) | code | `conductor/3-product-areas/*/` |
| Purpose | agent | `0-compass/north-star.md` |
| Conventions (≤ 5) | agent | `4-context/technical/coding-patterns.md` |
| Product areas (one line each) | agent | each area's documents |
| Read more | code | fixed links into `conductor/` |

Code first (F23): what the code can state, it states, and it is always true. The agent writes only
the three summaries. Where a source is empty, the agent writes "Unknown — fill `<path>`".

- `conductor agents-md facts`: prints the code-derived sections.
- `conductor agents-md check`: exit 0/1 on headings, order, size and markers; stamps a fingerprint
  of the sources (the `conductor/` documents above, the manifests, the top-level directory list,
  `verify`, `loop.setup`) into the card's begin marker.
- `conductor status`: "project card is stale", naming the changed sources.
- The agent may call the card done only on `check` exit 0 (Evidence Rule).
- Stable project facts go in the card, not in Claude's personal auto memory (F24).

**Size:** set by an eval (§7). Full card ≈ 3 KB, or Commands + Layout only ≈ 1 KB, fully generated.

## 6. Migration (`upgrade`)

| Repo state | Action |
|---|---|
| No root `AGENTS.md` | Create it: framework block + card block with code facts, agent sections marked draft |
| Root `AGENTS.md` exists (e.g. `euranova-os`) | Insert the managed blocks at the top; keep the rest byte for byte |
| `CLAUDE.md` / `GEMINI.md` with user notes below the marker | Move the notes into the user section of `AGENTS.md`, back up both files, delete them (D8) |
| Same files without our marker (team- or user-written) | Same, with the whole content moved |
| Loop worktrees | `CONTEXT_ANCHORS`: add `AGENTS.md`, drop `CLAUDE.md` and `GEMINI.md` |
| Hooks not installed | Install them (D10) |
| Claude Code < 2.1.277 | Warn in `init`, `upgrade`, `status` and the loop pre-flight (D9) |
| `CLAUDE.local.md` in the working folder | Warn: it switches `AGENTS.md` off for you |

`upgrade` then prints one line: run the `agents-md` workflow to write the card summaries.

### Workflow `agents-md.md`

1. Run `conductor agents-md facts`; use them as given.
2. Read the sources of the three agent sections. On a first migration, also read the notes moved
   from the old stubs: a project description there goes into Purpose. Report what moved; delete
   nothing.
3. Write the three sections.
4. Run `conductor agents-md check` until exit 0.
5. Show the human the card. One confirmation, then commit.

## 7. Verification

| Item | How | Status |
|---|---|---|
| R4: `AGENTS.md` reloads after `/compact` | one long-lived `claude -p` stream session: canary changed on disk, compaction, canary asked → new word, same as `CLAUDE.md` | *verified* |
| R5: headless `claude -p` loads `AGENTS.md` | canary in a fresh `-p` run | *verified*. "First session after a Claude Code upgrade" not reproducible: covered by the version warning and by the laws in the loop prompt |
| Card value | agent eval, 5 project questions on `eurassistant`, card vs draft card, 2 runs each, read-only tools | *done 2026-10-05*: turns 23 vs 59, cost $1.25 vs $1.93, time 81 s vs 161 s, expected answer 10/10 vs 8/10 (the 2 misses were coverage, not errors). Full card kept, limit 3,072 bytes |
| Migration | `upgrade` tests per §6 row; "existing `AGENTS.md` keeps every byte outside the markers" | to build |
| Harnesses | live: Claude Code and Codex on a migrated repo, "what does this project do and how do I run its tests?" without reading a file | to run |
| Budget | `context-budget` ratchet: framework block ≤ its new size, card ≤ its limit | to build |

## 8. Delivery

1. F21: trim the framework text in `.agents/` (helps current installs at once).
2. Root `AGENTS.md` generation, stub removal and migration, `CONTEXT_ANCHORS`, hooks by default,
   version and `CLAUDE.local.md` warnings, D11 line. Live check on Claude Code and Codex.
3. `conductor agents-md facts|check`, `status` stale line.
4. Workflow `agents-md.md` and its eval; card eval decides the size.
5. Release note: a new root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` gone, one workflow to run.

## 9. Found during this design, separate

- F26: inside the `cli-native` sandbox, an agent cannot run `npx github:charlus/conductor-framework …`
  (read-only npm cache), so workflow steps that call the CLI fail in loop beats. Seen in a beat log.
