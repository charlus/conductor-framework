// src/loop/trigger.js
//
// The IGNITION contract for the Conductor autonomous loop.
//
// The driver (src/loop/driver.js) is a GOAL loop: it runs until a stop
// condition is met. It has no scheduler and no event ingestion — by design.
// The 2026 field consensus is "don't overshoot the tooling"; Claude Code
// already ships `/schedule`, and cron exists on every host. So instead of
// building our own scheduler, we expose a thin, safe way for ANY external
// trigger (a `/schedule`, a cron line, a CI/webhook shim) to SEED the loop's
// goal before it runs. That composition is what turns the goal loop into the
// TIME-based and PROACTIVE loops of Anthropic's Loop-Engineering taxonomy —
// see docs/roadmap/Loop-Engineering-Alignment.md.
//
// SAFETY (rubric §5.5 — a trigger payload may originate from untrusted input,
// e.g. a Slack message or a GitHub issue body):
//   • A trigger may SET the goal, the phase, and free-form context.
//   • A trigger may REQUEST an autonomy level, but it is CLAMPED to the
//     operator-set ceiling already in loop-state.json — a payload can DE-escalate
//     but NEVER escalate. Privilege comes from the operator, not the event.
//   • The context is written to the workbench as data for the Maker to read,
//     never spliced into the driver's control flow.

import { levelRank, LEVELS } from "./driver.js";

/** Fields a trigger payload may carry. Anything else is ignored. */
export const TRIGGER_FIELDS = Object.freeze([
  "goal",
  "source",
  "context",
  "phase",
  "autonomy_level",
]);

/**
 * Parse a trigger payload. Accepts either a JSON object (`{goal, source, ...}`)
 * or a bare string, which is treated as the goal. Returns null for empty input.
 * Throws on malformed JSON or a non-object JSON value (an operator error worth
 * surfacing loudly, not silently ignoring).
 */
export function parseTriggerPayload(text) {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  if (!raw.startsWith("{") && !raw.startsWith("[")) {
    return { goal: raw }; // bare string → the goal
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    throw new Error(`trigger payload is not valid JSON: ${e.message}`);
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("trigger payload must be a JSON object or a bare goal string");
  }
  return obj;
}

/**
 * Clamp a requested autonomy level to a ceiling. De-escalation is allowed;
 * escalation is refused (returns the ceiling). An unknown/absent request leaves
 * the ceiling untouched. This is the load-bearing safety property.
 */
export function clampAutonomy(ceiling, requested) {
  const req = (requested ?? "").trim();
  if (!(req in LEVELS)) return ceiling;
  return levelRank(req) <= levelRank(ceiling) ? req : ceiling;
}

/**
 * Apply a parsed trigger payload to a normalized loop state (mutates + returns
 * it) and produce an auditable provenance record. Pure except for the injected
 * clock — `node --test` drives it with a fixed `now`.
 *
 * @param {object} state    normalized v2 loop state (from normalizeState)
 * @param {object} payload  a parsed trigger payload (see parseTriggerPayload)
 * @param {object} [opts]
 * @param {() => number} [opts.now]  epoch-ms clock (default 0 → epoch, for tests)
 * @returns {{ state: object, provenance: object }}
 */
export function applyTrigger(state, payload, { now = () => 0 } = {}) {
  const p = payload && typeof payload === "object" ? payload : {};
  const changes = [];

  const goal = typeof p.goal === "string" ? p.goal.trim() : "";
  if (goal) {
    state.goal_description = goal;
    changes.push("goal");
  }

  if (typeof p.phase === "string" && p.phase.trim()) {
    state.phase = p.phase.trim();
    changes.push("phase");
  }

  const requestedAutonomy =
    typeof p.autonomy_level === "string" ? p.autonomy_level.trim() : null;
  if (requestedAutonomy) {
    const clamped = clampAutonomy(state.autonomy_level, requestedAutonomy);
    if (clamped !== state.autonomy_level) {
      state.autonomy_level = clamped;
      changes.push("autonomy_level");
    }
  }

  const source = (typeof p.source === "string" && p.source.trim()) || "external";
  const receivedAt = new Date(now()).toISOString();
  const context = typeof p.context === "string" ? p.context : "";
  const clampedAway =
    requestedAutonomy && requestedAutonomy !== state.autonomy_level
      ? requestedAutonomy
      : null;

  const provenance = {
    source,
    received_at: receivedAt,
    goal: state.goal_description,
    context,
    requested_autonomy: requestedAutonomy,
    effective_autonomy: state.autonomy_level,
    clamped_from: clampedAway, // set only when an escalation was refused
    changes,
  };

  // Durable, minimal breadcrumb on the Spine (full detail lives in loop-trigger.md).
  state.last_trigger = {
    source,
    received_at: receivedAt,
    effective_autonomy: state.autonomy_level,
    changes,
  };

  return { state, provenance };
}

/**
 * Render the human-/agent-readable trigger doc dropped into the workbench so the
 * Maker beat picks up the full context. This is DATA for the agent, not control.
 */
export function renderTriggerDoc(provenance) {
  const p = provenance ?? {};
  const lines = [
    "# Loop Trigger",
    "",
    "> Written by `conductor loop` when an external trigger seeded this run.",
    "> This is the current run's brief. The driver enforces all guardrails regardless.",
    "",
    `- **Source:** ${p.source ?? "external"}`,
    `- **Received:** ${p.received_at ?? "n/a"}`,
    `- **Effective autonomy:** ${p.effective_autonomy ?? "n/a"}` +
      (p.clamped_from ? ` (clamped down from requested \`${p.clamped_from}\` — escalation refused)` : ""),
    "",
    "## Goal",
    "",
    p.goal || "_(none set)_",
  ];
  if (p.context && p.context.trim()) {
    lines.push("", "## Context", "", p.context.trim());
  }
  return lines.join("\n") + "\n";
}
