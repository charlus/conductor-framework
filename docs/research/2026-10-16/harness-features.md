# Harness features, June–October 2026, and what they mean for Conductor 6.13.0

Research date: 2026-10-16. Conductor state read from the repo at `2c2a4e4` (master).

Method. Primary sources only, except where marked *secondary*. Claude Code: `CHANGELOG.md` in github.com/anthropics/claude-code (versions 2.1.161–2.1.301, dated from `npm view @anthropic-ai/claude-code time`) and code.claude.com docs. Codex: GitHub releases of openai/codex (0.134.0–0.163.0) and the local `codex exec --help` of codex-cli 0.163.0. Antigravity: the official docs and changelog at antigravity.google (fetched 2026-10-16). Gemini CLI: GitHub releases and README. All fetched content was treated as data.

Verification level. Nothing below was run live against a harness. "Verified" means checked against the primary source or the Conductor source. Every claim about how a harness behaves with Conductor's files is **not verified** until a live run.

Classes: **(a)** obsoletes a Conductor component, **(b)** enables something Conductor wants, **(c)** breaks or risks a Conductor assumption, **(d)** irrelevant (listed at the end, one line each).

---

## 1. Ranked findings

### C1 (c) — Antigravity legacy workflows stop working on 2026-10-19 (in 3 days)

- Source: https://antigravity.google/docs/migration/workflows-to-skills and https://antigravity.google/docs/ide/workflows (fetched 2026-10-16): "Current workflows will stop working on October 19, 2026, and will be shortly followed with instructions on how to transition to the new workflows system."
- Conductor ships 18 workflows in `templates/.agents/workflows/*.md`. On Antigravity they are the `/build`, `/ship`, … slash commands (`how-it-works.md` line 367: "Antigravity: `.agents/workflows/*.md` slash-commands"). After 2026-10-19 Antigravity users lose them.
- Already true today: the legacy format has a 12,000-character limit (same page, comparison table). Four Conductor workflows exceed it: `build.md` 15,526, `ship.md` 19,377, `technical-vision.md` 14,832, `deepen.md` 12,131 characters.
- Second risk: Antigravity's `/migrate-workflows` renames each `.agents/workflows/<name>.md` to `<name>.md.bak` and writes `.agents/skills/<name>/SKILL.md`. That breaks Conductor's single source of truth: the `.claude/commands` shims, `src/loop/harvester.js` (`.agents/workflows/build.md`) and `src/commands/loop.js` (`WORKFLOW_REL`, `CHECKER_WORKFLOW_REL`) read those paths. `conductor upgrade` would restore them, but the user would then have both.
- The loop is not affected: it hands the workflow to `agy -p` as a file path, not as a slash command.
- No name collision today between Conductor skills and workflows (checked), so "skills take precedence over workflows" does not bite.
- Option: generate one redirect skill per workflow, `.agents/skills/<workflow>/SKILL.md` → "read and follow `.agents/workflows/<name>.md`", the same pattern as `src/claude-commands.js` uses for `.claude/skills`. Side effect: Codex, Cursor and Copilot (which read `.agents/skills/`, see B4) would also get `/build`-style invocation, which they lack today. Cost: 18 more skill descriptions in every harness's always-loaded skill index (context bill). This changes what users see, so it is a product decision.

### C2 (c) — `claude -p` will default to `--bare` "in a future release"

