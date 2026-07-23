# Running the Autonomous Loop (`conductor loop`)

> Most people use Conductor purely as installed templates (`.agents/` + `conductor/`) and drive it by chatting with their agent. But Conductor also ships a **real headless outer loop** — `conductor loop` — that spawns and drives an agent CLI (`claude` / `agy` / `codex`) beat-by-beat against your repo, with deterministic guardrails the agent can't reason around. This guide shows how to run it.

## What it is (30-second model)

`conductor loop` is a deterministic driver (`src/loop/driver.js`). Each **beat** it launches a real agent process (e.g. `claude -p`) in an isolated git worktree, then — in code, not prose — runs your verification command, consults an independent Checker process, enforces an iteration ceiling / wall-clock budget / stall detection, and transitions state. It is **not** a chat; you steer it through a JSON file called **The Spine**.

- **The Spine:** `conductor/1-workbench/loop-state.json` — the goal, phase, autonomy level, verify command, and (for swarm mode) the task graph. The driver reads *only* this for control.
- **The beat prompt:** `.agents/workflows/unattended-loop.md` (maker) and `.agents/workflows/loop-checker.md` (checker). Because the agent runs in your repo, it also auto-loads `CLAUDE.md → .agents/AGENTS.md` and reads your `.agents/` rules/personas each beat.
- **It talks back through files:** escalations → `conductor/1-workbench/inbox.md`; audit trail → `conductor/0-compass/ship-log.md`; it stops at `awaiting_review` for you to inspect and merge.

## Prerequisites

1. An agent CLI on your `PATH` — `claude` (primary), `agy`, or `codex`.
2. Conductor installed in the repo (`npx github:charlus/conductor-framework init`), so `conductor/1-workbench/loop-state.json` exists.
3. A **clean git repo** with at least one commit.

## Step 1 — Configure The Spine

A fresh install seeds `loop-state.json` with `phase: "discovery"` and no verify command. The loop **refuses to run in `discovery`** (the Scoping Barrier — that phase needs a human) and **refuses to run with no verify command** (the Evidence Rule needs a real success signal). So set three fields:

```jsonc
// conductor/1-workbench/loop-state.json
{
  "goal_description": "Implement the /health endpoint returning 200 with {status:'ok'}",
  "phase": "execution",          // discovery→refused; blueprint & execution run headless
  "autonomy_level": "L1",        // start here — one beat, then human review, no merge
  "platform": "claude",          // or agy / codex; omit to auto-detect
  "verification": {
    "command": "npm test"        // exit 0 = success. MUST be programmatic.
  }
}
```

The verify command resolves in this order: `verification.command` → `conductor.config.json` `"verify"` → `npm test` (if a test script exists). Commit your changes so the repo is clean.

**Alternatively, seed the goal at launch** instead of editing the file:

```bash
conductor loop . --goal "Implement the /health endpoint"        # bare-string trigger
conductor loop . --event ./event.json                            # JSON payload (cron/webhook)
```

## Step 2 — Preview with `--dry-run` (always do this first)

```bash
node bin/conductor.js loop /path/to/repo --dry-run
# or, if installed globally: conductor loop /path/to/repo --dry-run
```

It prints the resolved plan — phase, verify command, autonomy summary, detected adapter, whether a worktree will be created, and any halt it *would* hit (e.g. `discovery → halted_scoping`, no verify → `halted_no_verification`, `L3` without a container → `halted_sandbox_required`). No agent is spawned.

## Step 3 — Run it for real

```bash
node bin/conductor.js loop /path/to/repo --platform claude --unsafe-no-sandbox
```

`--unsafe-no-sandbox` is **required** for a real run until the container sandbox ships — it's your explicit acknowledgement that an unattended agent with shell access will run against the repo. (`L3` autonomy additionally requires `sandbox: "container"` and cannot be overridden this way.)

You'll see, per beat: `platform: claude` → `worktree: … (new)` → the maker beat → `verify exit=N` → `checker: APPROVED/REJECTED` → a status transition. An `L1` run does exactly one Maker→verify→Checker cycle and stops at `finished: awaiting_review` for you to review and merge the branch yourself.

## The autonomy ladder

| Level | Behavior | Merge |
|-------|----------|-------|
| **L0** | interactive-only — the headless loop refuses to run | — |
| **L1** | one beat, then human review (**start here**) | none (you merge) |
| **L2** | unattended, **blueprint only** (specs/tasks, no code) | none |
| **L3** | unattended execution, **requires `sandbox: "container"`** | **PR-gated** (`gh`/`glab`), never a direct push |

Set `autonomy_level` in the Spine. A `--goal`/`--event` trigger can *lower* autonomy but never *raise* it above the operator ceiling already in the file.

## Modes: pair vs swarm

- **Pair (default):** one `goal_description`, one Maker, one Checker. Leave `tasks: []`.
- **Swarm (opt-in, L3):** populate `loop-state.json.tasks[]` with a task graph (produce it with the `carve` workflow), set `concurrency > 1`. The driver runs parallel Makers in per-task worktrees with a serialized PR-gated merge queue.

## How it reads your project

- **Instructions/rules/personas:** picked up automatically — the agent auto-loads `CLAUDE.md → .agents/AGENTS.md` and the workflow directs it to read `.agents/rules/` and `.agents/personas/` each beat.
- **Goal / phase / status:** *only* from `loop-state.json`. The driver does not scan your `conductor/` folders.
- **Open tasks from `conductor/2-plan/`:** **not** ingested automatically today — you bridge them into `tasks[]` (via `carve`) or give a single `--goal`. (Auto-bridging is on the roadmap — see [`roadmap/Loop-Robustness-Plan.md`](roadmap/Loop-Robustness-Plan.md).)

## Claude Code native alternative

Inside an interactive Claude Code session you can instead run `/loop` (it discovers `.claude/loop.md`, which drives the same `unattended-loop.md` workflow), and every workflow is a slash command (`/build`, `/carve`, `/ship`, …). Those run *within one session*; `conductor loop` is the true out-of-process headless driver.

## Safety notes & current limitations

- Real runs are **unsandboxed** until the container profile ships; run only against repos you trust, ideally in a throwaway clone or a VM.
- The loop is **young**. A known rough edge: if the maker creates files but forgets to `git commit`, verify can still pass on the working tree while the committed diff stays empty — and the work can be lost on worktree teardown. Prefer `L1` and review the branch before merging. Hardening is tracked in [`roadmap/Loop-Robustness-Plan.md`](roadmap/Loop-Robustness-Plan.md).
- Escalations and the run trail are written to `conductor/1-workbench/inbox.md` and `conductor/0-compass/ship-log.md` — read those after every run.
