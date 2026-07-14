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
  const approvals = (verdicts ?? []).filter((v) => v && v.approved === true).length;
  // Strict majority of the intended vote count (missing/crashed votes count as reject).
  const approved = approvals > n / 2;
  return {
    approved,
    approvals,
    votes: n,
    reason: approved
      ? `${approvals}/${n} Checkers approved (majority)`
      : `${approvals}/${n} Checkers approved (no majority) — failing safe to reject`,
  };
}
