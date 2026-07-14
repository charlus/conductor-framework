// src/commands/loop.js
//
// `conductor loop` — the deterministic autonomy driver as a CLI subcommand
// (ADR-0001 / Autonomous-Loop-Backend.md). Thins over src/loop/driver.js: this
// file is the IO shell (read/persist state, run git + verify, pick the adapter);
// all guarantees live in the pure driver so `node --test` can exercise them.

import { readFile, writeFile, rename, access, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { runLoop, normalizeState, resolveVerifyCommand } from "../loop/driver.js";
import { resolveAdapter } from "../loop/adapters/index.js";
import { createWorktree, teardownWorktree } from "../loop/worktree.js";
import { parseCheckerVerdict, verdictToExitCode, VERDICT_REL } from "../loop/checker.js";
import { openPullRequest } from "../loop/merge.js";

const STATE_REL = "conductor/1-workbench/loop-state.json";
const WORKFLOW_REL = ".agents/workflows/unattended-loop.md";
const CHECKER_WORKFLOW_REL = ".agents/workflows/loop-checker.md";

/** One-line description of what an autonomy level permits (for dry-run). */
function autonomySummary(state) {
  switch (state.autonomy_level) {
    case "L0":
      return "interactive-only — loop will not run";
    case "L1":
      return "single beat, then human review (no merge)";
    case "L2":
      return "unattended blueprint only (no code merge)";
    case "L3":
      return "unattended execution in sandbox, PR-gated merge";
    default:
      return "unknown level";
  }
}

/** Parse `--flag value` or `--flag=value`; returns null if absent. */
function flagValue(args, flag) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("-")) return args[i + 1];
  return null;
}

async function exists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Atomic state write: temp file + rename, so a kill mid-beat never corrupts the Spine. */
async function atomicWriteJson(path, obj) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

