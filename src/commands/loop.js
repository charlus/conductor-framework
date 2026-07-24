// src/commands/loop.js
//
// `conductor loop` — the deterministic autonomy driver as a CLI subcommand
// (ADR-0001 / Autonomous-Loop-Backend.md). Thins over src/loop/driver.js: this
// file is the IO shell (read/persist state, run git + verify, pick the adapter);
// all guarantees live in the pure driver so `node --test` can exercise them.

import { readFile, writeFile, rename, access, rm, cp, mkdir, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { runLoop, normalizeState, resolveVerifyCommand } from "../loop/driver.js";
import { resolveAdapter } from "../loop/adapters/index.js";
import { createWorktree, teardownWorktree, worktreePlan, materializeConductorContext, CONTEXT_ANCHORS } from "../loop/worktree.js";
import { autoCommit, autoCommitMessage } from "../loop/autocommit.js";
import { harvestWorkQueue, renderAssignment } from "../loop/harvester.js";
import { applyClaim, applyDone } from "../loop/writeback.js";
import { parseCheckerVerdict, verdictToExitCode, tallyVerdicts, VERDICT_REL } from "../loop/checker.js";
import { openPullRequest } from "../loop/merge.js";
import { runSwarm } from "../loop/swarm.js";
import { lockDecision, renderLock } from "../loop/lock.js";
import { reviveForResume } from "../loop/resume.js";
import { mineRecurringFailures, renderImprovementReport } from "../loop/improver.js";
import { parseTriggerPayload, applyTrigger, renderTriggerDoc } from "../loop/trigger.js";

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

/** The loop's own option tokens — used so `flagValue` never mistakes a missing
 *  value for the next flag (and vice-versa). */
const LOOP_FLAGS = new Set([
  "--unsafe-no-sandbox",
  "--dry-run",
  "--platform",
  "--goal",
  "--event",
  "--from-conductor",
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

/** Drop the current run's trigger brief into the workbench (best-effort). */
async function writeTriggerDoc(root, provenance) {
  try {
    await writeFile(join(root, TRIGGER_DOC_REL), renderTriggerDoc(provenance), "utf8");
  } catch {
    /* best-effort — the goal is already on the Spine */
  }
}

export async function loopCommand(args, { cwd, stdout, stderr }) {
  const positional = args.find((a) => !a.startsWith("-"));
  const root = resolve(cwd, positional || ".");
  const statePath = join(root, STATE_REL);
  const unsafe = args.includes("--unsafe-no-sandbox");
  const dryRun = args.includes("--dry-run");
  const platformFlag = flagValue(args, "--platform");
  const goalFlag = flagValue(args, "--goal");
  const eventFlag = flagValue(args, "--event");
  const fromConductor = args.includes("--from-conductor");

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

  // ---- Resume discipline (P1.4): a prior run may have died mid-beat, freezing a
  // task at a working status the frontier never re-selects (→ deadlock on resume)
  // or the pair run at a half-finished sub-status. Rewind those to a clean entry
  // point so THIS invocation picks up cleanly. Terminal work (merged/failed) is
  // untouched. Safe: the one-loop lock guarantees no live worker to race, and a
  // re-run is idempotent (maker re-verifies, auto-commit no-ops, merge reuses PR).
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
    harvestedQueue = harvestWorkQueue({ inboxMd, backlogMd });
    state.tasks = harvestedQueue; // swarm route; normalizeTask preserves title/source/route
    // persist + audit DEFERRED to the post-lock block below (dry-run stays read-only).
  }

  // Resolve the verify command up front (mirrors conductor_verify_cmd).
  const verifyCommand = resolveVerifyCommand({
    stateCommand: state.verification.command,
    configVerify: await configVerify(root),
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
                (triggerProvenance.clamped_from
                  ? `  ⛔ escalation to ${triggerProvenance.clamped_from} refused (clamped to operator ceiling)`
                  : ""),
            ]
          : []),
        `  phase:    ${state.phase}`,
        `  verify:   ${verifyCommand ?? "(none → will halt: halted_no_verification)"}`,
        `  beats:    ${state.iterations.current}/${state.iterations.max_allowed}`,
        `  autonomy: ${state.autonomy_level}  (${autonomySummary(state)})`,
        `  sandbox:  ${state.sandbox}${state.autonomy_level === "L3" && !["cli-native", "container"].includes(state.sandbox) ? "  ⛔ L3 requires sandbox=cli-native or container (will halt: halted_sandbox_required)" : ""}`,
        `  merge:    ${state.phase === "execution" && state.autonomy_level === "L3" ? "PR-gated (gh/glab) on completion" : "none (human reviews/merges)"}`,
        `  mode:     ${state.tasks?.length ? `swarm (${state.tasks.length} tasks)` : "pair (single goal)"}`,
        `  concurrency: ${state.concurrency}${state.concurrency > 1 && (state.autonomy_level !== "L3" || !(state.tasks?.length)) ? "  ⛔ swarm needs L3 + a task graph (will halt: halted_autonomy)" : ""}`,
        `  checker:  ${state.checker_votes > 1 ? `${state.checker_votes}-vote (adversarial, majority)` : "single verdict"}`,
        `  platform: ${platformPref ?? "(auto-detect)"}`,
        `  adapter:  ${adapterError ? `ERROR: ${adapterError}` : resolved.name ?? "(none available)"}`,
        `  detected: ${detected.length ? detected.join(", ") : "none on PATH"}`,
        `  worktree: ${state.phase === "execution" ? "created for execution phase (isolated Maker)" : "n/a (not execution phase)"}`,
        "",
      ].join("\n")
    );
    if (fromConductor) {
      stdout.write(`  harvested: ${harvestedQueue.length} work item(s) from conductor/\n`);
      for (const t of harvestedQueue) {
        stdout.write(`    - [${t.type}${t.priority ? " " + t.priority : ""}] ${t.title}  → ${t.route ?? "(brief)"}\n`);
      }
    }
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

  // cli-native sandbox: hand the claude beats a settings profile that turns ON
  // Anthropic's bubblewrap sandbox, fail-closed (failIfUnavailable). Only the
  // claude engine reads this — codex/agy provide their own out-of-process sandbox.
  let sandboxSettingsPath = null;
  if (state.sandbox === "cli-native" && adapter.name === "claude") {
    const p = join(root, ".agents/sandbox/claude-sandbox.settings.json");
    if (await exists(p)) {
      sandboxSettingsPath = p;
      stdout.write(`[CONDUCTOR LOOP] sandbox: cli-native (Anthropic bubblewrap via ${".agents/sandbox/claude-sandbox.settings.json"})\n`);
    } else {
      stderr.write(
        `[CONDUCTOR LOOP] ⛔ sandbox=cli-native but .agents/sandbox/claude-sandbox.settings.json is missing — refusing to run unsandboxed. Run 'conductor upgrade' to restore it.\n`
      );
      return 1;
    }
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
        await adapter.runChecker({ promptPath: checkerPrompt, cwd, permissionMode: "acceptEdits", settingsPath: sandboxSettingsPath });
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
      verdicts.push(parseCheckerVerdict(await runCheckerVote()));
    }
    const tally = tallyVerdicts(verdicts, votes);
    stdout.write(`[CONDUCTOR LOOP] checker: ${tally.approved ? "APPROVED" : "REJECTED"} — ${tally.reason}\n`);
    // P1.2: surface each verdict's reason so a rejection is diagnosable (empty-diff
    // / no-file plumbing issue vs a genuine substantive rejection).
    if (!tally.approved) {
      tally.reasons.forEach((r, i) => stdout.write(`[CONDUCTOR LOOP]   checker vote ${i + 1}: ${r}\n`));
      await audit(`checker rejected: ${tally.reasons.join(" | ")}`);
    }
    return { exitCode: verdictToExitCode(tally) };
  };

  // PR-gated merge for a worktree branch (never a direct push to a protected branch).
  const makeMerge = (cwd, branch, title) => async () => {
    if (!branch) return { ok: false, reason: "no worktree branch to open a PR from" };
    return openPullRequest({
      branch,
      title,
      git: makeGit(cwd),
      run: (cmd, argv) => runCli(cmd, argv, cwd),
      hasGh: await cliAvailable("gh"),
      hasGlab: await cliAvailable("glab"),
    });
  };

  const audit = (m) => appendShipLog(root, m, Date.now());

  // FB-2/FB-3: reflect a task's lifecycle into the ./conductor/ source of truth in
  // the MAIN repo (visible to a human in VS Code) — claim on dispatch, done on
  // ship. Best-effort: a write-back failure never crashes the run.
  async function updateConductorSource(task, transform, commitMsg) {
    const rel = task?.source?.kind === "inbox" ? INBOX_REL : task?.source?.kind === "backlog" ? BACKLOG_REL : null;
    if (!rel) return;
    const p = join(root, rel);
    try {
      if (!(await exists(p))) return;
      const before = await readFile(p, "utf8");
      const after = transform(before, task);
      if (after === before) return;
      await writeFile(p, after, "utf8");
      await runCli("git", ["add", rel], root);
      await runCli("git", ["commit", "-m", commitMsg], root);
    } catch {
      /* best-effort source-of-truth update */
    }
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
    await appendShipLog(
      root,
      `trigger from '${triggerProvenance.source}': goal="${state.goal_description}"${clamp}`,
      Date.now()
    );
  }
  if (fromConductor) {
    await appendShipLog(
      root,
      `harvested ${harvestedQueue.length} work item(s) from conductor/ (inbox + backlog)`,
      Date.now()
    );
  }

  try {
    const code =
      Array.isArray(state.tasks) && state.tasks.length > 0 ? await runSwarmMode() : await runPairMode();
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
      const logPath = join(root, "conductor/0-compass/ship-log.md");
      if (!(await exists(logPath))) return;
      const patterns = mineRecurringFailures(await readFile(logPath, "utf8"));
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

  // -------------------------------------------------------------------------
  async function runPairMode() {
    // Isolation: the Maker runs in a dedicated worktree during execution.
    let workCwd = root;
    if (state.phase === "execution") {
      try {
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

    const deps = {
      verifyCommand,
      runBeat: async () => {
        await rm(makerSignalPath, { force: true }).catch(() => {}); // clear stale signal
        const result = await adapter.runBeat({ promptPath, cwd: workCwd, permissionMode: "acceptEdits", settingsPath: sandboxSettingsPath });
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
        return result;
      },
      runVerify: (cmd) => sh(cmd, workCwd),
      gitHead: () => gitHead(workCwd),
      runChecker: makeChecker(workCwd),
      readMakerDone,
      merge: makeMerge(workCwd, state.worktree?.branch, `Conductor loop: ${state.goal_description || "goal"}`),
      audit,
      now: () => Date.now(),
      persist: (s) => atomicWriteJson(statePath, s),
      writeInbox: (s, reason) => writeInbox(root, s, reason),
      log: (m) => stdout.write(`${m}\n`),
    };

    const final = await runLoop(state, deps);
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
        const plan = worktreePlan(root, `${state.goal_description}-${task.id}`);
        // Idempotent (P1.4 resume): a prior interrupted run may have left this
        // task's worktree + branch on disk. Reuse it rather than failing the
        // `add`; a fresh `git worktree add` on an existing path/branch errors out.
        const list = await git(["worktree", "list", "--porcelain"]);
        const alreadyThere = list.ok && list.stdout.includes(plan.path);
        if (!alreadyThere) {
          const res = await git(["worktree", "add", "-b", plan.branch, plan.path]);
          if (!res.ok) await git(["worktree", "add", plan.path, plan.branch]);
        }
        // Conductor-enable the isolated Maker even if the scaffold is gitignored.
        await materializeContextInto(plan.path);
        cwdFor.set(task.id, plan.path);
        // FB-2: mark the item claimed in ./conductor/ so a human won't double-book it.
        // applyClaim is idempotent — a re-claim on resume no-ops (no diff → no commit).
        await updateConductorSource(task, applyClaim, `chore(loop): claim ${task.id}`);
        return { path: plan.path, branch: plan.branch };
      },
      runBeat: async ({ task, role, phase }) => {
        const taskCwd = cwdFor.get(task.id) ?? root;
        // FB-4: hand the agent its work item by appending the routed assignment to
        // the loop workflow prompt, via a scratch file. Nothing lands in the
        // worktree (no tracked pollution) and no templates change.
        const beatPromptPath = beatPromptFile(task.id);
        await writeFile(beatPromptPath, `${swarmWorkflowText}\n\n---\n\n${renderAssignment(task)}\n`, "utf8");
        const result = await adapter.runBeat({
          promptPath: beatPromptPath,
          cwd: taskCwd,
          permissionMode: "acceptEdits",
          settingsPath: sandboxSettingsPath, // cli-native sandbox per fleet worker
          // Forwarded so the beat can adopt the right brief (test-author vs
          // implementer). The agent also reads task.role/phase from loop-state.
          role,
          phase,
        });
        // P0.1 backstop (per-task worktree): never let uncommitted work be lost.
        const cap = await autoCommit({
          git: makeGit(taskCwd),
          message: autoCommitMessage({ role: role || "maker", goal: `${state.goal_description} — task ${task.id}` }),
        });
        if (cap.committed) {
          const note = `task ${task.id}: auto-captured uncommitted changes${cap.bypassedHooks ? " (commit hook bypassed)" : ""}`;
          stdout.write(`[CONDUCTOR SWARM] ${note}\n`);
          await audit(note);
        }
        return result;
      },
      runVerify: ({ task, cmd }) => sh(cmd, cwdFor.get(task.id) ?? root),
      runChecker: async ({ task }) => makeChecker(cwdFor.get(task.id) ?? root, await checkerPromptFor(task))(),
      merge: async ({ task }) => {
        const m = await makeMerge(
          cwdFor.get(task.id) ?? root,
          task.worktree?.branch,
          `Conductor task ${task.id}: ${task.title || task.type}`
        )();
        if (m?.ok) {
          // FB-3: reflect completion into the source of truth + ship-log.
          await updateConductorSource(task, applyDone, `chore(loop): ${task.id} done`);
          await appendShipLog(root, `shipped ${task.id} — ${task.title ?? task.type} (PR ${m.prUrl ?? "n/a"})`, Date.now());
        }
        return m;
      },
      gitHead: ({ task }) => gitHead(cwdFor.get(task.id) ?? root),
      audit,
      now: () => Date.now(),
      persist: (s) => atomicWriteJson(statePath, s),
      writeInbox: (s, reason) => writeInbox(root, s, reason),
      log: (m) => stdout.write(`${m}\n`),
    };

    const final = await runSwarm(state, deps);
    const merged = final.tasks.filter((t) => t.status === "merged").length;
    stdout.write(`\n[CONDUCTOR SWARM] finished: ${final.status} (${merged}/${final.tasks.length} tasks merged)\n`);
    return final.status === "completed" || final.status === "awaiting_review" ? 0 : 1;
  }
}