- Source: https://code.claude.com/docs/en/headless (current for 2.1.301): "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." Bare mode skips "hooks, skills, custom commands, subagents, installed plugins, MCP servers, auto memory, and CLAUDE.md", sends no system reminders, and "never reads OAuth credentials or the system keychain" (needs `ANTHROPIC_API_KEY`). `--bare` semantics tightened in 2.1.286 (2026-09-29).
- Conductor's claude adapter (`src/loop/adapters/claude.js`, `buildArgv`: `-p <prompt> --permission-mode <m> [--settings] [--allowed-tools]`) depends on default discovery: the subscription login (live runs used it, `Loop-Deadbeat-Robustness.md`), the root `AGENTS.md` framework block, the `.claude/skills` shims, subagents for the review skills.
- AGENTS.md is read by a built-in plugin (`cc-plugin-agents-md@builtin`, memory docs). Bare mode skips installed plugins. Whether it also skips this built-in one is **not verified**; assume it does.
- When the default flips, every Conductor beat on Claude would run without the framework block and fail authentication on a subscription account. No date is announced.
- Mitigation (engineering, reversible): pin today's behaviour explicitly or stop depending on discovery: pass the framework block with `--append-system-prompt-file AGENTS.md`, and detect the flip from the `system/init` event. Bare mode keeps `--settings`, so the L3 sandbox profile still applies.

### C3 (c) — Antigravity loads `.agents/AGENTS.md` as an always-on rule: the framework block loads twice

- Source: https://antigravity.google/docs/rules (fetched 2026-10-16). Directory-scoped rules load from `<dir>/AGENTS.md` or `<dir>/GEMINI.md`, `<dir>/.agents/AGENTS.md` or `<dir>/.agents/GEMINI.md`, and `<dir>/.agents/rules/*.md`. "AGENTS.md and GEMINI.md do not use frontmatter. Antigravity treats its entire content as plain Markdown and keeps it continuously active (always_on)."
- Conductor ships `templates/.agents/AGENTS.md` (3,479 bytes) as the *source* of the generated root `AGENTS.md` framework block (`src/agents-md.js`). It carries `trigger: manual` frontmatter, which Antigravity ignores for AGENTS.md. So on Antigravity the classifier and laws load twice, and the frontmatter shows as text.
- This also confirms the 6.7.0 assumption D7 ("Antigravity is assumed to read `AGENTS.md`", `docs/roadmap/Agents-MD-Project-Card.md` §3). It is now documented.
- The rule files are fine: `.agents/rules/*.md` with `trigger: manual` load only on an @-mention, and Antigravity "silently discards" a rule file without valid frontmatter, so keeping the frontmatter there is right.
- Fix: rename the source file (for example `.agents/framework.md`). Touches `src/agents-md.js`, upgrade migration, tests, docs. Not verified live.

### C4 (c) — 28 of 32 Conductor skills break the Agent Skills naming rule that four harnesses now share

