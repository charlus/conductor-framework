---
name: Blueprint-Phase
description: "Use to create Product Requirements Documents (PRDs), design UX/UI briefs, define Technical Vision, or break down features (Carve)."
---

# Blueprint Phase Entry Point

This skill routes you to the correct blueprinting workflow. Do not blueprint inside this skill. Your job is to load the correct workflow.

## Routing

- If the user says: "Create PRD" or "Grand PRD":
  **ACTION:** Read `.agents/workflows/grand-prd.md` and follow it.

- If the user says: "Design the interface" or "UX/UI Brief":
  **ACTION:** Read `.agents/workflows/ux-ui-design-brief.md` and follow it.

- If the user says: "Technical Vision" or "Architecture":
  **ACTION:** Read `.agents/workflows/technical-vision.md` and follow it.

- If the user says: "Break it down", "Carve", or asks to slice up a PRD into implementations:
  **ACTION:** Read `.agents/workflows/carve.md` and follow it.
