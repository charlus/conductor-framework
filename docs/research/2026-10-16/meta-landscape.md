# Meta-harness landscape, October 2026

State as of 2026-10-16. Scope: tools that sit above or around coding-agent harnesses (Claude Code, Codex CLI, Antigravity/agy, Cursor agent, OpenCode, Amp, Gemini CLI). Omnigent and Paperclip appear as rows only (covered in depth elsewhere).

Evidence labels:
- MEASURED: a number observed on a primary page (star count, price, version) or a vendor's own published measurement.
- IMPLEMENTED: behaviour described in the vendor's own docs or README as shipped.
- CLAIMED: marketing copy, a secondary source, or a statement I could not tie to primary documentation.

All fetched content was treated as untrusted data. No third-party code was cloned or run. "Not verified" means I found no primary statement.

## 1. Bottom line

- The **plumbing** layer (parallel sessions, worktree or VM isolation, diff review, PR creation, CI-fix loops, scheduled and event-triggered runs) is fully commoditised. Every major vendor ships it natively, and at least eight open-source wrappers ship it for free.
- **Methodology as prose** (spec → plan → tasks, personas, workflow files) is also crowded: GitHub Spec Kit (~111–115k stars, CLAIMED), BMAD-METHOD (~46.7k, CLAIMED), Kiro, Google's own "Conductor" extension for Gemini CLI.
- **Deterministic, harness-neutral enforcement of engineering discipline** (test-first presence gates, Goodhart boundary, evidence freshness bound to the committed tree, fail-closed hooks) is the thin quadrant. Vendors ship hook *mechanisms* and platform gates (CodeQL, branch protection, "agent cannot merge"), not an engineering *policy*. No tool in this survey enforces "a test exists before the implementation" or "the evidence matches the tree being pushed".
- **Conductor layer 3 (`conductor loop`) is commoditising fastest.** Layer 2 (hooks + evidence) is the distinctive asset. Layer 1 (methodology) is distinctive only where it is bound to layer 2 and to the PO-owned `conductor/` state.
- **Name clash is double:** Conductor.build (Melty Labs, a Mac app for the same audience) and Google's "Conductor" extension for Gemini CLI (context-driven development with Markdown specs and plans in the repo). Both are closer to this product than a generic name clash.

## 2. Landscape table

Columns: Cat = category. Wraps = which harness(es). Unit = unit of work. State = where state lives. Steer = human steering model. Verify = verification model. Safety = sandbox and merge policy. Method = imposes SE discipline or neutral. Mat = maturity. O/C = open or closed. Price.

### 2.1 Local multi-agent desktops and terminal multiplexers (plumbing)

