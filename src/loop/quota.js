// src/loop/quota.js
//
// I2 (owner, 2026-10-23): "when the loop reached the quota, it just stops, it
// would be nice to wait for the quota to be full again." The agent CLI says
// when its limit resets: Claude Code prints "You've hit your session limit ·
// resets 6:40pm (Europe/Brussels)" (autopportunity, 2026-10-22), older builds
// "Claude AI usage limit reached|<epoch>". The run sleeps until that time plus
// a margin, then runs the same beat again. No reset time, or a reset further
// away than `loop.quota_max_wait_min`, and the dead beat goes back to the
// driver, which stops the run as before (A14). Pure except `withQuotaWait`,
// whose clock and sleep are injected.

import { classifyBeatResult } from "./driver.js";

/** Default wider than a 5-hour session window; a weekly limit is further away and stops the run. */
export const DEFAULT_QUOTA_MAX_WAIT_MIN = 330;
/** Wait this long past the announced reset, so the first beat after it is not refused again. */
export const DEFAULT_QUOTA_MARGIN_S = 60;
/** Waits in a row for one beat before the limit is taken as final. */
const MAX_WAITS = 3;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Milliseconds the wall clock in `timeZone` is ahead of UTC at instant `t`. Throws on an unknown zone. */
function zoneOffset(t, timeZone) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - Math.floor(t / 1000) * 1000;
}

/** The instant whose wall clock in `timeZone` reads y-mo-d h:mi. */
function zonedInstant({ y, mo, d, h, mi }, timeZone) {
  const guess = Date.UTC(y, mo, d, h, mi);
  const first = guess - zoneOffset(guess, timeZone);
  return guess - zoneOffset(first, timeZone);
}

/** Today's date on the wall clock of `timeZone`. */
function zonedDate(t, timeZone) {
  const local = new Date(t + zoneOffset(t, timeZone));
  return { y: local.getUTCFullYear(), mo: local.getUTCMonth(), d: local.getUTCDate() };
}

const RESET = new RegExp(
  String.raw`resets?\s+(?:on\s+)?(?:(` + MONTHS.join("|") + String.raw`)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?(?:\s*\(([^)]+)\))?`,
  "i"
);

/**
 * When the limit in `text` resets, in ms since the epoch, or null when the text
 * names no time or names a zone this machine does not know. A time without a
 * date is its next occurrence after `now`; without a zone, the machine's zone.
 */
export function parseResetTime(text, now = Date.now()) {
  const s = String(text ?? "");
  const epoch = s.match(/\|(\d{10,13})\b/);
  if (epoch) return epoch[1].length === 13 ? Number(epoch[1]) : Number(epoch[1]) * 1000;
  const m = s.match(RESET);
  if (!m) return null;
  const [, month, day, hh, mm, ap, zone] = m;
  // "resets 5" alone is not a time: a clock time has minutes or am/pm.
  if (mm == null && !ap) return null;
  let h = Number(hh);
  const mi = Number(mm ?? 0);
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap.toLowerCase() === "p" ? 12 : 0);
  }
  if (h > 23 || mi > 59) return null;
  const timeZone = zone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    if (month) {
      const today = zonedDate(now, timeZone);
      const mo = MONTHS.indexOf(month.slice(0, 3).toLowerCase());
      let t = zonedInstant({ y: today.y, mo, d: Number(day), h, mi }, timeZone);
      if (t < now - 86400000) t = zonedInstant({ y: today.y + 1, mo, d: Number(day), h, mi }, timeZone);
      return t;
    }
    const today = zonedDate(now, timeZone);
    let t = zonedInstant({ ...today, h, mi }, timeZone);
    if (t <= now) {
      const tomorrow = zonedDate(now + 86400000, timeZone);
      t = zonedInstant({ ...tomorrow, h, mi }, timeZone);
    }
    return t;
  } catch {
    return null;
  }
}

const clock = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Wait or stop? `maxWaitMin` 0 turns waiting off.
 * @returns {{wait: true, until: number, resetAt: number} | {wait: false, reason: string}}
 */
export function quotaWaitPlan({ text, now, maxWaitMin = DEFAULT_QUOTA_MAX_WAIT_MIN, marginS = DEFAULT_QUOTA_MARGIN_S }) {
  if (!(maxWaitMin > 0)) return { wait: false, reason: "waiting for the limit is turned off (loop.quota_max_wait_min is 0)" };
  const resetAt = parseResetTime(text, now);
  if (resetAt == null) return { wait: false, reason: "the agent CLI gave no reset time" };
  const until = Math.max(resetAt, now) + marginS * 1000;
  if (until - now > maxWaitMin * 60000) return { wait: false, reason: `the limit resets ${new Date(resetAt).toISOString().slice(0, 16).replace("T", " ")} UTC, more than ${maxWaitMin} minutes away (loop.quota_max_wait_min)` };
  return { wait: true, until, resetAt };
}

/**
 * Wrap one beat runner: a beat that hit a usage limit with a reset time in
 * reach sleeps until then and runs again, at most MAX_WAITS times in a row.
 * Anything else, including a limit it cannot wait for, is returned as it came.
 * `onWait({until, resetAt, text})` is told before each sleep.
 */
export function withQuotaWait(run, { maxWaitMin = DEFAULT_QUOTA_MAX_WAIT_MIN, marginS = DEFAULT_QUOTA_MARGIN_S, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onWait = () => {}, onResume = () => {} } = {}) {
  return async (opts) => {
    let result = await run(opts);
    for (let waits = 0; waits < MAX_WAITS; waits++) {
      const verdict = classifyBeatResult(result);
      if (!verdict.dead || verdict.kind !== "usage_limit") return result;
      const text = `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`;
      const plan = quotaWaitPlan({ text, now: now(), maxWaitMin, marginS });
      if (!plan.wait) {
        result.quotaNote = plan.reason;
        return result;
      }
      await onWait({ until: plan.until, resetAt: plan.resetAt, text, clock: clock(plan.until) }, opts);
      await sleep(Math.max(0, plan.until - now()));
      await onResume({ until: plan.until }, opts);
      result = await run(opts);
    }
    return result;
  };
}
