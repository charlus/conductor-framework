import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStub } from "../src/stubs.js";

const TPL = [
  "<!-- conductor:managed:begin — managed -->",
  "# Framework v2",
  "read AGENTS.md",
  "<!-- conductor:managed:end -->",
  "",
  "<!-- add your notes below -->",
  "",
].join("\n");

test("fresh install returns the template verbatim", () => {
  assert.equal(renderStub(TPL, null), TPL);
});

test("existing with markers: block refreshed, user content preserved", () => {
  const existing = [
    "<!-- conductor:managed:begin — managed -->",
    "# Framework v1",
    "old pointer",
    "<!-- conductor:managed:end -->",
    "",
    "MY PROJECT NOTES",
    "",
  ].join("\n");
  const out = renderStub(TPL, existing);
  assert.ok(out.includes("# Framework v2"), "framework block refreshed to v2");
  assert.ok(!out.includes("# Framework v1"), "old framework block gone");
  assert.ok(out.includes("MY PROJECT NOTES"), "user content preserved");
});

test("legacy file with no markers: block added, old content preserved below", () => {
  const legacy = "# Framework v1\nold pointer\nMY PROJECT NOTES\n";
  const out = renderStub(TPL, legacy);
  assert.ok(out.includes("# Framework v2"), "managed block inserted");
  assert.ok(out.includes("MY PROJECT NOTES"), "old content preserved (nothing dropped)");
  assert.ok(out.indexOf("# Framework v2") < out.indexOf("MY PROJECT NOTES"), "block on top, old content below");
});

test("legacy file keeps YAML frontmatter on top", () => {
  const legacy = "---\ntrigger: always_on\n---\n\n# Framework v1\nMY NOTES\n";
  const out = renderStub(TPL, legacy);
  assert.ok(out.startsWith("---\ntrigger: always_on\n---\n"), "frontmatter stays first");
  assert.ok(out.includes("# Framework v2") && out.includes("MY NOTES"));
});

test("idempotent: re-rendering an already-managed file is stable", () => {
  const once = renderStub(TPL, renderStub(TPL, "<!-- conductor:managed:begin x -->\nold\n<!-- conductor:managed:end -->\n\nNOTES\n"));
  const twice = renderStub(TPL, once);
  assert.equal(twice, once);
});
