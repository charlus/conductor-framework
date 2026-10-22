// src/commands/loop.js
//
// `conductor loop` — the deterministic autonomy driver as a CLI subcommand
// (ADR-0001 / Autonomous-Loop-Backend.md). Thins over src/loop/driver.js: this
// file is the IO shell (read/persist state, run git + verify, pick the adapter);
// all guarantees live in the pure driver so `node --test` can exercise them.

import { readFile, writeFile, appendFile, rename, access, rm, cp, mkdir, readdir, mkdtemp } from "node:fs/promises";
import { constants as fsConstants, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve, sep, basename } from "node:path";
import { tmpdir } from "node:os";
import { runLoop, normalizeState, resolveVerifyCommand, beatCeiling } from "../loop/driver.js";
import { resolveAdapter } from "../loop/adapters/index.js";
import { createWorktree, teardownWorktree, worktreePlan, taskWorktreePlan, materializeConductorContext, CONTEXT_ANCHORS, hasUniqueCommits, ensureWorktreesExcluded } from "../loop/worktree.js";
import { autoCommit, autoCommitMessage } from "../loop/autocommit.js";
import { harvestWorkQueue, renderAssignment, renderAttempts } from "../loop/harvester.js";
import { parseCheckerVerdict, verdictToExitCode, tallyVerdicts, isInfraReason, groundFindings, VERDICT_REL } from "../loop/checker.js";
import { openPullRequest, planMergeAction, DEFAULT_PR_BODY } from "../loop/merge.js";
import { runSwarm } from "../loop/swarm.js";
import { predictConflicts } from "../loop/conflict.js";
import { lockDecision, renderLock } from "../loop/lock.js";
import { reviveForResume, startNewRun } from "../loop/resume.js";
import { mineRecurringFailures, renderImprovementReport } from "../loop/improver.js";
import { parseTriggerPayload, applyTrigger, renderTriggerDoc } from "../loop/trigger.js";
import { allowedToolsFor } from "../loop/untrusted.js";
import { writeBeatLog, BEAT_LOG_DIR, AUDIT_FILE } from "../loop/beat-log.js";
import { syncLoopStateInto, hideFromGit, MAKER_SIGNAL_REL, untrackedPaths, hideSetupArtifacts } from "../loop/state-sync.js";
import { QUESTIONS_REL, roundKey, parseRound, checkRound, roundAnswered } from "../loop/questions.js";
import { stage as loopStage, stageWorkflowPath } from "../loop/stages.js";
import { commandHelp } from "../usage.js";
import { nextAfterLoop } from "../next-step.js";
import { BLUEPRINT_STAGES, DISCOVERY, TEMPLATE_FOR, harvestBlueprints, blueprintStageEvidence, carryOver } from "../loop/blueprint.js";
import { instructionWarningsFor } from "../claude-instructions.js";
import { ignoredNestedRepos } from "../nested-repos.js";
import { codePaths, ensureCodeWorktree, codeHasWork, mergeNested, stateMrBody, codeMrBody, unionBranches, refusedNestedRepos, checkerNestedNote, nestedSandboxWrites } from "../loop/nested.js";
import { recordUsage, usageSummary, cacheShare } from "../loop/usage.js";
import { newRulings, rulingInboxLines, rulingsPrBody, rulingsForChecker, RULINGS_REL } from "../loop/rulings.js";
import { renderShipAssignment, shipBeatSection, sectionOf, checkShipEvidence, PR_BODY_REL } from "../loop/ship.js";
import { harvestSlices, specEvidence as checkSpecEvidence, PROJECTS_REL } from "../loop/slices.js";
import { pruneMergedLoopWorktrees, remoteLoopBranches, mergedBranches, skipClaimed, defaultBranchRef } from "../loop/reconcile.js";
import { forgeMergedHead } from "../live-state.js";
import { readReady } from "../loop/ready-queue.js";
import { gitCommonDir as gitDirOf } from "./loop-take.js";
import { parseLoopConfig, parsePriorities, resolveForge, mergeSandboxSettings, withRoleModels, effectiveModels } from "../loop/config.js";
import { describeModels } from "../loop/profiles.js";
import { makeEmitter } from "../loop/events.js";
import { verifyWithEvidence } from "../loop/verify-evidence.js";
import { blankedNames, beatEnv, withBeatEnv } from "../loop/beat-env.js";
import { mrTitles, readOnlyEnv } from "../loop/team-facing.js";

const STATE_REL = "conductor/1-workbench/loop-state.json";
const LOCK_REL = "conductor/1-workbench/loop.lock";
const WORKFLOW_REL = ".agents/workflows/unattended-loop.md";
const CHECKER_WORKFLOW_REL = ".agents/workflows/loop-checker.md";
const TRIGGER_DOC_REL = "conductor/1-workbench/loop-trigger.md";
// Fleet Bridge (§5): the source-of-truth work files the harvester drains, and
// the per-beat assignment pointer a fleet agent reads to know its work item.
const INBOX_REL = "conductor/1-workbench/inbox.md";
const BACKLOG_REL = "conductor/2-backlog/task-backlog.md";
const ASSIGNMENT_REL = "conductor/1-workbench/loop-assignment.md";

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

const LOOP_HELP = commandHelp("loop");

/** The loop's own option tokens — used so `flagValue` never mistakes a missing
 *  value for the next flag (and vice-versa). */
const LOOP_FLAGS = new Set([
  "--unsafe-no-sandbox",
  "--dry-run",
  "--platform",
  "--goal",
  "--event",
  "--from-conductor",
  "--help",
  "-h",
  "--priority",
  "--no-inbox",
]);

/** Parse `--flag value` or `--flag=value`; returns null if absent. Accepts a
 *  value that begins with '-' (e.g. a goal starting with a dash) but never
 *  swallows another recognized loop flag when the value was omitted. */
function flagValue(args, flag) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  const next = i !== -1 ? args[i + 1] : undefined;
  if (i !== -1 && next !== undefined && !LOOP_FLAGS.has(next)) return next;
  return null;
}

export async function exists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Is `pid` a live process? (signal 0 probes without killing; EPERM = alive-but-not-ours.) */
function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

/**
 * Take the single-holder run lock for `root`, or refuse if a live loop owns it.
 * A stale lock (owner dead) is stolen. @returns {acquired, heldByPid?, stale?}
 */
async function acquireLock(root) {
  const lockPath = join(root, LOCK_REL);
  const existingText = (await exists(lockPath)) ? await readFile(lockPath, "utf8").catch(() => "") : "";
  const decision = lockDecision({ existingText, isAlive: isPidAlive });
  if (!decision.acquire) return { acquired: false, heldByPid: decision.heldByPid };
  await writeFile(lockPath, renderLock(process.pid, new Date().toISOString()), "utf8");
  return { acquired: true, stale: decision.stale, heldByPid: decision.heldByPid };
}

/** Release the run lock (best-effort; a leftover lock is stolen next run anyway). */
async function releaseLock(root) {
  await rm(join(root, LOCK_REL), { force: true }).catch(() => {});
}

