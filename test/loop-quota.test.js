// test/loop-quota.test.js
//
// I2 (owner, 2026-10-23): "when the loop reached the quota, it just stops, it
// would be nice to wait for the quota to be full again." Claude Code prints the
// reset time ("You've hit your session limit · resets 6:40pm (Europe/Brussels)",
// read from autopportunity's log of 2026-10-22). The run sleeps until then plus a
// margin and runs the same beat again; without a reset time, or past the
// owner's maximum wait, it stops as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResetTime, quotaWaitPlan, withQuotaWait } from "../src/loop/quota.js";

const at = (iso) => Date.parse(iso);

test("the real message: '6:40pm (Europe/Brussels)' is the next 18:40 in Brussels", () => {
  // 2026-10-22 16:39 UTC is 18:39 in Brussels (CEST, UTC+2).
  const now = at("2026-10-22T16:39:31Z");
  const t = parseResetTime("You've hit your session limit · resets 6:40pm (Europe/Brussels)", now);
  assert.equal(new Date(t).toISOString(), "2026-10-22T16:40:00.000Z");
});

test("a reset time already past today is tomorrow", () => {
  const now = at("2026-10-22T20:00:00Z"); // 22:00 in Brussels
  const t = parseResetTime("resets 6:40pm (Europe/Brussels)", now);
  assert.equal(new Date(t).toISOString(), "2026-10-23T16:40:00.000Z");
});

test("24-hour times, 'at', and winter time are read", () => {
  // 2026-12-01: Brussels is UTC+1.
  const now = at("2026-12-01T08:00:00Z");
  assert.equal(new Date(parseResetTime("usage limit reached, resets at 14:05 (Europe/Brussels)", now)).toISOString(), "2026-12-01T13:05:00.000Z");
  assert.equal(new Date(parseResetTime("resets 12am (UTC)", now)).toISOString(), "2026-12-02T00:00:00.000Z");
  assert.equal(new Date(parseResetTime("resets 12:30pm (UTC)", now)).toISOString(), "2026-12-01T12:30:00.000Z");
});

test("the '|<epoch>' form, in seconds or milliseconds", () => {
  const now = at("2026-10-22T16:00:00Z");
  const s = Math.round(at("2026-10-22T17:00:00Z") / 1000);
  assert.equal(parseResetTime(`Claude AI usage limit reached|${s}`, now), s * 1000);
  assert.equal(parseResetTime(`Claude AI usage limit reached|${s * 1000}`, now), s * 1000);
});

test("a date in the message is used ('resets Oct 28, 9am')", () => {
  const now = at("2026-10-22T16:00:00Z");
  assert.equal(new Date(parseResetTime("You've hit your weekly limit · resets Oct 28, 9am (UTC)", now)).toISOString(), "2026-10-28T09:00:00.000Z");
});

test("no reset time, or an unknown time zone, gives null", () => {
  const now = at("2026-10-22T16:00:00Z");
  assert.equal(parseResetTime("You've hit your session limit", now), null);
  assert.equal(parseResetTime("resets 6:40pm (Mars/Olympus)", now), null);
});

test("the plan: wait until the reset plus the margin, within the owner's maximum", () => {
  const now = at("2026-10-22T16:39:31Z");
  const text = "You've hit your session limit · resets 6:40pm (Europe/Brussels)";
  const p = quotaWaitPlan({ text, now, maxWaitMin: 330, marginS: 60 });
  assert.equal(p.wait, true);
  assert.equal(new Date(p.until).toISOString(), "2026-10-22T16:41:00.000Z");
  const far = quotaWaitPlan({ text: "resets Oct 28, 9am (UTC)", now, maxWaitMin: 330, marginS: 60 });
  assert.equal(far.wait, false);
  assert.match(far.reason, /more than 330 minutes/);
  const none = quotaWaitPlan({ text: "You've hit your session limit", now, maxWaitMin: 330, marginS: 60 });
  assert.equal(none.wait, false);
  assert.match(none.reason, /no reset time/);
  const off = quotaWaitPlan({ text, now, maxWaitMin: 0, marginS: 60 });
  assert.equal(off.wait, false);
});

test("withQuotaWait runs the same beat again after the wait, and passes a beat that is not a limit through", async () => {
  let clock = at("2026-10-22T16:39:31Z");
  const slept = [];
  const said = [];
  const results = [
    { exitCode: 1, stdout: "You've hit your session limit · resets 6:40pm (Europe/Brussels)", stderr: "" },
    { exitCode: 0, stdout: "done", stderr: "" },
  ];
  let calls = 0;
  const beat = withQuotaWait(async () => results[calls++], {
    maxWaitMin: 330,
    marginS: 60,
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    onWait: (w) => said.push(w),
  });
  const r = await beat({ cwd: "/x" });
  assert.equal(r.stdout, "done");
  assert.equal(calls, 2);
  assert.deepEqual(slept, [89000]);
  assert.equal(new Date(said[0].until).toISOString(), "2026-10-22T16:41:00.000Z");
});

test("withQuotaWait gives the dead beat back when it cannot wait, so the run stops as before", async () => {
  const dead = { exitCode: 1, stdout: "You've hit your session limit", stderr: "" };
  const beat = withQuotaWait(async () => dead, { maxWaitMin: 330, marginS: 60, now: () => 0, sleep: async () => assert.fail("no sleep") });
  assert.equal(await beat({}), dead);
});

test("withQuotaWait waits at most a few times in a row, then gives the beat back", async () => {
  let clock = at("2026-10-22T16:39:31Z");
  // A limit that keeps moving: each refusal names a reset two minutes ahead.
  let calls = 0;
  let last = null;
  const beat = withQuotaWait(async () => {
    calls += 1;
    last = { exitCode: 1, stdout: `Claude AI usage limit reached|${Math.round((clock + 120000) / 1000)}`, stderr: "" };
    return last;
  }, { maxWaitMin: 330, marginS: 60, now: () => clock, sleep: async (ms) => { clock += ms; } });
  assert.equal(await beat({}), last);
  assert.equal(calls, 4, "three waits, then the limit stands");
});

test("a reset time already passed means tomorrow: beyond the maximum wait, so the run stops", async () => {
  let clock = at("2026-10-22T16:39:31Z");
  const limit = { exitCode: 1, stdout: "You've hit your session limit · resets 6:40pm (Europe/Brussels)", stderr: "" };
  let calls = 0;
  const beat = withQuotaWait(async () => {
    calls += 1;
    return limit;
  }, { maxWaitMin: 330, marginS: 60, now: () => clock, sleep: async (ms) => { clock += ms; } });
  const r = await beat({});
  assert.equal(calls, 2);
  assert.match(r.quotaNote, /more than 330 minutes away/);
});
