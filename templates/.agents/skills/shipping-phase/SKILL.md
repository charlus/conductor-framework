---
name: Shipping-Phase
description: "Use to ship polished code, audit for release, or run a retrospective after completing a project."
---

# Shipping Phase Entry Point

This skill routes you to the correct shipping or retrospective workflow.

## Routing

- If the user says: "Ship it", "Audit and ship", "Release":
  **ACTION:** Read `.agents/workflows/ship.md` and follow it.

- If the user says: "Let's reflect", or the Build/Ship phase asks for a retrospective:
  **ACTION:** Read `.agents/workflows/retrospective.md` and follow it.
