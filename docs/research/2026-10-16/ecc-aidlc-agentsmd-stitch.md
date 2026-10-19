# ECC, AI-DLC, AGENTS.md, Stitch: state on 2026-10-16

Method: GitHub API and primary docs only. No third-party code executed. Evidence labels: MEASURED (the source shows a measured result), IMPLEMENTED (code exists, effect unmeasured), CLAIMED (prose only). Classification against Conductor: ALREADY-HAVE, PREVIOUSLY-DECLINED/PARKED, NEW.

## Ranked ideas

| # | Idea | Evidence | Class | Value |
|---|---|---|---|---|
| I1 | ECC's 336-trial fact-gate study: benefit not established, cost +35–45% turns and spend | MEASURED | Affects ALREADY-HAVE (F1 fact gate) | High, near-zero build cost |
| I2 | Claude Code: `.claude/CLAUDE.md` and any CLAUDE.md in a parent folder also hide AGENTS.md. Conductor warns only for the working folder | MEASURED by docs (primary) | NEW, small gap in D9 | High per cost |
| I3 | DESIGN.md has become a Google alpha spec with a linter. Conductor's file has the same name but uses other headings and no token front matter | IMPLEMENTED | NEW, touches D5 | Medium |
| I4 | Cross-provider review: Claude writes the code, a model from another vendor reviews it without the author's context | IMPLEMENTED, unmeasured | NEW | Medium, product decision |
| I5 | AI-DLC traceability (A5) needed a long series of fixes | IMPLEMENTED (commit trail) | PARKED A5: evidence to keep it parked | Low (confirms a decision) |
| I6 | Everything else: ECC F2/F5/F8/F10/F13/F14, AI-DLC A4/A6/A7, AGENTS.md spec, the rest of Stitch | mixed | see sections | Noise or no change |

---

## A. ECC (`affaan-m/ECC`, renamed from everything-claude-code)

