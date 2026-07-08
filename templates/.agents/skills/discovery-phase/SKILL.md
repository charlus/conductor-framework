---
name: Discovery-Phase
description: "Use when the user has a new idea, wants to start a brand new app, or needs to explore a new feature area and shape the user experience."
---

# Discovery Phase Entry Point

This skill routes you to the correct discovery workflow based on the user's need.
Do not execute discovery within this skill. Your only job is to load the correct workflow.

## Routing

- If the user says: "I have an idea", "Start a new app", or "New feature area":
  **ACTION:** Read `.agents/workflows/genesis.md` and follow its instructions exactly.

- If the user says: "Storyboard", "Shape the experience":
  **ACTION:** Read `.agents/workflows/storyboard.md` and follow its instructions exactly.
