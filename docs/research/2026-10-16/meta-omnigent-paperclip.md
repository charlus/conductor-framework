# Meta-harnesses: Omnigent and Paperclip, compared with Conductor

Researched 2026-10-16 from primary sources (GitHub API, raw files, docs in each repo). No third-party code was cloned or run.

Evidence labels:
- MEASURED: a number from the GitHub API or a measured result the project publishes.
- IMPLEMENTED: seen in source code or in a config/doc that describes shipped code.
- CLAIMED: README or marketing statement, not checked against code.

Base URLs used below:
- OM = https://github.com/omnigent-ai/omnigent/blob/main/
- PC = https://github.com/paperclipai/paperclip/blob/master/

## 0. Verdict first

- Both repos are confirmed. Omnigent is `omnigent-ai/omnigent` (Databricks-led). Paperclip is `paperclipai/paperclip` (Paperclip Labs, Inc.).
- Neither one competes with Conductor's layer 1 (methodology) or layer 2 (git-hook enforcement). Both are methodology-neutral plumbing. Each ships only thin prose skills.
- Both overlap with, and are much larger than, Conductor's layer 3 (`conductor loop`). Omnigent overlaps with the Maker/Checker swarm and the sandbox. Paperclip overlaps with the backlog/heartbeat/human-surface side.
- Conductor's layers 1 and 2 can run INSIDE either product today, with no Conductor change, because both launch the real `claude` CLI in a git working directory. Git hooks fire on every commit made there. There is one concrete risk: Paperclip passes `--setting-sources user` on managed AI connections. That would drop Conductor's project-level Claude Code `PreToolUse` hooks (see 3.2).
- Neither one verifies work deterministically by default. Omnigent's Polly uses a different-vendor LLM reviewer plus an orchestrator that runs the gates. Paperclip uses review/approval stages and an LLM "task watchdog". Conductor's Evidence Rule (exit code, ledger fingerprint) has no equivalent in either.

## 1. Omnigent

### 1.1 Identity and maturity

| Fact | Value | Label | Source |
|---|---|---|---|
| Repo | omnigent-ai/omnigent, created 2026-06-11, last push 2026-10-16 | MEASURED | `gh api repos/omnigent-ai/omnigent` |
| Stars / forks / open issues | 10,841 / 1,755 / 2,131 | MEASURED | same |
| Commits on main | about 4,923 | MEASURED | commits API, last-page count |
| Contributors | about 280 (incl. anonymous) | MEASURED | contributors API |
| Merged PRs | 4,909 | MEASURED | search API |
| Releases | weekly cadence, v0.9.0 (2026-08-11) to v0.18.0 (2026-10-13) | MEASURED | releases API |
| Status | "alpha" badge | CLAIMED | OM README.md |
| License | Apache-2.0 | MEASURED | API |
| Language | Python 3.12+ server/runner, React web, Electron desktop, iOS/Android shells | IMPLEMENTED | repo tree (`web/electron`, `web/ios`, `web/android`) |
| Backer | Top contributor PattaraS lists Databricks. Databricks is the default install extra, with Databricks Apps / Lakebase deploy targets. Press reports Databricks launched it in June 2026, with a managed beta on Databricks workspaces | IMPLEMENTED (extra) / CLAIMED (press) | OM README.md; https://www.opensourceforu.com/2026/06/databricks-launched-omnigent-an-open-source-meta-harness-for-ai-agents/ ; https://itbrief.co.uk/story/databricks-launches-open-source-omnigent-for-ai-agents |
| Business model | Open source. Likely revenue path is the managed Databricks offering. No pricing page found | CLAIMED / inferred | press above |
| Telemetry | on by default, opt-out | CLAIMED | OM README.md#telemetry |
| Agent-authored commits | the bot `omni-resolve-agent[bot]` has 291 commits | MEASURED | contributors API |

### 1.2 Problem and audience

