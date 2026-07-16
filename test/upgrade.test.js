import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { upgradeCommand } from "../src/commands/upgrade.js";
import { packageVersion } from "../src/version.js";
import { renameRecursive } from "../src/kebab.js";

const TEMPLATES = fileURLToPath(new URL("../templates", import.meta.url));

function sink() {
  let out = "";
  return { write: (s) => { out += s; }, get text() { return out; } };
}

async function runUpgrade(targetDir, extraArgs = []) {
  const stdout = sink();
  const stderr = sink();
  const code = await upgradeCommand([targetDir, ...extraArgs], { cwd: tmpdir(), stdout, stderr });
  return { code, stdout: stdout.text, stderr: stderr.text };
}

function tpl(rel) {
  return readFileSync(join(TEMPLATES, ".agents", rel), "utf8");
}

// Build a realistic V5-shape install with: an edited framework workflow, a custom
// skill, a user knowledge file, an edited framework template + a custom template,
// and a v1-schema loop-state.
function makeV5Install() {
  const dir = mkdtempSync(join(tmpdir(), "cond-v5-"));
  const A = join(dir, ".agents");
  mkdirSync(join(A, "workflows"), { recursive: true });
  mkdirSync(join(A, "skills", "code-review"), { recursive: true });
  mkdirSync(join(A, "skills", "acme-custom"), { recursive: true });
  mkdirSync(join(A, "rules"), { recursive: true });

  // Framework file the user edited (must be REPLACED on upgrade).
  writeFileSync(join(A, "workflows", "genesis.md"), tpl("workflows/genesis.md") + "\n<!-- USER EDIT junk -->\n");
  copyFileSync(join(TEMPLATES, ".agents", "AGENTS.md"), join(A, "AGENTS.md"));
  copyFileSync(join(TEMPLATES, ".agents", "skills", "code-review", "SKILL.md"), join(A, "skills", "code-review", "SKILL.md"));
  // Custom skill (must be CARRIED forward).
  writeFileSync(join(A, "skills", "acme-custom", "SKILL.md"), "---\nname: acme-custom\n---\ncustom\n");
  // Selections: user selected code-review + acme-custom.
  writeFileSync(join(A, ".selections.json"), JSON.stringify({ version: 1, skills: ["code-review", "acme-custom"], rules: [], workflows: ["genesis"], bundles: [] }));

  // A CLAUDE.md stub with an old managed block + a user note below it.
  writeFileSync(join(dir, "CLAUDE.md"),
    "<!-- conductor:managed:begin — managed -->\n# Conductor Framework V5\nOLD STUB BODY\n<!-- conductor:managed:end -->\n\nMY CLAUDE NOTES\n");

  // conductor/ — user knowledge (must be PRESERVED), framework 5-templates, v1 loop-state.
  const C = join(dir, "conductor");
  mkdirSync(join(C, "0-compass"), { recursive: true });
  writeFileSync(join(C, "0-compass", "north-star.md"), "MY APP KNOWLEDGE — do not touch\n");
  mkdirSync(join(C, "5-templates", "genesis-workflow"), { recursive: true });
  writeFileSync(join(C, "5-templates", "genesis-workflow", "problem-solar-system-template.md"), "OLD FRAMEWORK TEMPLATE\n");
  writeFileSync(join(C, "5-templates", "my-custom-template.md"), "MY CUSTOM TEMPLATE\n");
  mkdirSync(join(C, "1-workbench"), { recursive: true });
  writeFileSync(join(C, "1-workbench", "loop-state.json"), JSON.stringify({
    schema_version: 1, goal_description: "ship it",
    telemetry: { tokens_spent: 4321, consecutive_stalls: 2 },
  }));
  return dir;
}

