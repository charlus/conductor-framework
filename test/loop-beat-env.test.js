// test/loop-beat-env.test.js
//
// P4 of the verification-cost work: a beat runs with the provider API keys of
// the app blank. On autopportunity (2026-10-22) `loop.setup` copies
// `.env.example`, whose placeholder Gemini key sends app code down the
// "provider configured" path; behind the sandbox's blocked network each such
// test waited on a 600 s client deadline. An empty variable in the beat's
// environment wins over the `.env` file for `load_dotenv()` and for
// pydantic-settings, so the app sees no key. The engine's own key is never
// blanked: the beat would lose its own authentication.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BLANK_ENV, blankedNames, beatEnv, withBeatEnv } from "../src/loop/beat-env.js";
import { parseLoopConfig } from "../src/loop/config.js";

test("the default list names the common provider keys", () => {
  for (const k of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) assert.ok(DEFAULT_BLANK_ENV.includes(k), k);
});

test("the engine's own key is never blanked", () => {
  assert.ok(!blankedNames(DEFAULT_BLANK_ENV, "claude").includes("ANTHROPIC_API_KEY"));
  assert.ok(blankedNames(DEFAULT_BLANK_ENV, "claude").includes("GEMINI_API_KEY"));
  assert.ok(!blankedNames(DEFAULT_BLANK_ENV, "codex").includes("OPENAI_API_KEY"));
  assert.ok(!blankedNames(DEFAULT_BLANK_ENV, "antigravity").includes("GEMINI_API_KEY"));
  assert.ok(!blankedNames(["CLAUDE_CODE_OAUTH_TOKEN"], "claude").length, "a listed engine credential is dropped too");
});

test("beatEnv sets each named variable to empty and keeps the rest", () => {
  const env = beatEnv(["GEMINI_API_KEY", "OPENAI_API_KEY"], { PATH: "/bin", GEMINI_API_KEY: "real", ANTHROPIC_API_KEY: "mine" });
  assert.equal(env.GEMINI_API_KEY, "");
  assert.equal(env.OPENAI_API_KEY, "", "a variable absent from the parent is set empty too, so the .env value cannot fill it");
  assert.equal(env.ANTHROPIC_API_KEY, "mine");
  assert.equal(env.PATH, "/bin");
});

test("withBeatEnv passes the environment to every beat and leaves other options alone", async () => {
  const seen = [];
  const raw = { name: "claude", runBeat: async (o) => (seen.push(o), { exitCode: 0 }), runChecker: async (o) => (seen.push(o), { exitCode: 0 }) };
  const a = withBeatEnv(raw, { X: "" });
  await a.runBeat({ cwd: "/w" });
  await a.runChecker({ cwd: "/w", model: "m" });
  assert.deepEqual(seen.map((o) => [o.cwd, o.env?.X, o.model]), [["/w", "", undefined], ["/w", "", "m"]]);
  assert.equal(withBeatEnv(raw, null), raw, "no list, no wrapper");
});

test("loop.blank_env: default list, [] turns it off, a bad value is an error", () => {
  assert.deepEqual(parseLoopConfig({}).blankEnv, DEFAULT_BLANK_ENV);
  assert.deepEqual(parseLoopConfig({ loop: { blank_env: [] } }).blankEnv, []);
  assert.deepEqual(parseLoopConfig({ loop: { blank_env: ["MISTRAL_API_KEY"] } }).blankEnv, ["MISTRAL_API_KEY"]);
  const bad = parseLoopConfig({ loop: { blank_env: ["not a name"] } });
  assert.ok(bad.errors.some((e) => /loop\.blank_env/.test(e)), bad.errors.join("\n"));
});