A "common orchestration layer over Claude Code, Codex, Cursor, OpenCode, Hermes, Pi" and custom YAML agents. It lets the user swap harnesses, enforce policies and sandboxing, and share or co-drive sessions from terminal, browser, phone or desktop (CLAIMED, OM README.md). The audience is individual developers and enterprise platform teams, and Databricks customers in particular.

### 1.3 Architecture

- **What it wraps** (IMPLEMENTED). Native terminal wrappers `omnigent claude|codex|cursor|agy|opencode|hermes|pi` run the vendor CLI inside tmux. SDK harnesses (`claude-sdk`, `codex`, `openai-agents`, `cursor`, `copilot`) and ACP agents (Grok Build, Devin, generic `acp:`) are also supported. Sources: OM README.md, OM examples/polly/config.yaml.
- **Claude Code launch** (IMPLEMENTED, OM omnigent/harnesses/claude_native/main.py, `_claude_terminal_request`):
  - It runs the real `claude` binary in a server-managed terminal whose `cwd` is pinned to the launch directory (`"cwd": str(Path.cwd().resolve())`).
  - `augment_claude_args` adds a `PermissionRequest` command hook that long-polls the Omnigent server, so approvals appear as web cards. It also adds `--append-system-prompt` with the agent YAML's instructions.
  - On SDK paths it adds `--strict-mcp-config --mcp-config`.
  - I found no `--setting-sources` flag in the claude_native harness files.
- **Process model** (IMPLEMENTED). A server (`omnigent server`, local on :6767 or deployed via Docker/K8s/Render/Fly/Modal/Cloudflare/Databricks Apps) plus "hosts" (runners) that register with it. Sessions run on a host or in a per-session managed cloud sandbox: Modal, Daytona, E2B, K8s, OpenShell, microsandbox and others. Sources: OM README.md §4, OM deploy/README.md.
- **State** (IMPLEMENTED). Machine-local runtime DB, logs, credentials and session state live under `~/.omnigent` (`chat.db`). The deployed server uses Postgres/CockroachDB/Lakebase. Sources: OM docs/DATA_DIR_LAYOUT.md, OM docs/COCKROACHDB.md. State lives in the tool's database, not in the repository.
- **UI**. Web (mobile-first), macOS desktop app, CLI/TUI. Sharing, co-drive (`omnigent attach`) and fork (`omnigent run --fork`). Source: OM README.md §5.

### 1.4 Unit of work

The unit is the **session** (a conversation with one agent plus its sub-agents, terminals and files). An agent is a YAML spec: prompt, executor/harness, tools (Python functions, MCP, sub-agents), policies, os_env/sandbox (IMPLEMENTED, OM docs/AGENT_YAML_SPEC.md). Recurring work runs as **automations** (scheduled tasks, RRULE schedule, optional `max_cost_usd` and managed sandbox per firing) (IMPLEMENTED, OM docs/AUTOMATIONS.md). There is no ticket, backlog or goal model. Polly keeps its own task list in `.polly/registry.json` inside the repo (IMPLEMENTED, OM examples/polly/config.yaml).

### 1.5 How humans steer and approve

