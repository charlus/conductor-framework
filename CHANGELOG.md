# Changelog

All notable changes to the Conductor Framework will be documented in this file.

---

## [Unreleased]

---

## [6.25.0] — 2026-10-20 — The loop builds carved slices, from spec to MR

Compatibility: upgrade only

Build step 3 of [`docs/roadmap/Unattended-Lifecycle.md`](docs/roadmap/Unattended-Lifecycle.md).

### Added

- **The slice pipeline.** With `loop.slices: ["<Project>"]` (or `true`), `--from-conductor` takes the lowest open slice of each opted-in project (`project-backlog/<Project>/implementations/NN-<slice>/`) and runs it the way you would: a fresh Spec beat running `spec-it.md`, the spec checked in code (both files written, the Brief check answered), a fresh Checker reviewing the spec against the slice's acceptance criteria and the Blueprint before any code (D2), Build beats from the plan with the task tracker as memory until the Maker says the slice is ship-ready, then the Ship beat, which archives the slice in the branch. One MR per slice carries the spec, the code and the bookkeeping (D3). A slice whose spec is already on the default branch is yours and starts at Build. One slice per project at a time, the lowest number. The Spec beat's unattended rules are a new section of `unattended-loop.md`; `spec-it.md` and `build.md` are unchanged. `conductor loop doctor` counts the slices in its queue check. Verified live on a scratch product: one Spec beat, one Build beat, one Ship beat, three reviews, ≈ $1.16 at list price; the MR carried a spec with its Brief check, the code, 16 passing tests, the tracker, the ship-log entry, the product area and the archived slice.

---

## [6.24.0] — 2026-10-20 — Claims from git, cleanup on pull

Compatibility: upgrade only

Build step 2 of [`docs/roadmap/Unattended-Lifecycle.md`](docs/roadmap/Unattended-Lifecycle.md).

### Changed

- **A loop claim is the item's branch, not a commit on your checkout.** The loop used to mark an item `🤖 … (in progress)` with a commit on whatever branch your checkout was on. Now an item whose `conductor/loop/<item>` branch exists on the remote is in progress or in review, and the next run skips it. An item whose branch is already merged but which is still open is skipped and named, so you can tick it.

### Added

- **`post-merge` hook: cleanup when you pull.** After you merge a loop MR on the forge, your next `git pull` removes its worktree and local branch. A loop run does the same when it starts. Only a branch provably merged into the default branch, and never a worktree with uncommitted changes. `conductor install-hooks` wires it with the others; it never blocks. `conductor status` names the merged loop worktrees still on disk, and deletes nothing. Verified live: an in-review item was skipped; after the merge on the forge, `git pull` removed the worktree and branch, and the queue was empty.

---

## [6.23.0] — 2026-10-20 — The loop ships the way you do

Compatibility: upgrade only

Build step 1 of [`docs/roadmap/Unattended-Lifecycle.md`](docs/roadmap/Unattended-Lifecycle.md).

### Changed

- **A loop task is shipped before its MR, with Ship itself.** The loop used to run Build and then open the MR with a one-line log and a stub body, skipping Ship. Now a task bound for an MR gets a Ship beat that runs `ship.md` Phases 1–5 in its worktree, a fresh context as when you type `/ship`. Its bookkeeping goes in the task's branch: the ship-log entry with its **For you** block, the product area, the archive and the backlog tick, so merging the MR is what records the ship. The driver then re-runs verify and the Checker (Ship's review: Ship may change code), checks Ship's evidence in code, and opens the MR with the five-section body the Ship beat wrote. Missing bookkeeping is a rejection with its reason, and a second Ship beat fixes it. No MR opens without it. The loop no longer writes a "shipped" line or a done marker on your checkout. The rules for the Ship beat are a new section of `unattended-loop.md`; `ship.md` is unchanged. Verified live: one Ship beat, an MR carrying code, tests, the ship-log entry and the tick, and Ship's body.

### Fixed