**Direction.** ECC is still a broad toolbox and distribution project. Since the audit at `bf70150` (2026-09-22) there are 1,123 commits and 300 changed files ([compare](https://github.com/affaan-m/ECC/compare/bf70150...main), HEAD `76aaa77`, 2026-10-15). The releases since then are v2.2.2 (2026-09-30, a curated offline `pi/core` profile of 123 skills, Windows and hooks fixes) and v2.2.3 (2026-10-01, naming and release reliability) ([releases](https://github.com/affaan-m/ECC/releases)). The commits also add more harness adapters (Qoder, Copilot, Qwen) and a cross-provider review. The new and significant part is that **ECC now measures its own gate seriously, and the result is negative**.

### I1. The GateGuard effectiveness study (MEASURED)

Source: [`docs/gateguard/question-effectiveness.md`](https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/docs/gateguard/question-effectiveness.md), built in commits `967daec`…`1d66665` (2026-10-02..11).

- Design: each trial is a real headless `claude --print` session on a small repository that hides one trap, scored by a hidden grader. The arms are off, gate, placebo and minus-target. The study was pre-registered, and its sample sizes and McNemar tests were fixed in advance.
- Pilot, 72 sessions: every arm passed 18/18. Nothing was measured, except the cost: +45% turns and +28% tokens (`5588e27`).
- Hidden-intent run, 48 trials: no difference. Asked the user 14/24 vs 15/24, passed 15/24 vs 16/24, p = 1.0 (`c9f270d`).
- Unflagged-prompt run: +29 points for the gate, p ≈ 0.065. ECC reported this as suggestive only (`a8fbe44`).
- Pre-registered confirmatory run, 96 trials: 25/48 vs 18/48, p = 0.210. **Not confirmed.** The effect halved on replication (`d545071`).
- An added "external contract" question did not move the gated arm. The apparent p = 0.021 came from a drop in the baseline (`1d66665`).
- Standing conclusion in the doc: "Across 336 billed trials the gate's benefit is not established … its cost is a consistent 35 to 45% in turns and spend." Two results hold across every run. (1) No trial passed without the deciding fact. (2) The gate's questions are about code structure, but every deciding fact in the corpus was an **external contract** (data format, timezone, retention rule).

**Against Conductor.** `templates/.agents/hooks/pretooluse-fact-gate.sh` is ECC's mechanism (F1, `docs/roadmap/Peer-Framework-Harvest.md` §4). Our eval (`test/evals/fact-gate-eval.mjs`, CHANGELOG ~line 338) measured a **process** metric, "named the affected files 4/4 vs 0/4", at n=4. It did not measure an outcome, and it did not measure cost. ECC's outcome study is the strongest external evidence that the mechanism changes process but not results, at a real cost.

Recommendation: keep the fact gate opt-in. Change our docs to say what was measured ("changes what the agent reads first, outcome not measured, cost not measured"). Do not promote it to default. If it is ever measured again, measure pass rate and turns, and aim its questions at external contracts. Do not copy ECC's harness: 336 billed trials is a cost the owner already declined for the nightly live lane.

### Parked and unbuilt items from the 2026-09-22 harvest

| Item | What changed in ECC | Verdict |
|---|---|---|
| F2 instincts | Only bug fixes: BOM, confidence validation, loader eligibility (`60ce177`, `8b755a6`, `57da51c`). No measurement. | Keep parked. |
| F5 rules-distill | `skills/rules-distill/SKILL.md` last changed 2026-08-12 (`d29cf65`). | Noise. Drop from the backlog. |
| F13 research-and-reuse | `skills/search-first` changed only for profile selection (`0765f7a`). GateGuard has a `no-duplicate-slug` scenario, but the study shows no per-question effect. | Keep parked. No new evidence for it. |
| F14 delete-zone | Nothing found. | No change. |
| F8 swarm admission | Proximity now observes **uncommitted worktree changes** (`72d738d`, 2026-10-06), which is the "observe the first beat" route in `Swarm-Collision-Admission.md`. The consumer, `docs/control-plane/TCAS-HOOK.md`, still opens with "design only. Nothing in this document is implemented" (last changed 2026-09-12). | Still blocked. ECC also has no consumer. |
| F10 PreCompact snapshot | `scripts/hooks/pre-compact.js` last changed 2026-07-29. It writes an LLM summary through `claude -p`. Nothing new. | No change. |

### Other ECC additions

- **I4. Cross-provider review** (`603164a`, 2026-10-10, [`docs/ASTRA-REVIEW-GUIDE.md`](https://github.com/affaan-m/ECC/blob/76aaa77df6adc5b889e689007bf99b9a4f74af34/docs/ASTRA-REVIEW-GUIDE.md)). Claude writes the code. Codex CLI runs an OpenAI model in a read-only sandbox, with web and MCP off and the output fixed by a JSON schema, and returns a verdict, never a patch. The reviewer never sees the author's conversation. At most 3 fix rounds, then the human. Each run asks for consent, because the diff leaves the machine. IMPLEMENTED, about 360 lines of tests, **no effect measured**. Against Conductor: the loop Checker always uses the Maker's adapter (`src/commands/loop.js:551`, `resolved.adapter.runChecker`). A `checker.platform` option would be NEW. This is a product decision (a second vendor account, cost, sending code to a second vendor) and is not proven to catch more defects. Medium value.
- **Rendered-evidence gate for UI** (`b79346d`, `skills/frontend-design-direction`). This is a JSON record in which each target viewport needs a rendered capture, checked by `check-evidence.js`, plus a table of content states (loading, empty, error, partial, success, permission). The content states are ALREADY-HAVE (`templates/.agents/skills/design-system/SKILL.md` lines 23–25). The rendered review is PREVIOUSLY-DECLINED as a default (`Persona-Team.md`, A4 off by owner decision). The viewport-coverage check is a cheap deterministic element if A4 is ever turned on.
- Prompt-time skill suggestions from an embedding index (`9ac68d3`, `810e5c0`). Noise for Conductor: we route with a table that a descriptions eval checks.
- GateGuard parser hardening (sed `e` and `s///e` treated as shell, SQL clients behind flag clusters). This matters only if our `pretooluse-no-bypass.sh` claims to parse sed or SQL. Low.

---

## B. AI-DLC (`awslabs/aidlc-workflows`)

**Direction.** The project ships very fast, mostly fixes. There are 25 commits after `0bb0075` (2026-10-15 10:20 → 2026-10-16 04:42), and preview tags arrive daily (`v2.11.1-preview.20261015.1`) ([commits](https://github.com/awslabs/aidlc-workflows/commits/main)). The direction is unchanged: an engine-driven, gate-per-stage process.

New evidence on the parked items:

- **A4 claim-source tags.** Nothing after the audit. `1024801` ("Requirements Analysis cites the intent statement…") is earlier on 2026-10-15 and is already covered. Keep parked.
- **A5 traceability.** `8b1c578` (a requirement marked N/A with its reason is no longer reported as unbuilt) joins the earlier `#2210` series (`cdd9206`, `3405f01`, `c10daa1`). This is IMPLEMENTED, and the commit trail shows ongoing maintenance cost for edge cases: sub-requirements, N/A rows, per-Unit NFR rows. This supports keeping A5 parked.
- **A6 lesson dedup.** `d89d18e`: two chats wrote the same learnings selections file, and one person's picks were lost without an error. AI-DLC fixed it with one file per piece of work. This is the parallel-session class that A6 targets. It is evidence that the class is real in their design. It is not evidence for Conductor, whose lessons are append-only with `merge=union`. Keep parked unless duplicates appear in a real `conductor/`.
- **A7 ownership hashes.** `e017592` (a refresh replaces an agent file that Kiro upgraded) is a harness-specific edge case. No new evidence.
- **Nightly live lane.** `2f3eeff` now runs a live "answers corpus" each night on Claude Code, with one question per night by rotation, misses reported and not failed. This is still a cost decision. Owner already declined.
- **"Tool-unavailable pass" bugs** (`ffd7542`, `dc2d646`): AI-DLC's type-check and lint sensors recorded a pass when their tool could not start. ALREADY-HAVE in Conductor. `hooks/pre-push` prints "push gate OFF … this push proves nothing" when no command is set (around line 261), and a command that cannot start exits non-zero and blocks the push. This confirms A1–A3 aimed at the right class.

---

## C. AGENTS.md standard and harness adoption

**Direction.** The format is frozen in practice. There are no required fields, plain Markdown, and the "closest AGENTS.md to the edited file wins" rule ([FAQ source](https://github.com/agentsmd/agents.md/blob/main/components/FAQSection.tsx)). The only governance change is a Technical Charter, added 2026-09-10 (`5d4013e`). Open proposals have no maintainer response: a global user-level `~/.config/agents/AGENTS.md` ([#91](https://github.com/agentsmd/agents.md/issues/91)), automatic inclusion of parent folders ([#39](https://github.com/agentsmd/agents.md/issues/39)), byte-size guidance for CJK text ([#249](https://github.com/agentsmd/agents.md/issues/249)), and adding Claude Code to the compatibility list ([#243](https://github.com/agentsmd/agents.md/pull/243), [#244](https://github.com/agentsmd/agents.md/issues/244)). Nothing to adopt.

**Claude Code** ([docs, memory#agents-md](https://code.claude.com/docs/en/memory#agents-md), read 2026-10-16). MEASURED by primary docs:

- AGENTS.md is read only when there is no `CLAUDE.md`, **`.claude/CLAUDE.md`** or `CLAUDE.local.md` in the working folder **or any folder above it**. `~/.claude/CLAUDE.md` does not count.
- Subdirectory AGENTS.md files load on demand when Claude reads a file there, unless that subdirectory has its own CLAUDE file. This matches `Agents-MD-Project-Card.md` §2.
- `/config` → **Project instructions**: `claude-md-or-agents-md` (default), `claude-md-and-agents-md`, `claude-md`, `managed-only`. The settings plugin ID is `cc-plugin-agents-md@builtin` from v2.1.285 (`agents-md@builtin` before).
- Never read: `AGENTS.local.md`, `AGENTS.override.md`, anything under `.agents/`.
- The `InstructionsLoaded` hook does **not** fire for an AGENTS.md read through the setting.
- AGENTS.md may not load in the first session after an upgrade from ≤ 2.1.276, and before 2.1.281 Bedrock sessions and sessions with telemetry off could not read it.

**I2, the gap.** `src/claude-instructions.js:53` probes only `CLAUDE.md` and `CLAUDE.local.md` in the working folder. It misses `.claude/CLAUDE.md` and a CLAUDE file in any parent folder (for example `~/Workspace/CLAUDE.md` above several projects). In those cases Conductor's AGENTS.md is silently not loaded, and `status` shows no warning. The fix is a few lines plus a test: walk up to `$HOME`, excluding `~/.claude/CLAUDE.md`, and add `.claude/CLAUDE.md`. NEW. High value per cost, because D9 exists to catch exactly this silent failure.

**Codex** ([docs](https://learn.chatgpt.com/docs/agent-configuration/agents-md)): global `~/.codex` file first. Then from the Git root down to the cwd, at most one file per directory (`AGENTS.override.md` > `AGENTS.md` > fallback names), concatenated root-first. The default `project_doc_max_bytes` is 32 KiB, and loading stops at the cap. A fresh `init --all` writes a 6,565-byte root AGENTS.md (measured here), well under the cap, and the context-bill ratchet keeps it there. ALREADY-HAVE. Note: a project card plus a large user section could approach 32 KiB on Codex. The ratchet covers the framework block only. Low risk.

**Antigravity/Gemini.** Native AGENTS.md support since v1.20.3 (2026-03-05). GEMINI.md takes precedence when both exist, and loading nested AGENTS.md files is a setting. CLAIMED: from a third-party blog only ([agentpedia](https://agentpedia.codes/blog/antigravity-agents-md-guide)). Google's docs were not verified. Conductor ships no GEMINI.md since 6.7.0, so precedence does not apply. D7 ("assumed") stays assumed.

**Cursor, Copilot.** Not re-verified this session. Both were on the agents.md compatibility list before the audit.

**Nested AGENTS.md (D4, out of scope).** No new reason to reopen it. All four harnesses now resolve nested files, each a little differently: Claude Code on demand, Codex only on the cwd chain, Antigravity behind a setting. So a per-directory file would behave differently per harness. This supports D4.

---

## D. Google Stitch skills and the DESIGN.md spec

**Direction.** [`google-labs-code/stitch-skills`](https://github.com/google-labs-code/stitch-skills) (Apache-2.0, ~8.5k stars) is a set of Agent Skills plugins for the Stitch MCP server: `stitch-design` (generate-design, extract-design-md, code-to-design, manage-design-system), `stitch-build` (react-components, react-native, shadcn-ui, remotion) and `stitch-utilities` (design-md, enhance-prompt, site-md, stitch-loop). The last commit is 2026-08-17 (`site-md`), so the repository is **quiet**. Google's investment moved to the format itself: [`google-labs-code/design.md`](https://github.com/google-labs-code/design.md) (~28k stars, created 2026-04-10, release 0.4.0 2026-07-27, version "alpha"). It has a spec ([`docs/spec.md`](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)) and a CLI, `npx @google/design.md lint|diff|export|spec`.

**The spec, in short.** It has optional YAML front matter with normative tokens (`colors`, `typography`, `spacing`, `rounded`, `components`, `{colors.primary}` references, DTCG-inspired) and `##` sections in a fixed order: Overview (alias "Brand & Style"), Colors, Typography, Layout (alias "Layout & Spacing"), Elevation & Depth, Shapes, Components, Do's and Don'ts. The `omitted:` key suppresses missing-section warnings. Unknown sections are preserved without error, and a duplicate section heading rejects the file. The linter has eleven rules: `broken-ref`, `contrast-ratio` (WCAG AA 4.5:1), `orphaned-tokens`, `missing-primary` and others. `export` writes Tailwind v3 JSON, Tailwind v4 CSS, CSS variables and DTCG `tokens.json`. IMPLEMENTED, with tests. Its effect on agent output is not measured.

**I3, against Conductor.** `templates/conductor/5-templates/design-md.md` has the same filename and a different dialect: "Colour Palette & Roles", "Layout & Spacing", "Component Styling", "Patterns", "Data Display", "Reference Screens", "Tokens", and no front matter. Its values "live once, in code" (D5, `Persona-Team.md`). This is the opposite of the spec, where front-matter tokens are normative. Facts:

- Conductor's extra sections (Patterns, Data Display, Reference Screens) are the ones the autopportunity rework showed were missing (A2/A3). The spec has nothing equivalent. Keep them. The spec preserves unknown sections, so they do not break a spec consumer.
- A user who opens our DESIGN.md in Stitch or runs `@google/design.md lint` gets no tokens and headings that are mostly not recognised. A project that uses Stitch would expect interoperability.
- Cheap alignment, a reversible engineering choice: rename our headings to the spec's names or aliases where the meaning is the same ("Colors", "Typography", "Layout & Spacing", "Components", Overview for "Visual Theme & Atmosphere"), and keep our extra sections after them. `src/design-md.js` (`conductor design migrate`) maps by heading and would need the new names. Not built, not verified.
- Adopting front-matter tokens reverses D5 ("values live once, in code"). That is the owner's decision, and the only gain is Stitch interoperability. My recommendation: do not adopt front-matter tokens now. Revisit only if a product uses Stitch.
- `extract-design-md` (per-framework references for React+Tailwind, Vue, Svelte, Angular, plain CSS) is ALREADY-HAVE in substance: the brownfield mode in `design-system/SKILL.md` line 32 says "extract, do not invent". Low value: the per-framework reference files add bulk for little gain.
- `site-md` (a SITE.md "constitution" with sitemap and backlog) duplicates `conductor/` (compass, PRD, backlog). Noise.

---

## Not verified

Nothing from these sources was executed. The I2 gap is from reading `src/claude-instructions.js` and the Claude Code docs, not from a live run. ECC's study results are as reported in their doc and commits, and were not reproduced. The Antigravity claims are third-party.
