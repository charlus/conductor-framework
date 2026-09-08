<!-- conductor:managed:begin — Conductor-managed; refreshed by `conductor upgrade`. Add your own notes BELOW the end marker. -->
# Conductor Framework V6

> This is a platform stub for auto-discovery. The full system instructions live in `.agents/AGENTS.md`.

Read and follow the instructions in `.agents/AGENTS.md` before any action.

---

## 🤖 Claude Code `/loop` Integration

This framework is fully compatible with Claude Code's native `/loop` command. To run a self-prompting autonomous loop:

1. Create a `.claude/loop.md` file in the root of your project with the following contents:
   ```markdown
   # Conductor Autonomous Loop
   Execute the Conductor Framework's unattended-loop workflow (`.agents/workflows/unattended-loop.md`) to recursively process project state, manage the workbench, and run the self-correcting development loop.
   ```
2. Start the headless loop from your Claude Code terminal by running:
   ```bash
   /loop
   ```

Claude Code will automatically discover `.claude/loop.md`, initialize Conductor's `unattended-loop.md` state machine, and drive your development tasks autonomously!

---

## ⌨️ Slash Commands

`init`/`upgrade` generate `.claude/commands/` shims of two kinds. Do not hand-edit either — change the source and re-run `conductor upgrade` to regenerate them.

**Workflow shims** — one per Conductor workflow (`/build`, `/carve`, `/spec-it`, `/ship`, …). Each loads and runs the matching `.agents/workflows/<name>.md`, so the workflow file stays the single source of truth.

**CLI shims** — these front a `conductor` command rather than a workflow, because capture and status must not depend on the model remembering a prose rule:

| Command | Runs | For |
|---|---|---|
| `/status` | `conductor status` | Inbox depth, backlog by priority, what's next, loop state — one screen |
| `/inbox` | `conductor inbox add "…"` | Capture a thought verbatim. No workflow, no triage |
| `/view` | `conductor view --open` | Every `conductor/` document rendered into one HTML page — tables, search, backlinks |

`/view` prints a `file://` URL; use the one the command emits verbatim. It is resolved for the platform your **browser** runs on, which is not always the one the agent runs on — under WSL a hand-made `file:///home/...` link looks right and silently does nothing.
<!-- conductor:managed:end -->

<!-- Add your project-specific instructions below this line; they are preserved across `conductor upgrade`. -->