test("upgrade replaces framework instructions, carries custom, preserves knowledge", async () => {
  const dir = makeV5Install();
  const { code } = await runUpgrade(dir);
  assert.equal(code, 0);

  // Framework file REPLACED (edit gone; matches current template).
  const genesis = readFileSync(join(dir, ".agents", "workflows", "genesis.md"), "utf8");
  assert.ok(!genesis.includes("USER EDIT junk"), "user edit to framework file should be overwritten");
  assert.equal(genesis, tpl("workflows/genesis.md"), "framework file should match current template");

  // Custom skill CARRIED forward.
  assert.ok(existsSync(join(dir, ".agents", "skills", "acme-custom", "SKILL.md")), "custom skill preserved");

  // New primitives LANDED (they postdate the selections file but are core).
  assert.ok(existsSync(join(dir, ".agents", "skills", "grilling", "SKILL.md")), "new core skill installed");

  // User knowledge PRESERVED untouched.
  assert.equal(readFileSync(join(dir, "conductor", "0-compass", "north-star.md"), "utf8"), "MY APP KNOWLEDGE — do not touch\n");

  // 5-templates: framework template refreshed, custom template kept.
  const refreshed = readFileSync(join(dir, "conductor", "5-templates", "genesis-workflow", "problem-solar-system-template.md"), "utf8");
  assert.ok(!refreshed.includes("OLD FRAMEWORK TEMPLATE"), "framework template refreshed");
  assert.ok(existsSync(join(dir, "conductor", "5-templates", "my-custom-template.md")), "custom template carried");

  // loop-state migrated v1 → v2 (fields folded, no data lost).
  const ls = JSON.parse(readFileSync(join(dir, "conductor", "1-workbench", "loop-state.json"), "utf8"));
  assert.equal(ls.schema_version, 2);
  assert.equal(ls.budget.tokens_spent, 4321, "tokens_spent folded into budget");
  assert.equal(ls.stall.consecutive, 2, "consecutive_stalls folded into stall");
  assert.equal(ls.goal_description, "ship it", "user goal preserved");

  // CLAUDE.md: managed block refreshed, user note preserved.
  const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
  assert.ok(!claude.includes("OLD STUB BODY"), "old managed block refreshed");
  assert.ok(claude.includes("Conductor Framework V6"), "managed block updated to current template");
  assert.ok(claude.includes("MY CLAUDE NOTES"), "user note outside the block preserved");

  // Version stamp written.
  const stamp = JSON.parse(readFileSync(join(dir, ".agents", ".conductor-version.json"), "utf8"));
  assert.equal(stamp.frameworkVersion, packageVersion());

  // Backup created, containing the OLD edited file; gitignore updated.
  const backupRoot = join(dir, ".conductor-backup");
  assert.ok(existsSync(backupRoot), "backup dir created");
  const stampDir = join(backupRoot, readdirSync(backupRoot)[0]);
  assert.ok(readFileSync(join(stampDir, ".agents", "workflows", "genesis.md"), "utf8").includes("USER EDIT junk"), "backup holds the old edit");
  assert.ok(readFileSync(join(dir, ".gitignore"), "utf8").includes(".conductor-backup/"), "gitignore updated");
});

test("upgrade migrates a V4-style root-folder install", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cond-v4-"));
  // Root numbered folders (no conductor/ wrapper), Title-Case, with user knowledge.
  mkdirSync(join(dir, "0-Compass"), { recursive: true });
  writeFileSync(join(dir, "0-Compass", "north-star.md"), "V4 KNOWLEDGE\n");
  // A minimal .agents/ with no checksums (the silent-no-op case).
  mkdirSync(join(dir, ".agents", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".agents", "workflows", "genesis.md"), "STALE V4 GENESIS\n");
  copyFileSync(join(TEMPLATES, ".agents", "AGENTS.md"), join(dir, ".agents", "AGENTS.md"));

  const { code } = await runUpgrade(dir);
  assert.equal(code, 0);

  // Root folder migrated into conductor/ and kebab-cased; knowledge preserved.
  assert.ok(existsSync(join(dir, "conductor", "0-compass", "north-star.md")), "root folder migrated + kebabbed");
  assert.equal(readFileSync(join(dir, "conductor", "0-compass", "north-star.md"), "utf8"), "V4 KNOWLEDGE\n");
  assert.ok(!existsSync(join(dir, "0-Compass")), "old root folder removed");

  // Stale instruction REPLACED even with no checksum baseline (no silent no-op).
  const genesis = readFileSync(join(dir, ".agents", "workflows", "genesis.md"), "utf8");
  assert.ok(!genesis.includes("STALE V4 GENESIS"), "stale instruction replaced despite missing checksums");
  assert.ok(existsSync(join(dir, ".agents", ".conductor-version.json")), "stamped");
});

test("--dry-run writes nothing", async () => {
  const dir = makeV5Install();
  const { code, stdout } = await runUpgrade(dir, ["--dry-run"]);
  assert.equal(code, 0);
  assert.match(stdout, /dry run/i);
  // Nothing changed.
  assert.ok(readFileSync(join(dir, ".agents", "workflows", "genesis.md"), "utf8").includes("USER EDIT junk"), "file untouched");
  assert.ok(!existsSync(join(dir, ".agents", ".conductor-version.json")), "no stamp written");
  assert.ok(!existsSync(join(dir, ".conductor-backup")), "no backup written");
});

test("kebab rename leaves canonically-cased framework files (Dockerfile) alone", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cond-kebab-"));
  mkdirSync(join(dir, "sandbox"), { recursive: true });
  writeFileSync(join(dir, "sandbox", "Dockerfile.sandbox"), "FROM node\n");
  writeFileSync(join(dir, "sandbox", "Some-Doc.md"), "x\n"); // this one SHOULD kebab
  await renameRecursive(dir);
  assert.ok(existsSync(join(dir, "sandbox", "Dockerfile.sandbox")), "Dockerfile.sandbox untouched");
  assert.ok(!existsSync(join(dir, "sandbox", "dockerfile.sandbox")), "no lowercase duplicate");
  assert.ok(existsSync(join(dir, "sandbox", "some-doc.md")), "ordinary file kebab-cased");
});

test("upgrade is idempotent (second run succeeds and stays current)", async () => {
  const dir = makeV5Install();
  assert.equal((await runUpgrade(dir)).code, 0);
  const { code, stdout } = await runUpgrade(dir);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Already on ${packageVersion().replace(/\./g, "\\.")}`));
});
