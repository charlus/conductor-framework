// Hook registry drift (F3).
//
// ECC pins its hook graph with a fingerprinted sidecar so a reorder or an
// edited command that skips the sidecar fails CI. We have no hooks.json to
// mirror, so copying the sidecar would be cargo cult. What we DO have is three
// places that must agree and are only kept in sync by someone remembering:
//
//   1. the hook files on disk
//   2. the table in hooks/README.md that tells the user they exist
//   3. EXECUTABLE_HOOKS in install-hooks.js, which sets the executable bit
//
// Adding this session's two gates I had to update all three by hand, and
// missing (3) would have shipped a hook that silently never runs. That is the
// drift worth pinning.
//
// Deliberately NOT a content checksum. A hash that fails on every legitimate
// edit gets regenerated without being read, which is how a safety check gets
// trained out. These assert AGREEMENT between sources, not immutability.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const HOOKS = join(ROOT, "templates/.agents/hooks");
const read = (p) => readFileSync(p, "utf8");

const README = read(join(HOOKS, "README.md"));
const INSTALL = read(join(ROOT, "src/commands/install-hooks.js"));

/** Hook entry points: everything in hooks/ that is not the README or the shared lib. */
const hookFiles = readdirSync(HOOKS).filter((f) => f !== "README.md" && f !== "lib.sh");

describe("F3 — the hook registry cannot drift", () => {
  test("every hook file is documented in the README table", () => {
    const missing = hookFiles.filter((f) => !README.includes(f));
    assert.deepEqual(
      missing,
      [],
      `hook files with no README row: ${missing.join(", ")}. A gate the user ` +
        `cannot discover is a gate they will not wire up.`,
    );
  });

  test("every hook the README names exists on disk", () => {
    // Rows reference the file in a code span or a path.
    const named = [...README.matchAll(/`([a-z0-9-]+\.sh)`|\.agents\/hooks\/([a-z0-9-]+\.sh)/g)]
      .map((m) => m[1] || m[2])
      .filter((v, i, a) => a.indexOf(v) === i);
    const onDisk = new Set([...hookFiles, "lib.sh"]); // lib.sh has a README row too
    const ghosts = named.filter((f) => !onDisk.has(f));
    assert.deepEqual(ghosts, [], `README documents hooks that do not exist: ${ghosts.join(", ")}`);
  });

  test("every hook entry point is in install-hooks' executable list", () => {
    // The bit matters: a copied hook without +x is a hook that never fires,
    // and nothing else in the suite would notice.
    const missing = hookFiles.filter((f) => !INSTALL.includes(`"${f}"`));
    assert.deepEqual(
      missing,
      [],
      `hooks missing from EXECUTABLE_HOOKS in src/commands/install-hooks.js: ${missing.join(", ")}`,
    );
  });

  test("git hooks keep their extensionless names", () => {
    // git only runs core.hooksPath entries named exactly pre-commit / pre-push.
    for (const name of ["pre-commit", "pre-push"]) {
      assert.ok(hookFiles.includes(name), `${name} must exist, unsuffixed, for git to run it`);
    }
  });
});

describe("F3 — every gate's waiver is implemented and documented", () => {
  // The contract a user actually depends on: the escape hatch printed in a
  // denial must exist in the code, and every hatch the code honours must be
  // written down. An undocumented waiver is a trapdoor; a documented one that
  // does nothing is worse — it looks like an answer and blocks anyway.
  const gateSources = ["pre-commit", "pre-push", "verification-stop-hook.sh", "pretooluse-no-bypass.sh"]
    .map((f) => read(join(HOOKS, f)))
    .join("\n");

  const envVars = (text) =>
    [...text.matchAll(/CONDUCTOR_(?:NO|SKIP)_[A-Z_]+/g)]
      .map((m) => m[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();

  test("every waiver the hooks honour is documented in the README", () => {
    const implemented = envVars(gateSources);
    const undocumented = implemented.filter((v) => !README.includes(v));
    assert.deepEqual(
      undocumented,
      [],
      `waivers the hooks accept but the README never mentions: ${undocumented.join(", ")}`,
    );
  });

  test("every waiver the README promises is honoured by a hook", () => {
    const documented = envVars(README);
    const phantom = documented.filter((v) => !gateSources.includes(v));
    assert.deepEqual(
      phantom,
      [],
      `waivers the README promises but no hook reads: ${phantom.join(", ")}`,
    );
  });

  test("every waiver is logged to the ship-log, never silent", () => {
    // The whole contract is "bypass is allowed, silence is not". A waiver that
    // skips conductor_log_waiver would be an unauditable hole.
    const preCommit = read(join(HOOKS, "pre-commit"));
    // Anchor on the guard itself — `if [ -n "${CONDUCTOR_NO_X:-}" ]; then` —
    // and require the log call in the branch it opens. Splitting on section
    // comments instead reads the file header, which lists every waiver in
    // prose and has no code in it.
    const guards = [...preCommit.matchAll(/if \[ -n "\$\{(CONDUCTOR_NO_[A-Z]+):-\}" \]; then\n([\s\S]{0,400}?)\n  else/g)];
    assert.ok(guards.length >= 4, `expected at least 4 waived gates in pre-commit, found ${guards.length}`);
    for (const [, name, body] of guards) {
      assert.match(
        body,
        /conductor_log_waiver/,
        `the ${name} gate accepts a waiver without logging it to the ship-log`,
      );
    }
  });
});
