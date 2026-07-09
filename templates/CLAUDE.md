# Conductor Framework V5

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