- **Policies** return ALLOW / DENY / ASK at three levels: server (admin), agent spec (developer), session (user). Session rules are evaluated first. A DENY anywhere short-circuits. Builtins include `ask_on_os_tools`, `max_tool_calls_per_session`, `cost_budget` (hard cap plus ASK thresholds), `user_daily_cost_budget`, `github_policy` (write repos and branch globs), `block_working_dir_changes`, `risk_score_policy`, `deny_trivial_to_expensive_model`, `deny_pii_in_llm_request` and `enforce_sandbox`. Custom policies are Python functions or CEL (IMPLEMENTED, OM docs/POLICIES.md, OM omnigent/policies/builtins/).
- Agents can add policies on request in chat (CLAIMED, OM README.md §6).
- ASK cards appear in web, phone and desktop with OS notifications. Polly sets `ask_timeout: 86400` so an approval can wait a day (IMPLEMENTED, OM examples/polly/config.yaml).
- Known gaps, stated by the project:
  - Budget enforcement "does not interrupt an in-progress model turn: spend can overshoot" (OM docs/AUTOMATIONS.md).
  - "there is no agent-start policy phase today", so a DENY cannot block an agent launch (OM docs/POLICIES.md#enforce_sandbox).

### 1.6 How it verifies work

- **Platform**: no verification primitive. Verification is a pattern in the example agent Polly (OM examples/polly/).
- **Polly** (IMPLEMENTED as prompt plus skills, so its behaviour is prompt-level):
  - The orchestrator never writes code. Each implementer works in its own `git worktree add .worktrees/<task_id> -b polly/<task_id>`, drives to green, and opens its own PR.
  - The orchestrator runs "the deterministic gates first — tests / lint / typecheck via `sys_os_shell`" before review.
  - A **different-vendor** reviewer gets only a saved diff snapshot plus the acceptance contract, never the implementer's worktree or transcript. Blocking findings become fix-tasks sent back to the same implementer conversation, and the loop repeats until clean (OM examples/polly/skills/cross-review/SKILL.md).
  - The prompt says "Do not infer success from git status alone — read the sub-agent's reported result and run the test / lint / typecheck gates yourself". It also forbids recording "fabrication" unless the same gate was re-collected at the same commit (OM examples/polly/config.yaml).
- **Harness test bench**: an executable conformance suite. It earns each capability-matrix cell from a live turn and flags `DRIFT` when declared flags differ from observed behaviour. The project states it "has already caught and corrected real declaration drift" (IMPLEMENTED / CLAIMED result, OM docs/harness-bench-design.md). This tests Omnigent's adapters, not agent output.

### 1.7 Safety model

- **OS sandbox** (IMPLEMENTED): on Linux, native wrappers and `pi` run each agent terminal in `bwrap`, described as "mandatory" on Linux. macOS uses seatbelt. Windows gets only a Job Object, with no filesystem or network isolation (OM README.md prerequisites). There is an L7 egress proxy (OM README.md, Windows section).
- **Credentials** (IMPLEMENTED): agent CLIs spawn with a deny-by-default environment allowlist. Other vendors' keys need an explicit `env_passthrough` (OM docs/POLICIES.md#enforce_sandbox).
- **The flagship example ships unsandboxed**. Polly and its `claude_code` worker declare `sandbox: type: none` and `permission_mode: auto`. Polly's `blast_radius` policy sets `gate_pushes: false`, so push, merge and deploy are not ASKed. Only the "catastrophic DENY set (force-push, rm -rf /, hard-reset to a remote ref)" remains (IMPLEMENTED, OM examples/polly/config.yaml, OM examples/polly/agents/claude_code/config.yaml).
- **Merge policy**: "the human merges — you never merge" is **prompt text only** in Polly. No policy in the example denies `gh pr merge`. The `github_policy` builtin can restrict write branches when configured (IMPLEMENTED, OM docs/POLICIES.md#github_policy).

### 1.8 Methodology

Neutral plumbing. The platform imposes no SDLC. Polly carries a light discipline: plan gate with the human, delegate all code, worktree per task, green gates, PR per task, cross-vendor review. It has no TDD law, no spec/plan artefacts, and no durable project knowledge store beyond `.polly/registry.json`.

### 1.9 Notable ideas and stated lessons

- Cross-**vendor** review with an information barrier (diff snapshot plus contract only, never the worktree). Conductor's Checker uses an independent reviewer, but this goes further: a different vendor, and a reviewer that cannot see the transcript or the worktree.
- "Act in the SAME turn you announce": a turn that only announces intent stalls an async orchestrator, because no inbox wake ever arrives (OM examples/polly/config.yaml).
- Do not count tests with `grep -c 'def test_'`. Compare the same command, file set and commit before calling a worker's report a miscount (same file).
- Separate a BOOT failure (missing CLI or auth, so drop the worker) from a task failure (so re-dispatch fresh). Never re-prompt a dark worker (same file).
- A conformance bench for harness adapters, earned from live turns (OM docs/harness-bench-design.md). This answers Conductor's Operating Truth 1 ("the tests lie by omission" for adapters) with a dedicated tool.
- Budgets cannot pre-empt a running turn. This is a stated limit, not a solved problem (OM docs/AUTOMATIONS.md).

## 2. Paperclip

### 2.1 Identity and maturity

| Fact | Value | Label | Source |
|---|---|---|---|
| Repo | paperclipai/paperclip, created 2026-03-02, last push 2026-10-16 | MEASURED | `gh api repos/paperclipai/paperclip` |
| Stars / forks / open issues | 102,972 / 17,233 / 6,031 | MEASURED | same |
| Commits on master | about 5,308 | MEASURED | commits API |
| Contributors | about 234 (incl. anonymous). The top author `cryppadotta` (Dotta, @paperclipai) has 3,253 commits | MEASURED | contributors API |
| Merged PRs | 3,397 (README says "over 2,700") | MEASURED / CLAIMED | search API; PC README.md FAQ |
| Releases | date-versioned, about weekly (v2026.817.0 to v2026.1012.0) | MEASURED | releases API |
| License | MIT, "© 2026 Paperclip Labs, Inc" | MEASURED | PC README.md, PC LICENSE |
| Stack | TypeScript Node server, React UI, embedded Postgres, a Rust "Paperclip Runner" | IMPLEMENTED | PC README.md; tree (`packages/paperclip-runner`) |
| Business model | Open-core. A "Paperclip Cloud" waitlist, plus Community Edition vs EE ("even when EE policy editing is unavailable"). Funding not disclosed in primary sources. A directory claims $500k (unverified) | CLAIMED | PC README.md; PC doc/LOW-TRUST-PRESETS.md; https://rywalker.com/research/paperclip |
| Telemetry | on by default, opt-out | CLAIMED | PC README.md#telemetry |

### 2.2 Problem and audience

"If OpenClaw is an employee, Paperclip is the company." It is a control plane for "autonomous AI organizations": org charts, budgets, goals, tickets and governance over any agent runtime. Stated pain points: "20 simultaneous Claude Code terminals", lost sessions on reboot, runaway token spend, recurring jobs. The vision is that autonomous companies "rival the GDP of the world's largest countries" (CLAIMED, PC README.md, PC doc/GOAL.md). The audience is solo founders and teams running many agents across coding and non-coding work.

### 2.3 Architecture

- **What it wraps** (IMPLEMENTED). Adapters for Claude Code, Codex, Cursor (plus Cloud), Gemini CLI, OpenCode, Pi, Hermes, Grok Build, Kimi Code, OpenClaw gateway, HTTP/webhook bots, a generic `process` command, and external adapter plugins. "If it can receive a heartbeat, it's hired." Sources: PC README.md, PC docs/adapters/overview.md, PC docs/adapters/process.md.
- **"The control plane doesn't run agents. It orchestrates them. Agents run wherever they run and phone home."** Agents call the Paperclip REST API (`/api/agents/me`, issue checkout, comments) during each heartbeat (PC doc/GOAL.md, PC docs/guides/agent-developer/heartbeat-protocol.md).
- **Claude Code launch** (IMPLEMENTED, PC packages/adapters/claude-local/src/server/execute.ts lines about 850-882):
  - argv is `--print --output-format stream-json --verbose`, optional `--resume <session>`, the permission args, `--model`, `--effort`, `--max-turns`, `--append-system-prompt-file <agent instructions>` on fresh sessions, `--mcp-config … --strict-mcp-config`, and `--add-dir <skills bundle>`.
  - **`if (config.managedAiConnection) args.push("--setting-sources", "user")`**.
  - `dangerouslySkipPermissions` defaults to `true` (line 440; PC docs/adapters/claude-local.md).
  - `cwd` is the resolved execution workspace (project repo or isolated git worktree), else the configured `cwd`.
  - Session resume is cwd-aware.
- **Process model** (IMPLEMENTED). One Node process with embedded Postgres locally, or external Postgres in production. A "DB-backed wakeup queue with coalescing, budget checks, workspace resolution, secret injection, skill loading, and adapter invocation". Sandboxed execution targets include e2b, Cloudflare, Daytona, Modal, Novita and K8s (PC README.md "What's Under the Hood", Roadmap).
- **State**. Everything lives in Postgres: companies, agents, goals, projects, issues, comments, documents, work products, approvals, costs, activity log. Per-agent instruction files live at `<instance>/companies/<c>/agents/<a>/instructions/AGENTS.md` with notes and memory, exposed as `AGENT_HOME`, outside the task workspace (IMPLEMENTED, PC doc/agent-files.md). Again, not in the repository.
- **UI**. React web dashboard (mobile-ready), CLI (`npx paperclipai onboard|test-drive|configure`), experimental Agent Chat with Slack/Discord/Telegram/email connectors. Desktop app is on the roadmap (PC README.md, PC ROADMAP.md).

### 2.4 Unit of work

The unit is the **issue** (task), linked to company, project, goal and parent. It has a single assignee, atomic checkout with execution locks (`409` means "never retry"), blocker dependencies, comments, documents, attachments and work products. Goals cascade company → team → agent → task so "agents see the why". **Agents are org roles** with title, boss, budget and permissions. **Routines** create tracked issues on cron, webhook or API triggers (IMPLEMENTED, PC README.md "The Systems", PC docs/guides/agent-developer/heartbeat-protocol.md, PC doc/execution-semantics.md).

### 2.5 How humans steer and approve

- **The board** (the human operator) approves `hire_agent` requests and the **CEO strategy**. The CEO cannot move tasks to `in_progress` before strategy approval. The board can pause, resume or terminate any agent, reassign tasks, override budgets, and create agents directly (IMPLEMENTED, PC docs/guides/board-operator/approvals.md).
- **Execution policy per issue**:
  - Optional ordered `review` and `approval` stages with agent or user participants. The original executor is excluded.
  - The runtime **intercepts the executor's `done`**, turns it into `in_review`, and reassigns to the reviewer. Every decision is an audited `issue_execution_decisions` row with a required comment.
  - "Comment required" on every run is always on (IMPLEMENTED, PC docs/guides/execution-policy.md).
- **Plan approval**: plans are revisioned documents. A `request_confirmation` interaction is bound to the latest revision, and decomposition is exact-once per `(sourceIssueId, acceptedPlanRevisionId)` (IMPLEMENTED, PC doc/execution-semantics.md §7).
- **Budgets** are scoped by company, agent, project, goal, issue, provider and model, with warnings and hard stops. Stated limit: "Enforcement uses recorded spend; usage reporting and in-flight work can delay a stop" (IMPLEMENTED / stated limit, PC README.md "Budget & Cost Control").
- **Heartbeats**: agents wake for assignment, comments or timers. Liveness states (`plan_only`, `empty_response` …) trigger bounded continuation wakes. Exhausted continuations leave an audit comment for a human (IMPLEMENTED, PC docs/guides/agent-developer/heartbeat-protocol.md).
- **Tool gateway**: MCP connections with per-action Allowed / Ask first / Off. Human access, agent eligibility and action permission are separate controls (IMPLEMENTED/CLAIMED, PC README.md).

### 2.6 How it verifies work

- **Structural, not deterministic**. Review stages force a second actor before `done`. The default backstop is that a comment exists, not that tests pass.
- **Task watchdog** (opt-in per issue). It is "verification-shaped, not execution-shaped": when a watched subtree comes to rest, a watchdog **agent** checks claims "against comments, documents, work products, tests, screenshots, blockers, review state", and "should not accept 'I could not' or 'waiting for approval' as sufficient by itself" (IMPLEMENTED, PC doc/TASK-WATCHDOG.md, PC doc/execution-semantics.md lines about 940-991). This is an LLM judge reading evidence, not an exit-code check.
- **Liveness rules that resist agent self-report** (IMPLEMENTED, PC doc/execution-semantics.md §8):
  - "Workspace provisioning alone is not treated as concrete task progress."
  - A PID, background job, log file or "promise to check later is evidence only", not a live path.
  - "A comment … is evidence … but it is not a recovery action by itself."
- **PRs**: the GitHub monitor "does not merge the PR or attest that it merged" (PC doc/execution-semantics.md about line 437).
- **Evals of Paperclip itself**: Runner Evals and Product E2E Evals against real providers and a real browser. Their own guidance says "Neither source admission nor a scripted pass proves model behavior" (IMPLEMENTED, PC doc/evals.md). Skill Studio offers saved test inputs and version history for skills (CLAIMED, PC README.md).

### 2.7 Safety model

- **Permissions**: `dangerouslySkipPermissions: true` by default for headless Claude runs (IMPLEMENTED, PC docs/adapters/claude-local.md).
- **Agent rights**: new standard agents get broad grants by default, including `canCreateAgents: true`, `skills:create`, tool management and task assignment within their subtree. Agents **cannot** set `process` adapter commands, host command/cwd/env, or filesystem sandbox settings, so host-executed commands stay under board control (IMPLEMENTED, PC doc/agent-permission-defaults.md).
- **Low trust**: a `low_trust_review` preset for hostile input (untrusted PRs, external tickets). Policies from agent, project and issue are intersected, "narrower wins", and the preset fails closed on bad scope. It also prevents raw untrusted output from being promoted into higher-trust context (IMPLEMENTED, PC doc/LOW-TRUST-PRESETS.md). This is close to Conductor's `src/loop/untrusted.js` "trust from authorship".
- **Secrets**: encrypted company and per-person secrets, injected by reference. Managed sandbox runs upload a sanitised Claude config seed without host credentials (IMPLEMENTED, PC docs/adapters/claude-local.md "Remote credential ownership").
- **Sandbox**: optional execution targets. A separate Docker workflow covers untrusted PR review with isolated `~/.claude`, `~/.codex` and `gh` state (IMPLEMENTED, PC doc/UNTRUSTED-PR-REVIEW.md).
- **Merge policy**: no platform gate found against an agent running `gh pr merge` with its push credential. The bundled `github-pr-workflow` skill speaks of "merge discipline" in prose only (PC packages/skills-catalog/catalog/bundled/software-development/github-pr-workflow/SKILL.md). Not verified either way in code.

### 2.8 Methodology

Explicitly neutral: "Not an agent framework. We don't tell you how to build agents… Agents bring their own prompts, models, and runtimes" (PC README.md "What Paperclip is not"). It imposes an **operating** discipline: checkout, comment, status, delegation via child issues, escalation along the chain of command. That discipline is enforced in the server. It imposes no **engineering** discipline. The bundled "Product Engineering" team (CTO, senior-coder, QA) plus skills `github-pr-workflow`, `qa-acceptance`, `task-planning` and `doc-maintenance` are prose. The team's agent files contain no TDD, test-first or merge rules beyond "QA … report actionable findings with evidence" (PC packages/teams-catalog/catalog/bundled/software-development/product-engineering/).

### 2.9 Notable ideas and stated lessons

- **The runtime intercepts `done`** and turns it into review, so agents do not have to remember to hand off (PC docs/guides/execution-policy.md). This is the same "enforce with code, not prose" stance as Conductor, applied to workflow state.
- **A live path is required for every non-terminal issue**: an issue may stay `in_progress` only if a durable primitive (wake, monitor, interaction, blocker, child issue) owns the next step. A bounded single continuation, then escalation to `blocked` plus a board-owned recovery action (PC doc/execution-semantics.md §8). This is a precise answer to "stuck loop" and "silent stall".
- **Atomic checkout and "never retry a 409"** for multi-agent claim races (PC heartbeat-protocol.md).
- **Goal ancestry injected into every task** (PC README.md).
- **Company templates** export/import orgs, agents and skills with secret scrubbing (`companies.sh`, `agentcompanies/v1` schema) (PC docs/companies/companies-spec.md).
- **Stated operational lessons** in the Claude adapter: poisoned-session auto-rotation, validate-before-persist, and clear-on-error (PC docs/adapters/claude-local.md "Poisoned previous_message_id"). Also quota-wait classification.

## 3. Comparison with Conductor's three layers

### 3.1 Layer-by-layer

| Conductor layer | Omnigent | Paperclip |
|---|---|---|
| L1 Methodology in the harness (root AGENTS.md, skills, workflows, personas, `conductor/` state) | Orthogonal. Has no SDLC. Polly's prompt is a small, prompt-only cousin of Conductor's Build/Checker. **Complement** | Orthogonal at the engineering level. It does have per-agent `AGENTS.md` role files and a skills store, but these are roles and procedures, not an engineering law. Name collision: Paperclip's `AGENTS.md` is a per-agent persona file appended to the system prompt, not the repo's root `AGENTS.md`. **Complement** |
| L2 Deterministic enforcement (git hooks: TDD presence, Goodhart boundary, protected paths, verify-on-push, evidence ledger) | None. Policies gate tool calls (shell, file write, cost, GitHub branches), not repository content. **Complement**. Omnigent policies and Conductor hooks act at different points | None for code. It enforces workflow state (review stages, checkout, liveness). **Complement** |
| L3 `conductor loop` (Maker/Checker, worktree per task, PR-gated merge, sandbox, swarm, autonomy clamp, Evidence Rule) | **Competes/overlaps strongly**: worktree per task, multi-engine, PR per task, sandbox (bwrap/seatbelt/cloud), cost caps, automations, remote and phone UI. **Weaker**: merge gate is prompt-only in Polly. Verification is an LLM review plus gates that the orchestrator LLM chooses to run, with no exit-code ledger. **Stronger**: cross-vendor review, live collaboration, cloud sandboxes, harness conformance bench | **Competes/overlaps** on queue, heartbeat, budget and human surfaces (`conductor status/inbox/view`, backlog harvest). Paperclip's state lives in Postgres, Conductor's in markdown in git. **Weaker**: no deterministic verification, `dangerouslySkipPermissions` default. **Stronger**: org and goal model, approvals, budgets, multi-user, routines, liveness and recovery semantics, low-trust presets |
| `conductor/` durable state shared by human and agents | Omnigent state lives in `~/.omnigent` / server DB. Session-centric, with no project knowledge store | Postgres issues, documents and goals. This is the direct conceptual competitor to `conductor/` (backlog, inbox, compass). Different storage (DB vs git markdown) |

### 3.2 Can Conductor run INSIDE them? Yes. Concrete integration points

**Omnigent → Conductor L1+L2 (works as-is; not verified live):**

- `omnigent claude` and Polly's `claude_code` worker run the real `claude` CLI with `cwd` = launch directory or worktree (OM omnigent/harnesses/claude_native/main.py).
- In a Conductor-installed repo, Claude Code reads the root `AGENTS.md`. Per Conductor's own notes, it does so only when no `CLAUDE.md` exists (CLAUDE.md "Design Decisions", 6.7.0).
- No `--setting-sources` restriction was found, so project `.claude/settings.json` hooks (Conductor's opt-in `PreToolUse` hooks) should load next to Omnigent's injected `PermissionRequest` hook. Not verified live.
- Git hooks (`pre-commit`, `pre-push`) fire on every commit and push the worker makes, because `core.hooksPath` is repo config shared by worktrees. Polly's `git worktree add .worktrees/<id>` creates a worktree whose hooks path resolves the same way.
- Polly's "drive it to green" would then hit Conductor's verify-on-push gate. That gives Polly the deterministic evidence it lacks.

**Paperclip → Conductor L1+L2 (works with one caveat; not verified live):**

- `claude_local` runs `claude --print` in the project workspace or an isolated git worktree (PC execute.ts). Root `AGENTS.md` and git hooks apply as above.
- **Caveat R1**: when the agent uses a managed AI connection, Paperclip passes `--setting-sources user` (execute.ts line 855). That excludes project and local Claude Code settings, so Conductor's project-level `PreToolUse` hooks (`pretooluse-no-bypass.sh`, `pretooluse-fact-gate.sh`) would not load. Whether `--setting-sources user` also suppresses project `AGENTS.md` / `CLAUDE.md` memory loading in the CLI is **not verified**. It needs a live check. Git hooks are unaffected.
- **Caveat R2**: `dangerouslySkipPermissions: true` by default. Claude Code hooks still run in bypass mode. Conductor's git hooks are the only gate the agent cannot route around inside its own process, and only if the agent does not pass `--no-verify`. Conductor's heartbeat (reflog vs hook heartbeats) would detect a skipped hook after the fact.
- Paperclip's per-agent instructions arrive through `--append-system-prompt-file`. A Paperclip "senior-coder" role prompt could carry one line, "follow the repo's AGENTS.md", and Conductor's laws would then govern the code.

**Conductor `loop` inside them:**

- *Paperclip*: register `conductor loop --from-conductor` as a `process` adapter agent. Paperclip spawns the command per heartbeat with `cwd`, judges success by exit code, and injects `PAPERCLIP_*` env vars (PC docs/adapters/process.md). The board must configure it: agents cannot set process commands (PC doc/agent-permission-defaults.md). Mismatch: Conductor's queue lives in `conductor/2-backlog`, Paperclip's in Postgres issues. Without a bridge, each beat ignores the Paperclip issue that woke it. A thin bridge (Paperclip issue → `--event <file.json>`, which `conductor loop` already accepts; loop result → issue comment and status via the REST API) is the only glue needed.
- *Omnigent*: an automation can fire a session whose agent runs `conductor loop` in a shell terminal. Fit is poor, because Omnigent wants to be the orchestrator itself (Polly). It is more natural to add Omnigent as a loop **engine** (a `--platform omnigent` adapter that launches `omnigent run`) so Conductor's driver, Checker, Evidence Rule and PR gate stay in charge while Omnigent supplies the cloud sandbox and remote UI. This is a design option, not a recommendation made here.

**Vice versa (they run inside Conductor)**: not meaningful. Both are servers with their own databases and UIs, not harness configuration.

### 3.3 What Conductor could take from them (ideas, not scope)

- I1. Cross-vendor Checker with an information barrier (diff snapshot plus contract only) — Omnigent Polly.
- I2. A harness/adapter conformance bench earned from live turns, with DRIFT verdicts — Omnigent. This targets Conductor's Operating Truth 1 directly.
- I3. "Every non-terminal item needs a durable live path, bounded continuation, then escalate" — Paperclip §8. Relevant to loop stall handling.
- I4. A runtime that intercepts "done" into review — Paperclip. Conductor already does the equivalent with the Checker verdict and fail-safe-on-missing-verdict.
- I5. Boot failure vs task failure classification for engines — Omnigent Polly.
- I6. Low-trust intersection, "narrower wins, fail closed" — Paperclip. It confirms the design already in `src/loop/untrusted.js`.

## 4. Risks and open points

- R1. Paperclip's `--setting-sources user` on managed connections drops project Claude Code hooks. Its effect on root `AGENTS.md` loading is not verified.
- R2. Both default to permissive agent permissions (Paperclip `dangerouslySkipPermissions: true`; Omnigent Polly `permission_mode: auto`, `sandbox: none`, `gate_pushes: false`). A Conductor user running inside them loses the L3 sandbox gate and the autonomy clamp. Only the git-hook layer remains.
- R3. In both, the "never merge" rule is prose (Polly prompt) or absent (Paperclip). Conductor's PR-gated merge does not carry over unless branch protection is set on the forge.
- R4. Market size: Paperclip has about 10x Omnigent's stars and about 100x Conductor's reach (MEASURED stars). If Conductor positions its loop against them, it competes with two well-funded, fast-moving teams (weekly releases, thousands of merged PRs). Positioning L1+L2 as "the engineering discipline that runs inside any meta-harness" avoids that contest. This is an assumption about strategy, not a finding.
- Q1. Not checked: whether Paperclip's Codex/Gemini adapters similarly restrict project config, and whether Omnigent's SDK (`claude-sdk`) path loads project settings. Only the native Claude paths were read.
