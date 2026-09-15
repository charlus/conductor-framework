// test/debugging-redaction.test.js
//
// C3 — debugging output is redacted before it is shown or saved.
//
// Evidence: the maintainer's own turn of 2026-09-08 in a live project, "the key
// was in clear for you and me", after a debugging session printed a credential.
// `handoff/SKILL.md` has a redaction rule ("no tokens, keys, or credentials in
// the document"); `systematic-debugging/SKILL.md`, the skill that actually
// prints commands, env dumps, logs and captured artefacts — unattended in the
// loop — had none. Matt Pocock's `diagnosing-bugs` gained a Redact section in
// 2026-08; taken because the leak is recorded here.
//
// Pinned: the skill names what to redact (tokens, keys, passwords, cookies,
// connection strings), the replacement marker, the `.env` rule, and what to do
// when a secret has already been shown (say so; treat it as leaked).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKILL = readFileSync(
  join(ROOT, "templates", ".agents", "skills", "systematic-debugging", "SKILL.md"),
  "utf8",
);

describe("C3 — systematic-debugging redacts", () => {
  test("a Redact rule exists and names the secret classes", () => {
    assert.match(SKILL, /redact/i, "no redaction rule");
    for (const cls of [/token/i, /key/i, /password/i, /cookie|session/i, /connection string|DATABASE_URL|DSN/i]) {
      assert.match(SKILL, cls, `redaction rule does not name ${cls}`);
    }
  });

  test("it names the marker and the .env rule", () => {
    assert.match(SKILL, /<REDACTED>|\[REDACTED\]|REDACTED/, "no replacement marker");
    assert.match(SKILL, /\.env/, "nothing about never pasting a .env file");
  });

  test("a secret already shown is treated as leaked, not ignored", () => {
    assert.match(SKILL, /leaked|rotate|say so/i, "no instruction for the case where a secret was already printed");
  });

  test("the rule is in the checklist the agent actually follows, not only in prose", () => {
    const checklist = SKILL.slice(SKILL.indexOf("## Debugging Checklist"));
    assert.match(checklist, /redact/i, "the Debugging Checklist has no redaction item");
  });
});
