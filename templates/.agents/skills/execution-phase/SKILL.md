---
name: Execution-Phase
description: "Use to write specifications, execute code builds, or use the quick path to bypass discovery and just build something."
---

# Execution Phase Entry Point

This skill routes you to the correct execution workflow.

## Routing

- If the user says: "Spec it", "Write the spec":
  **ACTION:** Read `.agents/workflows/spec-it.md` and follow it.

- If the user says: "Build it", "Let's code":
  **ACTION:** Read `.agents/workflows/build.md` and follow it.

- If the user says: "Quick path", "Just build this":
  **ACTION:** Read `.agents/workflows/quick-path.md` and follow it.