| Tool | Cat | Wraps | Unit | State | Steer | Verify | Safety | Method | Mat | O/C | Price | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Conductor.build** (Melty Labs) | Mac desktop, parallel workspaces; cloud workspaces on Pro | Claude Code, Codex, Cursor, OpenCode | Workspace = branch + worktree + terminal + diff | Local worktrees; cloud: Vercel sandbox us-east-1, 8 vCPU / 16 GB | Interactive, human reviews each diff | Human diff review; "Checks" tab shows CI and todos, "may block or discourage merge" | Worktree only locally; human merges | Neutral | v0.91.0 | Closed | Free; Pro $50/mo (cloud, API, mobile, multiplayer ≤5); Teams $60/user/mo | IMPLEMENTED [docs](https://www.conductor.build/docs/), [worktrees](https://www.conductor.build/docs/concepts/workspaces-and-branches), [checks](https://www.conductor.build/docs/reference/checks); MEASURED [pricing](https://www.conductor.build/pricing) |
| **Vibe Kanban** (bloop) | Kanban board over agents | 10+: Claude Code, Codex, Gemini CLI, Copilot, Amp, Cursor, OpenCode, Droid, Qwen | Issue → workspace (branch, terminal, dev server) | Local; hosted issues/orgs removed after shutdown | Interactive; inline diff comments go back to agent | Human diff review, built-in browser preview | Worktree; PR via GitHub, human merges | Neutral | **Sunsetting**: bloop shut down 2026-04-10; community-maintained | Apache-2.0, 28.4k stars | Free | IMPLEMENTED [repo](https://github.com/BloopAI/vibe-kanban); [shutdown](https://vibekanban.com/blog/shutdown) |
| **Crystal → Nimbalyst** (Stravu) | Desktop workspace: sessions + visual editors + kanban | Claude Code, Codex; OpenCode, Copilot, Codex-ACP in alpha | Session (optionally worktree) on a phase kanban | Local-first files (Markdown, JSON, CSV) | Interactive; approve each AI edit as a diff | Human diff approval | Optional worktree | Light (planning/implementing phases), not enforced | Crystal deprecated Feb 2026; Nimbalyst active, Teams in beta | MIT | Free individuals; Teams free in beta | IMPLEMENTED [crystal](https://github.com/stravu/crystal), [nimbalyst](https://nimbalyst.com/) |
| **Claude Squad** | tmux TUI | Claude Code, Codex, OpenCode, Amp, Aider, Gemini | Session = tmux pane + worktree | Local | Interactive; `-y` auto-accept (experimental) | Human review before push | Worktree; pushes branch, no merge logic | Neutral | Mature for its scope | AGPL-3.0, 8.6k stars | Free | IMPLEMENTED [repo](https://github.com/smtg-ai/claude-squad) |
| **Superset** | Agentic IDE for many CLI agents | 21 "fully supported" incl. Claude Code, Codex, OpenCode, Cursor Agent, Gemini | Worktree + branch + terminals | Local | Interactive; merge from iPhone/iPad | Human diff review | README: "Worktrees separate working files; they do not sandbox processes" | Neutral | Active | Elastic License 2.0 (source-available), 15.3k stars | Desktop free; Pro for mobile (price not stated) | IMPLEMENTED [repo](https://github.com/superset-sh/superset) |
| **herdr** | Terminal runtime / multiplexer (Rust), YC | ~20 CLIs incl. Claude Code, Codex, Cursor, opencode, Grok | Pane; state working/blocked/idle | Background server, SSH reattach | Interactive + scriptable socket API | None (state detection only) | None stated | Neutral | Active | Apache-2.0, 44.3k stars | Free core; paid tier exists | MEASURED stars [topic](https://github.com/topics/agent-orchestration); CLAIMED features [review](https://www.bitdoze.com/herdr-agent-multiplexer/), [site](https://herdr.dev/pricing) |
| **Happy** (slopus) | Mobile/web remote client + harness | Claude Code, Codex, Grok | Session | Relay server, "end-to-end encrypted" sync | Remote interactive from phone | None | None stated | Neutral | Active | MIT, 24.2k stars | Free | IMPLEMENTED/CLAIMED (encryption scheme not described) [repo](https://github.com/slopus/happy) |
| **Sculptor** (Imbue) | Desktop UI, agent per container | Claude Code; Codex (from 2025-12-03) | Agent = Docker container from devcontainer config + branch | Container until "Pull"; Pairing Mode syncs both ways | Interactive | Human picks changes; flags merge conflicts; "Suggestions" (beta) | **Container isolation** (stronger than worktree) | Neutral | Beta | Closed (source release "intended") | Free in beta (CLAIMED) | IMPLEMENTED [sculptor](https://imbue.com/sculptor/), [containers](https://imbue.com/blog/containers); MEASURED-by-vendor setup time "minutes to seconds" |
| **munder-difflin** | Electron "office of agents" with orchestrator agent | Claude Code, Antigravity, Codex, Grok, Kimi, Gemini, Qwen, OpenCode, Crush, pi, Copilot CLI, Cursor | Agent with mailbox; "GOD" agent routes and escalates spend/destructive/scope | Markdown memory per agent, shared blackboard, event log | Agent-decides with escalation | None automated; "CI watcher"; asks PRs to carry before/after evidence | Optional worktrees | Light (escalation rules) | Pre-release v0.5.3 | MIT, 8.8k stars | Free | IMPLEMENTED/CLAIMED [repo](https://github.com/chaitanyagiri/munder-difflin) |
| **Orchestrator.inc / agent-orchestrator** (ex-Composio, AgentWrapper) | Desktop control plane, planner + workers | "36" / "+25 more" incl. Claude Code, Codex, Cursor, Aider, Gemini | Worker = branch + worktree + PR | Local daemon | Orchestrator plans and delegates; human merges | Tracks CI, mergeability, reviewer state; routes failures and comments back to owning agent | Worktree; no merge rules stated | Light (plan → delegate) | Created 2026-02-13 | Apache-2.0, 13.2k stars | Free | IMPLEMENTED [repo](https://github.com/AgentWrapper/agent-orchestrator); MEASURED [stars](https://www.star-history.com/orchestratorinc/agent-orchestrator/) |
| **Gas Town** (Steve Yegge) | Multi-agent workspace manager, Beads issue store | Claude Code mainly; Codex, Gemini | Bead (issue) worked by role agents (Mayor, Polecats, Refinery, Witness…) | Git-backed hooks + Beads | Agent-decides; for "stage 6–8" users | Role-based (Refinery merges, Witness monitors); no test gate stated | Not stated | Opinionated roles, not SE discipline | v1.0 Apr 2026 then maintenance (CLAIMED) | Open | Free | CLAIMED [pkg.go.dev](https://pkg.go.dev/github.com/steveyegge/gastown), [heise](https://www.heise.de/en/background/Full-Control-Gas-Town-Orchestrates-Ten-or-More-Coding-Agents-11178824.html?seite=2) |

### 2.2 Self-hosted / API control planes

| Tool | Cat | Wraps | Unit | State | Steer | Verify | Safety | Method | Mat | O/C | Price | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **OpenHands Agent Canvas** | Self-hosted "developer control center for coding agents and automations" | OpenHands agent, Claude Code, Codex, Gemini CLI, Pi, OpenCode, any ACP agent | Conversation; automations on schedule/webhook | Agent Server (SDK) | Interactive + automations (Slack, GitHub, Linear, Datadog) | Not stated | Optional Docker per conversation; no-sandbox mode warned | Neutral | Beta | MIT, 91.0k stars; Cloud/Enterprise optional | Free self-hosted | IMPLEMENTED [repo](https://github.com/OpenHands/OpenHands) |
| **Omnara** | **Pivoted**: from mobile Claude Code client to "open-source API for running agents in production" | Any model endpoint; machines via Blaxel, Daytona, Unikraft, or daemon | Durable agent (event log) | Durable event log | Approval for risky tool calls, RBAC, audit history | Not coding-specific | Scoped secrets, approvals | Neutral | Active | Apache-2.0 | Platform free; pay models + machine time | CLAIMED (vendor page) [omnara.com](https://www.omnara.com/) |
| **Omnigent** (Databricks) — row only | Meta-harness with Python policies (allow/deny/ask), cost caps, sandboxes | Claude Code, Codex, Cursor, Pi, OpenCode | Session | — | Policy-driven | Policy, not tests | Sandbox + policy | Neutral governance | Alpha, Jun 2026 | Apache-2.0, 10.8k stars | Free | MEASURED stars [topic](https://github.com/topics/agent-orchestration); CLAIMED [dealroom](https://app.dealroom.co/news/feed/databricks-launches-omnigent-open-source-orchestration-layer-for-ai-agents) |
| **Paperclip** — row only | "Zero-human company": org chart, goals, budgets, heartbeats over agents | Bring-your-own agents | Goal / role | Self-hosted Node server | Goals and budgets set by human | Not stated | Budget caps | Org model, not SE | Active | MIT, 103k stars | Free | MEASURED stars [topic](https://github.com/topics/agent-orchestration) |
| **Terragon** | Cloud background-agent orchestrator | Claude Code, Codex, Amp, Gemini | Task = sandbox container + branch + auto PR | Cloud | Async; Slack/GitHub mentions; `terry` CLI | Not stated | Sandbox container | Neutral | **Shut down**; OSS snapshot 2026-01-16 | Apache-2.0 snapshot | n/a | IMPLEMENTED [repo](https://github.com/terragon-labs/terragon-oss) |

### 2.3 Vendor-native orchestration

| Tool | Cat | Wraps | Unit | State | Steer | Verify | Safety | Method | Mat | O/C | Price | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Claude Code: agent teams** | Lead + teammates, shared task list, mailboxes | Claude only | Task in shared list | `~/.claude/teams`, `~/.claude/tasks` (local) | Interactive only: teammates do not spawn under `-p` | `TaskCompleted`/`TeammateIdle`/`TaskCreated` hooks can block with exit 2 | No worktree isolation for teammates ("partition the work") | Neutral | Experimental, off by default | Closed | Plan usage | IMPLEMENTED [docs](https://code.claude.com/docs/en/agent-teams) |
| **Claude Code: dynamic workflows** | Script-orchestrated subagents (≤16 concurrent, ≤1,000/run) | Claude only | `agent()` / `pipeline()` / `parallel()` | Script variables; resumable in session | Approve plan, then no mid-run input | Adversarial cross-checking as a pattern (e.g. `/deep-research` votes on claims) | Same permissions + sandboxing as session; isolated copies optional | Quality patterns, not SE gates | GA on paid plans | Closed | Plan usage | IMPLEMENTED [docs](https://code.claude.com/docs/en/workflows) |
| **Claude Code: agent view, worktrees, `/batch`** | Dispatch + monitor background sessions | Claude only | Session in own worktree | Local | Hand off, step in when needed | Human | Worktree per dispatched session | Neutral | Research preview | Closed | Plan usage | IMPLEMENTED [agents](https://code.claude.com/docs/en/agents) |
| **Claude Code: cloud sessions + Auto-fix** | Cloud VM per session; Auto-fix watches PR CI and review comments | Claude only | Session → `claude/` branch → PR | Anthropic VM; history persists | Steer from web/mobile; teleport to terminal | Auto-fix reacts to CI failures; "green status ≠ task succeeded" | Isolated VM; network allowlist; credentials outside sandbox via git proxy | Neutral | GA | Closed | Plan usage, no VM charge | IMPLEMENTED [docs](https://code.claude.com/docs/en/claude-code-on-the-web) |
| **Claude Code: routines** | Saved prompt + repos + connectors on schedule / API / GitHub event | Claude only | Run = cloud session | Anthropic cloud or self-hosted env | Unattended; "no permission-mode picker" | Doc warns: green run ≠ task success; read transcript | `claude/` branch prefix; branch rules apply; fire text wrapped as untrusted | Neutral | Research preview | Closed | Plan usage; 100 scheduled runs/h | IMPLEMENTED [docs](https://code.claude.com/docs/en/routines) |
| **Claude Code: Projects** | Coordinator conversation that spawns parallel cloud "threads" | Claude only | Thread → branch → PR | Project instructions + memory, Overview pane (waiting on you / ready for review) | PO-like: describe once, "Waiting on you" queue | Human PR review | Cloud VM per thread | Neutral | Public beta, Pro/Max only | Closed | Plan usage | IMPLEMENTED [docs](https://code.claude.com/docs/en/claude-projects) |
| **OpenAI Codex app + cloud** | Desktop (Feb 2026, macOS; Windows Mar 2026) with parallel chats, worktrees, cloud tasks, automations | Codex only | Chat / cloud task | Local worktrees; cloud workspace per task | Interactive + scheduled tasks | Human inspection of diff and test results | Cloud workspace; internet access toggle | Neutral | GA | Closed | ChatGPT plans | IMPLEMENTED [app](https://learn.chatgpt.com/docs/app), [cloud](https://learn.chatgpt.com/docs/cloud); CLAIMED dates [heise](https://heise.de/-11165126) |
| **GitHub Agent HQ / Copilot cloud agent** | Mission control across GitHub, VS Code, mobile, CLI; partner agents Claude (Agent SDK) and Codex (Codex SDK) | Copilot, Claude, Codex | Issue → `copilot/` branch → draft PR | GitHub | Assign issue, steer in PR | CodeQL, secret scanning, Advisory DB check before PR finalised; self-review pass | Firewall; one branch; **cannot approve or merge**; Actions workflows wait for human "Approve and run" | Neutral (plan mode, AGENTS.md rules) | GA (Copilot); partners in preview → GA | Closed | Copilot plans; Actions minutes + AI credits | IMPLEMENTED [third-party agents](https://docs.github.com/en/copilot/concepts/agents/about-third-party-agents), [risks](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations); CLAIMED [blog](https://github.blog/news-insights/company-news/welcome-home-agents/) |
| **Cursor 3 Agents Window + cloud agents** | Agent-first window; agents local, worktree, cloud VM, or SSH | Cursor agent (multi-model) | Agent → branch → PR "with artifacts to demo changes" | Cursor cloud VM / self-hosted | Interactive + Slack/GitHub/Linear start | Artifacts; Bugbot (not verified here) | Isolated VM; egress restriction; `.cursor/hooks.json` runs in cloud, user hooks do not | Neutral | GA (3.0 on 2026-04-02) | Closed | API-priced usage + paid plan | IMPLEMENTED [cloud agents](https://cursor.com/docs/cloud-agent), [3.0](https://cursor.com/changelog/3-0) |
| **Google Antigravity 2.0** | Desktop "command center" for parallel local agents; CLI; IDE with agent manager; SDK | Gemini (+ some third-party models) | Agent / chat in Projects; scheduled tasks | Local | Interactive; artifacts (plans, task lists, screenshots, recordings) | Artifact review by human | Not stated | Light (plan artifacts) | GA May 2026 | Closed | "No charge" developer access | IMPLEMENTED [site](https://antigravity.google/), [I/O blog](https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/) |
| **Google Jules** | Async cloud agent | Gemini | Task with plan → approve → code | Cloud VM | Plan approval gate, then async | Human | VM | Plan-first | "Experimental" | Closed | Not verified | IMPLEMENTED [docs](https://jules.google/docs) |
| **Devin** (Cognition) | Autonomous cloud engineer; orchestrates "managed Devins" | Devin | Session (ACU-billed) | Devin VM, knowledge, playbooks | Async; take over in IDE | PR review and app testing as task types | VM | Playbooks (prose) | GA | Closed | Core from $20, ACU ≈$2.00–2.25 (CLAIMED) | IMPLEMENTED (thin) [docs](https://docs.devin.ai/); CLAIMED [pricing](https://pensero.ai/blog/devin-pricing) |
| **Factory Missions** | Plan → milestones → Mission Control runs workers and validation; `droid exec --mission` headless | Droid | Feature within milestone | Not stated | **Plan approval gate**; pause, re-assess, change scope | **User-facing QA per feature**; requires a scriptable app start + logs on disk; separate `--validator-model` | Droid Computer (remote) | **Imposes discipline** (plan, milestones, QA, "Agent Readiness Level ≥4") | GA | Closed | $20/$100/$200 tiers (CLAIMED); missions need extra usage | IMPLEMENTED [missions](https://docs.factory.com/missions/overview.md); CLAIMED pricing |
| **Amp** (Sourcegraph spin-out) | Agent with subagents, oracle, Orbs (cloud machines per thread), Puck (agent coordinator) | Amp | Thread | Orbs | Interactive + background on Orbs | Oracle second opinion (model, not tests) | Orb machines | Neutral | GA | Closed | Usage-based; free tier closed to new users (CLAIMED) | IMPLEMENTED [manual](https://ampcode.com/manual); CLAIMED [news](https://www.ampcode.com/news) |

### 2.4 Methodology layers (the quadrant Conductor shares)

| Tool | Cat | Wraps | Method | Enforcement | O/C | Evidence |
|---|---|---|---|---|---|---|
| **GitHub Spec Kit** | specify → plan → tasks → implement | 30+ agents | Spec-driven | Prose / templates; GitHub calls it an experiment | MIT, ~111–115k stars | CLAIMED [roundup](https://ssojet.com/blog/best-spec-driven-development-tools) |
| **BMAD-METHOD** | 12+ role personas, PRD → architecture → stories | Many | Agile roles | Prose | Open, ~46.7k stars, v6.6.0 | CLAIMED [roundup](https://medium.com/@visrow/a-tale-of-two-frameworks-bmad-method-vs-github-spec-kit-c021ab0ad037) |
| **Kiro** (AWS) | Spec IDE: requirements / design / tasks; steering files; file-event hooks | Kiro agent (Bedrock models) | Spec-driven | Agent hooks on file events (agent tasks, not deterministic gates) | Closed; replaced Amazon Q Developer May 2026 | CLAIMED [review](https://pasqualepillitteri.it/en/news/6370/amazon-kiro-ide-spec-driven-review) |
| **Google "Conductor" for Gemini CLI** | Context → spec & plan → implement; Markdown in repo; tracks | Gemini CLI (now Antigravity CLI) | Context-driven | Prose; git-aware revert | Open, preview since 2025-12-17 | IMPLEMENTED [Google blog](https://developers.googleblog.com/conductor-introducing-context-driven-development-for-gemini-cli/) |
| **Conductor (this repo)** | Plan → Design → Build → Ship → Learn; personas from touched paths; `conductor/` PO state | Claude Code, Codex, agy | Full SE lifecycle | **Git hooks (TDD + eval presence, Goodhart boundary, protected paths, pre-push verify, evidence ledger with tree fingerprint)**; loop with Maker/Checker, PR-gated merge | Open | Repo: `templates/.agents/hooks/`, `src/evidence/`, `src/loop/` |

## 3. Axes that separate the landscape

I tested six axes. Four do most of the separating. Two are near-uniform and do not discriminate.

- **X1 Value layer: plumbing ↔ discipline.** Plumbing = parallelism, isolation, UI, PR mechanics. Discipline = a method plus something that rejects work that breaks it. This is the axis with the widest spread and the emptiest region.
- **X2 Attendance: interactive ↔ unattended.** Does the tool expect a human on each session (Claude Squad, Conductor.build), or does it run to a PR with no one watching (routines, Copilot cloud agent, Factory `droid exec --mission`, `conductor loop`)?
- **X3 Coupling: harness-neutral ↔ vendor-native.** Neutral tools wrap many CLIs. Vendor tools orchestrate only their own agent but go deeper (cloud VM, platform gates).
- **X4 Verification source: self-report → human diff → CI/platform checks → independent validator → deterministic gate bound to evidence.** Most tools stop at "human reads the diff". Copilot adds platform scanners. Factory adds a validator. Only Conductor binds a gate to evidence freshness.

Non-discriminating:
- **Local vs cloud.** Nearly every serious tool now offers both (Conductor.build Pro, Cursor, Codex, Claude, Amp Orbs, Superset Pro). It separates price, not kind.
- **Isolation.** Worktree-per-task is universal (CLAIMED: "nearly every major coding agent had shipped worktree support by Q2 2026", [augmentcode](https://www.augmentcode.com/tools/open-source-agent-orchestrators)). Only Sculptor (containers) and cloud VMs go further.

A fifth axis is useful for the PO question:
- **X5 Who decides: PO-owned product state ↔ agent-owned task state.** Claude Projects (Overview, "Waiting on you"), Paperclip (goals, budgets), Nimbalyst (kanban over Markdown) and Factory (plan approval) give the human a product-level surface. Most others give a session list.

### Placement (X1 × X2, coupling in brackets: N = neutral, V = vendor)

| | Interactive | Unattended |
|---|---|---|
| **Plumbing** | Conductor.build (N), Claude Squad (N), Superset (N), herdr (N), Happy (N), Vibe Kanban (N), Nimbalyst (N), Sculptor (N-ish: Claude+Codex), Claude agent view / teams (V), Codex app (V), Cursor Agents Window (V), Antigravity app (V) | Claude routines + cloud + Auto-fix (V), Codex cloud + automations (V), Cursor cloud agents (V), Jules (V), Devin (V), Amp Orbs (V), agent-orchestrator (N), OpenHands Canvas automations (N), Terragon (N, dead) |
| **Discipline** | Spec Kit (N, prose), BMAD (N, prose), Google Conductor ext. (V, prose), Kiro (V, spec + file hooks), Claude dynamic workflows (V, cross-check pattern) | Factory Missions (V, plan + validator QA), Copilot cloud agent (V, platform gates: scanners, cannot merge, workflow approval), Omnigent (N, policy not SE), **Conductor loop + hooks (N, deterministic gates + evidence)** |

## 4. Empty and thin quadrants

- **Q1 Neutral × unattended × discipline enforced in code: thin, nearly empty.** Conductor is the only entry I found that is harness-neutral, runs unattended, and rejects work with deterministic gates. Omnigent is neutral and unattended but enforces *tool-use policy* (allow/deny/ask, spend caps), not *engineering* policy. Factory and Copilot enforce quality but only for their own agent.
- **Q2 Verification that refuses self-report: thin everywhere.** Claude's own docs state a green routine run "does not mean the task in your prompt succeeded" ([routines](https://code.claude.com/docs/en/routines)). Conductor.build's merge gate is "may block or discourage" ([checks](https://www.conductor.build/docs/reference/checks)). Only Factory (QA validator), Copilot (scanners, human merge) and Conductor (Evidence Rule, exit code, tree fingerprint) do better, and only Conductor checks that the evidence matches the code being pushed.
- **Q3 Test-first enforcement: empty.** No tool in the survey blocks an implementation commit that has no test. Vendors ship the hook mechanism (Claude `TaskCompleted`, Cursor `.cursor/hooks.json`, Copilot hooks, Kiro file hooks) but no shipped policy.
- **Q4 PO-facing product state that is plain files in the repo: thin.** Claude Projects keeps instructions and memory on Anthropic's servers. Paperclip keeps goals in its own server. Nimbalyst and Google Conductor keep Markdown in the repo but carry no backlog/roadmap/ship-log semantics or gates. `conductor/` is the closest to "a PO workspace the agents and the hooks both read".
- **Q5 Interactive × discipline × enforced: thin.** Spec Kit, BMAD and Google Conductor are prose. Kiro hooks run agent tasks, not deterministic checks. Conductor's interactive path (hooks on every commit) is the enforced entry here.
- **Crowded and consolidating:** interactive plumbing. Two notable exits in 2026 (Vibe Kanban's company, Terragon), one deprecation (Crystal), one pivot (Omnara away from mobile Claude Code client). Vendors absorbed the feature set (Codex app, Cursor 3, Antigravity 2.0, Claude agent view).

## 5. Where Conductor sits, and what is commoditising

Position: **neutral × unattended-capable × discipline-enforced**, plus a PO-owned state folder. Its three layers fare differently.

### Layer 3, the orchestrator (`conductor loop`): commoditising fast

What vendors and meta-harnesses now ship, mapped against loop features:

| Loop feature | Already shipped by | Evidence |
|---|---|---|
| Worktree per task | Conductor.build, Claude Squad, Superset, Vibe Kanban, agent-orchestrator, Codex app, Cursor 3, Claude agent view | IMPLEMENTED, links in §2 |
| Unattended run to a PR | Claude routines/cloud, Codex cloud, Copilot cloud agent, Cursor cloud, Jules, Devin, Factory `droid exec` | IMPLEMENTED |
| PR-gated merge, agent cannot merge | Copilot cloud agent ("cannot approve or merge"), Claude `claude/` branches + rulesets | IMPLEMENTED [risks](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations) |
| Sandbox | Every cloud offering; Sculptor containers; OpenHands Docker per conversation | IMPLEMENTED |
| React to CI failure / review comments | Claude Auto-fix, agent-orchestrator | IMPLEMENTED |
| Scheduled / event triggers | Claude routines (schedule, API, GitHub), Codex automations, Antigravity scheduled tasks, OpenHands automations | IMPLEMENTED |
| Multi-engine | agent-orchestrator, Superset, herdr, Vibe Kanban, Omnigent, OpenHands Canvas | IMPLEMENTED |
| Maker/Checker, independent check | Factory validator model, Copilot self-review + scanners, Claude workflows adversarial verification | IMPLEMENTED / CLAIMED |
| Untrusted input envelope | Claude routines wrap fire text as `<routine-fire-payload>` untrusted data | IMPLEMENTED [routines](https://code.claude.com/docs/en/routines) |

Still distinctive in layer 3: the Evidence Rule (verify exit code, not self-report) wired to the ledger, fail-safe-on-missing-verdict, the autonomy clamp, swarm conflict prediction. These are small relative to the commoditised mass, and vendors have the cloud, the sandbox and the price advantage (Claude cloud sessions carry "no separate charge for the cloud VM").

### Layer 1, methodology in the harness: format commoditised, content partly distinctive

- The carrier is commoditised: AGENTS.md is read by Jules ([docs](https://jules.google/docs)), Copilot/VS Code ([blog](https://github.blog/news-insights/company-news/welcome-home-agents/)), Codex, Cursor, Amp. Skills, subagents and workflows are vendor primitives.
- Prose methodology is crowded: Spec Kit and BMAD outnumber Conductor's reach by orders of magnitude (CLAIMED star counts). Google ships a free one under the same name.
- Distinctive only where it is tied to layer 2 and to `conductor/`: path-triggered personas with fixed precedence, ship-contract, Eval-Driven Law. Prose alone gives no moat.

### Layer 2, deterministic enforcement: distinctive

- No surveyed tool ships TDD presence gates, a Goodhart boundary, protected paths, or evidence freshness bound to a working-tree fingerprint.
- Vendors ship mechanisms only: Claude hooks (`TaskCompleted` exit 2, [agent teams](https://code.claude.com/docs/en/agent-teams)), Cursor cloud hooks ([cloud agents](https://cursor.com/docs/cloud-agent)), Copilot hooks "for validation or logging" ([coding agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)). Policy is left to the user, which is the gap Conductor fills.
- Git hooks are the most harness-neutral point in the stack: they fire on `git commit` and `git push` whatever wrapped the agent.
- Risk: vendors can add a "require tests" toggle cheaply. GitHub already gates on CodeQL and secret scanning. The moat is the policy content plus the evidence ledger, not the hook plumbing.

## 6. Composition opportunities

Principle: let the plumbing tools run the sessions. Conductor supplies the rules (AGENTS.md), the gates (hooks, evidence) and the PO state (`conductor/`). Each row says what must hold for Conductor to keep working inside the tool.

| Host tool | How Conductor applies | Integration requirement / risk | Status |
|---|---|---|---|
| **Local worktree desktops**: Conductor.build, Superset, Claude Squad, Vibe Kanban, Nimbalyst, agent-orchestrator, Codex app, Cursor Agents Window, Claude agent view | Agent runs the real CLI in a git worktree of the same repo, so root `AGENTS.md` loads and hooks fire | Linked worktrees share the main repo's config, so `core.hooksPath` set by `conductor install-hooks` applies to every worktree. **Not verified** per tool: whether any tool runs commits with `--no-verify`, or whether its setup script copies `.agents/`. Claude Code reads AGENTS.md only when no CLAUDE.md exists, so a host that writes a CLAUDE.md hides it | Composable today, test with a live run per tool |
| **Container hosts**: Sculptor, OpenHands Docker mode | Repo copied into a container | `core.hooksPath` is local config and does not travel with a copy. The devcontainer or setup step must run `conductor install-hooks`. The `conductor` CLI must be in the image | Needs a setup step |
| **Vendor cloud sessions**: Claude cloud/routines/Projects, Codex cloud, Cursor cloud, Jules, Copilot cloud agent | Agent clones from GitHub in a VM | **Git hooks do not exist in a fresh clone.** Each needs a setup script that runs `npx … install-hooks` (Claude, Codex and Cursor all have setup scripts; Copilot uses an Actions setup workflow). Pushes go through vendor git proxies, so client-side `pre-push` is the only gate unless a **server-side twin** exists | Main gap. Recommended: ship the evidence / TDD-presence check as a GitHub Action required status check, so the gate holds for any agent including ones Conductor never launched |
| **Claude Code committed hooks** | `.claude/settings.json` hooks travel with the repo and run in cloud sessions ("in a project with one repository, that repository's permission rules and hooks too", [projects](https://code.claude.com/docs/en/claude-projects)) | Conductor's `pretooluse-no-bypass.sh` and `pretooluse-fact-gate.sh` are opt-in. Committing them would extend enforcement to Claude cloud threads. Hook scripts must not depend on local absolute paths | Opportunity, not verified |
| **Claude agent teams / dynamic workflows** | Team lead or workflow script as the Maker/Checker driver | Teams do not spawn under `-p` (the loop's headless mode) and do not isolate teammates in worktrees. Workflows do run under `-p` and the Agent SDK and could host the Checker as a cross-check stage | Workflows composable, teams not for the loop |
| **Claude routines / GitHub triggers** | Replace `conductor loop`'s trigger with a routine on `pull_request.opened` running the Checker brief | Routine pushes to `claude/` branches as the user; hooks absent unless setup script installs them | Composable |
| **GitHub Agent HQ / Copilot cloud agent** | Platform already enforces human merge, workflow approval, scanners | Add Conductor's checks as required status checks; AGENTS.md carries the method | Strong fit: GitHub supplies the safety envelope, Conductor supplies the policy |
| **Factory Missions** | Overlaps (plan + validator). Compose only via AGENTS.md + server-side checks | Competes on discipline, vendor-locked | Watch, do not integrate |
| **Omnigent** | Tool-use policy (deny `--no-verify`, cap spend) is complementary to engineering gates | Python policy hook could call `conductor evidence check` | Possible later, row only |
| **Happy / mobile clients** | PO steering from phone over the same sessions | No integration needed | Compatible |

## 7. Name clash

- **Conductor.build** (Melty Labs, YC): same audience (Claude Code + Codex users), same word, a paid Pro tier, active (v0.91.0). Search results for "conductor claude code" return it first ([morphllm](https://www.morphllm.com/conductor-ai-coding), [The New Stack](https://thenewstack.io/a-hands-on-review-of-conductor-an-ai-parallel-runner-app/?p=22802860)).
- **Google Conductor for Gemini CLI**: same word, same concept area (context, spec and plan as Markdown in the repo), Google distribution ([Google blog](https://developers.googleblog.com/conductor-introducing-context-driven-development-for-gemini-cli/), [InfoQ](https://infoq.com/news/2026/01/google-conductor/)). Its status after the Gemini CLI → Antigravity CLI migration is not verified.
- A third reuse of the word is in this repo's own credits ("Test in Prod's Conductor").
- Consequence: discoverability and confusion cost for an npm package called `conductor-framework`. A user who installs Conductor.build and this framework gets two "conductors" in one workflow. Whether to rename is a product decision and outside this research.

## 8. Uncertainty and gaps

- Pricing for Devin, Factory, Amp and Superset Pro rests on secondary sources (CLAIMED).
- Antigravity review policies, Jules pricing, Codex best-of-N and the Codex review feature were not visible on the primary pages fetched.
- Star counts are single snapshots on 2026-10-16 from the GitHub topic page or repo pages.
- I did not verify per tool whether commits are made with `--no-verify`. That is the first thing a live composition test must check.
- Gas Town, herdr feature details and Omnara's current product are from secondary or vendor-marketing pages.
