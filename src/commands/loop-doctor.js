// src/commands/loop-doctor.js
//
// `conductor loop doctor [dir] [--beat]`: gather the facts `diagnose`
// (src/loop/doctor.js) judges. Read-only for the project, except one probe
// worktree under `.agents/.worktrees/`, where real loop worktrees live so a
// setup with relative paths behaves as in a run. The probe is always removed.
//
// --beat also runs one sandboxed agent beat that executes the verify command.
// It costs a beat, so it is opt-in. It is the only check that shows what the
// sandbox itself blocks (F6: the first prep notes were proven wrong only there).

import { readFile, writeFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { normalizeState, resolveVerifyCommand, preflight, describeHalt } from "../loop/driver.js";
import { parseLoopConfig, resolveForge, mergeSandboxSettings } from "../loop/config.js";
import { planMergeAction } from "../loop/merge.js";
import { harvestWorkQueue } from "../loop/harvester.js";
import { diagnose, renderDoctor, doctorExitCode } from "../loop/doctor.js";
import { instructionWarningsFor } from "../claude-instructions.js";
import { ignoredNestedRepos } from "../nested-repos.js";
import { packageVersion, readVersionStamp } from "../version.js";
import { exists, readJson, sh, runCli, hasNpmTestScript, configVerify, readSlices } from "./loop.js";
import { harvestSlices } from "../loop/slices.js";
import { ensureWorktreesExcluded } from "../loop/worktree.js";
import { nextAfterDoctor } from "../next-step.js";

const STATE_REL = "conductor/1-workbench/loop-state.json";
const PROBE_REL = ".agents/.worktrees/conductor-doctor-probe";

async function onPath(bin) {
  return (await runCli("sh", ["-c", `command -v ${bin}`], process.cwd())).ok;
}

function tail(text, lines = 8) {
  return String(text ?? "").trim().split("\n").slice(-lines).join(" | ");
}

/** The probe beat: one sandboxed claude beat that runs the verify command. */
async function probeBeat({ cwd, verifyCommand, settingsPath }) {
  const prompt =
    `Run exactly this command with the Bash tool, once, and do nothing else: ${verifyCommand}\n` +
    "Then reply with exactly two lines:\n" +
    "BEAT_EXIT=<the command's exit code, or none if it did not run>\n" +
    "BEAT_BLOCKED=<the exact refusal, approval request or sandbox denial you saw, or none>";
  const res = await runCli("claude", ["-p", prompt, "--output-format", "json", "--permission-mode", "acceptEdits", "--settings", settingsPath], cwd);
  let text = res.stdout;
  try {
    const obj = JSON.parse(res.stdout);
    if (obj && typeof obj.result === "string") text = obj.result;
  } catch {
    /* not JSON: keep raw */
  }
  const exit = text.match(/BEAT_EXIT=(\S+)/)?.[1];
  const blocked = text.match(/BEAT_BLOCKED=(.+)/)?.[1]?.trim();
  return {
    ran: true,
    exitCode: exit && /^\d+$/.test(exit) ? Number(exit) : 1,
    blocked: blocked && blocked.toLowerCase() !== "none" ? blocked : exit === "none" ? "the command did not run" : null,
    tail: tail(text, 4),
  };
}

export async function loopDoctor(root, { stdout, beat = false }) {
  const statePath = join(root, STATE_REL);
  if (!(await exists(statePath))) {
    stdout.write(renderDoctor([{ id: "state", level: "fail", title: `no ${STATE_REL}`, detail: "", fix: "Run `conductor init` or `conductor upgrade`." }]));
    return 1;
  }
  const facts = {};
  let rawConfig = {};
  try {
    rawConfig = (await exists(join(root, "conductor.config.json"))) ? await readJson(join(root, "conductor.config.json")) : {};
  } catch (e) {
    facts.configErrors = [`conductor.config.json is not valid JSON: ${e.message}`];
  }
  const loopConfig = parseLoopConfig(rawConfig);
  facts.configErrors = [...(facts.configErrors ?? []), ...loopConfig.errors];

  const state = normalizeState(await readJson(statePath));
  facts.state = state;
  const verifyCommand = resolveVerifyCommand({
    stateCommand: state.verification.command,
    configVerify: await configVerify(root),
    hasNpmTestScript: await hasNpmTestScript(root),
  });
  facts.preflightHalt = preflight(state, { verifyCommand });
  facts.preflightReason = facts.preflightHalt ? describeHalt(state, facts.preflightHalt) : null;

  facts.projectVersion = readVersionStamp(join(root, ".agents"))?.frameworkVersion ?? null;
  facts.cliVersion = packageVersion();

  const profilePath = join(root, ".agents/sandbox/claude-sandbox.settings.json");
  let profile = null;
  try {
    profile = await readJson(profilePath);
  } catch {
    profile = null;
  }
  facts.profile = {
    credentials: Boolean(profile?.sandbox?.credentials?.files?.length),
    strict: profile?.sandbox?.allowUnsandboxedCommands === false && (profile?.permissions?.allow ?? []).includes("Bash"),
  };
  facts.hostTools = { bwrap: await onPath("bwrap"), socat: await onPath("socat") };

  const claudeOk = await onPath("claude");
  facts.claude = { available: claudeOk, warnings: claudeOk ? await instructionWarningsFor(root) : [] };

  const needsPr = planMergeAction({ autonomyLevel: state.autonomy_level, phase: state.phase }) === "pr";
  if (needsPr) {
    const remote = await runCli("git", ["remote", "get-url", "origin"], root);
    const fi = resolveForge({ override: loopConfig.forge, remoteUrl: remote.ok ? remote.stdout : "" });
    let authOk = false;
    if (fi.forge) authOk = (await runCli(fi.forge, ["auth", "status", ...(fi.host ? ["--hostname", fi.host] : [])], root)).ok;
    facts.forge = { needed: true, forge: fi.forge ?? null, host: fi.host ?? null, error: fi.error ?? null, authOk };
  }

  facts.nestedRepos = loopConfig.allowNestedRepo ? [] : await ignoredNestedRepos(root);

  const read = async (rel) => ((await exists(join(root, rel))) ? readFile(join(root, rel), "utf8") : "");
  const queue = harvestWorkQueue({
    inboxMd: await read("conductor/1-workbench/inbox.md"),
    backlogMd: await read("conductor/2-backlog/task-backlog.md"),
    requireReady: loopConfig.requireReady,
    priorities: loopConfig.priorities,
    includeInbox: loopConfig.inbox,
  });
  const slices = loopConfig.slices === true || loopConfig.slices.length ? harvestSlices(await readSlices(root, loopConfig.slices)) : [];
  facts.queue = { count: queue.length + slices.length, requireReady: loopConfig.requireReady };

  const dotenvPresent = await exists(join(root, ".env"));
  const ignored = dotenvPresent && (await runCli("git", ["check-ignore", "-q", ".env"], root)).ok;
  facts.dotenv = { present: Boolean(ignored), copiedBySetup: /\.env\b/.test(loopConfig.setup ?? "") };

  for (const ci of [".gitlab-ci.yml", ".github/workflows", "bitbucket-pipelines.yml", ".circleci/config.yml"]) {
    if (await exists(join(root, ci))) {
      facts.ciFile = ci;
      break;
    }
  }

  // The probe: a fresh worktree where real loop worktrees live.
  await ensureWorktreesExcluded(root);
  const probe = join(root, PROBE_REL);
  await runCli("git", ["worktree", "remove", "--force", probe], root);
  const added = await runCli("git", ["worktree", "add", "-q", "--detach", probe, "HEAD"], root);
  if (!added.ok) {
    facts.probe = { ran: true, setup: { configured: true, ok: false, reason: `could not create a worktree: ${tail(added.stderr)}` }, verify: null };
  } else {
    try {
      facts.probe = { ran: true, setup: { configured: Boolean(loopConfig.setup), ok: true }, verify: null };
      let setupOk = true;
      if (loopConfig.setup) {
        const t0 = Date.now();
        const r = await sh(loopConfig.setup, probe);
        setupOk = r.exitCode === 0;
        facts.probe.setup = { configured: true, ok: setupOk, secs: Math.round((Date.now() - t0) / 1000), reason: setupOk ? null : `exit ${r.exitCode}: ${tail(r.output)}` };
      }
      if (setupOk && verifyCommand) {
        const t0 = Date.now();
        const v = await sh(verifyCommand, probe);
        facts.probe.verify = { command: verifyCommand, exitCode: v.exitCode, secs: Math.round((Date.now() - t0) / 1000), tail: tail(v.output) };
        // The same command in the main checkout, where the owner pushes from.
        if (v.exitCode === 0) {
          const r = await sh(verifyCommand, root);
          facts.rootVerify = { exitCode: r.exitCode, tail: tail(r.output) };
        }
      }
      if (beat && setupOk && verifyCommand && claudeOk && state.sandbox === "cli-native" && profile) {
        const dir = await mkdtemp(join(tmpdir(), "conductor-doctor-"));
        const settingsPath = join(dir, "claude-sandbox.settings.json");
        await writeFile(settingsPath, JSON.stringify(mergeSandboxSettings(profile, loopConfig.allowedDomains)), "utf8");
        try {
          facts.beat = await probeBeat({ cwd: probe, verifyCommand, settingsPath });
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    } finally {
      await runCli("git", ["worktree", "remove", "--force", probe], root);
    }
  }

  const checks = diagnose(facts);
  stdout.write(renderDoctor(checks));
  if (!beat) stdout.write("  Add --beat to also run one sandboxed agent beat (costs one beat).\n");
  const code = doctorExitCode(checks);
  stdout.write(`  ${nextAfterDoctor(code === 0)}\n`);
  return code;
}