/** Atomic state write: temp file + rename, so a kill mid-beat never corrupts the Spine. */
async function atomicWriteJson(path, obj) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export function sh(cmd, cwd) {
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
/**
 * F3: the text each BLOCKER's quote may come from, read once per verdict: the
 * file as it is now and its diff from the default branch (a quote of a removed
 * line), under each root (the outer layout reviews a nested code repository).
 * Returns a lookup for `groundFindings`; null for a file no root can read.
 */
async function checkerSources(verdict, roots) {
  const texts = new Map();
  const files = new Set(verdict.findings.filter((f) => String(f?.severity ?? "").toUpperCase() === "BLOCKER" && f.file).map((f) => String(f.file)));
  for (const file of files) {
    const parts = [];
    for (const dir of roots) {
      const path = resolve(dir, file);
      if (!path.startsWith(resolve(dir) + sep)) continue; // a path outside the worktree is never read
      try {
        parts.push(await readFile(path, "utf8"));
      } catch {
        /* not under this root */
      }
      const git = makeGit(dir);
      const base = await defaultBranchRef(git);
      if (base) {
        const diff = await git(["diff", `${base}...HEAD`, "--", file]);
        if (diff.ok && diff.stdout) parts.push(diff.stdout);
      }
    }
    texts.set(file, parts.length ? parts.join("\n") : null);
  }
  return (file) => texts.get(file) ?? null;
}

function makeGit(cwd) {
  return (gitArgs) => runCli("git", gitArgs, cwd);
}

/**
 * Run an arbitrary CLI: run(cmd, args) -> {ok, stdout, stderr, exitCode}.
 *
 * `exitCode` and `stderr` are additive (every caller before them read only
 * `ok`/`stdout`). Conflict prediction needs both: `git merge-tree` answers
 * "conflict" with exit 1 and "I don't have that flag" with exit 129, and
 * collapsing either into `ok: false` makes them indistinguishable. Reading
 * stderr also drains the pipe, which an unread one would eventually block on.
 */
export function runCli(cmd, argv, cwd) {
  return new Promise((res) => {
    const child = spawn(cmd, argv, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", () => res({ ok: false, stdout: "", stderr: "", exitCode: -1 }));
    child.on("close", (code) =>
      res({ ok: code === 0, stdout: out.trim(), stderr: err.trim(), exitCode: code ?? -1 })
    );
  });
}

/**
 * Append one auditable line to the run's audit trail (best-effort; never throws).
 * F21: it lives in the git dir next to the event log, never in the tracked
 * ship-log: the owner's checkout stays clean, so a pull is never refused.
 */
async function appendAudit(logDir, message, now) {
  if (!logDir) return;
  const stamp = new Date(now).toISOString();
  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(join(logDir, AUDIT_FILE), `- [${stamp}] [loop] ${message}\n`, "utf8");
  } catch {
    /* best-effort audit trail */
  }
}

export async function hasNpmTestScript(root) {
  const pkgPath = join(root, "package.json");
  if (!(await exists(pkgPath))) return false;
  try {
    const pkg = await readJson(pkgPath);
    return Boolean(pkg.scripts && pkg.scripts.test);
  } catch {
    return false;
  }
}

export async function configVerify(root, codeDir = null) {
  const cfgPath = join(root, "conductor.config.json");
  if (!(await exists(cfgPath))) return "";
  try {
    const cfg = await readJson(cfgPath);
    // Step 7: in the outer layout the code repository's own push check is the loop's verify.
    const v = String((codeDir ? cfg.repos?.[codeDir]?.verify : cfg.verify) ?? "").trim();
    // "none" declares no tests on purpose (conductor verify --none): never a command to run.
    return v.toLowerCase() === "none" ? "" : v;
  } catch {
    return "";
  }
}

/** The raw conductor.config.json from the ROOT checkout ({} if absent). Throws on bad JSON. */
async function readRootConfig(root) {
  const cfgPath = join(root, "conductor.config.json");
  if (!(await exists(cfgPath))) return {};
  return readJson(cfgPath);
}

async function writeInbox(root, state, reason, { title = null } = {}) {
  const inbox = join(root, "conductor/1-workbench/inbox.md");
  const line = `\n## [loop] ${title ?? `Escalation — ${state.status}`}\n${reason}\n(goal: ${state.goal_description || "n/a"}, beat ${state.iterations.current}/${beatCeiling(state)})\n`;
  try {
    const prev = (await exists(inbox)) ? await readFile(inbox, "utf8") : "";
    await writeFile(inbox, prev + line, "utf8");
  } catch {
    /* best-effort escalation */
  }
}

/** Drop the current run's trigger brief into the workbench (best-effort). */
async function writeTriggerDoc(root, provenance) {
  try {
    await writeFile(join(root, TRIGGER_DOC_REL), renderTriggerDoc(provenance), "utf8");
  } catch {
    /* best-effort — the goal is already on the Spine */
  }
}

/** Step 3: the opted-in projects' open slices and the carve templates, from the root checkout. */
export async function readSlices(root, optIn) {
  const read = async (p) => ((await exists(p)) ? readFile(p, "utf8") : "");
  const tpl = (name) => read(join(root, "conductor/5-templates/carve-workflow", name));
  const projects = [];
  const base = join(root, PROJECTS_REL);
  for (const name of (await exists(base)) ? await readdir(base) : []) {
    const impl = join(base, name, "implementations");
    if (!(await exists(impl))) continue;
    const slices = [];
    for (const s of await readdir(impl)) {
      const dir = join(impl, s);
      if (!(await exists(join(dir, "feature-spec.md"))) && !(await exists(join(dir, "implementation-plan.md")))) continue;
      slices.push({ name: s, spec: await read(join(dir, "feature-spec.md")), plan: await read(join(dir, "implementation-plan.md")) });
    }
    projects.push({ name, slices });
  }
  return { projects, optIn, specTemplate: await tpl("feature-spec.md"), planTemplate: await tpl("implementation-plan.md") };
}

/** Step 5: the documents of each project, read from the root checkout, and their templates. */
export async function readBlueprints(root, optIn) {
  const read = async (p) => ((await exists(p)) ? readFile(p, "utf8") : "");
  const templates = {};
  for (const [rel, t] of Object.entries(TEMPLATE_FOR)) templates[rel] = await read(join(root, "conductor/5-templates", t));
  const projects = [];
  const base = join(root, PROJECTS_REL);
  for (const entry of (await exists(base)) ? await readdir(base, { withFileTypes: true }) : []) {
    if (!entry.isDirectory()) continue; // .gitkeep and other files are not projects
    const name = entry.name;
    const dir = join(base, name);
    const docs = {};
    for (const rel of [...DISCOVERY, ...BLUEPRINT_STAGES.map((s) => s.doc)]) docs[rel] = await read(join(dir, rel));
    const impl = join(dir, "implementations");
    const carved = (await exists(impl)) && (await readdir(impl)).length > 0;
    projects.push({ name, docs, carved });
  }
  return { projects, optIn, templates };
}

export async function loopCommand(args, { cwd, stdout, stderr }) {
  // Before any state read or gate: help must never be refused.
  if (args.includes("--help") || args.includes("-h")) {
    stdout.write(`${LOOP_HELP}\n`);
    return 0;
  }
  // `conductor loop on|off <project> [dir]`: turn the loop on for a project, without JSON.
  const sub = args.find((a) => !a.startsWith("-"));
  // `conductor loop profile [quality|balanced] [dir]`: the models, by budget.
  if (sub === "profile") {
    let [name, dir] = args.slice(args.indexOf(sub) + 1).filter((a) => !a.startsWith("-"));
    if (name && !dir && (name.includes("/") || name === ".")) [name, dir] = [undefined, name];
    const { loopProfileCommand } = await import("./loop-profile.js");
    return loopProfileCommand(resolve(cwd, dir || "."), name, { stdout, stderr });
  }
  if (sub === "on" || sub === "off") {
    const rest = args.slice(args.indexOf(sub) + 1);
    let [project, dir] = rest.filter((a, i) => !a.startsWith("-") && rest[i - 1] !== "--code-dir");
    // A project name never holds a slash: `loop on ~/work/app` is the folder, not a project.
    if (project && !dir && (project.includes("/") || project === ".")) [project, dir] = [undefined, project];
    const { loopOnCommand, loopOffCommand } = await import("./loop-on.js");
    return sub === "on"
      ? loopOnCommand(resolve(cwd, dir || "."), project, { args: rest, stdout, stderr })
      : loopOffCommand(resolve(cwd, dir || "."), project, { stdout, stderr });
  }
  // `conductor loop take ["<item>"] [dir] [--drop]`: give the loop a backlog item (C4-F4).
  if (sub === "take") {
    const rest = args.slice(args.indexOf(sub) + 1).filter((a) => !a.startsWith("-"));
    const { loopTakeCommand } = await import("./loop-take.js");
    return loopTakeCommand(resolve(cwd, rest[1] || "."), rest[0], { drop: args.includes("--drop"), stdout, stderr });
  }
  // `conductor loop doctor [dir]`: check a project before an unattended run.
  if (args.find((a) => !a.startsWith("-")) === "doctor") {
    const rest = args.slice(args.indexOf("doctor") + 1);
    const dir = rest.find((a) => !a.startsWith("-"));
    const { loopDoctor } = await import("./loop-doctor.js");
    return loopDoctor(resolve(cwd, dir || "."), { stdout, cwd, beat: rest.includes("--beat") });
  }
  const positional = args.find((a) => !a.startsWith("-"));
  const root = resolve(cwd, positional || ".");
  const statePath = join(root, STATE_REL);
  const unsafe = args.includes("--unsafe-no-sandbox");
  const dryRun = args.includes("--dry-run");
  const platformFlag = flagValue(args, "--platform");
  const goalFlag = flagValue(args, "--goal");
  const eventFlag = flagValue(args, "--event");
  const fromConductor = args.includes("--from-conductor");
  const priorityFlag = flagValue(args, "--priority");
  const noInbox = args.includes("--no-inbox");

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

  // The "loop" block of conductor.config.json, read from the ROOT checkout only:
  // a beat runs in a worktree and cannot widen its own sandbox or setup. A bad
  // value stops the run (dry-run included) rather than being silently ignored.
  let loopConfig;
  try {
    loopConfig = parseLoopConfig(await readRootConfig(root));
  } catch (e) {
    stderr.write(`Could not parse conductor.config.json: ${e.message}\n`);
    return 1;
  }
  if (priorityFlag !== null) {
    const parsed = parsePriorities(priorityFlag);
    if (parsed.error) loopConfig.errors.push(`--priority: ${parsed.error}`);
    else loopConfig.priorities = parsed.priorities;
  }
  if (noInbox) loopConfig.inbox = false;
  if (loopConfig.errors.length) {
    stderr.write(`⛔  Invalid loop settings in conductor.config.json:\n${loopConfig.errors.map((e) => `    - ${e}`).join("\n")}\n`);
    return 1;
  }

  // ---- Resume discipline (P1.4): a prior run may have died mid-beat, freezing a
  // task at a working status the frontier never re-selects (→ deadlock on resume)
  // or the pair run at a half-finished sub-status. Rewind those to a clean entry
  // point so THIS invocation picks up cleanly. Terminal work (merged/failed) is
  // untouched. Safe: the one-loop lock guarantees no live worker to race, and a
  // re-run is idempotent (maker re-verifies, auto-commit no-ops, merge reuses PR).
  const fresh = startNewRun(state);
  if (fresh.reset) stdout.write(`[CONDUCTOR LOOP] new run: the previous one ended '${fresh.from}' — beats, clock and stall counters reset\n`);
  const revived = reviveForResume(state);
  if (revived.tasks || revived.run) {
    stdout.write(
      `[CONDUCTOR LOOP] resuming: revived ${revived.tasks} in-flight task(s)` +
        `${revived.run ? " + the run status" : ""} from a prior interrupted run\n`
    );
  }
  // NB: the revive mutates `state` in memory only. The persist is DEFERRED to the
  // post-lock block below — a --dry-run must not rewrite on-disk state, and a 2nd
  // invocation racing a live run must not rewind its tasks before the lock refuses it.

  // ---- Ignition: seed this run's goal from an external trigger -------------
  // `--goal "<text>"` (a bare-string trigger) or `--event <path>` (a JSON
  // payload) let a scheduler / cron / webhook seed the loop. autonomy is CLAMPED
  // to the operator ceiling already in state — a trigger can never escalate.
  let triggerProvenance = null;
  if (goalFlag || eventFlag) {
    let text;
    if (eventFlag) {
      try {
        text = await readFile(resolve(root, eventFlag), "utf8");
      } catch (e) {
        stderr.write(`Could not read --event file '${eventFlag}': ${e.message}\n`);
        return 1;
      }
    } else {
      text = goalFlag;
    }
    let payload;
    try {
      payload = parseTriggerPayload(text);
    } catch (e) {
      stderr.write(`Invalid trigger: ${e.message}\n`);
      return 1;
    }
    if (payload) {
      // Apply in-memory so a --dry-run preview reflects the seeded goal. The
      // persist + brief + audit are DEFERRED to the post-lock block below — a
      // trigger must never rewrite a live run's state before the lock refuses a
      // 2nd loop (payloads can come from untrusted schedulers/webhooks).
      triggerProvenance = applyTrigger(state, payload, { now: Date.now }).provenance;
    }
  }

  // ---- Fleet Bridge FB-1: harvest ./conductor/ into the swarm's work queue ----
  // `--from-conductor` makes the ONE source of truth the fleet's backlog: open
  // inbox thoughts + backlog checkboxes become typed, routed tasks[]. Re-harvested
  // every run (FB-5: the folder is truth, the Spine is cache), so a human editing
  // conductor/ in VS Code and the fleet draining it stay coherent. Never escalates
  // autonomy; the operator's autonomy_level/sandbox/concurrency still gate the run.
  let harvestedQueue = [];
  if (fromConductor) {
    const inboxMd = (await exists(join(root, INBOX_REL))) ? await readFile(join(root, INBOX_REL), "utf8") : "";
    const backlogMd = (await exists(join(root, BACKLOG_REL))) ? await readFile(join(root, BACKLOG_REL), "utf8") : "";
    const gitDir = gitDirOf(root);
    harvestedQueue = harvestWorkQueue({
      inboxMd,
      backlogMd,
      readyIds: new Set(gitDir ? (await readReady(gitDir)).map((e) => e.id) : []),
      requireReady: loopConfig.requireReady,
      priorities: loopConfig.priorities,
      includeInbox: loopConfig.inbox,
    });
    // Unattended Lifecycle step 3: the lowest open slice of each opted-in project.
    if (loopConfig.slices === true || loopConfig.slices.length) {
      harvestedQueue = [...harvestedQueue, ...harvestSlices(await readSlices(root, loopConfig.slices))];
    }
    // Step 5: the Blueprint of each opted-in project whose Discovery is done.
    if (loopConfig.blueprint === true || loopConfig.blueprint.length) {
      harvestedQueue = [...harvestedQueue, ...harvestBlueprints(await readBlueprints(root, loopConfig.blueprint))];
    }
    // Unattended Lifecycle step 2: claims come from git. An item whose loop
    // branch is on the remote is in progress or in review elsewhere; nothing is
    // committed to the owner's checkout to mark it.
    if (harvestedQueue.length) {
      const rootGit = makeGit(root);
      if (!dryRun) await runCli("git", ["fetch", "-q", "origin"], root);
      // Step 7: an item is taken when its branch is on either remote.
      const codeDirAbs = loopConfig.codeDir ? join(root, loopConfig.codeDir) : null;
      if (codeDirAbs && !dryRun) await runCli("git", ["fetch", "-q", "origin"], codeDirAbs);
      const remote = codeDirAbs ? unionBranches(await remoteLoopBranches(rootGit), await remoteLoopBranches(makeGit(codeDirAbs))) : await remoteLoopBranches(rootGit);
      if (remote === null) {
        stderr.write("[CONDUCTOR LOOP] ⚠️  could not read the remote's loop branches: items in review elsewhere are not skipped\n");
      } else {
        const claims = skipClaimed(harvestedQueue, {
          remoteBranches: remote,
          mergedBranches: await mergedBranches(rootGit, [...remote]),
          branchFor: (t) => taskWorktreePlan(root, state.goal_description, t.id).branch,
        });
        for (const t of claims.inReview) stdout.write(`[CONDUCTOR LOOP] skipped ${t.id}: its loop branch is on the remote (in progress or in review)\n`);
        for (const t of claims.mergedButOpen)
          stdout.write(`[CONDUCTOR LOOP] skipped ${t.id}: its loop branch is merged but the item is still open in the backlog — tick it\n`);
        harvestedQueue = claims.queue;
      }
    }
    // swarm route; normalizeTask preserves title/source/route, and what an item
    // earned in the last run (a passed review, an answered round) is carried over.
    state.tasks = carryOver(state.tasks, harvestedQueue);
    // persist + audit DEFERRED to the post-lock block below (dry-run stays read-only).
  }

  // Resolve the verify command up front (mirrors conductor_verify_cmd).
  const verifyCommand = resolveVerifyCommand({
    stateCommand: state.verification.command,
    configVerify: loopConfig.codeDir ? await configVerify(root, loopConfig.codeDir) : await configVerify(root),
    hasNpmTestScript: await hasNpmTestScript(root),
  });

  // SAFETY BOUNDARY. Looping an agent with shell access UNSANDBOXED is the thing
  // the survey (§5) prohibits. With `sandbox: "cli-native"` (the engine vendor's
  // own sandbox — Anthropic's bubblewrap for claude, enabled per-beat below with
  // failIfUnavailable) or `"container"`, the run IS isolated, so it proceeds. Only
  // an explicitly UNsandboxed run (`sandbox: "none"`) still needs the operator to
  // acknowledge the risk with --unsafe-no-sandbox (e.g. they run inside a VM).
  if (state.sandbox === "none" && !unsafe && !dryRun) {
    stderr.write(
      [
        "⛔  'conductor loop' would run an unattended agent with shell access UNSANDBOXED (sandbox: none).",
        "    Set \"sandbox\": \"cli-native\" in loop-state.json to use the agent CLI's own sandbox",
        "    (Anthropic's bubblewrap for claude — needs `bubblewrap`+`socat` on the host; no Docker),",
        "    or \"container\" for a BYO container. See .agents/sandbox/README.md.",
        "    To run unsandboxed anyway (e.g. you are already inside a VM), pass --unsafe-no-sandbox.",
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

  // D1: an outer conductor repo whose code lives in a gitignored nested repo
  // cannot work: worktrees of THIS repo never contain that code, so every beat
  // would run against the wrong repository. Refuse and say why.
  // Step 7: the repository named by loop.code_dir is the code, not a mistake.
  const nestedRepos = loopConfig.allowNestedRepo ? [] : refusedNestedRepos(await ignoredNestedRepos(root), loopConfig.codeDir);
  if (loopConfig.codeDir && !(await exists(join(root, loopConfig.codeDir, ".git")))) {
    stderr.write(`⛔  loop.code_dir is "${loopConfig.codeDir}", but ${join(root, loopConfig.codeDir)} is not a git repository. Clone the code repository there, or fix the setting.\n`);
    return 1;
  }
  if (nestedRepos.length) {
    stderr.write(
      nestedRepos
        .map((d) => `⛔  '${d}' is a separate git repository that this repo ignores. conductor loop works on ONE repository: its worktrees, commits and PRs would be in this repo, without that code.\n`)
        .join("") +
        "    If it holds the code, set loop.code_dir to it in conductor.config.json (the outer layout). If it is unrelated to the work, set loop.allow_nested_repo: true.\n"
    );
    return 1;
  }

  // F4: the forge comes from the origin host (or loop.forge), resolved before any
  // beat so a missing or unauthenticated CLI fails here, not after the push.
  const willOpenPr = planMergeAction({ autonomyLevel: state.autonomy_level, phase: state.phase }) === "pr";
  const remote = await runCli("git", ["remote", "get-url", "origin"], root);
  const forgeInfo = resolveForge({ override: loopConfig.forge, remoteUrl: remote.ok ? remote.stdout : "" });

  if (dryRun) {
    const detected = Object.entries(resolved.availability)
      .filter(([, ok]) => ok)
      .map(([n]) => n);
    stdout.write(
      [
        "conductor loop — dry run",
        `  state:    ${statePath}`,
        `  status:   ${state.status}`,
        `  goal:     ${state.goal_description || "(none set)"}`,
        ...(triggerProvenance
          ? [
              `  trigger:  '${triggerProvenance.source}' → autonomy ${triggerProvenance.effective_autonomy}` +
                (triggerProvenance.trusted === false ? "  [UNTRUSTED]" : "") +
                (triggerProvenance.clamped_from
                  ? `  ⛔ ${triggerProvenance.clamped_from} refused (clamped to ` +
                    // Name the ACTUAL reason: an untrusted seed is forced to the
                    // no-merge floor regardless of how high the operator ceiling is,
                    // so reporting "operator ceiling" here would be wrong.
                    `${triggerProvenance.trusted === false ? "the untrusted floor" : "operator ceiling"})`
                  : ""),
              ...(triggerProvenance.trusted === false
                ? [`            untrusted: ${triggerProvenance.trust_reason} — tools restricted, no merge`]
                : []),
            ]
          : []),
        `  phase:    ${state.phase}`,
        `  verify:   ${verifyCommand ?? "(none → will halt: halted_no_verification)"}`,
        `  beats:    ${state.iterations.current}/${beatCeiling(state)}`,
        `  autonomy: ${state.autonomy_level}  (${autonomySummary(state)})`,
        `  sandbox:  ${state.sandbox}${state.autonomy_level === "L3" && !["cli-native", "container"].includes(state.sandbox) ? "  ⛔ L3 requires sandbox=cli-native or container (will halt: halted_sandbox_required)" : ""}`,
        `  merge:    ${willOpenPr ? "PR-gated on completion" : "none (human reviews/merges)"}`,
        ...(willOpenPr ? [`  forge:    ${forgeInfo.forge ? `${forgeInfo.forge} (${forgeInfo.source})` : `⛔ ${forgeInfo.error}`}`] : []),
        `  setup:    ${loopConfig.setup ?? "(none)"}`,
        ...(loopConfig.allowedDomains.length ? [`  network:  + ${loopConfig.allowedDomains.join(", ")}${state.sandbox === "cli-native" ? "" : "  (only applies to sandbox=cli-native with claude)"}`] : []),
        `  mode:     ${state.tasks?.length ? `swarm (${state.tasks.length} tasks)` : "pair (single goal)"}`,
        `  concurrency: ${state.concurrency}${state.concurrency > 1 && (state.autonomy_level !== "L3" || !(state.tasks?.length)) ? "  ⛔ swarm needs L3 + a task graph (will halt: halted_autonomy)" : ""}`,
        `  checker:  ${state.checker_votes > 1 ? `${state.checker_votes}-vote (adversarial, majority)` : "single verdict"}`,
        `  platform: ${platformPref ?? "(auto-detect)"}`,
        `  adapter:  ${adapterError ? `ERROR: ${adapterError}` : resolved.name ?? "(none available)"}`,
        ...(Object.keys(effectiveModels(loopConfig)).length ? [`  models:   ${loopConfig.profile ? `profile ${loopConfig.profile} — ` : ""}${describeModels(effectiveModels(loopConfig), { inline: true })}${resolved.name === "claude" ? "" : "  (only applies to the claude engine)"}`] : []),
        `  detected: ${detected.length ? detected.join(", ") : "none on PATH"}`,
        `  worktree: ${state.phase === "execution" ? "created for execution phase (isolated Maker)" : "n/a (not execution phase)"}`,
        ...(loopConfig.codeDir ? [`  code:     ${loopConfig.codeDir}/ (nested repository: a code worktree per item, from its default branch; code MR first, then the state MR)`] : []),
        "",
      ].join("\n")
    );
    if (fromConductor) {
      const filters = [
        loopConfig.requireReady && "taken or loop-ready only",
        loopConfig.priorities.length && `priorities ${loopConfig.priorities.join(",")}`,
        !loopConfig.inbox && "no inbox",
      ].filter(Boolean);
      stdout.write(`  harvested: ${harvestedQueue.length} work item(s) from conductor/${filters.length ? ` (${filters.join(", ")})` : ""}\n`);
      for (const t of harvestedQueue) {
        stdout.write(`    - [${t.type}${t.priority ? " " + t.priority : ""}] ${t.title}  → ${t.route ?? "(brief)"}\n`);
      }
    }
    stdout.write(`\n  Next: run the same command without --dry-run to start it.\n`);
    return adapterError || !resolved.adapter || (willOpenPr && !forgeInfo.forge) ? 1 : 0;
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
  // Around every maker and checker beat, in pair and swarm mode:
  // F15: the worktree gets the driver's live loop-state.json (git checks out the
  //      committed one), hidden from git so it never reaches the PR.
  // F11: the beat's output is saved in the main repo's git dir, so a beat that did
  //      nothing can be diagnosed after teardown. Best-effort.
  const gitCommonDir = await runCli("git", ["rev-parse", "--git-common-dir"], root);
  const beatLogDir = gitCommonDir.ok ? join(resolve(root, gitCommonDir.stdout), BEAT_LOG_DIR) : null;
  // Loop Monitor M1: one event log per repository, read by `conductor watch`.
  const emit = makeEmitter(beatLogDir, new Date().toISOString());
  const cwdTask = new Map(); // worktree path → task id, so every beat names its item
  const modelFor = (kind, opts) => {
    const m = effectiveModels(loopConfig);
    if (kind === "maker") return (opts?.escalateModel && m.maker_escalation) || m.maker || null;
    return m[kind] ?? null;
  };
  const logged = (kind, run) => async (opts) => {
    const eventTask = opts.task?.id ?? cwdTask.get(resolve(opts.cwd ?? root)) ?? "run";
    await emit("beat_start", { task: eventTask, kind, model: modelFor(kind, opts) });
    try {
      await syncLoopStateInto({ root, cwd: opts.cwd ?? root, git: makeGit(opts.cwd ?? root) });
    } catch (e) {
      stderr.write(`[CONDUCTOR LOOP] ⚠️  could not copy loop-state.json into ${opts.cwd}: ${e.message}\n`);
    }
    const startedAt = Date.now();
    // M3: each tool step of the beat, as the engine streams it.
    const result = await run({ ...opts, onStep: (s) => emit("step", { task: eventTask, kind, tool: s.tool, detail: s.detail }) });
    await emit("beat_end", { task: eventTask, kind, duration_s: Math.round((Date.now() - startedAt) / 1000), cost_usd: result?.costUsd ?? null, exit: result?.exitCode ?? null });
    // A14: the one accounting point for every beat, Maker and Checker, pair and
    // swarm. A failure to record never fails a beat.
    try {
      recordUsage(state, { role: kind, result });
    } catch {
      /* usage is measurement only */
    }
    if (beatLogDir) {
      try {
        const label = `${kind}${opts.role ? ` ${opts.role}` : ""} ${basename(opts.cwd ?? root)}`;
        const usage = {
          role: kind,
          model: result?.model ?? opts.model ?? "default",
          task: opts.task?.id ?? null,
          duration_s: Math.round((Date.now() - startedAt) / 1000),
          tokens: result?.tokens ?? null,
          cost_usd: result?.costUsd ?? null,
          cache_pct: Number.isFinite(result?.inputTokens) ? cacheShare(result.cacheReadTokens, result.inputTokens) : null,
        };
        const path = await writeBeatLog(beatLogDir, { now: Date.now(), label, cwd: opts.cwd ?? root, result, usage });
        await audit(`${kind} log: ${path}`);
      } catch {
        /* a log failure never fails a beat */
      }
    }
    return result;
  };
  const models = effectiveModels(loopConfig);
  const roleModels = resolved.adapter.name === "claude" ? models : {};
  // P4: the app's provider keys are empty in every beat (loop.blank_env), never the engine's own.
  const blanked = blankedNames(loopConfig.blankEnv, resolved.adapter.name);
  const modelled = withRoleModels(withBeatEnv(resolved.adapter, blanked.length ? beatEnv(blanked) : null), roleModels);
  const adapter = {
    ...modelled,
    runBeat: logged("maker", modelled.runBeat),
    runChecker: logged("checker", modelled.runChecker),
    runShipBeat: logged("ship", modelled.runShipBeat),
    runSpecBeat: logged("spec", modelled.runSpecBeat),
    runBlueprintBeat: logged("blueprint", modelled.runBlueprintBeat),
  };
  stdout.write(`[CONDUCTOR LOOP] platform: ${adapter.name}\n`);
  if (blanked.length) stdout.write(`[CONDUCTOR LOOP] beats run with ${blanked.join(", ")} empty (loop.blank_env)\n`);
  if (Object.keys(models).length) {
    if (adapter.name === "claude") stdout.write(`[CONDUCTOR LOOP] models: ${loopConfig.profile ? `profile ${loopConfig.profile} — ` : ""}${describeModels(models, { inline: true })}\n`);
    else stderr.write(`[CONDUCTOR LOOP] ⚠️  the model profile applies to the claude engine only; ${adapter.name} runs its own default model\n`);
  }

  // D9: a claude beat that cannot read the root AGENTS.md runs without the laws.
  if (adapter.name === "claude") {
    for (const w of await instructionWarningsFor(root)) stderr.write(`[CONDUCTOR LOOP] ⚠️  ${w}\n`);
  }

  if (willOpenPr) {
    if (!forgeInfo.forge) {
      stderr.write(`⛔  ${forgeInfo.error}\n`);
      return 1;
    }
    const authArgs = ["auth", "status", ...(forgeInfo.host ? ["--hostname", forgeInfo.host] : [])];
    const auth = await runCli(forgeInfo.forge, authArgs, root);
    if (!auth.ok) {
      stderr.write(
        `⛔  This run opens a PR/MR with '${forgeInfo.forge}' (${forgeInfo.source}), but '${forgeInfo.forge} ${authArgs.join(" ")}' failed. ` +
          `Install and authenticate it, or set loop.forge in conductor.config.json. Nothing was run.\n`
      );
      return 1;
    }
    stdout.write(`[CONDUCTOR LOOP] forge: ${forgeInfo.forge} (${forgeInfo.source})\n`);
  }

  // cli-native sandbox: hand the claude beats a settings profile that turns ON
  // Anthropic's bubblewrap sandbox, fail-closed (failIfUnavailable). Only the
  // claude engine reads this — codex/agy provide their own out-of-process sandbox.
  let sandboxSettingsPath = null;
  if (state.sandbox === "cli-native" && adapter.name === "claude") {
    const p = join(root, ".agents/sandbox/claude-sandbox.settings.json");
    if (await exists(p)) {
      sandboxSettingsPath = p;
      // F3: the template is framework-owned (upgrade overwrites it), so project
      // domains live in loop.allowed_domains and are merged into a generated copy
      // in a private (0700) temp dir, outside every worktree.
      // F15: in the outer layout, a beat must be able to commit in the code repository.
      const codeGitDir = loopConfig.codeDir ? await runCli("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], join(root, loopConfig.codeDir)) : null;
      const extraWrites = codeGitDir?.ok ? nestedSandboxWrites(codeGitDir.stdout.trim()) : [];
      if (loopConfig.allowedDomains.length || extraWrites.length) {
        const merged = mergeSandboxSettings(await readJson(p), loopConfig.allowedDomains, extraWrites);
        const dir = await mkdtemp(join(tmpdir(), "conductor-sandbox-"));
        process.once("exit", () => rmSync(dir, { recursive: true, force: true }));
        sandboxSettingsPath = join(dir, "claude-sandbox.settings.json");
        await writeFile(sandboxSettingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
        if (loopConfig.allowedDomains.length) stdout.write(`[CONDUCTOR LOOP] sandbox network: + ${loopConfig.allowedDomains.join(", ")}\n`);
        if (extraWrites.length) stdout.write(`[CONDUCTOR LOOP] sandbox: commits allowed in ${loopConfig.codeDir}/ (its config and hooks stay read-only)\n`);
      }
      stdout.write(`[CONDUCTOR LOOP] sandbox: cli-native (Anthropic bubblewrap via ${sandboxSettingsPath === p ? ".agents/sandbox/claude-sandbox.settings.json" : sandboxSettingsPath})\n`);
    } else {
      stderr.write(
        `[CONDUCTOR LOOP] ⛔ sandbox=cli-native but .agents/sandbox/claude-sandbox.settings.json is missing — refusing to run unsandboxed. Run 'conductor upgrade' to restore it.\n`
      );
      return 1;
    }
  }

  // agy's own `--sandbox` (terminal restrictions) was VERIFIED live to BLOCK the
  // agent from operating: an otherwise-identical beat produces nothing (empty
  // worktree, silent no-op) — likely it severs the API network and/or writes to
  // the external worktree path. So agy has no working cli-native sandbox; refuse
  // loudly and point to `container` rather than pass a flag that yields empty runs.
  const agySandbox = false; // agy --sandbox is non-functional for autonomous work
  if (state.sandbox === "cli-native" && adapter.name === "antigravity" && !dryRun) {
    stderr.write(
      "⛔  sandbox=cli-native is not supported for the antigravity engine: agy's --sandbox " +
        "blocks the agent from operating (verified live — the beat produces nothing). Use " +
        '"sandbox": "container" for an isolated L3 agy run, or run L1/L2 with ' +
        '"sandbox": "none" + --unsafe-no-sandbox.\n'
    );
    return 1;
  }

  const git = makeGit(root);
  const checkerPromptPath = join(root, CHECKER_WORKFLOW_REL);

  // The independent Checker as N separate processes (multi-vote / adversarial),
  // each with a fresh context, run in a given cwd. A missing/malformed verdict
  // fails safe to reject; a strict majority is required to approve.
  const votes = Math.max(1, state.checker_votes ?? 1);
  const makeChecker = (cwd, checkerPrompt = checkerPromptPath) => async () => {
    const verdictPath = join(cwd, VERDICT_REL);
    const verdicts = [];
    // The Checker MUST write checker-verdict.json (loop-checker.md), so it cannot
    // run in read-only "plan" mode — under `claude -p` that silently blocks the
    // write and every beat fails safe to "no verdict file". Use "acceptEdits" (as
    // the Maker does); the "inspect only, don't modify code" discipline is enforced
    // structurally — a fresh independent process + the workflow prose — not by the
    // permission mode. Verified live: plan mode → checker can never approve.
    //
    // Run one checker vote, retrying ONCE if it emits no verdict file. An absent
    // file means the agent didn't produce output (a transient hiccup) — distinct
    // from an explicit reject verdict — so a single retry absorbs the flakiness
    // seen live without weakening the fail-safe: still absent after the retry →
    // parseCheckerVerdict(null) → reject.
    const runCheckerVote = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await rm(verdictPath, { force: true }).catch(() => {});
        await adapter.runChecker({ promptPath: checkerPrompt, cwd, permissionMode: "acceptEdits", settingsPath: sandboxSettingsPath, sandbox: agySandbox, allowedTools: allowedToolsFor(state) });
        try {
          return await readFile(verdictPath, "utf8");
        } catch {
          if (attempt === 0) {
            stdout.write(`[CONDUCTOR LOOP] checker emitted no verdict file — retrying once\n`);
          }
        }
      }
      return null; // still absent after the retry → fail safe (reject)
    };
    for (let i = 0; i < votes; i++) {
      const parsed = parseCheckerVerdict(await runCheckerVote());
      verdicts.push(groundFindings(parsed, await checkerSources(parsed, [cwd, codeWtOf(cwd)].filter(Boolean))));
    }
    const tally = tallyVerdicts(verdicts, votes);
    stdout.write(`[CONDUCTOR LOOP] checker: ${tally.approved ? "APPROVED" : "REJECTED"} — ${tally.reason}\n`);
    // P1.2: surface each verdict's reason so a rejection is diagnosable (empty-diff
    // / no-file plumbing issue vs a genuine substantive rejection).
    if (!tally.approved) {
      tally.reasons.forEach((r, i) => stdout.write(`[CONDUCTOR LOOP]   checker vote ${i + 1}: ${r}\n`));
      // Distinguish an INFRASTRUCTURE outage (every vote failed to run/produce a
      // verdict) from a substantive rejection, so the self-improvement miner never
      // proposes a content rule for a beat where no Checker actually ran.
      const infra = tally.reasons.length > 0 && tally.reasons.every(isInfraReason);
      await audit(`${infra ? "checker infra-failure" : "checker rejected"}: ${tally.reasons.join(" | ")}`);
    }
    // A13: the reasons and findings travel to the next Maker beat.
    const findings = verdicts.flatMap((v) => v.findings ?? []).slice(0, 10);
    return { exitCode: verdictToExitCode(tally), reasons: tally.approved ? [] : tally.reasons, findings: tally.approved ? [] : findings };
  };

  // PR-gated merge for a worktree branch (never a direct push to a protected branch).
  const makeMerge = (cwd, branch, title, rulings = async () => [], shipBody = () => null) => async () => {
    if (!branch) return { ok: false, reason: "no worktree branch to open a PR from" };
    return openPullRequest({
      branch,
      title,
      body: rulingsPrBody(await rulings(), shipBody()?.trim() || DEFAULT_PR_BODY),
      git: makeGit(cwd),
      run: (cmd, argv) => runCli(cmd, argv, cwd),
      forge: forgeInfo.forge,
    });
  };

  const audit = (m) => appendAudit(beatLogDir, m, Date.now());

  // Step 7, the outer layout: a beat's code worktree sits at <outer worktree>/<code_dir>.
  // Never the owner's own checkout: a beat in the root has no code worktree.
  const codeWtOf = (cwd) => (loopConfig.codeDir && resolve(cwd) !== resolve(root) ? join(cwd, loopConfig.codeDir) : null);
  const codeRoot = loopConfig.codeDir ? join(root, loopConfig.codeDir) : null;
  const codeForge = async () => {
    const r = await runCli("git", ["remote", "get-url", "origin"], codeRoot);
    return resolveForge({ override: loopConfig.forge, remoteUrl: r.ok ? r.stdout : "" }).forge;
  };
  // Commit what a beat left, in the code worktree first, then in the outer one.
  async function captureAll(cwd, message) {
    const code = codeWtOf(cwd);
    const c = code && (await exists(join(code, ".git"))) ? await autoCommit({ git: makeGit(code), message }) : { committed: false, bypassedHooks: false };
    const o = await autoCommit({ git: makeGit(cwd), message });
    return { committed: c.committed || o.committed, bypassedHooks: Boolean(c.bypassedHooks || o.bypassedHooks) };
  }
  const nestedNote = () =>
    loopConfig.codeDir
      ? `\n\n- **Code repository:** \`${loopConfig.codeDir}/\` is a separate git repository on this same branch name. Commit code there (\`git -C ${loopConfig.codeDir} commit\`), with its hooks and waivers as usual; Conductor documents stay here. Run tests inside \`${loopConfig.codeDir}/\`. A line \`packed-refs.lock: Read-only file system\` during a commit is harmless when the commit exits 0. Whatever you leave uncommitted, the driver commits after your beat: a failed commit is never a reason to escalate.\n`
      : "";
  // Every Checker prompt, in this layout, says where the code diff is.
  async function withNestedNote(promptFile, key) {
    if (!loopConfig.codeDir) return promptFile;
    const p = join(tmpdir(), `conductor-checker-nested-${String(key).replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(p, `${(await exists(promptFile)) ? await readFile(promptFile, "utf8") : ""}${checkerNestedNote(loopConfig.codeDir)}`, "utf8");
    return p;
  }
  // F20 (autopportunity 2026-10-21): a code review is told the driver already ran
  // the full suite outside the sandbox. Inside, the same suite took 605–618 s
  // instead of 124–141 s, some tests waiting on a blocked network.
  async function withVerifyNote(promptFile, key, cmd) {
    if (!cmd) return promptFile;
    const p = join(tmpdir(), `conductor-checker-verify-${String(key).replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(
      p,
      `${(await exists(promptFile)) ? await readFile(promptFile, "utf8") : ""}\n\n---\n\n# The full verification already ran\n\n` +
        `The driver ran \`${cmd}\` outside your sandbox on this exact state, and it exited 0: that exit code is the evidence. ` +
        "Do not run the full suite again: it is much slower in your sandbox, and some tests may wait on a network it blocks. " +
        "Run the tests of the files this change touches, read the diff against the acceptance criteria, and judge.\n",
      "utf8"
    );
    return p;
  }

  // The two MRs (owner decision 2026-10-20): code first, then the state MR naming it.
  const makeNestedMerge = (cwd, branch, title, rulings = async () => [], shipBody = () => null) => async () => {
    if (!branch) return { ok: false, reason: "no worktree branch to open a PR from" };
    const code = codeWtOf(cwd);
    const body = rulingsPrBody(await rulings(), shipBody()?.trim() || DEFAULT_PR_BODY);
    return mergeNested({
      hasCode: code ? await codeHasWork({ codeGit: makeGit(codeRoot), branch }) : false,
      openCode: async () =>
        openPullRequest({ branch, title, body: codeMrBody({ body }), git: makeGit(code), run: (cmd, argv) => runCli(cmd, argv, code), forge: await codeForge() }),
      openState: ({ codeUrl }) =>
        openPullRequest({ branch, title: `Conductor state: ${title}`, body: stateMrBody({ codeUrl, body }), git: makeGit(cwd), run: (cmd, argv) => runCli(cmd, argv, cwd), forge: forgeInfo.forge }),
    });
  };



  // F2: run loop.setup once per worktree, before its first beat. The marker lives
  // in the worktree's private git dir, so it never shows in the tree or the PR,
  // and a failed setup is retried on the next run. Runs in the driver, outside
  // the agent sandbox: the command is operator-authored and read from the root.
  async function runWorktreeSetup(worktreePath) {
    if (!loopConfig.setup) return { ok: true };
    const markerRel = await runCli("git", ["rev-parse", "--git-path", "conductor-setup.done"], worktreePath);
    const marker = markerRel.ok ? resolve(worktreePath, markerRel.stdout) : null;
    if (marker && (await exists(marker))) return { ok: true, skipped: true };
    stdout.write(`[CONDUCTOR LOOP] setup: ${loopConfig.setup} (in ${worktreePath})\n`);
    // CONDUCTOR_ROOT / CONDUCTOR_CODE_ROOT: the owner's checkouts, e.g. to link an untracked venv.
    const env = `export CONDUCTOR_ROOT=${JSON.stringify(root)}${codeRoot ? ` CONDUCTOR_CODE_ROOT=${JSON.stringify(codeRoot)}` : ""}; `;
    const before = await untrackedPaths({ git: makeGit(worktreePath) });
    const res = await sh(`${env}${loopConfig.setup}`, worktreePath);
    const hidden = await hideSetupArtifacts({ before, cwd: worktreePath, git: makeGit(worktreePath) });
    if (hidden.length) await audit(`setup made ${hidden.join(", ")}: kept out of the branch`);
    if (res.exitCode !== 0) {
      const tail = res.output.trim().split("\n").slice(-5).join(" | ");
      return { ok: false, reason: `exit ${res.exitCode}: ${tail || "(no output)"}` };
    }
    if (marker) await writeFile(marker, `${new Date().toISOString()}\n`, "utf8");
    await audit(`setup ok in ${worktreePath}`);
    return { ok: true };
  }

  // Fill a fresh worktree with any conductor scaffold git didn't check out because
  // it's untracked / gitignored (both tracked and gitignored conductor repos exist
  // in the wild). Without this the isolated Maker is BLIND: no CLAUDE.md/.agents
  // (instructions/skills) and no conductor/ (product KB). Ignored files stay ignored
  // in the worktree too, so nothing pollutes the feature branch / PR. Excludes
  // `.worktrees` (would recurse) + `.git`. Best-effort — never fails the run.
  async function materializeContextInto(worktreePath) {
    try {
      const atRoot = {};
      const inWt = {};
      for (const a of CONTEXT_ANCHORS) {
        atRoot[a] = await exists(join(root, a));
        inWt[a] = await exists(join(worktreePath, a));
      }
      const filled = await materializeConductorContext({
        existsAtRoot: (a) => atRoot[a],
        existsInWorktree: (a) => inWt[a],
        copy: async (a) => {
          const src = join(root, a);
          const dst = join(worktreePath, a);
          if (a === ".agents") {
            // The worktree lives at `.agents/.worktrees/<slug>`, so copying
            // `.agents` wholesale is "into a subdirectory of self" — node's cp
            // rejects it (EINVAL) before any filter runs. Copy `.agents`'s
            // children individually, skipping `.worktrees`.
            await mkdir(dst, { recursive: true });
            for (const entry of await readdir(src)) {
              if (entry === ".worktrees") continue;
              await cp(join(src, entry), join(dst, entry), { recursive: true });
            }
          } else {
            await cp(src, dst, { recursive: true });
          }
        },
      });
      if (filled.length) {
        stdout.write(
          `[CONDUCTOR LOOP] materialized untracked conductor context into the worktree (${filled.join(", ")}) — Maker is conductor-enabled\n`
        );
      }
      return filled;
    } catch (e) {
      stderr.write(`[CONDUCTOR LOOP] ⚠️  could not materialize conductor context into the worktree: ${e.message}\n`);
      return [];
    }
  }

  // ---- Route: swarm (task graph) vs. pair (single fuzzy goal) --------------
  if (fromConductor && state.tasks.length === 0) {
    stdout.write("[CONDUCTOR LOOP] conductor/ has no open work items (inbox + backlog empty). Nothing to do.\n");
    return 0;
  }

  // One loop per target: independent loop processes race on the shared worktree/
  // branch/PR and the conductor/ write-back. Refuse to start a second (dry-run,
  // which never mutates, is exempt above by returning before this point).
  const lock = await acquireLock(root);
  if (!lock.acquired) {
    stderr.write(
      `⛔  Another 'conductor loop' is already running on this target (pid ${lock.heldByPid}). ` +
        `Concurrent loops race on the worktree/branch/write-back — refusing to start a second. ` +
        `Wait for it to finish, or kill it and retry.\n`
    );
    return 1;
  }
  if (lock.stale) stdout.write(`[CONDUCTOR LOOP] cleared a stale lock (dead pid ${lock.heldByPid})\n`);

  // ---- Deferred writes: EVERY disk mutation happens HERE, after the one-loop
  // lock is held. A --dry-run returns before the lock (never reaching this), and
  // a 2nd invocation racing a live run is refused by the lock above — so neither
  // can rewind on-disk state. Single persist point for the v1→v2 migration, the
  // resume-revive, the ignition trigger, and the --from-conductor harvest.
  await atomicWriteJson(statePath, state);
  if (triggerProvenance) {
    await writeTriggerDoc(root, triggerProvenance);
    const clamp = triggerProvenance.clamped_from
      ? ` (autonomy clamped down from requested ${triggerProvenance.clamped_from} → ${triggerProvenance.effective_autonomy})`
      : "";
    await appendAudit(
      beatLogDir,
      `trigger from '${triggerProvenance.source}': goal="${state.goal_description}"${clamp}`,
      Date.now()
    );
  }
  if (fromConductor) {
    await appendAudit(
      beatLogDir,
      `harvested ${harvestedQueue.length} work item(s) from conductor/ (inbox + backlog)`,
      Date.now()
    );
  }

  // Unattended Lifecycle step 2: clean up what earlier runs left, now merged.
  {
    // Step 7: the code repository's merged worktrees first, then the outer ones
    // that no longer hold a code worktree.
    // F22: a squash-merged branch is merged when the forge says so.
    const forgeMerged = (dir) => (branch) => forgeMergedHead(dir, branch);
    const codeDir = loopConfig.codeDir ? join(root, loopConfig.codeDir) : null;
    const code = codeDir ? await pruneMergedLoopWorktrees({ git: makeGit(codeDir), forgeMerged: forgeMerged(codeDir) }) : { removed: [], kept: [] };
    for (const w of code.removed) stdout.write(`[CONDUCTOR LOOP] removed the merged code worktree ${w.path} (${w.branch})\n`);
    const p = await pruneMergedLoopWorktrees({
      git: makeGit(root),
      forgeMerged: forgeMerged(root),
      skip: async (w) => (loopConfig.codeDir && (await exists(join(w.path, loopConfig.codeDir, ".git"))) ? "its code worktree is still open (the code MR is not merged yet)" : null),
    });
    for (const w of p.removed) stdout.write(`[CONDUCTOR LOOP] removed the merged loop worktree ${basename(w.path)} (${w.branch})\n`);
    for (const w of code.kept) stdout.write(`[CONDUCTOR LOOP] kept the merged code worktree ${w.path}: ${w.reason}\n`);
    for (const w of p.kept) stdout.write(`[CONDUCTOR LOOP] kept the merged loop worktree ${basename(w.path)}: ${w.reason}\n`);
  }

  // Step 7: the outer layout runs work items (--from-conductor), not a free goal.
  if (loopConfig.codeDir && !(Array.isArray(state.tasks) && state.tasks.length > 0)) {
    await releaseLock(root);
    stderr.write("⛔  With loop.code_dir, the loop runs work items from conductor/: use --from-conductor. A single --goal run (pair mode) is not supported in the outer layout.\n");
    return 1;
  }
  try {
    const code =
      Array.isArray(state.tasks) && state.tasks.length > 0 ? await runSwarmMode() : await runPairMode();
    try {
      const after = await readJson(statePath);
      const prUrls = [after.merge?.pr_url, ...(after.tasks ?? []).flatMap((t) => [t.merge?.code_pr_url, t.merge?.pr_url])].filter((u) => u && u !== "n/a");
      const hint = nextAfterLoop(after.status, { prUrls: [...new Set(prUrls)] });
      if (hint) stdout.write(`\n[CONDUCTOR LOOP] ${hint}\n`);
    } catch {
      /* a hint never fails a run */
    }
    // P2.1: mine the cross-run failure trail and propose rules (best-effort).
    await runSelfImprovement();
    return code;
  } finally {
    await releaseLock(root);
  }

  // -------------------------------------------------------------------------
  // Cross-run self-improvement (P2.1). Mine the DURABLE ship-log (spans all runs)
  // for failures recurring >= threshold and write a review doc proposing rules.
  // Proposes only — never edits .agents/rules/ (a rule changes every future beat).
  // Best-effort: never fails the run.
  async function runSelfImprovement() {
    try {
      // F21: the audit trail is in the git dir. Ship-logs written before 6.44 still hold [loop] lines.
      const trail = [join(root, "conductor/0-compass/ship-log.md"), beatLogDir && join(beatLogDir, AUDIT_FILE)];
      const texts = await Promise.all(trail.filter(Boolean).map((f) => readFile(f, "utf8").catch(() => "")));
      const patterns = mineRecurringFailures(texts.join("\n"));
      const report = renderImprovementReport(patterns, { nowIso: new Date(Date.now()).toISOString() });
      if (!report) return; // nothing recurring → nothing to propose
      await writeFile(join(root, "conductor/1-workbench/loop-improvements.md"), report, "utf8");
      stdout.write(
        `[CONDUCTOR LOOP] self-improvement: ${patterns.length} recurring failure pattern(s) mined ` +
          `→ conductor/1-workbench/loop-improvements.md (proposed rules for review)\n`
      );
    } catch {
      /* best-effort — self-improvement must never break a run */
    }
  }

  // The Maker's whole signal file: { done, escalate, reason }. Absent or
  // malformed → no signal this beat.
  async function readSignalAt(cwd) {
    try {
      const sig = JSON.parse(await readFile(join(cwd, "conductor/1-workbench/maker-signal.json"), "utf8"));
      return sig && typeof sig === "object" ? sig : {};
    } catch {
      return {};
    }
  }
  // A13: the files a beat changed, from the HEAD before it to the HEAD after it.
  // A12: the ruling log in a worktree, before and after a beat.
  async function readRulingsAt(cwd) {
    try {
      return await readFile(join(cwd, RULINGS_REL), "utf8");
    } catch {
      return "";
    }
  }
  async function collectRulings(holder, cwd, before) {
    const added = newRulings(before, await readRulingsAt(cwd));
    if (!added.length) return;
    holder.rulings = [...(holder.rulings ?? []), ...added];
    await audit(`rulings: ${added.length} new (${added.filter((r) => r.risk === "high").length} high)`);
    for (const line of rulingInboxLines(added)) await writeInbox(root, state, line);
  }
  // Every ruling on a worktree's branch: its log minus the base checkout's. The
  // PR and the Checker use this, not the run's memory, so a reused worktree's
  // earlier rulings are never dropped. The inbox uses per-beat lines instead,
  // so no ruling is reported twice.
  async function branchRulings(cwd) {
    return newRulings(await readRulingsAt(root), await readRulingsAt(cwd));
  }
  // Unattended Lifecycle step 1: the Ship beat's prompt is Ship itself, then the
  // unattended rules from unattended-loop.md, then what to ship, then why the
  // last Ship beat was rejected, if it was.
  async function writeShipPrompt(key, task, branch, attempts) {
    const shipPath = join(root, stageWorkflowPath("ship"));
    const ship = (await exists(shipPath)) ? await readFile(shipPath, "utf8") : "";
    const rules = shipBeatSection((await exists(promptPath)) ? await readFile(promptPath, "utf8") : "");
    const p = join(tmpdir(), `conductor-ship-${String(key).replace(/[^a-z0-9]+/gi, "-")}.md`);
    const parts = [ship, "---", rules, `${renderShipAssignment(task, { branch })}${nestedNote()}`];
    if (attempts?.length) parts.push(renderAttempts(attempts));
    await writeFile(p, `${parts.join("\n\n")}\n`, "utf8");
    return p;
  }
  async function runShipIn(cwd, { key, task, branch, holder }) {
    await rm(join(cwd, "conductor/1-workbench/maker-signal.json"), { force: true }).catch(() => {});
    await rm(join(cwd, PR_BODY_REL), { force: true }).catch(() => {});
    const rulingsBefore = await readRulingsAt(cwd);
    const result = await adapter.runShipBeat({
      promptPath: await writeShipPrompt(key, task, branch, holder.attempts),
      cwd,
      permissionMode: "acceptEdits",
      settingsPath: sandboxSettingsPath,
      sandbox: agySandbox,
      allowedTools: allowedToolsFor(state),
      role: "ship",
      task,
    });
    const cap = await captureAll(cwd, autoCommitMessage({ role: "ship", goal: `${state.goal_description} — ship ${key}` }));
    if (cap.committed) await audit(`ship ${key}: auto-captured uncommitted changes`);
    await collectRulings(holder, cwd, rulingsBefore);
    return { ...result, signal: await readSignalAt(cwd) };
  }
  // Step 3: the Spec beat is Spec-It itself, then its unattended rules, then the slice.
  async function runSpecIn(cwd, task) {
    await rm(join(cwd, "conductor/1-workbench/maker-signal.json"), { force: true }).catch(() => {});
    const specPath = join(root, stageWorkflowPath("spec"));
    const specIt = (await exists(specPath)) ? await readFile(specPath, "utf8") : "";
    const rules = sectionOf((await exists(promptPath)) ? await readFile(promptPath, "utf8") : "", loopStage("spec").section);
    const assignment =
      `# Spec assignment (this beat)\n\n- **Slice folder:** \`${task.source?.path}\`\n- **Project:** ${task.source?.project}\n` +
      `- **Questions file:** \`${QUESTIONS_REL}/${roundKey(task.id)}.md\` (only for a one-way door: see the loop workflow)` +
      (task.answered_round ? `\n- **Your questions were answered:** read \`${task.answered_round}\` first, apply each answer, and record it as a decision in the spec.` : "");
    const parts = [specIt, "---", rules, `${assignment}${nestedNote()}`];
    if (task.attempts?.length) parts.push(renderAttempts(task.attempts));
    const p = join(tmpdir(), `conductor-spec-${task.id.replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(p, `${parts.join("\n\n")}\n`, "utf8");
    const rulingsBefore = await readRulingsAt(cwd);
    const result = await adapter.runSpecBeat({
      promptPath: p, cwd, permissionMode: "acceptEdits", settingsPath: sandboxSettingsPath,
      sandbox: agySandbox, allowedTools: allowedToolsFor(state), role: "spec", task,
    });
    const cap = await captureAll(cwd, autoCommitMessage({ role: "spec", goal: `spec ${task.id}` }));
    if (cap.committed) await audit(`spec ${task.id}: auto-captured uncommitted changes`);
    await collectRulings(task, cwd, rulingsBefore);
    return { ...result, signal: await readSignalAt(cwd) };
  }
  async function specEvidenceIn(cwd, task) {
    const read = async (p) => ((await exists(p)) ? readFile(p, "utf8") : "");
    const dir = join(cwd, task.source?.path ?? "");
    return checkSpecEvidence({
      spec: await read(join(dir, "feature-spec.md")),
      plan: await read(join(dir, "implementation-plan.md")),
      specTemplate: await read(join(root, "conductor/5-templates/carve-workflow/feature-spec.md")),
      planTemplate: await read(join(root, "conductor/5-templates/carve-workflow/implementation-plan.md")),
    });
  }
  // D2: the spec review is the Checker, told what it is reviewing this time.
  async function specCheckerPrompt(task) {
    const base = (await exists(checkerPromptPath)) ? await readFile(checkerPromptPath, "utf8") : "";
    const p = join(tmpdir(), `conductor-spec-review-${task.id.replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(
      p,
      `${base}\n\n---\n\n# This review: the slice's spec, before any code (D2)\n\n` +
        `Review \`${task.source?.path}/feature-spec.md\` and \`implementation-plan.md\` against the slice's entry in \`project-documentation.md\` and the project's Blueprint (\`blueprint/\`). ` +
        "There is no code yet: do not run tests. Approve only if every acceptance criterion of the slice is covered, the Brief check is answered, the plan builds what the spec says, " +
        "and no product decision is taken that is a one-way door. A spec that would build the wrong thing well is a BLOCKER.\n",
      "utf8"
    );
    return p;
  }

  // Step 5: a Blueprint beat is the stage's workflow, then its unattended rules, then the project.
  async function runStageIn(cwd, task, key) {
    const stage = BLUEPRINT_STAGES.find((s) => s.key === key);
    await rm(join(cwd, "conductor/1-workbench/maker-signal.json"), { force: true }).catch(() => {});
    const wfPath = join(root, stageWorkflowPath(key));
    const workflow = (await exists(wfPath)) ? await readFile(wfPath, "utf8") : "";
    const rules = sectionOf((await exists(promptPath)) ? await readFile(promptPath, "utf8") : "", loopStage(key).section);
    const assignment =
      `# Blueprint assignment (this beat)\n\n- **Project folder:** \`${task.source?.path}\` (the workflow's Target: read from it, do not ask)\n` +
      `- **Stage:** ${stage.key} (\`${stage.workflow}\`), writes \`${task.source?.path}/${stage.doc}\`\n` +
      `- **Questions file:** \`${roundRel(task)}\` (only for a one-way door: see the loop workflow)` +
      (task.answered_round ? `\n- **Your questions were answered:** read \`${task.answered_round}\` first, apply each answer, and record it as a decision in the document.` : "");
    const parts = [workflow, "---", rules, `${assignment}${nestedNote()}`];
    if (task.attempts?.length) parts.push(renderAttempts(task.attempts));
    const p = join(tmpdir(), `conductor-blueprint-${key}-${task.id.replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(p, `${parts.join("\n\n")}\n`, "utf8");
    const rulingsBefore = await readRulingsAt(cwd);
    const result = await adapter.runBlueprintBeat({
      promptPath: p, cwd, permissionMode: "acceptEdits", settingsPath: sandboxSettingsPath,
      sandbox: agySandbox, allowedTools: allowedToolsFor(state), role: "blueprint", task,
    });
    const cap = await captureAll(cwd, autoCommitMessage({ role: "blueprint", goal: `${key} ${task.id}` }));
    if (cap.committed) await audit(`${key} ${task.id}: auto-captured uncommitted changes`);
    await collectRulings(task, cwd, rulingsBefore);
    return { ...result, signal: await readSignalAt(cwd) };
  }
  async function stageEvidenceIn(cwd, task, key) {
    const read = async (p) => ((await exists(p)) ? readFile(p, "utf8") : "");
    const dir = join(cwd, task.source?.path ?? "");
    const docs = {};
    const templates = {};
    for (const s of BLUEPRINT_STAGES) {
      docs[s.doc] = await read(join(dir, s.doc));
      templates[s.doc] = await read(join(root, "conductor/5-templates", TEMPLATE_FOR[s.doc]));
    }
    const impl = join(dir, "implementations");
    let sliceCount = 0;
    for (const s of (await exists(impl)) ? await readdir(impl) : []) if (await exists(join(impl, s, "feature-spec.md"))) sliceCount += 1;
    return blueprintStageEvidence(key, {
      docs, templates, sliceCount,
      hasDesignMd: await exists(join(cwd, "DESIGN.md")),
      prBody: await read(join(cwd, PR_BODY_REL)),
    });
  }
  // D4: each Blueprint stage is reviewed by a fresh Checker with the stage's lens.
  async function blueprintCheckerPrompt(task, key) {
    const stage = BLUEPRINT_STAGES.find((s) => s.key === key);
    const base = (await exists(checkerPromptPath)) ? await readFile(checkerPromptPath, "utf8") : "";
    const p = join(tmpdir(), `conductor-blueprint-review-${key}-${task.id.replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(
      p,
      `${base}\n\n---\n\n# This review: the ${stage.key} stage of the Blueprint (D4)\n\n` +
        `Review \`${task.source?.path}/${stage.doc}\`${key === "ux-ui-brief" ? " and `DESIGN.md`" : ""}${key === "carve" ? ", the slice folders under `implementations/` and `conductor/1-workbench/pr-body.md`" : ""} ` +
        `with the **${stage.lens}** lens of \`.agents/skills/independent-review/SKILL.md\` (its Review lenses table says what done means). ` +
        `Read the inputs it builds on: Discovery (\`genesis/\`, \`storyboard/\`) and the earlier Blueprint documents in \`${task.source?.path}/blueprint/\`. ` +
        "There is no code to test: do not run tests. A document that would send every later stage the wrong way is a BLOCKER. " +
        "A one-way product decision (cannot be undone cheaply, contradicts an earlier decision, changes running cost) taken alone, without a question round, is a BLOCKER.\n",
      "utf8"
    );
    return p;
  }

  // Step 4: the round a beat wrote stays out of its branch; the owner answers
  // the copy in the root checkout, and the answered round rides in the branch.
  function roundRel(task) {
    return `${QUESTIONS_REL}/${roundKey(task.id)}.md`;
  }
  async function raiseRoundIn(cwd, task) {
    const file = join(cwd, roundRel(task));
    if (!(await exists(file))) return { ok: false, reasons: [`the beat signalled questions but wrote no ${roundRel(task)}`], count: 0 };
    const text = await readFile(file, "utf8");
    const check = checkRound(parseRound(text));
    if (!check.ok) return { ...check, count: 0 };
    if (resolve(cwd) !== resolve(root)) {
      await mkdir(join(root, QUESTIONS_REL), { recursive: true });
      await writeFile(join(root, roundRel(task)), text, "utf8");
    }
    return { ok: true, reasons: [], count: parseRound(text).questions.length };
  }
  async function roundForIn(cwd, task) {
    const rootFile = join(root, roundRel(task));
    if (!(await exists(rootFile))) return { state: "none" };
    const text = await readFile(rootFile, "utf8");
    const round = parseRound(text);
    if (!roundAnswered(round)) return { state: "unanswered", count: round.questions.length };
    const answeredRel = `${QUESTIONS_REL}/answered/${roundKey(task.id)}.md`;
    await mkdir(join(cwd, QUESTIONS_REL, "answered"), { recursive: true });
    await writeFile(join(cwd, answeredRel), text, "utf8");
    await rm(rootFile, { force: true });
    if (resolve(cwd) !== resolve(root)) await rm(join(cwd, roundRel(task)), { force: true });
    await audit(`task ${task.id}: the owner answered ${round.questions.length} question(s); resuming`);
    return { state: "answered", path: answeredRel };
  }
  // D1: a fresh Checker confirms each question is a one-way door the owner can answer cold.
  async function questionsCheckerPrompt(task) {
    const base = (await exists(checkerPromptPath)) ? await readFile(checkerPromptPath, "utf8") : "";
    const p = join(tmpdir(), `conductor-questions-review-${task.id.replace(/[^a-z0-9]+/gi, "-")}.md`);
    await writeFile(
      p,
      `${base}\n\n---\n\n# This review: a round of questions for the owner (D1, D5)\n\n` +
        `Review \`${roundRel(task)}\`. Do not run tests and do not review code. Approve only if every question is a one-way door: ` +
        "a decision that cannot be undone cheaply (data model, auth model, vendor, public API), contradicts an earlier decision, or changes what the product costs to run. " +
        "A two-way door (it only changes what a user sees or does, and the MR can reverse it) is a BLOCKER: name it, and say the Maker should decide it and log a high ruling. " +
        "Each question must be answerable cold by a product owner who has not read the code: plain context, options with their consequence, a recommendation with its reason, the cost of a wrong choice. " +
        "A question that needs the code or a long document to answer is a BLOCKER.\n",
      "utf8"
    );
    return p;
  }

  async function shipEvidenceIn(cwd, task) {
    const read = async (base, rel) => ((await exists(join(base, rel))) ? readFile(join(base, rel), "utf8") : "");
    const backlogRel = "conductor/2-backlog/task-backlog.md";
    const res = checkShipEvidence({
      rootShipLog: await read(root, "conductor/0-compass/ship-log.md"),
      branchShipLog: await read(cwd, "conductor/0-compass/ship-log.md"),
      body: await read(cwd, PR_BODY_REL),
      backlog: task?.source?.kind === "backlog" ? { title: task.title, after: await read(cwd, backlogRel) } : null,
      slice:
        task?.source?.kind === "slice"
          ? {
              stillInBacklog: await exists(join(cwd, task.source.path)),
              archived: await exists(join(cwd, "conductor/6-archive/completed-implementations", task.source.slice)),
            }
          : null,
    });
    return { ...res, body: await read(cwd, PR_BODY_REL) };
  }

  // The Checker's prompt plus the rulings it must review, via a scratch file.
  async function checkerPromptWithRulings(basePath, rulings, key) {
    const section = rulingsForChecker(rulings);
    if (!section) return basePath;
    const p = join(tmpdir(), `conductor-checker-rulings-${String(key).replace(/[^a-z0-9]+/gi, "-")}.md`);
    const base = (await exists(basePath)) ? await readFile(basePath, "utf8") : "";
    await writeFile(p, `${base}\n\n---\n\n${section}\n`, "utf8");
    return p;
  }

  async function changedFilesIn(cwd, from) {
    if (!from) return [];
    const [outerFrom, codeFrom] = String(from).split(":");
    const r = await runCli("git", ["diff", "--name-only", outerFrom, "HEAD"], cwd);
    const files = r.ok ? r.stdout.split("\n").filter(Boolean) : [];
    const code = codeWtOf(cwd);
    if (code && codeFrom) {
      const c = await runCli("git", ["diff", "--name-only", codeFrom, "HEAD"], code);
      if (c.ok) files.push(...c.stdout.split("\n").filter(Boolean).map((f) => `${loopConfig.codeDir}/${f}`));
    }
    return files;
  }

  // -------------------------------------------------------------------------
  async function runPairMode() {
    // Isolation: the Maker runs in a dedicated worktree during execution.
    let workCwd = root;
    if (state.phase === "execution") {
      try {
        await ensureWorktreesExcluded(root);
        const wt = await createWorktree({ root, goalDescription: state.goal_description, git });
        workCwd = wt.path;
        state.worktree = { path: wt.path, branch: wt.branch };
        await atomicWriteJson(statePath, state);
        stdout.write(`[CONDUCTOR LOOP] worktree: ${wt.branch} @ ${wt.path}${wt.created ? " (new)" : " (reused)"}\n`);
        // Conductor-enable the isolated Maker even if the scaffold is gitignored.
        await materializeContextInto(workCwd);
      } catch (e) {
        stderr.write(`Worktree isolation failed: ${e.message}\n`);
        return 1;
      }
      const setup = await runWorktreeSetup(workCwd);
      if (!setup.ok) {
        state.status = "halted_setup_failed";
        await atomicWriteJson(statePath, state);
        await writeInbox(root, state, `worktree setup failed — ${setup.reason}`);
        await audit(`halted_setup_failed: ${setup.reason}`);
        stderr.write(`⛔  loop.setup failed in ${workCwd} — ${setup.reason}\n`);
        return 1;
      }
    }

    // The maker signals "goal complete" by writing maker-signal.json; the driver
    // reads it after each beat (never trusts in-memory / clobbered state).
    const makerSignalPath = join(workCwd, "conductor/1-workbench/maker-signal.json");
    const readMakerDone = async () => {
      try {
        return JSON.parse(await readFile(makerSignalPath, "utf8"))?.done === true;
      } catch {
        return false; // absent → not claimed this beat
      }
    };

    // A13: when earlier beats were rejected, the Maker's prompt carries why.
    const pairWorkflowText = (await exists(promptPath)) ? await readFile(promptPath, "utf8") : "";
    const pairPromptPath = join(tmpdir(), `conductor-pair-beat-${process.pid}.md`);
    const deps = {
      verifyCommand,
      runBeat: async ({ escalateModel } = {}) => {
        await rm(makerSignalPath, { force: true }).catch(() => {}); // clear stale signal
        const rulingsBefore = await readRulingsAt(workCwd);
        let beatPrompt = promptPath;
        if (state.attempts?.length) {
          await writeFile(pairPromptPath, `${pairWorkflowText}\n\n---\n\n${renderAttempts(state.attempts)}\n`, "utf8");
          beatPrompt = pairPromptPath;
        }
        const result = await adapter.runBeat({
          escalateModel,
          promptPath: beatPrompt,
          cwd: workCwd,
          permissionMode: "acceptEdits",
          settingsPath: sandboxSettingsPath,
          sandbox: agySandbox,
          // E4: a run seeded by untrusted input gets an explicit tool ALLOWLIST
          // (null = unrestricted). Recomputed per beat so a trust change in
          // loop-state takes effect immediately.
          allowedTools: allowedToolsFor(state),
        });
        // P0.1 backstop: capture any uncommitted Maker change so verify sees a real
        // diff, the Checker has commits to review, and teardown can't discard it.
        const cap = await autoCommit({
          git: makeGit(workCwd),
          message: autoCommitMessage({ role: "maker", beat: state.iterations.current, goal: state.goal_description }),
        });
        if (cap.committed) {
          const note = `auto-captured uncommitted maker changes${cap.bypassedHooks ? " (commit hook bypassed)" : ""}`;
          stdout.write(`[CONDUCTOR LOOP] ${note}\n`);
          await audit(`beat ${state.iterations.current}: ${note}`);
        }
        await collectRulings(state, workCwd, rulingsBefore);
        return result;
      },
      runVerify: (cmd) => verifyWithEvidence(cmd, workCwd),
      gitHead: () => gitHead(workCwd),
      runChecker: async (o) => makeChecker(workCwd, await checkerPromptWithRulings(checkerPromptPath, await branchRulings(workCwd), "pair"))(o),
      readMakerDone,
      readMakerSignal: () => readSignalAt(workCwd),
      changedFiles: ({ from }) => changedFilesIn(workCwd, from),
      merge: makeMerge(workCwd, state.worktree?.branch, `Conductor loop: ${state.goal_description || "goal"}`, () => branchRulings(workCwd), () => state.ship?.body),
      runShip: () => runShipIn(workCwd, { key: "pair", task: null, branch: state.worktree?.branch, holder: state }),
      shipEvidence: () => shipEvidenceIn(workCwd, null),
      // Empty done-claim guard: only ship if the loop branch carries committed work
      // beyond master (a maker commit or a P0.1 auto-capture). Blueprint/non-execution
      // phases aren't gated on commits → true. `git` (root) sees the loop branch.
      branchHasWork: async (s) =>
        s.phase !== "execution" || !s.worktree?.branch
          ? true
          : hasUniqueCommits({ git, branch: s.worktree.branch, baseBranch: "HEAD" }),
      audit,
      now: () => Date.now(),
      persist: (s) => atomicWriteJson(statePath, s),
      writeInbox: (s, reason, o) => writeInbox(root, s, reason, o),
      log: (m) => stdout.write(`${m}\n`),
      costAware: loopConfig.costAware,
    };

    const final = await runLoop(state, deps);
    const cost = usageSummary(final);
    if (cost) {
      stdout.write(`[CONDUCTOR LOOP] cost: ${cost}\n`);
      await audit(`run cost: ${cost}`);
    }
    if (final.merge?.pr_url) stdout.write(`[CONDUCTOR LOOP] PR opened: ${final.merge.pr_url}\n`);

    if (state.phase === "execution" && final.worktree) {
      const t = await teardownWorktree({ root, goalDescription: state.goal_description, git });
      stdout.write(`[CONDUCTOR LOOP] ${t.reason}\n`);
    }
    stdout.write(`\n[CONDUCTOR LOOP] finished: ${final.status}\n`);
    return final.status === "completed" || final.status === "awaiting_review" ? 0 : 1;
  }

  async function runSwarmMode() {
    stdout.write(`[CONDUCTOR SWARM] ${state.tasks.length} tasks, concurrency=${state.concurrency}\n`);
    // Read the loop workflow once; each beat's assignment is appended to it (FB-4).
    const swarmWorkflowText = (await exists(promptPath)) ? await readFile(promptPath, "utf8") : "";
    const beatPromptFile = (id) => join(tmpdir(), `conductor-beat-${id.replace(/[^a-z0-9]+/gi, "-")}.md`);
    // The Checker runs in the task's ISOLATED worktree, which by design holds ONLY
    // this task's work. Left to its own devices it re-runs the repo-wide suite and
    // false-rejects (other tasks' files are absent) — the concurrency finding. So
    // when a task carries a scoped verify, hand the Checker a prompt that pins it to
    // exactly that command. Scratch file → nothing lands in the worktree, no
    // templates change. Tasks without a scoped verify use the default checker prompt.
    const checkerWorkflowText = (await exists(checkerPromptPath)) ? await readFile(checkerPromptPath, "utf8") : "";
    const checkerPromptFor = async (task) => {
      if (!task.verify) return checkerPromptPath;
      const p = join(tmpdir(), `conductor-checker-${task.id.replace(/[^a-z0-9]+/gi, "-")}.md`);
      await writeFile(
        p,
        `${checkerWorkflowText}\n\n---\n\n# Verification for THIS task (isolated worktree)\n` +
          `You are in a git worktree that contains ONLY this task's work; other tasks' files are ` +
          `absent BY DESIGN. Treat this as the verification floor and run EXACTLY it — do NOT run ` +
          `the repo-wide test suite, which will fail on the intentionally-missing files:\n\n` +
          "```\n" + `${task.verify}\n` + "```\n",
        "utf8"
      );
      return p;
    };
    // Per-task worktree registry so verify/checker/merge run against the right tree.
    const cwdFor = new Map();
    const deps = {
      verifyCommand,
      assignWorktree: async ({ task }) => {
        await ensureWorktreesExcluded(root);
        const plan = taskWorktreePlan(root, state.goal_description, task.id);
        // Idempotent (P1.4 resume): a prior interrupted run may have left this
        // task's worktree + branch on disk. Reuse it rather than failing the
        // `add`; a fresh `git worktree add` on an existing path/branch errors out.
        const list = await git(["worktree", "list", "--porcelain"]);
        const alreadyThere = list.ok && list.stdout.includes(plan.path);
        if (!alreadyThere) {
          // F14: from the default branch, never from the branch the owner has checked out.
          const base = (await defaultBranchRef(git)) ?? "HEAD";
          const res = await git(["worktree", "add", "-b", plan.branch, plan.path, base]);
          if (!res.ok) await git(["worktree", "add", plan.path, plan.branch]);
        }
        // Conductor-enable the isolated Maker even if the scaffold is gitignored.
        await materializeContextInto(plan.path);
        cwdFor.set(task.id, plan.path);
        cwdTask.set(resolve(plan.path), task.id);
        await hideFromGit(roundRel(task), { cwd: plan.path, git: makeGit(plan.path) });
        // Step 7: the code worktree inside it, from the code repository's default branch.
        if (loopConfig.codeDir) {
          const { codeWorktree } = codePaths({ root, codeDir: loopConfig.codeDir, outerWorktree: plan.path });
          const c = await ensureCodeWorktree({ codeGit: makeGit(codeRoot), path: codeWorktree, branch: plan.branch });
          if (!c.ok) return { path: plan.path, branch: plan.branch, setup_error: `code worktree: ${c.reason}` };
          for (const rel of [MAKER_SIGNAL_REL, VERDICT_REL, PR_BODY_REL]) await hideFromGit(rel, { cwd: codeWorktree, git: makeGit(codeWorktree) });
        }
        const setup = await runWorktreeSetup(codeWtOf(plan.path) ?? plan.path);
        if (!setup.ok) return { path: plan.path, branch: plan.branch, setup_error: setup.reason };
        // The claim is the loop branch itself (step 2): no commit on the owner's checkout.
        return { path: plan.path, branch: plan.branch };
      },
      runBeat: async ({ task, role, phase, escalateModel }) => {
        const taskCwd = cwdFor.get(task.id) ?? root;
        // F3: the swarm reads the Maker's signal too; clear the last beat's first.
        await rm(join(taskCwd, "conductor/1-workbench/maker-signal.json"), { force: true }).catch(() => {});
        const rulingsBefore = await readRulingsAt(taskCwd);
        // FB-4: hand the agent its work item by appending the routed assignment to
        // the loop workflow prompt, via a scratch file. Nothing lands in the
        // worktree (no tracked pollution) and no templates change.
        const beatPromptPath = beatPromptFile(task.id);
        await writeFile(beatPromptPath, `${swarmWorkflowText}\n\n---\n\n${renderAssignment(task)}${nestedNote()}\n`, "utf8");
        const result = await adapter.runBeat({
          promptPath: beatPromptPath,
          cwd: taskCwd,
          permissionMode: "acceptEdits",
          settingsPath: sandboxSettingsPath, // cli-native sandbox per fleet worker (claude)
          sandbox: agySandbox, // cli-native sandbox for agy (boolean --sandbox)
          allowedTools: allowedToolsFor(state), // E4: untrusted seed → tool allowlist
          // Forwarded so the beat can adopt the right brief (test-author vs
          // implementer). The agent also reads task.role/phase from loop-state.
          role,
          phase,
          escalateModel,
        });
        // P0.1 backstop (per-task worktree): never let uncommitted work be lost.
        const cap = await captureAll(taskCwd, autoCommitMessage({ role: role || "maker", goal: `${state.goal_description} — task ${task.id}` }));
        if (cap.committed) {
          const note = `task ${task.id}: auto-captured uncommitted changes${cap.bypassedHooks ? " (commit hook bypassed)" : ""}`;
          stdout.write(`[CONDUCTOR SWARM] ${note}\n`);
          await audit(note);
        }
        await collectRulings(task, taskCwd, rulingsBefore);
        return { ...result, signal: await readSignalAt(taskCwd) };
      },
      runVerify: async ({ task, cmd }) => {
        const t0 = Date.now();
        const r = await verifyWithEvidence(cmd, codeWtOf(cwdFor.get(task.id) ?? root) ?? cwdFor.get(task.id) ?? root);
        await emit("verify", { task: task.id, exit: r.exitCode, duration_s: Math.round((Date.now() - t0) / 1000), ...(r.reused ? { reused: true } : {}) });
        return r;
      },
      changedFiles: ({ task, from }) => changedFilesIn(cwdFor.get(task.id) ?? root, from),
      runChecker: async ({ task, phase }) => {
        const reviewsCode = !phase || phase === "ship";
        const c = await makeChecker(
          cwdFor.get(task.id) ?? root,
          await checkerPromptWithRulings(
            await withVerifyNote(await withNestedNote(phase === "spec"
              ? await specCheckerPrompt(task)
              : phase === "questions"
                ? await questionsCheckerPrompt(task)
                : phase?.startsWith("blueprint:")
                  ? await blueprintCheckerPrompt(task, phase.slice("blueprint:".length))
                  : await checkerPromptFor(task), task.id), task.id, reviewsCode && task.evidence?.exit_code === 0 ? task.verify ?? verifyCommand : null),
            await branchRulings(cwdFor.get(task.id) ?? root),
            task.id
          )
        )();
        await emit("verdict", { task: task.id, phase: phase ?? "code", approved: (c?.exitCode ?? 1) === 0, reason: c?.reasons?.[0] ?? null });
        return c;
      },
      // F7: would this branch collide with the base before we push it? Asked
      // against the object store from the ROOT checkout, so no working tree is
      // touched and no worktree has to be clean for it to answer.
      predictConflict: async ({ task }) => {
        const outer = await predictConflicts({ git, base: (await defaultBranchRef(git)) ?? "HEAD", branch: task.worktree?.branch });
        if (!loopConfig.codeDir || outer?.conflicted) return outer;
        const codeGit = makeGit(codeRoot);
        const base = await defaultBranchRef(codeGit);
        if (!base || !(await codeHasWork({ codeGit, branch: task.worktree?.branch }))) return outer;
        const code = await predictConflicts({ git: codeGit, base, branch: task.worktree?.branch });
        return code?.conflicted ? { ...code, files: (code.files ?? []).map((f) => `${loopConfig.codeDir}/${f}`) } : outer;
      },
      runShip: ({ task }) => runShipIn(cwdFor.get(task.id) ?? root, { key: task.id, task, branch: task.worktree?.branch, holder: task }),
      runSpec: ({ task }) => runSpecIn(cwdFor.get(task.id) ?? root, task),
      specEvidence: ({ task }) => specEvidenceIn(cwdFor.get(task.id) ?? root, task),
      roundFor: ({ task }) => roundForIn(cwdFor.get(task.id) ?? root, task),
      raiseRound: ({ task }) => raiseRoundIn(cwdFor.get(task.id) ?? root, task),
      runStage: ({ task, stage }) => runStageIn(cwdFor.get(task.id) ?? root, task, stage),
      stageEvidence: ({ task, stage }) => stageEvidenceIn(cwdFor.get(task.id) ?? root, task, stage),
      shipEvidence: ({ task }) => shipEvidenceIn(cwdFor.get(task.id) ?? root, task),
      // The done tick and the ship-log entry now ride in the task's branch (the
      // Ship beat), so merging the MR records the ship. Nothing is written to
      // the owner's checkout after the fact.
      merge: async ({ task }) =>
        (loopConfig.codeDir ? makeNestedMerge : makeMerge)(
          cwdFor.get(task.id) ?? root,
          task.worktree?.branch,
          mrTitles(task).code,
          () => branchRulings(cwdFor.get(task.id) ?? root),
          () => task.ship?.body
        )(),
      gitHead: async ({ task }) => {
        const cwd = cwdFor.get(task.id) ?? root;
        const code = codeWtOf(cwd);
        return code ? `${await gitHead(cwd)}:${await gitHead(code)}` : gitHead(cwd);
      },
      audit,
      now: () => Date.now(),
      persist: (s) => atomicWriteJson(statePath, s),
      writeInbox: (s, reason, o) => writeInbox(root, s, reason, o),
      log: (m) => stdout.write(`${m}\n`),
      costAware: loopConfig.costAware,
      emit,
    };

    const final = await runSwarm(state, deps);
    const cost = usageSummary(final);
    if (cost) {
      stdout.write(`[CONDUCTOR SWARM] cost: ${cost}\n`);
      await audit(`run cost: ${cost}`);
    }
    const merged = final.tasks.filter((t) => t.status === "merged").length;
    stdout.write(`\n[CONDUCTOR SWARM] finished: ${final.status} (${merged}/${final.tasks.length} tasks merged)\n`);
    // A round of questions is a planned pause for the owner, not a failure.
    return ["completed", "awaiting_review", "awaiting_answers"].includes(final.status) ? 0 : 1;
  }
}
