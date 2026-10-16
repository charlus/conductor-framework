// test/sandbox-credentials.test.js
//
// The PR-gated merge holds only if a maker or checker beat cannot push or open a
// PR itself. The cli-native profile allows github.com egress, and Claude Code's
// sandbox has no built-in credential deny list: sandboxed commands read most of
// the home directory and inherit the environment. So the profile must withhold
// the forge credentials from both the shell (sandbox.credentials) and Claude's
// own Read tool, which the sandbox does not cover (permissions.deny).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeSandboxSettings } from "../src/loop/config.js";

const profile = JSON.parse(readFileSync(new URL("../templates/.agents/sandbox/claude-sandbox.settings.json", import.meta.url), "utf8"));

const CREDENTIAL_FILES = ["~/.ssh", "~/.config/gh", "~/.config/glab-cli", "~/.git-credentials", "~/.config/git/credentials", "~/.netrc"];
const CREDENTIAL_ENV = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITLAB_TOKEN", "GLAB_TOKEN", "SSH_AUTH_SOCK", "DBUS_SESSION_BUS_ADDRESS"];

const denied = (entries, key) => new Set((entries ?? []).filter((e) => e.mode === "deny").map((e) => e[key]));

test("sandboxed shell commands cannot read the forge credential files", () => {
  const files = denied(profile.sandbox?.credentials?.files, "path");
  for (const f of CREDENTIAL_FILES) assert.ok(files.has(f), `sandbox.credentials.files must deny ${f}`);
});

test("sandboxed shell commands do not inherit forge tokens, the SSH agent or the keyring bus", () => {
  const env = denied(profile.sandbox?.credentials?.envVars, "name");
  for (const v of CREDENTIAL_ENV) assert.ok(env.has(v), `sandbox.credentials.envVars must deny ${v}`);
});

test("Claude's Read tool, which the sandbox does not cover, cannot read them either", () => {
  const deny = new Set(profile.permissions?.deny ?? []);
  for (const f of CREDENTIAL_FILES) assert.ok(deny.has(`Read(${f}/**)`) || deny.has(`Read(${f})`), `permissions.deny must include Read(${f}…)`);
});

test("merging project domains keeps the credential protection", () => {
  const out = mergeSandboxSettings(profile, ["pypi.org"]);
  assert.deepEqual(out.sandbox.credentials, profile.sandbox.credentials);
  assert.deepEqual(out.permissions, profile.permissions);
});