function sh(cmd, cwd) {
  return new Promise((res) => {
    const child = spawn(cmd, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("error", () => res({ exitCode: 1, output: out }));
    child.on("close", (code) => res({ exitCode: code ?? 1, output: out }));
  });
}

async function gitHead(cwd) {
  const { exitCode, output } = await sh("git rev-parse HEAD", cwd);
  return exitCode === 0 ? output.trim() : "";
}

/** Structured git runner for the worktree module: git(args) -> {ok, stdout}. */
function makeGit(cwd) {
  return (gitArgs) => runCli("git", gitArgs, cwd);
}

/** Run an arbitrary CLI: run(cmd, args) -> {ok, stdout}. */
function runCli(cmd, argv, cwd) {
  return new Promise((res) => {
    const child = spawn(cmd, argv, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("error", () => res({ ok: false, stdout: "" }));
    child.on("close", (code) => res({ ok: code === 0, stdout: out.trim() }));
  });
}

/** True if a CLI responds to `--version`. */
async function cliAvailable(cmd) {
  const r = await runCli(cmd, ["--version"], undefined);
  return r.ok;
}

/** Append one auditable line to the ship-log (best-effort; never throws). */
async function appendShipLog(root, message, now) {
  const log = join(root, "conductor/0-compass/ship-log.md");
  const stamp = new Date(now).toISOString();
  try {
    const prev = (await exists(log)) ? await readFile(log, "utf8") : "# Ship Log\n";
    await writeFile(log, `${prev}- [${stamp}] [loop] ${message}\n`, "utf8");
  } catch {
    /* best-effort audit trail */
  }
}

async function hasNpmTestScript(root) {
  const pkgPath = join(root, "package.json");
  if (!(await exists(pkgPath))) return false;
  try {
    const pkg = await readJson(pkgPath);
    return Boolean(pkg.scripts && pkg.scripts.test);
  } catch {
    return false;
  }
}

async function configVerify(root) {
  const cfgPath = join(root, "conductor.config.json");
  if (!(await exists(cfgPath))) return "";
  try {
    return (await readJson(cfgPath)).verify ?? "";
  } catch {
    return "";
  }
}

async function writeInbox(root, state, reason) {
  const inbox = join(root, "conductor/1-workbench/inbox.md");
  const line = `\n## [loop] Escalation — ${state.status}\n${reason}\n(goal: ${state.goal_description || "n/a"}, beat ${state.iterations.current}/${state.iterations.max_allowed})\n`;
  try {
    const prev = (await exists(inbox)) ? await readFile(inbox, "utf8") : "";
    await writeFile(inbox, prev + line, "utf8");
  } catch {
    /* best-effort escalation */
  }
}

export async function loopCommand(args, { cwd, stdout, stderr }) {
  const positional = args.find((a) => !a.startsWith("-"));
  const root = resolve(cwd, positional || ".");
  const statePath = join(root, STATE_REL);
  const unsafe = args.includes("--unsafe-no-sandbox");
  const dryRun = args.includes("--dry-run");
  const platformFlag = flagValue(args, "--platform");

  if (!(await exists(statePath))) {
    stderr.write(`No ${STATE_REL} found. Run 'conductor init' or 'conductor upgrade' first.\n`);
    return 1;
  }

  // Load + migrate v1 → v2 (normalizeState is additive-safe; persist the upgrade).
  let raw;
  try {
    raw = await readJson(statePath);
  } catch (e) {
    stderr.write(`Could not parse ${STATE_REL}: ${e.message}\n`);
    return 1;
  }
  const state = normalizeState(raw);
  await atomicWriteJson(statePath, state);

  // Resolve the verify command up front (mirrors conductor_verify_cmd).
  const verifyCommand = resolveVerifyCommand({
    stateCommand: state.verification.command,
    configVerify: await configVerify(root),
    hasNpmTestScript: await hasNpmTestScript(root),
  });

  // SAFETY BOUNDARY (Phase 1): no sandbox yet (that's Phase 3). Looping an agent
  // with shell access unsandboxed is the very thing the survey (§5) prohibits.
  // Refuse real runs unless the operator explicitly acknowledges the risk.
  if (!unsafe && !dryRun) {
    stderr.write(
      [
        "⛔  'conductor loop' has NO sandbox yet (sandbox lands in Phase 3).",
        "    Running an unattended agent with shell access against a live repo is unsafe.",
        "    The driver's guarantees are proven via 'npm run test:unit' (stub adapter).",
        "    To run anyway at your own risk, pass --unsafe-no-sandbox.",
        "",
      ].join("\n")
    );
    return 1;
  }

  // Platform selection: --platform flag > loop-state.json.platform > auto-detect.
  const platformPref = platformFlag || state.platform || null;
  let resolved = { name: null, adapter: null, availability: {} };
  let adapterError = null;
  try {
    resolved = await resolveAdapter({ platform: platformPref });
  } catch (e) {
    adapterError = e.message;
  }
  const promptPath = join(root, WORKFLOW_REL);

  if (dryRun) {
    const detected = Object.entries(resolved.availability)
      .filter(([, ok]) => ok)
      .map(([n]) => n);
    stdout.write(
      [
        "conductor loop — dry run",
        `  state:    ${statePath}`,
        `  status:   ${state.status}`,
        `  phase:    ${state.phase}`,
        `  verify:   ${verifyCommand ?? "(none → will halt: halted_no_verification)"}`,
        `  beats:    ${state.iterations.current}/${state.iterations.max_allowed}`,
        `  autonomy: ${state.autonomy_level}  (${autonomySummary(state)})`,
        `  sandbox:  ${state.sandbox}${state.autonomy_level === "L3" && state.sandbox !== "container" ? "  ⛔ L3 requires sandbox=container (will halt: halted_sandbox_required)" : ""}`,
        `  merge:    ${state.phase === "execution" && state.autonomy_level === "L3" ? "PR-gated (gh/glab) on completion" : "none (human reviews/merges)"}`,
        `  concurrency: ${state.concurrency}${state.concurrency > 1 ? "  ⛔ swarm not implemented (will halt: halted_autonomy)" : ""}`,
        `  platform: ${platformPref ?? "(auto-detect)"}`,
        `  adapter:  ${adapterError ? `ERROR: ${adapterError}` : resolved.name ?? "(none available)"}`,
        `  detected: ${detected.length ? detected.join(", ") : "none on PATH"}`,
        `  worktree: ${state.phase === "execution" ? "created for execution phase (isolated Maker)" : "n/a (not execution phase)"}`,
        "",
      ].join("\n")
    );
    return adapterError || !resolved.adapter ? 1 : 0;
  }

  if (adapterError) {
    stderr.write(`${adapterError}\n`);
    return 1;
  }
  if (!resolved.adapter) {
    stderr.write(
      `No supported agent CLI found on PATH (tried: ${Object.keys(resolved.availability).join(", ")}). ` +
        `Install one, or pass --platform <name>.\n`
    );
    return 1;
  }
  const adapter = resolved.adapter;
  stdout.write(`[CONDUCTOR LOOP] platform: ${adapter.name}\n`);

  const git = makeGit(root);

  // Phase 3 — isolation: the Maker runs in a dedicated git worktree during the
  // execution phase, so an unattended run never mutates the user's checkout.
  // Verify + Checker run against that same isolated tree (workCwd).
  let workCwd = root;
  if (state.phase === "execution") {
    try {
      const wt = await createWorktree({ root, goalDescription: state.goal_description, git });
      workCwd = wt.path;
      state.worktree = { path: wt.path, branch: wt.branch };
      await atomicWriteJson(statePath, state);
      stdout.write(`[CONDUCTOR LOOP] worktree: ${wt.branch} @ ${wt.path}${wt.created ? " (new)" : " (reused)"}\n`);
    } catch (e) {
      stderr.write(`Worktree isolation failed: ${e.message}\n`);
      return 1;
    }
  }

  // Phase 3 — the independent Checker as a SEPARATE process (fresh context). It
  // records a verdict file; a missing/malformed verdict fails safe to reject.
  const checkerPromptPath = join(root, CHECKER_WORKFLOW_REL);
  const verdictPath = join(workCwd, VERDICT_REL);
  const runChecker = async () => {
    await rm(verdictPath, { force: true }).catch(() => {});
    await adapter.runChecker({ promptPath: checkerPromptPath, cwd: workCwd, permissionMode: "plan" });
    let text = null;
    try {
      text = await readFile(verdictPath, "utf8");
    } catch {
      /* absent → fail safe */
    }
    const verdict = parseCheckerVerdict(text);
    stdout.write(`[CONDUCTOR LOOP] checker verdict: ${verdict.approved ? "APPROVED" : "REJECTED"} — ${verdict.reason}\n`);
    return { exitCode: verdictToExitCode(verdict) };
  };

  // Phase 4 — PR-gated merge at L3 execution completion (never a direct push).
  const workGit = makeGit(workCwd);
  const merge = async ({ state: s }) => {
    const branch = s.worktree?.branch;
    if (!branch) return { ok: false, reason: "no worktree branch to open a PR from" };
    return openPullRequest({
      branch,
      title: `Conductor loop: ${s.goal_description || branch}`,
      git: workGit,
      run: (cmd, argv) => runCli(cmd, argv, workCwd),
      hasGh: await cliAvailable("gh"),
      hasGlab: await cliAvailable("glab"),
    });
  };

  const deps = {
    verifyCommand,
    runBeat: () => adapter.runBeat({ promptPath, cwd: workCwd, permissionMode: "acceptEdits" }),
    runVerify: (cmd) => sh(cmd, workCwd),
    gitHead: () => gitHead(workCwd),
    runChecker,
    merge,
    audit: (m) => appendShipLog(root, m, Date.now()),
    now: () => Date.now(),
    persist: (s) => atomicWriteJson(statePath, s),
    writeInbox: (s, reason) => writeInbox(root, s, reason),
    log: (m) => stdout.write(`${m}\n`),
  };

  const final = await runLoop(state, deps);
  if (final.merge?.pr_url) stdout.write(`[CONDUCTOR LOOP] PR opened: ${final.merge.pr_url}\n`);

  // Teardown: remove the worktree only if it holds no unmerged commits; otherwise
  // keep it for the human / Phase 4 merge queue (Phase 3 does not auto-merge).
  if (state.phase === "execution" && final.worktree) {
    const t = await teardownWorktree({ root, goalDescription: state.goal_description, git });
    stdout.write(`[CONDUCTOR LOOP] ${t.reason}\n`);
  }

  stdout.write(`\n[CONDUCTOR LOOP] finished: ${final.status}\n`);
  // `completed` (PR opened) and `awaiting_review` (clean human handoff) are both
  // successful outcomes; everything else is a halt/error worth a non-zero code.
  return final.status === "completed" || final.status === "awaiting_review" ? 0 : 1;
}
