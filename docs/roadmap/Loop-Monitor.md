# Loop Monitor — see what an unattended run is doing

> **Status:** M1 (event log), M2 (`conductor watch`, terminal first) and M3 (the agent's steps, claude engine) in 6.39.0. Then (6.42.0) the watch tower, `conductor watch --all`, for several products at once; the browser view and the pixel office were dropped by the owner (2026-10-21). Owner decision 2026-10-20: after step 7, in the order M1 → M4.
> **Why:** a run lasts up to an hour and prints about ten lines. The owner cannot tell what each beat or each swarm worker is doing until it ends. agentctl (credited in the README) showed each agent live, in its own tmux pane.

## What limits us today

Not the sandbox. With `sandbox: "cli-native"`, bubblewrap wraps the commands the agent runs, not the `claude` process: the driver starts it and reads its output through a pipe, in pair and swarm mode alike. The limit is the output format. The claude adapter asks for `--output-format json` (`src/loop/adapters/claude.js`), one object when the beat ends. `--output-format stream-json` sends each message and tool call as it happens, through the same pipe.

What the driver already knows, beat by beat: `loop-state.json` (persisted after each beat: tasks, stage, attempts, cost), the `[loop]` lines in `0-compass/ship-log.md`, and each beat's full output in `.git/conductor-loop-logs/` after it ends.

## Build plan

Each layer is one PR, proven by a live run.

1. **M1 Event log.** The driver appends one line per event to an NDJSON file in the git directory: run started, beat started and ended (task, stage, role, model), verify exit code, review verdict and its reasons, question round raised, MR opened, cost. Every view reads this file; nothing else changes.
2. **M2 Live view.** `conductor watch [dir]`: one line per swarm worker (item, stage, role, minutes in the beat, last event), the run's beats and cost, refreshed from M1. A browser page can reuse the review canvas's loopback server (`src/review/server.js`). Q1, to settle when M2 starts: terminal first, browser first, or both.
3. **M3 Live agent activity.** The claude adapter switches to `stream-json` and writes the agent's steps (file edited, command run, test result) into M1 as they happen. The final result is still read from the last object, so the Evidence Rule and the verdict parsing do not change. This is the risky layer: every adapter bug so far showed only in a live run, so it needs one in pair and in swarm mode. codex has an event stream too (`codex exec --json`, not verified); agy is unknown.
4. **M4 The office.** A pixel-art view in the browser page: one character per worker, working during a beat, idle between beats, raising a hand on a question round. A skin over M1 and M3, no new data.

## Risks

- **R1 The event log grows.** One line per agent step in M3. Keep it per run, in the git directory, never committed.
- **R2 A view that lies.** A view must show what the driver recorded, not guess. A worker with no event for a while is shown as "no news since hh:mm", never as working.
- **R3 Streaming changes the adapter's output parsing.** A partial last line, or an engine that drops the final object, must still fail safe to a dead beat, as it does today.

## Not in scope

Steering a run from the view (pause, kill, answer). The view only reads.
