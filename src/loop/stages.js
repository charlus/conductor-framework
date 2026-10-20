// src/loop/stages.js
//
// Unattended Lifecycle step 6 (docs/roadmap/Unattended-Lifecycle.md): the stage
// map in code. Each stage names the workflow its beat runs and the gate before
// the next stage. The driver reads its workflow files and beat sections from
// here, and test/loop-stage-conformance.test.js fails when the loop routes a
// stage to anything else, or when this table and the roadmap's Stage map differ.
//
// runner: "owner" (never the loop), "loop", or "none" (not built).
// prompt: "inline" (the beat's prompt starts with the workflow file, as an
//         interactive session reads it), or "named" (the loop workflow's Maker
//         step runs it, and the assignment names it).
// section: the `## <section> (unattended)` part of unattended-loop.md the beat gets.
// gate: what must pass before the next stage, in order.

export const STAGES = Object.freeze([
  { key: "discovery", name: "Discovery", workflows: ["genesis.md", "storyboard.md"], runner: "owner" },
  { key: "grand-prd", name: "Grand PRD", workflows: ["grand-prd.md"], runner: "loop", prompt: "inline", section: "Blueprint beat", gate: ["evidence", "checker:blueprint:grand-prd"] },
  { key: "ux-ui-brief", name: "UX/UI Brief", workflows: ["ux-ui-design-brief.md"], runner: "loop", prompt: "inline", section: "Blueprint beat", gate: ["evidence", "checker:blueprint:ux-ui-brief"] },
  { key: "technical-vision", name: "Technical Vision", workflows: ["technical-vision.md"], runner: "loop", prompt: "inline", section: "Blueprint beat", gate: ["evidence", "checker:blueprint:technical-vision"] },
  { key: "carve", name: "Carve", workflows: ["carve.md"], runner: "loop", prompt: "inline", section: "Blueprint beat", gate: ["evidence", "checker:blueprint:carve", "verify", "mr"] },
  { key: "spec", name: "Spec-It", workflows: ["spec-it.md"], runner: "loop", prompt: "inline", section: "Spec beat", gate: ["evidence", "checker:spec"] },
  { key: "build", name: "Build", workflows: ["build.md"], runner: "loop", prompt: "named", section: null, gate: ["verify", "checker:build"] },
  { key: "ship", name: "Ship", workflows: ["ship.md"], runner: "loop", prompt: "inline", section: "Ship beat", gate: ["evidence", "verify", "checker:ship", "mr"] },
  { key: "retrospective", name: "Retrospective", workflows: ["retrospective.md"], runner: "none" },
]);

/** The stage with this key; throws on an unknown key, so a typo cannot route silently. */
export function stage(key) {
  const s = STAGES.find((x) => x.key === key);
  if (!s) throw new Error(`unknown loop stage: ${key}`);
  return s;
}

/** The workflow file a loop stage runs, relative to the project root. */
export function stageWorkflowPath(key) {
  return `.agents/workflows/${stage(key).workflows[0]}`;
}
