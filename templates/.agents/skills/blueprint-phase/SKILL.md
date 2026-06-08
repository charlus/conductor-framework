---
name: Blueprint-Phase
description: "Use to create Product Requirements Documents (PRDs), design UX/UI briefs, define Technical Vision, or break down features (Carve)."
---

# Blueprint Phase Entry Point

This skill routes you to the correct blueprinting workflow. Do not blueprint inside this skill. Your job is to load the correct workflow.

## Routing

- If the user says: "Create PRD" or "Grand PRD":
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/Grand-PRD.md` and follow it.

- If the user says: "Design the interface" or "UX/UI Brief":
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/UX-UI-Design-Brief.md` and follow it.

- If the user says: "Technical Vision" or "Architecture":
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/Technical-Vision.md` and follow it.

- If the user says: "Break it down", "Carve", or asks to slice up a PRD into implementations:
  **ACTION:** Use the `view_file` tool to read `.agents/workflows/Carve.md` and follow it.
