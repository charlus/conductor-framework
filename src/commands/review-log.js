// src/commands/review-log.js
//
// `conductor review-log` — the review findings ledger (E2).
//
//   conductor review-log append '<json>'
//   conductor review-log summary [--since <ISO date>]
//
// WHY. E1 changed the review gate on the argument that the reviewer's question
// was unbounded, not that the Maker writes bad code. That is a claim, and it
// deserves data rather than another opinion. This ledger is the instrument:
//
//   rounds to APPROVE            did the loop actually get shorter?
//   dismissal rate per class     a class dismissed most of the time is a RUBRIC
//                                defect — fix calibration.md, not the author.
//   blockers by category         if real blockers cluster in one area, that is
//                                a Maker/spec problem and E1's premise was wrong
//                                for this project. Say so and re-tune.
//   reviewer brief bytes         tests agentctl's finding that loop count tracks
//                                the size of the instruction corpus.
//
// Lives in the repo (`conductor/1-workbench/review-log.jsonl`), not under
// CONDUCTOR_HOME: unlike evidence, these findings are about the project and are
// useful to the whole team and to the Retrospective workflow.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { PRECEDENCE, outranks } from "../personas.js";

export const REVIEW_LOG_REL = "conductor/1-workbench/review-log.jsonl";

const SEVERITIES = new Set(["BLOCKER", "IMPORTANT", "NIT", "SCOPE"]);
const ACTIONS = new Set(["fixed", "dismissed", "known-gap", "deferred"]);

/**
 * Validate and normalise one finding record. Returns {ok, record|error}.
 * Kept pure so the contract is unit-testable.
 */
export function normalizeFinding(raw, { now = () => Date.now() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "a finding must be a JSON object" };
  }
  const severity = String(raw.severity ?? "").toUpperCase();
  if (!SEVERITIES.has(severity)) {
    return { ok: false, error: `severity must be one of ${[...SEVERITIES].join(", ")}` };
  }
  const action = String(raw.action ?? "").toLowerCase();
  if (!ACTIONS.has(action)) {
    return { ok: false, error: `action must be one of ${[...ACTIONS].join(", ")}` };
  }
  const confidence = Number(raw.confidence);
  // The E1 bar, enforced here too so the ledger cannot record a finding the
  // rubric would have refused: a BLOCKER needs a quote and confidence >= 7.
  if (severity === "BLOCKER") {
    if (!Number.isFinite(confidence) || confidence < 7) {
      return { ok: false, error: "a BLOCKER needs confidence >= 7 (rubric v2)" };
    }
    if (!String(raw.quote ?? "").trim()) {
      return { ok: false, error: "a BLOCKER needs the quoted line that proves it (rubric v2)" };
    }
  }
  // D1: a finding a higher-ranked one overrode. The ledger refuses a reversed
  // order unless the product owner made that call, so the precedence cannot
  // drift one quiet dismissal at a time.
  const persona = raw.persona ? String(raw.persona) : null;
  const overriddenBy = raw.overridden_by ? String(raw.overridden_by) : null;
  const poDecision = raw.po_decision === true;
  if (persona && (!PRECEDENCE.includes(persona) || persona === "acceptance-criteria")) {
    return { ok: false, error: `persona must be one of ${PRECEDENCE.filter((p) => p !== "acceptance-criteria").join(", ")}` };
  }
  if (overriddenBy) {
    if (!persona) return { ok: false, error: "overridden_by needs the persona whose finding lost" };
    if (action !== "dismissed") return { ok: false, error: "an overridden finding is recorded as dismissed" };
    if (!PRECEDENCE.includes(overriddenBy)) {
      return { ok: false, error: `overridden_by must be one of ${PRECEDENCE.join(", ")}` };
    }
    if (!outranks(overriddenBy, persona) && !poDecision) {
      return {
        ok: false,
        error: `${overriddenBy} cannot override ${persona}: that reverses the precedence. ` +
          "It is a product decision: ask the product owner, then record po_decision: true",
      };
    }
  }
  return {
    ok: true,
    record: {
      ts: new Date(now()).toISOString(),
      round: Number.isFinite(Number(raw.round)) ? Number(raw.round) : 1,
      severity,
      confidence: Number.isFinite(confidence) ? confidence : null,
      category: String(raw.category ?? "uncategorised"),
      file: raw.file ? String(raw.file) : null,
      line: Number.isFinite(Number(raw.line)) ? Number(raw.line) : null,
      quote: raw.quote ? String(raw.quote).slice(0, 400) : null,
      action,
      reason: raw.reason ? String(raw.reason).slice(0, 400) : null,
      // Fingerprint lets a later round suppress a finding already dismissed on
      // code that did not change.
      fingerprint: raw.fingerprint
        ? String(raw.fingerprint)
        : `${raw.file ?? "?"}:${raw.line ?? "?"}:${raw.category ?? "?"}`,
      brief_bytes: Number.isFinite(Number(raw.brief_bytes)) ? Number(raw.brief_bytes) : null,
      artifact: raw.artifact ? String(raw.artifact) : "diff",
      persona,
      overridden_by: overriddenBy,
      po_decision: poDecision,
    },
  };
}

