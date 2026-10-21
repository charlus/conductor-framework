# Orchestrators for unattended Conductor work — comparison, 2026-10-21

**Question (owner):** five products are developed in parallel through 16 interactive Claude Code terminals, which is not sustainable. Is there an orchestrator, meta-harness or agent framework that can drive the development unattended with the owner's Claude Code subscription and his framework, instead of `conductor loop`?

**Decision (owner, 2026-10-21):** D5 keep `conductor loop` as the engine; D8 test a first-party Claude Code session as the owner's channel; D3 (the gates as a required CI check) next. Positioning D4, decided the same day: Conductor is the discipline that holds under any orchestrator.

## Criteria

| | |
|---|---|
| C1 | runs on Linux |
| C2 | uses the owner's subscription: only the unmodified `claude` binary may sign in with it ([legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)); third parties may not route requests through subscription credentials |
| C3 | each repository's `AGENTS.md` and git hooks apply, no `--no-verify`, no replaced instructions |
| C4 | a worktree per task, and changes reach the default branch only through an MR the owner merges |
| C5 | several repositories in parallel |
| C6 | the owner answers its questions conversationally and is told when it needs him |

C3 and C4 come from `conductor loop`'s own design, so the comparison favours it by construction. Code lives mostly on self-hosted GitLab.

## Results

| Candidate | How assessed | Verdict | Main reason |
|---|---|---|---|
| agentctl (Euranova, internal) | code read | not usable, fork not worth it | overwrites each worktree's `AGENTS.md` with its role prompt; tells the developer "Do not write tests", which fights the TDD hook, then stashes the rejected work; merges locally and pushes to the default branch, no MR; opens a GitLab issue on every merge |
| Orchestrator.inc / agent-orchestrator 0.14.3 (Apache-2.0) | code read, then a live trial (T1) on a scratch Conductor project | not adopted | passes C1–C6 on paper and loads project settings (`--setting-sources=user,project,local`); live, the worker followed test-first but skipped Spec-It and Ship, then asked the owner to push. Its workers push and open PRs themselves, so they need forge logins: Conductor's beats never hold them, and the sandbox blocked AO's own daemon |
| Claude Code cloud sessions, scheduled tasks, Projects | docs | not usable for GitLab products | clone and push only on GitHub; Projects not on Team plans |
| Claude Code agent view, Remote Control, Channels | docs | candidate channel (D8) | local, subscription-native; Remote Control pushes questions to the phone; Channels bridges a running session to Telegram or Discord (research preview; Owner toggles on Team) |
| paperclip | code read | not usable | its default subscription connection stores the OAuth token itself (outside the terms) and passes `--setting-sources user`, which drops project hooks; GitHub-only credentials |
| Gas Town | code read | not usable | writes its own `CLAUDE.md`, hiding `AGENTS.md`; merges directly by default |
| LangGraph, n8n, Temporal, Inngest, Prefect | docs | no better engine | none provides workflows by stage, the Evidence Rule, an independent Checker, the sandbox or question rounds; their LLM nodes need an API key. At best a trigger and channel layer: n8n fits best (about 4 to 6 days; its command node is a remote shell on a box holding the Claude login) |
| dots (Euranova, Pi harness) | code read | candidate channel, not an engine | real channels (Telegram, Google Chat, WhatsApp), notify and resume APIs, cron; but its chat model on a Claude login is outside the terms, and its `dev` capability ships on one chat message, counts "no CI" as green, and `/autonome` merges in the live checkout |

## What it means

- No tool found beats `conductor loop` as the engine under all six criteria. Each owner constraint is common alone (self-hosted GitLab, a subscription, an enforced framework, an MR the owner merges); together no product targets them.
- The open needs are an **always-on host** (every option needs one) and a **channel** to the owner (D8).
- The mainstream path for teams with the same need is code on GitHub plus a vendor cloud agent, with branch protection and required CI checks. D3 (the gates as a required CI check) is what lets Conductor's discipline hold if a constraint changes and that path opens.
- Found on the way, fixed in the method: Build treated a blank carved spec as present (6.41.0).

## Sources

Agent reports of 2026-10-21 (code read at agentctl `fd01f13`, agent-orchestrator `1550d44`, paperclip `8b873e0`, Gas Town `ef70b0b`, dots `b85b835` / dots-capabilities `5035a0d`); Claude Code docs: [cloud](https://code.claude.com/docs/en/claude-code-on-the-web), [routines](https://code.claude.com/docs/en/routines), [Projects](https://code.claude.com/docs/en/claude-projects), [agent view](https://code.claude.com/docs/en/agent-view), [Remote Control](https://code.claude.com/docs/en/remote-control), [Channels](https://code.claude.com/docs/en/channels), [headless](https://code.claude.com/docs/en/headless), [GitLab CI/CD](https://code.claude.com/docs/en/gitlab-ci-cd); [n8n Execute Command](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executecommand/), [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [Temporal message passing](https://docs.temporal.io/encyclopedia/workflow-message-passing). Prior survey: [`../2026-10-16/meta-landscape.md`](../2026-10-16/meta-landscape.md).