- Spec: https://agentskills.io/specification. `name` "May only contain unicode lowercase alphanumeric characters (`a-z`, `0-9`) and hyphens", "Must match the parent directory name". `PDF-Processing` is the spec's own invalid example.
- Conductor (checked in `templates/.agents/skills/*/SKILL.md`): 28 names are Title-Case (`Analyze-Tests`, `Code-Review`, `GitHub-CLI`, …) or do not match the folder (`architecture-patterns` → `architecture`, `git-worktrees` → `using-git-worktrees`). Only 4 conform.
- Why it matters now: `.agents/skills/` is read natively by Codex (https://learn.chatgpt.com/docs/build-skills: `$CWD/.agents/skills` up to `$REPO_ROOT/.agents/skills`), Antigravity (https://antigravity.google/docs/skills: "Antigravity defaults to .agents/skills"), Cursor (https://cursor.com/docs/context/skills) and GitHub Copilot (https://docs.github.com/en/copilot/concepts/agents/about-agent-skills). Antigravity turns each skill into a slash command by name. What each harness does with an invalid name (reject, warn, keep) is **not verified**.
- Fix: lowercase the `name:` fields and align the two mismatches. Low cost. The Claude shims are generated from the folder name, so they are not affected.

### C5 (c) — The agy adapter was verified against agy 1.1.6; agy is now 1.3.6, and headless semantics moved

Source for all lines: https://antigravity.google/docs/changelog (CLI section) and https://antigravity.google/docs/cli/headless, fetched 2026-10-16. Adapter: `src/loop/adapters/antigravity.js` (`--print <prompt> --mode accept-edits|plan [--dangerously-skip-permissions] [--add-dir cwd] [--sandbox]`).

- Flags still documented: `-p/--print`, `--mode accept-edits|plan` (docs/cli/modes), `--dangerously-skip-permissions`, `--sandbox` (docs/cli/headless flag table). `--add-dir` is **not** in the headless flag reference, only the `/add-dir` slash command. Not verified that the flag exists.
- v1.1.28 (2026-09-09): when `--print-timeout` expired, a headless run returned partial output and **exited 0**. The default timeout was 5 minutes. So on 1.1.28–1.2.5 a long beat could end silently half-done with a green exit. The Evidence Rule (verify exit code) still catches broken code, but not unfinished work that passes.
- v1.2.6 (2026-09-18): default headless timeout changed to unlimited. The headless docs page still says 5 minutes.
- v1.2.10 (2026-09-24): a headless run that ends on a model or agent error now exits 3 (was 0). Better signal for the driver's dead-beat detection.
- v1.3.2 (2026-10-08): `--dangerously-skip-permissions` "now only skips tool permission prompts, so plans wait for your review again". With the default `artifactReviewPolicy: "asks-for-review"` (docs/cli/reference), a headless beat that produces a plan or other reviewed artifact may end in status `WAITING`. Not verified.
- Sandbox (docs/sandbox): inside the agy terminal sandbox, "Sandboxed commands run without network access by default". An L3 beat on agy cannot install dependencies unless domains are allowed.
- Action: one live `conductor loop --platform antigravity` run on agy ≥ 1.3.6, then pin the minimum version in the adapter as the claude side does (`MIN_CLAUDE_VERSION`).

### C6 (c) — Claude Code subagent limits changed under Conductor's multi-agent skills

- 2.1.217 (2026-07-21): "subagents [no longer] spawn nested subagents by default; set `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`". Also a cap of 20 concurrent subagents. 2.1.212 (2026-07-16): subagents inherit the parent's permission mode, the Task tool's `mode` parameter is ignored. Source: Claude Code CHANGELOG.
- `judge-panel` spawns N=3 authors and 2–3 judges. If a workflow runs it, or `independent-review`, from inside a subagent, the nested spawn now fails or runs inline. Whether any Conductor workflow does this is **not verified**.
- 2.1.277 (2026-09-18): subagent results reach the parent under a "subagent output" header. Helps the untrusted-input stance, no action.

### C7 (c, low) — AGENTS.md edge cases on Claude Code

- Source: https://code.claude.com/docs/en/memory. AGENTS.md is skipped when any `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the working folder or above. It may be skipped "in your first session after you upgrade from v2.1.276 or earlier". It is skipped when the user disables `cc-plugin-agents-md@builtin` (renamed from `agents-md@builtin` in 2.1.285). `InstructionsLoaded` hooks do not fire for it.
- Conductor already warns on `CLAUDE.md` and `CLAUDE.local.md` (`src/claude-instructions.js`). Not covered: the disabled built-in plugin and the first-session case. Low impact.

### C8 (c, low) — Headless Claude runs project hooks without a trust dialog

- Source: https://code.claude.com/docs/en/headless: "Without `--bare`, a `-p` session runs the hooks in a project's `.claude/settings.json` … even in a folder you've never trusted."
- Relevant to `src/loop/untrusted.js` and `conductor trust-verify`: a loop run on a cloned repository executes that repository's Claude hooks. Codex does the opposite: project hooks need persisted trust, and `codex exec` skips them unless `--dangerously-bypass-hook-trust` (codex-cli 0.163.0 `--help`; https://learn.chatgpt.com/docs/hooks).

---

### B1 (b, and partly a) — Structured final output on all three CLIs: the Checker can stop writing a verdict file

Cross-harness convergence: 3 of 3.

- Claude Code: `--output-format json --json-schema <schema>` puts the result in `structured_output` (https://code.claude.com/docs/en/headless; fixes in 2.1.187, 2.1.205, 2.1.290).
- Codex: `codex exec --output-schema <file>` and `-o/--output-last-message <file>` (codex-cli 0.163.0 `--help`).
- Antigravity: `agy -p --output-format json --json-schema <schema>` returns `structured_output`; the schema root must be an object since v1.2.x (https://antigravity.google/docs/cli/headless; CLI changelog).
- What it changes: today the Checker must write `checker-verdict.json`, so it runs write-capable (`acceptEdits`, commit `364139d`) and needs a retry on a missing file (`713f18e`), see `docs/roadmap/Loop-Robustness-Plan.md`. With a schema-validated verdict on stdout, the Checker can run read-only (`plan` / `-s read-only` / agy `plan`), so a Checker can no longer edit the code it judges, and the verdict-file write and retry in `src/loop/checker.js` can go. Fail-safe-on-missing-verdict stays: no valid `structured_output` = reject.
- This is the strongest "delete code and gain safety" item found.

### B2 (b) — Per-beat cost and token data on all three CLIs: the deferred token budget becomes buildable

Cross-harness convergence: 3 of 3.

- Claude Code: `--output-format json` carries `total_cost_usd` and usage; `--max-budget-usd` stops the run and its background subagents (fix 2.1.217) (https://code.claude.com/docs/en/headless).
- Codex: `codex exec --json` JSONL events; "Configurable rollout token budgets track usage across agent threads … and abort turns when exhausted" (0.142.0, 2026-06-22).
- Antigravity: `--output-format stream-json` reports token usage (https://antigravity.google/docs/cli/headless).
- Enables "D — token budget (DEFERRED)" in `docs/roadmap/Loop-Deadbeat-Robustness.md` and replaces the hard-coded `tokens: 0` in `adapters/claude.js`.
- Related: Claude's unattended retry mode `CLAUDE_CODE_RETRY_WATCHDOG` with `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS` (2.1.301, 2026-10-15) ends a request at a far-away usage limit. It overlaps the dead-beat Fix A; it does not replace it (Claude only).

### B3 (b) — Pre-tool hooks now exist on Codex and Antigravity: the no-bypass guard can prevent, not only detect

Cross-harness convergence: Claude Code, Codex, Antigravity, plus Copilot (`.github/hooks/*.json`, https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks) and Cursor (`hooks.json`, https://cursor.com/docs/context/skills).

- Codex (https://learn.chatgpt.com/docs/hooks): `<repo>/.codex/hooks.json`; `PreToolUse` covers `Bash`, `exec_command`, `apply_patch` (matchable as `Edit`/`Write`), MCP tools; deny with `hookSpecificOutput.permissionDecision: "deny"` or exit 2 with the reason on stderr. This is the Claude Code shape. Project hooks run only after the user trusts them (`/hooks`). Async and MCP-tool hooks 0.148.0 (2026-08-18), `Interrupt` hook 0.150.0 (2026-08-26).
- Antigravity (https://antigravity.google/docs/hooks): `.agents/hooks.json`; `PreToolUse` with a regex matcher on tool names such as `run_command`; output `{"decision": "deny", "reason": …}`. Different tool names and output field from Claude. No path conflict with Conductor's `.agents/hooks/` directory.
- `templates/.agents/hooks/README.md` ("Reach") says "`PreToolUse` is a Claude Code mechanism … On Codex and Antigravity the protection is after the fact". That is now out of date.
- `pretooluse-no-bypass.sh` could run on Codex almost unchanged, and on Antigravity behind a small translation of input and output. Fits Operating Truth 3 (enforce with code). Each harness needs its own live proof.

### B4 (b) — `.agents/skills/` is now the shared skill location; Claude Code is the only exception

- Readers of `.agents/skills/`: Codex, Antigravity, Cursor, Copilot (sources in C4). Claude Code reads `.claude/skills/` and nested and plugin paths, not `.agents/` (https://code.claude.com/docs/en/skills; https://code.claude.com/docs/en/memory: "Not read: … anything under a `.agents/` directory").
- Confirms Conductor's layout. `src/claude-commands.js` (the `.claude/skills` shims) stays necessary.
- Small side risk: Copilot also reads `.claude/skills`, and Cursor reads `.claude/skills` "for compatibility". There a user sees each Conductor skill twice (shim and real). Only relevant if Conductor ever targets those two.
- Gemini CLI is no longer a target: "Gemini CLI was replaced by Antigravity CLI on June 18th, 2026" for unpaid and Google One users (github.com/google-gemini/gemini-cli README; the releases since July are fixes only). Antigravity reads `GEMINI.md` and `AGENTS.md` the same way (https://antigravity.google/docs/cli/gcli-migration). Nothing to do: 6.7.0 already removed `GEMINI.md`.

### B5 (b) — Native schedules and event triggers for the ignition contract

Cross-harness convergence: 3 of 3.

- Claude Code: `/schedule` routines with GitHub triggers (routine fixes through 2.1.299), `claude self-hosted-runner` (added 2.1.224, 2026-08-07) so routines run on your own machine, background sessions and `/loop` survive restarts (2.1.290, 2.1.292).
- Antigravity: `/schedule` (https://antigravity.google/docs/commands/schedule) and Automations (App v2.21.1, 2026-10-07).
- Codex: "scheduled UTC time reminders" (0.142.0, 2026-06-22).
- Supports the plan in `docs/roadmap/Loop-Engineering-Alignment.md` §4 (ride the platform's scheduler; `conductor loop --goal/--event`). A self-hosted runner is where bubblewrap and the Conductor checkout live, so a routine could start a real L3 loop. Whether a routine session can launch `conductor loop` and its nested `claude -p` is **not verified**.

### B6 (b) — Hardening for the L3 sandbox gate and unattended permissions

- Claude Code: `--permission-prompts none` for unattended hosts (2.1.259, 2026-09-02); `dontAsk` mode; `sandbox.network.strictAllowlist` (2.1.219); `sandbox.credentials` blocks credential files and secret variables (2.1.187); credential masking (2.1.221, 2.1.224); `allowUnsandboxedCommands: false` set through `--settings` now also overrides project `excludedCommands` (2.1.282). Conductor's `templates/.agents/sandbox/claude-sandbox.settings.json` sets none of these. Adding `allowUnsandboxedCommands: false`, `strictAllowlist` and `credentials` would tighten L3 at no code cost.
- Antigravity: `--mode auto` (CLI v1.3.5, 2026-10-14) "approves file edits and safe commands … still prompts before irreversible actions; commands that would leave the terminal sandbox are first reviewed by a separate agent". A possible replacement for `--dangerously-skip-permissions` in `antigravity.js`. In headless, a prompt is a soft deny, which is fail-safe.
- Codex: `--approve-for-me` routes approvals through automatic review in the workspace-write sandbox (0.147.0, 2026-08-07); `--ignore-user-config` and `--ephemeral` isolate a beat from the user's config (0.163.0 `--help`).
- Convergence: classifier-reviewed auto-approval now exists in all three (Claude auto mode, Codex Guardian/`--approve-for-me`, agy Auto). For Conductor it is an option per adapter, never a replacement for the PR gate.

### B7 (b, small) — Measurement helpers on Claude Code

- `/skill-doctor` shows unused skills and their context cost (2.1.261, 2026-09-06). `/doctor prompt-audit` audits AGENTS.md, skills, agents for older-model patterns (2.1.283, 2026-09-25). `claude plugin eval` runs a plugin's eval suite with scored JSON/HTML reports (2.1.269, 2026-09-11).
- They complement `src/context-bill.js` (a byte ratchet in CI) and `test/evals/`. They do not replace them: Claude only, and runtime rather than CI.

---

### Features that converge across harnesses but do NOT obsolete Conductor code

- **`/goal` in all three.** Claude Code 2.1.139 (2026-05-11, fixes to 2.1.274), Codex (`/goal` handling in 0.140.0; no-activity limit in 0.163.0), Antigravity (https://antigravity.google/docs/commands/goal: "there's no iteration cap"). Each is an in-session stop-condition loop with self-audit. `src/loop/driver.js` keeps what none of them has: a fresh-process adversarial Checker, the Evidence Rule on the verify exit code, iteration and wall-clock ceilings, worktree isolation, the PR gate. Do not delegate the outer loop to `/goal`.
- **Native worktrees.** Claude `--worktree` plus the `WorktreeCreate` hook ("Replaces default git behavior"); Codex `codex exec --worktree` (0.154.0; on by default 0.156.0); Antigravity isolates subagent worktrees (CLI v1.2.10, v1.3.3). agy headless has no worktree flag, and Conductor needs its own branch naming and the dirty-guard. `src/loop/worktree.js` stays.
- **Plugins and marketplaces in all three.** Claude plugins (`--marketplace` 2.1.292, archive sources 2.1.224, GitLab marketplaces 2.1.232); Codex "Agent Plugins manifests … additional plugin marketplaces for … Claude Code" (0.146.0), "portable Agent Plugins" (0.147.0), remote marketplaces in the CLI (0.153.0); Antigravity `/plugin` marketplace (CLI v1.3.2) and `agy plugin import gemini`. Three manifest formats. An "Agent Plugins 1.0" cross-vendor format is described only by a *secondary* source (blakecrosley.com, 2026-08-06; lists Codex, Cursor, Copilot, not Claude Code). `src/registry.js` and `conductor add|remove|list|search` (`docs/roadmap/Dynamic-Skill-Loading.md`) install into `.agents/skills/`, which four harnesses read natively (B4). Keep it for now.
- **Agent teams.** Claude agent teams (`TeammateIdle`), Antigravity `/teamwork-preview`, Codex multi-agent V2 (stabilised 0.145.0, message boards 0.161.0). In-session only. `src/loop/swarm.js` coordinates separate processes through PRs and a merge queue. No overlap that removes code.

### (a) Obsoleted components: what is left

- Already done in 6.7.0: the `CLAUDE.md` and `GEMINI.md` stubs, obsoleted by Claude Code 2.1.277 (2026-09-18, "in a project with no CLAUDE.md, Claude Code reads AGENTS.md instead"; Bedrock, Vertex, gateways and telemetry-off since 2.1.281) and by Antigravity's documented AGENTS.md loading (C3). Gemini CLI's shutdown (B4) removes the last reason for `GEMINI.md`.
- Candidates now: the Checker's verdict-file write and retry (B1), and `tokens: 0` in the claude adapter (B2). Nothing else found can be deleted without losing host-neutrality.

---

## 2. Irrelevant to Conductor (d), one line each

Claude Mods and mod hooks (2.1.287+), Artifacts, output styles and the built-in "Concise" style (2.1.237, `/output-style` 2.1.269), Claude apps gateway and managed settings, Claude in Chrome, `/advisor`, Ultracode and dynamic-workflow sizing, `/code-review` and `/ultrareview`, `PreModelSwitch`/`PostModelSwitch` hooks, `onFailure: "block"` (2.1.295: Conductor's PreToolUse hooks fail open by design, and it has no effect on `Stop`), `updatedInput` validation (2.1.300, unused by Conductor), `UserPromptSubmit` before skill expansion (2.1.299, unused), Codex TUI, voice, vim, Daybreak and Cyber programs, Codex app-server and exec-server, Antigravity IDE extensions, Remote Control on all three, Antigravity `.gemini/config.json` move (App v2.17.0; Conductor ships no `.agents/settings.json`).

## 3. What to verify live first

1. `agy -p` beat on agy ≥ 1.3.6: `--add-dir` accepted, no `WAITING` on artifact review, exit codes (C5).
2. Antigravity session at the root of a Conductor install: is `.agents/AGENTS.md` loaded twice (C3), and how are Title-Case skill names shown (C4)?
3. `claude -p --bare` on a Conductor install: what loads, and does a subscription login fail (C2)?
4. A Checker run read-only with `--json-schema` on each CLI (B1).
