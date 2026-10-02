// test/loop-config.test.js
//
// The `loop` block of conductor.config.json (field report F2–F5) and the pure
// helpers built on it: forge from the origin host (F4), the generated sandbox
// settings (F3), and the setup command (F2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLoopConfig, forgeFromRemote, resolveForge, mergeSandboxSettings } from "../src/loop/config.js";

test("parseLoopConfig: absent block → defaults, no errors", () => {
  const c = parseLoopConfig({ registry: "x" });
  assert.deepEqual(c.errors, []);
  assert.equal(c.forge, null);
  assert.equal(c.setup, null);
  assert.deepEqual(c.allowedDomains, []);
  assert.equal(c.requireReady, false);
  assert.deepEqual(c.priorities, []);
  assert.equal(c.inbox, true);
});

test("parseLoopConfig: reads every key", () => {
  const c = parseLoopConfig({
    loop: {
      forge: "glab",
      setup: "python -m venv .venv && .venv/bin/pip install -r requirements.txt",
      allowed_domains: ["pypi.org", "files.pythonhosted.org", "*.euranova.eu"],
      require_ready: true,
      priorities: ["p1", "P2"],
      inbox: false,
    },
  });
  assert.deepEqual(c.errors, []);
  assert.equal(c.forge, "glab");
  assert.match(c.setup, /pip install/);
  assert.deepEqual(c.allowedDomains, ["pypi.org", "files.pythonhosted.org", "*.euranova.eu"]);
  assert.equal(c.requireReady, true);
  assert.deepEqual(c.priorities, ["P1", "P2"]);
  assert.equal(c.inbox, false);
});

test("parseLoopConfig: invalid values are errors, never silently ignored", () => {
  const c = parseLoopConfig({
    loop: { forge: "bitbucket", setup: 3, allowed_domains: ["pypi.org", "https://evil.example/x", "*"], priorities: ["high"], require_ready: "yes" },
  });
  assert.equal(c.errors.length, 6);
  assert.ok(c.errors.some((e) => /loop\.forge/.test(e)));
  assert.ok(c.errors.some((e) => /https:\/\/evil/.test(e)));
  assert.ok(c.errors.some((e) => /'\*'/.test(e)));
});

test("F4: forgeFromRemote maps github.com to gh and any other host to glab", () => {
  assert.deepEqual(forgeFromRemote("https://github.com/a/b.git"), { forge: "gh", host: "github.com" });
  assert.deepEqual(forgeFromRemote("git@github.com:a/b.git"), { forge: "gh", host: "github.com" });
  assert.deepEqual(forgeFromRemote("ssh://git@code.euranova.eu:2222/g/p.git"), { forge: "glab", host: "code.euranova.eu" });
  assert.deepEqual(forgeFromRemote("https://oauth2:tok@code.euranova.eu/g/p.git"), { forge: "glab", host: "code.euranova.eu" });
  assert.deepEqual(forgeFromRemote("git@gitlab.com:g/p.git"), { forge: "glab", host: "gitlab.com" });
  assert.equal(forgeFromRemote(""), null);
  assert.equal(forgeFromRemote("/local/path/repo.git"), null);
});

test("F4: resolveForge — override wins, then the remote, else an error", () => {
  assert.deepEqual(resolveForge({ override: "gh", remoteUrl: "git@code.euranova.eu:g/p.git" }), { forge: "gh", source: "loop.forge", host: "code.euranova.eu" });
  assert.deepEqual(resolveForge({ override: null, remoteUrl: "git@code.euranova.eu:g/p.git" }), { forge: "glab", source: "origin host code.euranova.eu", host: "code.euranova.eu" });
  const none = resolveForge({ override: null, remoteUrl: "" });
  assert.equal(none.forge, null);
  assert.match(none.error, /loop\.forge/);
});

test("F3: mergeSandboxSettings adds domains without touching the template or dropping its own", () => {
  const template = { sandbox: { enabled: true, failIfUnavailable: true, network: { allowedDomains: ["api.anthropic.com", "github.com"] } } };
  const before = JSON.stringify(template);
  const out = mergeSandboxSettings(template, ["pypi.org", "github.com"]);
  assert.equal(JSON.stringify(template), before);
  assert.deepEqual(out.sandbox.network.allowedDomains, ["api.anthropic.com", "github.com", "pypi.org"]);
  assert.equal(out.sandbox.failIfUnavailable, true);
  assert.equal(out.sandbox.enabled, true);
});
