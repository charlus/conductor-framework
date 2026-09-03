// src/loop/checker.js
//
// The independent Checker's verdict contract (Phase 3). The Checker runs as a
// SEPARATE process with a fresh context (structural independence) and records its
// verdict to a file — a `claude -p` process exit code is always 0 on success, so
// it cannot itself carry the verdict. The driver reads that file back.
//
// Fail-safe by construction (Evidence Rule): anything other than an explicit,
// well-formed `{"approved": true}` is treated as a REJECT. No approval evidence
// ⇒ not approved. This keeps a crashed/confused/silent Checker from waving work
// through.

export const VERDICT_REL = "conductor/1-workbench/checker-verdict.json";

/**
 * Parse a Checker verdict file's contents into a normalized result.
 * @param {string|null|undefined} text raw file contents (or null if absent)
 * @returns {{approved: boolean, reason: string}}
 */
export function parseCheckerVerdict(text) {
  if (text == null || String(text).trim() === "") {
    return { approved: false, reason: "no verdict file written by Checker" };
  }
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { approved: false, reason: "Checker verdict was not valid JSON" };
  }
  if (obj && obj.approved === true) {
    return { approved: true, reason: String(obj.reason ?? "approved") };
  }
  return { approved: false, reason: String(obj?.reason ?? "Checker did not approve") };
}

/** Map a verdict onto the exit-code contract the driver's runChecker expects. */
export function verdictToExitCode(verdict) {
  return verdict.approved ? 0 : 1;
}

/**
 * True when a rejection reason reflects an INFRASTRUCTURE failure (the Checker
 * process could not run or emit a well-formed verdict) rather than a substantive
 * "the work is wrong" rejection. Matches the two non-substantive outcomes
 * `parseCheckerVerdict` produces: a missing verdict file and invalid JSON.
 *
 * The self-improvement miner uses this to avoid proposing a CONTENT rule for an
 * outage — a rule addressed to an agent cannot fix a beat where no agent ran
 * (the JuRaph session-limit incident: 47 "no verdict file" rejections that were
 * an outage, not a missing acceptance criterion).
 */
export function isInfraReason(reason) {
  const r = String(reason ?? "").toLowerCase();
  return r.includes("no verdict file") || r.includes("not valid json");
}

/**
 * Multi-vote / adversarial Checker (ADR-0001 Deferred → shipped). Run N
 * independent Checker processes and require a strict majority to approve. This is
 * the survey's "verify with N skeptics": any single skeptic that rejects lowers
 * the approval count, and a tie or minority approval fails safe to reject.
 * @param {Array<{approved:boolean,reason?:string}>} verdicts
 * @param {number} votes total number of Checkers that were supposed to run
 * @returns {{approved:boolean, reason:string, approvals:number, votes:number}}
 */
export function tallyVerdicts(verdicts, votes) {
  const n = Math.max(1, votes || (verdicts?.length ?? 1));
  const list = verdicts ?? [];
  const approvals = list.filter((v) => v && v.approved === true).length;
  // Strict majority of the intended vote count (missing/crashed votes count as reject).
  const approved = approvals > n / 2;
  // Per-vote reasons make a rejection DIAGNOSABLE (Loop-Robustness P1.2): the
  // caller can tell "no verdict file written" (plumbing/empty-diff) apart from an
  // explicit "Checker did not approve" (a genuine substantive rejection).
  const reasons = list.map((v) => v?.reason ?? "no verdict");
  return {
    approved,
    approvals,
    votes: n,
    reasons,
    reason: approved
      ? `${approvals}/${n} Checkers approved (majority)`
      : `${approvals}/${n} Checkers approved (no majority) — failing safe to reject`,
  };
}