/** Aggregate records into the numbers the plan promised to measure. */
export function summarise(records) {
  const byClass = {};
  const bySeverity = {};
  let blockers = 0;
  let dismissed = 0;
  const rounds = new Set();
  const byPersona = {};

  for (const r of records) {
    if (r.persona) {
      const p = (byPersona[r.persona] ??= { total: 0, overridden: 0 });
      p.total += 1;
      if (r.overridden_by) p.overridden += 1;
    }
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    const c = (byClass[r.category] ??= { total: 0, dismissed: 0, blockers: 0 });
    c.total += 1;
    if (r.action === "dismissed") {
      c.dismissed += 1;
      dismissed += 1;
    }
    if (r.severity === "BLOCKER") {
      c.blockers += 1;
      blockers += 1;
    }
    if (Number.isFinite(r.round)) rounds.add(r.round);
  }

  const classes = Object.entries(byClass)
    .map(([name, c]) => ({
      name,
      ...c,
      dismissalRate: c.total ? c.dismissed / c.total : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const personas = Object.entries(byPersona)
    .map(([name, p]) => ({ name, ...p, overrideRate: p.overridden / p.total }))
    .sort((a, b) => b.total - a.total);

  return {
    findings: records.length,
    bySeverity,
    blockers,
    dismissed,
    dismissalRate: records.length ? dismissed / records.length : 0,
    maxRound: rounds.size ? Math.max(...rounds) : 0,
    classes,
    // A class dismissed most of the time is the reviewer being wrong repeatedly
    // in one place — a rubric defect, fixable in calibration.md.
    rubricSuspects: classes.filter((c) => c.total >= 3 && c.dismissalRate > 0.5),
    personas,
    // A persona whose findings lose most conflicts asks for the wrong thing:
    // fix its Review Lens, not the code (D4).
    lensSuspects: personas.filter((p) => p.overridden >= 3 && p.overrideRate > 0.5),
  };
}

export async function reviewLogCommand(args, { cwd, stdout, stderr }) {
  const sub = args.find((a) => !a.startsWith("-")) ?? "";
  const path = join(cwd, REVIEW_LOG_REL);

  if (sub === "append") {
    const json = args[args.indexOf("append") + 1];
    if (!json) {
      stderr.write("usage: conductor review-log append '<json finding>'\n");
      return 1;
    }
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      stderr.write(`review-log: not valid JSON (${e.message})\n`);
      return 1;
    }
    const res = normalizeFinding(parsed);
    if (!res.ok) {
      stderr.write(`review-log: ${res.error}\n`);
      return 1;
    }
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(res.record)}\n`);
    } catch (e) {
      stderr.write(`review-log: could not write ${path} (${e.message})\n`);
      return 1;
    }
    stdout.write(`recorded ${res.record.severity} ${res.record.fingerprint} → ${res.record.action}\n`);
    return 0;
  }

  if (sub === "summary") {
    let text = "";
    try {
      text = await readFile(path, "utf8");
    } catch {
      stdout.write("No review findings recorded yet.\n");
      return 0;
    }
    const since = args.includes("--since") ? Date.parse(args[args.indexOf("--since") + 1]) : null;
    const records = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (since && Date.parse(r.ts) < since) continue;
        records.push(r);
      } catch {
        /* skip torn lines */
      }
    }
    const s = summarise(records);
    stdout.write(`Review findings: ${s.findings} (${s.blockers} blockers)\n`);
    stdout.write(`Dismissal rate:  ${(s.dismissalRate * 100).toFixed(0)}%\n`);
    stdout.write(`Max round:       ${s.maxRound}\n\n`);
    stdout.write("By class:\n");
    for (const c of s.classes) {
      stdout.write(
        `  ${String(c.total).padStart(4)}  ${String(c.blockers).padStart(3)} blk  ` +
          `${(c.dismissalRate * 100).toFixed(0).padStart(3)}% dismissed  ${c.name}\n`,
      );
    }
    if (s.rubricSuspects.length) {
      stdout.write("\nRubric suspects (dismissed >50% of the time, n>=3):\n");
      for (const c of s.rubricSuspects) {
        stdout.write(`  ${c.name} — add a worked case to skills/independent-review/calibration.md\n`);
      }
    }
    if (s.personas.length) {
      stdout.write("\nBy persona (findings, lost to a higher-ranked one):\n");
      for (const p of s.personas) {
        stdout.write(`  ${String(p.total).padStart(4)}  ${String(p.overridden).padStart(3)} lost  ${p.name}\n`);
      }
    }
    if (s.lensSuspects.length) {
      stdout.write("\nLens suspects (lose >50% of their conflicts, n>=3):\n");
      for (const p of s.lensSuspects) {
        stdout.write(`  ${p.name} — recalibrate the Review Lens in .agents/personas/${p.name}.md\n`);
      }
    }
    return 0;
  }

  stderr.write(
    "usage: conductor review-log <append|summary>\n\n" +
      "  append '<json>'   record one finding + its disposition\n" +
      "  summary [--since <ISO date>]\n\n" +
      "Fields: severity (BLOCKER|IMPORTANT|NIT|SCOPE), action (fixed|dismissed|known-gap|deferred),\n" +
      "        category, file, line, quote, confidence, reason, round, brief_bytes,\n" +
      "        persona, overridden_by, po_decision (a conflict between two personas' findings).\n" +
      "A BLOCKER requires confidence >= 7 and a quote — the same bar as rubric v2.\n",
  );
  return sub ? 1 : 0;
}