- **A prompt that starts with a dash reaches the agent.** The claude and codex adapters passed the prompt as an argument, so a prompt opening with `---` (Ship's frontmatter) was read as an option. Every flag now comes first, then `--`, then the prompt. Verified live for claude; for codex the arguments parse (not run in a trusted repository).

---

## [6.22.0] — 2026-10-19 — Fixes from the second unattended run

Compatibility: upgrade only

From the second unattended run on a real product (evalapp-v2, 2026-10-19): [`docs/roadmap/Unattended-Crossing.md`](docs/roadmap/Unattended-Crossing.md).

### Fixed

- **The loop's MR title fits the forge.** It was the backlog item's whole first line, over GitLab's 255-character limit, and the MR step failed. The title is now the item's first sentence, without markdown or the `(loop-ready)` tag, at most 120 characters.
- **The loop asks again when the forge has not yet seen the pushed branch.** GitLab answered "source branch does not exist" a moment after the push. The MR step now waits 5 seconds and retries once, for that error only.
- **The loop's worktrees stay out of `git status`.** `.agents/.worktrees/` was not ignored in every project, so a `git add -A` would have swept the loop's worktrees into a commit. The loop and the doctor now add it to git's local exclude file, which commits nothing and covers existing installs. Verified live on evalapp-v2.
- **The loop's audit lines no longer block your next commit.** The report-shape gate treated the `[loop]` lines that `conductor loop` appends to the ship-log as a report without a **For you** block. It now skips them, as it already skipped waiver lines; a real report riding along with them is still gated.

### Added

- **The doctor points at your CI file** when verify is red in a fresh worktree: the project's own test recipe usually lives there. On evalapp-v2 the one fact the doctor could not find, how the test database is built, was in `.gitlab-ci.yml`.

---

## [6.21.0] — 2026-10-19 — Loop beats cannot read your cloud logins

Compatibility: upgrade only

### Fixed

- **The sandbox withholds cloud and container logins too.** 6.14.0 withheld the forge logins, but a beat could still read `~/.config/gcloud`, `~/.aws`, `~/.azure`, `~/.kube` and `~/.docker/config.json`. Only the network allowlist kept it from using them. They are now denied to the shell and to the Read tool, and `GOOGLE_APPLICATION_CREDENTIALS`, `CLOUDSDK_AUTH_ACCESS_TOKEN`, the `AWS_*` keys, `AZURE_CLIENT_SECRET` and `KUBECONFIG` are unset. Found while assessing a loop run on a production project. Verified live: a sandboxed beat saw 14 entries in `~/.config/gcloud` with the 6.20.0 profile and 0 with this one.

---

## [6.20.0] — 2026-10-19 — The upgrade says which waiver it logged; the doctor checks your own checkout

Compatibility: upgrade only

### Fixed

- **`conductor upgrade` no longer says "No waiver needed" and then commits a waiver.** The upgrade does need the protected-path waiver; it sets and logs it itself. The message now names the waiver's commit and says you type nothing (finding F7 of the first unattended crossing).

### Added

- **`conductor loop doctor` checks your main checkout too.** When verify is green in a fresh worktree, the doctor runs it where you work. Red there means your local environment is older than the code, as on eurassistant, where the `.venv` still held the old SDK after the loop's MR changed the lock file and the next push failed at import. It is a warning: loop runs push from their own worktree.

---

## [6.19.0] — 2026-10-19 — A loop Maker logs the decisions it makes alone

Compatibility: upgrade only

Superlite import A12, built after the first real crossing as decided (D1, D4): [`docs/roadmap/Superlite-Imports.md`](docs/roadmap/Superlite-Imports.md).

### Added

- **The ruling log.** An unattended Maker decides product questions alone, and before this only its diff showed what it chose. It now appends one line per decision the spec did not settle to `conductor/1-workbench/rulings.md`: the decision, why, and what breaks if it is wrong, rated low, medium or high. The PR body lists every ruling on its branch, a `high` ruling goes to the inbox and the run continues, and the Checker reviews the rulings against the spec. The file merges with `merge=union`. An unknown risk level counts as `high`. Nothing can force an agent to log a decision: the format is parsed, and completeness can only be measured. Verified live: asked for a user-facing message with no language or tone given, the Maker logged its choice as `high`, the inbox received it once over three runs, the Checker's prompt carried it, and the PR body listed it on a reused worktree.

---

## [6.18.0] — 2026-10-19 — `conductor loop doctor`

Compatibility: upgrade only

From the first unattended run on a real product (findings F1 and F6).

### Added

- **`conductor loop doctor [dir] [--beat]` checks a project before an unattended run.** The first real run needed six project facts that nothing checked, found one by one over two runs. The doctor checks the pre-flight, the framework version and sandbox profile, bubblewrap and socat, whether Claude Code reads `AGENTS.md`, the forge login, nested repositories, the `--from-conductor` queue and a gitignored `.env` the worktree will not have. It then runs `loop.setup` and the verify command in a real worktree and removes it. `--beat` adds one sandboxed agent beat that runs the verify command, the only check that sees what the sandbox blocks. Each problem comes with its fix; exit 1 when one must be fixed. Verified live on eurassistant: 36 seconds, or 54 with `--beat`. It caught the outdated 6.14.0 sandbox profile and a backlog item that a run would have repeated. On a scratch project with the old profile, `--beat` reported "This command requires approval" for a verify command that was green outside the sandbox.

---

## [6.17.0] — 2026-10-19 — Headless beats can run what a developer runs, and no more

Compatibility: upgrade only

From the first unattended run on a real product (finding F2): [`docs/roadmap/Superlite-Imports.md`](docs/roadmap/Superlite-Imports.md) and the crossing record.

### Fixed

- **A loop beat can run a command that starts with a variable assignment.** Claude Code sends `FOO=bar cmd`, even sandboxed, through its permission prompt, which a headless beat cannot answer, and the first real run stalled on it. The cli-native profile now allows `Bash`. `allowUnsandboxedCommands: false` keeps that allow from ever approving a command outside the sandbox, and deny rules keep `git push`, `gh pr` and `glab mr` with the driver. Verified live: a variable-prefixed command and a compound commit ran, a write to the home folder failed and its unsandboxed retry was ignored, and `git push` was denied.
- **An untrusted run really has no shell.** Its tool allowlist was passed only as `--allowed-tools`, which pre-approves and restricts nothing, and the sandbox auto-allows Bash, so an untrusted beat could run sandboxed shell commands. Verified live on the 6.14.0 profile. The list is now also passed as `--tools`, so the other tools do not exist for the beat. Verified live: the beat could write a file and had no Bash.

### Note — upgrading

- A beat now runs every sandboxed command without asking. The sandbox (network allowlist, writes only in the worktree, forge credentials withheld since 6.14.0) is the boundary, as it was meant to be.

---

## [6.16.0] — 2026-10-19 — Every loop run says what it cost

Compatibility: upgrade only

Superlite import A14: [`docs/roadmap/Superlite-Imports.md`](docs/roadmap/Superlite-Imports.md).

### Added

- **Cost and tokens per beat.** The claude adapter runs `claude -p --output-format json` and reads each beat's tokens, cost and model. The run ends with a `cost:` line split by Maker and Checker, `conductor status` shows it, and each beat log has a `usage:` line. On a subscription login the cost is a list-price estimate. Codex and agy report unknown, not zero. Verified live: a haiku Maker and a sonnet Checker cost $0.01 and $0.13 on a one-beat task.
- **`loop.cost_aware`**, off by default. On, `budget.max_cost_usd` warns once at 70% and stops the run between beats at 100%. Off, cost is shown and acts on nothing.

### Fixed

- **A spent quota stops the swarm.** The swarm counted a beat that hit the usage limit as a rejected attempt and failed the task after its retries. It now refunds the beat, ends the run as `usage_limit_reached` with the reset time in the inbox, and resumes the task on the next run, as pair mode already did.
- **A new run starts with no carried-over rejections.** The attempts and the rejection count from 6.15.0 now reset with the beat counter.

---

## [6.15.0] — 2026-10-19 — A blocked loop beat escalates, a rejected one learns why

Compatibility: upgrade only

From the first unattended run on a real product (eurassistant, 2026-10-19), findings F3–F5 and a new F8, and the superlite import A13: [`docs/roadmap/Superlite-Imports.md`](docs/roadmap/Superlite-Imports.md).

### Added

- **A Maker that is blocked escalates.** It writes `{ "escalate": true, "reason": "…" }` to `maker-signal.json`, and the run ends as `escalated` with the reason in the inbox, in pair and swarm mode. No verify and no Checker run for that beat. The first real run spent nine beats, each with an opus Checker, on a block the Maker had named in beat 1. Verified live: a Maker without network access escalated in beat 1, in 22 seconds (pair) and 16 seconds (swarm).
- **A rejected beat tells the next one why.** The driver keeps the last three rejections (verify exit, the tail of its output, the Checker's reasons and findings, the files changed) and puts them in the next beat's prompt, inside the untrusted-content envelope. Verified live: a verify rule that is revealed only by its failure message was met in beat 2.
- **`loop.models.maker_escalation`** runs a Maker beat that follows two rejections on a stronger model. Unset, nothing changes.

### Fixed

- **The swarm's stall guard could never fire on most test runners.** It hashed the raw verify output, so a duration such as pytest's "in 9.54s" changed the hash on every beat. It now uses the same normalisation as pair mode.
- **The loop opens a GitLab MR without pushing a second time.** `glab mr create --fill` pushes the branch, which re-ran the whole pre-push gate (2.5 minutes with live evals) and failed the MR step. The title and description are now passed explicitly, for `gh` and `glab`.
- **A failed push or forge command keeps its error.** The inbox and the ship-log said only "glab failed to open the PR/MR". They now carry the last 300 characters of the command's own error.

---

## [6.14.0] — 2026-10-16 — The loop beat cannot push, a model per role, interviews in rounds

Compatibility: upgrade only

From the 2026-10-16 harvest of peer frameworks, harness changelogs and research: [`docs/roadmap/Harvest-2026-10.md`](docs/roadmap/Harvest-2026-10.md).

### Fixed

- **A loop beat cannot push or open a PR itself.** The `cli-native` sandbox allowed `github.com`, while sandboxed commands could read `~/.ssh` and `~/.config/gh` and inherited `GH_TOKEN`, `SSH_AUTH_SOCK` and the keyring bus. Claude Code's sandbox protects no credential unless told to. The profile now denies those files and variables to the shell and the same files to the Read tool, so only the driver, outside the sandbox, can push or open the PR. Verified live on Claude Code 2.1.301: a beat saw 10 entries in `~/.ssh` before and 0 after.
- **`status`, `init`, `upgrade` and `loop` warn about every CLAUDE file that hides AGENTS.md.** Claude Code skips AGENTS.md when a `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` sits in the working folder or any folder above it. The check looked only at the working folder and missed `.claude/CLAUDE.md`. Your own `~/.claude/CLAUDE.md` does not count and is not reported.
- **Every core skill is named after its folder.** Codex, Antigravity, Cursor and Copilot read `.agents/skills/` against the Agent Skills specification, which wants a lowercase name equal to the folder. 28 of 32 skills used another name. Claude Code is unaffected: its shims already used the folder name.

### Added

- **`loop.models` picks a model per loop role.** `{ "maker": "sonnet", "checker": "opus" }` in the `loop` block of `conductor.config.json` passes `--model` to each role's beats on the claude engine. Unset, the CLI's default model runs, as before. The dry-run plan and the run log name the models. Verified live: a Maker set to `haiku` reported `claude-haiku-5-5`.

### Changed

- **Interviews come in short numbered rounds.** `grilling` asked one question at a time. Each round now asks every question whose prerequisites are settled, at most five, numbered so you can answer by number, and worded so that "yes" accepts the recommendation. A question that depends on an open one waits for the next round. Pocock reversed the rule we had copied from him. Not measured: no eval covers interviews.

### Note — upgrading

- A loop beat that fetched a private dependency over SSH inside the sandbox now fails. Move that fetch to `loop.setup`, which runs outside the sandbox.

---

## [6.13.0] — 2026-10-15 — Gates that show when they did not run

Compatibility: upgrade plus a step

From the analysis of AWS Labs' AI-DLC (2026-10-15): [`docs/roadmap/AIDLC-Harvest.md`](docs/roadmap/AIDLC-Harvest.md).

### Added

- **`conductor status` names the commits and pushes that skipped the hooks.** "Gates on" said git was configured, not that the hooks ran. A new **Skipped** line lists the local commits (by hash) and counts the pushes of the last 14 days that ran no hook: `--no-verify`, `CONDUCTOR_HOOKS=off`, or a git client that ignores hooks. Each hook appends a heartbeat line to `.git/conductor-heartbeat`, and status compares it with the reflog. Commits from before `conductor install-hooks` are not judged, and when it cannot tell, status says nothing.
- **A verify run that changes files fails the push.** A command that rewrites snapshots, fixes lint or updates a lockfile passed against code that was not the code being pushed. `pre-push` now runs it as `conductor evidence run --stable-tree`, which fails a green run that changed tracked or new files and names them. Ignored files do not count. Such a run is never FRESH evidence either.
- Each release entry in this changelog now starts with a `Compatibility:` line: `upgrade only`, `upgrade plus a step` or `breaking for scripts`.

### Note — upgrading

- If your verify command writes files that git tracks (for example `jest` without `--ci`, or a lint command with `--fix`), the push now fails and names the files. Make the command check only, or commit what it writes.
- The first **Skipped** report covers only commits made after this upgrade.

---

## [6.12.0] — 2026-10-13 — Personas from the real diff, one review vocabulary, parallel sessions

From the 6.8 usage audit of four projects (2026-10-13).

### Fixed

- **Personas missed real UI changes.** `conductor personas` with no paths read only the outer repository's diff, so in the outer layout it found nothing. It now reads each nested code repository's diff too. Build re-runs it on each batch's real diff and loads any persona the plan's file names missed, with the *Design system first* step for a new Designer. Server-side templates (Jinja, Handlebars, ERB, Nunjucks, …) trigger the Designer.
- **The review log could not answer its own question.** Categories were free text (30 rows said `undefined`; one idea had five names), so the ">50% dismissed" rubric alarm never fired, and `persona` was empty in 99% of rows. Categories are now a closed set of 13, and common names map onto it (the original kept as `detail`). Unknown fields are refused instead of silently dropped. The ledger and its file paths resolve from the project root, whichever folder the command runs in. The reviewer brief names a `class` and a `lens` for every finding, recorded as `category` and `persona`. `summary` groups old rows under their class.
- **Lessons stayed in one agent's memory.** The always-on block now says where a lesson goes: a convention to `4-context/technical/coding-patterns.md`, a decision and its reason to `4-context/meta/decision-log.md`. The block is no larger.
- **Subagents ran unbounded.** A reviewer ran the full suite for 21 minutes; a ship-prep agent waited on its own background job for over an hour. The reviewer now takes the author's verification evidence and runs only targeted commands under `timeout`. Every subagent brief carries a time budget, foreground commands only.
- **Parallel sessions collided.** `init` and `upgrade` set `merge=union` in `.gitattributes` for the ship-log, inbox and review-log, so parallel entries merge without conflict. Ship and `git-workflow` create branches in a worktree, never by switching a shared checkout.
- **Merging main into a branch older than the last upgrade failed closed** and taught agents to bypass the protected-path gate. During a merge, the hooks use the merged branch's committed library, and a protected file staged exactly as that branch committed it is not this change's edit. A protected file edited during the merge is still blocked.
- Ship archives a carved slice from `2-backlog/project-backlog/<Project>/implementations/`, not only from `1-workbench/`.
- "I know exactly what to build" routes to Quick-Path; Spec-It on an uncarved feature hands over to Quick-Path instead of stalling.
- `"eval": "none"` declares evals that are run by hand: the push no longer prints the "not enforced" notice.

### Note — upgrading

- `conductor review-log append` now refuses a missing or unknown `category` and unknown fields. The error lists the allowed values.
- `conductor upgrade` adds three `merge=union` lines to `.gitattributes`.

---

## [6.11.0] — 2026-10-13 — Quick-Path keeps the gates, hooks judge code only, upgrade commits on its own branch

### Fixed

- **Quick-Path dropped what 6.8 added.** Two real features went through it with no persona, an improvised reviewer prompt, nothing in review-log and no ship-log entry, because Quick-Path only said "follow Build" and the agent read the first 80 lines of `build.md`. Quick-Path now states those steps itself: `conductor personas` before each RED, `reviewer.md` verbatim for the independent review, every finding through `conductor review-log append`. It ends in Ship, and never opens a PR itself. Its spec template has the `## Brief check` heading the pre-commit hook requires, and the plan is no longer a stop.
- **Gates fired on project state.** A backlog-only push ran 29 live LLM evals and failed on a flaky one. Scripts archived under `conductor/` needed TDD waivers. Files under `conductor/` are no longer implementation code, and a push that changes only `conductor/` runs neither the verify command nor the evals.
- **Every waiver needed a chore commit.** The waiver line stayed uncommitted in the ship-log, the chore commit ran the evals again, and parallel sessions inherited each other's lines. A commit now carries its own waiver line and any a push left behind. The hook stages the ship-log only when waiver lines are its sole change, and never in a partial commit.
- **Upgrade committed on whatever branch was checked out.** On local master in an MR-only repository the commits sat unpushed for a week; elsewhere they rode an unrelated feature's merge request. With a remote, `conductor upgrade` on the default branch now commits on a new `chore/conductor-<version>` branch and prints the push command. On any other branch it does not commit and says why. Without a remote, nothing changes.

---

## [6.10.0] — 2026-10-13 — The gates guard nested code repositories

### Fixed

- In the outer layout (Conductor in an outer folder, the team's code in a gitignored nested repository), no TDD, eval or verify gate ever ran on a code commit: `install-hooks` wired only the outer repository. `conductor status` still printed "Gates on". Seen on two real installs.

### Changed

- `conductor install-hooks` (and so `init` and `upgrade`) also sets each nested code repository's `core.hooksPath` to the outer `.agents/hooks`, in local git config only. A repository with its own hooks is left alone and reported. `--uninstall` unwires them.
- The hooks find the project root from their own location. In a nested repository, or a worktree of one, they judge the code diff and read the library from the outer repository's committed copy, the config from the outer `conductor.config.json`, and log waivers to the outer ship-log.
- `conductor.config.json` takes a push check per code repository: `"repos": { "<dir>": { "verify": "…", "eval": "…" } }`. `conductor verify --repo <dir> --set "<cmd>"` sets it.
- `conductor status` names each nested repository whose code is not gated.
- `conductor verify` no longer suggests `--run`, a flag that did not exist.

### Note — upgrading

- Outer-layout installs: after `conductor upgrade`, set each code repository's check: `conductor verify --repo <dir> --set "<command>"`. Until then its pushes run no test, and say so. Its commits are gated at once.

---

## [6.9.0] — 2026-10-13 — Build runs to ship-ready

### Changed

- Build no longer stops to ask "Ready to build?" or "Batch N complete, ready for next batch?". It runs until the implementation is ship-ready. A batch of tasks is now only the unit of independent review: the review runs, its blockers are fixed, and the next batch starts. Product owners in two projects answered these stops dozens of times and kept the fix in agent memories.
- Build stops for the product owner only on a product decision (what a user sees, cost, an irreversible choice, a contradiction with an earlier decision, scope), on a security or data-loss blocker that survives the review's delta round, or on a blocker it cannot remove (missing access, tests still red after systematic debugging). A plan step that does not match reality is an engineering decision: Build adapts it and records the deviation in the task tracker.
- Long builds survive a context reset through `task-tracker.md`: after a compaction or in a new session, Build re-reads the tracker, plan and spec and continues from the first task not `done`. A session that must end writes `handoff.md` and the exact `/build <folder>` command.

### Note — upgrading

- Projects that kept a "build without checkpoints" memory can delete it: the workflow now does this.

---

## [6.8.3] — 2026-10-06 — One DESIGN.md per code repository

### Fixed

- With several code repositories in one install (a public site and a CMS, say), `conductor personas` handed the Designer a bare `DESIGN.md`. It now names the `DESIGN.md` of each repository the change touches: one per product, since different audiences get different designs. `conductor design migrate --repo <path>` chooses which one receives the old notes.

---

## [6.8.2] — 2026-10-06 — design migrate and upgrade leave a clean repository

### Fixed

- `conductor design migrate` wrote an empty `DESIGN.md` skeleton when `conductor/4-context/design/` held only the untouched templates. Build then saw a `DESIGN.md` and skipped extracting the real one from the code. It now writes nothing, changes nothing, and says to run the `design-system` skill. `upgrade` no longer prints the migration hint for untouched templates.
- `upgrade` left every repository dirty: its commit's waiver line was logged to the ship-log after the commit, and the report gate then refused to commit that line on a ship-log whose newest entry predates the For-you rule. The report gate now lets through a change that only adds the hooks' own waiver lines, and `upgrade` commits that line itself, so it ends on a clean tree.

---

## [6.8.1] — 2026-10-06 — Documentation matches 6.8.0

### Fixed

- `how-it-works`: the UX/UI Design Brief now lists `DESIGN.md` as an output and Build as a consumer, `grilling` names its Lens Pass, `independent-review` its conflict order, `ux-reviewer` its visual review on request.
- The Conductor Assistant persona listed workflows and skills by hand, and 11 skills were missing. It now points at the registries in `how-it-works.md`.
- `ux-reviewer`'s description names `DESIGN.md` and the visual review.

---

## [6.8.0] — 2026-10-06 — Personas as an Engineering Team, DESIGN.md

### Note — upgrading

- The **Maker** and **Tech Lead** personas are removed. `upgrade` deletes them from `.agents/personas/`. Build and the `code-review` skill already carry what they said.
- New projects no longer get `conductor/4-context/design/`. If yours holds design notes, `upgrade` tells you to run `conductor design migrate`: it combines them into one `DESIGN.md` at the root of the code repository and leaves a pointer in each old file. Nothing is deleted.

### Added — personas load themselves (#53)

- `conductor personas [paths…]` maps the files a change touches to the Architect, Designer, Security Auditor, Database Architect and Performance Optimizer, and prints each one's **Review Lens** (3 to 5 checks in the persona file). With no paths it reads the branch diff. Projects tune the path rules under `personas` in `conductor.config.json`.
- Build loads the listed personas before each task. The reviewer in Build, Ship and the loop Checker gets the Review Lens lines only, so the reviewer brief stays one file and Rubric v2 is unchanged.

### Added — the personas work as one team (#54)

- Spec-It turns each triggered persona's Review Lens into acceptance criteria.
- Grilling gains a **Lens Pass**: one persona at a time, at most two questions each, engineering answers recorded as **Lens decisions**. Technical Vision runs it with the Architect, Database Architect, Security Auditor and Performance Optimizer (and the CTO when the stack adds a vendor), and reads `architecture-patterns`. Genesis and Grand PRD run it with the Product Manager only.
- Conflicting findings are settled in a fixed order: security and data integrity, acceptance criteria, architecture, performance, design. The product owner is asked only when every option changes what the user sees or does. `conductor review-log` records `persona` and `overridden_by`, refuses a reversed override without `po_decision`, and its summary flags a persona that loses most of its conflicts.
- After the delta review round, only security and data-loss blockers go to the human. Other remaining blockers are fixed or recorded as known gaps in the PR.

### Added — DESIGN.md keeps the UI coherent (#55)

- One `DESIGN.md` at the code repository root (the nested repository in the outer layout) holds the visual theme, colour roles, typography, layout, component styling and the token file.
- New `design-system` skill: greenfield, brownfield (extracted from the code) and migration modes. The UX/UI Design Brief drafts DESIGN.md for approval with the brief. Build creates it as a fallback. The Designer always gets it from `conductor personas`.
- `conductor design migrate [dir] [--repo <path>] [--dry-run]` combines `conductor/4-context/design/` into DESIGN.md.

### Removed

- Personas **Maker** and **Tech Lead**.
- `conductor/4-context/design/` (`design-system.md`, `ui-components.md`, `brand-assets.md`) from new installs.
- The Stitch detector in `src/detect.js`: a `DESIGN.md` no longer implies Google Stitch.

### Fixed

- The Designer persona pointed at skills that no longer exist (`enhance-prompt`, `stitch-loop`, `design-md`).
- Technical Vision pointed at `personas/CTO.md`, which does not exist on a case-sensitive filesystem.

### Fixed — Build reads the screen design

- Build never read the UX/UI Design Brief: screens, layout order, hierarchy and interactions reached the code only through the feature spec's summary. Build's Phase 0 now reads the brief for the screens it touches, and `DESIGN.md`. The Designer's Review Lens checks each screen against the brief's layout order and primary action.

### Added — the UX brief specifies experience, not only function

From a real project: twelve slices were built from a brief that said what each screen does, and the owner then needed 20 screenshots, two reviews and five rework slices. The brief never said what the user sees first, how a page is edited, or how a missing value looks.

- The UX/UI Brief now asks, for every screen: layout and hierarchy (seen first, second, third, the primary action), every state (read and edit, empty, loading, error, by permission, by status), how unknown values are shown, and the existing screen it should match. The Designer runs a Lens Pass on the brief before it is approved.
- `DESIGN.md` gains **Patterns** (editing a record, forms, confirmation, disabled actions), **Data Display** (dates, numbers, unknown values) and **Reference Screens**. `conductor design migrate` places old sections there by heading.
- The Designer's Review Lens: an unknown value is shown as unknown, never as a default answer, and each element reuses the shared component `DESIGN.md` names.
- A **visual review** of rendered screens (headless screenshots, reviewed by a fresh Designer) is available on request. It is off by default for cost and speed: Build mentions it in one line when a change touched UI.

### Measured — agents follow the persona step

- `test/evals/persona-eval.mjs` (real Build runs, `master` against this release): the Designer and the design rules are read before the first write 9/9, against 0/9 on `master`. Cutting the step from `build.md` drops it to 0/3, so the eval detects what it grades. CSS quality did not differ: both wrote token-only CSS in every scenario. Not measured yet: layout, hierarchy and flow (see `test/evals/README.md`).

### Added — the documentation is checked

- `test/docs-drift.test.js`: README counts match what ships, every CLI command appears in README and CLAUDE.md, and how-it-works lists exactly the personas and skills that ship.

---

## [6.7.0] — 2026-10-05 — One AGENTS.md, the Project Card, Loop Fixes

### Note — upgrading

`upgrade` changes what your project root looks like:

- A new root `AGENTS.md` appears: the framework block (generated from `.agents/`, do not edit it) and a draft project card. Any text you already had in an `AGENTS.md` is kept below.
- `CLAUDE.md` and `GEMINI.md` are removed. Notes you wrote in them move to the end of `AGENTS.md` under "Notes moved from …". Both files are backed up in `.conductor-backup/`.
- Claude Code must be 2.1.277 or later to read `AGENTS.md`. Do not keep a `CLAUDE.md` or `CLAUDE.local.md` in the same folder: Claude Code reads those instead. `upgrade` and `status` warn about each.
- Then ask your agent to run the **agents-md** workflow (`/agents-md`) to write the project card.

### Measured — the project card earns its bytes

An eval on a real project (eurassistant), 5 questions that need project knowledge (test command, where a new intent goes, stack, where tools get the user identity, what must pass before a push), 2 runs per question, read-only tools, same framework block in both arms:

| | With card | Draft card |
|---|---|---|
| Turns | 23 (2.3 per question) | 59 (5.9) |
| Cost | $1.25 | $1.93 |
| Time | 81 s | 161 s |
| Matched the expected answer | 10/10 | 8/10 |

The two misses without the card both answered the push question with the local hook (pytest + evals, accurate) and did not name the `ruff` CI gate the card records: a coverage difference, not an error. n = 2 per cell, one project. The card stays at its full form, limit 3,072 bytes.


### Added — the project card in AGENTS.md

- `conductor agents-md facts|write|check`. `write` fills the card's Stack, Commands, Layout and product-area list from the code (manifests, `conductor.config.json`, directories, `conductor/3-product-areas/`), keeps whatever an agent already wrote, and marks the rest `TODO`. `check` exits 0 only for a complete card: fixed headings, no `TODO`, facts unchanged, at most 5 conventions, at most 3,072 bytes. It then stamps one hash per source.
- In the outer layout (code in a gitignored nested repository), the facts come from the nested code repository.
- `conductor status` says when the card is a draft, or stale and which sources changed.
- New workflow `agents-md` (`/agents-md` in Claude Code): the agent writes Purpose, Conventions and one line per product area from `conductor/`, then runs `check` until it exits 0. `init` and `upgrade` point to it.

### Changed — one root AGENTS.md replaces CLAUDE.md and GEMINI.md

- `init` and `upgrade` write a root `AGENTS.md`, the standard file every harness reads. Its framework block is generated from `.agents/` (the classifier and the rules marked `inline: true`); edit `.agents/`, never the block. A project card block follows, a draft for now. Text you write outside the markers is kept. An existing team-written `AGENTS.md` keeps every byte, below the inserted blocks.
- `CLAUDE.md` and `GEMINI.md` are no longer installed. `upgrade` removes them, after moving any notes you wrote in them into `AGENTS.md` ("Notes moved from …"); old pointer-only stubs move nothing. Both are backed up first.
- Why: Claude Code reads `AGENTS.md` only when no `CLAUDE.md` exists, and our `CLAUDE.md` only asked the agent, in prose, to read `.agents/AGENTS.md`. With it gone, Claude Code and Codex load the framework every session, and Claude Code also reads a team repository's own `AGENTS.md` in a subfolder.
- Requires Claude Code 2.1.277 or later. `init`, `upgrade`, `status` and the loop warn about an older version, and about a `CLAUDE.md` or `CLAUDE.local.md` that would make Claude skip `AGENTS.md`.
- Rules: `trigger: always_on` is replaced by `inline: true` (Antigravity no longer loads them twice). Prime directive: no visible `<thinking>` block; ask for confirmation only before destructive or hard-to-undo actions and product decisions; unattended runs follow `unattended-loop.md`. New precedence line: a team repository's instructions win for code style and repository process, Conductor's for TDD, verification and `conductor/` state. The Test-Driven Law names the `pre-commit` hook that enforces it.
- `conductor context-bill` bills the generated framework block. The Claude Code slash-command reference moved from `CLAUDE.md` to `how-it-works.md`.

### Fixed — framework reference matches what ships

- `how-it-works.md`: the folder map adds `hooks/`, `sandbox/`, `references/`, the `.claude/` shims, `architecture-checklist.md` and `loop-trigger.md`, and describes what `conductor.config.json` now holds. The CLI reference covers every command (`install-hooks`, `verify`, `evidence`, `review-log`, `context-bill`, `trust-verify`, `loop`, `init`/`upgrade`). The full classifier gets the `status` row and `conductor inbox add`. The skill registry lists `architecture-checklist` and `writing-evals`. A new *Running the loop* section gives an agent the loop facts: one repository, per-project settings, task selection, driver-owned state, merge rule, where the evidence is. Links to design documents point to GitHub, because `docs/` and `src/` do not exist in an installed project.
- `rules/loop-guardrails.md`: the full terminal-status vocabulary, the beat ceiling as the lower of `iterations.max_allowed` and `budget.max_beats`, and the per-run reset.

### Changed — leaner always-loaded framework text

- F21: the text every session loads drops from 8.3 KB to 6.0 KB. Removed from `.agents/AGENTS.md`: "The Hybrid Architecture" and "Quick Reference", both already in `how-it-works.md`. Removed from `rules/test-driven-law.md`: the test-layer table (already in `how-it-works.md`) and the interactive-versus-unattended section (already in `workflows/unattended-loop.md`). No rule changed.
- `conductor context-bill /absolute/path` reported "nothing found". An absolute directory is now used as given.

### Fixed — every run after the first one halted at once

- F17: `budget.started_at` was set at the first run and never reset, so any run that started more than `max_wall_clock_min` (default 120) minutes after the first one halted immediately with `budget_exceeded`. The beat counter and the terminal status also carried over, so each new run had to be reset by hand. A run that starts after a finished one (terminal status) now resets the status, beat counter, clock, token count, stall counter and last PR. An interrupted run keeps them and resumes.

### Fixed — the agent sees the live loop state

- F15: an agent beat runs in a worktree, which holds the committed `loop-state.json`, not the driver's live one. With `conductor/` tracked in git (the common setup), a pair-mode agent read an old goal and phase, often an empty goal and `discovery`, and refused to work. Before every maker and checker beat, in pair and swarm mode, the driver now copies the live state into the worktree and hides the copy from git.
- F18: the auto-capture commit swept the driver's `maker-signal.json` (and on later beats `checker-verdict.json`) into the branch, so the PR carried them. Both are now hidden from git in the worktree.

### Fixed — loop follow-ups

- F10: a backlog item claimed by the loop (`🤖 X (in progress: …)`) got a new id on the next harvest. A repeated or resumed `--from-conductor` run took it again, and the done write-back could not find it. The claim annotation is now ignored when the id is computed. The claim and done write-backs also no longer remove the blank line after the item, or the final newline.
- F11: the agent's output from each maker and checker beat is saved in `.git/conductor-loop-logs/`, and the path is written to the ship-log. The newest 200 logs are kept. Before, a beat that did nothing left no trace once its clean worktree was removed.
- F12: a fresh install's backlog held six example tasks, which `--from-conductor` would dispatch to agents. The example is now a quoted format note, so nothing is harvested. Existing installs keep their backlog: delete the example items if they are still there.
- F13: `docs/Running-The-Loop.md` said the driver does not read `conductor/`. It now describes `--from-conductor`, the `loop` settings and the beat logs.
- D1: the loop refuses to run when a top-level directory is a separate, gitignored git repository, for example an outer `conductor/` repo with the code nested inside. Before, it ran against the outer repo without a warning. `loop.allow_nested_repo: true` overrides this when the nested repository is unrelated to the work.

---

## [6.6.0] — 2026-10-02 — Loop Settings per Project, Swarm Merge Gate

### Note — upgrading

Nothing changes until you add a `loop` block to `conductor.config.json`, with two exceptions for `conductor loop`:

- `--from-conductor` no longer takes backlog items whose title contains `BLOCKED` or `NEEDS_DECISION`.
- An L3 execution run now checks `<forge> auth status` for the origin host before the first beat, and stops if it fails. On a non-GitHub origin the forge is now `glab`, even when `gh` is installed.

### Added — per-project loop settings (6.5.0 field report)

A new `loop` block in `conductor.config.json`. Upgrade keeps it. The loop reads it from the main checkout only. An invalid value stops the run. See `docs/Running-The-Loop.md`.

- F2: `loop.setup` runs once per new worktree, before the first beat (for example `npm ci`, or a venv install). A failure stops a pair run with the new status `halted_setup_failed`, or fails the swarm task. No beat runs in that worktree.
- F3: `loop.allowed_domains` adds hosts to the `cli-native` sandbox network list. The loop merges them into a generated copy of the template, so `conductor upgrade` no longer erases them.
- F4: the forge comes from the origin host: `github.com` → `gh`, any other host → `glab`. `loop.forge` overrides it. At L3 execution, `<forge> auth status --hostname <host>` is checked before the first beat, not after the push. Before, `gh` won whenever it was installed.
- F5: `--from-conductor` never takes items marked `BLOCKED` or `NEEDS_DECISION`. `loop.require_ready: true` takes only items tagged `loop-ready`. `--priority P1` / `loop.priorities` and `--no-inbox` / `loop.inbox` filter the queue. The agent now gets the item's indented details, not only its title.

### Fixed — loop safety (6.5.0 field report)

- F6: swarm mode opened PRs at every autonomy level. It now opens a PR only at L3 execution, like pair mode. Below that, a passed task keeps its branch, gets an inbox item, and the run ends in `awaiting_review`. `--dry-run` prints the same merge decision.
- F7: swarm branch names cut the task id when the goal was long, so tasks shared one branch. The goal part is now at most 20 characters and the task id is kept in full. An interrupted swarm from an older version gets new branches on resume, and its old branches stay in place.
- F8: `budget.max_beats` is now enforced. The beat ceiling is the lower of `budget.max_beats` and `iterations.max_allowed`.
- F9: `conductor loop --help` printed the sandbox refusal. It now prints the loop help, before any state read or gate.

---

## [6.5.0] — 2026-09-24 — Safe Upgrades, One Workflow per Session, Claude Code Skills

### Note — upgrading

`upgrade` replaces `.agents/`, so the gates added in this release become active in every project that upgrades. A commit that used to pass can now be rejected:

- deleting a test, adding a skip marker, or losing assertions → `CONDUCTOR_NO_BOUNDARY="reason"`;
- editing `.agents/hooks/`, `.agents/rules/`, `.agents/sandbox/` or the reviewer brief → `CONDUCTOR_NO_PROTECTED="reason"`.

Both waivers are logged to the ship-log. `upgrade` now commits its own changes with the protected-path waiver, so you do not type it yourself. It does not commit when it moved legacy folders or renamed files in `conductor/`, or when you had uncommitted changes in framework files. In those cases it prints the one command to run.

Before upgrading many projects, run `upgrade --dry-run` in each one. A repo with `.agents/` but no `conductor/` and no version stamp is now refused (see below).

### Fixed — upgrade is safe on V4 and agent-only repos, and commits everything it writes

Found by upgrading copies of 8 real installs from `master`. The 5 recent installs (6.2.0 and 6.3.0) were fine. The other 3 were not.

- **V4 installs keep working after the upgrade.** The kebab-case migration renamed only the numbered folders, so a `.conductor/` install kept `2-backlog/Project-Backlog/`, `1-workbench/Inbox.md`, `<project>/Blueprint/Grand-PRD.md`, and so on. On a case-sensitive filesystem, the workflows and the CLI found neither the projects nor the inbox. `renameFrameworkNames` (`src/kebab.js`) now renames framework names at every level of `conductor/`. A framework name is one in the shipped `templates/conductor/` tree, a document name a workflow writes, or a framework suffix (`-Documentation`, `-Features.md`, and so on). Every other name, for example `Nexus`, `01-Foundation-Auth` or `API-Discovery.md`, is left as the user wrote it. Case-only renames go in two steps, so they also work on macOS and Windows. When anything was renamed, `upgrade` prints the commit command instead of committing, so you check `git status` first.
- **Retired framework files are removed from V4 installs.** With no `.checksums.json`, `upgrade` could not prove ownership, so it kept every file Conductor had since dropped, as "custom". One real V4 install kept 11 of them, including `rules/conductor-system.md`, a rule loaded in every session that pointed at the old layout. `src/retired-framework-files.json` lists the 26 `.agents/` paths Conductor once shipped and no longer ships, generated from git history by `scripts/capture-retired-files.js`. It applies only to an install with no checksums; with checksums, those alone decide. Each removal is listed in the output and kept in the backup.
- **An agent-only repo is refused.** A repo with `.agents/` but no `conductor/` and no version stamp was turned into a full Conductor install: every workflow, the hooks, a new `conductor/` folder with the example product areas, and a second instruction block in its own `CLAUDE.md`. `upgrade` now stops and changes nothing, unless you pass `--force`.
- **The upgrade commit includes the `.claude/skills/` shims.** They were left untracked. Only the shim paths the upgrade wrote or removed are committed, never a skill of your own.
- `test/upgrade.test.js`: one test per failure, built from the names in the real install, each red before its fix, plus a test that the retired list never names a file still shipped. Re-verified by upgrading fresh copies of all 8 installs: 6 upgrade and pass `check-conductor` with no knowledge file lost (all 69 files of the V4 install checked byte for byte), and the 2 agent-only repos are refused unchanged.

### Fixed — Claude Code can find Conductor's skills

- **`init` and `upgrade` now generate `.claude/skills/<name>/SKILL.md`** for every skill in `.agents/skills/`. Claude Code finds skills only there. Before, a skill that no workflow loads by path, for example `handoff`, was reachable in Claude Code only by an `@` file reference. Each shim redirects to the real file, the same as the `.claude/commands/` shims. A user's own `.claude/skills/<name>/` is never overwritten. Stale generated shims are removed. Verified live: a headless Claude Code session in a fresh install lists `handoff`.

### Changed — one planning workflow per session, and plain Genesis terms

Running Genesis through to Spec-It in one conversation leaves Carve and Spec-It with the largest and noisiest context of the chain. Every workflow already reads its inputs from `conductor/`, but nothing told the human to start fresh, and a fresh session could not know which Project to read: Carve, Technical Vision and Build named no project at all.

- **Every step of the chain ends with the exact next command, with the folder.** For example: `/clear`, then `/carve conductor/2-backlog/project-backlog/Billing`. The chain is Genesis → Storyboard → Grand PRD → UX/UI Design Brief → Technical Vision → Carve → Spec-It → Build.
- **Every receiving workflow reads the folder it is given and does not ask.** With no folder, it lists Projects by last change and recommends the most recent unfinished one.
- **`handoff.md` carries only what no document holds.** It holds open questions and decisions, lives in the folder the next command names, is read first, and is deleted once handled. There is no "current project" pointer file.
- **`skills/handoff`** gains *Between workflows* and drops its advice to run discovery → spec → tickets in one session.
- **Genesis vocabulary is plain.** *Sun* is now core problem, *Satellites* symptoms, *North Star* target outcome. The three documents are now Problem, Before and After, and Capabilities. **File names are unchanged**, so existing installs need no migration. A note in `genesis.md` maps the old names for older documents.
- Verified live: a headless `/carve <Beta folder>` session in a two-Project install read only Beta and surfaced its `handoff.md` question. `/carve` with no folder recommended the most recent Project. Not verified live: that each workflow's completion step prints the command.

### Added — `conductor status` shows whether the gates are armed

- A **Gates** line: `on`, or why not with the fix. The hooks only enforce when `core.hooksPath` points at `.agents/hooks` and both entry scripts are executable, so a repo cloned after init, a foreign hooksPath (`.husky`) or a lost executable bit left every law as prose with nothing on screen to say so. It also reports which opt-in Claude Code guards (`pretooluse-no-bypass.sh`, `pretooluse-fact-gate.sh`) are wired in `.claude/settings.json` or `settings.local.json`.
- A **Waivers** line: hook waivers logged to the ship-log in the last 30 days, by kind. A gate waived every week is a gate in name only.
- Both are in `conductor status --json` under `digest.gates`. `test/status-gates.test.js` (16 tests, real git for the wiring cases).

### Added — the gates cannot be satisfied by removing the proof (F9, F12, F11)

A source audit of ECC (`github.com/affaan-m/ecc`) ran its loop-failure taxonomy against our own envelope and found three holes. All three are closed. Design and review record: `docs/roadmap/Peer-Framework-Harvest.md`.

- **Goodhart boundary** (`hooks/pre-commit`). The Test-Driven Law proved a test *changed*, so deleting a failing test, skipping it, or gutting its assertions all passed. The commit is now blocked when a test file is deleted or renamed to a non-test path, a skip marker is added (`.skip`, `.only`, `@pytest.mark.skip`, `#[ignore]`, `t.Skip`, `@Disabled`…), or the staged tests net-lose assertions. Waiver `CONDUCTOR_NO_BOUNDARY="reason"`, logged. It is independent of `CONDUCTOR_NO_TEST`.
- **Protected paths** (`hooks/pre-commit`, `hooks/pre-push`). Edits to `.agents/hooks/`, `.agents/rules/`, `.agents/sandbox/` and the reviewer brief are blocked: the thing being built does not edit what judges it. Waiver `CONDUCTOR_NO_PROTECTED="reason"`, logged. The gate arms only once `pre-commit` is committed, so a fresh install's first commit passes.
- **The gates judge a change with the committed library.** Both hooks load `lib.sh` from the last commit, so deleting, moving or rewriting it cannot switch the gates off for that commit. A missing helper now fails **closed**. `pre-push` refuses a range that deletes, renames, un-chmods or edits `pre-commit`, except the exact official file, pinned by SHA-256.
- **Hook-bypass blocker** (`hooks/pretooluse-no-bypass.sh`, Claude Code `PreToolUse`, opt-in). Denies Bash calls that skip the git hooks: `--no-verify`, `commit -n`, `-c core.hooksPath=`, `GIT_CONFIG_*`, and the same through `env`, `sh -c`, `$'…'` quoting and grouped flags. It stops the ordinary bypass. It does not stop a determined one, and the README says so.
- **Every waiver is logged** to `conductor/0-compass/ship-log.md`, including the fail-closed fallback, checked by an 11-case behaviour matrix.

### Added — investigate before you write (F1)

- **Fact gate** (`hooks/pretooluse-fact-gate.sh`, Claude Code `PreToolUse`, opt-in). The first edit of a file asks for the failing test, the first creation asks what already does this, and the first run of each destructive command asks for the facts. Routine Bash is not gated. Identical repeated denials are dampened. Off: `CONDUCTOR_FACT_GATE=off`.
- **Measured, not asserted.** `test/evals/fact-gate-eval.mjs`: gated runs named the affected files 4/4, the control 0/4, against a +25pp noise floor from two identical ungated arms. n=4, so the direction holds and the magnitude is approximate.
- Both `PreToolUse` hooks bound themselves with `timeout` (then `gtimeout`, then a `perl` alarm) and fail open. A path under `/proc` made `mkdirSync` hang, which would have stalled the session.

### Added — the swarm predicts merge conflicts before it opens a PR (F7)

- `src/loop/conflict.js` asks `git merge-tree` whether each branch merges cleanly. The swarm's merge queue lands clean branches first and escalates the colliding one by name, with no doomed PR. It fails open: a prediction error never blocks a merge.
- Proven against real git by `test/conflict-predict-real.sh`, which compares each prediction with a real merge. Only the legacy `merge-tree` form (git < 2.38) was run here. The modern form is not verified.
- **Not built:** agent-proximity admission control (F8). Its input, a file scope per task, does not exist. See `docs/roadmap/Swarm-Collision-Admission.md`.

### Added — `conductor review`: the human approves a document in the browser (F4)

- `conductor review <file.md>` renders the document on a loopback page and blocks until the human presses **Approve** or **Request changes**. Exit `0` approved, `2` changes requested, `1` no verdict. Stdout is JSON only, so an agent can run it in the background and read the verdict.
- Comments anchor to the text the human selected. Feedback is queued to disk before each response, so a killed process loses nothing and a verdict is valid only for the exact content it was given on.
- The server accepts same-origin JSON only. A page on another port could previously approve a review.

### Added — `conductor survey` and the Survey workflow: onboard an inherited codebase (F15)

- `conductor survey [dir]` collects facts only: file and language counts, test coverage by area (untested first), entry points, HTTP routes, configuration keys and dependencies. Coverage is attributed by what a test imports, then by name.
- `workflows/survey.md` interviews the human for what the code cannot say: who uses it, what must not break, what the last team was in the middle of. It writes `conductor/3-product-areas/` and marks every unestablished claim `TBD`. Trigger: "I inherited this codebase".
- Four defects were found only by running it against real repos, never by a test.

### Changed — `conductor upgrade` commits itself

- An upgrade rewrites protected paths, which the new gate blocks. So `upgrade` now commits exactly the framework files it wrote, with the waiver logged, and never includes your own work. The push then needs nothing. With uncommitted edits in those files, a merge in progress, or `--no-commit`, it prints the one command to run instead.

### Added — drift test for the hook registry (F3)

- `test/hooks-registry-drift.test.js` checks that every hook on disk is in the hooks README, made executable by `install-hooks`, and matches the pinned official `pre-commit` fingerprint.

### Review record

Three independent review rounds on PR #33 found 18 blockers, all fixed. Two commits are author-verified only: `cbbd024` (the final round's findings, by decision) and `d224e38` (the self-committing upgrade, requested after review closed). Both `PreToolUse` hooks were run in a live Claude Code session on 2026-09-24 and behaved as documented (`docs/roadmap/Peer-Framework-Harvest.md` §6). Not verified: the `perl` fallback on macOS, the modern `merge-tree` path, and conflict prediction in a real swarm run.

---

## [6.4.0] — 2026-09-16 — Product-Owner Reporting, the Brief Check, the Ship Tail & Terminal Surfaces

### Added — the interview asks product questions, the agent decides engineering (A3)

Stated by the maintainer on 2026-09-16: Conductor exists to supply engineering rigour to a Product Owner's ambition, and the agent plays the engineering team he no longer has. He runs 4 to 6 products, wrote code for the first 5 to 7 of his 17 years in IT, and has no time to reconstruct an agent's reasoning. Grilling's Law 3 split the world in two — facts the agent looks up, and *decisions*, which all belonged to the human — and that binary is why an interview ever asked him for a tech stack, a test seam or a refactor candidate. A team decides those and reports them.

- **`skills/grilling/SKILL.md` gains *Whose Decision Is It***, a three-way split replacing the two-way one: **facts** (look them up), **engineering decisions** (libraries, patterns, file layout, test seams, refactors, naming, error handling, tooling — decide it, then report it in one line, never offer options), **product decisions** (ask). A decision is the human's only when it changes what a user sees or does, changes what the product costs to run, cannot be undone cheaply (data model, auth model, vendor, public API), contradicts an earlier decision, or is a scope or priority trade-off. Everything else is the agent's.
- **`skills/collaborative-drafting/SKILL.md`** defers to the same split: never draft two options for a library, a pattern, a schema shape or a test seam and ask which one.
- **`workflows/quick-path.md`** drops *tech stack preferences* and *existing patterns to follow* from its constraints question and reads them from the codebase instead. What stays is the human's: files not to touch, time, what must not break.
- **`workflows/spec-it.md`** takes sign-off on what an implementation **delivers** — scope, acceptance criteria, sequence — while the plan's engineering decisions are stated one line each and escalated only against the triggers above.
- **`workflows/deepen.md`** decides its own refactor candidates rather than grilling the human on them. An internal refactor is reversible and invisible, so it fails every escalation trigger; a data-model or public-API reshape does not, and still escalates.
- `test/product-only-grilling.test.js`: 7 tests, red before the change.

### Added — the brief is challenged before the code is written (A5)

Every gate the framework owns is inward: the Test-Driven Law, the Eval-Driven Law, the evidence ledger, `independent-review`, the loop's Checker. All of them prove the code does what the spec says, and none of them ask whether the spec was worth building. A PO with a team gets challenged for free by people who will live with the decision; a PO running several products against an agent fleet gets none of that, so a contradiction between a March brief and a September brief simply gets implemented twice.

Design, decisions and what was descoped: `docs/roadmap/Outward-Rigour.md`.

- **Four bounded conditions in `skills/grilling/SKILL.md`**, checked before convergence: **C1** the brief contradicts a decision the human made earlier (prior `conductor/` docs, **this project only**), **C2** it breaks something for existing users (shipped acceptance criteria and current behaviour), **C3** its cost or duration is far from what the brief assumes, **C4** we lack the data, the access or the rights. Two sentences per hit, naming the source read.
- **Bounded on purpose.** The agent is never asked "is this a good idea?" — C1–C4 are facts about consistency, breakage, cost and access, and need no taste. An unbounded question is precisely what stopped the review gate converging before rubric v2, and that failure is not repeated here.
- **It does not block.** The agent states, the human answers in a line, work continues. A C1–C4 hit is never a refusal and is never re-raised once answered. `none found` is said out loud, because a silent check is indistinguishable from no check.
- **The shared understanding is now an artifact.** Grilling's Law 5 records the convergence in the document the workflow saves, so the engineering work that follows can run against it unattended. The maintainer's framing: the common understanding is the thing of value the interview produced.
- **`5-templates/carve-workflow/feature-spec.md`** gains a `## Brief check` section (C1–C4, each `None found.`-able) and a **Shared understanding** paragraph.
- **Presence is enforced, not requested.** `hooks/lib.sh` gains `conductor_is_brief_doc` and `conductor_has_brief_check`; `hooks/pre-commit` rejects a staged `feature-spec.md` with no `## Brief check` section, waiver `CONDUCTOR_NO_BRIEF="reason"`, logged to the ship-log like the other two laws. **Presence, not quality** — a shell hook cannot judge whether a challenge is a good one, which is the same call the Eval-Driven Law made.
- `test/outward-rigour.test.js` (11 tests) + `test/hooks-brief-gate.sh` (5 behaviour cases against the real hook in a temp repo), wired as `npm run test:hooks:brief`.
- **Known gap:** C1–C4 ship **unmeasured**. `review-log` has the right shape (`category` takes `C1`–`C4`, and `summary` already flags a class dismissed more than half the time), but its own ~10-ship review measurement started on 2026-09-15 and mixing rows in would corrupt it. Until a separate ledger exists, a detector that fires too often or too rarely will be found by the reader, not by data.

### Changed — the ship-log, the PR body and `conductor status` report to a Product Owner (A4)

The maintainer reads the loop asynchronously, often on another machine hours later: a ship-log entry, a PR body, and `conductor status`. All three were engineering-shaped. The ship-log's six fields were quality, platform and a three-line retrospective; the PR body had no shape beyond "link issues, summarise the review"; and `status` answered "what is on our plate" with counts and freshness. Across several products nothing anywhere answered **"what is waiting on me"**.

- **The ship-log entry is restructured, not extended.** **For you** — `Impact` (what a user can now do, not what was built), `Cost`, `Risk`, `Decide` — then **For the record**, carrying quality, platform and the `Surprised` / `Next time` / `Framework lesson` lines unchanged. Same entry length, one reading order, and an engineering detail never moves up into *For you*.
- **`Decide` is a queue, not a note.** A value other than `none` surfaces under **Waiting on you** at the top of `conductor status`, above the work queue, and stays until the entry is edited.
- **`openDecisions()` in `src/conductor-state.js`** reads it into `digest.shipLog.openDecisions`. `none`, `None.`, an empty value and a missing field all mean closed, so an entry with nothing to ask costs the reader nothing; entries predating the two-block shape are skipped, never guessed at.
- **`src/view/status.js`** renders the section newest-first and **omits it entirely when empty** — an empty heading trains the eye to skip the section that matters most.
- **The MR/PR body gains a stated shape** in `workflows/ship.md` Phase 6, because for an unattended ship it is the only channel to the human: a one-or-two-sentence answer, *What changes for you*, *Decisions I took alone*, *Evidence* (exit codes and counts, with anything unrun labelled `not verified`), *What I need from you*. If the ship-log's `Decide` is not `none`, the same question goes in verbatim so the two surfaces cannot disagree.
- **A fourth pre-commit gate.** `conductor_is_ship_log` + `conductor_newest_entry_has_for_you` reject a staged ship-log whose newest entry has no `**For you**` block. Newest is by **date, not file position**, because one live log had 07-15 written after 07-16. Waiver `CONDUCTOR_NO_REPORT="reason"`, logged.
- `test/po-report-shape.test.js` (11 tests) + `test/hooks-report-gate.sh` (6 behaviour cases), wired as `npm run test:hooks:report`.

**Two bugs the green suite did not catch**, both found by running the real thing rather than a test, and both the pattern already recorded for this repo: the report gate left `$report` unbound, so under `set -u` **every commit in every installed project would have failed**, and the unit test was green because it only greps `lib.sh` for function names; and the `Decide` parser handled `- Decide: none` while the template writes `- **Decide:** none`, so every closed decision rendered as open. The fixtures now mirror what Ship actually writes.

### Changed — Ship writes the log before it creates the MR, and the entry carries a minimal retrospective

Measured on 2026-09-15 across the maintainer's four live projects: the last ship-log entries were dated 2026-07-16, 07-31 and 07-31, while 103, 8 and 18 merges landed on main after them, and retrospectives existed for 12 of 47 logged ships. The cause was the workflow's order, not the agent's diligence: the MR was created in Phase 5 and the ship-log, product-area update and archive move sat in Phase 6, after the visible deliverable, with the Retrospective an optional Next Step. An agent treats the MR as the finish line and stops.

- **Phases 5 and 6 are swapped.** `Conductor Bookkeeping` (ship-log entry, product area, archive) is now Phase 5 and a precondition of `Git Flow & Platform Integration`. The only bookkeeping left after the MR is writing its URL back into the entry, because the URL cannot exist before it. The completion checklist follows the same order.
- **The ship-log entry gains three lines:** `Surprised`, `Next time`, `Framework lesson`. One line each, from what actually happened, with `none` licensed explicitly so nothing is invented. A ship with no separate Retrospective still leaves a lesson behind, and `grep "Framework lesson"` across every project's ship-log is the route by which project lessons reach this repo — four retrospectives had asked for a Carve/Spec-It change that never landed because there was no such route.
- **`templates/conductor/0-compass/ship-log.md`** now documents the same entry format the workflow writes. It used to prescribe a pipe table that no project used and that contradicted `ship.md`.
- **`test/ship-tail.test.js`** pins the order (phases and checklist) and the fields. Structural on prose, and says so: whether the logs resume is measured the way the gap was found, by diffing the last entry date against merges on main.
- `workflows/ship.md` grew 14,449 → 15,699 bytes for the three fields and the Phase 6 write-back step; the eager ceiling is re-captured in the same commit.

### Added — Spec-It probes the live system before the spec exists (O4)

Four retrospectives across two projects, 2026-03-13 to 2026-07-24, asked for the same step and none reached the framework: an API type code trusted from its label, a new ID format that missed three sibling endpoints, consumers authenticating differently than assumed while CI silently skipped the whole unit suite, and a source mapping that "was wrong and survived about 4 months in the specs". Carve and Spec-It had no step that turns a belief about the outside world into a fact.

- **`workflows/spec-it.md` Phase 0 step 3, "Probe the live system"**: before Phase 1 writes the Feature Spec, name every external dependency (API contracts and their real codes, the auth path real consumers use, the CI command and what it skips, the test harness, the schema fields and endpoints assumed to exist) and check each read-only against the live system or its config.
- **`5-templates/carve-workflow/feature-spec.md`** gains an **External Assumptions** section with `Verified:` (how) and `Assumed:` (what would prove it) lines, so a reader can tell a checked fact from a guess. A spec with neither is a guess dressed as a plan.
- **`workflows/carve.md` Phase 3** cross-check asks whether the entities, fields and endpoints a slice relies on exist **today**, read from the source system, not the blueprint.
- **`workflows/retrospective.md`** Process Updates no longer ends in "note it for future framework updates", which had no destination. It routes to the ship-log's `Framework lesson:` line.
- `test/spec-probe.test.js` pins the step's position, the four assumption classes, the two markers, and the retro route.

### Added — `conductor status` shows the ship-log's age and the push gate's state (O5)

The two-month ship-log gap was found by hand, diffing the last dated heading against `git log --merges`. Nobody does that twice, and `status` exists so the daily question costs zero tokens.

- **`digest.shipLog`** `{entries, lastDate, ageDays, mergesSince}` from `summariseShipLog` — only `## YYYY-MM-DD` headings count (the shape Ship writes), the latest date is a max because one live log listed 07-15 after 07-16, and absence is `null`, never a fake zero. Merges are counted in **the repo status is run in** and the line says so: a state-only wrapper repo reports its own merges, honestly, and the framework does not model the maintainer's layouts.
- **`digest.verify`** `{configured, command}` — what `pre-push` will actually run, resolved with the same priority as `hooks/lib.sh` (`verify` in config, else `npm test` when `package.json` has a test script), so status and the gate never disagree.
- Two new lines on the screen: `Ship-log  2026-07-31 · 46d ago · 20 merges in this repo since` (red when merges landed unlogged) and `Push gate NOT CONFIGURED: set "verify" in conductor.config.json (Iron Law off on push)`. Verified live against four projects, read-only.
- `test/ship-log-status.test.js`: 14 tests, fixture in the real log shape (table preamble, out-of-order entries, hook-appended waiver line) and a real temp git repo with dated merges.

### Added — the push gate is configured, or loud about not being (O6)

Measured 2026-09-15: `conductor.config.json` carried a `verify` command in **one** of five live projects. Everywhere else `pre-push` printed "Skipping verify." and the Verification Iron Law was not running. The maintainer's reaction to the sibling eval message: "What should I do I don't understand".

- **`suggestVerifyCommand(dir)`** in `src/detect.js` derives the command from the files present: `package.json` test script → `npm test` (lib.sh's own fallback, first so CLI and hook agree); `backend/` + `frontend/` test scripts → both, chained; pytest in `requirements*.txt`/`pyproject.toml`/`pytest.ini`/`conftest.py` → `poetry run pytest -q` under `[tool.poetry]`, `.venv/bin/python -m pytest -q` when a `.venv` exists, else `python -m pytest -q`; `go.mod` → `go test ./...`; `Cargo.toml` → `cargo test`. Nothing else is guessed: no match is `""`.
- **`src/verify-config.js` `ensureVerifyCommand`**, called by **`init`** and **`upgrade`**: fills an empty `verify` when derivable and says so; never overwrites a set one; otherwise prints a warning that names the key, the file, two example values, and that pushes go through untested until it is set.
- **`hooks/pre-push`** no-verify and no-eval messages now say the law is **NOT enforced** on this push and show the exact JSON to add, instead of "Skipping verify."
- `test/verify-config.test.js`: 14 tests on real temp-dir files — suggester rules, init writing/warning/leaving-alone, upgrade warning, and the hook message asserted on what the shell prints.

### Changed — Ship writes the review ledger it was built to read (O7)

E2 shipped `conductor review-log append|summary` on 2026-09-03 so the gate's convergence could be a number. Measured 2026-09-15: zero rows in all five live projects, because `templates/` never told the agent to append — only `calibration.md` mentioned the file, as a reader.

- **`workflows/ship.md` 4.4** records every disposition, dismissed ones included, with the exact `conductor review-log append '{…}'` record the CLI validates (severity, category, action; quote + confidence ≥ 7 for a BLOCKER), and says what `review-log summary` reports back.
- **`skills/independent-review/SKILL.md`** disposition rule names the same command.
- `test/review-ledger-wiring.test.js` pins both.

Eager ceilings re-captured in the same commit: `ship.md` 16,487, `spec-it.md` 6,962, `carve.md` 10,466, `retrospective.md` 4,475, `skills/independent-review` 10,591 bytes.

### Fixed — the rendered view broke on a real backlog

Four separate renderer failures, all found by pointing `conductor view` at a production `task-backlog.md` rather than the tidy fixtures the suite used. Every one of them passed the existing tests.

- **Task items shattered into one-word columns.** `.prose li.task` is a flex container so the checkbox can sit beside the text, but the body was left unwrapped — so every `<strong>`, `<code>` and text node became its own flex *item* and collapsed to a narrow column. A real item ("**DB-1:** Add `pool_pre_ping` to `core/database.py`") rendered as a wall of stacked single words. The body is now one `<span class="task-body">`, pinned by a test asserting the wrapper.
- **Underscore emphasis was shown literally.** `_Why:_` and `__bold__` were unsupported, so the markers printed. Now rendered — **with the delimiter required to sit against a non-word character on both sides**, because the alternative is worse: without that guard `pool_pre_ping`, `user_tokens` and `expires_at` get chewed into `<em>`. Both halves are tested.
- **Every document printed its title twice** — once in the page header, once as the document's own leading `# Title`. `renderMarkdown` takes `skipFirstH1` now; a *later* h1 is content and is always kept, and the outline still records the dropped one so no TOC anchor dies.
- **The dashboard columns showed raw markdown.** Backlog, queue and inbox lines were escaped and never rendered, so `**` and backticks appeared verbatim. Each displayed title now carries a `titleHtml` rendered at generation time, keeping the page free of a markdown parser. The queue is still the harvester's — same items, order and routing; the test asserts that invariant rather than object identity.

Two display changes came out of the same screenshots:

- **Done backlog items are collapsed** behind a `N done` fold instead of listed in full. A real backlog carries long DONE entries with post-mortems in them, and striking them through in place buried the open work the column exists to show. Long open items are clamped to three lines; the full text is one click away in the document view.
- **The sticky topbar is opaque.** Translucent, it let long documents scroll visibly underneath, which reads as a fault rather than as depth.

`conductor status` had the same raw-marker problem and gained `stripInlineMarkdown` — a title-safe strip, distinct from the search index's aggressive `plainText`.

### Changed — three imports from the 2026-09-15 upstream re-scan, each tied to a recorded problem

Seven upstreams were re-scanned (Test in Prod, obra/superpowers, AG Kit, Antigravity Superpowers, Pocock's skills, gstack, agentctl) with one filter: import only what answers a problem recorded in the maintainer's own projects. Three passed. Rejected with reasons in the scan: Superpowers' fix-loop escalation (E1's one capped round is accepted), AG Kit's lock file (the drift gate covers it), rollback and a PreToolUse shell hook (no recorded incident), and Pocock's round-by-round grilling (the maintainer prefers one question at a time; the Q1/F1 reference codes already make multi-answer replies easy).

- **C1 — a review that did not happen can never read as a pass** (`skills/independent-review/reviewer.md`, `SKILL.md` §3b, `workflows/ship.md` 4.3). Evidence: autopportunity's ship-verification note of 2026-08-05, where the delta reviewer was killed by four consecutive API 529 errors and a fifth run passed "with a deliberately minimised scope". The reviewer's report now opens with `SCOPE: complete` or `SCOPE: partial — <gap>`, and partial never carries APPROVE. The caller treats output with no `VERDICT:` line — empty, truncated, refused, API failure — as a round that did not happen: re-spawn once, then stop and say the gate did not run, never proceed as if it passed, and never count the failed spawn against the delta cap. The loop's checker already did this in code; this is the interactive path's copy. From gstack 1.86/1.87. `test/review-completion.test.js`.
- **C2 — the retrospective asks where the harness got in the way** (`workflows/retrospective.md` Phase 2, question 5). Evidence: twelve retros across four projects produced zero framework changes although four named a workflow gap; no question asked about the environment. Five categories — missing guardrail, navigation pointer, tool economy, no-op instruction, information access — and the rule that a mechanical standard becomes a hook, lint or CI check, never a paragraph, with the answer routed to the ship-log's `Framework lesson:` line. Categories from Pocock's in-progress `retro` skill; the mechanical-to-code rule is Operating Truth 3. `test/retro-harness-lens.test.js`.
- **C3 — debugging output is redacted before it is shown or saved** (`skills/systematic-debugging/SKILL.md`, new "Redact Before You Show" section plus a checklist item). Evidence: the maintainer's own turn of 2026-09-08, "the key was in clear for you and me". The handoff skill had the rule; the skill that actually prints commands, env dumps and logs did not. Names the secret classes, the `<REDACTED>` marker, the never-paste-`.env` rule, and that a secret already shown is treated as leaked. From Pocock's `diagnosing-bugs` Redact section. `test/debugging-redaction.test.js`.

Eager ceilings re-captured in the same commit for the grown files.

### Note — upgrading

`upgrade` replaces `.agents/`, so the two new pre-commit gates become active in every project that upgrades. A commit that used to pass can now be rejected:

- staging a `feature-spec.md` without a `## Brief check` section → `CONDUCTOR_NO_BRIEF="reason"`;
- staging a `ship-log.md` whose newest entry has no `**For you**` block → `CONDUCTOR_NO_REPORT="reason"`.

Both waivers are logged to the ship-log, never silent, and `CONDUCTOR_HOOKS=off` disables everything as before. Existing specs and old ship-log entries are untouched until you next stage them.

**Context bill.** Always-on is unchanged at 16,433 bytes — every one of these changes is eager, paid only when the workflow or skill is invoked. `skills/grilling` grew 2,855 → 5,536 bytes across A3 and A5 and is now the single source of truth for both the decision split and the brief check; `workflows/ship.md` 16,868 → 18,808; `spec-it.md` 6,962 → 7,851; `quick-path.md` 5,005 → 5,491; `genesis.md` 7,125 → 7,364; `deepen.md` 11,931 → 12,225; `skills/collaborative-drafting` 3,264 → 3,547. Ceilings re-captured in the same commits as the growth.

---

## [6.3.0] — 2026-09-08 — Review Convergence, Evidence Freshness, Untrusted-Input Hardening & Terminal-First Surfaces

Six epics. E6 (human surfaces for a CLI-first workflow) is independent; E1–E5 came from a source audit of two peer harnesses (**gstack** `1.79.0.0`, **agentctl** `main`) plus a survey of 2026 harness-engineering practice. Design doc with the full evidence: [`docs/roadmap/Review-Convergence-And-Harness-Alignment.md`](docs/roadmap/Review-Convergence-And-Harness-Alignment.md). No breaking changes.

> **E1 outcome:** accepted by the maintainer as good enough on real ships (2026-09-08). E2's ledger remains available if a number is ever wanted.

### Added — human surfaces for a terminal-first workflow (E6)

The methodology's read path assumed an IDE: a file tree to browse, a rendered markdown preview to read, an editor to type into. Working through a CLI coding agent removes all three, and browsing `conductor/` becomes a chain of `ls`, `cd` and `vim`. The diagnosis was that **the files are not the problem** — they are what make the autonomous loop, the evidence ledger and PR review work — but the *human's* channel to them was gone. Note the asymmetry that made it obvious: `src/loop/harvester.js` already gave the loop a ranked, typed view of the same folder the human had to read with `cat`.

So `conductor/` stays one source of truth and gains renderers. Design and decisions: [`docs/roadmap/Terminal-First-Human-Surfaces.md`](docs/roadmap/Terminal-First-Human-Surfaces.md).

- **`src/conductor-state.js`** — ONE read of `conductor/`, shared by every surface, and it **calls the harvester** rather than re-parsing the backlog. Two parsers would eventually disagree about the same file, and then neither surface would be trusted. Pure except a thin IO wrapper, so the digest is testable with no repo on disk. Adds what only a whole-folder read can produce: **backlinks** (which documents reference this one) and staleness.
- **`conductor status`** — the daily question in one screen: inbox depth, open tasks per priority, the queue in the order the loop would drain it, stale documents, loop state. Costs **zero tokens and zero context** — asking an agent to summarise state cost a full turn every time, for the question asked most often. `--json` for scripts, `--no-color` for pipes.
- **`conductor inbox add "…"` / `list`** — quick capture as a command. `Inbox: X` existed as a row in the always-on classifier and did not fire reliably, which is the expected outcome for prose competing for attention; appending a line to a file is mechanical, so it becomes code. The chat convention stays as the fallback. Capture **refuses to scaffold `conductor/`** outside an install rather than littering an unrelated repo.
- **`conductor view [--open]`** — renders every document into ONE self-contained HTML file (`conductor/.views/index.html`, gitignored): rendered tables, cross-document search, per-document outline, backlinks, light/dark, mobile. One file because the page is opened over `file://`, where the browser blocks runtime loading — so nav, search index and all rendered documents are stamped in at generation time — and because one file is one bookmark. `--open` shells to the platform opener (`wslview` on WSL, where `xdg-open` has nothing to open), and the command prints a clickable `file://` URL resolved for the platform the *browser* runs on — the `wsl.localhost/<distro>` UNC host under WSL, since a Windows browser cannot resolve `file:///home/...`. The `/view` shim tells the agent to relay that URL verbatim rather than build one. The page is invisible to `git status` and to `git add -A` (verified by asking `git check-ignore`), and the ignore entry is rewritten on every run so an older install self-heals. `--out <path>` is a deliberate override and gets no entry written for it, but it now **warns when that path is inside a repo and not ignored** — the one route by which a derived page could reach a commit.
- **`src/view/markdown.js`** — a dependency-free markdown renderer run at generation time, so the page ships no parser. Its contract is security: content in `conductor/` is written by the human, by agents, and through the inbox by whatever was pasted in, and the page runs from `file://`. Every character is escaped, raw HTML is shown as text and never passed through, and `javascript:`/`data:`/`vbscript:` URLs are neutralised. There is no trusted-markdown path.
- **`/status`, `/inbox`, `/view`** slash commands generated alongside the workflow shims — the first CLI-backed shims, distinct from the workflow ones.
- **`.agents/AGENTS.md`** routes "what's on our plate" to `conductor status` and puts the command first for capture — and the always-on bill went **down** 9 bytes doing it (16,442 → 16,433), with the ceiling ratcheted to match.

**Deliberately not done:** flattening the pipe tables out of 17 `conductor/` templates. That was planned while raw markdown was the only way to read them; once `conductor view` renders them, a table is dense and scannable rather than the hardest thing on the page. The state files that *are* read raw — `inbox.md`, `task-backlog.md`, `scratchpad.md` — have no tables and are pinned table-free by test.

### Fixed — `conductor status` read a loop field that does not exist

The loop line read a top-level `loop.beat`, which is not in the v2 `loop-state.json` schema (the counter is `iterations.current`), so the beat number never rendered. It also omitted **`phase`** — the field that decides whether the loop can run at all, since the driver refuses to start in `discovery`. It now shows `phase · status · beat n/max · autonomy`.

The bug survived its own test because the fixture was an invented shape rather than the shipped one. **The test now loads `templates/conductor/1-workbench/loop-state.json` itself**, so an invented shape can no longer satisfy it and a schema change fails loudly instead of silently blanking the line. A companion case asserts that a bogus top-level `beat` is *not* what gets read. Found while checking a documentation claim, which is the only reason it surfaced at all.

### Changed — documentation caught up with the shipped surface

- **`README.md`** gains a "Reading Your Project From a Terminal" section — `status`, `inbox`, `view`, why the page is one derived file, and the WSL URL caveat — plus a feature bullet. The commands existed but were invisible to anyone reading the repo.
- **`templates/CLAUDE.md`** no longer claims every slash command is a workflow shim. It now distinguishes workflow shims from the three **CLI shims** (`/status`, `/inbox`, `/view`), which have no workflow behind them, and warns against hand-building the `file://` URL.
- **`skills/context-engineering/SKILL.md`** — the reference `how-it-works.md` names for quick-capture *mechanics* — taught only the file-append path and so contradicted the classifier that routes to it. Now command-first, with a new "Reading State" directive. Rewritten to stay **under** its existing eager ceiling rather than raising it.
- **`docs/Running-The-Loop.md`** dropped "a human editing `conductor/` in VS Code" — the exact assumption this release removes — and now points at `conductor status` for previewing the fleet's queue and the loop's phase.
- Stale **V5** markers corrected to V6 in `how-it-works.md` and the self-test banner. `templates/CHANGELOG.md`'s footer is now version-agnostic, so it cannot drift again.

### Changed — the review gate now converges (E1)
- **`skills/independent-review/reviewer.md`** (new, 116 lines, capped at 130 by test): ONE self-contained reviewer brief, handed over verbatim, replacing a chain of five skills. `BLOCKER` / `IMPORTANT` / `NIT`; a **BLOCKER needs a quoted line and confidence ≥ 7**, and an unquotable finding is downgraded rather than promoted. `APPROVE` means **zero blockers**, not zero findings. The reviewer judges the acceptance criteria (or `goal_description`) plus `architecture-checklist.md` as a checklist, reports the whole class with its complete instance list, and carries an explicit "Not a finding" exclusion list.
- **`skills/independent-review/calibration.md`** (new): 7 graded cases pinning **both** drift directions — over-rejection (a false positive killed by the quote rule, criteria-met-but-more-could-be-built, a test-structure opinion) and under-rejection (a quotable defect with a one-line fix is still a BLOCKER, a reward-hacked test, an unsatisfied checklist item) — plus the `SCOPE:` case.
- **One capped delta round**, briefed with round-1 findings *plus the author's dispositions* and the fix commits' diff only; then a single batched question to the human. **No follow-up backlog from review** — a proven in-scope defect is fixed now or written into the PR body under "Known gaps". An unreviewed fix round is never escalated.
- **Proportionality:** Ship Phase 4 skips the subagent below 50 changed non-test lines *and* no risk path (auth, payments, migrations, API contracts, security, CI, hooks).
- The unbounded phrasings are gone: "look for the reason this is **not** done", "if unsure → reject", "Reviewer found issues = not done. No exceptions", "zero warnings".
- `personas/checker.md` and `workflows/loop-checker.md` adopt the same rubric (v2) and emit a `findings[]` verdict. **The driver's fail-safe on a missing or malformed verdict is unchanged.**

### Added — evidence freshness, context budget, review ledger (E2)
- **`conductor evidence run|check|list`** — verification evidence bound to a **working-tree content fingerprint**, so committing exactly the code that was tested keeps its evidence FRESH while an untracked new source file invalidates it. Transparency invariant: the child's exit code is always the wrapper's; every bookkeeping failure is a warning. `--expect-cmd` binds a label to the real suite; `--allow-paths` excuses release-file-only changes. Machine-local (`CONDUCTOR_HOME`) and per-branch.
- **`pre-push` now trusts FRESH evidence** instead of re-running the suite on unchanged content. Fail-safe: no CLI, no ledger, any doubt runs the command — the ledger can only *skip a redundant run*, never satisfy the gate. Measured live: 2.3s → 0.15s on a content-identical push, and a source change still re-runs.
- **`conductor context-bill`** + a CI **ratchet** — Progressive Disclosure is now a number (16,442 bytes ≈ 4.4k tokens always-on) with a committed ceiling. Two ledgers (ALWAYS-ON vs EAGER); CI fails on growth past the fixture **and on a new skill or workflow with no budget entry**. Ceilings in bytes, exact and machine-independent; a 24 KB hard cap sits above the ratchet.
- **`conductor review-log append|summary`** — records each review finding with its disposition and reports rounds to APPROVE, dismissal rate per class, and blockers by category. A class dismissed >50% of the time (n≥3) is flagged a **rubric suspect**: fix `calibration.md`, not the author.

### Added — the agent layer is now testable (E3)
- **The rubric-v2 evidence bar enforced in `src/loop/checker.js`**, not just in prose. A malformed BLOCKER never becomes an approval (it stays a rejection); `approved:true` while listing a BLOCKER is self-contradicting and fails safe; `approved:true` with only IMPORTANT/NIT still approves. The bar buys a **diagnostic** — an evidenced rejection is now distinguishable from a Checker rejecting on vibes.
- **`npm run eval:routing`** (`CONDUCTOR_EVALS=1`) — the first test here that says anything true about agent behaviour. Spawns a real `claude -p` and grades routing exactly. Two suites: `classifier` (the table is the artifact) and `descriptions` (**the table is removed**, so a regressed description can actually fail — gstack shipped this suite with the answer key in the fixture and found it could not fail). Negative controls graded. `eval:routing:sensitivity` mutates the fixture and **inverts the exit code**: a green eval proves nothing unless it can go red.

### Security — untrusted trigger input can never gain authority (E4)
- **Trust comes from authorship, not transport.** A third-party trigger source with no operator-level `author_association`, or any payload setting `"untrusted": true`, is untrusted and forced to the **L1 no-merge floor** via `clampAutonomy` (de-escalation only, so a lower operator ceiling still wins). An operator-configured transport (`cron`, CI, the CLI) keeps full trust.
- **Trust envelope** on untrusted goal/context: always wraps, labels injection-matching lines `[INJECTION-PATTERN]`, folds fullwidth/zero-width evasion **for matching only** (emitted text is never rewritten), and defuses a forged copy of the banner with a ZWSP.
- **Tool allowlist, never a blocklist** — `Read Edit Write Glob Grep TodoWrite`; no `Bash`, no `WebFetch`, no `WebSearch`. Every published bypass of this agent class defeated a blocklist.
- **`conductor trust-verify`** — the Stop hook bypasses the permission system, so it now runs only the verification command the operator recorded (realpath + `sha256`, 0600 store, append-only grant log). Editing the command invalidates trust. Untrusted **fails open** with a note; `pre-push` still enforces the Iron Law where the operator typed `git push`. Stop-hook re-entry is bounded at 3 blocks, then releases with a loud `UNVERIFIED` warning.
- Context: Feb 2026 turned one malicious Cline issue *title* into an npm supply-chain compromise; April 2026 disclosed the same shape in Claude Code's security-review action (CVSS 9.4), Gemini CLI Action and Copilot's coding agent.

### Added — drift gate for `.agents/`, and a descope (E5)
- **`test/template-integrity.test.js`** (60 assertions): registry ↔ disk both ways, non-empty descriptions, **path-level reachability** (excluding `registry.json` and `check-conductor.sh` — inventories, not routes), link validity, skill frontmatter, and host-path containment.
- **Two real bugs it found:** `agentic-flow.md` shipped in every install and was documented but had **no classifier trigger**, so "design a flow" could never reach it; `loop-checker.md` and `unattended-loop.md` had **empty registry descriptions**. Both fixed.
- **E5's per-host compiler was descoped on evidence.** gstack needs one because it hardcodes `~/.claude/skills/gstack`; Conductor installs `.agents/`, so it is host-neutral by construction — 5 legitimate Claude integration points and 3 "Task tool" mentions that already carry platform fallbacks. Both properties are now pinned by tests. **Model overlays are deferred, not dismissed** (no injection point yet).

### Known gaps
- The context bill counts only `SKILL.md` per skill directory, so `reviewer.md` and `calibration.md` are unbilled eager cost. Fix: count sibling `.md` files, re-capture.
- Ship Phase 4 does not yet cite FRESH evidence instead of re-running; only `pre-push` consumes the ledger.

---

## [6.2.0] — 2026-07-24 — Loop Robustness, Multi-Engine & the Eval-Driven Law

Hardens the V6 autonomous loop from a working prototype into something trustworthy (borrowing proven patterns from the `agentctl` peer factory), brings real **multi-engine parity** (Claude Code + Antigravity `agy` + `codex`, each verified against the installed CLI), and adds the **Eval-Driven Law + ship-contract** — the "tests ≠ evals" discipline, enforced deterministically like TDD. No breaking changes; `conductor upgrade` lands every new skill and hook on existing installs (verified end-to-end, with a backup written first and all `conductor/` knowledge preserved).

### Added — Eval-Driven Law + the ship-contract
- **The Eval-Driven Law**, enforced in two stages like TDD: a `pre-commit` **presence** gate blocks provider-calling code (`openai`/`anthropic`/`langchain`/…) staged without an evalset (`evals/…` or `*.eval.*`); a `pre-push` **run** gate runs the configured `eval` command (`conductor.config.json` `"eval"`) and blocks on failure. Independent from the TDD gate — waiving one never skips the other. Escape hatches `CONDUCTOR_NO_EVAL` / `CONDUCTOR_SKIP_EVAL`, both waiver-logged. Detection is gated to impl files, so docs/config that merely *name* a provider are never flagged.
- **`writing-evals` skill** — the how-to: three grading modes (rubric/LM-judge, property/assertion, reference) so "no labelled data" is never an excuse. A skill, not an always-on rule (evals matter only to LLM-feature projects).
- **`architecture-checklist` skill + the ship-contract** — turns "follow the architecture" into checkable items (deterministic `check:` shell commands or Checker-verified), produced by `technical-vision`/`carve`, verified by `loop-checker` + `independent-review`. The ship-contract has two halves: deterministic (TDD/Eval hooks + `check:` items) and semantic (the Checker).
- **Judge calibration (Level C)** — every LLM-judge surface (`judge-panel`, `loop-checker`, `independent-review`, `behavior-validator`) carries a `Rubric vN` stamp; `judge-panel` documents the Calibration discipline (version the rubric, spot-check against human judgment, diverse lenses). New `test/hooks-eval-gate.sh` (12 behavior cases) via `npm run test:hooks`. Design: `docs/roadmap/Eval-Driven-Law.md`.

### Added — Multi-engine parity (Claude Code + `agy` + `codex`)
- The loop's adapter layer now works against the **real** `agy` (Antigravity 1.1.6) and `codex` (0.145.0) CLIs, with every flag verified against the CLI — not guessed. **`agy`** (proven end-to-end on a live L1 run): correct binary (`agy`, not `antigravity`), `--print`/`--mode`, headless auto-approval, and `--add-dir` to anchor its workspace to the loop worktree. **`codex`**: `codex exec -s workspace-write` so the Checker can write its verdict. Flag mappings are unit-tested (`mapMode`/`beatArgs`).
- **Sandbox finding:** `agy --sandbox` blocks the agent from operating, so `sandbox: cli-native` + `agy` is refused with guidance to use `container`; `codex` is confined by construction (`workspace-write`).

### Added — Autonomous loop hardening (Loop Robustness Plan)
- **P0 data-loss fixes** — a commit-before-verify backstop (`autoCommit`), a teardown dirty-guard, and verify-against-committed, so a Maker that forgets to commit never loses its work (the original live-run failure). Plus an **empty-done guard**: a done-claim on a branch with no committed work re-prompts instead of opening an empty PR.
- **Fleet Bridge** (`conductor loop --from-conductor`) — drains `conductor/` inbox + backlog into a routed work queue and reflects results back (claim → done → PR), so the interactive dashboard and the autonomous fleet share one source of truth.
- **cli-native sandbox** — L3 runs in the CLI vendor's own sandbox (Anthropic bubblewrap for `claude`), no maintained Docker image required.
- **Resume discipline** — a killed run resumes without stranding worktrees; **cross-run self-improvement** mines the ship-log for recurring failures and proposes rules (propose-only). The isolated Maker is conductor-enabled even when the scaffold is gitignored. Design + status: `docs/roadmap/Loop-Robustness-Plan.md`.

### Added — Skill catalog audit + Reference Library
- Skill catalog streamlined (37 → 29) against a coherent-responsibility bar; four advice docs demoted to a new `.agents/references/` library (still discoverable via `how-it-works.md`). `upgrade` now prunes framework-owned skills dropped upstream while keeping registry-imported and hand-authored ones (ownership via the checksum manifest; `test/update-prune.test.js`).

### Added — `deepen` brownfield architecture workflow
- The brownfield counterpart to `technical-vision`: finds shallow/scattered modules in an existing codebase and reshapes them into deep modules with narrow interfaces — characterization-test-first + Strangler-Fig. Driven by the Code Archaeologist persona.

### Fixed
- **Dry-run purity + lock ordering** (`conductor loop`): all disk writes deferred until after the one-loop lock, so `--dry-run` never mutates state and a second invocation can't rewind a live run's on-disk tasks.
- **Checker write-capability, merge, and cross-process safety** — the independent Checker runs write-capable (not read-only `plan`); PR reuse on contention; `--force-with-lease` fallback on a stale loop branch; per-task verification for concurrent swarm tasks.

### Added — Loop ignition contract (time-based & proactive loops)
- **`conductor loop --goal "<text>"` and `--event <file.json>`** — an external trigger can now seed the loop's goal, turning the goal-based driver into the **time-based** and **proactive** loops of Anthropic's Loop-Engineering taxonomy *by composition*. Conductor deliberately ships **no scheduler of its own** — drive `conductor loop` from Claude Code's native `/schedule` or host `cron` (time-based), or from a webhook/CI shim that writes an event payload (proactive). Rationale and the full four-loop readiness map: `docs/roadmap/Loop-Engineering-Alignment.md`.
- **`src/loop/trigger.js`** (pure) — `parseTriggerPayload` (a JSON object *or* a bare goal string), `applyTrigger` (seeds `goal_description`/`phase`, records provenance), `clampAutonomy`, `renderTriggerDoc`. Covered by `test/loop-trigger.test.js` (11 `node:test` cases).
- **Safety — autonomy clamp.** A trigger payload may originate from untrusted input (a Slack message, a GitHub issue body). It may set the goal/phase/context and may *request* an autonomy level, but the level is **clamped to the operator ceiling already in `loop-state.json`** — a trigger can de-escalate but **never escalate**. Privilege stays with the operator, not the event.
- **Auditability.** The seeded goal + provenance persist to the Spine (`loop-state.json.last_trigger`), the run's brief is written to `conductor/1-workbench/loop-trigger.md` (data for the Maker, never spliced into driver control flow), and the trigger — including any refused escalation — is logged to `0-compass/ship-log.md`. `--dry-run` previews all of it without mutating state.

### Documentation
- **`how-it-works.md`** gained a **"Four Loop Types"** section mapping each rung (turn / goal / time / proactive) to the Conductor primitive that serves it — including that Conductor's deterministic TDD/verify **git hooks** are one rung *stronger* than the guide's "encode verification in a `SKILL.md`" (a hook is code the agent cannot reason around).
- **`README.md`** documents the ignition contract in the Autonomous Loop Backend section.

## [6.1.0] — 2026-07-15 — Multi-Agent Across Workflows

Brings the V6 loop backend's multi-agent capability to the everyday workflows — retro-compatibly and proportionately. Two mechanisms recur: **empty-context** agents (a reviewer/verifier that never saw the producing context, for honest judgment) and **parallelization** (independent sub-tasks in isolated contexts, merged). Every enhancement degrades gracefully — an isolated subagent when the platform supports one, else a deliberate fresh-context self-pass or sequential inline work — and each gate is one-per-artifact, never per-step. Two new reusable primitives (`independent-review`, `judge-panel`) that the rest of the framework composes with. No breaking changes; `conductor upgrade` lands the new skills on existing installs.

### Added — Independent-review gate for blueprint artifacts
- **`independent-review` skill (`.agents/skills/independent-review/SKILL.md`)** — Ship Phase 4's fresh-context Maker/Checker gate, extracted into a reusable primitive: a reviewer that did *not* produce the artifact returns a binary `APPROVE`/`CHANGES REQUESTED` verdict before the artifact is saved or handed off, with a fix loop and per-artifact review lenses (PRD, architecture, spec+plan, carve slicing, diff). Retro-compatible — spawns an isolated subagent when the platform supports one, else degrades to a deliberate fresh-context self-pass; one gate per artifact, not per step.
- **Wired into the blueprint workflows** — Grand-PRD, Technical-Vision, Spec-It, and Carve now run the gate before writing their artifacts, closing the gap where blueprint specs/architectures were saved with no independent review (unlike shipped diffs, which already had Ship Phase 4). Technical-Vision routes the reviewer to a strong model tier given the artifact's downstream leverage.
- **Ship Phase 4** now references the skill as its reference implementation (single source of truth for the gate's mechanics); behavior unchanged.
- Registered in `registry.json` (core bundle), the self-test (`check-conductor.sh`), and `how-it-works.md`.

### Added — Judge-panel decision primitive
- **`judge-panel` skill (`.agents/skills/judge-panel/SKILL.md`)** — divergent-then-convergent decision-making for wide, hard-to-reverse forks: generate N candidates from deliberately different angles (simplest-that-works / risk-first / leverage-first), score them with independent judges against fit / simplicity / risk / evolvability / team-fit, then synthesize the winner while grafting the best of the runners-up. Opt-in (only when the space is genuinely wide); retro-compatible (parallel isolated authors when a subagent primitive exists, else sequential in-context divergence, floor of two real candidates). Guards against divergent generation's bias toward cleverness — simplicity breaks ties and the deletion test is mandatory on the synthesis.
- **Wired into Technical-Vision Phase 3 (architecture)** as an opt-in method; composes with the independent-review gate (the panel *produces* the architecture, the gate *checks* it). Registered in `registry.json`, `check-conductor.sh`, and `how-it-works.md`.

### Changed — Scouts & fresh-context gates across the remaining workflows
- **Genesis** (Phase 0 context scan) can fan out **parallel scouts** (prior `conductor/` docs, relevant code, prior art in the problem space) when there's real ground to cover — keeping raw file dumps out of the interview thread; kept at Genesis's problem/capability altitude (no tech-stack eval). Skip inline for greenfield.
- **Spec-It** (Phase 0) gains a **codebase-inventory scout** — the blueprint says *what* to build; the scout reports *what already exists* (files to change, utilities/patterns to reuse) so the spec's Dependencies and the plan's Files & Components are grounded in reality, not guesses.
- **Retrospective** (Phase 1) can **mine evidence in parallel** (git history, tracker evidence column, ship-log, trace, CI logs) so Phase 2's lessons are concrete facts, not memory — and a fresh-context read resists rationalizing one's own work.
- **UX/UI Design Brief** — Phase 2 offers **2–3 divergent navigation options** (human as judge) when the nav pattern is genuinely contested; Assembly adds a **fresh-context design gate** (independent-review with a `ux-reviewer` lens against the Design System), the design-flavored sibling of the blueprint review gate.
- **Build** — documented that parallel execution of independent tasks is the **swarm's** job (unattended, L3), not interactive Build, whose one-task-at-a-time rule deliberately preserves per-task human oversight.

### Added — TDD test-author → implementer split (opt-in, swarm)
- **`src/loop/swarm.js`** grew an opt-in two-phase task lifecycle: a **test-author** writes the failing tests first (the contract), then a separate **implementer** in its own context makes them pass and is forbidden to touch the tests — making reward-hacking structural (the agent that greens the code can't move the goalposts it didn't write). Enabled by `state.tdd_split` (swarm-wide) or a task's `contract_first` (per-task override); off by default. The contract phase's success is **RED** (a green suite before any implementation is a vacuous contract and is rejected); once RED is confirmed the implementer takes over. New `test-author` role archetype; the implementer reuses the `maker` archetype, so the implementation phase resolves **identically** to the non-split path — `concurrency=1` with the split off reproduces the pair exactly (regression guard holds). `normalizeState` carries `tdd_split`; `runBeat` forwards `role`/`phase` to the adapter.
- **Prose:** `unattended-loop.md` documents the two per-beat roles; `test-driven-law.md` gains an *interactive vs. unattended* section (the tight one-mind loop stays the interactive default — the split is unattended-only); `model-routing` notes test-author needs strong spec comprehension. Covered by 4 new `node:test` cases (76 total).

### Changed — Independent Checker at Build's batch checkpoint
- **`build` Phase 2 (Checkpoint)** now runs the `independent-review` gate (Diff lens) once per **batch** — a reviewer that did not write the batch checks spec compliance, quality, and whether the new tests are meaningful or reward-hacked. Closes the gap where Build's only review was the Maker's per-task **self**-review (Step 4), with no independent eyes until Ship. Proportionate (skip for small low-risk batches where the human at the checkpoint is the fresh reviewer; one gate per batch, never per task) and non-duplicative (at L3 the driver's out-of-process Checker already covers each beat — this is the interactive equivalent). Step 4 is reframed as the Maker's self-review, symmetric with Ship's Empathy Audit split.

### Changed — Parallel hypothesis testing in systematic-debugging
- **`systematic-debugging` Phase 3 (Understand)** now supports fanning out **one empty-context scout per hypothesis** when there are 3–5 genuinely independent, non-trivial hypotheses: each scout gets only the red command, its one assigned hypothesis, and the kill-criterion, and runs in its own isolated context (a separate worktree if it instruments code) so probes never confound each other and no scout anchors on another's theory. The orchestrator merges verdicts (one survivor → 5 Whys; none → completeness pass + fresh set; several → compound cause) and **re-confirms against the red command before trusting any scout** (Verification Iron Law). Sequential one-at-a-time remains the default and the graceful-degradation floor; new anti-patterns guard against confounded shared-tree probes, trusting an unverified scout, and fanning out a one-liner.

## [6.0.0] — 2026-07-14 — V6 Enforcement & Autonomy Rebalance

Implements `docs/adr/0001-enforcement-and-autonomy-rebalance.md`. The autonomy-backend (deterministic loop driver, adapters, sandbox/isolation, autonomy slider, swarm) is now built — see `docs/roadmap/Autonomous-Loop-Backend.md`; only a published/maintained turnkey sandbox image and a real-LLM CI run remain.

### Added — Robust cross-version upgrade (V4/V5/unversioned → 6.0.0)

`upgrade` was reworked on one principle: **`conductor/` project knowledge is preserved; `.agents/` methodology is replaced.** See `docs/roadmap/Robust-Upgrade-Migration.md`.
- **Version stamp** (`src/version.js`) — `init`/`upgrade` write `.agents/.conductor-version.json` (framework version read from `package.json`), making upgrades version-aware and idempotent. Unstamped installs are detected by structure (V4 vs V5).
- **Backup-first + rollback** (`src/backup.js`) — the existing `.agents/`, `conductor/5-templates/`, migrated legacy folders, and `loop-state.json` are copied to a git-ignored `.conductor-backup/<timestamp>/` before any change; a mid-run failure auto-restores.
- **Ownership-based replacement** (`src/update.js`) — framework-owned files (anything shipping in `templates/**`) are now **replaced wholesale** (the old checksum-gated `SKIP` that silently kept stale/edited instructions — and silently no-op'd checksum-less V4 installs — is gone). User-authored additions are carried forward; core rules/workflows/skills (incl. the new interview/drafting/handoff primitives) always land even if absent from a stale `.selections.json`.
- **`conductor/5-templates/` refresh** — framework document scaffolding is refreshed on upgrade; user knowledge folders (`0-compass`, `2-backlog`, `3-product-areas`, `4-context`, `6-archive`) are never touched.
- **Managed platform stubs** (`src/stubs.js`) — `CLAUDE.md`/`GEMINI.md` now wrap their framework portion in `<!-- conductor:managed:begin/end -->` markers. `upgrade` refreshes only that block (so the stub header, `/loop`, and slash-command sections stay current) while preserving anything you write outside it; legacy stubs with no markers get the block inserted and their old content preserved below. `CHANGELOG.md` remains create-if-absent — it's your project's changelog, not the framework's.
- **Loop-state schema migration** — `loop-state.json` is migrated to the current schema during `upgrade` (reusing the driver's `normalizeState`), no longer only lazily on first run.
- **Safer kebab engine** (`src/kebab.js`) — renames only framework-scaffolded names (numbered folders, not arbitrary user files), no longer silently clobbers on collisions, and leaves canonically-cased files (`Dockerfile.sandbox`) alone.
- **`--dry-run`** prints the full plan and writes nothing; **`--no-backup`** opts out of the backup.
- Covered by `test/upgrade.test.js`.

### Changed
- **Version → 6.0.0.**

### Added
- **Deterministic enforcement hooks (D1)** — `.agents/hooks/` ships a Test-Driven-Law `pre-commit` (blocks implementation changes with no test change) and a Verification-Iron-Law `pre-push` (blocks a push whose verification command fails). Logged escape hatches (`CONDUCTOR_NO_TEST`, `CONDUCTOR_SKIP_VERIFY`, `CONDUCTOR_HOOKS=off`) and an opt-in interactive Claude Code Stop hook. Wired by the new `conductor install-hooks` command, auto-run by `init`/`upgrade` in a git repo. Prose laws are now backed by code.
- **Claude Code slash-command bridge (D5)** — `init`/`upgrade` generate `.claude/commands/<name>.md` shims per workflow, so `/build`, `/carve`, `/spec-it`, … work natively in Claude Code. Derived from the installed workflow set; stale shims pruned by marker; foreign commands preserved.
- **`domain-modeling` skill (D6)** — active ubiquitous-language discipline producing a living `conductor/4-context/meta/domain-model.md`; wired into Technical Vision (name the domain before the data model).
- **`subagent-isolation` skill** — the scout pattern: delegate read-heavy discovery, parallelize independent investigations, isolate mutating work in worktrees.
- **`model-routing` skill** — match model tier + reasoning effort to task difficulty.
- **Registry supply-chain scanning** — `conductor add` scans downloaded `SKILL.md` for prompt-injection/secret/dangerous-shell patterns; critical findings block install unless `--allow-unsafe`.

### Added — Autonomous Loop Backend (`conductor loop`, Phases 1–4)
- **Deterministic driver (Phase 1)** — `conductor loop` subcommand over a pure, testable state machine (`src/loop/driver.js`): the host runner owns the iteration ceiling, wall-clock budget, driver-observable stall detection (git HEAD + verify output), the Evidence Rule (verification exit code forces the verdict), the Scoping Barrier, and fail-safe verify resolution (mirrors the pre-push hook's `conductor_verify_cmd`). `loop-state.json` schema v2 (auto-migrates v1 on load). Replaces the V5 `scripts/run-conductor-loop.js` stub (deleted).
- **Platform adapters (Phase 2)** — the driver is platform-agnostic; registry/resolver (`src/loop/adapters/`) with **Claude Code** (primary), **Antigravity**, and **Codex** adapters. Selection: `--platform` → `loop-state.json.platform` → auto-detect.
- **Isolation (Phase 3)** — git-worktree isolation for the Maker; the independent **Checker as a separate process** (verdict via `checker-verdict.json`, fail-safe reject); document-only sandbox gate (`sandbox: none|container` + `templates/.agents/sandbox/`; L3 refused without a container → `halted_sandbox_required`).
- **Autonomy slider + merge + swarm (Phase 4)** — L0–L3 enforced in the driver (L0 interactive-only, L1 single-beat → `awaiting_review`, L2 blueprint-only, L3 execution); **PR-gated merge** via `gh`/`glab` (never a direct push); auditable action trail to `0-compass/ship-log.md`; **multi-vote adversarial Checker** (`checker_votes`, majority); and the opt-in **swarm** (`src/loop/swarm.js`: task-graph blackboard, frontier scheduler, specialized roles, concurrent Makers, serialized PR-gated merge queue). `concurrency=1` reproduces the pair exactly.
- **Maker completion signal** — the Maker writes `maker-signal.json`; the driver reads it from disk (never trusts clobberable in-memory state), symmetric with the Checker verdict.

### Added — Interview & Drafting Primitives (Pocock alignment)

Draws from [Matt Pocock's skills](https://github.com/mattpocock/skills) where it sharpens ours, keeping Conductor's stronger stances where they diverge. See `docs/roadmap/Pocock-Alignment-Backlog.md`.

- **`grilling` skill** — the interview primitive (one question at a time, recommend an answer to each, look facts up instead of asking, one convergence gate). Single source of truth for the interview technique.
- **`collaborative-drafting` skill** — the drafting primitive (lead with a complete draft the human corrects: propose → discuss → coverage-check → confirm). The document-scale counterpart to `grilling`.
- **`handoff` skill** — compact a conversation into a self-contained handoff doc before leaving the ~120k-token "smart zone"; reference artifacts by path, redact secrets. Includes loop context-hygiene guidance.

### Changed — interview/blueprint workflows onto primitives

- **Genesis, Storyboard, Grand PRD, UX/UI Design Brief** rewritten to supply only their *agenda* + templates and load `grilling` + `collaborative-drafting` for the *how* — deleting duplicated Communication-Style blocks, ~14 per-phase Advancement Gates, and Stage-Setting scripts (the UX/UI Brief went 448→90 lines, 7 gates → 1 at save).
- **Spec-It** reworked to **synthesize, not re-interview** (Pocock `to-spec`): drafts specs from the locked blueprint context and grills only genuine gaps; added a Testing-Decisions/seams element feeding Build's TDD.
- **Quick-Path, Retrospective, Technical Vision, Carve** now reference the primitives instead of restating the interview inline.
- **`tdd-cycle`** — agree test seams first (highest useful seam, ideal one), vertical slices, and anti-pattern tells (implementation-coupled / tautological / horizontal). Kept our mandatory in-loop REFACTOR (stronger than Pocock's defer-to-review).
- **`code-review`** — Stage 2 gains a fixed **Fowler smell baseline** + "the repo overrides / skip what tooling enforces." Kept our sequential spec→quality gate (not Pocock's parallel two-axis).
- **`systematic-debugging`** — "build a command that goes red on *this* bug first" as the prime move, a ranked repro-method ladder, 3–5 ranked falsifiable hypotheses, and write-the-regression-test-before-the-fix.
- **`technical-vision`** — the deep-module **deletion test** for module boundaries and the **ADR 3-test gate** for when to record a decision.
- **`ship`** — merge/rebase-conflict discipline (recover intent from primary sources, never reflexively `--abort`).

### Changed
- **Carve** — tracer-bullet first-slice guidance (walking skeleton over foundation-first) and a ubiquitous-language naming rule.
- **`unattended-loop` / `loop-guardrails` reconciled** — the soft layer no longer performs driver-owned bookkeeping (iteration/stall counters, `maker_active`, in-context Checker); the driver is the authority, the prose is guidance.
- **`loop-guardrails` demoted (D2)** — from `always_on` to loop-scoped; loaded explicitly by the `unattended-loop` workflow, so interactive sessions don't pay for it.
- **Refactor at review stage (D10)** — `code-review` Stage 2 gains a cross-cutting refactoring pass that complements (never replaces) the mandatory per-increment REFACTOR in the TDD loop.

### Tests
- Self-test grows to 113 checks (new skills incl. the interview/drafting/handoff primitives, enforcement hooks, slash-command bridge, loop backend + v2 schema).
- `node:test` unit suite (`npm run test:unit`, 72 cases — loop driver/adapters/isolation/autonomy/merge/swarm + cross-version upgrade + managed stubs; no agent CLI spawned) and an end-to-end smoke test with a fake agent (`npm run test:smoke`).

---

## [4.2.0] — 2026-03-12

### Changed
- **`.conductor/` wrapper** — All numbered folders (0-Compass through 6-Archive) now live inside `.conductor/` for a clean project root. Updated all 16 framework files.
- **`ai-init.md` → `AGENTS.md`** — Renamed to industry-standard convention and moved to `.agent/AGENTS.md`. Removed `.agent/rules/` folder.
- **Platform stubs** — Created `GEMINI.md` and `CLAUDE.md` at root for auto-discovery by platform-specific AI tools.
- **Build Phase 4 (Ship & Close)** — Rewritten with 6 structured steps. New "Document to Platform" step detects git hosting via CLI auth and handles: issue updates/closing, release notes, wiki/documentation updates.

### Added
- **NPX installer** — `npx conductor-framework init` scaffolds the full framework. Supports `--force` and `--agent-only`.
- **README.md** — Package README with install instructions and credits to all source frameworks.
- **Dynamic Skill Loading** — Parked as backlog item for V5.

---

## [4.1.0] — 2026-03-12

### Added
- **4 New Personas** — Code-Archaeologist (legacy code expert), Security-Auditor (OWASP + pentest), Database-Architect (schema & queries), Performance-Optimizer (Core Web Vitals)
- **Architecture-Patterns skill** — Pattern selection, trade-off analysis, context discovery (5 files)
- **Skill sub-files** — Frontend-Design (+7 guides: color, typography, animation, UX psychology, visual effects, motion, decision trees), Systematic-Debugging (+5 files: root-cause-tracing, condition-based-waiting, defense-in-depth, find-polluter.sh)
- **Self-test script** — `bash .agent/tests/check-conductor.sh` validates entire framework structure
- **Selective Skill Loading rule** — Read SKILL.md first, then only sub-files matching the task

### Changed
- **`ai-init.md`** — Added 4 new persona triggers and selective loading rule
- **`How-It-Works.md`** — Updated registries (10 personas, 27 skills) and added self-test section
- **`Conductor-Assistant.md`** — Updated with full V4.1 knowledge

---

## [4.0.0] — 2026-03-12

### Added
- **Designer persona** — Visual perfectionist with Stitch MCP integration
- **7 Design skills** — Design-Md, Enhance-Prompt, Stitch-Loop, React-Components, Shadcn-UI, Remotion, NotebookLM-Research
- **9 Engineering skills** — Systematic-Debugging, Clean-Code, Testing-Patterns, Frontend-Design, Documentation-Templates, Deployment-Procedures, I18n-Localization, Lint-And-Validate, Git-Worktrees
- **3 Git skills** — Git-Workflow (conventions), GitLab-CLI (glab), GitHub-CLI (gh)
- **Naming convention rules** — Title-Case-Kebab standardized across the framework
- **Git commit step** in Build workflow (Step 5: commit after each verified task)
- **PR/MR creation** step in Build Phase 4 (Ship & Close)

### Changed
- **`ai-init.md`** — Added Designer persona routing and git routing
- **`Build.md`** — Added git commit step (Step 5) and PR/MR creation in Ship & Close
- **`How-It-Works.md`** — Updated with all V4 registries (6 personas, 26 skills)
- **`Conductor-Assistant.md`** — Updated with full V4 knowledge

### Removed
- **`design-kit/`** folder — Contents moved into `.agent/personas/` and `.agent/skills/`

---

## [3.0.0] — 2026-03-12

### Added
- **Build workflow** — The missing execution phase. 5 phases: Setup, Execute Batch (with two-stage review), Checkpoint, Final Verification, Ship & Close
- **Quick-Path workflow** — Fast-track for standalone implementations. Skip Genesis/Storyboard when scope is clear
- **Retrospective workflow** — Post-shipping feedback loop. Extract lessons, update knowledge base
- **Verification-Gate skill** — Enforces the Iron Law: "No completion claims without fresh evidence"
- **Task-Tracker skill** — Live task tracking during Build execution
- **Code-Review skill** — Two-stage review: spec compliance first, then code quality
- **Context-Updater skill** — Keeps Product Area and Context files alive after builds
- **Request Classifier** in `ai-init.md` — Routes requests by type before any work starts
- **User guidance** ("🧭 Not sure?") in `ai-init.md` — Helps confused users choose the right workflow
- **Verification Iron Law** as a global rule in `ai-init.md`

### Changed
- **`ai-init.md`** — Rewritten from encyclopedia (106 lines) to routing contract (~100 lines)
- **`Technical-Vision.md`** — Expanded from 95 to 231 lines. Added explicit Read directives, AI-proposes-first, exploration loops, gaps checks, CTO persona hook
- **`Carve.md`** — Expanded from 86 to 210 lines. Added priority execution order (P0→P3), explicit Read directives, dependency mapping, cross-reference checks
- **`Conductor-Assistant.md`** — Updated to know about all V3 capabilities
- **`How-It-Works.md`** — Rewritten to reflect V3 structure

### Fixed
- Stale path `4-AI-Brain/` → `4-Context/` in `UX-Reviewer/SKILL.md`

---

## [2.0.0] — 2025-01-30

### Initial Release
- Genesis, Storyboard, Grand-PRD, UX-UI-Design-Brief, Technical-Vision, Carve, Spec-It workflows
- CTO, Architect, Product-Manager, Tech-Lead, Conductor-Assistant personas
- Brain-Dump-to-Epics, System-Janitor, UX-Reviewer skills
- Folder = State kanban model
- Three-tier backlog system
