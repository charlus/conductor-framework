// test/skill-spec.test.js
//
// Codex, Antigravity, Cursor and Copilot read `.agents/skills/` natively, against
// the Agent Skills specification (agentskills.io/specification): `name` is
// 1–64 characters of lowercase letters, digits and single hyphens, and equals the
// skill's folder name; `description` is required and at most 1024 characters.
// A skill that breaks either rule may load under a wrong name or not at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SKILLS = new URL("../templates/.agents/skills/", import.meta.url).pathname;
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const skills = readdirSync(SKILLS)
  .filter((d) => existsSync(join(SKILLS, d, "SKILL.md")))
  .map((dir) => {
    const fm = readFileSync(join(SKILLS, dir, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const field = (k) => fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
    return { dir, name: field("name"), description: field("description") };
  });

test("every core skill has a spec-valid name equal to its folder", () => {
  assert.ok(skills.length > 0);
  const bad = skills.filter((s) => s.name !== s.dir || !NAME_RE.test(s.name ?? "") || s.name.length > 64);
  assert.deepEqual(bad.map((s) => `${s.dir} -> ${s.name}`), []);
});

test("every core skill has a description within the spec limit", () => {
  const bad = skills.filter((s) => !s.description || s.description.length > 1024);
  assert.deepEqual(bad.map((s) => s.dir), []);
});
