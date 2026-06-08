---
name: Execution-Phase
description: "Use to write specifications, execute code builds, or use the quick path to bypass discovery and just build something."
---

# Execution Phase Entry Point

This skill routes you to the correct execution workflow.

## Routing

- If the user says: "Spec it", "Write the spec":
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/Spec-It.md` and follow it.

- If the user says: "Build it", "Let's code":
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/Build.md` and follow it.

- If the user says: "Quick path", "Just build this":
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/Quick-Path.md` and follow it.
